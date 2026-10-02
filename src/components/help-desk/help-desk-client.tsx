'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Clock3, FileText, History, Inbox, Loader2, MessageSquare, Paperclip, Plus, Search, SendHorizontal, ShieldCheck, Ticket, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { uploadFileWithProgress } from '@/lib/upload-file-with-progress'
import { cn } from '@/lib/utils'

type UserSummary = { id: string; name?: string | null; email: string; image?: string | null }
type ClientSummary = { id: string; nombre: string; documento: string }
type Attachment = { name: string; url: string; type: 'image' | 'document'; mimeType?: string | null; sizeBytes?: number | null }
type TicketStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'ESCALATED' | 'RESOLVED' | 'CLOSED' | 'CANCELED'
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type TicketMessage = { id: string; visibility: 'PUBLIC' | 'INTERNAL'; bodyText: string; attachmentsJson: Attachment[]; createdAt: string; author: UserSummary }
type TicketActivity = { id: string; type: string; summary: string; createdAt: string; actor?: UserSummary | null }
type HelpTicket = {
  id: string
  number: string
  subject: string
  description: string
  category: string
  module?: string | null
  submodule?: string | null
  type: string
  priority: TicketPriority
  status: TicketStatus
  channel: string
  requesterId: string
  requester: UserSummary
  assignedToId?: string | null
  assignedTo?: UserSummary | null
  cliente?: ClientSummary | null
  createdAt: string
  updatedAt: string
  firstResponseAt?: string | null
  resolvedAt?: string | null
  messages?: TicketMessage[]
  activities?: TicketActivity[]
  _count?: { messages: number; activities: number }
}

type ApiResponse<T> = { success?: boolean; data?: T; error?: string; meta?: Record<string, unknown> }

const MODULE_LABELS: Record<string, string> = {
  DASHBOARD: 'Dashboard',
  COTIZADOR: 'Cotizador',
  COTIZACIONES: 'Cotizaciones',
  CLIENTES: 'Clientes',
  CRM: 'CRM',
  MATERIALES: 'Catálogo y materiales',
  INVENTARIO: 'Inventario',
  REMISIONES: 'Remisiones',
  POS: 'Facturación POS',
  PROVEEDORES: 'Proveedores',
  COMPRAS: 'Compras',
  ORDENES: 'Órdenes y operaciones',
  ESCANEOS: 'Escaneos',
  REPORTES: 'Reportes e inteligencia',
  CONTABILIDAD: 'Contabilidad y nómina',
  NOTIFICACIONES: 'Notificaciones',
  CONFIG: 'Configuración',
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'Nuevo', ASSIGNED: 'Asignado', IN_PROGRESS: 'En atención', WAITING_CUSTOMER: 'Esperando cliente',
  ESCALATED: 'Escalado', RESOLVED: 'Resuelto', CLOSED: 'Cerrado', CANCELED: 'Cancelado',
}
const PRIORITY_LABELS: Record<TicketPriority, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' }
const STATUSES = Object.keys(STATUS_LABELS) as TicketStatus[]
const PRIORITIES = Object.keys(PRIORITY_LABELS) as TicketPriority[]

function statusClass(status: TicketStatus) {
  return ({
    NEW: 'bg-sky-50 text-sky-700 border-sky-200', ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    IN_PROGRESS: 'bg-amber-50 text-amber-800 border-amber-200', WAITING_CUSTOMER: 'bg-orange-50 text-orange-800 border-orange-200',
    ESCALATED: 'bg-rose-50 text-rose-700 border-rose-200', RESOLVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CLOSED: 'bg-slate-100 text-slate-700 border-slate-200', CANCELED: 'bg-slate-100 text-slate-500 border-slate-200',
  })[status]
}

function priorityClass(priority: TicketPriority) {
  return ({ LOW: 'text-slate-500', MEDIUM: 'text-sky-700', HIGH: 'text-orange-700', CRITICAL: 'text-rose-700' })[priority]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const json = (await response.json().catch(() => ({}))) as ApiResponse<T>
  if (!response.ok || !json.success) throw new Error(json.error || 'No se pudo completar la solicitud.')
  return json
}

export function HelpDeskClient() {
  const [tickets, setTickets] = useState<HelpTicket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<HelpTicket | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [users, setUsers] = useState<UserSummary[]>([])
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [availableModules, setAvailableModules] = useState<Array<{ key: string; label: string }>>([])
  const [canManageAll, setCanManageAll] = useState(false)
  const [canManageSelected, setCanManageSelected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [sending, setSending] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState('')
  const [internalNote, setInternalNote] = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([])
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [detailTab, setDetailTab] = useState<'conversation' | 'history'>('conversation')
  const [form, setForm] = useState({ subject: '', description: '', category: 'Soporte general', module: '', submodule: '', priority: 'MEDIUM', type: 'REQUEST', clienteId: '' })

  async function loadTickets(preferredId?: string | null) {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (statusFilter) params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)
      const json = await requestJson<HelpTicket[]>(`/api/help-tickets?${params}`)
      setTickets(json.data ?? [])
      const meta = json.meta ?? {}
      setCounts((meta.counts as Record<string, number>) ?? {})
      setCanManageAll(Boolean(meta.canManageAll))
      const nextId = preferredId ?? selectedId
      if (nextId && (json.data ?? []).some((ticket) => ticket.id === nextId)) setSelectedId(nextId)
      else if (!selectedId) setSelectedId(json.data?.[0]?.id ?? null)
      else if (!(json.data ?? []).some((ticket) => ticket.id === selectedId)) setSelectedId(json.data?.[0]?.id ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los tickets.')
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true)
    try {
      const json = await requestJson<HelpTicket>(`/api/help-tickets/${id}`)
      setSelectedTicket(json.data ?? null)
      setCanManageSelected(Boolean(json.meta?.canManage))
      setInternalNote(false)
      setPendingAttachments([])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el ticket.')
    } finally {
      setDetailLoading(false)
    }
  }

  // La búsqueda se ejecuta al enviar; estos dos filtros recargan de inmediato.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadTickets() }, [statusFilter, priorityFilter])
  useEffect(() => { if (selectedId) void loadDetail(selectedId); else setSelectedTicket(null) }, [selectedId])
  useEffect(() => {
    void requestJson<{ users: UserSummary[]; clients: ClientSummary[] }>('/api/help-tickets/meta')
      .then((json) => { setUsers(json.data?.users ?? []); setClients(json.data?.clients ?? []) })
      .catch(() => null)
    void fetch('/api/modules/enabled')
      .then((response) => response.json())
      .then((json: { ok?: boolean; enabled?: string[] }) => {
        if (!json.ok || !Array.isArray(json.enabled)) return
        setAvailableModules(json.enabled.map((key) => ({ key, label: MODULE_LABELS[key] ?? key })).sort((left, right) => left.label.localeCompare(right.label, 'es')))
      })
      .catch(() => null)
  }, [])

  async function createTicket(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const json = await requestJson<HelpTicket>('/api/help-tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      setCreateOpen(false)
      setForm({ subject: '', description: '', category: 'Soporte general', module: '', submodule: '', priority: 'MEDIUM', type: 'REQUEST', clienteId: '' })
      setSelectedId(json.data?.id ?? null)
      await loadTickets(json.data?.id)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el ticket.')
    } finally {
      setCreating(false)
    }
  }

  async function updateTicket(patch: Record<string, unknown>) {
    if (!selectedTicket) return
    setUpdating(true)
    try {
      await requestJson<HelpTicket>(`/api/help-tickets/${selectedTicket.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      await Promise.all([loadDetail(selectedTicket.id), loadTickets(selectedTicket.id)])
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar el ticket.')
    } finally {
      setUpdating(false)
    }
  }

  async function uploadAttachment(file: File) {
    if (!selectedTicket) return
    setUploadProgress(0)
    try {
      const result = await uploadFileWithProgress<Attachment>({ url: `/api/help-tickets/${selectedTicket.id}/attachments`, file, onProgress: setUploadProgress })
      if (!result.success || !result.data) throw new Error(result.error || 'No se pudo subir el archivo.')
      setPendingAttachments((current) => [...current, result.data as Attachment].slice(0, 8))
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudo subir el archivo.')
    } finally {
      setUploadProgress(null)
    }
  }

  async function sendMessage() {
    if (!selectedTicket || (!message.trim() && !pendingAttachments.length)) return
    setSending(true)
    try {
      await requestJson(`/api/help-tickets/${selectedTicket.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bodyText: message, visibility: internalNote ? 'INTERNAL' : 'PUBLIC', attachments: pendingAttachments }) })
      setMessage('')
      setPendingAttachments([])
      await Promise.all([loadDetail(selectedTicket.id), loadTickets(selectedTicket.id)])
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'No se pudo enviar el mensaje.')
    } finally {
      setSending(false)
    }
  }

  const openCount = (counts.NEW ?? 0) + (counts.ASSIGNED ?? 0) + (counts.IN_PROGRESS ?? 0) + (counts.ESCALATED ?? 0)

  return (
    <div className="min-h-full bg-[#f5f6f8] pb-10 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e57f00]">Operaciones</p>
            <h1 className="text-xl font-semibold">Mesa de Ayuda</h1>
            <p className="mt-0.5 text-sm text-slate-500">Solicitudes, incidencias y soporte con trazabilidad completa.</p>
          </div>
          <Button className="h-9 bg-[#ff9800] px-4 text-white hover:bg-[#e68900]" onClick={() => setCreateOpen(true)}><Plus /> Crear solicitud</Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 p-3 sm:p-5">
        {error ? <div className="flex items-center justify-between gap-3 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"><span>{error}</span><button onClick={() => setError(null)} className="font-semibold">Cerrar</button></div> : null}

        <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { label: 'Abiertos', value: openCount, icon: Inbox, tone: 'text-sky-700 bg-sky-50' },
            { label: 'En atención', value: counts.IN_PROGRESS ?? 0, icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
            { label: 'Esperando', value: counts.WAITING_CUSTOMER ?? 0, icon: UserRound, tone: 'text-orange-700 bg-orange-50' },
            { label: 'Resueltos', value: counts.RESOLVED ?? 0, icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
          ].map((stat) => <div key={stat.label} className="flex items-center gap-3 border border-slate-200 bg-white p-3"><span className={cn('flex h-9 w-9 items-center justify-center rounded-md', stat.tone)}><stat.icon className="h-4 w-4" /></span><div><p className="text-2xl font-semibold leading-none">{stat.value}</p><p className="mt-1 text-xs text-slate-500">{stat.label}</p></div></div>)}
        </section>

        <section className="grid min-h-[660px] overflow-hidden border border-slate-200 bg-white lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="flex min-h-[500px] flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="space-y-2 border-b border-slate-200 p-3">
              <form className="relative" onSubmit={(event) => { event.preventDefault(); void loadTickets() }}><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ticket, asunto o módulo" className="h-9 pl-9" /></form>
              <div className="grid grid-cols-2 gap-2">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="">Todos los estados</option>{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
                <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="">Toda prioridad</option>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}</select>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? <div className="flex items-center justify-center p-10 text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando</div> : tickets.length ? tickets.map((ticket) => (
                <button key={ticket.id} onClick={() => setSelectedId(ticket.id)} className={cn('w-full border-b border-slate-100 px-3 py-3 text-left transition hover:bg-slate-50', selectedId === ticket.id && 'border-l-[3px] border-l-[#ff9800] bg-orange-50/50')}>
                  <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-slate-500">{ticket.number}</span><span className={cn('border px-1.5 py-0.5 text-[10px] font-medium', statusClass(ticket.status))}>{STATUS_LABELS[ticket.status]}</span></div>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold">{ticket.subject}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500"><span className={cn('font-semibold', priorityClass(ticket.priority))}>{PRIORITY_LABELS[ticket.priority]}</span><span className="truncate">{ticket.assignedTo?.name || 'Sin asignar'}</span><span>{ticket._count?.messages ?? 0} msg</span></div>
                </button>
              )) : <div className="p-8 text-center text-sm text-slate-500"><Ticket className="mx-auto mb-2 h-7 w-7" />No hay tickets con estos filtros.</div>}
            </div>
          </aside>

          <div className="min-w-0">
            {detailLoading ? <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando ticket</div> : selectedTicket ? (
              <div className="flex h-full min-h-[660px] flex-col">
                <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-slate-500">{selectedTicket.number}</span><span className={cn('border px-2 py-0.5 text-[10px] font-medium', statusClass(selectedTicket.status))}>{STATUS_LABELS[selectedTicket.status]}</span></div><h2 className="mt-1 text-lg font-semibold">{selectedTicket.subject}</h2><p className="mt-1 text-xs text-slate-500">Creado por {selectedTicket.requester.name || selectedTicket.requester.email} · {formatDate(selectedTicket.createdAt)}</p></div><span className={cn('text-xs font-semibold', priorityClass(selectedTicket.priority))}>{PRIORITY_LABELS[selectedTicket.priority]}</span></div>
                  {canManageSelected ? <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <select disabled={updating} value={selectedTicket.status} onChange={(event) => void updateTicket({ status: event.target.value })} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs">{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
                    <select disabled={updating} value={selectedTicket.priority} onChange={(event) => void updateTicket({ priority: event.target.value })} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs">{PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}</select>
                    <select disabled={updating || !canManageAll} value={selectedTicket.assignedToId || ''} onChange={(event) => void updateTicket({ assignedToId: event.target.value || null })} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs"><option value="">Sin responsable</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select>
                  </div> : null}
                </div>

                <div className="grid border-b border-slate-200 sm:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="p-4 sm:p-5"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedTicket.description}</p></div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-1 sm:border-l sm:border-t-0"><div><dt className="text-slate-500">Categoría</dt><dd className="font-medium">{selectedTicket.category}</dd></div><div><dt className="text-slate-500">Módulo</dt><dd className="font-medium">{selectedTicket.module || 'General'}</dd></div><div><dt className="text-slate-500">Cliente</dt><dd className="font-medium">{selectedTicket.cliente?.nombre || 'No asociado'}</dd></div><div><dt className="text-slate-500">Canal</dt><dd className="font-medium">{selectedTicket.channel}</dd></div></dl>
                </div>

                <div className="flex border-b border-slate-200 px-4"><button onClick={() => setDetailTab('conversation')} className={cn('flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold', detailTab === 'conversation' ? 'border-[#ff9800] text-slate-950' : 'border-transparent text-slate-500')}><MessageSquare className="h-3.5 w-3.5" /> Conversación</button><button onClick={() => setDetailTab('history')} className={cn('flex items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold', detailTab === 'history' ? 'border-[#ff9800] text-slate-950' : 'border-transparent text-slate-500')}><History className="h-3.5 w-3.5" /> Historial</button></div>

                {detailTab === 'conversation' ? <><div className="min-h-[240px] flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4 sm:p-5">
                  {(selectedTicket.messages ?? []).length ? selectedTicket.messages?.map((item) => <div key={item.id} className={cn('max-w-[88%] border p-3 text-sm shadow-sm', item.author.id === selectedTicket.requesterId ? 'mr-auto border-slate-200 bg-white' : 'ml-auto', item.visibility === 'INTERNAL' ? 'border-amber-200 bg-amber-50' : item.author.id !== selectedTicket.requesterId ? 'border-sky-200 bg-sky-50' : '')}><div className="mb-1 flex items-center justify-between gap-4 text-[10px] text-slate-500"><span className="font-semibold">{item.author.name || item.author.email}{item.visibility === 'INTERNAL' ? ' · Nota interna' : ''}</span><span>{formatDate(item.createdAt)}</span></div><p className="whitespace-pre-wrap leading-5">{item.bodyText}</p>{item.attachmentsJson?.length ? <div className="mt-2 space-y-1">{item.attachmentsJson.map((attachment) => <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 border border-slate-200 bg-white px-2 py-1.5 text-xs text-sky-700"><FileText className="h-3.5 w-3.5" />{attachment.name}</a>)}</div> : null}</div>) : <div className="py-10 text-center text-sm text-slate-500">Aún no hay respuestas.</div>}
                </div>
                {!['CLOSED', 'CANCELED'].includes(selectedTicket.status) ? <div className="border-t border-slate-200 bg-white p-3 sm:p-4">{canManageSelected ? <label className="mb-2 inline-flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={internalNote} onChange={(event) => setInternalNote(event.target.checked)} /> Nota interna (el solicitante no la verá)</label> : null}<Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={internalNote ? 'Escribe una nota para el equipo...' : 'Escribe una respuesta...'} className={cn('min-h-20', internalNote && 'border-amber-300 bg-amber-50')} />{pendingAttachments.length ? <div className="mt-2 flex flex-wrap gap-2">{pendingAttachments.map((attachment) => <span key={attachment.url} className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs">{attachment.name}</span>)}</div> : null}<div className="mt-2 flex items-center justify-between"><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600"><Paperclip className="h-4 w-4" />{uploadProgress === null ? 'Adjuntar' : `Subiendo ${uploadProgress}%`}<input type="file" className="hidden" disabled={uploadProgress !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAttachment(file); event.currentTarget.value = '' }} /></label><Button disabled={sending || (!message.trim() && !pendingAttachments.length)} onClick={() => void sendMessage()} className={cn('h-8', internalNote ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#ff9800] hover:bg-[#e68900]')}><SendHorizontal /> {sending ? 'Enviando' : internalNote ? 'Guardar nota' : 'Responder'}</Button></div></div> : null}</> : <div className="min-h-[320px] flex-1 overflow-y-auto p-4 sm:p-5"><div className="border-l border-slate-200 pl-5">{selectedTicket.activities?.map((activity) => <div key={activity.id} className="relative pb-5"><span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#ff9800] ring-1 ring-slate-200" /><p className="text-sm font-medium">{activity.summary}</p><p className="mt-0.5 text-xs text-slate-500">{activity.actor?.name || activity.actor?.email || 'Sistema'} · {formatDate(activity.createdAt)}</p></div>)}</div></div>}
              </div>
            ) : <div className="flex min-h-[500px] flex-col items-center justify-center text-center text-slate-500"><ShieldCheck className="mb-3 h-10 w-10 text-slate-300" /><p className="font-medium text-slate-700">Selecciona un ticket</p><p className="text-sm">Aquí verás su conversación e historial.</p></div>}
          </div>
        </section>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><form onSubmit={createTicket}><DialogHeader><DialogTitle>Nueva solicitud</DialogTitle><DialogDescription>Describe el problema o requerimiento con el contexto necesario para atenderlo.</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid gap-2"><Label>Asunto</Label><Input required value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Ej. No permite modificar cantidades" /></div><div className="grid gap-2"><Label>Descripción</Label><Textarea required className="min-h-32" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Indica qué intentabas hacer, qué ocurrió y qué esperabas." /></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>Categoría</Label><Input required value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} /></div><div className="grid gap-2"><Label>Módulo</Label><select value={form.module} onChange={(event) => setForm((current) => ({ ...current, module: event.target.value }))} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">Selecciona un módulo</option>{availableModules.map((module) => <option key={module.key} value={module.label}>{module.label}</option>)}</select></div><div className="grid gap-2"><Label>Prioridad</Label><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm">{PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}</select></div><div className="grid gap-2"><Label>Tipo</Label><select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="REQUEST">Solicitud</option><option value="INCIDENT">Incidente</option><option value="QUESTION">Pregunta</option><option value="IMPROVEMENT">Mejora</option><option value="INTERNAL">Interno</option><option value="TECHNICAL_SUPPORT">Soporte técnico</option></select></div>{canManageAll && clients.length ? <div className="grid gap-2 sm:col-span-2"><Label>Cliente relacionado (opcional)</Label><select value={form.clienteId} onChange={(event) => setForm((current) => ({ ...current, clienteId: event.target.value }))} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">Sin cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.nombre} · {client.documento}</option>)}</select></div> : null}</div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button type="submit" disabled={creating} className="bg-[#ff9800] text-white hover:bg-[#e68900]">{creating ? <Loader2 className="animate-spin" /> : <Plus />} Crear ticket</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  )
}
