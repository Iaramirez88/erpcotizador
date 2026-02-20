'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type PlanTier = 'BASIC' | 'MEDIO' | 'INTERMEDIO' | 'FULL'

type ModuleKey =
  | 'DASHBOARD'
  | 'COTIZADOR'
  | 'COTIZACIONES'
  | 'CLIENTES'
  | 'MATERIALES'
  | 'INVENTARIO'
  | 'REMISIONES'
  | 'POS'
  | 'PROVEEDORES'
  | 'COMPRAS'
  | 'ORDENES'
  | 'ESCANEOS'
  | 'REPORTES'
  | 'NOTIFICACIONES'
  | 'CONFIG'

type Row = { planTier: PlanTier; module: ModuleKey; enabled: boolean; updatedAt: string }

type GetResponse =
  | { ok: true; planTiers: PlanTier[]; modules: ModuleKey[]; rows: Row[] }
  | { ok?: false; error?: string }

type PutResponse =
  | { ok: true; row: Row }
  | { ok?: false; error?: string }

function titleForModule(moduleKey: ModuleKey): string {
  switch (moduleKey) {
    case 'DASHBOARD':
      return 'Dashboard'
    case 'COTIZADOR':
      return 'Cotizador'
    case 'COTIZACIONES':
      return 'Cotizaciones'
    case 'CLIENTES':
      return 'Clientes'
    case 'MATERIALES':
      return 'Materiales / Terminados'
    case 'INVENTARIO':
      return 'Inventario'
    case 'REMISIONES':
      return 'Remisiones'
    case 'POS':
      return 'POS / Facturación'
    case 'PROVEEDORES':
      return 'Proveedores'
    case 'COMPRAS':
      return 'Compras'
    case 'ORDENES':
      return 'Órdenes'
    case 'ESCANEOS':
      return 'Escaneos'
    case 'REPORTES':
      return 'Reportes'
    case 'NOTIFICACIONES':
      return 'Notificaciones'
    case 'CONFIG':
      return 'Configuración'
    default:
      return moduleKey
  }
}

export default function SuperAdminPlanModulesClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [planTiers, setPlanTiers] = useState<PlanTier[]>([])
  const [modules, setModules] = useState<ModuleKey[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const [empresaNit, setEmpresaNit] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [codePlanTier, setCodePlanTier] = useState<PlanTier>('FULL')
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/super-admin/plan-modules', { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as GetResponse
        if (!res.ok || !('ok' in json) || !json.ok) {
          setError(('error' in json && json.error) || 'No se pudo cargar la configuración')
          return
        }

        if (!cancelled) {
          setPlanTiers(json.planTiers)
          setModules(json.modules)
          setRows(json.rows)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error inesperado')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const rowMap = useMemo(() => {
    const map = new Map<string, Row>()
    for (const r of rows) {
      map.set(`${r.planTier}::${r.module}`, r)
    }
    return map
  }, [rows])

  async function setEnabled(planTier: PlanTier, moduleKey: ModuleKey, enabled: boolean) {
    const key = `${planTier}::${moduleKey}`
    setSavingKey(key)
    setError(null)

    // Optimistic update
    setRows((prev) => {
      const next = [...prev]
      const idx = next.findIndex((r) => r.planTier === planTier && r.module === moduleKey)
      const updated: Row = {
        planTier,
        module: moduleKey,
        enabled,
        updatedAt: new Date().toISOString(),
      }
      if (idx >= 0) next[idx] = updated
      else next.push(updated)
      return next
    })

    try {
      const res = await fetch('/api/super-admin/plan-modules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTier, module: moduleKey, enabled }),
      })

      const json = (await res.json().catch(() => ({}))) as PutResponse
      if (!res.ok || !('ok' in json) || !json.ok) {
        setError(('error' in json && json.error) || 'No se pudo guardar')
        return
      }

      setRows((prev) => {
        const next = [...prev]
        const idx = next.findIndex((r) => r.planTier === planTier && r.module === moduleKey)
        if (idx >= 0) next[idx] = json.row
        else next.push(json.row)
        return next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSavingKey(null)
    }
  }

  async function generateEmpresaCode() {
    setGeneratingCode(true)
    setError(null)
    setGeneratedCode(null)
    try {
      const res = await fetch('/api/super-admin/empresa-access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nit: empresaNit.trim() || undefined,
          empresaId: empresaId.trim() || undefined,
          planTier: codePlanTier,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; error?: string }
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo generar el código')
        return
      }

      setGeneratedCode(json.code || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setGeneratingCode(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Super Admin · Módulos por plan</h1>
          <p className="text-sm text-gray-600">Habilita o deshabilita módulos para cada plan.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/configuracion/super-admin/empresas">Empresas</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/configuracion/super-admin/usuarios">Usuarios</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ID de empresa (EMP-...)</CardTitle>
          <CardDescription>
            Genera un ID para registrar/asignar usuarios a una empresa ya registrada (formato: EMP-&lt;empresaId&gt;-...).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-sm">NIT (opcional)</Label>
              <Input value={empresaNit} onChange={(e) => setEmpresaNit(e.target.value)} placeholder="900123456" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">Empresa ID (opcional)</Label>
              <Input value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} placeholder="cuid..." />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">Plan</Label>
              <Select value={codePlanTier} onValueChange={(v) => setCodePlanTier(v as PlanTier)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASIC">BASIC</SelectItem>
                  <SelectItem value="MEDIO">MEDIO</SelectItem>
                  <SelectItem value="INTERMEDIO">INTERMEDIO</SelectItem>
                  <SelectItem value="FULL">FULL</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => void generateEmpresaCode()}
              disabled={generatingCode || (!empresaNit.trim() && !empresaId.trim())}
            >
              Generar ID
            </Button>
            {generatedCode ? (
              <div className="text-sm">
                <span className="text-muted-foreground">ID de empresa: </span>
                <span className="font-mono">{generatedCode}</span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {loading ? <div className="text-sm text-gray-600">Cargando…</div> : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {!loading && !error ? (
        <div className="grid gap-4">
          {planTiers.map((tier) => (
            <Card key={tier}>
              <CardHeader>
                <CardTitle>{tier}</CardTitle>
                <CardDescription>Define qué módulos incluye este plan.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {modules.map((m) => {
                  const key = `${tier}::${m}`
                  const row = rowMap.get(key)
                  const enabled = row?.enabled ?? true
                  const disabled = savingKey === key

                  return (
                    <div key={m} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5">
                      <div className="min-w-0">
                        <Label className="text-xs leading-4">{titleForModule(m)}</Label>
                        <div className="truncate text-[10px] text-muted-foreground">{m}</div>
                      </div>
                      <Switch
                        checked={enabled}
                        disabled={disabled}
                        onCheckedChange={(v) => void setEnabled(tier, m, Boolean(v))}
                        aria-label={`Habilitar ${m} en ${tier}`}
                      />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}
