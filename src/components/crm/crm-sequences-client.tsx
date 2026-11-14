'use client'

import { useCallback, useEffect, useState } from 'react'
import { Archive, Play, Plus, RefreshCw, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type SequenceStep = {
  id: string
  order: number
  kind: string
  delayDays: number
  subject: string | null
  bodyHtml: string | null
  taskTitle: string | null
}

type Sequence = {
  id: string
  name: string
  description: string | null
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
  triggerJson: Record<string, unknown>
  stopOnOpportunity: boolean
  stopOnReply: boolean
  steps: SequenceStep[]
  _count: { enrollments: number }
}

type StepForm = { kind: string; delayDays: string; subject: string; bodyHtml: string }

const EMPTY_STEP: StepForm = { kind: 'EMAIL', delayDays: '0', subject: '', bodyHtml: '' }

const EMPTY_FORM = {
  name: '',
  description: '',
  status: 'DRAFT' as Sequence['status'],
  sources: '',
  services: '',
  scoreBands: '',
  steps: [{ ...EMPTY_STEP }] as StepForm[],
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PAUSED: 'bg-amber-50 text-amber-700',
  ARCHIVED: 'bg-rose-50 text-rose-700',
}

export function CrmSequencesClient() {
  const { toast } = useToast()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [enrollSequenceId, setEnrollSequenceId] = useState('')
  const [enrollLeadId, setEnrollLeadId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/crm/sequences', { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as { data?: Sequence[]; error?: string } | null
      if (!response.ok || !payload?.data) throw new Error(payload?.error || 'No se pudieron cargar las secuencias')
      setSequences(payload.data)
    } catch (error) {
      toast({
        title: 'No se pudieron cargar las secuencias',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  function patchStep(index: number, patch: Partial<StepForm>) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)),
    }))
  }

  async function createSequence() {
    if (!form.name.trim()) {
      toast({ title: 'Nombre requerido', variant: 'destructive' })
      return
    }
    if (form.status === 'ACTIVE' && !form.steps.length) {
      toast({ title: 'Una secuencia activa requiere pasos', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/crm/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          status: form.status,
          triggerJson: {
            sources: form.sources ? form.sources.split(',').map((item) => item.trim()).filter(Boolean) : [],
            services: form.services ? form.services.split(',').map((item) => item.trim()).filter(Boolean) : [],
            scoreBands: form.scoreBands
              ? form.scoreBands.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean)
              : [],
          },
          steps: form.steps
            .filter((step) => step.kind === 'WAIT' || step.subject || step.bodyHtml || step.kind === 'TASK')
            .map((step) => ({
              kind: step.kind,
              delayDays: Number(step.delayDays) || 0,
              subject: step.subject,
              bodyHtml: step.bodyHtml,
              taskTitle: step.kind === 'TASK' ? step.subject : null,
            })),
        }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo crear la secuencia')
      toast({ title: 'Secuencia creada' })
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch (error) {
      toast({
        title: 'No se pudo crear la secuencia',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function updateStatus(sequence: Sequence, status: Sequence['status']) {
    setBusy(true)
    try {
      const response = await fetch(`/api/crm/sequences/${sequence.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo actualizar')
      toast({ title: `Secuencia ${status.toLowerCase()}` })
      await load()
    } catch (error) {
      toast({
        title: 'No se pudo actualizar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function archiveSequence(sequence: Sequence) {
    if (!window.confirm(`¿Archivar la secuencia «${sequence.name}»? Se cancelarán los enrolamientos activos.`)) {
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/crm/sequences/${sequence.id}`, { method: 'DELETE' })
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; cancelledEnrollments?: number }
        | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo archivar')
      toast({
        title: 'Secuencia archivada',
        description: payload?.cancelledEnrollments ? `${payload.cancelledEnrollments} enrolamientos cancelados` : undefined,
      })
      await load()
    } catch (error) {
      toast({
        title: 'No se pudo archivar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function enrollLead() {
    if (!enrollSequenceId || !enrollLeadId.trim()) {
      toast({ title: 'Selecciona secuencia e ingresa el leadId', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/crm/sequences/${enrollSequenceId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: enrollLeadId.trim() }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; alreadyEnrolled?: boolean }
        | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo enrolar')
      toast({
        title: payload?.alreadyEnrolled ? 'El lead ya estaba enrolado' : 'Lead enrolado',
      })
      setEnrollLeadId('')
      await load()
    } catch (error) {
      toast({
        title: 'No se pudo enrolar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Secuencias de nutrición</h1>
          <p className="text-xs text-slate-500">
            Enrolamiento automático por trigger al captar. Ejecución programada con{' '}
            <code className="rounded bg-slate-100 px-1">/api/cron/crm-sequences</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Actualizar
          </Button>
          <Button size="sm" onClick={() => setShowForm((current) => !current)}>
            <Plus className="h-3.5 w-3.5" /> Nueva secuencia
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <span className="text-[11px] font-semibold text-slate-600">Enrolar lead manualmente</span>
        <select
          className="h-8 rounded-md border border-slate-200 px-2 text-[11px]"
          value={enrollSequenceId}
          onChange={(event) => setEnrollSequenceId(event.target.value)}
        >
          <option value="">Secuencia…</option>
          {sequences
            .filter((sequence) => sequence.status === 'ACTIVE')
            .map((sequence) => (
              <option key={sequence.id} value={sequence.id}>
                {sequence.name}
              </option>
            ))}
        </select>
        <Input
          className="h-8 w-64 text-[11px]"
          placeholder="leadId"
          value={enrollLeadId}
          onChange={(event) => setEnrollLeadId(event.target.value)}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void enrollLead()}>
          <UserPlus className="h-3.5 w-3.5" /> Enrolar
        </Button>
      </div>


      {showForm ? (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              className="h-8 text-[11px]"
              placeholder="Nombre"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <Input
              className="h-8 text-[11px]"
              placeholder="Descripción"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
            <select
              className="h-8 rounded-md border border-slate-200 px-2 text-[11px]"
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({ ...current, status: event.target.value as Sequence['status'] }))
              }
            >
              <option value="DRAFT">Borrador</option>
              <option value="ACTIVE">Activa</option>
              <option value="PAUSED">Pausada</option>
            </select>
            <Input
              className="h-8 text-[11px]"
              placeholder="Fuentes (WEB,IMPORT)"
              value={form.sources}
              onChange={(event) => setForm((current) => ({ ...current, sources: event.target.value }))}
            />
            <Input
              className="h-8 text-[11px]"
              placeholder="Servicios"
              value={form.services}
              onChange={(event) => setForm((current) => ({ ...current, services: event.target.value }))}
            />
            <Input
              className="h-8 text-[11px]"
              placeholder="Bandas (WARM,HOT)"
              value={form.scoreBands}
              onChange={(event) => setForm((current) => ({ ...current, scoreBands: event.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            {form.steps.map((step, index) => (
              <div key={index} className="grid grid-cols-1 gap-1.5 sm:grid-cols-6">
                <select
                  className="h-8 rounded-md border border-slate-200 px-2 text-[11px]"
                  value={step.kind}
                  onChange={(event) => patchStep(index, { kind: event.target.value })}
                >
                  <option value="EMAIL">Correo</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="TASK">Tarea</option>
                  <option value="WAIT">Espera</option>
                  <option value="WEBHOOK">Webhook</option>
                </select>
                <Input
                  className="h-8 text-[11px]"
                  type="number"
                  placeholder="Días"
                  value={step.delayDays}
                  onChange={(event) => patchStep(index, { delayDays: event.target.value })}
                />
                <Input
                  className="h-8 text-[11px] sm:col-span-2"
                  placeholder={step.kind === 'TASK' ? 'Título de la tarea' : 'Asunto'}
                  value={step.subject}
                  onChange={(event) => patchStep(index, { subject: event.target.value })}
                />
                <Input
                  className="h-8 text-[11px] sm:col-span-2"
                  placeholder="Contenido / cuerpo"
                  value={step.bodyHtml}
                  onChange={(event) => patchStep(index, { bodyHtml: event.target.value })}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setForm((current) => ({ ...current, steps: [...current.steps, { ...EMPTY_STEP }] }))
                }
              >
                <Plus className="h-3.5 w-3.5" /> Añadir paso
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void createSequence()}>
                Crear secuencia
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}


      <div className="space-y-2">
        {loading ? (
          <div className="h-20 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
        ) : sequences.length ? (
          sequences.map((sequence) => (
            <div key={sequence.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{sequence.name}</h2>
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                        STATUS_STYLES[sequence.status]
                      )}
                    >
                      {sequence.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {sequence.description || 'Sin descripción'} · {sequence.steps.length} pasos ·{' '}
                    {sequence._count.enrollments} enrolamientos
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {sequence.status !== 'ACTIVE' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void updateStatus(sequence, 'ACTIVE')}
                    >
                      <Play className="h-3.5 w-3.5" /> Activar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void updateStatus(sequence, 'PAUSED')}
                    >
                      Pausar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || sequence.status === 'ARCHIVED'}
                    onClick={() => void archiveSequence(sequence)}
                  >
                    <Archive className="h-3.5 w-3.5" /> Archivar
                  </Button>
                </div>
              </div>

              <ol className="mt-2 space-y-1 border-l border-slate-200 pl-3 text-[11px]">
                {sequence.steps.map((step) => (
                  <li key={step.id} className="text-slate-600">
                    <span className="font-medium text-slate-700">Día {step.delayDays}</span> · {step.kind}
                    {step.subject ? ` · ${step.subject}` : ''}
                    {step.taskTitle ? ` · ${step.taskTitle}` : ''}
                  </li>
                ))}
                {!sequence.steps.length ? <li className="text-slate-400">Sin pasos configurados.</li> : null}
              </ol>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            Aún no hay secuencias. Crea la primera para nutrir leads automáticamente.
          </div>
        )}
      </div>
    </div>
  )
}

