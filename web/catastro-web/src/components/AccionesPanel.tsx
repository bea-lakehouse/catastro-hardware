"use client"

import { useEffect, useState } from "react"
import { Accion, getAcciones } from "@/lib/api"
import { AccionDrawer } from "@/components/AccionDrawer"
import { getStatusClassName } from "@/lib/statusStyles"

function PriorityBadge({ value }: { value: string }) {
  const v = (value || "").toLowerCase()
  const cls =
    v === "alta"
      ? "bg-red-500/15 text-red-200 ring-1 ring-red-500/25"
      : v === "media"
      ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/25"
      : "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/25"

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {value}
    </span>
  )
}

export function AccionesPanel() {
  const [rows, setRows] = useState<Accion[]>([])
  const [order, setOrder] = useState<"urgencia" | "prioridad" | "dias" | "fecha">("urgencia")
  const [hideResueltas, setHideResueltas] = useState(true)

  const [open, setOpen] = useState(false)
  const [accionId, setAccionId] = useState<string | null>(null)

  const handleOrderChange = (value: string) => {
    if (value === "urgencia" || value === "prioridad" || value === "dias" || value === "fecha") {
      setOrder(value)
    }
  }

  async function refresh() {
    const data = await getAcciones({ limit: 200, order, hide_resueltas: hideResueltas })
    setRows(data.rows ?? [])
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, hideResueltas])

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Acciones recomendadas</h2>
          <p className="text-sm text-white/60">Fuente: /acciones (API)</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={order}
            onChange={(e) => handleOrderChange(e.target.value)}
            className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white/80"
          >
            <option value="urgencia">🧠 Urgencia</option>
            <option value="prioridad">🔥 Prioridad</option>
            <option value="dias">⏳ Días a vencer</option>
            <option value="fecha">📅 Fecha</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={hideResueltas}
              onChange={(e) => setHideResueltas(e.target.checked)}
            />
            Ocultar resueltas
          </label>

          <div className="text-sm text-white/60">
            Filas: <span className="text-white/80">{rows?.length ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Título</th>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-left font-medium">Prioridad</th>
              <th className="px-4 py-3 text-left font-medium">Mensaje</th>
              <th className="px-4 py-3 text-left font-medium">Fecha</th>
              <th className="px-4 py-3 text-left font-medium">Días</th>
              <th className="px-4 py-3 text-left font-medium">Estado</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {rows.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer hover:bg-white/5"
                onClick={() => {
                  setAccionId(r.id)
                  setOpen(true)
                }}
              >
                <td className="px-4 py-3 text-white/90">{r.titulo}</td>
                <td className="px-4 py-3 text-white/90">{r.tipo}</td>
                <td className="px-4 py-3"><PriorityBadge value={r.prioridad} /></td>
                <td className="px-4 py-3 text-white/90">{r.mensaje ?? "—"}</td>
                <td className="px-4 py-3 text-white/80">{r.created_at ?? "—"}</td>
                <td className="px-4 py-3 text-white/80">{r.dias_a_vencer ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={getStatusClassName(r.estado ?? "PENDIENTE")}>
                    {r.estado ?? "PENDIENTE"}
                  </span>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/60">
                  Sin acciones por ahora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AccionDrawer
        open={open}
        accionId={accionId}
        onClose={() => setOpen(false)}
        onChanged={refresh}
      />
    </div>
  )
}
