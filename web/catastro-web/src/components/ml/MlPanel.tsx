"use client"

import { useEffect, useState } from "react"
import { Anomalia, getAnomalias } from "@/lib/api"

export function MlPanel() {
  const [rows, setRows] = useState<Anomalia[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const data = await getAnomalias({ limit: 200 })
      setRows(data.rows ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Anomalías (ML)</h2>
          <p className="text-sm text-white/60">Fuente: /ml/anomalias (API)</p>
        </div>
        <div className="text-sm text-white/60">
          {loading ? "Cargando…" : <>Filas: <span className="text-white/80">{rows.length}</span></>}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-left font-medium">Mensaje</th>
              <th className="px-4 py-3 text-left font-medium">Score</th>
              <th className="px-4 py-3 text-left font-medium">SKU</th>
              <th className="px-4 py-3 text-left font-medium">Nro serie</th>
              <th className="px-4 py-3 text-left font-medium">Persona</th>
              <th className="px-4 py-3 text-left font-medium">Ciudad</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-white/90">{r.tipo ?? "—"}</td>
                <td className="px-4 py-3 text-white/90">{r.mensaje ?? "—"}</td>
                <td className="px-4 py-3 text-white/80">{r.score ?? "—"}</td>
                <td className="px-4 py-3 text-white/80">{r.sku ?? "—"}</td>
                <td className="px-4 py-3 text-white/80">{r.nro_serie ?? "—"}</td>
                <td className="px-4 py-3 text-white/80">{r.persona_actual ?? "—"}</td>
                <td className="px-4 py-3 text-white/80">{r.ciudad_actual ?? "—"}</td>
              </tr>
            ))}

            {!loading && (!rows || rows.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-white/60">
                  Sin anomalías por ahora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
