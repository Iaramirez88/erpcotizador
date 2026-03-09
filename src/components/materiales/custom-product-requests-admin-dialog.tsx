'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'

type RequestRow = {
  id: string
  externalId: string | null
  nombre: string
  kind: 'METRAJE' | 'FISICO'
  tipo: string
  unidadMedida: string
  precioM2: number | null
  precioMetro: number | null
  precioUnidad: number | null
  createdAt: string
  createdByUser?: { id: string; name: string | null; email: string; role: string } | null
  terminados?: Array<{ terminado: { id: string; nombre: string } }>
}

function getPrecioLabel(r: RequestRow): string {
  const unidad = String(r.unidadMedida || '').toLowerCase()
  const price = unidad === 'm2' ? r.precioM2 : unidad === 'ml' ? r.precioMetro : r.precioUnidad
  const unitLabel = unidad === 'm2' ? '/m²' : unidad === 'ml' ? '/ml' : '/und'
  return price && Number.isFinite(price) ? `${formatCurrency(price)}${unitLabel}` : '-'
}

export function CustomProductRequestsAdminDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<RequestRow[]>([])
  const [acting, setActing] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/custom-product-requests?status=PENDING', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: RequestRow[]; error?: string } | null
      if (!res.ok || !json?.success) {
        toast({ title: 'No se pudieron cargar solicitudes', description: json?.error || 'Intenta nuevamente.' })
        setRows([])
        return
      }
      setRows(Array.isArray(json.data) ? json.data : [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pending = useMemo(() => rows, [rows])

  const decide = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setActing((prev) => ({ ...prev, [id]: true }))
    try {
      const decisionNote = String(notes[id] ?? '').trim() || null
      const res = await fetch(`/api/custom-product-requests/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, decisionNote }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!res.ok || !json?.success) {
        toast({ title: 'No se pudo procesar', description: json?.error || 'Intenta nuevamente.' })
        return
      }
      toast({ title: action === 'APPROVE' ? 'Aprobado' : 'Rechazado' })
      setNotes((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      await load()
    } finally {
      setActing((prev) => ({ ...prev, [id]: false }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Solicitudes de productos personalizados</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-md border">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Cargando…</div>
          ) : pending.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No hay solicitudes pendientes.</div>
          ) : (
            <div className="divide-y">
              {pending.map((r) => {
                const code = String(r.externalId || '').trim()
                const title = code ? `(${code}) ${r.nombre}` : r.nombre
                const price = getPrecioLabel(r)
                const creator = r.createdByUser?.name || r.createdByUser?.email || ''
                const terminados = (r.terminados || []).map((t) => t.terminado?.nombre).filter(Boolean)
                const noteValue = String(notes[r.id] ?? '')
                return (
                  <div key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{title}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {r.tipo} · {r.kind} · {price}{creator ? ` · ${creator}` : ''}
                        </div>
                        {terminados.length ? (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            Terminados: {terminados.join(', ')}
                          </div>
                        ) : null}
                        <div className="mt-3">
                          <Textarea
                            value={noteValue}
                            onChange={(e) => {
                              const v = e.target.value
                              setNotes((prev) => ({ ...prev, [r.id]: v }))
                            }}
                            placeholder="Comentario (opcional): motivo de rechazo o nota de aprobación"
                            rows={2}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => void decide(r.id, 'REJECT')}
                          disabled={Boolean(acting[r.id])}
                        >
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => void decide(r.id, 'APPROVE')}
                          disabled={Boolean(acting[r.id])}
                        >
                          Aprobar
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
