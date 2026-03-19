"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErpBreadcrumbs } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { useI18n } from '@/components/providers/i18n-provider'

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST' | 'CONVERTED'
type LeadSource = 'WEB' | 'REFERIDO' | 'WHATSAPP' | 'LLAMADA' | 'IMPORT' | 'OTRO'
type OpportunityStage = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
type TaskStatus = 'OPEN' | 'DONE' | 'CANCELED'
type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH'

type StageSetting = {
  key: OpportunityStage
  label: string
  color?: string | null
  sortOrder: number
}

type Lead = {
  id: string
  nombre: string
  empresaNombre?: string | null
  email?: string | null
  telefono?: string | null
  status: LeadStatus
  source: LeadSource
  ciudad?: string | null
  lastActivityAt?: string | null
  createdAt: string
  ownerUser?: { id: string; name?: string | null; email?: string | null } | null
  convertedCliente?: { id: string; nombre: string; documento: string } | null
  _count?: { opportunities: number; activities: number; tasks: number }
}

type Opportunity = {
  id: string
  title: string
  stage: OpportunityStage
  expectedValue: number
  probabilityPct: number
  expectedCloseAt?: string | null
  updatedAt: string
  lead?: { id: string; nombre: string; status: LeadStatus } | null
  cliente?: { id: string; nombre: string; documento: string } | null
  cotizacion?: { id: string; numero: string; estado: string; total: number } | null
  assignedTo?: { id: string; name?: string | null; email?: string | null } | null
  _count?: { activities: number; tasks: number }
}

type Task = {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  dueAt?: string | null
  completedAt?: string | null
  createdAt: string
  leadId?: string | null
  opportunityId?: string | null
  assignedTo?: { id: string; name?: string | null; email?: string | null } | null
  lead?: { id: string; nombre: string } | null
  opportunity?: { id: string; title: string; stage: OpportunityStage } | null
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

type LeadDetail = Lead & {
  notes?: string | null
}

type OpportunityDetail = Opportunity & {
  description?: string | null
}

const LEAD_SOURCE_OPTIONS: LeadSource[] = ['WEB', 'REFERIDO', 'WHATSAPP', 'LLAMADA', 'IMPORT', 'OTRO']
const LEAD_STATUS_OPTIONS: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'LOST', 'CONVERTED']
const DEFAULT_STAGE_SETTINGS: StageSetting[] = [
  { key: 'NEW', label: 'Nuevo', color: '#64748b', sortOrder: 10 },
  { key: 'QUALIFIED', label: 'Calificada', color: '#0f766e', sortOrder: 20 },
  { key: 'PROPOSAL', label: 'Propuesta', color: '#2563eb', sortOrder: 30 },
  { key: 'NEGOTIATION', label: 'Negociación', color: '#d97706', sortOrder: 40 },
  { key: 'WON', label: 'Ganada', color: '#16a34a', sortOrder: 50 },
  { key: 'LOST', label: 'Perdida', color: '#dc2626', sortOrder: 60 },
]
const TASK_STATUS_OPTIONS: TaskStatus[] = ['OPEN', 'DONE', 'CANCELED']
const TASK_PRIORITY_OPTIONS: TaskPriority[] = ['LOW', 'NORMAL', 'HIGH']

function formatMoney(value: number | null | undefined, locale: string) {
  const amount = typeof value === 'number' ? value : 0
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)
  } catch {
    return String(amount)
  }
}

function formatDate(value: string | null | undefined, locale: string, fallback: string) {
  if (!value) return fallback
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function withAlpha(color: string | null | undefined, alphaHex: string, fallback: string) {
  const raw = typeof color === 'string' ? color.trim() : ''
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return `${raw}${alphaHex}`
  return fallback
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const res = await fetch(url, init)
  return (await res.json().catch(() => ({}))) as JsonResponse<T>
}

export function CrmDashboardClient() {
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = '—'

  const [activeTab, setActiveTab] = useState<'leads' | 'opportunities' | 'tasks'>('leads')
  const [opportunityView, setOpportunityView] = useState<'list' | 'pipeline'>('list')
  const [draggingOpportunityId, setDraggingOpportunityId] = useState<string | null>(null)
  const [dragTargetStage, setDragTargetStage] = useState<OpportunityStage | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [leadStatusFilter, setLeadStatusFilter] = useState<'ALL' | LeadStatus>('ALL')
  const [opportunityStageFilter, setOpportunityStageFilter] = useState<'ALL' | OpportunityStage>('ALL')
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ALL' | TaskStatus>('ALL')
  const [leads, setLeads] = useState<Lead[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [stageSettings, setStageSettings] = useState<StageSetting[]>(DEFAULT_STAGE_SETTINGS)

  const [leadDialogOpen, setLeadDialogOpen] = useState(false)
  const [opportunityDialogOpen, setOpportunityDialogOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [stageDialogOpen, setStageDialogOpen] = useState(false)
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null)
  const [editingOpportunityId, setEditingOpportunityId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [savingLead, setSavingLead] = useState(false)
  const [savingOpportunity, setSavingOpportunity] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [savingStages, setSavingStages] = useState(false)
  const [stageDrafts, setStageDrafts] = useState<StageSetting[]>(DEFAULT_STAGE_SETTINGS)

  const [leadForm, setLeadForm] = useState({
    nombre: '',
    empresaNombre: '',
    email: '',
    telefono: '',
    ciudad: '',
    source: 'OTRO' as LeadSource,
    status: 'NEW' as LeadStatus,
    notes: '',
  })

  const [opportunityForm, setOpportunityForm] = useState({
    title: '',
    description: '',
    stage: 'NEW' as OpportunityStage,
    leadId: '',
    expectedValue: '',
    probabilityPct: '0',
    expectedCloseAt: '',
  })

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    status: 'OPEN' as TaskStatus,
    priority: 'NORMAL' as TaskPriority,
    leadId: '',
    opportunityId: '',
    dueAt: '',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const leadParams = new URLSearchParams()
      const opportunityParams = new URLSearchParams()
      const taskParams = new URLSearchParams()
      const trimmedSearch = search.trim()

      if (trimmedSearch) {
        leadParams.set('search', trimmedSearch)
        opportunityParams.set('search', trimmedSearch)
        taskParams.set('search', trimmedSearch)
      }
      if (leadStatusFilter !== 'ALL') leadParams.set('status', leadStatusFilter)
      if (opportunityStageFilter !== 'ALL') opportunityParams.set('stage', opportunityStageFilter)
      if (taskStatusFilter !== 'ALL') taskParams.set('status', taskStatusFilter)

      const leadSuffix = leadParams.toString() ? `?${leadParams.toString()}` : ''
      const opportunitySuffix = opportunityParams.toString() ? `?${opportunityParams.toString()}` : ''
      const taskSuffix = taskParams.toString() ? `?${taskParams.toString()}` : ''

      const [leadRes, opportunityRes, taskRes, stageRes] = await Promise.all([
        requestJson<Lead[]>(`/api/crm/leads${leadSuffix}`),
        requestJson<Opportunity[]>(`/api/crm/opportunities${opportunitySuffix}`),
        requestJson<Task[]>(`/api/crm/tasks${taskSuffix}`),
        requestJson<StageSetting[]>(`/api/crm/stages`),
      ])

      setLeads(Array.isArray(leadRes.data) ? leadRes.data : [])
      setOpportunities(Array.isArray(opportunityRes.data) ? opportunityRes.data : [])
      setTasks(Array.isArray(taskRes.data) ? taskRes.data : [])
      const nextStages = Array.isArray(stageRes.data) && stageRes.data.length
        ? [...stageRes.data].sort((a, b) => a.sortOrder - b.sortOrder)
        : DEFAULT_STAGE_SETTINGS
      setStageSettings(nextStages)
      setStageDrafts(nextStages)
    } finally {
      setLoading(false)
    }
  }, [leadStatusFilter, opportunityStageFilter, search, taskStatusFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const stats = useMemo(() => {
    const activeLeads = leads.filter((lead) => lead.status !== 'CONVERTED' && lead.status !== 'LOST').length
    const pipelineValue = opportunities.reduce((sum, row) => sum + (row.expectedValue || 0), 0)
    const openTasks = tasks.filter((task) => task.status === 'OPEN').length
    return { activeLeads, pipelineValue, openTasks }
  }, [leads, opportunities, tasks])

  const stageMap = useMemo(() => {
    return new Map(stageSettings.map((stage) => [stage.key, stage]))
  }, [stageSettings])

  const getStageLabel = (stage: OpportunityStage) => stageMap.get(stage)?.label || stage
  const getStageColor = (stage: OpportunityStage) => stageMap.get(stage)?.color || null

  const opportunitiesByStage = useMemo(() => {
    return stageSettings.map((stage) => {
      const items = opportunities.filter((row) => row.stage === stage.key)
      const total = items.reduce((sum, row) => sum + (row.expectedValue || 0), 0)
      return { ...stage, items, total }
    })
  }, [opportunities, stageSettings])

  function resetLeadForm() {
    setLeadForm({ nombre: '', empresaNombre: '', email: '', telefono: '', ciudad: '', source: 'OTRO', status: 'NEW', notes: '' })
  }

  function resetOpportunityForm() {
    setOpportunityForm({
      title: '',
      description: '',
      stage: stageSettings[0]?.key ?? 'NEW',
      leadId: '',
      expectedValue: '',
      probabilityPct: '0',
      expectedCloseAt: '',
    })
  }

  function resetTaskForm() {
    setTaskForm({ title: '', description: '', status: 'OPEN', priority: 'NORMAL', leadId: '', opportunityId: '', dueAt: '' })
  }

  function openCreateTaskDialog() {
    setEditingTaskId(null)
    resetTaskForm()
    setTaskDialogOpen(true)
  }

  function openCreateLeadDialog() {
    setEditingLeadId(null)
    resetLeadForm()
    setLeadDialogOpen(true)
  }

  async function openEditLeadDialog(lead: Lead) {
    const json = await requestJson<LeadDetail>(`/api/crm/leads/${lead.id}`)
    if (!json.success || !json.data) {
      alert(json.error || 'No se pudo cargar el lead para edición.')
      return
    }

    const row = json.data
    setEditingLeadId(row.id)
    setLeadForm({
      nombre: row.nombre,
      empresaNombre: row.empresaNombre || '',
      email: row.email || '',
      telefono: row.telefono || '',
      ciudad: row.ciudad || '',
      source: row.source,
      status: row.status,
      notes: row.notes || '',
    })
    setLeadDialogOpen(true)
  }

  function openCreateOpportunityDialog() {
    setEditingOpportunityId(null)
    resetOpportunityForm()
    setOpportunityDialogOpen(true)
  }

  function openStageDialog() {
    setStageDrafts(stageSettings.map((item) => ({ ...item })))
    setStageDialogOpen(true)
  }

  function updateStageDraft(key: OpportunityStage, patch: Partial<StageSetting>) {
    setStageDrafts((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  async function submitStageSettings() {
    setSavingStages(true)
    try {
      const payload = stageDrafts
        .map((item) => ({
          ...item,
          label: item.label.trim(),
          color: item.color?.trim() || null,
          sortOrder: Number(item.sortOrder) || 0,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder)

      const json = await requestJson<StageSetting[]>('/api/crm/stages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: payload }),
      })
      if (!json.success || !Array.isArray(json.data)) {
        alert(json.error || 'No se pudo actualizar el pipeline.')
        return
      }
      const next = [...json.data].sort((a, b) => a.sortOrder - b.sortOrder)
      setStageSettings(next)
      setStageDrafts(next)
      setStageDialogOpen(false)
    } finally {
      setSavingStages(false)
    }
  }

  async function openEditOpportunityDialog(opportunity: Opportunity) {
    const json = await requestJson<OpportunityDetail>(`/api/crm/opportunities/${opportunity.id}`)
    if (!json.success || !json.data) {
      alert(json.error || 'No se pudo cargar la oportunidad para edición.')
      return
    }

    const row = json.data
    setEditingOpportunityId(row.id)
    setOpportunityForm({
      title: row.title,
      description: row.description || '',
      stage: row.stage,
      leadId: row.lead?.id || '',
      expectedValue: String(row.expectedValue ?? ''),
      probabilityPct: String(row.probabilityPct ?? 0),
      expectedCloseAt: row.expectedCloseAt ? new Date(row.expectedCloseAt).toISOString().slice(0, 10) : '',
    })
    setOpportunityDialogOpen(true)
  }

  function openEditTaskDialog(task: Task) {
    setEditingTaskId(task.id)
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      leadId: task.leadId || task.lead?.id || '',
      opportunityId: task.opportunityId || task.opportunity?.id || '',
      dueAt: task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : '',
    })
    setTaskDialogOpen(true)
  }

  function clearFilters() {
    setSearch('')
    setLeadStatusFilter('ALL')
    setOpportunityStageFilter('ALL')
    setTaskStatusFilter('ALL')
  }

  async function submitLead() {
    if (!leadForm.nombre.trim()) {
      alert('El nombre del lead es requerido.')
      return
    }

    setSavingLead(true)
    try {
      const isEditing = Boolean(editingLeadId)
      const json = await requestJson<Lead>(isEditing ? `/api/crm/leads/${editingLeadId}` : '/api/crm/leads', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadForm),
      })
      if (!json.success) {
        alert(json.error || (isEditing ? 'No se pudo actualizar el lead.' : 'No se pudo crear el lead.'))
        return
      }
      setLeadDialogOpen(false)
      setEditingLeadId(null)
      resetLeadForm()
      await loadData()
    } finally {
      setSavingLead(false)
    }
  }

  async function submitOpportunity() {
    if (!opportunityForm.title.trim() || !opportunityForm.leadId) {
      alert('Título y lead son requeridos para la oportunidad.')
      return
    }

    setSavingOpportunity(true)
    try {
      const isEditing = Boolean(editingOpportunityId)
      const json = await requestJson<Opportunity>(isEditing ? `/api/crm/opportunities/${editingOpportunityId}` : '/api/crm/opportunities', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opportunityForm),
      })
      if (!json.success) {
        alert(json.error || (isEditing ? 'No se pudo actualizar la oportunidad.' : 'No se pudo crear la oportunidad.'))
        return
      }
      setOpportunityDialogOpen(false)
      setEditingOpportunityId(null)
      resetOpportunityForm()
      await loadData()
    } finally {
      setSavingOpportunity(false)
    }
  }

  async function updateOpportunityStage(opportunityId: string, stage: OpportunityStage) {
    const json = await requestJson<Opportunity>(`/api/crm/opportunities/${opportunityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
    if (!json.success) {
      alert(json.error || 'No se pudo actualizar la etapa de la oportunidad.')
      return
    }
    await loadData()
  }

  async function submitTask() {
    if (!taskForm.title.trim()) {
      alert('El título es requerido para la tarea.')
      return
    }

    if (!editingTaskId && !taskForm.leadId && !taskForm.opportunityId) {
      alert('Título y una relación (lead u oportunidad) son requeridos para la tarea.')
      return
    }

    setSavingTask(true)
    try {
      const isEditing = Boolean(editingTaskId)
      const json = await requestJson<Task>(isEditing ? `/api/crm/tasks/${editingTaskId}` : '/api/crm/tasks', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEditing
          ? {
              title: taskForm.title,
              description: taskForm.description,
              status: taskForm.status,
              priority: taskForm.priority,
              dueAt: taskForm.dueAt,
            }
          : taskForm),
      })
      if (!json.success) {
        alert(json.error || (isEditing ? 'No se pudo actualizar la tarea.' : 'No se pudo crear la tarea.'))
        return
      }
      setTaskDialogOpen(false)
      setEditingTaskId(null)
      resetTaskForm()
      await loadData()
    } finally {
      setSavingTask(false)
    }
  }

  async function completeTask(taskId: string) {
    const json = await requestJson<Task>(`/api/crm/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DONE' }),
    })
    if (!json.success) {
      alert(json.error || 'No se pudo completar la tarea.')
      return
    }
    await loadData()
  }

  async function updateTaskStatus(taskId: string, status: TaskStatus) {
    const json = await requestJson<Task>(`/api/crm/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!json.success) {
      alert(json.error || 'No se pudo actualizar el estado de la tarea.')
      return
    }
    await loadData()
  }

  function handleOpportunityDragStart(opportunityId: string) {
    setDraggingOpportunityId(opportunityId)
  }

  function handleOpportunityDragEnd() {
    setDraggingOpportunityId(null)
    setDragTargetStage(null)
  }

  async function handleOpportunityDrop(stage: OpportunityStage) {
    if (!draggingOpportunityId) return

    const current = opportunities.find((row) => row.id === draggingOpportunityId)
    setDraggingOpportunityId(null)
    setDragTargetStage(null)
    if (!current || current.stage === stage) return

    await updateOpportunityStage(draggingOpportunityId, stage)
  }

  return (
    <div className="space-y-6 pb-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.18),_transparent_32%),linear-gradient(135deg,_#fffdf8_0%,_#f8fbff_48%,_#f2f7f4_100%)] shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)]">
        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)] xl:items-start lg:p-8">
          <div className="space-y-4">
            <ErpBreadcrumbs
              items={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'CRM' },
              ]}
            />
            <div className="inline-flex items-center rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700 backdrop-blur">
              CRM Comercial
            </div>
            <div className="space-y-2">
              <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">Visibilidad comercial clara para leads, oportunidades y seguimiento.</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 lg:text-base">Centraliza prospección, pipeline y tareas en una sola vista con contexto ERP, cotizaciones vinculadas y señales de cierre más claras.</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="relative min-w-0 max-w-xl flex-1">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por lead, oportunidad o cliente..." className="h-12 rounded-2xl border-slate-200 bg-white/90 pr-4 shadow-sm" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="h-12 rounded-2xl border-emerald-200 bg-emerald-50/80 px-5 text-emerald-800 hover:bg-emerald-100">
                  <Link href="/dashboard/crm/chatbot">Panel chatbot</Link>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white/80 px-5">
                  <Link href="/dashboard/crm/conversations">Bandeja omnicanal</Link>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white/80 px-5">
                  <Link href="/dashboard/crm/integraciones">Integraciones</Link>
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white/80 px-5" onClick={openStageDialog}>Configurar pipeline</Button>
                <Button variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white/80 px-5" onClick={() => void loadData()}>Refrescar</Button>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:self-start">
            <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-sm backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Leads activos</p>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{stats.activeLeads}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Prospectos en seguimiento comercial.</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-emerald-200/80 bg-[linear-gradient(180deg,_rgba(236,253,245,0.95),_rgba(255,255,255,0.9))] p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Pipeline estimado</p>
              <p className="mt-3 text-3xl font-semibold text-emerald-950">{formatMoney(stats.pipelineValue, locale)}</p>
              <p className="mt-1 text-xs leading-5 text-emerald-700/80">Valor proyectado de oportunidades activas.</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-amber-200/80 bg-[linear-gradient(180deg,_rgba(255,251,235,0.96),_rgba(255,255,255,0.9))] p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">Tareas abiertas</p>
              <p className="mt-3 text-3xl font-semibold text-amber-950">{stats.openTasks}</p>
              <p className="mt-1 text-xs leading-5 text-amber-700/80">Pendientes que requieren acción del equipo.</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="rounded-[26px] border-slate-200 bg-white/90 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.35)]">
        <CardContent className="grid gap-3 p-4 md:grid-cols-4 md:p-5">
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado lead</Label>
            <Select value={leadStatusFilter} onValueChange={(value) => setLeadStatusFilter(value as 'ALL' | LeadStatus)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {LEAD_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Etapa oportunidad</Label>
            <Select value={opportunityStageFilter} onValueChange={(value) => setOpportunityStageFilter(value as 'ALL' | OpportunityStage)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                {stageSettings.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
            <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado tarea</Label>
            <Select value={taskStatusFilter} onValueChange={(value) => setTaskStatusFilter(value as 'ALL' | TaskStatus)}>
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas</SelectItem>
                {TASK_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-3">
            <Button variant="outline" className="h-11 w-full rounded-xl border-slate-200 bg-white" onClick={clearFilters}>Limpiar filtros</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'leads' | 'opportunities' | 'tasks')}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="h-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <TabsTrigger value="leads" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Leads</TabsTrigger>
            <TabsTrigger value="opportunities" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Oportunidades</TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Tareas</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100">
              <Link href="/dashboard/crm/chatbot">Mensajes chatbot</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white">
              <Link href="/dashboard/crm/integraciones">Canales e integraciones</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white">
              <Link href="/dashboard/crm/conversations">Inbox omnicanal</Link>
            </Button>
            <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={openCreateLeadDialog}>Nuevo lead</Button>
            <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={openCreateOpportunityDialog}>Nueva oportunidad</Button>
            <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={openCreateTaskDialog}>Nueva tarea</Button>
          </div>
        </div>

        <TabsContent value="leads" className="space-y-4 pt-4">
          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Leads ({leads.length})</CardTitle>
              <CardDescription>Prospectos comerciales con acceso rápido al detalle, timeline y conversión.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <div className="space-y-3">
                {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
                {!loading && leads.length === 0 ? <p className="text-sm text-muted-foreground">No hay leads para mostrar.</p> : null}
                {leads.map((lead) => (
                  <div key={lead.id} className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-5 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/dashboard/crm/leads/${lead.id}`} className="text-lg font-semibold text-sky-700 hover:text-sky-800 hover:underline">
                            {lead.nombre}
                          </Link>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{lead.status}</span>
                          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">{lead.source}</span>
                        </div>
                        <div className="grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                          <p>{lead.empresaNombre || 'Sin empresa'} · {lead.email || lead.telefono || lead.ciudad || naText}</p>
                          <p>Última actividad: {formatDate(lead.lastActivityAt || lead.createdAt, locale, naText)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 lg:flex-nowrap">
                        <div className="grid min-w-[132px] grid-cols-[auto_1fr] items-center gap-x-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Oportunidades</p>
                          <p className="text-base font-semibold text-slate-900">{lead._count?.opportunities ?? 0}</p>
                        </div>
                        <div className="grid min-w-[108px] grid-cols-[auto_1fr] items-center gap-x-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Tareas</p>
                          <p className="text-base font-semibold text-slate-900">{lead._count?.tasks ?? 0}</p>
                        </div>
                        <Button
                          variant="ghost"
                          className="h-10 rounded-xl border border-slate-200 px-3 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                          onClick={() => void openEditLeadDialog(lead)}
                        >
                          Editar lead
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-4 pt-4">
          <div className="flex items-center justify-end gap-2">
            <Button variant={opportunityView === 'list' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setOpportunityView('list')}>
              Lista
            </Button>
            <Button variant={opportunityView === 'pipeline' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setOpportunityView('pipeline')}>
              Pipeline
            </Button>
          </div>

          {opportunityView === 'pipeline' ? (
            <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
              {opportunitiesByStage.map((column) => (
                <Card
                  key={column.key}
                  className={`overflow-hidden rounded-[26px] border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)] ${dragTargetStage === column.key ? 'ring-2 ring-sky-400' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (draggingOpportunityId) setDragTargetStage(column.key)
                  }}
                  onDragLeave={() => {
                    if (dragTargetStage === column.key) setDragTargetStage(null)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    void handleOpportunityDrop(column.key)
                  }}
                >
                  <CardHeader className="border-b border-slate-100 pb-4" style={{ background: `linear-gradient(180deg, ${withAlpha(column.color, '18', 'rgba(148,163,184,0.12)')}, rgba(255,255,255,0.96))` }}>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base text-slate-900">{column.label}</CardTitle>
                      <span className="rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold text-slate-600">{column.items.length}</span>
                    </div>
                    <CardDescription>{formatMoney(column.total, locale)} proyectado</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    {column.items.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">Sin movimientos.</p> : null}
                    {column.items.map((row) => (
                      <div
                        key={row.id}
                        className={row.id === draggingOpportunityId ? 'rounded-3xl border border-dashed border-sky-300 bg-sky-50/60 p-4 opacity-70' : 'rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md'}
                        draggable
                        onDragStart={() => handleOpportunityDragStart(row.id)}
                        onDragEnd={handleOpportunityDragEnd}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold leading-tight text-slate-900">{row.title}</p>
                              <p className="mt-1 text-sm text-slate-500">{row.lead?.nombre || row.cliente?.nombre || 'Sin relación'}</p>
                            </div>
                            <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: withAlpha(column.color, '18', '#e2e8f0'), color: column.color || '#475569' }}>
                              {row.probabilityPct}%
                            </span>
                          </div>
                          <div className="grid gap-2 text-xs text-slate-500">
                            <div className="flex items-center justify-between">
                              <span>Cierre estimado</span>
                              <span>{formatDate(row.expectedCloseAt, locale, 'Sin fecha')}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Valor</span>
                              <span className="font-semibold text-slate-900">{formatMoney(row.expectedValue, locale)}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {row.cotizacion ? (
                              <Button asChild variant="ghost" className="h-8 rounded-full px-3 text-sky-700 hover:bg-sky-50 hover:text-sky-800">
                                <Link href={`/dashboard/cotizador?id=${row.cotizacion.id}`}>{row.cotizacion.numero}</Link>
                              </Button>
                            ) : row.cliente ? (
                              <Button asChild variant="ghost" className="h-8 rounded-full px-3 text-sky-700 hover:bg-sky-50 hover:text-sky-800">
                                <Link href={`/dashboard/cotizador?crmOpportunityId=${row.id}&clienteId=${row.cliente.id}&opportunityTitle=${encodeURIComponent(row.title)}`}>
                                  Cotizar
                                </Link>
                              </Button>
                            ) : null}
                            <Button variant="ghost" className="h-8 rounded-full px-3 text-slate-600 hover:bg-slate-100 hover:text-slate-900" onClick={() => void openEditOpportunityDialog(row)}>
                              Editar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          {opportunityView === 'list' ? (
            <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="text-xl">Oportunidades ({opportunities.length})</CardTitle>
                <CardDescription>Pipeline comercial con valor esperado, probabilidad y acceso directo al cotizador.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-5">
                <div className="space-y-3">
                  {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
                  {!loading && opportunities.length === 0 ? <p className="text-sm text-muted-foreground">No hay oportunidades para mostrar.</p> : null}
                  {opportunities.map((row) => (
                    <div key={row.id} className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-5 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold text-slate-900">{row.title}</span>
                            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${getStageColor(row.stage) || '#f59e0b'}22`, color: getStageColor(row.stage) || '#b45309' }}>
                              {getStageLabel(row.stage)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">{row.lead?.nombre || row.cliente?.nombre || 'Sin relación'} · cierre estimado {formatDate(row.expectedCloseAt, locale, 'Sin fecha')}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            <span>Actualizada: {formatDate(row.updatedAt, locale, naText)}</span>
                            <span>Probabilidad: {row.probabilityPct}%</span>
                          </div>
                        </div>
                        <div className="min-w-[220px] rounded-2xl bg-slate-50 p-4 text-right">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Valor esperado</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-950">{formatMoney(row.expectedValue, locale)}</p>
                          {row.cotizacion ? (
                            <Button asChild variant="ghost" className="mt-3 h-auto p-0 text-sky-700 hover:text-sky-800">
                              <Link href={`/dashboard/cotizador?id=${row.cotizacion.id}`}>Abrir {row.cotizacion.numero}</Link>
                            </Button>
                          ) : row.cliente ? (
                            <Button asChild variant="ghost" className="mt-3 h-auto p-0 text-sky-700 hover:text-sky-800">
                              <Link href={`/dashboard/cotizador?crmOpportunityId=${row.id}&clienteId=${row.cliente.id}&opportunityTitle=${encodeURIComponent(row.title)}`}>
                                Crear cotización
                              </Link>
                            </Button>
                          ) : (
                            <p className="mt-3 text-xs text-amber-600">Convierte el lead a cliente para cotizar.</p>
                          )}
                          <Button variant="ghost" className="mt-2 h-auto p-0 text-slate-600 hover:text-slate-900" onClick={() => void openEditOpportunityDialog(row)}>Editar</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4 pt-4">
          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Tareas ({tasks.length})</CardTitle>
              <CardDescription>Seguimiento comercial pendiente, reprogramación y cierre de pendientes.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <div className="space-y-3">
                {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
                {!loading && tasks.length === 0 ? <p className="text-sm text-muted-foreground">No hay tareas para mostrar.</p> : null}
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-5 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-semibold text-slate-900">{task.title}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{task.status}</span>
                          <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">{task.priority}</span>
                        </div>
                        <p className="text-sm text-slate-600">{task.opportunity?.title || task.lead?.nombre || 'Sin relación'} · vence {formatDate(task.dueAt, locale, 'Sin fecha')}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {task.status !== 'DONE' ? (
                          <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => void completeTask(task.id)}>Marcar hecha</Button>
                        ) : null}
                        {task.status === 'DONE' ? (
                          <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => void updateTaskStatus(task.id, 'OPEN')}>Reabrir</Button>
                        ) : null}
                        {task.status !== 'CANCELED' ? (
                          <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => void updateTaskStatus(task.id, 'CANCELED')}>Cancelar</Button>
                        ) : null}
                        <Button variant="ghost" className="rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900" onClick={() => openEditTaskDialog(task)}>Editar</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLeadId ? 'Editar lead' : 'Nuevo lead'}</DialogTitle>
            <DialogDescription>{editingLeadId ? 'Actualiza la información comercial del prospecto.' : 'Registra un prospecto para iniciar el seguimiento comercial.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={leadForm.nombre} onChange={(e) => setLeadForm((prev) => ({ ...prev, nombre: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Empresa</Label>
              <Input value={leadForm.empresaNombre} onChange={(e) => setLeadForm((prev) => ({ ...prev, empresaNombre: e.target.value }))} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={leadForm.email} onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={leadForm.telefono} onChange={(e) => setLeadForm((prev) => ({ ...prev, telefono: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Estado</Label>
                <Select value={leadForm.status} onValueChange={(value) => setLeadForm((prev) => ({ ...prev, status: value as LeadStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Ciudad</Label>
                <Input value={leadForm.ciudad} onChange={(e) => setLeadForm((prev) => ({ ...prev, ciudad: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Fuente</Label>
                <Select value={leadForm.source} onValueChange={(value) => setLeadForm((prev) => ({ ...prev, source: value as LeadSource }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCE_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea value={leadForm.notes} onChange={(e) => setLeadForm((prev) => ({ ...prev, notes: e.target.value }))} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setLeadDialogOpen(false); setEditingLeadId(null); resetLeadForm() }}>Cancelar</Button>
            <Button onClick={() => void submitLead()} disabled={savingLead}>{savingLead ? 'Guardando...' : editingLeadId ? 'Guardar cambios' : 'Crear lead'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={opportunityDialogOpen} onOpenChange={setOpportunityDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingOpportunityId ? 'Editar oportunidad' : 'Nueva oportunidad'}</DialogTitle>
            <DialogDescription>{editingOpportunityId ? 'Ajusta etapa, valor esperado y probabilidad de cierre.' : 'Asocia la oportunidad a un lead existente y define el valor esperado.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={opportunityForm.title} onChange={(e) => setOpportunityForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            {!editingOpportunityId ? (
              <div className="grid gap-2">
                <Label>Lead</Label>
                <Select value={opportunityForm.leadId} onValueChange={(value) => setOpportunityForm((prev) => ({ ...prev, leadId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un lead" /></SelectTrigger>
                  <SelectContent>
                    {leads.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-1">
                <Label>Etapa</Label>
                <Select value={opportunityForm.stage} onValueChange={(value) => setOpportunityForm((prev) => ({ ...prev, stage: value as OpportunityStage }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {stageSettings.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Valor esperado</Label>
                <Input value={opportunityForm.expectedValue} onChange={(e) => setOpportunityForm((prev) => ({ ...prev, expectedValue: e.target.value }))} placeholder="1500000" />
              </div>
              <div className="grid gap-2">
                <Label>Probabilidad %</Label>
                <Input value={opportunityForm.probabilityPct} onChange={(e) => setOpportunityForm((prev) => ({ ...prev, probabilityPct: e.target.value }))} placeholder="60" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Cierre estimado</Label>
              <Input type="date" value={opportunityForm.expectedCloseAt} onChange={(e) => setOpportunityForm((prev) => ({ ...prev, expectedCloseAt: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea value={opportunityForm.description} onChange={(e) => setOpportunityForm((prev) => ({ ...prev, description: e.target.value }))} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpportunityDialogOpen(false); setEditingOpportunityId(null); resetOpportunityForm() }}>Cancelar</Button>
            <Button onClick={() => void submitOpportunity()} disabled={savingOpportunity}>{savingOpportunity ? 'Guardando...' : editingOpportunityId ? 'Guardar cambios' : 'Crear oportunidad'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
            <DialogDescription>{editingTaskId ? 'Actualiza prioridad, vencimiento o descripción de la tarea.' : 'Agenda una acción comercial ligada a un lead u oportunidad.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={taskForm.title} onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            {!editingTaskId ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Lead</Label>
                  <Select value={taskForm.leadId || '__none__'} onValueChange={(value) => setTaskForm((prev) => ({ ...prev, leadId: value === '__none__' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin lead</SelectItem>
                      {leads.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Oportunidad</Label>
                  <Select value={taskForm.opportunityId || '__none__'} onValueChange={(value) => setTaskForm((prev) => ({ ...prev, opportunityId: value === '__none__' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin oportunidad</SelectItem>
                      {opportunities.map((row) => <SelectItem key={row.id} value={row.id}>{row.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Estado</Label>
                <Select value={taskForm.status} onValueChange={(value) => setTaskForm((prev) => ({ ...prev, status: value as TaskStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            <Button variant="outline" onClick={() => { setTaskDialogOpen(false); setEditingTaskId(null); resetTaskForm() }}>Cancelar</Button>
            <Button onClick={() => void submitTask()} disabled={savingTask}>{savingTask ? 'Guardando...' : editingTaskId ? 'Guardar cambios' : 'Crear tarea'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar pipeline</DialogTitle>
            <DialogDescription>Define el nombre, orden y color de cada etapa comercial para esta empresa.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {stageDrafts
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((stage) => (
                <div key={stage.key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[140px_1fr_120px_110px] sm:items-end">
                  <div className="grid gap-2">
                    <Label>Clave</Label>
                    <Input value={stage.key} disabled />
                  </div>
                  <div className="grid gap-2">
                    <Label>Nombre visible</Label>
                    <Input value={stage.label} onChange={(e) => updateStageDraft(stage.key, { label: e.target.value })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Orden</Label>
                    <Input type="number" value={stage.sortOrder} onChange={(e) => updateStageDraft(stage.key, { sortOrder: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Color</Label>
                    <Input type="color" value={stage.color || '#64748b'} onChange={(e) => updateStageDraft(stage.key, { color: e.target.value })} />
                  </div>
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStageDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void submitStageSettings()} disabled={savingStages}>{savingStages ? 'Guardando...' : 'Guardar pipeline'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
