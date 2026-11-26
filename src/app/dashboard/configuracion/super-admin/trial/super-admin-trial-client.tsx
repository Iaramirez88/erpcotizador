'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SuperAdminTrialClient() {
  const [days, setDays] = useState('15')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/super-admin/trial-config', { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; days?: number; error?: string }
        if (cancelled) return
        if (!res.ok || !json.ok) {
          setError(json.error || 'No se pudo cargar la configuración')
          return
        }
        setDays(String(json.days ?? 15))
      } catch {
        if (!cancelled) setError('Error inesperado')
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
    const numeric = Number(days)
    if (!Number.isFinite(numeric) || numeric < 1 || numeric > 365) {
      setError('Indica entre 1 y 365 días.')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/super-admin/trial-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: numeric }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; days?: number; error?: string }
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo guardar la configuración')
        return
      }
      setDays(String(json.days ?? numeric))
      setSaved(true)
    } catch {
      setError('Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Administración' }, { label: 'Días de prueba' }]}
        title="Días de prueba gratuita"
        description="Define cuántos días calendario dura el periodo de prueba de los usuarios nuevos. El aviso se muestra al registrarse, cuando quedan 7 días y cuando queda 1 día."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/configuracion/super-admin/modulos-por-plan">Volver a Super Admin</Link>
          </Button>
        }
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Periodo de prueba</CardTitle>
          <CardDescription>
            El cambio aplica a los registros nuevos. Los periodos de prueba ya iniciados conservan su fecha de vencimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="trialDays" className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Días gratis
            </Label>
            <Input
              id="trialDays"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              disabled={loading}
            />
            <p className="text-[11px] leading-4 text-slate-500">Entre 1 y 365 días calendario. Por defecto 15.</p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={() => void save()} disabled={loading || saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
            {saved ? <span className="text-sm text-emerald-700">Configuración guardada.</span> : null}
          </div>

          {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        </CardContent>
      </Card>
    </div>
  )
}
