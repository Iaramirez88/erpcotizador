'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Search, UserRoundPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { CrmLeadTimeline } from '@/components/crm/crm-lead-timeline'
import { formatRelativeDate, type CrmLeadTimelineEntry } from '@/components/crm/crm-leads-types'

type ContactRow = {
  id: string
  nombre: string
  apellido: string | null
  email: string | null
  telefono: string | null
  celular: string | null
  empresaNombre: string | null
  documento: string | null
  ciudad: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'DO_NOT_CONTACT'
  sourceKey: string | null
  sourceLabel: string | null
  ownerUserId: string | null
  lastInteractionAt: string | null
  createdAt: string
  ownerUser: { id: string; name: string | null; email: string } | null
  _count: { leads: number; captures: number; conversations: number; opportunities: number }
}

type ContactDetail = ContactRow & {
  leads: Array<{
    id: string
    nombre: string
    lifecycleStatus: string
    score: number
    scoreBand: string
    createdAt: string
    lastActivityAt: string | null
  }>
  captures: Array<{
    id: string
    captureType: string
    formName: string | null
    campaignName: string | null
    serviceInterest: string | null
    createdAt: string
  }>
  opportunities: Array<{ id: string; title: string; stage: string; expectedValue: number; createdAt: string }>
  conversations: Array<{
    id: string
    status: string
    lastMessageAt: string | null
    channelConnection: { name: string; provider: string } | null
  }>
  consents: Array<{ channel: string; status: string; source: string | null; grantedAt: string | null; revokedAt: string | null }>
  timeline: CrmLeadTimelineEntry[]
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  DO_NOT_CONTACT: 'No contactar',
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 border-slate-200',
  DO_NOT_CONTACT: 'bg-rose-50 text-rose-700 border-rose-200',
}

const CONSENT_CHANNELS = ['EMAIL', 'WHATSAPP', 'SMS', 'CALL'] as const

export function CrmContactsClient() {
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [rows, setRows] = useState<ContactRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ContactDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newContact, setNewContact] = useState({ nombre: '', email: '', telefono: '', empresaNombre: '' })
  const [mergeSourceId, setMergeSourceId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (q) params.set('q', q)
      if (status) params.set('status', status)
      const response = await fetch(`/api/crm/contacts?${params.toString()}`, { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as
        | {
            data?: ContactRow[]
            pagination?: { total: number; totalPages: number }
            error?: string
          }
        | null
      if (!response.ok || !payload?.data) throw new Error(payload?.error || 'No se pudieron cargar los contactos')
      setRows(payload.data)
      setTotal(payload.pagination?.total ?? payload.data.length)
      setTotalPages(payload.pagination?.totalPages ?? 1)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error al cargar los contactos')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, q, status])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load()
    }, 250)
    return () => clearTimeout(timeout)
  }, [load])

  const loadDetail = useCallback(async (contactId: string) => {
    try {
      const response = await fetch(`/api/crm/contacts/${contactId}`, { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as { data?: ContactDetail; error?: string } | null
      if (!response.ok || !payload?.data) throw new Error(payload?.error || 'No se pudo cargar el contacto')
      setDetail(payload.data)
    } catch (detailError) {
      toast({
        title: 'Detalle no disponible',
        description: detailError instanceof Error ? detailError.message : 'Error desconocido',
        variant: 'destructive',
      })
    }
  }, [toast])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
    else setDetail(null)
  }, [selectedId, loadDetail])

  async function createContact() {
    if (!newContact.nombre && !newContact.email && !newContact.telefono) {
      toast({ title: 'Datos incompletos', description: 'Ingresa nombre, correo o teléfono.', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo crear el contacto')
      toast({ title: 'Contacto creado' })
      setShowCreate(false)
      setNewContact({ nombre: '', email: '', telefono: '', empresaNombre: '' })
      await load()
    } catch (createError) {
      toast({
        title: 'No se pudo crear el contacto',
        description: createError instanceof Error ? createError.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function setConsent(channel: string, status: 'GRANTED' | 'REVOKED') {
    if (!selectedId) return
    setBusy(true)
    try {
      const response = await fetch(`/api/crm/contacts/${selectedId}/consents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, status, source: 'panel-contacto' }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo registrar el consentimiento')
      toast({ title: `Consentimiento ${channel} actualizado` })
      await loadDetail(selectedId)
    } catch (consentError) {
      toast({
        title: 'Consentimiento no actualizado',
        description: consentError instanceof Error ? consentError.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  async function mergeContacts() {
    if (!selectedId || !mergeSourceId) {
      toast({ title: 'Selecciona el contacto duplicado', variant: 'destructive' })
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/crm/contacts/${selectedId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceContactId: mergeSourceId }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo fusionar')
      toast({ title: 'Contactos fusionados' })
      setMergeSourceId('')
      await load()
      await loadDetail(selectedId)
    } catch (mergeError) {
      toast({
        title: 'No se pudo fusionar',
        description: mergeError instanceof Error ? mergeError.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  const candidates = rows.filter((row) => row.id !== selectedId)


  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Contactos</h1>
          <p className="text-xs text-slate-500">{total} contactos en el directorio comercial</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Actualizar
          </Button>
          <Button size="sm" onClick={() => setShowCreate((current) => !current)}>
            <UserRoundPlus className="h-3.5 w-3.5" /> Nuevo contacto
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      ) : null}

      {showCreate ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              className="h-9 text-xs"
              placeholder="Nombre *"
              value={newContact.nombre}
              onChange={(event) => setNewContact((current) => ({ ...current, nombre: event.target.value }))}
            />
            <Input
              className="h-9 text-xs"
              placeholder="Correo"
              value={newContact.email}
              onChange={(event) => setNewContact((current) => ({ ...current, email: event.target.value }))}
            />
            <Input
              className="h-9 text-xs"
              placeholder="Teléfono"
              value={newContact.telefono}
              onChange={(event) => setNewContact((current) => ({ ...current, telefono: event.target.value }))}
            />
            <Input
              className="h-9 text-xs"
              placeholder="Empresa"
              value={newContact.empresaNombre}
              onChange={(event) => setNewContact((current) => ({ ...current, empresaNombre: event.target.value }))}
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void createContact()}>
              Crear contacto
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            className="h-9 pl-8 text-xs"
            placeholder="Buscar por nombre, empresa, correo o documento…"
            value={q}
            onChange={(event) => {
              setQ(event.target.value)
              setPage(1)
            }}
          />
        </div>
        <select
          className="h-9 rounded-md border border-slate-200 px-2.5 text-xs"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activo</option>
          <option value="INACTIVE">Inactivo</option>
          <option value="DO_NOT_CONTACT">No contactar</option>
        </select>
      </div>


      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Contacto</th>
                  <th className="px-3 py-2.5 font-semibold">Empresa</th>
                  <th className="px-3 py-2.5 font-semibold">Estado</th>
                  <th className="px-3 py-2.5 font-semibold">Leads</th>
                  <th className="px-3 py-2.5 font-semibold">Responsable</th>
                  <th className="px-3 py-2.5 font-semibold">Última interacción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                      Cargando contactos…
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={cn(
                        'cursor-pointer transition hover:bg-slate-50',
                        selectedId === row.id ? 'bg-sky-50/60' : ''
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-900">
                          {[row.nombre, row.apellido].filter(Boolean).join(' ')}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {row.email || row.telefono || row.celular || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{row.empresaNombre || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                            STATUS_STYLES[row.status]
                          )}
                        >
                          {STATUS_LABELS[row.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{row._count.leads}</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {row.ownerUser ? row.ownerUser.name || row.ownerUser.email : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{formatRelativeDate(row.lastInteractionAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                      No hay contactos con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span>
              Página {page} de {totalPages} · {total} contactos
            </span>
            <div className="flex items-center gap-2">
              <select
                className="h-8 rounded-md border border-slate-200 px-2 text-[11px]"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
              >
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} por página
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>


        <aside className="w-full shrink-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm xl:w-[380px]">
          {!selectedId ? (
            <p className="py-8 text-center text-xs text-slate-500">
              Selecciona un contacto para ver su ficha, consentimientos e historial.
            </p>
          ) : !detail ? (
            <p className="py-8 text-center text-xs text-slate-400">Cargando contacto…</p>
          ) : (
            <>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ficha del contacto</p>
                <h2 className="text-base font-semibold text-slate-900">
                  {[detail.nombre, detail.apellido].filter(Boolean).join(' ')}
                </h2>
                <p className="text-xs text-slate-500">{detail.empresaNombre || '—'}</p>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-500">
                  {detail.email ? <span className="rounded bg-slate-100 px-1.5 py-0.5">{detail.email}</span> : null}
                  {detail.celular || detail.telefono ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">{detail.celular || detail.telefono}</span>
                  ) : null}
                  {detail.documento ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">{detail.documento}</span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <p className="font-semibold text-slate-700">Consentimientos</p>
                <div className="mt-2 space-y-1.5">
                  {CONSENT_CHANNELS.map((channel) => {
                    const consent = detail.consents.find((item) => item.channel === channel)
                    const statusValue = consent?.status ?? 'UNKNOWN'
                    return (
                      <div key={channel} className="flex items-center justify-between gap-2">
                        <span className="text-slate-600">{channel}</span>
                        <div className="flex items-center gap-1">
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                              statusValue === 'GRANTED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : statusValue === 'REVOKED'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-slate-100 text-slate-500'
                            )}
                          >
                            {statusValue}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void setConsent(channel, 'GRANTED')}
                          >
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void setConsent(channel, 'REVOKED')}
                          >
                            Revocar
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <p className="font-semibold text-slate-700">Leads ({detail.leads.length})</p>
                <ul className="mt-1.5 space-y-1">
                  {detail.leads.slice(0, 5).map((lead) => (
                    <li key={lead.id} className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">{lead.nombre}</span>
                      <span className="text-[10px] text-slate-400">
                        {lead.lifecycleStatus} · {lead.score}
                      </span>
                    </li>
                  ))}
                  {!detail.leads.length ? <li className="text-slate-400">Sin leads vinculados.</li> : null}
                </ul>
              </div>


              <div className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <p className="font-semibold text-slate-700">Fusionar duplicado</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Mueve los registros del contacto seleccionado hacia este contacto canónico.
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <select
                    className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-[11px]"
                    value={mergeSourceId}
                    onChange={(event) => setMergeSourceId(event.target.value)}
                  >
                    <option value="">Selecciona el duplicado…</option>
                    {candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {[candidate.nombre, candidate.apellido].filter(Boolean).join(' ')}
                        {candidate.email ? ` · ${candidate.email}` : ''}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !mergeSourceId}
                    onClick={() => void mergeContacts()}
                  >
                    Fusionar
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-2.5">
                <p className="text-xs font-semibold text-slate-700">Historial</p>
                <CrmLeadTimeline entries={detail.timeline} className="mt-2" />
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

