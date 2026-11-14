'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { CrmLeadOwner } from '@/components/crm/crm-leads-types'

type ScoringRule = {
  id: string
  eventType: string
  points: number
  active: boolean
  oncePerLead: boolean
  dedupeWindowHours: number
  maxPerLead: number | null
  label?: string
}

type ScoringSettings = {
  warmThreshold: number
  hotThreshold: number
  active: boolean
}

type AssignmentRule = {
  id: string
  name: string
  priority: number
  active: boolean
  stopOnMatch: boolean
  matchJson: Record<string, unknown>
  assigneeUserId: string | null
  teamId: string | null
  assigneeUser: { id: string; name: string | null; email: string } | null
  team: { id: string; nombre: string } | null
}

type TeamOption = { id: string; nombre: string; _count: { members: number } }

const EMPTY_ASSIGNMENT_FORM = {
  name: '',
  priority: '100',
  sources: '',
  services: '',
  scoreBands: '',
  minScore: '',
  targetType: 'user' as 'user' | 'team',
  targetId: '',
  stopOnMatch: true,
}

export function CrmScoringClient() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<ScoringSettings>({ warmThreshold: 20, hotThreshold: 50, active: true })
  const [rules, setRules] = useState<ScoringRule[]>([])
  const [assignmentRules, setAssignmentRules] = useState<AssignmentRule[]>([])
  const [owners, setOwners] = useState<CrmLeadOwner[]>([])
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(EMPTY_ASSIGNMENT_FORM)
  const [preview, setPreview] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, rulesRes, ownersRes, teamsRes] = await Promise.all([
        fetch('/api/crm/scoring/settings', { cache: 'no-store' }),
        fetch('/api/crm/assignment-rules', { cache: 'no-store' }),
        fetch('/api/crm/assignees', { cache: 'no-store' }),
        fetch('/api/crm/teams', { cache: 'no-store' }),
      ])

      const settingsPayload = (await settingsRes.json().catch(() => null)) as
        | { data?: { settings: ScoringSettings; rules: ScoringRule[] } }
        | null
      if (settingsPayload?.data) {
        setSettings(settingsPayload.data.settings)
        setRules(settingsPayload.data.rules)
      }

      const assignmentPayload = (await rulesRes.json().catch(() => null)) as { data?: AssignmentRule[] } | null
      setAssignmentRules(Array.isArray(assignmentPayload?.data) ? assignmentPayload.data : [])

      const ownersPayload = (await ownersRes.json().catch(() => null)) as { data?: CrmLeadOwner[] } | null
      setOwners(Array.isArray(ownersPayload?.data) ? ownersPayload.data : [])

      const teamsPayload = (await teamsRes.json().catch(() => null)) as { data?: TeamOption[] } | null
      setTeams(Array.isArray(teamsPayload?.data) ? teamsPayload.data : [])
    } catch {
      toast({ title: 'No se pudo cargar la configuración', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  function patchRule(eventType: string, patch: Partial<ScoringRule>) {
    setRules((current) => current.map((rule) => (rule.eventType === eventType ? { ...rule, ...patch } : rule)))
  }

  async function saveSettings() {
    setBusy(true)
    try {
      const response = await fetch('/api/crm/scoring/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo guardar')
      toast({ title: 'Umbrales guardados' })
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function saveRules() {
    setBusy(true)
    try {
      const response = await fetch('/api/crm/scoring/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: rules.map((rule) => ({
            eventType: rule.eventType,
            points: rule.points,
            active: rule.active,
            oncePerLead: rule.oncePerLead,
            dedupeWindowHours: rule.dedupeWindowHours,
            maxPerLead: rule.maxPerLead,
          })),
        }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string; data?: ScoringRule[] } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudieron guardar las reglas')
      if (payload?.data) setRules(payload.data)
      toast({ title: 'Reglas actualizadas' })
    } catch (error) {
      toast({
        title: 'No se pudieron guardar las reglas',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function recalculateAll() {
    setBusy(true)
    try {
      const response = await fetch('/api/crm/scoring/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 100 }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; data?: { processed: number } }
        | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo recalcular')
      toast({ title: `Puntuación recalculada (${payload?.data?.processed ?? 0} leads)` })
    } catch (error) {
      toast({
        title: 'No se pudo recalcular',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }


  async function createAssignmentRule() {
    if (!form.name.trim()) {
      toast({ title: 'Nombre requerido', variant: 'destructive' })
      return
    }
    if (!form.targetId) {
      toast({ title: 'Selecciona responsable o equipo', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const matchJson = {
        sources: form.sources ? form.sources.split(',').map((item) => item.trim()).filter(Boolean) : [],
        services: form.services ? form.services.split(',').map((item) => item.trim()).filter(Boolean) : [],
        scoreBands: form.scoreBands
          ? form.scoreBands.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean)
          : [],
        ...(form.minScore ? { minScore: Number(form.minScore) } : {}),
      }
      const response = await fetch('/api/crm/assignment-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          priority: Number(form.priority) || 100,
          stopOnMatch: form.stopOnMatch,
          matchJson,
          assigneeUserId: form.targetType === 'user' ? form.targetId : '',
          teamId: form.targetType === 'team' ? form.targetId : '',
        }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo crear la regla')
      toast({ title: 'Regla creada' })
      setForm(EMPTY_ASSIGNMENT_FORM)
      await load()
    } catch (error) {
      toast({
        title: 'No se pudo crear la regla',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function deleteAssignmentRule(id: string) {
    if (!window.confirm('¿Eliminar esta regla de asignación?')) return
    setBusy(true)
    try {
      const response = await fetch(`/api/crm/assignment-rules/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('No se pudo eliminar')
      toast({ title: 'Regla eliminada' })
      await load()
    } catch (error) {
      toast({
        title: 'No se pudo eliminar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function simulateRule() {
    setBusy(true)
    try {
      const response = await fetch('/api/crm/assignment-rules/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            source: form.sources.split(',')[0]?.trim() || null,
            serviceInterest: form.services.split(',')[0]?.trim() || null,
            scoreBand: form.scoreBands.split(',')[0]?.trim().toUpperCase() || null,
            score: form.minScore ? Number(form.minScore) : null,
          },
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: { wouldAssign: boolean; ruleName: string | null; assigneeUserId: string | null }
            error?: string
          }
        | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo simular')
      const data = payload?.data
      setPreview(
        data?.wouldAssign
          ? `Asignaría con «${data.ruleName}» a ${data.assigneeUserId}`
          : 'Ninguna regla activa coincide con el contexto.'
      )
    } catch (error) {
      setPreview(error instanceof Error ? error.message : 'Error al simular')
    } finally {
      setBusy(false)
    }
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Puntuación y asignación</h1>
          <p className="text-xs text-slate-500">
            Los eventos de score son idempotentes; recalcular reconstruye el puntaje desde el historial.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Actualizar
          </Button>
          <Button size="sm" variant="outline" onClick={() => void recalculateAll()} disabled={busy}>
            <Sparkles className="h-3.5 w-3.5" /> Recalcular
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold text-slate-700">Umbrales de banda</p>
          <label className="block text-[11px] text-slate-500">
            Tibio desde
            <Input
              type="number"
              className="mt-1 h-8 text-xs"
              value={settings.warmThreshold}
              onChange={(event) =>
                setSettings((current) => ({ ...current, warmThreshold: Number(event.target.value) }))
              }
            />
          </label>
          <label className="block text-[11px] text-slate-500">
            Caliente desde
            <Input
              type="number"
              className="mt-1 h-8 text-xs"
              value={settings.hotThreshold}
              onChange={(event) =>
                setSettings((current) => ({ ...current, hotThreshold: Number(event.target.value) }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={settings.active}
              onChange={(event) => setSettings((current) => ({ ...current, active: event.target.checked }))}
            />
            Scoring activo
          </label>
          <Button size="sm" disabled={busy} onClick={() => void saveSettings()}>
            Guardar umbrales
          </Button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">Reglas por evento</p>
            <Button size="sm" disabled={busy || !rules.length} onClick={() => void saveRules()}>
              Guardar reglas
            </Button>
          </div>


          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[11px]">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 font-semibold">Evento</th>
                  <th className="py-1 font-semibold">Puntos</th>
                  <th className="py-1 font-semibold">Una vez</th>
                  <th className="py-1 font-semibold">Ventana (h)</th>
                  <th className="py-1 font-semibold">Tope</th>
                  <th className="py-1 font-semibold">Activa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((rule) => (
                  <tr key={rule.eventType}>
                    <td className="py-1.5 text-slate-700">{rule.label || rule.eventType}</td>
                    <td className="py-1.5">
                      <Input
                        type="number"
                        className="h-7 w-16 text-[11px]"
                        value={rule.points}
                        onChange={(event) => patchRule(rule.eventType, { points: Number(event.target.value) })}
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="checkbox"
                        checked={rule.oncePerLead}
                        onChange={(event) => patchRule(rule.eventType, { oncePerLead: event.target.checked })}
                      />
                    </td>
                    <td className="py-1.5">
                      <Input
                        type="number"
                        className="h-7 w-16 text-[11px]"
                        value={rule.dedupeWindowHours}
                        onChange={(event) =>
                          patchRule(rule.eventType, { dedupeWindowHours: Number(event.target.value) })
                        }
                      />
                    </td>
                    <td className="py-1.5">
                      <Input
                        type="number"
                        className="h-7 w-16 text-[11px]"
                        value={rule.maxPerLead ?? ''}
                        onChange={(event) =>
                          patchRule(rule.eventType, {
                            maxPerLead: event.target.value === '' ? null : Number(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        type="checkbox"
                        checked={rule.active}
                        onChange={(event) => patchRule(rule.eventType, { active: event.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
                {!rules.length ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400">
                      {loading ? 'Cargando reglas…' : 'Sin reglas configuradas.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>


      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-700">Reglas de asignación</p>
            <p className="text-[11px] text-slate-500">
              Se evalúan por prioridad ascendente. Si ninguna coincide, el lead queda sin responsable.
            </p>
          </div>
          <span className="text-[11px] text-slate-400">{assignmentRules.length} reglas</span>
        </div>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[11px]">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1 font-semibold">Prioridad</th>
                <th className="py-1 font-semibold">Regla</th>
                <th className="py-1 font-semibold">Criterios</th>
                <th className="py-1 font-semibold">Destino</th>
                <th className="py-1 font-semibold">Activa</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignmentRules.map((rule) => (
                <tr key={rule.id}>
                  <td className="py-1.5 font-mono text-slate-600">{rule.priority}</td>
                  <td className="py-1.5 text-slate-700">{rule.name}</td>
                  <td className="py-1.5 text-slate-500">
                    {Object.entries(rule.matchJson ?? {})
                      .filter(([, value]) => (Array.isArray(value) ? value.length : value != null))
                      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join('/') : String(value)}`)
                      .join(' · ') || 'Sin criterios'}
                  </td>
                  <td className="py-1.5 text-slate-600">
                    {rule.assigneeUser
                      ? rule.assigneeUser.name || rule.assigneeUser.email
                      : rule.team
                        ? `Equipo ${rule.team.nombre}`
                        : '—'}
                  </td>
                  <td className="py-1.5">
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        rule.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {rule.active ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td className="py-1.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void deleteAssignmentRule(rule.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!assignmentRules.length ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400">
                    Sin reglas. Los leads nuevos quedarán en la bandeja sin responsable.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>


        <div className="mt-3 grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            className="h-8 text-[11px]"
            placeholder="Nombre de la regla"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            className="h-8 text-[11px]"
            placeholder="Prioridad (100)"
            value={form.priority}
            onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
          />
          <Input
            className="h-8 text-[11px]"
            placeholder="Fuentes (WEB,META_ADS)"
            value={form.sources}
            onChange={(event) => setForm((current) => ({ ...current, sources: event.target.value }))}
          />
          <Input
            className="h-8 text-[11px]"
            placeholder="Servicios (software,marketing)"
            value={form.services}
            onChange={(event) => setForm((current) => ({ ...current, services: event.target.value }))}
          />
          <Input
            className="h-8 text-[11px]"
            placeholder="Bandas (HOT,WARM)"
            value={form.scoreBands}
            onChange={(event) => setForm((current) => ({ ...current, scoreBands: event.target.value }))}
          />
          <Input
            className="h-8 text-[11px]"
            placeholder="Score mínimo"
            value={form.minScore}
            onChange={(event) => setForm((current) => ({ ...current, minScore: event.target.value }))}
          />
          <select
            className="h-8 rounded-md border border-slate-200 px-2 text-[11px]"
            value={form.targetType}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                targetType: event.target.value as 'user' | 'team',
                targetId: '',
              }))
            }
          >
            <option value="user">Persona</option>
            <option value="team">Equipo</option>
          </select>
          <select
            className="h-8 rounded-md border border-slate-200 px-2 text-[11px]"
            value={form.targetId}
            onChange={(event) => setForm((current) => ({ ...current, targetId: event.target.value }))}
          >
            <option value="">Selecciona destino…</option>
            {form.targetType === 'user'
              ? owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name || owner.email}
                  </option>
                ))
              : teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.nombre} ({team._count.members})
                  </option>
                ))}
          </select>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={form.stopOnMatch}
              onChange={(event) => setForm((current) => ({ ...current, stopOnMatch: event.target.checked }))}
            />
            Detener en la primera coincidencia
          </label>
          <Button size="sm" disabled={busy} onClick={() => void createAssignmentRule()}>
            Crear regla
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void simulateRule()}>
            Simular
          </Button>
          {preview ? <span className="text-[11px] text-slate-600">{preview}</span> : null}
        </div>
      </div>
    </div>
  )
}

