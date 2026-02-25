'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type CostCenterRow = {
  id: string
  code: string
  name: string
  isActive: boolean
}

export default function CentrosDeCostoPage() {
  const [rows, setRows] = useState<CostCenterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/contabilidad/centros-de-costo', { cache: 'no-store' })
      const json = (await res.json()) as { ok: boolean; data?: CostCenterRow[]; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error cargando centros de costo')
      setRows(json.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando centros de costo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/contabilidad/centros-de-costo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name }),
      })
      const json = (await res.json()) as { ok: boolean; data?: CostCenterRow; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error creando centro de costo')

      setCode('')
      setName('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creando centro de costo')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Centros de costo</h1>
        <p className="text-sm text-muted-foreground">Crea centros de costo para clasificar asientos (opcional).</p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="code">Código</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CC-001" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Administración" />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onCreate} disabled={submitting || !code.trim() || !name.trim()}>
            {submitting ? 'Creando…' : 'Crear centro'}
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            Recargar
          </Button>
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-3 text-sm font-medium">Centros</div>
        <div className="p-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay centros registrados.</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="text-sm">
                    <div className="font-medium">
                      {r.code} — {r.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
