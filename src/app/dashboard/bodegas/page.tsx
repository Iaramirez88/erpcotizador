'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'

type Bodega = {
  id: string
  nombre: string
  codigo: string | null
  isDefault: boolean
  sedeId: string | null
  createdAt: string
  updatedAt: string
}

type ApiResponse<T> = { success?: boolean; data?: T; error?: string }

export default function BodegasPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [bodegas, setBodegas] = useState<Bodega[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    codigo: '',
    isDefault: false,
  })

  const sorted = useMemo(() => {
    return [...bodegas].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      return a.nombre.localeCompare(b.nombre, 'es')
    })
  }, [bodegas])

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bodegas')
      const json = (await res.json().catch(() => ({}))) as ApiResponse<Bodega[]>
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setError(json.error || 'No se pudieron cargar las sedes')
        return
      }
      setBodegas(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setError(null)
    setForm({ nombre: '', codigo: '', isDefault: false })
    setCreateOpen(true)
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim() || null,
        isDefault: form.isDefault,
      }

      const res = await fetch('/api/bodegas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as ApiResponse<Bodega>
      if (!res.ok || !json.success) {
        setError(json.error || 'No se pudo crear la sede')
        return
      }

      setCreateOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-tour="sedes-title">Sedes</h1>
          <p className="text-muted-foreground">
            Crea sedes (almacenes) y define una sede principal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void load()} variant="secondary" disabled={isLoading}>
            Refrescar
          </Button>
          <Button onClick={openCreate} disabled={isLoading} data-tour="sedes-new">
            Nueva sede
          </Button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>
            Si no existe ninguna, el sistema crea automáticamente una sede (Principal).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : sorted.length === 0 ? (
            <div className="text-sm text-gray-600">No hay sedes aún.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4">Nombre</th>
                    <th className="py-2 pr-4">Código</th>
                    <th className="py-2 pr-4">Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((b) => (
                    <tr key={b.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 font-medium text-gray-900">{b.nombre}</td>
                      <td className="py-2 pr-4 text-gray-700">{b.codigo || '—'}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={cn(
                            'text-xs font-semibold px-2 py-1 rounded',
                            b.isDefault ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {b.isDefault ? 'Sí' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva sede</DialogTitle>
            <DialogDescription>
              Crea una sede para registrar stock por almacén. Puedes marcarla como principal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} required />
            </div>

            <div className="space-y-2">
              <Label>Código (opcional)</Label>
              <Input value={form.codigo} onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))} placeholder="Ej: PRIN / BOD-2" />
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.isDefault}
                onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
              />
              <span>
                Marcar como <span className="font-medium">sede principal</span> (solo puede haber una).
              </span>
            </label>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || !form.nombre.trim()}>
                {isSubmitting ? 'Guardando…' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
