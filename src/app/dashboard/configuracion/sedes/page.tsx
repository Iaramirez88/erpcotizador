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
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'

type SedeRow = {
  id: string
  nombre: string
  codigo: string | null
  createdAt?: string
}

type ApiResponse<T> = { success?: boolean; data?: T; error?: string }

export default function SedesConfigPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sedes, setSedes] = useState<SedeRow[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    codigo: '',
  })

  const sorted = useMemo(() => {
    return [...sedes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [sedes])

  async function load() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sedes', { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as ApiResponse<SedeRow[]>
      if (!res.ok || !json.success || !Array.isArray(json.data)) {
        setError(json.error || 'No se pudieron cargar las sedes')
        return
      }
      setSedes(json.data)
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
    setForm({ nombre: '', codigo: '' })
    setCreateOpen(true)
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const payload = {
        nombre: form.nombre.trim(),
        codigo: form.codigo.trim() || undefined,
      }

      const res = await fetch('/api/sedes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => ({}))) as ApiResponse<SedeRow>
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
      <ErpPageHero
        eyebrow="Configuracion"
        title={<span data-tour="sedes-title">Sedes</span>}
        description="Crea sucursales, organiza la operacion por ubicacion y luego asignalas desde permisos."
        actions={
          <>
            <Button onClick={() => void load()} variant="secondary" disabled={isLoading}>
              Refrescar
            </Button>
            <Button onClick={openCreate} disabled={isLoading} data-tour="sedes-new">
              Nueva sede
            </Button>
          </>
        }
        stats={[
          {
            label: 'Sedes registradas',
            value: sorted.length,
            hint: 'Sucursales disponibles para operacion y permisos',
            tone: 'sky',
          },
          {
            label: 'Estado',
            value: isLoading ? 'Cargando' : 'Actualizado',
            hint: isLoading ? 'Consultando informacion...' : 'Listado sincronizado con la API',
            tone: isLoading ? 'amber' : 'teal',
          },
        ]}
      />

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
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4 font-medium text-gray-900">{s.nombre}</td>
                      <td className="py-2 pr-4 text-gray-700">{s.codigo || '—'}</td>
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
              Crea una sede para separar operación y permisos por sucursal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Código (opcional)</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))}
                placeholder="Ej: PRIN / NORTE"
              />
            </div>

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
