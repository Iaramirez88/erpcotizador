"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Bot, FileText, Mail, MessageCircle, PhoneCall } from 'lucide-react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type CrmOriginKey, getCrmOriginMeta } from '@/lib/crm-origin'

type TaskStatus = 'OPEN' | 'DONE' | 'CANCELED'
type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH'

type Task = {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  originKey?: CrmOriginKey | null
  originLabel?: string | null
  dueAt?: string | null
  assignedTo?: { id: string; name?: string | null; email?: string | null } | null
  lead?: { id: string; nombre: string; source?: string | null; originKey?: CrmOriginKey | null; originLabel?: string | null } | null
  cliente?: { id: string; nombre: string; documento: string } | null
}

type LeadOption = { id: string; nombre: string; empresaNombre?: string | null; email?: string | null; telefono?: string | null; source?: string | null; originKey?: CrmOriginKey | null; originLabel?: string | null }
type ClienteOption = { id: string; nombre: string; documento: string; email?: string | null; telefono?: string | null }
type Assignee = { id: string; name?: string | null; email?: string | null }
type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

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
  const Icon = originKey === 'EMAIL_GMAIL' || originKey === 'EMAIL_OUTLOOK'
    ? Mail
    : originKey === 'FORM_WEB'
      ? FileText
      : originKey === 'CHATBOT_WEB'
        ? Bot
        : originKey === 'PHONE_CALL'
          ? PhoneCall
          : MessageCircle

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getOriginTone(originKey)}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

export function CrmAgendaClient() {
  const searchParams = useSearchParams()
  const today = useMemo(() => new Date(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState(toDateKey(today))
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [tasks, setTasks] = useState<Task[]>([])
  const [leadSearch, setLeadSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([])
  const [clientOptions, setClientOptions] = useState<ClienteOption[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'NORMAL' as TaskPriority,
    dueAt: `${selectedDate}T09:00`,
    relationType: 'lead' as 'lead' | 'cliente',
    relationId: '',
    assignedToUserId: '',
  })

  async function loadTasks() {
    const taskRes = await requestJson<Task[]>('/api/crm/tasks')
    setTasks(Array.isArray(taskRes.data) ? taskRes.data : [])
  }

  async function loadMeta() {
    const [leadRes, clientRes, assigneeRes] = await Promise.all([
      requestJson<LeadOption[]>(`/api/crm/leads${leadSearch.trim() ? `?search=${encodeURIComponent(leadSearch.trim())}` : ''}`),
      requestJson<ClienteOption[]>(`/api/clientes${clientSearch.trim() ? `?search=${encodeURIComponent(clientSearch.trim())}` : ''}`),
      requestJson<Assignee[]>('/api/crm/assignees'),
    ])

    setLeadOptions(Array.isArray(leadRes.data) ? leadRes.data.slice(0, 12) : [])
    setClientOptions(Array.isArray(clientRes.data) ? clientRes.data.slice(0, 12) : [])
    setAssignees(Array.isArray(assigneeRes.data) ? assigneeRes.data : [])
  }

  async function loadData() {
    setLoading(true)
    try {
      await Promise.all([loadTasks(), loadMeta()])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    void loadMeta()
  }, [leadSearch, clientSearch])

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

  const selectedDayTasks = useMemo(() => {
    return tasks.filter((task) => (task.dueAt ? task.dueAt.slice(0, 10) === selectedDate : false))
  }, [selectedDate, tasks])

  const openTasks = useMemo(() => tasks.filter((task) => task.status === 'OPEN').length, [tasks])
  const overdueTasks = useMemo(() => tasks.filter((task) => task.status === 'OPEN' && task.dueAt && task.dueAt.slice(0, 10) < toDateKey(new Date())).length, [tasks])
  const scheduledToday = useMemo(() => tasks.filter((task) => task.dueAt && task.dueAt.slice(0, 10) === toDateKey(new Date())).length, [tasks])

  const monthGrid = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
    const start = new Date(firstDay)
    start.setDate(firstDay.getDate() - firstDay.getDay())

    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(start)
      current.setDate(start.getDate() + index)
      const dateKey = toDateKey(current)
      const dayTasks = tasks.filter((task) => task.dueAt && task.dueAt.slice(0, 10) === dateKey)
      return {
        date: current,
        dateKey,
        isCurrentMonth: current.getMonth() === visibleMonth.getMonth(),
        taskCount: dayTasks.length,
        openCount: dayTasks.filter((task) => task.status === 'OPEN').length,
      }
    })
  }, [tasks, visibleMonth])

  async function handleCreateTask() {
    if (!taskForm.title.trim()) {
      alert('El título es requerido para la agenda.')
      return
    }
    if (!taskForm.relationId) {
      alert('Debes seleccionar un prospecto o cliente para agendar.')
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
        ...(taskForm.relationType === 'lead' ? { leadId: taskForm.relationId } : { clienteId: taskForm.relationId }),
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
      await loadTasks()
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

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Agenda' },
        ]}
        eyebrow="CRM Agenda"
        title="Calendario comercial y agendamiento"
        description="Agenda prospectos y clientes, consulta compromisos por día y gestiona el seguimiento comercial desde una sola vista."
        actions={
          <>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/85">
              <Link href="/dashboard/crm">Volver al CRM</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/85">
              <Link href="/dashboard/chat">Ir al chat global</Link>
            </Button>
          </>
        }
        stats={[
          { label: 'Abiertas', value: openTasks, hint: 'Acciones pendientes', tone: 'sky' },
          { label: 'Vencidas', value: overdueTasks, hint: 'Requieren atención', tone: 'amber' },
          { label: 'Hoy', value: scheduledToday, hint: 'Compromisos del día', tone: 'teal' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">{formatMonth(visibleMonth)}</CardTitle>
                <CardDescription>Selecciona un día para ver y operar la agenda comercial.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                  Mes anterior
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                  Mes siguiente
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 md:p-5">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((label) => (
                <div key={label} className="rounded-2xl bg-slate-50/80 px-2 py-3">{label}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {monthGrid.map((day) => {
                const isSelected = day.dateKey === selectedDate
                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => setSelectedDate(day.dateKey)}
                    className={isSelected ? 'min-h-[108px] rounded-3xl border border-sky-300 bg-sky-50/80 p-3 text-left shadow-sm' : day.isCurrentMonth ? 'min-h-[108px] rounded-3xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md' : 'min-h-[108px] rounded-3xl border border-slate-100 bg-slate-50/60 p-3 text-left text-slate-400'}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{day.date.getDate()}</span>
                      {day.taskCount > 0 ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{day.taskCount}</span> : null}
                    </div>
                    <div className="mt-4 space-y-1">
                      {day.openCount > 0 ? <p className="text-xs text-slate-600">{day.openCount} abiertas</p> : <p className="text-xs text-slate-400">Sin agenda</p>}
                    </div>
                  </button>
                )
              })}
            </div>

            <Card className="rounded-3xl border-slate-200 bg-slate-50/70">
              <CardHeader>
                <CardTitle className="text-base">Agenda del {selectedDate}</CardTitle>
                <CardDescription>{loading ? 'Cargando tareas...' : `${selectedDayTasks.length} registros para el día seleccionado.`}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!loading && selectedDayTasks.length === 0 ? <p className="text-sm text-muted-foreground">No hay tareas agendadas para este día.</p> : null}
                {selectedDayTasks.map((task) => (
                  <div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        {(() => {
                          const origin = task.originKey && task.originLabel
                            ? { key: task.originKey, label: task.originLabel }
                            : task.lead?.originKey && task.lead?.originLabel
                              ? { key: task.lead.originKey, label: task.lead.originLabel }
                              : task.lead?.source
                                ? getCrmOriginMeta({ source: task.lead.source })
                                : null
                          return (
                            <div className="mb-2 flex flex-wrap gap-2">
                              {origin ? <OriginBadge originKey={origin.key} label={origin.label} /> : null}
                            </div>
                          )
                        })()}
                        <p className="font-semibold text-slate-950">{task.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{task.description || 'Sin descripción adicional.'}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>Prioridad: {task.priority}</span>
                          <span>Estado: {task.status}</span>
                          <span>{task.assignedTo?.name || task.assignedTo?.email || 'Sin responsable'}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          {task.lead ? <span>Prospecto: {task.lead.nombre}</span> : null}
                          {task.cliente ? <span>Cliente: {task.cliente.nombre}</span> : null}
                          <span>{formatDate(task.dueAt, 'Sin vencimiento')}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {task.status !== 'DONE' ? <Button variant="outline" className="rounded-xl" onClick={() => void updateTaskStatus(task.id, 'DONE')}>Completar</Button> : null}
                        {task.status !== 'OPEN' ? <Button variant="outline" className="rounded-xl" onClick={() => void updateTaskStatus(task.id, 'OPEN')}>Reabrir</Button> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Nueva agenda</CardTitle>
              <CardDescription>Programa una acción comercial para un prospecto o cliente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 md:p-5">
              <div className="grid gap-2">
                <Label>Título</Label>
                <Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ej. Llamada de seguimiento" />
              </div>
              <div className="grid gap-2">
                <Label>Descripción</Label>
                <Textarea value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="Detalles de la gestión comercial o reunión." />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Tipo de relación</Label>
                  <Select value={taskForm.relationType} onValueChange={(value) => setTaskForm((current) => ({ ...current, relationType: value as 'lead' | 'cliente', relationId: '' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Prospecto</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Fecha y hora</Label>
                  <Input type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))} />
                </div>
                <div className="grid gap-2">
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
              <div className="grid gap-2">
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
              <Button className="w-full rounded-xl" onClick={() => void handleCreateTask()} disabled={saving}>
                {saving ? 'Guardando...' : 'Agregar a la agenda'}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Buscar prospectos</CardTitle>
              <CardDescription>Selecciona un lead y llévalo directo a la agenda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 md:p-5">
              <Input value={leadSearch} onChange={(event) => setLeadSearch(event.target.value)} placeholder="Buscar lead por nombre, correo o teléfono..." />
              {leadOptions.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <div>
                    <p className="font-medium text-slate-950">{lead.nombre}</p>
                    {lead.originKey && lead.originLabel ? <div className="mt-1"><OriginBadge originKey={lead.originKey} label={lead.originLabel} /></div> : lead.source ? <div className="mt-1"><OriginBadge originKey={getCrmOriginMeta({ source: lead.source }).key} label={getCrmOriginMeta({ source: lead.source }).label} /></div> : null}
                    <p className="text-sm text-slate-500">{lead.empresaNombre || lead.email || lead.telefono || 'Sin datos adicionales'}</p>
                  </div>
                  <Button variant="outline" className="rounded-xl" onClick={() => setTaskForm((current) => ({ ...current, relationType: 'lead', relationId: lead.id }))}>
                    Agendar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Consultar clientes</CardTitle>
              <CardDescription>Busca clientes existentes y agenda seguimiento comercial.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 md:p-5">
              <Input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Buscar cliente por nombre, documento o correo..." />
              {clientOptions.map((cliente) => (
                <div key={cliente.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <div>
                    <p className="font-medium text-slate-950">{cliente.nombre}</p>
                    <p className="text-sm text-slate-500">{cliente.documento} · {cliente.email || cliente.telefono || 'Sin contacto directo'}</p>
                  </div>
                  <Button variant="outline" className="rounded-xl" onClick={() => setTaskForm((current) => ({ ...current, relationType: 'cliente', relationId: cliente.id }))}>
                    Agendar
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}