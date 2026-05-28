"use client"

import { useEffect, useState } from "react"
import { getAccionDetalle, setAccionEstado } from "@/lib/api"
import { getStatusClassName } from "@/lib/statusStyles"

type Estado = "PENDIENTE" | "EN_PROGRESO" | "RESUELTA" | "DESCARTADA"

type Props = {
  open: boolean
  accionId: string | null
  onClose: () => void
  onChanged?: () => void
}

type AccionDrawerData = {
  estado?: string
  [key: string]: unknown
}

export function AccionDrawer({ open, accionId, onClose, onChanged }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<AccionDrawerData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setData(null)
      setError(null)
      setLoading(false)
      setSaving(false)
      return
    }
  }, [open])

  useEffect(() => {
    if (!open || !accionId) return

    let alive = true
    setLoading(true)
    setError(null)

    getAccionDetalle(accionId)
      .then((d) => {
        if (!alive) return
        setData(d)
      })
      .catch((e: unknown) => {
        if (!alive) return
        setError(e instanceof Error ? e.message : "Error cargando detalle")
        setData(null)
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [open, accionId])

  async function mark(estado: Estado) {
    if (!accionId) return
    setSaving(true)
    setError(null)
    try {
      await setAccionEstado(accionId, estado)
      onChanged?.()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando estado")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
        aria-label="Cerrar"
      />

      {/* panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-white/10 bg-neutral-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-white/60">Detalle</div>
            <div className="text-lg font-semibold text-white/90">{accionId}</div>
            {data?.estado && (
              <div className="mt-1 text-sm text-white/60">
                Estado actual:{" "}
                <span className={getStatusClassName(data.estado)}>
                  {data.estado}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Cerrar
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="text-white/60">Cargando…</div>
          ) : data ? (
            <pre className="max-h-[65vh] overflow-auto rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/80">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <div className="text-white/60">Sin datos.</div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            disabled={saving}
            onClick={() => mark("EN_PROGRESO")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            🛠️ En progreso
          </button>

          <button
            disabled={saving}
            onClick={() => mark("RESUELTA")}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            ✅ Marcar resuelta
          </button>

          <button
            disabled={saving}
            onClick={() => mark("DESCARTADA")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            🗑️ Descartar
          </button>
        </div>
      </div>
    </div>
  )
}
