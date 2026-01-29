'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ApiResponse =
  | {
      ok: true
      data: {
        sedeId: string
        sedeNombre: string
        defaultPct: number
        materials: Array<{
          id: string
          nombre: string
          overridePct: number | null
          effectivePct: number
        }>
      }
    }
  | { ok?: false; error?: string }

export default function ConfigDesperdiciosPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sedeNombre, setSedeNombre] = useState('')
  const [defaultPct, setDefaultPct] = useState('0')
  const [materials, setMaterials] = useState<
    Array<{ id: string; nombre: string; overridePct: number | null; overridePctInput: string }>
  >([])
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return materials
    return materials.filter((m) => String(m.nombre ?? '').toLowerCase().includes(q))
  }, [materials, search])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/configuracion/desperdicios')
        const json = (await res.json().catch(() => ({}))) as ApiResponse
        if (!res.ok || !('ok' in json) || !json.ok) {
          if (!cancelled) setError(('error' in json && json.error) || 'No se pudo cargar la configuración')
          return
        }

        if (!cancelled) {
          setSedeNombre(json.data.sedeNombre)
          setDefaultPct(String(json.data.defaultPct ?? 0))
          setMaterials(
            json.data.materials.map((m) => ({
              id: m.id,
              nombre: m.nombre,
              overridePct: m.overridePct,
              // edición local
              overridePctInput: m.overridePct === null ? '' : String(m.overridePct),
            }))
          )
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error inesperado')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  function updateOverride(id: string, value: string) {
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, overridePctInput: value } : m)))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const overrides = materials
        .map((m) => {
          const raw = String(m.overridePctInput ?? '').trim()
          if (!raw) return null
          const pct = Number(raw)
          if (!Number.isFinite(pct)) return null
          return { materialId: m.id, desperdicioPct: pct }
        })
        .filter(Boolean)

      const res = await fetch('/api/configuracion/desperdicios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultPct: Number(defaultPct || '0'),
          overrides,
        }),
      })

      const json = (await res.json().catch(() => ({}))) as ApiResponse
      if (!res.ok || !('ok' in json) || !json.ok) {
        setError(('error' in json && json.error) || 'No se pudo guardar la configuración')
        return
      }

      setSedeNombre(json.data.sedeNombre)
      setDefaultPct(String(json.data.defaultPct ?? 0))
      setMaterials(
        json.data.materials.map((m) => ({
          id: m.id,
          nombre: m.nombre,
          overridePct: m.overridePct,
          overridePctInput: m.overridePct === null ? '' : String(m.overridePct),
        }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración de desperdicios</h1>
        <p className="text-sm text-gray-600">Ajustes por sede: % de desperdicio por defecto y overrides por material.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sede activa</CardTitle>
          <CardDescription>{loading ? 'Cargando…' : sedeNombre || '—'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <div className="max-w-xs">
            <Label htmlFor="defaultPct">% desperdicio por defecto</Label>
            <Input
              id="defaultPct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={defaultPct}
              onChange={(e) => setDefaultPct(e.target.value)}
              disabled={loading || saving}
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Buscar material</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Vinilo, lona, papel…" />
            </div>
            <Button type="button" onClick={save} disabled={loading || saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>

          <div className="border rounded-md">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 px-3 py-2 text-xs text-muted-foreground border-b">
              <div>Material</div>
              <div>Override % (vacío = default)</div>
              <div>Effective</div>
            </div>
            <div className="divide-y">
              {filtered.map((m) => {
                const override = String(m.overridePctInput ?? '').trim()
                const pct = override ? Number(override) : null
                const eff = pct === null || !Number.isFinite(pct) ? Number(defaultPct || '0') : pct

                return (
                  <div key={m.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 px-3 py-2 items-center">
                    <div className="text-sm">{m.nombre}</div>
                    <div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={m.overridePctInput}
                        onChange={(e) => updateOverride(m.id, e.target.value)}
                        disabled={loading || saving}
                        placeholder="(default)"
                      />
                    </div>
                    <div className="text-sm">{Number.isFinite(eff) ? `${eff}%` : '—'}</div>
                  </div>
                )
              })}
              {filtered.length === 0 ? <div className="px-3 py-6 text-sm text-muted-foreground">Sin resultados</div> : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
