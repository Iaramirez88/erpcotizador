'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

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
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  decisionNote: string | null
  createdAt: string
  material?: { id: string; nombre: string; externalId: string | null } | null
}

function statusLabel(status: RequestRow['status']): string {
  if (status === 'APPROVED') return 'Aprobado'
  if (status === 'REJECTED') return 'Rechazado'
  return 'Pendiente'
}

function statusBadgeClass(status: RequestRow['status']): string {
  if (status === 'APPROVED') return 'bg-green-100 text-green-800 border-green-200'
  if (status === 'REJECTED') return 'bg-red-100 text-red-800 border-red-200'
  return 'bg-yellow-100 text-yellow-800 border-yellow-200'
}

function getPrecioLabel(r: RequestRow): string {
  const unidad = String(r.unidadMedida || '').toLowerCase()
  const price = unidad === 'm2' ? r.precioM2 : unidad === 'ml' ? r.precioMetro : r.precioUnidad
  const unitLabel = unidad === 'm2' ? '/m²' : unidad === 'ml' ? '/ml' : '/und'
  const n = typeof price === 'number' ? price : null
  return n != null && Number.isFinite(n) ? `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unitLabel}` : '-'
}

export function CustomProductRequestsMyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<RequestRow[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/custom-product-requests', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as {
        success?: boolean
        data?: RequestRow[]
        error?: string
      } | null
      if (!res.ok || !json?.success) {
        toast({ title: 'No se pudieron cargar tus solicitudes', description: json?.error || 'Intenta nuevamente.' })
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

  const list = useMemo(() => rows, [rows])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mis solicitudes de productos personalizados</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-md border">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Cargando…</div>
          ) : list.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No tienes solicitudes todavía.</div>
          ) : (
            <div className="divide-y">
              {list.map((r) => {
                const code = String(r.externalId || '').trim()
                const title = code ? `(${code}) ${r.nombre}` : r.nombre
                const price = getPrecioLabel(r)
                const createdAt = r.createdAt ? new Date(r.createdAt).toLocaleString() : ''
                const statusText = statusLabel(r.status)
                const materialCode = String(r.material?.externalId || '').trim()
                const materialTitle = r.material
                  ? materialCode
                    ? `(${materialCode}) ${r.material.nombre}`
                    : r.material.nombre
                  : null

                return (
                  <div key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{title}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {r.tipo} · {r.kind} · {price}{createdAt ? ` · ${createdAt}` : ''}
                        </div>
                        {materialTitle ? (
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            Material creado: {materialTitle}
                          </div>
                        ) : null}
                        {r.decisionNote ? (
                          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            Nota: {r.decisionNote}
                          </div>
                        ) : null}
                      </div>

                      <span className={`shrink-0 text-xs px-2 py-1 rounded border ${statusBadgeClass(r.status)}`}>
                        {statusText}
                      </span>
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
