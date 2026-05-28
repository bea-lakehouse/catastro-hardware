"use client";

import { useEffect, useState } from "react";
import {
  fetchAccionesGrupos,
  fetchAcciones,
  updateAccionEstado,
} from "@/lib/api/acciones";

import {
  fetchAccionesGrupos,
  fetchAcciones,
  updateAccionEstado,
  bulkEstado,
} from "@/lib/api/acciones";

import { fetchAccionesKpis } from "@/lib/api/acciones_kpis";


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
  mensaje: string;
  dias_a_vencer: number | null;
};

export default function AccionesGroupedPanel() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [acciones, setAcciones] = useState<Record<string, Accion[]>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const cargarGrupos = async () => {
    const d = await fetchAccionesGrupos();
    setGrupos(d.groups);
  };

  useEffect(() => {
    cargarGrupos();
  }, []);

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
      });
      setAcciones((prev) => ({ ...prev, [key]: d.rows }));
      setLoading(null);
    }
  };

  const onEstado = async (
    grupoKey: string,
    accionId: string,
    estado: "RESUELTA" | "DESCARTADA"
  ) => {
    // optimistic: remover fila altiro
    setAcciones((prev) => {
      const next = { ...prev };
      next[grupoKey] = (next[grupoKey] || []).filter((a) => a.id !== accionId);
      return next;
    });

    await updateAccionEstado(accionId, estado);

    // si el grupo quedó vacío, ciérralo y refresca grupos
    setTimeout(() => {
      const quedan = (acciones[grupoKey] || []).length;
      if (quedan <= 1) setOpenKey(null);
      cargarGrupos();
    }, 0);
  };

  const totalPendientes = grupos.reduce((acc, g) => acc + (g.count || 0), 0);
  const totalVencidas = grupos.reduce((acc, g) => acc + (g.vencidas || 0), 0);

  return (
    <div className="space-y-3">
      {/* KPIs rápidos */}
      <div className="text-sm opacity-80">
        🔥 <span className="font-semibold">{totalVencidas}</span> vencidas · 📦{" "}
        <span className="font-semibold">{totalPendientes}</span> pendientes
      </div>

      {grupos.map((g) => {
        const key = `${g.tipo}-${g.prioridad}`;
        const abierto = openKey === key;

        return (
          <div
            key={key}
            className="rounded border border-neutral-700 bg-neutral-900"
          >
            <button
              onClick={() => toggle(g)}
              className="w-full flex justify-between items-center px-4 py-3 text-left hover:bg-neutral-800"
            >
              <div>
                <strong>{g.tipo}</strong>{" "}
                <span className="opacity-70">({g.count})</span>{" "}
                <span className="ml-2 text-sm font-semibold">{g.prioridad}</span>
                <span className="ml-3 text-sm opacity-70">
                  {g.vencidas} vencidas · crítico {g.dias_min ?? "—"} días
                </span>
              </div>
              <div className="text-sm opacity-60">{abierto ? "▲" : "▼"}</div>
            </button>

            {abierto && (
              <div className="p-3">
                {loading === key && (
                  <div className="text-sm opacity-60">Cargando…</div>
                )}

                {acciones[key] && (
                  <table className="w-full text-sm">
                    <thead className="text-left opacity-60">
                      <tr>
                        <th>Acción</th>
                        <th>Mensaje</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {acciones[key].map((a) => (
                        <tr
                          key={a.id}
                          className={`border-t border-neutral-800 ${
                            a.mensaje?.toLowerCase().includes("vencida")
                              ? "bg-red-900/20"
                              : ""
                          }`}
                        >
                          <td className="py-2">{a.titulo}</td>
                          <td>{a.mensaje}</td>
                          <td className="text-right space-x-2">
                            <button
                              onClick={() => onEstado(key, a.id, "RESUELTA")}
                              className="px-2 py-1 bg-green-700 rounded"
                            >
                              Resolver
                            </button>
                            <button
                              onClick={() => onEstado(key, a.id, "DESCARTADA")}
                              className="px-2 py-1 bg-yellow-700 rounded"
                            >
                              Descartar
                            </button>
                          </td>
                        </tr>
                      ))}

                      {acciones[key].length === 0 && (
                        <tr className="border-t border-neutral-800">
                          <td className="py-3 opacity-60" colSpan={3}>
                            No quedan acciones en este grupo ✅
                          </td>
                        </tr>
                      )}
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
