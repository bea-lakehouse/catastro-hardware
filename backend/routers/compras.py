from datetime import date
from typing import Any

from fastapi import APIRouter, Path, Query
from sqlalchemy import text

try:
    from backend.db.engine import get_connection
except ImportError:
    from db.engine import get_connection


router = APIRouter(prefix="/compras", tags=["Compras"])


def _month_start(value: date | None, fallback: date | None = None) -> date:
    base = value or fallback or date.today()
    return base.replace(day=1)


def _to_int(value: Any) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def _to_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


@router.get("/backlog")
def backlog(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    sql = text("""
      select *
      from analytics.mart_backlog_compras
      order by mes_sugerido asc, segmento_destino asc, costo_total_usd desc
      limit :limit offset :offset
    """)
    sql_count = text("select count(*) as total from analytics.mart_backlog_compras")

    with get_connection() as conn:
        rows = [dict(r) for r in conn.execute(sql, {"limit": limit, "offset": offset}).mappings().fetchall()]
        total = conn.execute(sql_count).scalar_one()

    return {"total": total, "limit": limit, "offset": offset, "rows": rows}


@router.get("/documentos")
def documentos_2026(year: int = Query(2026, ge=2024, le=2035)):
    sql = text("""
        with docs as (
            select
                documento_id,
                empresa,
                proveedor,
                tipo_documento,
                numero_documento,
                fecha_emision,
                fecha_vencimiento,
                orden_compra,
                total_neto,
                iva,
                total,
                moneda,
                archivo_origen,
                observaciones,
                count(*)::int as lineas,
                sum(case when categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_documentadas,
                sum(case when tipo_documento = 'factura' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_facturadas,
                sum(case when tipo_documento = 'guia_despacho' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_recibidas,
                sum(case when tipo_documento = 'orden_compra' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_proyectadas,
                sum(case when tipo_documento = 'factura' then unidades_pendientes_recepcion else 0 end)::int as unidades_pendientes_recepcion,
                sum(case when tipo_documento = 'guia_despacho' and conciliacion_status = 'pendiente_conciliacion' then cantidad else 0 end)::int as unidades_pendientes_conciliacion,
                count(*) filter (where matched_equipo_id is not null)::int as lineas_conciliadas
            from analytics.mart_compras_equipos_2026
            where extract(year from fecha_emision) = :year
            group by 1,2,3,4,5,6,7,8,9,10,11,12,13,14
        )
        select *
        from docs
        order by fecha_emision asc, numero_documento asc
    """)

    with get_connection() as conn:
        rows = [dict(r) for r in conn.execute(sql, {"year": year}).mappings().all()]

    return {
        "year": year,
        "count": len(rows),
        "rows": rows,
    }


@router.get("/documentos/{documento_id}")
def documento_2026_detalle(documento_id: str = Path(..., min_length=3)):
    sql_header = text("""
        select
            documento_id,
            empresa,
            proveedor,
            tipo_documento,
            numero_documento,
            fecha_emision,
            fecha_vencimiento,
            orden_compra,
            total_neto,
            iva,
            total,
            moneda,
            archivo_origen,
            observaciones,
            count(*)::int as lineas,
            sum(case when categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_documentadas,
            sum(case when tipo_documento = 'factura' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_facturadas,
            sum(case when tipo_documento = 'guia_despacho' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_recibidas,
            sum(case when tipo_documento = 'orden_compra' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_proyectadas,
            sum(case when tipo_documento = 'factura' then unidades_pendientes_recepcion else 0 end)::int as unidades_pendientes_recepcion,
            sum(case when tipo_documento = 'guia_despacho' and conciliacion_status = 'pendiente_conciliacion' then cantidad else 0 end)::int as unidades_pendientes_conciliacion
        from analytics.mart_compras_equipos_2026
        where documento_id = :documento_id
        group by 1,2,3,4,5,6,7,8,9,10,11,12,13,14
    """)

    sql_lines = text("""
        select
            linea_id,
            marca,
            modelo,
            descripcion_original,
            cantidad,
            precio_unitario,
            total_linea,
            tipo_equipo,
            categoria_equipo,
            ram_gb,
            almacenamiento_gb,
            procesador,
            pantalla,
            anio_compra,
            mes_compra,
            almacenamiento_tipo,
            sistema_operativo,
            serial,
            matched_equipo_id,
            matched_estado_operativo,
            matched_cliente,
            cantidad_recibida_relacionada,
            unidades_pendientes_recepcion,
            conciliacion_status,
            recepcion_status
        from analytics.mart_compras_equipos_2026
        where documento_id = :documento_id
        order by linea_id
    """)

    with get_connection() as conn:
        header = conn.execute(sql_header, {"documento_id": documento_id}).mappings().first()
        lines = [dict(r) for r in conn.execute(sql_lines, {"documento_id": documento_id}).mappings().all()]

    return {
        "documento": dict(header) if header else None,
        "lineas": lines,
    }


@router.get("/resumen-2026")
def resumen_2026():
    sql_summary = text("""
        with doc_counts as (
            select
                count(distinct documento_id)::int as documentos_total,
                count(distinct proveedor)::int as proveedores_total
            from analytics.mart_compras_equipos_2026
            where extract(year from fecha_emision) = 2026
        ),
        model_counts as (
            select
                count(distinct modelo)::int as modelos_total
            from analytics.mart_compras_equipos_2026
            where extract(year from fecha_emision) = 2026
              and categoria_equipo in ('macbook', 'hp')
        ),
        month_rollup as (
            select
                sum(documentos_factura)::int as documentos_factura,
                sum(documentos_guia_despacho)::int as documentos_guia_despacho,
                sum(documentos_orden_compra)::int as documentos_orden_compra,
                sum(total_neto_facturado)::numeric(14,0) as total_neto_facturado,
                sum(iva_facturado)::numeric(14,0) as iva_facturado,
                sum(total_facturado)::numeric(14,0) as total_facturado,
                sum(presupuesto_neto_proyectado)::numeric(14,0) as presupuesto_neto_proyectado,
                sum(presupuesto_total_proyectado)::numeric(14,0) as presupuesto_total_proyectado,
                sum(unidades_facturadas)::int as unidades_facturadas,
                sum(unidades_recibidas)::int as unidades_recibidas,
                sum(unidades_proyectadas)::int as unidades_proyectadas,
                sum(unidades_pendientes_recepcion)::int as unidades_pendientes_recepcion,
                sum(unidades_pendientes_conciliacion)::int as unidades_pendientes_conciliacion,
                sum(documentos_factura_sin_ingreso_stock)::int as documentos_factura_sin_ingreso_stock,
                sum(documentos_guia_sin_match_mtr)::int as documentos_guia_sin_match_mtr
            from analytics.mart_compras_equipos_resumen_mes
            where extract(year from mes) = 2026
        )
        select
            d.documentos_total,
            d.proveedores_total,
            m.modelos_total,
            r.unidades_facturadas,
            r.unidades_recibidas,
            r.unidades_proyectadas,
            r.unidades_pendientes_recepcion,
            r.unidades_pendientes_conciliacion,
            r.documentos_factura_sin_ingreso_stock,
            r.documentos_guia_sin_match_mtr,
            r.total_neto_facturado,
            r.iva_facturado,
            r.total_facturado,
            r.presupuesto_neto_proyectado,
            r.presupuesto_total_proyectado
        from doc_counts d
        cross join model_counts m
        cross join month_rollup r
    """)

    sql_monthly = text("""
        select *
        from analytics.mart_compras_equipos_resumen_mes
        where extract(year from mes) = 2026
        order by mes
    """)

    sql_models = text("""
        select
            marca,
            modelo,
            categoria_equipo,
            sum(case when tipo_documento = 'factura' then cantidad else 0 end)::int as unidades_facturadas,
            sum(case when tipo_documento = 'guia_despacho' then cantidad else 0 end)::int as unidades_recibidas,
            sum(case when tipo_documento = 'orden_compra' then cantidad else 0 end)::int as unidades_proyectadas,
            sum(case when tipo_documento = 'factura' then coalesce(total_linea, 0) else 0 end)::numeric(14,0) as monto_facturado,
            sum(case when tipo_documento = 'orden_compra' then coalesce(total_linea, 0) else 0 end)::numeric(14,0) as monto_proyectado
        from analytics.mart_compras_equipos_2026
        where extract(year from fecha_emision) = 2026
          and categoria_equipo in ('macbook', 'hp')
        group by 1,2,3
        order by unidades_facturadas desc, unidades_proyectadas desc, marca, modelo
    """)

    sql_providers = text("""
        select
            proveedor,
            count(distinct documento_id)::int as documentos,
            sum(case when tipo_documento = 'factura' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_facturadas,
            sum(case when tipo_documento = 'guia_despacho' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_recibidas,
            sum(case when tipo_documento = 'orden_compra' and categoria_equipo in ('macbook', 'hp') then cantidad else 0 end)::int as unidades_proyectadas,
            sum(case when tipo_documento = 'factura' then total else 0 end)::numeric(14,0) as total_facturado
        from analytics.mart_compras_equipos_2026
        where extract(year from fecha_emision) = 2026
        group by 1
        order by total_facturado desc, proveedor
    """)

    sql_pending_docs = text("""
        with docs as (
            select
                documento_id,
                proveedor,
                tipo_documento,
                numero_documento,
                fecha_emision,
                sum(case when tipo_documento = 'factura' then unidades_pendientes_recepcion else 0 end)::int as unidades_pendientes_recepcion,
                sum(case when tipo_documento = 'guia_despacho' and conciliacion_status = 'pendiente_conciliacion' then cantidad else 0 end)::int as unidades_pendientes_conciliacion
            from analytics.mart_compras_equipos_2026
            where extract(year from fecha_emision) = 2026
            group by 1,2,3,4,5
        )
        select *
        from docs
        where unidades_pendientes_recepcion > 0
           or unidades_pendientes_conciliacion > 0
        order by fecha_emision, numero_documento
    """)

    sql_planeacion = text("""
        select *
        from analytics.mart_planeacion_con_compras
        where extract(year from mes) = 2026
        order by mes
    """)

    with get_connection() as conn:
        summary_row = conn.execute(sql_summary).mappings().first()
        monthly = [dict(r) for r in conn.execute(sql_monthly).mappings().all()]
        by_model = [dict(r) for r in conn.execute(sql_models).mappings().all()]
        by_provider = [dict(r) for r in conn.execute(sql_providers).mappings().all()]
        pending_docs = [dict(r) for r in conn.execute(sql_pending_docs).mappings().all()]
        planeacion = [dict(r) for r in conn.execute(sql_planeacion).mappings().all()]

    return {
        "summary": dict(summary_row) if summary_row else {},
        "monthly": monthly,
        "by_model": by_model,
        "by_provider": by_provider,
        "pending_documents": pending_docs,
        "planeacion": planeacion,
    }


@router.get("/forecast")
def forecast_compras(mes: date | None = Query(default=date(2026, 6, 1))):
    selected_month = _month_start(mes, fallback=date(2026, 6, 1))

    sql_rows = text("""
        select
            mes,
            empresa,
            proveedor,
            marca,
            modelo,
            categoria_equipo,
            cantidad_planeada,
            precio_unitario_referencia,
            presupuesto_estimado_clp,
            documentos,
            ordenes_compra,
            demanda_presion_compra_mes_base,
            stock_disponible_confirmado_base,
            stock_disponible_total_base
        from analytics.mart_forecast_compras
        where mes = :mes
        order by proveedor, marca, modelo
    """)

    sql_planeacion = text("""
        select *
        from analytics.mart_planeacion_con_compras
        where mes = :mes
    """)

    with get_connection() as conn:
        rows = [dict(r) for r in conn.execute(sql_rows, {"mes": selected_month}).mappings().all()]
        planeacion = conn.execute(sql_planeacion, {"mes": selected_month}).mappings().first()

    macbook_units = sum(_to_int(row.get("cantidad_planeada")) for row in rows if row.get("categoria_equipo") == "macbook")
    hp_units = sum(_to_int(row.get("cantidad_planeada")) for row in rows if row.get("categoria_equipo") == "hp")
    presupuesto_estimado = sum(_to_int(row.get("presupuesto_estimado_clp")) for row in rows)
    planeacion_row = dict(planeacion) if planeacion else {}

    summary = {
        "mes": selected_month.isoformat(),
        "unidades_planeadas": macbook_units + hp_units,
        "macbook_planeadas": macbook_units,
        "hp_planeadas": hp_units,
        "presupuesto_estimado_clp": presupuesto_estimado,
        "stock_confirmado_base": _to_int(planeacion_row.get("stock_disponible_confirmado_base")),
        "stock_total_base": _to_int(planeacion_row.get("stock_disponible_total_base")),
        "stock_esperado_confirmado": _to_int(planeacion_row.get("stock_esperado_confirmado")),
        "stock_esperado_total": _to_int(planeacion_row.get("stock_esperado_total")),
        "demanda_presion_compra_mes": _to_int(planeacion_row.get("demanda_presion_compra_mes")),
        "gap_confirmado_con_compras": _to_int(planeacion_row.get("gap_confirmado_con_compras")),
        "gap_total_con_compras": _to_int(planeacion_row.get("gap_total_con_compras")),
        "cobertura_confirmada_con_compras": _to_float(planeacion_row.get("cobertura_confirmada_con_compras")),
        "cobertura_total_con_compras": _to_float(planeacion_row.get("cobertura_total_con_compras")),
        "lectura_planeacion": planeacion_row.get("lectura_planeacion_con_compras"),
        "lectura_staffing_core": planeacion_row.get("lectura_staffing_core"),
        "documentos_factura_sin_ingreso_stock": _to_int(planeacion_row.get("documentos_factura_sin_ingreso_stock")),
        "documentos_guia_sin_match_mtr": _to_int(planeacion_row.get("documentos_guia_sin_match_mtr")),
    }

    notes = [
        "La proyección junio 2026 usa 15 MacBook Pro y 10 HP EliteBook como escenario planificado.",
        "Las órdenes de compra proyectadas no cuentan como recepción ni stock confirmado hasta que exista guía o ingreso visible en MTR.",
        "Si una guía trae serial y no hace match con inventario, queda como pendiente_conciliacion.",
    ]

    return {
        "mes": selected_month.isoformat(),
        "summary": summary,
        "rows": rows,
        "planeacion": planeacion_row,
        "notes": notes,
    }
