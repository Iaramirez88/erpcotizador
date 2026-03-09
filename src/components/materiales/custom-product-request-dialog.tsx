'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

type TerminadoLite = {
  id: string
  nombre: string
  activo: boolean
}

const TIPOS_MATERIAL = [
  { value: 'VINILO', label: 'Vinilo' },
  { value: 'LONA', label: 'Lona' },
  { value: 'BANNER', label: 'Banner' },
  { value: 'MICROPERFORADO', label: 'Microperforado' },
  { value: 'ONE_WAY', label: 'One Way' },
  { value: 'ADHESIVO', label: 'Adhesivo' },
  { value: 'PAPEL', label: 'Papel' },
  { value: 'CARTULINA', label: 'Cartulina' },
  { value: 'FOAM', label: 'Foam' },
  { value: 'ACRILICO', label: 'Acrílico' },
  { value: 'PVC', label: 'PVC' },
  { value: 'OTRO', label: 'Otro / Merchandising' },
] as const

type TipoMaterialValue = (typeof TIPOS_MATERIAL)[number]['value']

type KindValue = 'METRAJE' | 'FISICO'

type UnidadValue = 'm2' | 'ml' | 'unidad'

function normalizeUnidadForKind(kind: KindValue, unidad: UnidadValue): UnidadValue {
  if (kind === 'FISICO') return 'unidad'
  return unidad === 'm2' || unidad === 'ml' ? unidad : 'm2'
}

export function CustomProductRequestDialog({
  open,
  onOpenChange,
  defaultNombre,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  defaultNombre?: string
}) {
  const { toast } = useToast()

  const [saving, setSaving] = useState(false)

  const [externalId, setExternalId] = useState('')
  const [nombre, setNombre] = useState('')
  const [kind, setKind] = useState<KindValue>('METRAJE')
  const [tipo, setTipo] = useState<TipoMaterialValue>('VINILO')
  const [unidadMedida, setUnidadMedida] = useState<UnidadValue>('m2')
  const [precio, setPrecio] = useState('')

  const [terminados, setTerminados] = useState<TerminadoLite[]>([])
  const [terminadosSelected, setTerminadosSelected] = useState<Set<string>>(() => new Set())
  const [loadingTerminados, setLoadingTerminados] = useState(false)

  const unidad = useMemo(() => normalizeUnidadForKind(kind, unidadMedida), [kind, unidadMedida])

  useEffect(() => {
    if (!open) return

    setNombre((defaultNombre || '').trim())
    setExternalId('')
    setKind('METRAJE')
    setTipo('VINILO')
    setUnidadMedida('m2')
    setPrecio('')
    setTerminadosSelected(new Set())

    let cancelled = false
    const loadTerminados = async () => {
      setLoadingTerminados(true)
      try {
        const res = await fetch('/api/terminados', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as { success?: boolean; data?: TerminadoLite[] } | null
        const data = Array.isArray(json?.data) ? json!.data : []
        const activeOnly = data.filter((t) => t && t.activo)
        if (!cancelled) setTerminados(activeOnly)
      } catch {
        if (!cancelled) setTerminados([])
      } finally {
        if (!cancelled) setLoadingTerminados(false)
      }
    }

    void loadTerminados()

    return () => {
      cancelled = true
    }
  }, [open, defaultNombre])

  async function submit() {
    const nombreNorm = nombre.trim()
    if (!nombreNorm) {
      toast({ title: 'Nombre requerido', description: 'Escribe el nombre del producto.' })
      return
    }

    const precioN = Number(precio)
    if (!Number.isFinite(precioN) || precioN <= 0) {
      toast({ title: 'Precio inválido', description: 'Indica un precio mayor a 0.' })
      return
    }

    setSaving(true)
    try {
      const terminadosIds = Array.from(terminadosSelected)

      const body: Record<string, unknown> = {
        externalId: externalId.trim() || null,
        nombre: nombreNorm,
        kind,
        tipo,
        unidadMedida: unidad,
        terminadosIds,
      }

      if (unidad === 'm2') body.precioM2 = precioN
      if (unidad === 'ml') body.precioMetro = precioN
      if (unidad === 'unidad') body.precioUnidad = precioN

      const res = await fetch('/api/custom-product-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null

      if (!res.ok || !json?.success) {
        toast({
          title: 'No se pudo crear la solicitud',
          description: json?.error || 'Intenta nuevamente.',
        })
        return
      }

      toast({
        title: '✅ Solicitud enviada',
        description: 'Un administrador te dará respuesta lo más pronto posible. La respuesta te llegará por Notificaciones.',
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const terminadosList = useMemo(() => terminados, [terminados])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear producto personalizado</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Nombre *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div className="col-span-2">
            <Label>Código/ID externo (opcional)</Label>
            <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} />
          </div>

          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoMaterialValue)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_MATERIAL.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Kind *</Label>
            <Select
              value={kind}
              onValueChange={(v) => {
                const next = (v === 'FISICO' ? 'FISICO' : 'METRAJE') as KindValue
                setKind(next)
                setUnidadMedida((prev) => normalizeUnidadForKind(next, prev))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="METRAJE">Metraje</SelectItem>
                <SelectItem value="FISICO">Físico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Unidad de cobro *</Label>
            <Select
              value={unidad}
              onValueChange={(v) => setUnidadMedida((v as UnidadValue) || 'm2')}
              disabled={kind === 'FISICO'}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="m2">m²</SelectItem>
                <SelectItem value="ml">ml</SelectItem>
                <SelectItem value="unidad">unidad</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Precio *</Label>
            <Input type="number" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} />
          </div>

          <div className="col-span-2">
            <Label>Terminados (opcional)</Label>
            <div className="mt-2 max-h-56 overflow-auto rounded-md border p-2">
              {loadingTerminados ? (
                <div className="text-sm text-muted-foreground">Cargando…</div>
              ) : terminadosList.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay terminados activos.</div>
              ) : (
                <div className="space-y-2">
                  {terminadosList.map((t) => {
                    const checked = terminadosSelected.has(t.id)
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setTerminadosSelected((prev) => {
                              const next = new Set(prev)
                              if (next.has(t.id)) next.delete(t.id)
                              else next.add(t.id)
                              return next
                            })
                          }}
                        />
                        <span className="truncate">{t.nombre}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Creando…' : 'Crear solicitud'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
