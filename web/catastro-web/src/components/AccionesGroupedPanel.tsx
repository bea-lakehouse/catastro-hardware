"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchAccionesGrupos,
  fetchAcciones,
  updateAccionEstado,
  bulkEstado,
} from "@/lib/api/acciones";

type Grupo = {
  tipo: string;
  prioridad: string;
  count: number;
  vencidas: number;
  dias_min: number | null;
};

type Accion = {
  id: string;
  titulo: string;
  mensaje?: string | null;
  dias_a_vencer?: number | null;
};

const prioColor = (p: string) => {
  if (p === "ALTA") return "text-red-400";
  if (p === "MEDIA") return "text-yellow-400";
  return "text-green-400";
};

const descTipo = (tipo: string) => {
  if (tipo === "RENOVAR") return "Reemplazar o renovar equipos vencidos";
  if (tipo === "REASIGNAR") return "Asignar equipos sin usuario";
  return "";
};

const chipTiempo = (dias?: number | null) => {
  if (dias === null || dias === undefined) return "—";
  if (dias < 0) return `⏱ ${dias} días`;
  return `⏳ ${dias} días`;
};

export default function AccionesGroupedPanel() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [acciones, setAcciones] = useState<Record<string, Accion[]>>({});
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetchAccionesGrupos()
      .then((d) => {
        if (!alive) return;
        setGrupos(d.groups || []);
      })
      .catch(() => {
        if (!alive) return;
        setGrupos([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  const cargarGrupos = async () => {
    const d = await fetchAccionesGrupos();
    setGrupos(d.groups || []);
  };

  const totalVencidas = useMemo(
    () => grupos.reduce((acc, g) => acc + (g.vencidas || 0), 0),
    [grupos]
  );
  const totalPendientes = useMemo(
    () => grupos.reduce((acc, g) => acc + (g.count || 0), 0),
    [grupos]
  );

  const toggle = async (g: Grupo) => {
    const key = `${g.tipo}-${g.prioridad}`;
    if (openKey === key) {
      setOpenKey(null);
      return;
    }

    setOpenKey(key);

    if (!acciones[key]) {
      setLoading(key);
      const d = await fetchAcciones({
        tipo: g.tipo,
        prioridad: g.prioridad,
        hide_resueltas: true,
      });
      setAcciones((prev) => ({ ...prev, [key]: d.rows || [] }));
      setLoading(null);
    }
  };

  const onEstado = async (
    grupoKey: string,
    accionId: string,
    estado: "RESUELTA" | "DESCARTADA"
  ) => {
    // optimistic UI
    setAcciones((prev) => ({
      ...prev,
      [grupoKey]: (prev[grupoKey] || []).filter((a) => a.id !== accionId),
    }));

    await updateAccionEstado(accionId, estado);

    // refresca grupos/kpis (conteos)
    await cargarGrupos();
  };

  const onBulkEstado = async (
    grupoKey: string,
    estado: "RESUELTA" | "DESCARTADA"
  ) => {
    // Asegurar IDs reales: si no hay filas cargadas, las traemos primero
    let rows = acciones[grupoKey] || [];

    if (rows.length === 0) {
      setLoading(grupoKey);

      const [tipo, prioridad] = grupoKey.split("-");
      const d = await fetchAcciones({
        tipo,
        prioridad,
        hide_resueltas: true,
        order: "urgencia",
        limit: 5000,
      });

      rows = d.rows || [];
      setAcciones((prev) => ({ ...prev, [grupoKey]: rows }));
      setLoading(null);
    }

    const ids = rows.map((a) => a.id).filter(Boolean);
    if (ids.length === 0) return;

    // Primero backend (para no perder ids por UI optimista)
    await bulkEstado(ids, estado);

    // Después UI + refresco
    setAcciones((prev) => ({ ...prev, [grupoKey]: [] }));
    setOpenKey(null);
    await cargarGrupos();
  };

  return (
    <div className="space-y-3">
      {/* KPI arriba (marca visible) */}
      <div className="flex flex-wrap gap-3 mb-3">
        <div className="px-4 py-2 rounded border border-neutral-800 bg-neutral-900 text-sm">
          🔥 <span className="font-semibold">{totalVencidas}</span> vencidas · 📦{" "}
          <span className="font-semibold">{totalPendientes}</span> pendientes
        </div>
      </div>

      {grupos.map((g) => {
        const key = `${g.tipo}-${g.prioridad}`;
        const abierto = openKey === key;
        return (
          <div
            key={key}
            className="rounded border border-neutral-800 bg-neutral-900/60"
          >
            <button
              onClick={() => toggle(g)}
              className="w-full flex justify-between items-center px-4 py-4 text-left hover:bg-neutral-900"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <strong className="text-lg">{g.tipo}</strong>
                  <span className="opacity-70">({g.count})</span>

                  <span className={`text-lg font-semibold ${prioColor(g.prioridad)}`}>
                    {g.prioridad}
                  </span>

                  <span className="ml-2 text-sm opacity-70">
                    {g.vencidas} vencidas · crítico {g.dias_min ?? "—"} días
                  </span>
                </div>

                <div className="text-sm opacity-60">{descTipo(g.tipo)}</div>
              </div>

              <div className="text-sm opacity-60">{abierto ? "▲" : "▼"}</div>
            </button>

            {abierto && (
              <div className="p-4 border-t border-neutral-800">
                <div className="flex justify-end gap-2 mb-3">
                  <button
                    onClick={() => onBulkEstado(key, "RESUELTA")}
                    className="px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm font-semibold"
                  >
                    Resolver todo ({acciones[key]?.length ?? g.count})
                  </button>

                  <button
                    onClick={() => onBulkEstado(key, "DESCARTADA")}
                    className="px-3 py-2 bg-yellow-700 hover:bg-yellow-600 rounded text-sm font-semibold"
                  >
                    Descartar grupo ({acciones[key]?.length ?? g.count})
                  </button>
                </div>

                {loading === key && (
                  <div className="text-sm opacity-60">Cargando…</div>
                )}

                {!loading && (acciones[key]?.length || 0) === 0 && (
                  <div className="text-sm opacity-70">
                    No quedan acciones en este grupo ✅
                  </div>
                )}

                {(acciones[key]?.length || 0) > 0 && (
                  <table className="w-full text-sm">
                    <thead className="text-left opacity-60">
                      <tr>
                        <th className="py-2">Acción</th>
                        <th>Mensaje</th>
                        <th className="w-44">Tiempo</th>
                        <th className="w-48 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {acciones[key].map((a) => (
                        <tr
                          key={a.id}
                          className={`border-t border-neutral-800 ${
                            (a.dias_a_vencer ?? 0) < 0
                              ? "bg-red-950/20"
                              : ""
                          }`}
                        >
                          <td className="py-3">{a.titulo}</td>
                          <td>{a.mensaje}</td>
                          <td>
                            <span className="inline-flex items-center gap-2 px-2 py-1 rounded border border-neutral-800 bg-neutral-950/40">
                              {chipTiempo(a.dias_a_vencer)}
                            </span>
                          </td>
                          <td className="text-right space-x-2">
                            <button
                              onClick={() => onEstado(key, a.id, "RESUELTA")}
                              className="px-3 py-2 bg-green-700 hover:bg-green-600 rounded text-sm font-semibold"
                            >
                              Resolver
                            </button>
                            <button
                              onClick={() => onEstado(key, a.id, "DESCARTADA")}
                              className="px-3 py-2 bg-yellow-700 hover:bg-yellow-600 rounded text-sm font-semibold"
                            >
                              Descartar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
