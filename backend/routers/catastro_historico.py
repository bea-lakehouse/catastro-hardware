from __future__ import annotations

from collections import defaultdict
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

try:
    from backend.db.engine import get_engine
except ImportError:
    from db.engine import get_engine


router = APIRouter(prefix="/estadisticas", tags=["estadisticas", "catastro-historico"])
engine = get_engine()


def _historical_quality_defaults(source: str = "unavailable", error: str | None = None) -> dict[str, object]:
    quality = {
        "future_records_excluded": 0,
        "google_sheet_history_from": None,
        "google_sheet_history_to": None,
        "google_sheet_runs": 0,
        "eventos_sin_sku": 0,
        "eventos_con_sku": 0,
        "eventos_sku_enriquecidos_marca_modelo": 0,
        "eventos_sku_enriquecidos_tipo_colaborador": 0,
        "eventos_sku_enriquecidos_so": 0,
        "event_source": source,
    }
    if error:
        quality["quality_warning"] = error
    return quality


def _resolve_historical_event_source(conn) -> str | None:
    candidate_relations = (
        "analytics.int_mtr_eventos_dedup_stats",
        "analytics.mart_catastro_historia_eventos",
        "analytics.mart_historia_eventos",
    )

    for relation in candidate_relations:
        exists = conn.execute(text("select to_regclass(:relation)"), {"relation": relation}).scalar()
        if exists:
            return relation
    return None


def _build_historical_quality_query(source_relation: str) -> text:
    date_column = "fecha_evento_dia" if source_relation.endswith("int_mtr_eventos_dedup_stats") else "fecha_evento"

    return text(
        f"""
        with event_source as (
          select
            id_equipo,
            {date_column}::date as fecha_evento
          from {source_relation}
          where {date_column} is not null
        ),
        event_base as (
          select *
          from event_source
          where fecha_evento >= date '2024-01-01'
            and fecha_evento <= current_date
        ),
        enriched as (
          select
            e.id_equipo,
            a.marca,
            a.modelo,
            a.tipo_colaborador_mtr,
            a.sistema_operativo
          from event_base e
          left join analytics.stg_mtr_google_sheet_equipos_asignados a
            on upper(coalesce(e.id_equipo, '')) = upper(coalesce(a.id_equipo, ''))
          where coalesce(e.id_equipo, '') <> ''
        )
        select
          (select count(*) from event_source where fecha_evento > current_date) as future_records_excluded,
          (select min(inserted_at)::date from raw.mtr_google_sheet_rows) as google_sheet_history_from,
          (select max(inserted_at)::date from raw.mtr_google_sheet_rows) as google_sheet_history_to,
          (select count(distinct run_id) from raw.mtr_google_sheet_rows) as google_sheet_runs,
          (select count(*) from event_base where coalesce(id_equipo, '') = '') as eventos_sin_sku,
          (select count(*) from event_base where coalesce(id_equipo, '') <> '') as eventos_con_sku,
          (select count(*) from enriched where marca is not null and modelo is not null) as eventos_sku_enriquecidos_marca_modelo,
          (select count(*) from enriched where tipo_colaborador_mtr is not null) as eventos_sku_enriquecidos_tipo_colaborador,
          (select count(*) from enriched where sistema_operativo is not null) as eventos_sku_enriquecidos_so,
          :source_relation as event_source
        """
    )


def _historical_dimension_label(
    dimension_name: str,
    value: str,
    ingresos_sin_equipo: int,
    presion_compra: int,
) -> tuple[str, str, str | None]:
    normalized = (value or "").strip()
    upper_value = normalized.upper()
    lower_value = normalized.lower()

    if dimension_name in {"modelo", "marca"} and upper_value in {"SIN_MODELO", "SIN_MARCA"}:
        return (
            "Sin SKU (sin equipo)",
            "sin_equipo_presion",
            "Representa ingresos sin equipo asignado y presión real de compra, no un error de datos.",
        )

    if dimension_name == "os_familia" and upper_value == "UNKNOWN":
        return (
            "Sin equipo asignado",
            "sin_equipo_presion",
            "Corresponde a eventos sin SKU y sin equipo asignado al momento del ingreso.",
        )

    if dimension_name == "tipo_colaborador" and lower_value == "unknown":
        return (
            "No clasificado",
            "dato_incompleto",
            "El evento no trae clasificación suficiente para CORE o Staffing.",
        )

    if upper_value == "UNKNOWN" and (ingresos_sin_equipo > 0 or presion_compra > 0):
        return (
            "Sin SKU (sin equipo)",
            "sin_equipo_presion",
            "La lectura correcta es demanda sin equipo asignado, no dato faltante estructural.",
        )

    if upper_value == "UNKNOWN":
        return (
            "No clasificado",
            "dato_incompleto",
            "Hay información incompleta en esta dimensión para parte de los eventos.",
        )

    return normalized or "No clasificado", "normal", None


@router.get("/catastro-historico")
def catastro_historico(
    date_from: date = Query(default=date(2024, 1, 1)),
    date_to: date | None = Query(default=None),
    top_n: int = Query(default=10, ge=1, le=50),
):
    date_to = date_to or date.today()

    if date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from no puede ser mayor que date_to")

    sql_mensual = text(
        """
        select
          mes,
          movimientos_total,
          ingresos_totales,
          salidas_totales,
          ingresos_nuevos,
          ingresos_internos,
          ingresos_con_equipo,
          ingresos_sin_equipo,
          salidas_con_sku,
          salidas_sin_sku,
          movimientos_internos,
          asignaciones,
          devoluciones,
          stock_visible_mes,
          oferta_disponible_mes,
          stock_visible_actual_ref,
          asignados_actual_ref,
          oferta_disponible_actual_ref,
          presion_compra,
          ingresos_extranjeros,
          salidas_extranjeros,
          balance_neto,
          pct_movimiento_sobre_stock_actual_ref,
          gap_operativo_estimado,
          gap_vs_oferta_actual_ref,
          stock_historico_reconstruible,
          nota_stock,
          nota_ingresos_internos
        from analytics.mart_catastro_historia_mensual
        where mes >= date_trunc('month', cast(:date_from as date))::date
          and mes <= date_trunc('month', cast(:date_to as date))::date
        order by mes
        """
    )

    sql_dims = text(
        """
        select
          mes,
          dimension_name,
          dimension_value,
          movimientos_total,
          ingresos_totales,
          salidas_totales,
          ingresos_nuevos,
          ingresos_internos,
          ingresos_con_equipo,
          ingresos_sin_equipo,
          salidas_con_sku,
          salidas_sin_sku,
          presion_compra
        from analytics.mart_catastro_historia_mensual_dimension
        where mes >= date_trunc('month', cast(:date_from as date))::date
          and mes <= date_trunc('month', cast(:date_to as date))::date
        order by dimension_name, dimension_value, mes
        """
    )

    try:
        with engine.connect() as conn:
            mensual_rows = [dict(r) for r in conn.execute(sql_mensual, {"date_from": date_from, "date_to": date_to}).mappings().all()]
            dimension_rows = [dict(r) for r in conn.execute(sql_dims, {"date_from": date_from, "date_to": date_to}).mappings().all()]
            quality_source = _resolve_historical_event_source(conn)
            quality = _historical_quality_defaults(
                source=quality_source or "unavailable",
                error="No hay fuente histórica auxiliar disponible para calidad_datos." if quality_source is None else None,
            )
            if quality_source:
                try:
                    sql_quality = _build_historical_quality_query(quality_source)
                    quality = dict(
                        conn.execute(sql_quality, {"source_relation": quality_source}).mappings().first()
                        or quality
                    )
                except SQLAlchemyError as quality_exc:
                    quality = _historical_quality_defaults(
                        source=quality_source,
                        error=f"No pude calcular calidad_datos desde {quality_source}: {quality_exc}",
                    )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail=f"catastro_historico failed: {exc}")

    resumen = {
        "meses": len(mensual_rows),
        "movimientos_total": sum(int(r.get("movimientos_total") or 0) for r in mensual_rows),
        "ingresos_totales": sum(int(r.get("ingresos_totales") or 0) for r in mensual_rows),
        "salidas_totales": sum(int(r.get("salidas_totales") or 0) for r in mensual_rows),
        "ingresos_nuevos": sum(int(r.get("ingresos_nuevos") or 0) for r in mensual_rows),
        "ingresos_internos": sum(int(r.get("ingresos_internos") or 0) for r in mensual_rows),
        "ingresos_con_equipo": sum(int(r.get("ingresos_con_equipo") or 0) for r in mensual_rows),
        "ingresos_sin_equipo": sum(int(r.get("ingresos_sin_equipo") or 0) for r in mensual_rows),
        "salidas_con_sku": sum(int(r.get("salidas_con_sku") or 0) for r in mensual_rows),
        "salidas_sin_sku": sum(int(r.get("salidas_sin_sku") or 0) for r in mensual_rows),
        "movimientos_internos": sum(int(r.get("movimientos_internos") or 0) for r in mensual_rows),
        "asignaciones": sum(int(r.get("asignaciones") or 0) for r in mensual_rows),
        "devoluciones": sum(int(r.get("devoluciones") or 0) for r in mensual_rows),
        "presion_compra": sum(int(r.get("presion_compra") or 0) for r in mensual_rows),
        "balance_neto": sum(int(r.get("balance_neto") or 0) for r in mensual_rows),
        "gap_operativo_estimado": sum(int(r.get("gap_operativo_estimado") or 0) for r in mensual_rows),
        "gap_vs_oferta_actual_ref": sum(int(r.get("gap_vs_oferta_actual_ref") or 0) for r in mensual_rows),
        "stock_visible_actual_ref": int(mensual_rows[-1].get("stock_visible_actual_ref") or 0) if mensual_rows else 0,
        "asignados_actual_ref": int(mensual_rows[-1].get("asignados_actual_ref") or 0) if mensual_rows else 0,
        "oferta_disponible_actual_ref": int(mensual_rows[-1].get("oferta_disponible_actual_ref") or 0) if mensual_rows else 0,
    }

    grouped: dict[str, dict[str, dict[str, object]]] = defaultdict(dict)
    for row in dimension_rows:
        name = str(row["dimension_name"])
        value = str(row["dimension_value"])
        bucket = grouped[name].setdefault(
            value,
            {
                "value": value,
                "movimientos_total": 0,
                "ingresos_totales": 0,
                "salidas_totales": 0,
                "ingresos_nuevos": 0,
                "ingresos_internos": 0,
                "ingresos_con_equipo": 0,
                "ingresos_sin_equipo": 0,
                "salidas_con_sku": 0,
                "salidas_sin_sku": 0,
                "presion_compra": 0,
                "monthly": [],
            },
        )
        for key in (
            "movimientos_total",
            "ingresos_totales",
            "salidas_totales",
            "ingresos_nuevos",
            "ingresos_internos",
            "ingresos_con_equipo",
            "ingresos_sin_equipo",
            "salidas_con_sku",
            "salidas_sin_sku",
            "presion_compra",
        ):
            bucket[key] = int(bucket[key]) + int(row.get(key) or 0)
        bucket["monthly"].append(
            {
                "mes": row["mes"],
                "movimientos_total": int(row.get("movimientos_total") or 0),
                "ingresos_totales": int(row.get("ingresos_totales") or 0),
                "salidas_totales": int(row.get("salidas_totales") or 0),
                "ingresos_nuevos": int(row.get("ingresos_nuevos") or 0),
                "ingresos_internos": int(row.get("ingresos_internos") or 0),
                "ingresos_con_equipo": int(row.get("ingresos_con_equipo") or 0),
                "ingresos_sin_equipo": int(row.get("ingresos_sin_equipo") or 0),
                "salidas_con_sku": int(row.get("salidas_con_sku") or 0),
                "salidas_sin_sku": int(row.get("salidas_sin_sku") or 0),
                "presion_compra": int(row.get("presion_compra") or 0),
            }
        )

    breakdowns: dict[str, list[dict[str, object]]] = {}
    for dimension_name, values in grouped.items():
        ranked = sorted(
            values.values(),
            key=lambda item: (
                int(item["presion_compra"]),
                int(item["movimientos_total"]),
                str(item["value"]),
            ),
            reverse=True,
        )[:top_n]
        for item in ranked:
            display_value, interpretation, explanatory_note = _historical_dimension_label(
                dimension_name,
                str(item["value"]),
                int(item["ingresos_sin_equipo"]),
                int(item["presion_compra"]),
            )
            item["display_value"] = display_value
            item["interpretation"] = interpretation
            if explanatory_note:
                item["explanatory_note"] = explanatory_note
        breakdowns[dimension_name] = ranked

    months_without_movements = [r["mes"] for r in mensual_rows if int(r.get("movimientos_total") or 0) == 0]

    return {
        "periodo": {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "top_n": top_n,
        },
        "resumen": resumen,
        "mensual": mensual_rows,
        "breakdowns": breakdowns,
        "calidad_datos": {
            **quality,
            "stock_historico_reconstruible": False,
            "months_without_movements": months_without_movements,
            "notes": [
                f"La serie usa como apoyo histórico {quality.get('event_source') or 'sin fuente auxiliar'} para calidad_datos.",
                "Los movimientos internos se calculan desde fct_movimientos_detalle como reasignaciones con cliente origen y destino distintos, sin pasar por stock.",
                "No existe snapshot mensual histórico del parque ni de equipos disponibles antes del 2026-04-11 en raw.mtr_google_sheet_rows; por eso stock_visible_mes y oferta_disponible_mes quedan nulos.",
                "Los ingresos con SKU quedan clasificados como internos y los ingresos sin SKU siguen presionando compra; para movilidad real entre clientes debe leerse movimientos_internos.",
                "Los desgloses por marca, modelo, OS y tipo_colaborador solo aplican donde existe SKU o fue posible enriquecer el evento desde el parque actual / hoja de asignados.",
                "Los valores 'Sin SKU' representan ingresos sin equipo asignado y explican la presión de compra.",
            ],
        },
    }
