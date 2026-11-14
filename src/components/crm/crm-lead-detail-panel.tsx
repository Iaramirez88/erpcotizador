'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ban, CheckCircle2, RefreshCw, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { CrmLeadsScoreBadge } from '@/components/crm/crm-leads-score-badge'
import { CrmLeadTimeline } from '@/components/crm/crm-lead-timeline'
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_STYLES,
  formatRelativeDate,
  type CrmLeadDetailResponse,
  type CrmLeadLifecycleStatus,
  type CrmLeadOwner,
} from '@/components/crm/crm-leads-types'

const NEXT_STATUS_OPTIONS: CrmLeadLifecycleStatus[] = [
  'NEW',
  'PENDING_REVIEW',
  'NURTURING',
  'QUALIFIED',
  'SALES_ASSIGNED',
  'DISCARDED',
  'DO_NOT_CONTACT',
]

export function CrmLeadDetailPanel({
  leadId,
  owners,
  onClose,
  onChanged,
}: {
  leadId: string | null
  owners: CrmLeadOwner[]
  onClose: () => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [data, setData] = useState<CrmLeadDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [assignee, setAssignee] = useState('')
  const [nextStatus, setNextStatus] = useState<CrmLeadLifecycleStatus>('PENDING_REVIEW')
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    if (!leadId) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/crm/leads/${leadId}`, { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as
        | { data?: CrmLeadDetailResponse; error?: string }
        | null
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || 'No se pudo cargar el lead')
      }
      setData(payload.data)
      setAssignee(payload.data.ownerUserId ?? '')
      setNextStatus(payload.data.lifecycleStatus === 'NEW' ? 'PENDING_REVIEW' : 'QUALIFIED')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error al cargar el lead')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  async function runAction(path: string, body: Record<string, unknown>, successMessage: string) {
    if (!leadId) return
    setBusy(true)
    try {
      const response = await fetch(`/api/crm/leads/${leadId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo completar la acción')
      toast({ title: successMessage })
      await load()
      onChanged()
    } catch (actionError) {
      toast({
        title: 'Acción no completada',
        description: actionError instanceof Error ? actionError.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!leadId) {
    return (
      <aside className="hidden w-[360px] shrink-0 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-500 xl:block">
        Selecciona un lead para ver su detalle, puntuación e historial.
      </aside>
    )
  }

  const contact = data?.detail?.contact ?? null
  const captures = data?.detail?.captures ?? []
  const scoreEvents = data?.detail?.scoreEvents ?? []
  const opportunities = data?.detail?.opportunities ?? []
  const conversations = data?.detail?.conversations ?? []
  const enrollments = data?.detail?.sequenceEnrollments ?? []

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-2xl sm:w-[420px] xl:static xl:z-auto xl:w-[380px] xl:shrink-0 xl:rounded-xl xl:border xl:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Detalle del lead</p>
          <h2 className="text-base font-semibold text-slate-900">{data?.nombre ?? 'Cargando…'}</h2>
          <p className="text-xs text-slate-500">{data?.empresaNombre || contact?.empresaNombre || '—'}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => void load()} title="Recargar">
            <RefreshCw className={cn('h-3.5 w-3.5', loading ? 'animate-spin' : '')} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>

      {error ? <p className="mt-3 rounded-md bg-rose-50 p-2 text-xs text-rose-700">{error}</p> : null}

      {loading && !data ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-md bg-slate-50" />
          ))}
        </div>
      ) : null}

      {data ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                LIFECYCLE_STYLES[data.lifecycleStatus]
              )}
            >
              {LIFECYCLE_LABELS[data.lifecycleStatus]}
            </span>
            <CrmLeadsScoreBadge score={data.score} band={data.scoreBand} showBar />
            <span className="text-[11px] text-slate-500">
              {data.ownerUser ? data.ownerUser.name || data.ownerUser.email : 'Sin responsable'}
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 text-xs">
            <p className="font-semibold text-slate-700">Contacto</p>
            <dl className="mt-2 space-y-1 text-slate-600">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Correo</dt>
                <dd className="truncate">{contact?.email || data.email || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Teléfono</dt>
                <dd>{contact?.celular || contact?.telefono || data.celular || data.telefono || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Documento</dt>
                <dd>{contact?.documento || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Ciudad</dt>
                <dd>{contact?.ciudad || '—'}</dd>
              </div>
            </dl>
            {contact?.consents?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {contact.consents.map((consent) => (
                  <span
                    key={`${consent.channel}-${consent.status}`}
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      consent.status === 'REVOKED'
                        ? 'bg-rose-50 text-rose-700'
                        : consent.status === 'GRANTED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {consent.channel}: {consent.status}
                  </span>
                ))}
              </div>
            ) : null}
          </div>


          <div className="rounded-lg border border-slate-200 p-3 text-xs">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-700">Origen</p>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">
                {data.originLabel || data.sourceLabel || data.source}
              </span>
            </div>
            <p className="mt-1 text-slate-500">
              {[data.formName, data.campaignName, data.serviceInterest].filter(Boolean).join(' · ') || 'Sin detalle'}
            </p>
            <ul className="mt-2 space-y-1.5">
              {captures.slice(0, 4).map((capture) => (
                <li key={capture.id} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-700">{capture.captureType}</p>
                    <p className="text-[10px] text-slate-500">
                      {[
                        capture.formName,
                        capture.campaignName,
                        capture.resourceLabel,
                        capture.channelConnection?.name,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Captura'}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-[10px] text-slate-400">
                    {formatRelativeDate(capture.createdAt)}
                  </span>
                </li>
              ))}
              {!captures.length ? <li className="text-slate-400">Sin capturas asociadas.</li> : null}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 text-xs">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-700">Puntuación</p>
              <span className="font-mono text-slate-500">{data.score} pts</span>
            </div>
            <ul className="mt-2 space-y-1">
              {scoreEvents.slice(0, 6).map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-2 text-slate-600">
                  <span>{event.eventType}</span>
                  <span className={event.points >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {event.points >= 0 ? '+' : ''}
                    {event.points}
                  </span>
                </li>
              ))}
              {!scoreEvents.length ? <li className="text-slate-400">Sin eventos de puntuación.</li> : null}
            </ul>
          </div>


          <div className="rounded-lg border border-slate-200 p-3 text-xs">
            <p className="font-semibold text-slate-700">Acciones</p>

            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-[11px]"
                  value={assignee}
                  onChange={(event) => setAssignee(event.target.value)}
                >
                  <option value="">Sin responsable</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name || owner.email}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={busy || !assignee}
                  onClick={() => void runAction('assign', { ownerUserId: assignee }, 'Lead asignado')}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Asignar
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-[11px]"
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value as CrmLeadLifecycleStatus)}
                >
                  {NEXT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {LIFECYCLE_LABELS[status]}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      'status',
                      { lifecycleStatus: nextStatus, reason: reason || undefined },
                      'Estado actualizado'
                    )
                  }
                >
                  Cambiar estado
                </Button>
              </div>

              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Motivo (obligatorio al descartar)"
                className="h-8 text-[11px]"
              />

              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || data.lifecycleStatus === 'CONVERTED'}
                  onClick={() =>
                    void runAction(
                      'convert-opportunity',
                      { title: `Oportunidad · ${data.nombre}` },
                      'Oportunidad creada'
                    )
                  }
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Convertir
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || data.lifecycleStatus === 'DO_NOT_CONTACT'}
                  onClick={() => {
                    if (window.confirm('¿Marcar este contacto como “no contactar”?')) {
                      void runAction(
                        'do-not-contact',
                        { reason: reason || undefined },
                        'Contacto marcado como no contactar'
                      )
                    }
                  }}
                >
                  <Ban className="h-3.5 w-3.5" /> No contactar
                </Button>
              </div>
            </div>
          </div>


          {enrollments.length ? (
            <div className="rounded-lg border border-slate-200 p-3 text-xs">
              <p className="font-semibold text-slate-700">Secuencias</p>
              <ul className="mt-2 space-y-1">
                {enrollments.map((enrollment) => (
                  <li key={enrollment.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">{enrollment.sequence.name}</span>
                    <span className="text-[10px] text-slate-400">{enrollment.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {opportunities.length ? (
            <div className="rounded-lg border border-slate-200 p-3 text-xs">
              <p className="font-semibold text-slate-700">Oportunidades</p>
              <ul className="mt-2 space-y-1">
                {opportunities.map((opportunity) => (
                  <li key={opportunity.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">{opportunity.title}</span>
                    <span className="text-[10px] text-slate-400">{opportunity.stage}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {conversations.length ? (
            <div className="rounded-lg border border-slate-200 p-3 text-xs">
              <p className="font-semibold text-slate-700">Conversaciones</p>
              <ul className="mt-2 space-y-1">
                {conversations.map((conversation) => (
                  <li key={conversation.id} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">{conversation.channelConnection?.name || 'Canal'}</span>
                    <span className="text-[10px] text-slate-400">
                      {formatRelativeDate(conversation.lastMessageAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700">Historial</p>
            <CrmLeadTimeline entries={data.timeline} className="mt-3" />
          </div>
        </div>
      ) : null}
    </aside>
  )
}

