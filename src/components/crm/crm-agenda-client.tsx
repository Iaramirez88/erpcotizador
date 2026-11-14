"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Bot,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  GripVertical,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  PhoneCall,
  Plus,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { CrmNegotiationsPageHeader } from '@/components/crm/crm-negotiations-page-header'
import { ORIGIN_BRAND_LOGOS } from '@/components/crm/crm-brand-logos'
import { CrmNegotiationsTabs } from '@/components/crm/crm-negotiations-tabs'
import { CardInfoHeader } from '@/components/ui/card-info-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { subscribeToNotificationReceivedEvent } from '@/lib/notification-browser-events'
import { type CrmOriginKey, getCrmOriginMeta } from '@/lib/crm-origin'
import { CRM_AGENDA_CALENDAR_COLORS, CRM_AGENDA_CALENDAR_KINDS, type CrmAgendaCalendarKind } from '@/lib/crm-agenda-calendars'

const TASK_AUTO_REFRESH_MS = 15_000

type TaskStatus = 'OPEN' | 'DONE' | 'CANCELED'
type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH'
type AgendaViewMode = 'month' | 'week' | 'day' | 'quarter' | 'semester' | 'year'
type AgendaLayoutMode = 'calendar' | 'cards' | 'events'
type AgendaStatusFilter = 'ALL' | 'OPEN' | 'CLOSED'

const AGENDA_VIEW_OPTIONS: Array<{ value: AgendaViewMode; label: string }> = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'semester', label: 'Semestre' },
  { value: 'year', label: 'Anual' },
]

const AGENDA_LAYOUT_OPTIONS: Array<{ value: AgendaLayoutMode; label: string; hint: string }> = [
  { value: 'calendar', label: 'Calendario', hint: 'Event-Based: días, semanas, meses y horas.' },
  { value: 'cards', label: 'Tarjetas', hint: 'Task-Based: tablero tipo kanban por estado.' },
  { value: 'events', label: 'Agenda', hint: 'Lista cronológica de reuniones y tareas.' },
]

const AGENDA_STATUS_OPTIONS: Array<{ value: AgendaStatusFilter; label: string }> = [
  { value: 'OPEN', label: 'Abiertas' },
  { value: 'CLOSED', label: 'Cerradas' },
  { value: 'ALL', label: 'Todas' },
]

type AgendaPanelSection = 'calendars' | 'new' | 'leads' | 'clients' | 'day' | 'history'

type QuickActionKey = 'meeting' | 'booking' | 'client-appointment' | 'project' | 'follow-up' | 'internal-task'

type AgendaQuickAction = {
  key: QuickActionKey
  label: string
  description: string
  title: string
  priority: TaskPriority
  calendarKind: CrmAgendaCalendarKind
  icon: typeof Users
}

const AGENDA_QUICK_ACTIONS: AgendaQuickAction[] = [
  {
    key: 'meeting',
    label: 'Nueva reunión con prospecto',
    description: 'Agenda una reunión comercial y define hora y responsable.',
    title: 'Reunión con prospecto',
    priority: 'HIGH',
    calendarKind: 'PROSPECT_MEETINGS',
    icon: Users,
  },
  {
    key: 'booking',
    label: 'Nuevo agendamiento',
    description: 'Reserva una franja para una cita o asesoría.',
    title: 'Agendamiento de cita',
    priority: 'HIGH',
    calendarKind: 'PROSPECT_MEETINGS',
    icon: CalendarClock,
  },
  {
    key: 'client-appointment',
    label: 'Nueva cita de cliente',
    description: 'Programa una visita, entrega o servicio con un cliente.',
    title: 'Cita con cliente',
    priority: 'NORMAL',
    calendarKind: 'GENERAL',
    icon: CalendarCheck2,
  },
  {
    key: 'project',
    label: 'Nuevo hito de proyecto',
    description: 'Bloquea una entrega o revisión de proyecto.',
    title: 'Hito de proyecto',
    priority: 'NORMAL',
    calendarKind: 'PROJECTS',
    icon: FolderKanban,
  },
  {
    key: 'follow-up',
    label: 'Seguimiento comercial',
    description: 'Programa una llamada o mensaje de seguimiento.',
    title: 'Seguimiento comercial',
    priority: 'NORMAL',
    calendarKind: 'PROSPECT_MEETINGS',
    icon: PhoneCall,
  },
  {
    key: 'internal-task',
    label: 'Tarea interna',
    description: 'Pendiente del equipo sin cliente asociado.',
    title: 'Tarea interna',
    priority: 'LOW',
    calendarKind: 'TASKS',
    icon: CheckSquare,
  },
]

const AGENDA_SPLIT_OPTIONS = [25, 33, 50, 66, 75, 100] as const
const AGENDA_SPLIT_STORAGE_KEY = 'crm-agenda-split-percent'
const AGENDA_PANEL_STORAGE_KEY = 'crm-agenda-panel-open'

function snapAgendaSplit(value: number) {
  const clamped = Math.min(100, Math.max(AGENDA_SPLIT_OPTIONS[0], value))
  if (clamped >= 82) return 100
  return AGENDA_SPLIT_OPTIONS.reduce((closest, option) => (
    Math.abs(option - clamped) < Math.abs(closest - clamped) ? option : closest
  ), 66)
}

function getCalendarKindLabel(kind: string | null | undefined) {
  return CRM_AGENDA_CALENDAR_KINDS.find((item) => item.value === kind)?.label ?? 'Agenda general'
}

function hexToSoftBackground(colorHex: string) {
  return `${colorHex}1a`
}

type Task = {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  originKey?: CrmOriginKey | null
  originLabel?: string | null
  dueAt?: string | null
  calendarId?: string | null
  calendar?: { id: string; name: string; colorHex: string; kind: string } | null
  assignedTo?: { id: string; name?: string | null; email?: string | null } | null
  lead?: { id: string; nombre: string; source?: string | null; originKey?: CrmOriginKey | null; originLabel?: string | null } | null
  cliente?: { id: string; nombre: string; documento: string } | null
}

type AgendaCalendarMember = {
  id: string
  userId: string
  role: string
  user?: { id: string; name?: string | null; email?: string | null } | null
}

type AgendaCalendar = {
  id: string
  name: string
  description?: string | null
  colorHex: string
  kind: string
  visibility: string
  ownerUserId?: string | null
  createdById: string
  canManage?: boolean
  role?: string | null
  members: AgendaCalendarMember[]
  _count?: { tasks: number }
}

type LeadOption = { id: string; nombre: string; empresaNombre?: string | null; email?: string | null; telefono?: string | null; source?: string | null; originKey?: CrmOriginKey | null; originLabel?: string | null }
type ClienteOption = { id: string; nombre: string; documento: string; email?: string | null; telefono?: string | null }
type Assignee = { id: string; name?: string | null; email?: string | null }
type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

type TaskFormState = {
  title: string
  description: string
  priority: TaskPriority
  dueAt: string
  relationType: 'lead' | 'cliente'
  relationId: string
  assignedToUserId: string
  calendarId: string
}

type CalendarFormState = {
  name: string
  kind: CrmAgendaCalendarKind
  colorHex: string
  visibility: 'TEAM' | 'PRIVATE'
  description: string
  memberUserIds: string[]
}

type Props = {
  canAccessAnyChat?: boolean
}

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function toDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(value)
}

function addDaysToDate(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeekDate(value: Date) {
  const next = new Date(value.getFullYear(), value.getMonth(), value.getDate())
  const weekday = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - weekday)
  return next
}

function formatTimeOfDay(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function toLocalDateKey(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

function rangePreset(days: number) {
  const start = new Date()
  const end = addDaysToDate(start, days)
  return { from: toDateKey(start), to: toDateKey(end) }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const response = await fetch(url, init)
  return (await response.json().catch(() => ({}))) as JsonResponse<T>
}

function getOriginTone(originKey: CrmOriginKey) {
  if (originKey === 'EMAIL_GMAIL' || originKey === 'EMAIL_OUTLOOK') return 'bg-amber-100 text-amber-800'
  if (originKey === 'CHATBOT_WEB') return 'bg-emerald-100 text-emerald-800'
  if (originKey === 'FORM_WEB') return 'bg-sky-100 text-sky-800'
  if (originKey === 'WHATSAPP') return 'bg-green-100 text-green-800'
  if (originKey === 'LEAD_TIKTOK' || originKey === 'LEAD_YOUTUBE' || originKey === 'MESSENGER_FACEBOOK' || originKey === 'INSTAGRAM_DM') return 'bg-fuchsia-100 text-fuchsia-800'
  if (originKey === 'PHONE_CALL') return 'bg-orange-100 text-orange-800'
  if (originKey === 'REFERRAL') return 'bg-violet-100 text-violet-800'
  if (originKey === 'IMPORT') return 'bg-slate-200 text-slate-800'
  return 'bg-slate-100 text-slate-700'
}

function OriginBadge({ originKey, label }: { originKey: CrmOriginKey; label: string }) {
  const BrandLogo = ORIGIN_BRAND_LOGOS[originKey]
  const Icon = BrandLogo ?? (originKey === 'FORM_WEB'
    ? FileText
    : originKey === 'CHATBOT_WEB'
      ? Bot
      : originKey === 'PHONE_CALL'
        ? PhoneCall
        : MessageCircle)

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getOriginTone(originKey)}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

function AgendaTaskForm({
  taskForm,
  setTaskForm,
  leadOptions,
  clientOptions,
  assignees,
  calendars,
  saving,
  onSubmit,
  onCreateCalendar,
  compact = false,
}: {
  taskForm: TaskFormState
  setTaskForm: React.Dispatch<React.SetStateAction<TaskFormState>>
  leadOptions: LeadOption[]
  clientOptions: ClienteOption[]
  assignees: Assignee[]
  calendars: AgendaCalendar[]
  saving: boolean
  onSubmit: () => void
  onCreateCalendar?: () => void
  compact?: boolean
}) {
  const selectedCalendar = calendars.find((calendar) => calendar.id === taskForm.calendarId) ?? null
  const twoColumnGrid = compact ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Label>Título</Label>
        <Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ej. Llamada de seguimiento" />
      </div>
      <div className="grid gap-1.5">
        <Label>Descripción</Label>
        <Textarea value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} rows={2} placeholder="Detalles de la gestión comercial o reunión." />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Calendario</Label>
          {onCreateCalendar ? (
            <button
              type="button"
              onClick={onCreateCalendar}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900"
            >
              <Plus className="h-3 w-3" /> Nuevo calendario
            </button>
          ) : null}
        </div>
        <Select value={taskForm.calendarId || '__none__'} onValueChange={(value) => setTaskForm((current) => ({ ...current, calendarId: value === '__none__' ? '' : value }))}>
          <SelectTrigger><SelectValue placeholder="Selecciona un calendario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin calendario</SelectItem>
            {calendars.map((calendar) => {
              const writable = calendar.canManage || calendar.visibility !== 'PRIVATE'
              return (
                <SelectItem key={calendar.id} value={calendar.id} disabled={!writable}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: calendar.colorHex }} />
                    {calendar.name}{writable ? '' : ' (solo lectura)'}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-slate-500">
          {selectedCalendar ? getCalendarKindLabel(selectedCalendar.kind) : 'Sin calendario: la tarea queda en la agenda general.'}
        </p>
      </div>
      <div className={twoColumnGrid}>
        <div className="grid gap-1.5">
          <Label>Tipo de relación</Label>
          <Select value={taskForm.relationType} onValueChange={(value) => setTaskForm((current) => ({ ...current, relationType: value as 'lead' | 'cliente', relationId: '' }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">Prospecto</SelectItem>
              <SelectItem value="cliente">Cliente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Prioridad</Label>
          <Select value={taskForm.priority} onValueChange={(value) => setTaskForm((current) => ({ ...current, priority: value as TaskPriority }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Baja</SelectItem>
              <SelectItem value="NORMAL">Normal</SelectItem>
              <SelectItem value="HIGH">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className={twoColumnGrid}>
        <div className="grid gap-1.5">
          <Label>Fecha y hora</Label>
          <Input type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))} />
        </div>
        <div className="grid gap-1.5">
          <Label>Responsable</Label>
          <Select value={taskForm.assignedToUserId || '__none__'} onValueChange={(value) => setTaskForm((current) => ({ ...current, assignedToUserId: value === '__none__' ? '' : value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sin asignar</SelectItem>
              {assignees.map((assignee) => <SelectItem key={assignee.id} value={assignee.id}>{assignee.name || assignee.email || assignee.id}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>{taskForm.relationType === 'lead' ? 'Prospecto seleccionado' : 'Cliente seleccionado'}</Label>
        <Select value={taskForm.relationId || '__none__'} onValueChange={(value) => setTaskForm((current) => ({ ...current, relationId: value === '__none__' ? '' : value }))}>
          <SelectTrigger><SelectValue placeholder="Selecciona un registro" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin selección</SelectItem>
            {(taskForm.relationType === 'lead' ? leadOptions : clientOptions).map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button className="w-full rounded-lg" onClick={onSubmit} disabled={saving}>
        {saving ? 'Guardando...' : 'Agregar a la agenda'}
      </Button>
    </div>
  )
}

function AgendaAccordion({
  title,
  helper,
  count,
  open,
  onToggle,
  actions,
  children,
}: {
  title: string
  helper?: string
  count?: number
  open: boolean
  onToggle: () => void
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_34px_-30px_rgba(15,23,42,0.45)]">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900">{title}</span>
              {typeof count === 'number' ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{count}</span>
              ) : null}
            </span>
            {helper ? <span className="mt-0.5 block truncate text-[11px] text-slate-500">{helper}</span> : null}
          </span>
        </button>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {open ? <div className="space-y-3 border-t border-slate-100 px-3 py-3">{children}</div> : null}
    </section>
  )
}

export function CrmAgendaClient({ canAccessAnyChat }: Props) {
  const searchParams = useSearchParams()
  const today = useMemo(() => new Date(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [agendaDialogOpen, setAgendaDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(toDateKey(today))
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [agendaView, setAgendaView] = useState<AgendaViewMode>('month')
  const [agendaLayout, setAgendaLayout] = useState<AgendaLayoutMode>('calendar')
  const [statusFilter, setStatusFilter] = useState<AgendaStatusFilter>('ALL')
  const [searchFilter, setSearchFilter] = useState('')
  const [rangeFrom, setRangeFrom] = useState(() => toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [rangeTo, setRangeTo] = useState(() => toDateKey(new Date(today.getFullYear(), today.getMonth() + 1, 0)))
  const [tasks, setTasks] = useState<Task[]>([])
  const [leadSearch, setLeadSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([])
  const [clientOptions, setClientOptions] = useState<ClienteOption[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [calendars, setCalendars] = useState<AgendaCalendar[]>([])
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([])
  const [panelOpen, setPanelOpen] = useState(true)
  const [splitPercent, setSplitPercent] = useState(66)
  const [splitDragging, setSplitDragging] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [openSections, setOpenSections] = useState<Record<AgendaPanelSection, boolean>>({
    calendars: false,
    new: false,
    leads: false,
    clients: false,
    day: true,
    history: false,
  })
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false)
  const [calendarEditingId, setCalendarEditingId] = useState<string | null>(null)
  const [calendarSaving, setCalendarSaving] = useState(false)
  const [calendarForm, setCalendarForm] = useState<CalendarFormState>({
    name: '',
    kind: 'PROSPECT_MEETINGS',
    colorHex: '#0ea5e9',
    visibility: 'TEAM',
    description: '',
    memberUserIds: [],
  })
  const splitContainerRef = useRef<HTMLDivElement | null>(null)
  const filterPanelRef = useRef<HTMLDivElement | null>(null)
  const didInitialLoadRef = useRef(false)
  const [taskForm, setTaskForm] = useState<TaskFormState>({
    title: '',
    description: '',
    priority: 'NORMAL' as TaskPriority,
    dueAt: `${selectedDate}T09:00`,
    relationType: 'lead' as 'lead' | 'cliente',
    relationId: '',
    assignedToUserId: '',
    calendarId: '',
  })

  const loadTasks = useCallback(async () => {
    const taskRes = await requestJson<Task[]>('/api/crm/tasks')
    setTasks(Array.isArray(taskRes.data) ? taskRes.data : [])
  }, [])

  const loadMeta = useCallback(async () => {
    const [leadRes, clientRes, assigneeRes] = await Promise.all([
      requestJson<LeadOption[]>(`/api/crm/leads${leadSearch.trim() ? `?search=${encodeURIComponent(leadSearch.trim())}` : ''}`),
      requestJson<ClienteOption[]>(`/api/clientes${clientSearch.trim() ? `?search=${encodeURIComponent(clientSearch.trim())}` : ''}`),
      requestJson<Assignee[]>('/api/crm/assignees'),
    ])

    setLeadOptions(Array.isArray(leadRes.data) ? leadRes.data.slice(0, 12) : [])
    setClientOptions(Array.isArray(clientRes.data) ? clientRes.data.slice(0, 12) : [])
    setAssignees(Array.isArray(assigneeRes.data) ? assigneeRes.data : [])
  }, [clientSearch, leadSearch])

  const loadCalendars = useCallback(async () => {
    const calendarRes = await requestJson<AgendaCalendar[]>('/api/crm/agenda/calendars')
    const nextCalendars = Array.isArray(calendarRes.data) ? calendarRes.data : []
    setCalendars(nextCalendars)
    setSelectedCalendarIds((current) => current.filter((id) => nextCalendars.some((calendar) => calendar.id === id)))
    setTaskForm((current) => {
      if (current.calendarId && nextCalendars.some((calendar) => calendar.id === current.calendarId)) return current
      return { ...current, calendarId: nextCalendars[0]?.id ?? '' }
    })
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([loadTasks(), loadMeta(), loadCalendars()])
    } finally {
      setLoading(false)
    }
  }, [loadCalendars, loadMeta, loadTasks])

  useEffect(() => {
    if (didInitialLoadRef.current) return
    didInitialLoadRef.current = true
    void loadData()
  }, [loadData])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadTasks()
    }, TASK_AUTO_REFRESH_MS)

    const unsubscribe = subscribeToNotificationReceivedEvent(() => {
      void loadTasks()
    })

    return () => {
      window.clearInterval(intervalId)
      unsubscribe()
    }
  }, [loadTasks])

  useEffect(() => {
    void loadMeta()
  }, [loadMeta])

  useEffect(() => {
    if (!searchParams) return
    const leadId = searchParams.get('leadId')
    const clienteId = searchParams.get('clienteId')
    if (leadId) {
      setTaskForm((current) => ({ ...current, relationType: 'lead', relationId: leadId }))
    }
    if (clienteId) {
      setTaskForm((current) => ({ ...current, relationType: 'cliente', relationId: clienteId }))
    }
  }, [searchParams])

  useEffect(() => {
    setTaskForm((current) => {
      if (current.dueAt.startsWith(selectedDate)) return current
      return {
        ...current,
        dueAt: `${selectedDate}T09:00`,
      }
    })
  }, [selectedDate])

  useEffect(() => {
    try {
      const storedSplit = window.localStorage.getItem(AGENDA_SPLIT_STORAGE_KEY)
      if (storedSplit) {
        const parsed = Number(storedSplit)
        if (Number.isFinite(parsed) && parsed > 0) {
          setSplitPercent(Math.min(100, Math.max(25, Math.round(parsed))))
        }
      }
      const storedPanel = window.localStorage.getItem(AGENDA_PANEL_STORAGE_KEY)
      if (storedPanel === '0') setPanelOpen(false)
    } catch {
      // localStorage puede no estar disponible en modo privado.
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(AGENDA_SPLIT_STORAGE_KEY, String(splitPercent))
      window.localStorage.setItem(AGENDA_PANEL_STORAGE_KEY, panelOpen ? '1' : '0')
    } catch {
      // Ignora errores de almacenamiento del navegador.
    }
  }, [panelOpen, splitPercent])

  useEffect(() => {
    if (!splitDragging) return

    function handlePointerMove(event: PointerEvent) {
      const container = splitContainerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (!rect.width) return
      const percent = ((event.clientX - rect.left) / rect.width) * 100
      setSplitPercent(Math.min(100, Math.max(25, Math.round(percent))))
      setPanelOpen(true)
    }

    function handlePointerUp() {
      setSplitDragging(false)
      setSplitPercent((current) => snapAgendaSplit(current))
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [splitDragging])

  useEffect(() => {
    if (!filterPanelOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (filterPanelRef.current?.contains(event.target as Node)) return
      setFilterPanelOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setFilterPanelOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [filterPanelOpen])

  const calendarFilter = useMemo(() => {
    if (!calendars.length) return { active: false, ids: new Set<string>() }
    const ids = selectedCalendarIds.length ? selectedCalendarIds : calendars.map((calendar) => calendar.id)
    return { active: ids.length !== calendars.length, ids: new Set(ids) }
  }, [calendars, selectedCalendarIds])

  const filteredTasks = useMemo(() => {
    const term = searchFilter.trim().toLowerCase()
    return tasks.filter((task) => {
      const dateKey = toLocalDateKey(task.dueAt)
      if (calendarFilter.active && (!task.calendarId || !calendarFilter.ids.has(task.calendarId))) return false
      if (statusFilter === 'OPEN' && task.status !== 'OPEN') return false
      if (statusFilter === 'CLOSED' && task.status === 'OPEN') return false
      if (rangeFrom && dateKey && dateKey < rangeFrom) return false
      if (rangeTo && dateKey && dateKey > rangeTo) return false
      if (rangeFrom && !dateKey) return false
      if (term) {
        const haystack = [task.title, task.description, task.lead?.nombre, task.cliente?.nombre, task.assignedTo?.name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }
      return true
    })
  }, [calendarFilter, rangeFrom, rangeTo, searchFilter, statusFilter, tasks])

  const selectedDayTasks = useMemo(() => {
    return filteredTasks.filter((task) => (task.dueAt ? task.dueAt.slice(0, 10) === selectedDate : false))
  }, [filteredTasks, selectedDate])

  const historyTasks = useMemo(() => {
    const todayKey = toDateKey(new Date())
    return filteredTasks
      .filter((task) => task.dueAt && task.dueAt.slice(0, 10) <= todayKey)
      .sort((a, b) => (b.dueAt || '').localeCompare(a.dueAt || ''))
      .slice(0, 40)
  }, [filteredTasks])

  const openTasks = useMemo(() => tasks.filter((task) => task.status === 'OPEN').length, [tasks])
  const overdueTasks = useMemo(() => tasks.filter((task) => task.status === 'OPEN' && task.dueAt && task.dueAt.slice(0, 10) < toDateKey(new Date())).length, [tasks])
  const scheduledToday = useMemo(() => tasks.filter((task) => task.dueAt && task.dueAt.slice(0, 10) === toDateKey(new Date())).length, [tasks])
  const openInRange = useMemo(() => filteredTasks.filter((task) => task.status === 'OPEN').length, [filteredTasks])
  const closedInRange = useMemo(() => filteredTasks.filter((task) => task.status !== 'OPEN').length, [filteredTasks])

  const monthGrid = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const start = new Date(firstDay)
    start.setDate(firstDay.getDate() - firstDay.getDay())

    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(start)
      current.setDate(start.getDate() + index)
      const dateKey = toDateKey(current)
      const dayTasks = filteredTasks.filter((task) => task.dueAt && task.dueAt.slice(0, 10) === dateKey)
      return {
        date: current,
        dateKey,
        isCurrentMonth: current.getMonth() === visibleMonth.getMonth(),
        taskCount: dayTasks.length,
        openCount: dayTasks.filter((task) => task.status === 'OPEN').length,
        closedCount: dayTasks.filter((task) => task.status !== 'OPEN').length,
        tasks: dayTasks,
      }
    })
  }, [filteredTasks, visibleMonth])

  const weekGrid = useMemo(() => {
    const start = startOfWeekDate(new Date(`${selectedDate}T00:00:00`))
    return Array.from({ length: 7 }, (_, index) => {
      const current = addDaysToDate(start, index)
      const dateKey = toDateKey(current)
      const dayTasks = filteredTasks.filter((task) => task.dueAt && task.dueAt.slice(0, 10) === dateKey)
      return {
        date: current,
        dateKey,
        tasks: dayTasks,
        openCount: dayTasks.filter((task) => task.status === 'OPEN').length,
        closedCount: dayTasks.filter((task) => task.status !== 'OPEN').length,
      }
    })
  }, [filteredTasks, selectedDate])

  const dayHourRows = useMemo(() => {
    return Array.from({ length: 15 }, (_, index) => {
      const hour = index + 7
      const hourTasks = selectedDayTasks.filter((task) => task.dueAt && new Date(task.dueAt).getHours() === hour)
      return { hour, label: `${`${hour}`.padStart(2, '0')}:00`, tasks: hourTasks }
    })
  }, [selectedDayTasks])

  const monthsGrid = useMemo(() => {
    const monthsToShow = agendaView === 'year' ? 12 : agendaView === 'semester' ? 6 : 3
    const firstMonth = agendaView === 'year'
      ? 0
      : agendaView === 'semester'
        ? Math.floor(visibleMonth.getMonth() / 6) * 6
        : Math.floor(visibleMonth.getMonth() / 3) * 3
    return Array.from({ length: monthsToShow }, (_, index) => {
      const monthDate = new Date(visibleMonth.getFullYear(), firstMonth + index, 1)
      const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
      const dayKeys = Array.from({ length: daysInMonth }, (_, dayIndex) => toDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth(), dayIndex + 1)))
      const monthTasks = filteredTasks.filter((task) => task.dueAt && dayKeys.includes(task.dueAt.slice(0, 10)))
      return {
        monthDate,
        tasks: monthTasks,
        openCount: monthTasks.filter((task) => task.status === 'OPEN').length,
        closedCount: monthTasks.filter((task) => task.status !== 'OPEN').length,
      }
    })
  }, [agendaView, filteredTasks, visibleMonth])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (agendaLayout !== 'calendar') count += 1
    if (agendaView !== 'month') count += 1
    if (statusFilter !== 'ALL') count += 1
    if (selectedCalendarIds.length > 0) count += 1
    if (searchFilter.trim()) count += 1
    return count
  }, [agendaLayout, agendaView, searchFilter, selectedCalendarIds, statusFilter])

  function resetAgendaFilters() {
    const now = new Date()
    setAgendaLayout('calendar')
    setAgendaView('month')
    setStatusFilter('ALL')
    setSearchFilter('')
    setSelectedCalendarIds([])
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    applyRangePreset(
      toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
      toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    )
  }

  function applyRangePreset(from: string, to: string) {
    setRangeFrom(from)
    setRangeTo(to)
    setVisibleMonth(new Date(`${from}T00:00:00`))
  }

  function changeAgendaView(view: AgendaViewMode) {
    setAgendaView(view)
    const baseDate = new Date(`${selectedDate}T00:00:00`)
    if (view === 'day') {
      applyRangePreset(selectedDate, selectedDate)
      return
    }
    if (view === 'week') {
      const start = startOfWeekDate(baseDate)
      applyRangePreset(toDateKey(start), toDateKey(addDaysToDate(start, 6)))
      return
    }
    if (view === 'month') {
      const start = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
      applyRangePreset(toDateKey(start), toDateKey(new Date(start.getFullYear(), start.getMonth() + 1, 0)))
      return
    }
    if (view === 'semester') {
      const semesterStartMonth = Math.floor(visibleMonth.getMonth() / 6) * 6
      const start = new Date(visibleMonth.getFullYear(), semesterStartMonth, 1)
      applyRangePreset(toDateKey(start), toDateKey(new Date(start.getFullYear(), semesterStartMonth + 6, 0)))
      return
    }
    if (view === 'year') {
      const start = new Date(visibleMonth.getFullYear(), 0, 1)
      applyRangePreset(toDateKey(start), toDateKey(new Date(start.getFullYear(), 12, 0)))
      return
    }
    const quarterStartMonth = Math.floor(visibleMonth.getMonth() / 3) * 3
    const start = new Date(visibleMonth.getFullYear(), quarterStartMonth, 1)
    applyRangePreset(toDateKey(start), toDateKey(new Date(start.getFullYear(), quarterStartMonth + 3, 0)))
  }

  function shiftAgendaPeriod(direction: -1 | 1) {
    if (agendaView === 'day') {
      const next = toDateKey(addDaysToDate(new Date(`${selectedDate}T00:00:00`), direction))
      setSelectedDate(next)
      applyRangePreset(next, next)
      return
    }
    if (agendaView === 'week') {
      const next = addDaysToDate(new Date(`${selectedDate}T00:00:00`), direction * 7)
      setSelectedDate(toDateKey(next))
      const start = startOfWeekDate(next)
      applyRangePreset(toDateKey(start), toDateKey(addDaysToDate(start, 6)))
      return
    }
    if (agendaView === 'month') {
      const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + direction, 1)
      setVisibleMonth(nextMonth)
      applyRangePreset(toDateKey(nextMonth), toDateKey(new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0)))
      return
    }
    if (agendaView === 'semester') {
      const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + (direction * 6), 1)
      setVisibleMonth(nextMonth)
      const semesterStartMonth = Math.floor(nextMonth.getMonth() / 6) * 6
      const start = new Date(nextMonth.getFullYear(), semesterStartMonth, 1)
      applyRangePreset(toDateKey(start), toDateKey(new Date(start.getFullYear(), semesterStartMonth + 6, 0)))
      return
    }
    if (agendaView === 'year') {
      const nextYear = new Date(visibleMonth.getFullYear() + direction, 0, 1)
      setVisibleMonth(nextYear)
      applyRangePreset(toDateKey(nextYear), toDateKey(new Date(nextYear.getFullYear(), 12, 0)))
      return
    }
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + (direction * 3), 1)
    setVisibleMonth(nextMonth)
    const quarterStartMonth = Math.floor(nextMonth.getMonth() / 3) * 3
    const start = new Date(nextMonth.getFullYear(), quarterStartMonth, 1)
    applyRangePreset(toDateKey(start), toDateKey(new Date(start.getFullYear(), quarterStartMonth + 3, 0)))
  }

  function selectAgendaDay(dateKey: string, focusPanel = true) {
    setSelectedDate(dateKey)
    if (agendaView === 'day') {
      setRangeFrom(dateKey)
      setRangeTo(dateKey)
    }
    setVisibleMonth(new Date(`${dateKey}T00:00:00`))
    if (focusPanel) {
      setOpenSections((current) => ({ ...current, day: true }))
    }
  }

  function togglePanel() {
    setPanelOpen((current) => {
      const next = !current
      setSplitPercent((value) => (next ? (value >= 100 ? 66 : value) : 100))
      return next
    })
  }

  function applySplitPercent(value: number) {
    setSplitPercent(value)
    setPanelOpen(value < 100)
  }

  function beginSplitDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    setSplitDragging(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Algunos navegadores no permiten capturar el puntero del separador.
    }
  }

  function toggleSection(section: AgendaPanelSection) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  function openSection(section: AgendaPanelSection) {
    setPanelOpen(true)
    setSplitPercent((current) => (current >= 100 ? 66 : current))
    setOpenSections((current) => ({ ...current, [section]: true }))
  }

  function resolveCalendarForKind(kind: CrmAgendaCalendarKind) {
    return calendars.find((calendar) => calendar.kind === kind)
      ?? calendars.find((calendar) => calendar.visibility === 'TEAM')
      ?? calendars[0]
      ?? null
  }

  function startQuickAction(action: AgendaQuickAction) {
    const calendar = resolveCalendarForKind(action.calendarKind)
    setTaskForm((current) => ({
      ...current,
      title: action.title,
      priority: action.priority,
      dueAt: current.dueAt.startsWith(selectedDate) ? current.dueAt : `${selectedDate}T09:00`,
      calendarId: calendar?.id ?? current.calendarId,
    }))
    setAgendaDialogOpen(true)
  }

  function toggleCalendarFilter(calendarId: string) {
    setSelectedCalendarIds((current) => {
      const base = current.length ? current : calendars.map((calendar) => calendar.id)
      const next = base.includes(calendarId)
        ? base.filter((id) => id !== calendarId)
        : [...base, calendarId]
      if (!next.length || next.length === calendars.length) return []
      return next
    })
  }

  function openCreateCalendarDialog() {
    setCalendarEditingId(null)
    setCalendarForm({
      name: '',
      kind: 'PROSPECT_MEETINGS',
      colorHex: '#0ea5e9',
      visibility: 'TEAM',
      description: '',
      memberUserIds: [],
    })
    setCalendarDialogOpen(true)
  }

  function openEditCalendarDialog(calendar: AgendaCalendar) {
    setCalendarEditingId(calendar.id)
    setCalendarForm({
      name: calendar.name,
      kind: CRM_AGENDA_CALENDAR_KINDS.some((kind) => kind.value === calendar.kind)
        ? calendar.kind as CrmAgendaCalendarKind
        : 'GENERAL',
      colorHex: calendar.colorHex,
      visibility: calendar.visibility === 'PRIVATE' ? 'PRIVATE' : 'TEAM',
      description: calendar.description ?? '',
      memberUserIds: calendar.members
        .map((member) => member.userId)
        .filter((userId) => userId !== calendar.ownerUserId && userId !== calendar.createdById),
    })
    setCalendarDialogOpen(true)
  }

  async function handleSaveCalendar() {
    if (!calendarForm.name.trim()) {
      alert('El nombre del calendario es obligatorio.')
      return
    }

    setCalendarSaving(true)
    try {
      const payload = {
        name: calendarForm.name.trim(),
        kind: calendarForm.kind,
        colorHex: calendarForm.colorHex,
        visibility: calendarForm.visibility,
        description: calendarForm.description,
        memberUserIds: calendarForm.memberUserIds,
      }
      const json = calendarEditingId
        ? await requestJson<AgendaCalendar>(`/api/crm/agenda/calendars/${calendarEditingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await requestJson<AgendaCalendar>('/api/crm/agenda/calendars', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (!json.success) {
        alert(json.error || 'No se pudo guardar el calendario.')
        return
      }

      const savedCalendarId = json.data?.id
      setCalendarDialogOpen(false)
      await loadCalendars()
      if (savedCalendarId) {
        setTaskForm((current) => ({ ...current, calendarId: savedCalendarId }))
      }
    } finally {
      setCalendarSaving(false)
    }
  }

  async function handleArchiveCalendar(calendar: AgendaCalendar) {
    if (!window.confirm(`¿Archivar el calendario «${calendar.name}»? Las tareas quedarán sin calendario asignado.`)) return

    const json = await requestJson<{ success?: boolean }>(`/api/crm/agenda/calendars/${calendar.id}`, { method: 'DELETE' })
    if (!json.success) {
      alert(json.error || 'No se pudo archivar el calendario.')
      return
    }

    setSelectedCalendarIds((current) => current.filter((id) => id !== calendar.id))
    setTaskForm((current) => (current.calendarId === calendar.id ? { ...current, calendarId: '' } : current))
    await loadCalendars()
    await loadTasks()
  }

  function toggleCalendarMember(userId: string) {
    setCalendarForm((current) => ({
      ...current,
      memberUserIds: current.memberUserIds.includes(userId)
        ? current.memberUserIds.filter((id) => id !== userId)
        : [...current.memberUserIds, userId],
    }))
  }
  function renderStatusBadge(task: Task) {
    if (task.status === 'DONE') {
      return <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sky-700">Cerrada</span>
    }
    if (task.status === 'CANCELED') {
      return <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Cancelada</span>
    }
    return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">Abierta</span>
  }

  function getPriorityAccent(priority: TaskPriority) {
    if (priority === 'HIGH') return 'bg-rose-500'
    if (priority === 'NORMAL') return 'bg-amber-500'
    return 'bg-slate-400'
  }

  function renderTaskChip(task: Task) {
    return (
      <button
        key={task.id}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          selectAgendaDay(task.dueAt ? task.dueAt.slice(0, 10) : selectedDate, false)
        }}
        className="flex w-full items-start gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-left text-[11px] leading-tight text-slate-700 transition hover:border-sky-300 hover:text-sky-800"
      >
        <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${getPriorityAccent(task.priority)}`} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{formatTimeOfDay(task.dueAt)}</span>
          <span className="block truncate">{task.title}</span>
        </span>
      </button>
    )
  }

  function renderMonthView() {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label) => (
            <div key={label} className="rounded-2xl bg-slate-50/80 px-2 py-2">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {monthGrid.map((day) => {
            const isSelected = day.dateKey === selectedDate
            const isToday = day.dateKey === toDateKey(new Date())
            return (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => selectAgendaDay(day.dateKey)}
                className={isSelected
                  ? 'min-h-[112px] rounded-2xl border border-sky-300 bg-sky-50/80 p-2 text-left shadow-sm'
                  : day.isCurrentMonth
                    ? 'min-h-[112px] rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-sky-200 hover:shadow-md'
                    : 'min-h-[112px] rounded-2xl border border-slate-100 bg-slate-50/60 p-2 text-left text-slate-400'}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-semibold ${isToday ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-white' : ''}`}>{day.date.getDate()}</span>
                  <span className="flex items-center gap-1">
                    {day.openCount > 0 ? <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{day.openCount}</span> : null}
                    {day.closedCount > 0 ? <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{day.closedCount}</span> : null}
                  </span>
                </div>
                <div className="mt-1.5 space-y-1">
                  {day.tasks.slice(0, 2).map(renderTaskChip)}
                  {day.tasks.length > 2 ? <p className="px-1 text-[10px] font-semibold text-slate-500">+{day.tasks.length - 2} más</p> : null}
                  {!day.tasks.length ? <p className="px-1 pt-1 text-[10px] font-medium text-slate-400">Sin agenda</p> : null}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }


  async function handleCreateTask() {
    if (!taskForm.title.trim()) {
      alert('El título es requerido para la agenda.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        dueAt: taskForm.dueAt,
        assignedToUserId: taskForm.assignedToUserId || null,
        calendarId: taskForm.calendarId || null,
        ...(taskForm.relationId
          ? (taskForm.relationType === 'lead' ? { leadId: taskForm.relationId } : { clienteId: taskForm.relationId })
          : {}),
      }

      const json = await requestJson<Task>('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!json.success) {
        alert(json.error || 'No se pudo crear la agenda.')
        return
      }

      setTaskForm((current) => ({
        ...current,
        title: '',
        description: '',
      }))
      setAgendaDialogOpen(false)
      await Promise.all([loadTasks(), loadCalendars()])
    } finally {
      setSaving(false)
    }
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus) {
    const json = await requestJson<Task>(`/api/crm/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })

    if (!json.success) {
      alert(json.error || 'No se pudo actualizar la agenda.')
      return
    }

    await loadTasks()
  }

  function renderWeekView() {
    return (
      <div className="grid gap-2 md:grid-cols-7">
        {weekGrid.map((day) => {
          const isSelected = day.dateKey === selectedDate
          const isToday = day.dateKey === toDateKey(new Date())
          return (
            <div
              key={day.dateKey}
              className={isSelected ? 'rounded-2xl border border-sky-300 bg-sky-50/70 p-2' : 'rounded-2xl border border-slate-200 bg-white p-2'}
            >
              <button type="button" onClick={() => selectAgendaDay(day.dateKey, false)} className="flex w-full items-center justify-between gap-1 text-left">
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {new Intl.DateTimeFormat('es-CO', { weekday: 'short' }).format(day.date)}
                  </span>
                  <span className={`text-sm font-semibold ${isToday ? 'text-sky-700' : 'text-slate-900'}`}>{day.date.getDate()}</span>
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  {day.openCount > 0 ? <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{day.openCount} abiertas</span> : null}
                  {day.closedCount > 0 ? <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{day.closedCount} cerradas</span> : null}
                </span>
              </button>
              <div className="mt-2 space-y-1.5">
                {day.tasks.length
                  ? day.tasks.map(renderTaskChip)
                  : <p className="rounded-lg border border-dashed border-slate-200 px-2 py-3 text-[10px] text-slate-400">Sin agenda</p>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderDayView() {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-sm font-semibold capitalize text-slate-900">
            {new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${selectedDate}T00:00:00`))}
          </p>
          <div className="flex gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em]">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{selectedDayTasks.filter((task) => task.status === 'OPEN').length} abiertas</span>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">{selectedDayTasks.filter((task) => task.status !== 'OPEN').length} cerradas</span>
          </div>
        </div>
        {dayHourRows.map((row) => (
          <div key={row.hour} className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-2">
            <span className="pt-2 text-right text-[11px] font-semibold text-slate-400">{row.label}</span>
            <div className="min-h-[42px] rounded-xl border border-slate-100 bg-slate-50/50 p-1">
              {row.tasks.length ? <div className="space-y-1">{row.tasks.map(renderTaskChip)}</div> : null}
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderMonthsView() {
    const columnsClass = agendaView === 'year'
      ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      : agendaView === 'semester'
        ? 'md:grid-cols-2 xl:grid-cols-3'
        : 'lg:grid-cols-3'
    return (
      <div className={`grid gap-3 ${columnsClass}`}>
        {monthsGrid.map((month) => {
          const daysInMonth = new Date(month.monthDate.getFullYear(), month.monthDate.getMonth() + 1, 0).getDate()
          const firstWeekday = (new Date(month.monthDate.getFullYear(), month.monthDate.getMonth(), 1).getDay() + 6) % 7
          return (
            <div key={month.monthDate.toISOString()} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold capitalize text-slate-900">{formatMonth(month.monthDate)}</p>
                <span className="flex gap-1">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{month.openCount}</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{month.closedCount}</span>
                </span>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {Array.from({ length: firstWeekday }).map((_, index) => <span key={`pad-${index}`} />)}
                {Array.from({ length: daysInMonth }, (_, dayIndex) => {
                  const date = new Date(month.monthDate.getFullYear(), month.monthDate.getMonth(), dayIndex + 1)
                  const dateKey = toDateKey(date)
                  const dayTasks = month.tasks.filter((task) => task.dueAt && task.dueAt.slice(0, 10) === dateKey)
                  const openCount = dayTasks.filter((task) => task.status === 'OPEN').length
                  const hasTasks = dayTasks.length > 0
                  const isSelected = dateKey === selectedDate
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => { selectAgendaDay(dateKey, false); changeAgendaView('day') }}
                      title={`${dayTasks.length} registros`}
                      className={isSelected
                        ? 'flex h-8 items-center justify-center rounded-lg border border-sky-400 bg-sky-100 text-[11px] font-semibold text-sky-900'
                        : openCount > 0
                          ? 'flex h-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-800'
                          : hasTasks
                            ? 'flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-[11px] font-medium text-slate-600'
                            : 'flex h-8 items-center justify-center rounded-lg border border-transparent text-[11px] text-slate-400 hover:border-slate-200'}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }


  function renderCardsView() {
    const columns: Array<{ status: TaskStatus; title: string; helper: string; tone: string }> = [
      { status: 'OPEN', title: 'Abiertas', helper: 'Reuniones y tareas por atender', tone: 'border-emerald-200 bg-emerald-50/60' },
      { status: 'DONE', title: 'Completadas', helper: 'Cerradas con seguimiento hecho', tone: 'border-sky-200 bg-sky-50/60' },
      { status: 'CANCELED', title: 'Canceladas', helper: 'Descartadas o reprogramadas', tone: 'border-slate-200 bg-slate-50' },
    ]

    return (
      <div className="grid gap-3 lg:grid-cols-3">
        {columns.map((column) => {
          const columnTasks = filteredTasks
            .filter((task) => task.status === column.status)
            .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''))
          return (
            <div key={column.status} className={`rounded-2xl border p-3 ${column.tone}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{column.title}</p>
                  <p className="text-[11px] text-slate-500">{column.helper}</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">{columnTasks.length}</span>
              </div>
              <div className="mt-3 space-y-2">
                {columnTasks.length ? columnTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${getPriorityAccent(task.priority)}`} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      {renderStatusBadge(task)}
                      <span>{task.dueAt ? formatDate(task.dueAt, 'Sin fecha') : 'Sin fecha'}</span>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      {task.lead ? <p>Prospecto: {task.lead.nombre}</p> : null}
                      {task.cliente ? <p>Cliente: {task.cliente.nombre}</p> : null}
                      {task.assignedTo?.name ? <p>Responsable: {task.assignedTo.name}</p> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Button variant="outline" className="h-8 rounded-lg px-2 text-[11px]" onClick={() => selectAgendaDay(task.dueAt ? task.dueAt.slice(0, 10) : selectedDate, false)}>
                        Ver día
                      </Button>
                      {task.status !== 'DONE' ? (
                        <Button variant="outline" className="h-8 rounded-lg px-2 text-[11px]" onClick={() => void updateTaskStatus(task.id, 'DONE')}>Completar</Button>
                      ) : null}
                      {task.status !== 'OPEN' ? (
                        <Button variant="outline" className="h-8 rounded-lg px-2 text-[11px]" onClick={() => void updateTaskStatus(task.id, 'OPEN')}>Reabrir</Button>
                      ) : null}
                    </div>
                  </div>
                )) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-3 py-6 text-center text-[11px] text-slate-400">
                    Sin registros en este estado para el rango elegido.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }


  function renderEventsView() {
    const groups = filteredTasks
      .filter((task) => Boolean(task.dueAt))
      .slice()
      .sort((a, b) => (a.dueAt || '').localeCompare(b.dueAt || ''))
      .reduce<Record<string, Task[]>>((accumulator, task) => {
        const key = toLocalDateKey(task.dueAt)
        if (!accumulator[key]) accumulator[key] = []
        accumulator[key].push(task)
        return accumulator
      }, {})

    const keys = Object.keys(groups).sort()

    if (!keys.length) {
      return (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center text-sm text-slate-500">
          No hay reuniones ni tareas en el rango y filtros seleccionados.
        </p>
      )
    }

    return (
      <div className="space-y-4">
        {keys.map((dateKey) => (
          <div key={dateKey} className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <p className="text-sm font-semibold capitalize text-slate-900">
                {new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${dateKey}T00:00:00`))}
              </p>
              <button type="button" onClick={() => selectAgendaDay(dateKey, false)} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                Ver día
              </button>
            </div>
            <div className="mt-2 divide-y divide-slate-100">
              {groups[dateKey].map((task) => (
                <div key={task.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 rounded-full ${getPriorityAccent(task.priority)}`} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {formatTimeOfDay(task.dueAt)}
                        {task.lead ? ` · Prospecto: ${task.lead.nombre}` : ''}
                        {task.cliente ? ` · Cliente: ${task.cliente.nombre}` : ''}
                        {task.assignedTo?.name ? ` · ${task.assignedTo.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {renderStatusBadge(task)}
                    {task.status !== 'DONE' ? (
                      <Button variant="outline" className="h-8 rounded-lg px-2 text-[11px]" onClick={() => void updateTaskStatus(task.id, 'DONE')}>Completar</Button>
                    ) : null}
                    {task.status !== 'OPEN' ? (
                      <Button variant="outline" className="h-8 rounded-lg px-2 text-[11px]" onClick={() => void updateTaskStatus(task.id, 'OPEN')}>Reabrir</Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderAgendaView() {
    if (agendaLayout === 'cards') return renderCardsView()
    if (agendaLayout === 'events') return renderEventsView()
    if (agendaView === 'day') return renderDayView()
    if (agendaView === 'week') return renderWeekView()
    if (agendaView === 'month') return renderMonthView()
    return renderMonthsView()
  }

  function getAgendaPeriodLabel() {
    if (agendaLayout === 'cards') return 'Tablero de tareas'
    if (agendaLayout === 'events') return 'Agenda cronológica'
    if (agendaView === 'day') {
      return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${selectedDate}T00:00:00`))
    }
    if (agendaView === 'week') {
      const start = startOfWeekDate(new Date(`${selectedDate}T00:00:00`))
      const end = addDaysToDate(start, 6)
      return `${new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' }).format(start)} - ${new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(end)}`
    }
    if (agendaView === 'quarter') {
      const quarterStartMonth = Math.floor(visibleMonth.getMonth() / 3) * 3
      return `${formatMonth(new Date(visibleMonth.getFullYear(), quarterStartMonth, 1))} · Q${Math.floor(visibleMonth.getMonth() / 3) + 1}`
    }
    if (agendaView === 'semester') {
      const semesterStartMonth = Math.floor(visibleMonth.getMonth() / 6) * 6
      return `${formatMonth(new Date(visibleMonth.getFullYear(), semesterStartMonth, 1))} · S${semesterStartMonth / 6 + 1}`
    }
    if (agendaView === 'year') return `Año ${visibleMonth.getFullYear()}`
    return formatMonth(visibleMonth)
  }

  return (
    <div className="space-y-4.5 pb-4">
      <CrmNegotiationsPageHeader
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Calendario' },
        ]}
        title={<span data-tour="agenda-title">Calendario comercial y agendamiento</span>}
        actions={
          <>
            {canAccessAnyChat ? <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/85">
              <Link href="/dashboard/chat">Ir a Conversaciones</Link>
            </Button> : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-2xl bg-slate-950 text-white shadow-sm">
                  <Plus className="mr-1.5 h-4 w-4" /> Crear nueva
                  <ChevronDown className="ml-1.5 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>¿Qué quieres agendar?</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {AGENDA_QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon
                  return (
                    <DropdownMenuItem key={action.key} onSelect={() => startQuickAction(action)} className="items-start gap-2 py-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{action.label}</span>
                        <span className="block text-[11px] text-slate-500">{action.description}</span>
                      </span>
                    </DropdownMenuItem>
                  )
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={openCreateCalendarDialog} className="items-start gap-2 py-2">
                  <CalendarPlus className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-900">Nuevo calendario</span>
                    <span className="block text-[11px] text-slate-500">Crea calendarios por tipo y compártelos con tu equipo.</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <CrmNegotiationsTabs />

      <div
        ref={splitContainerRef}
        className="flex flex-col gap-4 xl:flex-row xl:items-start"
        style={{ ['--agenda-left' as string]: `${splitPercent}%` } as React.CSSProperties}
      >
        <Card className={`w-full min-w-0 rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)] ${panelOpen && splitPercent < 100 ? 'xl:w-[var(--agenda-left)] xl:shrink-0' : 'xl:w-full'}`}>
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardInfoHeader
              title={<CardTitle className="text-xl capitalize">{getAgendaPeriodLabel()}</CardTitle>}
              description="Crea reuniones, agendamientos o citas, busca y aplica filtros de formato, fecha, reuniones y calendario."
              tone="action"
              actions={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" className="rounded-xl px-2.5" onClick={() => shiftAgendaPeriod(-1)} aria-label="Periodo anterior">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="rounded-xl px-2.5" onClick={() => shiftAgendaPeriod(1)} aria-label="Periodo siguiente">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Select value={String(splitPercent)} onValueChange={(value) => applySplitPercent(Number(value))}>
                    <SelectTrigger className="hidden h-9 w-[92px] rounded-xl bg-white sm:flex" aria-label="Ancho del calendario">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENDA_SPLIT_OPTIONS.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {option === 100 ? '100% (panel oculto)' : `${option}%`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" className="rounded-xl" onClick={togglePanel} title={panelOpen ? 'Ocultar panel derecho' : 'Mostrar panel derecho'}>
                    {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                    <span className="ml-1.5 hidden text-xs font-semibold sm:inline">{panelOpen ? 'Ocultar panel' : 'Ver panel'}</span>
                  </Button>
                </div>
              }
            />
          </CardHeader>
          <CardContent className="space-y-4 p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={searchFilter}
                onChange={(event) => setSearchFilter(event.target.value)}
                placeholder="Buscar por título, prospecto, cliente o responsable..."
                className="h-9 min-w-0 flex-1 rounded-xl bg-white sm:max-w-sm"
              />
              <div ref={filterPanelRef} className="relative">
                <Button
                  variant="outline"
                  onClick={() => setFilterPanelOpen((current) => !current)}
                  aria-expanded={filterPanelOpen}
                  aria-haspopup="dialog"
                  className="h-9 rounded-xl border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  <SlidersHorizontal className="mr-1.5 h-4 w-4 text-slate-500" />
                  Filtros y vista
                  {activeFilterCount > 0 ? (
                    <span className="ml-1.5 rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{activeFilterCount}</span>
                  ) : null}
                  <ChevronDown className={`ml-1.5 h-3.5 w-3.5 text-slate-400 transition-transform ${filterPanelOpen ? 'rotate-180' : ''}`} />
                </Button>

                {filterPanelOpen ? (
                  <div
                    role="dialog"
                    aria-label="Filtros y vista del calendario"
                    className="absolute right-0 top-full z-40 mt-2 w-[min(94vw,26rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_70px_-32px_rgba(15,23,42,0.5)]"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Filtros y vista</p>
                        <p className="text-[11px] text-slate-500">Formato, tipo de fecha, rango, reuniones y calendarios.</p>
                      </div>
                      <button
                        type="button"
                        onClick={resetAgendaFilters}
                        className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-rose-200 hover:text-rose-700"
                      >
                        Limpiar
                      </button>
                    </div>

                    <div className="max-h-[68vh] space-y-3.5 overflow-y-auto px-3 py-3">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Tipo de calendario</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {AGENDA_LAYOUT_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              title={option.hint}
                              aria-pressed={agendaLayout === option.value}
                              onClick={() => setAgendaLayout(option.value)}
                              className={agendaLayout === option.value
                                ? 'rounded-xl bg-slate-950 px-2 py-1.5 text-[11px] font-semibold text-white'
                                : 'rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300'}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Tipo de fecha</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {AGENDA_VIEW_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={agendaView === option.value}
                              onClick={() => changeAgendaView(option.value)}
                              className={agendaView === option.value
                                ? 'rounded-xl border border-sky-300 bg-sky-50 px-2 py-1.5 text-[11px] font-semibold text-sky-700'
                                : 'rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300'}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[11px] text-slate-500">Ajusta el periodo visible y el rango de fechas.</p>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Rango</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <Label className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Desde</Label>
                            <Input type="date" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} className="h-9 rounded-xl bg-white" />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Hasta</Label>
                            <Input type="date" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} className="h-9 rounded-xl bg-white" />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => applyRangePreset(toDateKey(new Date()), toDateKey(new Date()))}
                            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                          >
                            Hoy
                          </button>
                          <button
                            type="button"
                            onClick={() => { const preset = rangePreset(7); applyRangePreset(preset.from, preset.to) }}
                            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                          >
                            7 días
                          </button>
                          <button
                            type="button"
                            onClick={() => { const preset = rangePreset(180); applyRangePreset(preset.from, preset.to) }}
                            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                          >
                            6 meses
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Reuniones</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {AGENDA_STATUS_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={statusFilter === option.value}
                              onClick={() => setStatusFilter(option.value)}
                              className={statusFilter === option.value
                                ? 'rounded-xl bg-slate-950 px-2 py-1.5 text-[11px] font-semibold text-white'
                                : 'rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300'}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Calendarios</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedCalendarIds([])}
                            className={selectedCalendarIds.length === 0
                              ? 'rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-white'
                              : 'rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300'}
                          >
                            Todos
                          </button>
                          {calendars.map((calendar) => {
                            const active = selectedCalendarIds.length === 0 || selectedCalendarIds.includes(calendar.id)
                            return (
                              <button
                                key={calendar.id}
                                type="button"
                                onClick={() => toggleCalendarFilter(calendar.id)}
                                title={`${getCalendarKindLabel(calendar.kind)} · ${calendar.visibility === 'PRIVATE' ? 'Privado' : 'Equipo'}`}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${active ? 'border-slate-300 text-slate-900' : 'border-slate-200 text-slate-400'}`}
                                style={{ backgroundColor: active ? hexToSoftBackground(calendar.colorHex) : 'transparent' }}
                              >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: calendar.colorHex }} />
                                {calendar.name}
                              </button>
                            )
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              setFilterPanelOpen(false)
                              openCreateCalendarDialog()
                            }}
                            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-sky-300 hover:text-sky-700"
                          >
                            <Plus className="h-3 w-3" /> Nuevo calendario
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
                      <span className="text-[11px] font-semibold text-slate-500">{filteredTasks.length} registros en el filtro</span>
                      <Button className="h-8 rounded-lg px-3 text-xs" onClick={() => setFilterPanelOpen(false)}>Listo</Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2 text-[11px] font-semibold text-slate-500">
              <span>{filteredTasks.length} en el filtro · {openInRange} abiertas · {closedInRange} cerradas · {openTasks} abiertas en total · {overdueTasks} vencidas · {scheduledToday} hoy</span>
              <span className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">Rango {rangeFrom} → {rangeTo}</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Abierta</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />Cerrada</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" />Cancelada</span>
              </span>
            </div>

            {renderAgendaView()}
          </CardContent>
        </Card>

        {panelOpen && splitPercent < 100 ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Ajustar ancho del calendario"
            tabIndex={0}
            onPointerDown={beginSplitDrag}
            onDoubleClick={() => applySplitPercent(66)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
              event.preventDefault()
              const index = AGENDA_SPLIT_OPTIONS.findIndex((option) => option === splitPercent)
              const baseIndex = index === -1 ? 3 : index
              const nextIndex = Math.min(
                AGENDA_SPLIT_OPTIONS.length - 1,
                Math.max(0, baseIndex + (event.key === 'ArrowRight' ? -1 : 1)),
              )
              applySplitPercent(AGENDA_SPLIT_OPTIONS[nextIndex])
            }}
            className={`hidden w-2 shrink-0 cursor-col-resize touch-none select-none items-center justify-center rounded-full hover:bg-sky-100 xl:flex ${splitDragging ? 'bg-sky-100' : ''}`}
            title="Arrastra para redimensionar. Doble click para volver a 66%."
          >
            <span className="flex h-12 w-1.5 items-center justify-center rounded-full bg-slate-200">
              <GripVertical className="h-3.5 w-3.5 text-slate-500" />
            </span>
          </div>
        ) : null}

        {panelOpen && splitPercent < 100 ? (
          <div className="min-w-0 flex-1 space-y-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:pr-1">
            <AgendaAccordion
              title="Calendarios"
              helper="Selecciona, crea y comparte calendarios por tipo."
              count={calendars.length}
              open={openSections.calendars}
              onToggle={() => toggleSection('calendars')}
              actions={
                <Button variant="outline" className="h-7 rounded-lg px-2 text-[11px]" onClick={openCreateCalendarDialog}>
                  <Plus className="mr-1 h-3 w-3" /> Nuevo
                </Button>
              }
            >
              {calendars.length ? (
                <div className="space-y-2">
                  {calendars.map((calendar) => (
                    <div key={calendar.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-2.5 py-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-slate-900">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: calendar.colorHex }} />
                          {calendar.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {getCalendarKindLabel(calendar.kind)} · {calendar.visibility === 'PRIVATE' ? 'Privado' : 'Equipo'} · {calendar._count?.tasks ?? 0} registros
                        </p>
                        {calendar.members.length > 1 ? (
                          <p className="mt-0.5 truncate text-[10px] text-slate-400">{calendar.members.length} integrantes con acceso</p>
                        ) : null}
                      </div>
                      {calendar.canManage ? (
                        <button
                          type="button"
                          onClick={() => openEditCalendarDialog(calendar)}
                          className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:text-slate-900"
                          title="Editar calendario e invitar usuarios"
                        >
                          <Users className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={openCreateCalendarDialog}
                    className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-sky-300 hover:text-sky-700"
                  >
                    <Plus className="h-3 w-3" /> Crear calendario
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-center">
                  <p className="text-xs font-semibold text-slate-800">Aún no tienes calendarios</p>
                  <p className="mt-1 text-[11px] text-slate-500">Crea uno para separar tareas, reuniones con prospectos y proyectos.</p>
                  <Button variant="outline" className="mt-2 h-8 rounded-lg text-[11px]" onClick={openCreateCalendarDialog}>Crear calendario</Button>
                </div>
              )}
            </AgendaAccordion>

            <AgendaAccordion
              title="Nueva agenda"
              helper={`Crear para ${selectedDate}`}
              open={openSections.new}
              onToggle={() => toggleSection('new')}
              actions={
                <Button variant="outline" className="h-7 rounded-lg px-2 text-[11px]" onClick={() => setAgendaDialogOpen(true)}>
                  Modal
                </Button>
              }
            >
              <AgendaTaskForm
                taskForm={taskForm}
                setTaskForm={setTaskForm}
                leadOptions={leadOptions}
                clientOptions={clientOptions}
                assignees={assignees}
                calendars={calendars}
                saving={saving}
                onSubmit={() => void handleCreateTask()}
                onCreateCalendar={openCreateCalendarDialog}
                compact
              />
            </AgendaAccordion>

            <AgendaAccordion
              title="Buscar prospectos"
              helper="Llévalo directo a una nueva reunión."
              count={leadOptions.length}
              open={openSections.leads}
              onToggle={() => toggleSection('leads')}
            >
              <Input value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} placeholder="Buscar lead por nombre, correo o teléfono..." className="h-9 rounded-xl" />
              <div className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                {leadOptions.length ? leadOptions.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">{lead.nombre}</p>
                      <p className="truncate text-[11px] text-slate-500">{lead.empresaNombre || lead.email || lead.telefono || 'Sin datos adicionales'}</p>
                      {lead.originKey && lead.originLabel ? <div className="mt-1"><OriginBadge originKey={lead.originKey} label={lead.originLabel} /></div> : lead.source ? <div className="mt-1"><OriginBadge originKey={getCrmOriginMeta({ source: lead.source }).key} label={getCrmOriginMeta({ source: lead.source }).label} /></div> : null}
                    </div>
                    <Button
                      variant="outline"
                      className="h-7 shrink-0 rounded-lg px-2 text-[11px]"
                      onClick={() => {
                        setTaskForm((current) => ({ ...current, relationType: 'lead', relationId: lead.id }))
                        openSection('new')
                      }}
                    >
                      Agendar
                    </Button>
                  </div>
                )) : (
                  <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">Sin prospectos para esta búsqueda.</p>
                )}
              </div>
            </AgendaAccordion>

            <AgendaAccordion
              title="Consultar clientes"
              helper="Agenda seguimiento con un cliente existente."
              count={clientOptions.length}
              open={openSections.clients}
              onToggle={() => toggleSection('clients')}
            >
              <Input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Buscar cliente por nombre, documento o correo..." className="h-9 rounded-xl" />
              <div className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                {clientOptions.length ? clientOptions.map((cliente) => (
                  <div key={cliente.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900">{cliente.nombre}</p>
                      <p className="truncate text-[11px] text-slate-500">{cliente.documento} · {cliente.email || cliente.telefono || 'Sin contacto directo'}</p>
                    </div>
                    <Button
                      variant="outline"
                      className="h-7 shrink-0 rounded-lg px-2 text-[11px]"
                      onClick={() => {
                        setTaskForm((current) => ({ ...current, relationType: 'cliente', relationId: cliente.id }))
                        openSection('new')
                      }}
                    >
                      Agendar
                    </Button>
                  </div>
                )) : (
                  <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">Sin clientes para esta búsqueda.</p>
                )}
              </div>
            </AgendaAccordion>

            <AgendaAccordion
              title={`Agenda del ${selectedDate}`}
              helper={loading ? 'Cargando registros...' : `${selectedDayTasks.length} registros del día seleccionado.`}
              count={selectedDayTasks.length}
              open={openSections.day}
              onToggle={() => toggleSection('day')}
              actions={
                <Button variant="outline" className="h-7 rounded-lg px-2 text-[11px]" onClick={() => openSection('new')}>
                  <Plus className="mr-1 h-3 w-3" /> Nueva
                </Button>
              }
            >
              {!loading && selectedDayTasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">No hay tareas agendadas para este día.</p>
              ) : null}
              <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-0.5">
                {selectedDayTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                          {formatTimeOfDay(task.dueAt) || 'Todo el día'}
                          {task.calendar ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                              style={{ backgroundColor: hexToSoftBackground(task.calendar.colorHex), color: task.calendar.colorHex }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.calendar.colorHex }} />
                              {task.calendar.name}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-900">{task.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                          {renderStatusBadge(task)}
                          {task.lead ? <span>· {task.lead.nombre}</span> : task.cliente ? <span>· {task.cliente.nombre}</span> : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {task.status !== 'DONE' ? (
                          <button
                            type="button"
                            onClick={() => void updateTaskStatus(task.id, 'DONE')}
                            className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                          >
                            Completar
                          </button>
                        ) : null}
                        {task.status !== 'OPEN' ? (
                          <button
                            type="button"
                            onClick={() => void updateTaskStatus(task.id, 'OPEN')}
                            className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-sky-300 hover:text-sky-700"
                          >
                            Reabrir
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AgendaAccordion>

            <AgendaAccordion
              title="Historial hasta hoy"
              helper="Registros anteriores y del día actual."
              count={historyTasks.length}
              open={openSections.history}
              onToggle={() => toggleSection('history')}
            >
              {historyTasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-slate-400">Aún no hay registros anteriores a hoy.</p>
              ) : (
                <div className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-0.5">
                  {historyTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => selectAgendaDay(task.dueAt ? task.dueAt.slice(0, 10) : selectedDate)}
                      className="flex w-full items-start justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-left transition hover:border-sky-200 hover:bg-white"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {task.dueAt ? formatDate(task.dueAt, 'Sin fecha') : 'Sin fecha'}
                        </span>
                        <span className="block truncate text-xs font-semibold text-slate-900">{task.title}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                          {renderStatusBadge(task)}
                          {task.calendar ? <span className="truncate">· {task.calendar.name}</span> : null}
                        </span>
                      </span>
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${getPriorityAccent(task.priority)}`} />
                    </button>
                  ))}
                </div>
              )}
            </AgendaAccordion>
          </div>
        ) : null}

        {!panelOpen || splitPercent >= 100 ? (
          <button
            type="button"
            onClick={togglePanel}
            className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_18px_40px_-18px_rgba(15,23,42,0.8)] transition hover:bg-slate-800"
            title="Mostrar panel de agenda"
          >
            <PanelRightOpen className="h-4 w-4" /> Mostrar panel
          </button>
        ) : null}
      </div>

      <Dialog open={agendaDialogOpen} onOpenChange={setAgendaDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva agenda</DialogTitle>
            <DialogDescription>Programa la acción para {selectedDate}. Puedes asociarla a un prospecto, un cliente o dejarla como tarea interna de un calendario.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <AgendaTaskForm
              taskForm={taskForm}
              setTaskForm={setTaskForm}
              leadOptions={leadOptions}
              clientOptions={clientOptions}
              assignees={assignees}
              calendars={calendars}
              saving={saving}
              onSubmit={() => void handleCreateTask()}
              onCreateCalendar={openCreateCalendarDialog}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgendaDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={calendarDialogOpen} onOpenChange={setCalendarDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{calendarEditingId ? 'Editar calendario' : 'Nuevo calendario'}</DialogTitle>
            <DialogDescription>
              Define el tipo de calendario y quién puede verlo. Los calendarios de equipo los ve toda la empresa; los privados solo los invitados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid gap-1.5">
              <Label>Nombre</Label>
              <Input value={calendarForm.name} onChange={(event) => setCalendarForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Reuniones con prospectos" />
            </div>
            <div className="grid gap-1.5">
              <Label>Descripción</Label>
              <Textarea rows={2} value={calendarForm.description} onChange={(event) => setCalendarForm((current) => ({ ...current, description: event.target.value }))} placeholder="Para qué se usa este calendario..." />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Tipo de calendario</Label>
                <Select
                  value={calendarForm.kind}
                  onValueChange={(value) => {
                    const kind = value as CrmAgendaCalendarKind
                    const meta = CRM_AGENDA_CALENDAR_KINDS.find((item) => item.value === kind)
                    setCalendarForm((current) => ({ ...current, kind, colorHex: meta?.colorHex ?? current.colorHex }))
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CRM_AGENDA_CALENDAR_KINDS.map((kind) => (
                      <SelectItem key={kind.value} value={kind.value}>{kind.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500">{CRM_AGENDA_CALENDAR_KINDS.find((kind) => kind.value === calendarForm.kind)?.description}</p>
              </div>
              <div className="grid gap-1.5">
                <Label>Visibilidad</Label>
                <Select value={calendarForm.visibility} onValueChange={(value) => setCalendarForm((current) => ({ ...current, visibility: value === 'PRIVATE' ? 'PRIVATE' : 'TEAM' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEAM">Todo el equipo</SelectItem>
                    <SelectItem value="PRIVATE">Privado (solo invitados)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {CRM_AGENDA_CALENDAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCalendarForm((current) => ({ ...current, colorHex: color }))}
                    aria-label={`Color ${color}`}
                    className={`h-7 w-7 rounded-full border-2 ${calendarForm.colorHex === color ? 'border-slate-950' : 'border-white'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Invitar usuarios</Label>
              <p className="text-[11px] text-slate-500">Los invitados podrán ver el calendario y sus registros.</p>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1.5">
                {assignees.length ? assignees.map((user) => (
                  <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={calendarForm.memberUserIds.includes(user.id)}
                      onChange={() => toggleCalendarMember(user.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                    <span className="truncate">{user.name || user.email || user.id}</span>
                    <span className="ml-auto truncate text-[10px] text-slate-400">{user.email}</span>
                  </label>
                )) : (
                  <p className="px-2 py-2 text-[11px] text-slate-400">No hay usuarios disponibles para invitar.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-wrap items-center justify-between gap-2">
            <div>
              {calendarEditingId && calendars.find((calendar) => calendar.id === calendarEditingId)?.role === 'OWNER' ? (
                <Button
                  variant="outline"
                  className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                  disabled={calendarSaving}
                  onClick={() => {
                    const calendar = calendars.find((item) => item.id === calendarEditingId)
                    if (!calendar) return
                    setCalendarDialogOpen(false)
                    void handleArchiveCalendar(calendar)
                  }}
                >
                  Archivar
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setCalendarDialogOpen(false)}>Cancelar</Button>
              <Button className="rounded-xl" disabled={calendarSaving} onClick={() => void handleSaveCalendar()}>
                {calendarSaving ? 'Guardando...' : calendarEditingId ? 'Guardar cambios' : 'Crear calendario'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


