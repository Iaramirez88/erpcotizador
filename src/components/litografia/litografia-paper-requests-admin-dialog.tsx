'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'

type RequestRow = {
  id: string
  nombre: string
  tipo: string | null
  gramaje: number | null
  pliegoWidthCm: number
  pliegoHeightCm: number
  costoPliego: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  createdByUser?: { id: string; name: string | null; email: string; role: string } | null
}

export function LitografiaPaperRequestsAdminDialog({
  open,
  onOpenChange,
  onApproved,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  onApproved?: () => Promise<void> | void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<RequestRow[]>([])
  const [acting, setActing] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/litografia/papeles/solicitudes?status=PENDING', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: RequestRow[]; error?: string } | null
      if (!res.ok || !json?.ok) {
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
  }, [open])

  const pending = useMemo(() => rows, [rows])

  const decide = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setActing((prev) => ({ ...prev, [id]: true }))
    try {
      const decisionNote = String(notes[id] ?? '').trim() || null
      const res = await fetch(`/api/litografia/papeles/solicitudes/${id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, decisionNote }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        toast({ title: 'No se pudo procesar', description: json?.error || 'Intenta nuevamente.' })
        return
      }

      toast({ title: action === 'APPROVE' ? 'Solicitud aprobada' : 'Solicitud rechazada' })
      setNotes((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      await load()
      await onApproved?.()
    } finally {
      setActing((prev) => ({ ...prev, [id]: false }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Solicitudes de papeles</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-md border">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Cargando…</div>
          ) : pending.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No hay solicitudes pendientes.</div>
          ) : (
            <div className="divide-y">
              {pending.map((row) => {
                const creator = row.createdByUser?.name || row.createdByUser?.email || 'Usuario sin nombre'
                const noteValue = String(notes[row.id] ?? '')
                return (
                  <div key={row.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{row.nombre}</div>
                        <div className="text-sm text-muted-foreground">
                          {row.tipo ? `${row.tipo} · ` : ''}
                          {row.gramaje ? `${row.gramaje}g · ` : ''}
                          {row.pliegoWidthCm}×{row.pliegoHeightCm} cm · {formatCurrency(row.costoPliego)}/pliego
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">Solicitado por {creator}</div>
                        <div className="mt-3">
                          <Textarea
                            value={noteValue}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                            placeholder="Comentario opcional"
                            rows={2}
                          />
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => void decide(row.id, 'REJECT')}
                          disabled={Boolean(acting[row.id])}
                        >
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => void decide(row.id, 'APPROVE')}
                          disabled={Boolean(acting[row.id])}
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