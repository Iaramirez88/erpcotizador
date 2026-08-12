"use client"

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ErpBreadcrumbs } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { CardInfoHeader } from '@/components/ui/card-info-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Bot, FileText, Mail, MessageCircle, PhoneCall } from 'lucide-react'
import { CrmLinkedFilesPanel } from '@/components/crm/crm-linked-files-panel'
import { useI18n } from '@/components/providers/i18n-provider'
import { type CrmOriginKey, getCrmOriginMeta } from '@/lib/crm-origin'

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST' | 'CONVERTED'
type OpportunityStage = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH'

type Props = {
  leadId: string
  canAccessAnyChat?: boolean
}

type StageSetting = {
  key: OpportunityStage
  label: string
  color?: string | null
  sortOrder: number
}

type Contact = {
  id: string
  nombre: string
  email?: string | null
  telefono?: string | null
  celular?: string | null
  cargo?: string | null
  notes?: string | null
  isPrimary: boolean
}

type LeadDetail = {
  id: string
  nombre: string
  empresaNombre?: string | null
  documento?: string | null
  email?: string | null
  telefono?: string | null
  celular?: string | null
  direccion?: string | null
  ciudad?: string | null
  notes?: string | null
  source: string
  originKey?: CrmOriginKey
  originLabel?: string
  status: LeadStatus
  createdAt: string
  lastActivityAt?: string | null
  convertedAt?: string | null
  convertedCliente?: { id: string; nombre: string; documento: string } | null
  ownerUser?: { id: string; name?: string | null; email?: string | null } | null
  createdBy?: { id: string; name?: string | null; email?: string | null } | null
  _count?: { opportunities: number; activities: number; tasks: number }
}

type Opportunity = {
  id: string
  title: string
  stage: OpportunityStage
  expectedValue: number
  probabilityPct: number
  expectedCloseAt?: string | null
  cotizacion?: { id: string; numero: string; estado: string; total: number } | null
  cliente?: { id: string; nombre: string; documento: string } | null
}

type Task = {
  id: string
  title: string
  status: string
  priority: TaskPriority
  dueAt?: string | null
}

type TimelineItem = {
  id: string
  itemType: 'activity' | 'task' | 'erp'
  eventAt: string
  data: {
    summary?: string
    type?: string
    title?: string
    status?: string
    priority?: string
    details?: string | null
    dueAt?: string | null
    createdBy?: { name?: string | null; email?: string | null } | null
    assignedTo?: { name?: string | null; email?: string | null } | null
    action?: string
    note?: string | null
    cotizacion?: { id: string; numero: string; estado: string; total: number } | null
    opportunity?: { id: string; title: string } | null
    performedBy?: { name?: string | null; email?: string | null } | null
    requestedBy?: { name?: string | null; email?: string | null } | null
  }
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

const DEFAULT_STAGE_SETTINGS: StageSetting[] = [
  { key: 'NEW', label: 'Nuevo', color: '#64748b', sortOrder: 10 },
  { key: 'QUALIFIED', label: 'Calificada', color: '#0f766e', sortOrder: 20 },
  { key: 'PROPOSAL', label: 'Propuesta', color: '#2563eb', sortOrder: 30 },
  { key: 'NEGOTIATION', label: 'Negociación', color: '#d97706', sortOrder: 40 },
  { key: 'WON', label: 'Ganada', color: '#16a34a', sortOrder: 50 },
  { key: 'LOST', label: 'Perdida', color: '#dc2626', sortOrder: 60 },
]

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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getOriginTone(originKey)}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}
const TASK_PRIORITY_OPTIONS: TaskPriority[] = ['LOW', 'NORMAL', 'HIGH']

function formatDate(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function formatMoney(value: number | null | undefined, locale: string) {
  const amount = typeof value === 'number' ? value : 0
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
  } catch {
    return String(amount)
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const res = await fetch(url, init)
  return (await res.json().catch(() => ({}))) as JsonResponse<T>
}

export function CrmLeadDetailClient(props: Props) {
  const { leadId } = props
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = '—'
  const whatsappPlaceholder = '+57 300 123 4567'
  const phonePlaceholder = '601 234 5678'

  const [loading, setLoading] = useState(true)
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [stageSettings, setStageSettings] = useState<StageSetting[]>(DEFAULT_STAGE_SETTINGS)

  const [activityDialogOpen, setActivityDialogOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [editingContactId, setEditingContactId] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [activityForm, setActivityForm] = useState({ summary: '', details: '' })
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'NORMAL' as TaskPriority, dueAt: '' })
  const [convertForm, setConvertForm] = useState({ tipoDocumento: 'NIT', documento: '', nombre: '', email: '', telefono: '', celular: '', direccion: '', ciudad: '' })
  const [contactForm, setContactForm] = useState({ nombre: '', email: '', telefono: '', celular: '', cargo: '', notes: '', isPrimary: false })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const leadRes = await requestJson<LeadDetail>(`/api/crm/leads/${leadId}`)
      const leadData = leadRes.success ? leadRes.data ?? null : null
      const contactQuery = leadData?.convertedCliente?.id
        ? `/api/crm/contacts?clienteId=${leadData.convertedCliente.id}`
        : `/api/crm/contacts?leadId=${leadId}`

      const [opportunityRes, taskRes, timelineRes, contactRes, stageRes] = await Promise.all([
        requestJson<Opportunity[]>(`/api/crm/opportunities?leadId=${leadId}`),
        requestJson<Task[]>(`/api/crm/tasks?leadId=${leadId}`),
        requestJson<TimelineItem[]>(`/api/crm/timeline?leadId=${leadId}`),
        requestJson<Contact[]>(contactQuery),
        requestJson<StageSetting[]>(`/api/crm/stages`),
      ])

      setLead(leadData)
      setOpportunities(Array.isArray(opportunityRes.data) ? opportunityRes.data : [])
      setTasks(Array.isArray(taskRes.data) ? taskRes.data : [])
      setTimeline(Array.isArray(timelineRes.data) ? timelineRes.data : [])
      setContacts(Array.isArray(contactRes.data) ? contactRes.data : [])
      setStageSettings(Array.isArray(stageRes.data) && stageRes.data.length ? [...stageRes.data].sort((a, b) => a.sortOrder - b.sortOrder) : DEFAULT_STAGE_SETTINGS)
    } finally {
      setLoading(false)
    }
  }, [leadId])

  const stageMap = new Map(stageSettings.map((stage) => [stage.key, stage]))
  const getStageLabel = (stage: OpportunityStage) => stageMap.get(stage)?.label || stage

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!lead) return
    setConvertForm({
      tipoDocumento: 'NIT',
      documento: lead.documento || '',
      nombre: lead.nombre || '',
      email: lead.email || '',
      telefono: lead.telefono || '',
      celular: lead.celular || '',
      direccion: lead.direccion || '',
      ciudad: lead.ciudad || '',
    })
  }, [lead])

  async function createActivity() {
    if (!activityForm.summary.trim()) {
      alert('El resumen es requerido.')
      return
    }
    setSaving(true)
    try {
      const json = await requestJson(`/api/crm/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'NOTE', summary: activityForm.summary, details: activityForm.details, leadId }),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo registrar la actividad.')
        return
      }
      setActivityDialogOpen(false)
      setActivityForm({ summary: '', details: '' })
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  async function createTask() {
    if (!taskForm.title.trim()) {
      alert('El título es requerido.')
      return
    }
    setSaving(true)
    try {
      const json = await requestJson(`/api/crm/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskForm, leadId }),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo crear la tarea.')
        return
      }
      setTaskDialogOpen(false)
      setTaskForm({ title: '', description: '', priority: 'NORMAL', dueAt: '' })
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  async function convertLead() {
    setSaving(true)
    try {
      const json = await requestJson(`/api/crm/leads/${leadId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(convertForm),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo convertir el lead.')
        return
      }
      setConvertDialogOpen(false)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  function openCreateContactDialog() {
    setEditingContactId(null)
    setContactForm({ nombre: '', email: '', telefono: '', celular: '', cargo: '', notes: '', isPrimary: false })
    setContactDialogOpen(true)
  }

  function openEditContactDialog(contact: Contact) {
    setEditingContactId(contact.id)
    setContactForm({
      nombre: contact.nombre,
      email: contact.email || '',
      telefono: contact.telefono || '',
      celular: contact.celular || '',
      cargo: contact.cargo || '',
      notes: contact.notes || '',
      isPrimary: contact.isPrimary,
    })
    setContactDialogOpen(true)
  }

  async function submitContact() {
    if (!contactForm.nombre.trim()) {
      alert('El nombre del contacto es requerido.')
      return
    }

    setSaving(true)
    try {
      const targetBody = lead?.convertedCliente?.id ? { clienteId: lead.convertedCliente.id } : { leadId }
      const json = await requestJson(editingContactId ? `/api/crm/contacts/${editingContactId}` : '/api/crm/contacts', {
        method: editingContactId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contactForm, ...targetBody }),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo guardar el contacto.')
        return
      }
      setContactDialogOpen(false)
      setEditingContactId(null)
      setContactForm({ nombre: '', email: '', telefono: '', celular: '', cargo: '', notes: '', isPrimary: false })
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando lead...</p>
  }

  if (!lead) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">No se encontró el lead.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard/crm">Volver al CRM</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <ErpBreadcrumbs
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'CRM', href: '/dashboard/crm' },
              { label: 'Lead', href: '/dashboard/crm' },
              { label: lead.nombre },
            ]}
          />
          <h1 className="text-2xl font-bold">{lead.nombre}</h1>
          <p className="text-sm text-muted-foreground">{lead.empresaNombre || 'Sin empresa'} · {lead.email || lead.telefono || lead.ciudad || naText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!lead.convertedCliente ? <Button variant="outline" onClick={() => setConvertDialogOpen(true)}>Convertir a cliente</Button> : null}
          <Button asChild variant="outline">
            <Link href="/dashboard/crm">Editar lead</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/crm/agenda?leadId=${lead.id}`}>Agendar prospecto</Link>
          </Button>
          {props.canAccessAnyChat ? <Button asChild variant="outline">
            <Link href="/dashboard/chat">Conversaciones</Link>
          </Button> : null}
          <Button variant="outline" onClick={openCreateContactDialog}>Nuevo contacto</Button>
          <Button variant="outline" onClick={() => setActivityDialogOpen(true)}>Agregar nota</Button>
          <Button onClick={() => setTaskDialogOpen(true)}>Nueva tarea</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardInfoHeader
              title={<CardTitle>Resumen</CardTitle>}
              description="Estado comercial y datos principales del lead."
              tone="data"
            />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</p>
              <p className="mt-1 text-sm">{lead.status}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fuente</p>
              {lead.originKey && lead.originLabel ? (
                <div className="mt-1">
                  <OriginBadge originKey={lead.originKey} label={lead.originLabel} />
                </div>
              ) : (
                <p className="mt-1 text-sm">{getCrmOriginMeta({ source: lead.source }).label}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documento</p>
              <p className="mt-1 text-sm">{lead.documento || naText}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Creado</p>
              <p className="mt-1 text-sm">{formatDate(lead.createdAt, locale, naText)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Última actividad</p>
              <p className="mt-1 text-sm">{formatDate(lead.lastActivityAt || lead.createdAt, locale, naText)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conversión</p>
              <p className="mt-1 text-sm">{lead.convertedCliente ? `${lead.convertedCliente.nombre} (${lead.convertedCliente.documento})` : 'Pendiente'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notas</p>
              <p className="mt-1 text-sm text-muted-foreground">{lead.notes || 'Sin notas registradas.'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardInfoHeader
              title={<CardTitle>Indicadores</CardTitle>}
              description="Actividad acumulada del lead."
              tone="data"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold">{lead._count?.opportunities ?? 0}</p>
              <p className="text-sm text-muted-foreground">Oportunidades</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{lead._count?.tasks ?? 0}</p>
              <p className="text-sm text-muted-foreground">Tareas</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{lead._count?.activities ?? 0}</p>
              <p className="text-sm text-muted-foreground">Actividades</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardInfoHeader
              title={<CardTitle>Timeline</CardTitle>}
              description="Notas, tareas y cambios relevantes asociados al lead."
              tone="data"
            />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {timeline.length === 0 ? <p className="text-sm text-muted-foreground">Sin eventos todavía.</p> : null}
              {timeline.map((item) => (
                <div key={`${item.itemType}-${item.id}`} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {item.itemType === 'activity'
                          ? item.data.summary || item.data.type
                          : item.itemType === 'task'
                            ? item.data.title
                            : item.data.summary || item.data.cotizacion?.numero || 'Evento ERP'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.itemType === 'activity'
                          ? item.data.details || `Registrado por ${item.data.createdBy?.name || item.data.createdBy?.email || 'sistema'}`
                          : item.itemType === 'task'
                            ? `${item.data.status || 'OPEN'} · ${item.data.priority || 'NORMAL'} · ${item.data.assignedTo?.name || item.data.assignedTo?.email || 'Sin asignar'}`
                            : item.data.details || `${item.data.cotizacion?.estado || item.data.action || 'ERP'} · ${item.data.performedBy?.name || item.data.performedBy?.email || 'sistema'}`}
                      </p>
                      {item.itemType === 'erp' && item.data.cotizacion ? (
                        <Button asChild variant="ghost" className="mt-2 h-auto p-0 text-primary">
                          <Link href={`/dashboard/cotizador?id=${item.data.cotizacion.id}`}>
                            Abrir {item.data.cotizacion.numero}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(item.eventAt, locale, naText)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <CrmLinkedFilesPanel
            entityType="LEAD"
            entityId={lead.id}
            title="Repositorio del lead"
            emptyLabel="Aún no hay archivos de biblioteca vinculados a este lead."
          />

          <Card>
            <CardHeader>
              <CardInfoHeader
                title={<CardTitle>Contactos</CardTitle>}
                description={lead.convertedCliente ? 'Contactos migrados al cliente convertido.' : 'Contactos asociados a este lead.'}
                tone="data"
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {contacts.length === 0 ? <p className="text-sm text-muted-foreground">Sin contactos registrados.</p> : null}
              {contacts.map((contact) => (
                <div key={contact.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{contact.nombre}</p>
                        {contact.isPrimary ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Principal</span> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{contact.cargo || 'Sin cargo'} · {contact.email || contact.telefono || contact.celular || naText}</p>
                      {contact.notes ? <p className="mt-1 text-xs text-muted-foreground">{contact.notes}</p> : null}
                    </div>
                    <Button variant="ghost" className="h-auto p-0 text-primary" onClick={() => openEditContactDialog(contact)}>Editar</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Oportunidades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opportunities.length === 0 ? <p className="text-sm text-muted-foreground">Sin oportunidades.</p> : null}
              {opportunities.map((row) => (
                <div key={row.id} className="rounded-lg border p-3">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{getStageLabel(row.stage)} · {row.probabilityPct}% · {formatMoney(row.expectedValue, locale)}</p>
                  {row.cotizacion ? (
                    <Button asChild variant="ghost" className="mt-2 h-auto p-0 text-primary">
                      <Link href={`/dashboard/cotizador?id=${row.cotizacion.id}`}>Abrir {row.cotizacion.numero}</Link>
                    </Button>
                  ) : row.cliente ? (
                    <Button asChild variant="ghost" className="mt-2 h-auto p-0 text-primary">
                      <Link href={`/dashboard/cotizador?crmOpportunityId=${row.id}&clienteId=${row.cliente.id}&opportunityTitle=${encodeURIComponent(row.title)}`}>
                        Crear cotización
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tareas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.length === 0 ? <p className="text-sm text-muted-foreground">Sin tareas.</p> : null}
              {tasks.map((task) => (
                <div key={task.id} className="rounded-lg border p-3">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.status} · {task.priority} · vence {formatDate(task.dueAt, locale, 'Sin fecha')}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva nota</DialogTitle>
            <DialogDescription>Agrega una observación al timeline del lead.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Resumen</Label>
              <Input value={activityForm.summary} onChange={(e) => setActivityForm((prev) => ({ ...prev, summary: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Detalle</Label>
              <Textarea value={activityForm.details} onChange={(e) => setActivityForm((prev) => ({ ...prev, details: e.target.value }))} rows={5} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void createActivity()} disabled={saving}>{saving ? 'Guardando...' : 'Guardar nota'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
            <DialogDescription>Programa la siguiente acción comercial para este lead.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Prioridad</Label>
                <Select value={taskForm.priority} onValueChange={(value) => setTaskForm((prev) => ({ ...prev, priority: value as TaskPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITY_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Vence</Label>
                <Input type="date" value={taskForm.dueAt} onChange={(e) => setTaskForm((prev) => ({ ...prev, dueAt: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea value={taskForm.description} onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void createTask()} disabled={saving}>{saving ? 'Guardando...' : 'Crear tarea'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingContactId ? 'Editar contacto' : 'Nuevo contacto'}</DialogTitle>
            <DialogDescription>{lead.convertedCliente ? 'Este contacto quedará asociado al cliente convertido.' : 'Agrega otro contacto comercial para este lead.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={contactForm.nombre} onChange={(e) => setContactForm((prev) => ({ ...prev, nombre: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={contactForm.email} onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Cargo</Label>
                <Input value={contactForm.cargo} onChange={(e) => setContactForm((prev) => ({ ...prev, cargo: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={contactForm.telefono} onChange={(e) => setContactForm((prev) => ({ ...prev, telefono: e.target.value }))} placeholder={phonePlaceholder} />
              </div>
              <div className="grid gap-2">
                <Label>WhatsApp / Celular</Label>
                <Input value={contactForm.celular} onChange={(e) => setContactForm((prev) => ({ ...prev, celular: e.target.value }))} placeholder={whatsappPlaceholder} />
                <p className="text-xs text-muted-foreground">Incluye el indicativo del país. Ejemplo: +57 300 123 4567.</p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea value={contactForm.notes} onChange={(e) => setContactForm((prev) => ({ ...prev, notes: e.target.value }))} rows={4} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={contactForm.isPrimary} onChange={(e) => setContactForm((prev) => ({ ...prev, isPrimary: e.target.checked }))} />
              Marcar como contacto principal
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void submitContact()} disabled={saving}>{saving ? 'Guardando...' : editingContactId ? 'Guardar cambios' : 'Crear contacto'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convertir a cliente</DialogTitle>
            <DialogDescription>Genera o vincula un cliente ERP a partir de este lead.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Tipo de documento</Label>
                <Select value={convertForm.tipoDocumento} onValueChange={(value) => setConvertForm((prev) => ({ ...prev, tipoDocumento: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NIT">NIT</SelectItem>
                    <SelectItem value="CC">CC</SelectItem>
                    <SelectItem value="CE">CE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Documento</Label>
                <Input value={convertForm.documento} onChange={(e) => setConvertForm((prev) => ({ ...prev, documento: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={convertForm.nombre} onChange={(e) => setConvertForm((prev) => ({ ...prev, nombre: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={convertForm.email} onChange={(e) => setConvertForm((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={convertForm.telefono} onChange={(e) => setConvertForm((prev) => ({ ...prev, telefono: e.target.value }))} placeholder={phonePlaceholder} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>WhatsApp / Celular</Label>
                <Input value={convertForm.celular} onChange={(e) => setConvertForm((prev) => ({ ...prev, celular: e.target.value }))} placeholder={whatsappPlaceholder} />
                <p className="text-xs text-muted-foreground">Incluye el indicativo del país. Ejemplo: +57 300 123 4567.</p>
              </div>
              <div className="grid gap-2">
                <Label>Ciudad</Label>
                <Input value={convertForm.ciudad} onChange={(e) => setConvertForm((prev) => ({ ...prev, ciudad: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Dirección</Label>
              <Input value={convertForm.direccion} onChange={(e) => setConvertForm((prev) => ({ ...prev, direccion: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void convertLead()} disabled={saving}>{saving ? 'Convirtiendo...' : 'Convertir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
