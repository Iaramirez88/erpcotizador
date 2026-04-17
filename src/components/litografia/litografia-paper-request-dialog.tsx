'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type PaperRate = {
  id: string
  nombre: string
  tipo: string | null
  gramaje: number | null
  pliegoWidthCm: number
  pliegoHeightCm: number
  costoPliego: number
  activo: boolean
  updatedAt?: string
}

type SubmitResult = {
  mode: 'created' | 'requested'
  paper?: PaperRate | null
}

type ApiEnvelope = {
  ok?: boolean
  mode?: 'created' | 'requested'
  error?: string
  message?: string
  data?: unknown
}

export function LitografiaPaperRequestDialog({
  open,
  onOpenChange,
  canCreateDirectly,
  onSubmitted,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  canCreateDirectly: boolean
  onSubmitted?: (result: SubmitResult) => void
}) {
  const { toast } = useToast()

  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('')
  const [gramaje, setGramaje] = useState('')
  const [pliegoWidthCm, setPliegoWidthCm] = useState('70')
  const [pliegoHeightCm, setPliegoHeightCm] = useState('100')
  const [costoPliego, setCostoPliego] = useState('0')

  useEffect(() => {
    if (!open) return
    setNombre('')
    setTipo('')
    setGramaje('')
    setPliegoWidthCm('70')
    setPliegoHeightCm('100')
    setCostoPliego('0')
  }, [open])

  async function submit() {
    const nombreNorm = nombre.trim()
    if (!nombreNorm) {
      toast({ title: 'Nombre requerido', description: 'Escribe el nombre del papel.' })
      return
    }

    const width = Number(pliegoWidthCm)
    const height = Number(pliegoHeightCm)
    const cost = Number(costoPliego)
    const weight = gramaje.trim() ? Number(gramaje) : null

    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      toast({ title: 'Medidas inválidas', description: 'Define un pliego base válido.' })
      return
    }

    if (!Number.isFinite(cost) || cost < 0) {
      toast({ title: 'Costo inválido', description: 'El costo por pliego no puede ser negativo.' })
      return
    }

    if (weight !== null && (!Number.isFinite(weight) || weight <= 0)) {
      toast({ title: 'Gramaje inválido', description: 'Si indicas gramaje, debe ser mayor a 0.' })
      return
    }

    setSaving(true)
    try {
      const endpoint = canCreateDirectly ? '/api/litografia/papeles' : '/api/litografia/papeles/solicitudes'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreNorm,
          tipo: tipo.trim() || null,
          gramaje: weight,
          pliegoWidthCm: width,
          pliegoHeightCm: height,
          costoPliego: cost,
          activo: true,
        }),
      })

      const json = (await res.json().catch(() => null)) as ApiEnvelope | null

      if (!res.ok || !json?.ok) {
        toast({
          title: 'No se pudo registrar el papel',
          description: json?.error || 'Intenta nuevamente.',
          variant: 'destructive',
        })
        return
      }

      if (json.mode === 'requested') {
        toast({
          title: 'Solicitud enviada',
          description: json.message || 'No tienes permisos para agregarlo; espera a que un administrador lo agregue.',
        })
        onSubmitted?.({ mode: 'requested' })
        onOpenChange(false)
        return
      }

      const paper = json.data && typeof json.data === 'object' ? (json.data as PaperRate) : null
      toast({
        title: 'Papel agregado',
        description: 'El papel quedó disponible inmediatamente en la lista.',
      })
      onSubmitted?.({ mode: 'created', paper })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{canCreateDirectly ? 'Agregar papel' : 'Solicitar papel personalizado'}</DialogTitle>
          <DialogDescription>
            {canCreateDirectly
              ? 'El papel se agregará de inmediato al tarifario litográfico.'
              : 'Tu solicitud se enviará a los administradores para que agreguen el papel al tarifario.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Adhesivo pliego P3H 70x100" />
          </div>

          <div>
            <Label>Tipo</Label>
            <Input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Ej: adhesivo" />
          </div>

          <div>
            <Label>Gramaje</Label>
            <Input type="number" min={1} step="1" value={gramaje} onChange={(e) => setGramaje(e.target.value)} placeholder="150" />
          </div>

          <div>
            <Label>Pliego ancho (cm)</Label>
            <Input type="number" min={0.1} step="0.1" value={pliegoWidthCm} onChange={(e) => setPliegoWidthCm(e.target.value)} />
          </div>

          <div>
            <Label>Pliego alto (cm)</Label>
            <Input type="number" min={0.1} step="0.1" value={pliegoHeightCm} onChange={(e) => setPliegoHeightCm(e.target.value)} />
          </div>

          <div className="col-span-2">
            <Label>Costo por pliego</Label>
            <Input type="number" min={0} step="0.01" value={costoPliego} onChange={(e) => setCostoPliego(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cerrar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Guardando…' : canCreateDirectly ? 'Agregar papel' : 'Enviar solicitud'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}