'use client'

import { useEffect, useState } from 'react'
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
        sedeCodigo: string | null
        pricesIncludeIva: boolean
        ivaPct: number
      }
    }
  | { ok?: false; error?: string }

export default function ConfigCotizacionesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sedeNombre, setSedeNombre] = useState<string>('')
  const [sedeCodigo, setSedeCodigo] = useState<string | null>(null)
  const [pricesIncludeIva, setPricesIncludeIva] = useState(true)
  const [ivaPct, setIvaPct] = useState('19')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/configuracion/cotizaciones')
        const json = (await res.json().catch(() => ({}))) as ApiResponse
        if (!res.ok || !('ok' in json) || !json.ok) {
          if (!cancelled) setError(('error' in json && json.error) || 'No se pudo cargar la configuración')
          return
        }

        if (!cancelled) {
          setSedeNombre(json.data.sedeNombre)
          setSedeCodigo(json.data.sedeCodigo)
          setPricesIncludeIva(json.data.pricesIncludeIva)
          setIvaPct(String(json.data.ivaPct ?? 19))
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

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/configuracion/cotizaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricesIncludeIva,
          ivaPct: Number(ivaPct || '0'),
        }),
      })

      const json = (await res.json().catch(() => ({}))) as ApiResponse
      if (!res.ok || !('ok' in json) || !json.ok) {
        setError(('error' in json && json.error) || 'No se pudo guardar la configuración')
        return
      }

      setSedeNombre(json.data.sedeNombre)
      setSedeCodigo(json.data.sedeCodigo)
      setPricesIncludeIva(json.data.pricesIncludeIva)
      setIvaPct(String(json.data.ivaPct ?? 19))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración de cotizaciones</h1>
        <p className="text-sm text-gray-600">
          Ajustes por sede: IVA incluido y porcentaje de IVA.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sede activa</CardTitle>
          <CardDescription>
            {loading ? 'Cargando…' : sedeNombre ? `${sedeNombre}${sedeCodigo ? ` (código: ${sedeCodigo})` : ''}` : '—'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <div className="flex items-start gap-3">
            <input
              id="pricesIncludeIva"
              type="checkbox"
              className="mt-1"
              checked={pricesIncludeIva}
              onChange={(e) => setPricesIncludeIva(e.target.checked)}
              disabled={loading || saving}
            />
            <div className="space-y-1">
              <Label htmlFor="pricesIncludeIva">Precios incluyen IVA</Label>
              <div className="text-sm text-gray-600">
                Si está activo, el total ingresado ya trae IVA y el sistema calcula el componente IVA por diferencia.
              </div>
            </div>
          </div>

          <div className="max-w-xs">
            <Label htmlFor="ivaPct">% IVA</Label>
            <Input
              id="ivaPct"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={ivaPct}
              onChange={(e) => setIvaPct(e.target.value)}
              disabled={loading || saving}
            />
            <div className="text-xs text-gray-500 mt-1">Ej: 19</div>
          </div>

          <Button type="button" onClick={save} disabled={loading || saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
