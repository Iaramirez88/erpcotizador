"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
import { ArrowUpRight, Bot, CalendarClock, CircleDot, FileText, GripVertical, Mail, MessageCircle, PhoneCall, Plus, Sparkles, UserRound } from 'lucide-react'
import { CrmLinkedFilesPanel } from '@/components/crm/crm-linked-files-panel'
import { CrmNegotiationsTabs } from '@/components/crm/crm-negotiations-tabs'
import { useI18n } from '@/components/providers/i18n-provider'
import { type CrmOriginKey, getCrmOriginMeta } from '@/lib/crm-origin'

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST' | 'CONVERTED'
type LeadSource = 'WEB' | 'REFERIDO' | 'WHATSAPP' | 'LLAMADA' | 'IMPORT' | 'OTRO'
type OpportunityStage = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELED'
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
  documento?: string | null
  email?: string | null
  telefono?: string | null
  celular?: string | null
  status: LeadStatus
  source: LeadSource
  originKey?: CrmOriginKey
  originLabel?: string
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
  originKey?: CrmOriginKey
  originLabel?: string
  lead?: { id: string; nombre: string; status: LeadStatus; source?: LeadSource } | null
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
  originKey?: CrmOriginKey | null
  originLabel?: string | null
  dueAt?: string | null
  completedAt?: string | null
  createdAt: string
  leadId?: string | null
  opportunityId?: string | null
  assignedTo?: { id: string; name?: string | null; email?: string | null } | null
  lead?: { id: string; nombre: string; source?: LeadSource; originKey?: CrmOriginKey | null; originLabel?: string | null } | null
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

function normalizeStageSettings(stageSettings: StageSetting[] | null | undefined) {
  const source = Array.isArray(stageSettings) && stageSettings.length ? stageSettings : DEFAULT_STAGE_SETTINGS
  const uniqueStages = new Map<OpportunityStage, StageSetting>()

  for (const stage of [...source].sort((left, right) => left.sortOrder - right.sortOrder)) {
    if (!uniqueStages.has(stage.key)) {
      uniqueStages.set(stage.key, stage)
    }
  }

  return Array.from(uniqueStages.values())
}

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

function summarizeOpportunityNeed(notes: string | null | undefined) {
  const normalized = (notes || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  const firstChunk = normalized.split(/[.!?]/).map((item) => item.trim()).find(Boolean) || normalized
  return firstChunk.slice(0, 72).trim()
}

function buildOpportunityTitleFromLead(args: { nombre: string; empresaNombre?: string | null; notes?: string | null }) {
  const nombre = args.nombre.trim()
  const empresa = (args.empresaNombre || '').trim()
  const need = summarizeOpportunityNeed(args.notes)

  if (empresa && need) return `${empresa} · ${need}`
  if (empresa) return `Oportunidad ${empresa}`
  if (need) return nombre ? `${nombre} · ${need}` : need
  return nombre ? `Oportunidad ${nombre}` : 'Nueva oportunidad'
}

function withAlpha(color: string | null | undefined, alphaHex: string, fallback: string) {
  const raw = typeof color === 'string' ? color.trim() : ''
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return `${raw}${alphaHex}`
  return fallback
}

function getInitials(value: string | null | undefined) {
  const source = (value || '').trim()
  if (!source) return 'CRM'
  const parts = source.split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((item) => item[0]?.toUpperCase() || '').join('') || 'CRM'
}

function getLeadSourceFallbackMeta(source: LeadSource) {
  return getCrmOriginMeta({ source })
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getOriginTone(originKey)}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

function getDaysToCloseLabel(value: string | null | undefined, locale: string) {
  if (!value) return 'Sin fecha de cierre'
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return formatDate(value, locale, 'Sin fecha')
  const now = new Date()
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0) return `Vencida hace ${Math.abs(diffDays)} d`
  if (diffDays === 0) return 'Cierra hoy'
  if (diffDays === 1) return 'Cierra mañana'
  return `Cierra en ${diffDays} d`
}

function getProbabilitySurface(probabilityPct: number) {
  if (probabilityPct >= 75) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (probabilityPct >= 45) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

function getOpportunityScore(opportunity: Opportunity) {
  let score = 0
  if (opportunity.probabilityPct >= 70) score += 35
  else if (opportunity.probabilityPct >= 45) score += 20
  else score += 8

  if ((opportunity.expectedValue || 0) >= 10000000) score += 25
  else if ((opportunity.expectedValue || 0) >= 3000000) score += 16
  else if ((opportunity.expectedValue || 0) > 0) score += 8

  if (opportunity.cotizacion?.id) score += 15
  if ((opportunity._count?.activities || 0) >= 3) score += 10
  if ((opportunity._count?.tasks || 0) >= 1) score += 5

  if (opportunity.expectedCloseAt) {
    const closeTime = new Date(opportunity.expectedCloseAt).getTime()
    const diffDays = Math.ceil((closeTime - Date.now()) / 86400000)
    if (!Number.isNaN(diffDays) && diffDays <= 7) score += 10
  }

  return Math.max(0, Math.min(100, score))
}

function getOpportunityRiskMeta(opportunity: Opportunity) {
  const score = getOpportunityScore(opportunity)
  const updatedAt = new Date(opportunity.updatedAt).getTime()
  const stale = !Number.isNaN(updatedAt) && updatedAt < (Date.now() - (1000 * 60 * 60 * 24 * 5))
  const overdue = opportunity.expectedCloseAt ? new Date(opportunity.expectedCloseAt).getTime() < Date.now() : false

  if (overdue || (opportunity.probabilityPct < 45 && stale)) {
    return { label: 'Riesgo alto', className: 'border-rose-200 bg-rose-50 text-rose-700' }
  }
  if (score >= 70 && !stale) {
    return { label: 'Saludable', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  }
  return { label: 'Riesgo medio', className: 'border-amber-200 bg-amber-50 text-amber-700' }
}

function getLeadFollowUpPriority(lead: Lead) {
  const lastTouch = new Date(lead.lastActivityAt || lead.createdAt).getTime()
  const daysWithoutTouch = Number.isNaN(lastTouch) ? 0 : Math.max(0, Math.floor((Date.now() - lastTouch) / 86400000))
  if (daysWithoutTouch >= 5) return 'alta'
  if (daysWithoutTouch >= 2) return 'media'
  return 'baja'
}

function normalizeLeadMatchValue(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function normalizeLeadPhone(value: string | null | undefined) {
  return (value || '').replace(/[^\d]+/g, '')
}

function getSuggestedOpportunityPreset(lead: Lead) {
  const lastTouch = new Date(lead.lastActivityAt || lead.createdAt).getTime()
  const daysSinceTouch = Number.isNaN(lastTouch) ? 0 : Math.max(0, Math.floor((Date.now() - lastTouch) / 86400000))

  if (lead.source === 'REFERIDO') {
    return { stage: 'QUALIFIED' as OpportunityStage, probabilityPct: '65', expectedValue: '3500000' }
  }

  if (lead.source === 'WHATSAPP' || lead.source === 'LLAMADA') {
    return { stage: 'QUALIFIED' as OpportunityStage, probabilityPct: '55', expectedValue: '2500000' }
  }

  if (daysSinceTouch <= 2) {
    return { stage: 'QUALIFIED' as OpportunityStage, probabilityPct: '45', expectedValue: '1800000' }
  }

  return { stage: 'NEW' as OpportunityStage, probabilityPct: '30', expectedValue: '1200000' }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const res = await fetch(url, init)
  return (await res.json().catch(() => ({}))) as JsonResponse<T>
}

type CrmDashboardClientProps = {
  initialTab?: 'leads' | 'opportunities' | 'tasks'
  mode?: 'overview' | 'opportunities' | 'tasks'
  initialOpportunityView?: 'list' | 'pipeline'
  canAccessTeamChat?: boolean
  canAccessCrmChat?: boolean
}

export function CrmDashboardClient(props?: CrmDashboardClientProps) {
  const searchParams = useSearchParams()
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = '—'
  const whatsappPlaceholder = '+57 300 123 4567'
  const phonePlaceholder = '601 234 5678'
  const opportunityOrderStorageKey = 'crm-opportunity-stage-order'
  const isFocusedOpportunities = props?.mode === 'opportunities'
  const isFocusedTasks = props?.mode === 'tasks'
  const canAccessAnyChat = Boolean(props?.canAccessTeamChat || props?.canAccessCrmChat)

  const [activeTab, setActiveTab] = useState<'leads' | 'opportunities' | 'tasks'>(isFocusedOpportunities ? 'opportunities' : isFocusedTasks ? 'tasks' : props?.initialTab ?? 'leads')
  const [opportunityView, setOpportunityView] = useState<'list' | 'pipeline'>(props?.initialOpportunityView ?? (isFocusedOpportunities ? 'pipeline' : 'list'))
  const [focusedOpportunityTab, setFocusedOpportunityTab] = useState<'filters' | 'list'>('filters')
  const [draggingOpportunityId, setDraggingOpportunityId] = useState<string | null>(null)
  const [draggingOpportunityStage, setDraggingOpportunityStage] = useState<OpportunityStage | null>(null)
  const [dragTargetStage, setDragTargetStage] = useState<OpportunityStage | null>(null)
  const [dragTargetOpportunityId, setDragTargetOpportunityId] = useState<string | null>(null)
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
  const [opportunityDealOpen, setOpportunityDealOpen] = useState(false)
  const [opportunityDealLoading, setOpportunityDealLoading] = useState(false)
  const [activeOpportunityDetail, setActiveOpportunityDetail] = useState<OpportunityDetail | null>(null)
  const [stageManualOrder, setStageManualOrder] = useState<Partial<Record<OpportunityStage, string[]>>>({})

  const [leadForm, setLeadForm] = useState({
    nombre: '',
    empresaNombre: '',
    documento: '',
    email: '',
    telefono: '',
    celular: '',
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
  const handledRequestedTaskIdRef = useRef<string | null>(null)
  const requestedTaskId = searchParams?.get('taskId') || ''

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      await requestJson('/api/crm/follow-up/reconcile', { method: 'POST' }).catch(() => null)

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
      const nextStages = normalizeStageSettings(stageRes.data)
      setStageSettings(nextStages)
      setStageDrafts(nextStages)
    } finally {
      setLoading(false)
    }
  }, [leadStatusFilter, opportunityStageFilter, search, taskStatusFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (isFocusedOpportunities || isFocusedTasks) return
    if (!requestedTaskId) {
      handledRequestedTaskIdRef.current = null
      return
    }
    if (!requestedTaskId || !tasks.length) return
    if (handledRequestedTaskIdRef.current === requestedTaskId) return
    const task = tasks.find((item) => item.id === requestedTaskId)
    if (!task) return
    handledRequestedTaskIdRef.current = requestedTaskId
    setActiveTab('tasks')
    openEditTaskDialog(task)
  }, [isFocusedOpportunities, isFocusedTasks, requestedTaskId, tasks])

  useEffect(() => {
    if (!isFocusedOpportunities) return
    setActiveTab('opportunities')
  }, [isFocusedOpportunities])

  useEffect(() => {
    if (!isFocusedTasks) return
    setActiveTab('tasks')
  }, [isFocusedTasks])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(opportunityOrderStorageKey)
    if (!stored) return
    try {
      setStageManualOrder(JSON.parse(stored) as Partial<Record<OpportunityStage, string[]>>)
    } catch {
      window.localStorage.removeItem(opportunityOrderStorageKey)
    }
  }, [opportunityOrderStorageKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(opportunityOrderStorageKey, JSON.stringify(stageManualOrder))
  }, [opportunityOrderStorageKey, stageManualOrder])

  const stats = useMemo(() => {
    const activeLeads = leads.filter((lead) => lead.status !== 'CONVERTED' && lead.status !== 'LOST').length
    const pipelineValue = opportunities.reduce((sum, row) => sum + (row.expectedValue || 0), 0)
    const openTasks = tasks.filter((task) => task.status === 'OPEN').length
    return { activeLeads, pipelineValue, openTasks }
  }, [leads, opportunities, tasks])

  const topOrigins = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>()
    leads.forEach((lead) => {
      const origin = lead.originKey && lead.originLabel ? { key: lead.originKey, label: lead.originLabel } : getLeadSourceFallbackMeta(lead.source)
      const current = counts.get(origin.key)
      counts.set(origin.key, { label: origin.label, count: (current?.count || 0) + 1 })
    })
    return Array.from(counts.values()).sort((left, right) => right.count - left.count).slice(0, 3)
  }, [leads])

  const stageMap = useMemo(() => {
    return new Map(stageSettings.map((stage) => [stage.key, stage]))
  }, [stageSettings])

  const visibleStageSettings = useMemo(() => {
    return DEFAULT_STAGE_SETTINGS.map((defaultStage) => stageMap.get(defaultStage.key) ?? defaultStage)
  }, [stageMap])

  const getStageLabel = (stage: OpportunityStage) => stageMap.get(stage)?.label || stage
  const getStageColor = (stage: OpportunityStage) => stageMap.get(stage)?.color || null

  const opportunitiesByStage = useMemo(() => {
    return visibleStageSettings.map((stage) => {
      const manualIds = stageManualOrder[stage.key] || []
      const items = opportunities
        .filter((row) => row.stage === stage.key)
        .sort((left, right) => {
          const leftManualIndex = manualIds.indexOf(left.id)
          const rightManualIndex = manualIds.indexOf(right.id)
          if (leftManualIndex >= 0 || rightManualIndex >= 0) {
            if (leftManualIndex < 0) return 1
            if (rightManualIndex < 0) return -1
            if (leftManualIndex !== rightManualIndex) return leftManualIndex - rightManualIndex
          }
          const leftClose = left.expectedCloseAt ? new Date(left.expectedCloseAt).getTime() : Number.MAX_SAFE_INTEGER
          const rightClose = right.expectedCloseAt ? new Date(right.expectedCloseAt).getTime() : Number.MAX_SAFE_INTEGER
          if (leftClose !== rightClose) return leftClose - rightClose
          return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
        })
      const total = items.reduce((sum, row) => sum + (row.expectedValue || 0), 0)
      return { ...stage, items, total }
    })
  }, [opportunities, stageManualOrder, visibleStageSettings])

  const pipelineSummary = useMemo(() => {
    const openRows = opportunities.filter((row) => row.stage !== 'WON' && row.stage !== 'LOST')
    const weightedValue = openRows.reduce((sum, row) => sum + ((row.expectedValue || 0) * (row.probabilityPct || 0) / 100), 0)
    const overdueCount = openRows.filter((row) => row.expectedCloseAt && new Date(row.expectedCloseAt).getTime() < Date.now()).length
    const quotedCount = openRows.filter((row) => Boolean(row.cotizacion?.id)).length
    return {
      openCount: openRows.length,
      weightedValue,
      overdueCount,
      quotedCount,
    }
  }, [opportunities])

  const priorities = useMemo(() => {
    const now = Date.now()
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date(startOfToday)
    endOfToday.setHours(23, 59, 59, 999)
    const nextWeek = new Date(endOfToday)
    nextWeek.setDate(nextWeek.getDate() + 7)
    const staleThreshold = now - (1000 * 60 * 60 * 48)

    const overdueTasks = tasks.filter((task) => {
      if (task.status === 'DONE' || task.status === 'CANCELED' || !task.dueAt) return false
      const due = new Date(task.dueAt).getTime()
      return !Number.isNaN(due) && due < startOfToday.getTime()
    })

    const todayTasks = tasks.filter((task) => {
      if (task.status === 'DONE' || task.status === 'CANCELED' || !task.dueAt) return false
      const due = new Date(task.dueAt).getTime()
      return !Number.isNaN(due) && due >= startOfToday.getTime() && due <= endOfToday.getTime()
    })

    const staleLeads = leads.filter((lead) => {
      if (lead.status === 'CONVERTED' || lead.status === 'LOST') return false
      const reference = lead.lastActivityAt || lead.createdAt
      const activityTime = new Date(reference).getTime()
      return !Number.isNaN(activityTime) && activityTime < staleThreshold
    })

    const urgentClosings = opportunities.filter((opportunity) => {
      if (opportunity.stage === 'WON' || opportunity.stage === 'LOST' || !opportunity.expectedCloseAt) return false
      const closeTime = new Date(opportunity.expectedCloseAt).getTime()
      return !Number.isNaN(closeTime) && closeTime <= nextWeek.getTime()
    })

    return [
      {
        key: 'overdueTasks',
        title: 'Tareas vencidas',
        count: overdueTasks.length,
        tone: overdueTasks.length ? 'border-rose-200 bg-rose-50/80 text-rose-900' : 'border-slate-200 bg-white text-slate-900',
        hint: overdueTasks[0]?.title || 'Sin tareas atrasadas por ahora.',
        action: () => {
          setActiveTab('tasks')
          setTaskStatusFilter('OPEN')
        },
      },
      {
        key: 'todayTasks',
        title: 'Pendientes de hoy',
        count: todayTasks.length,
        tone: todayTasks.length ? 'border-amber-200 bg-amber-50/80 text-amber-900' : 'border-slate-200 bg-white text-slate-900',
        hint: todayTasks[0]?.title || 'No hay vencimientos para hoy.',
        action: () => {
          setActiveTab('tasks')
          setTaskStatusFilter('OPEN')
        },
      },
      {
        key: 'staleLeads',
        title: 'Leads sin seguimiento',
        count: staleLeads.length,
        tone: staleLeads.length ? 'border-sky-200 bg-sky-50/80 text-sky-900' : 'border-slate-200 bg-white text-slate-900',
        hint: staleLeads[0]?.nombre || 'Todos los leads tienen actividad reciente.',
        action: () => {
          setActiveTab('leads')
          setLeadStatusFilter('ALL')
        },
      },
      {
        key: 'urgentClosings',
        title: 'Cierres urgentes',
        count: urgentClosings.length,
        tone: urgentClosings.length ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900' : 'border-slate-200 bg-white text-slate-900',
        hint: urgentClosings[0]?.title || 'No hay cierres próximos en los siguientes 7 días.',
        action: () => {
          setActiveTab('opportunities')
          setOpportunityStageFilter('ALL')
        },
      },
    ]
  }, [leads, opportunities, tasks])

  const leadFollowUpQueue = useMemo(() => {
    return leads
      .filter((lead) => lead.status !== 'CONVERTED' && lead.status !== 'LOST')
      .map((lead) => {
        const lastTouch = lead.lastActivityAt || lead.createdAt
        const lastTouchTime = new Date(lastTouch).getTime()
        const daysWithoutTouch = Number.isNaN(lastTouchTime) ? 0 : Math.max(0, Math.floor((Date.now() - lastTouchTime) / 86400000))
        return {
          lead,
          daysWithoutTouch,
          priority: getLeadFollowUpPriority(lead),
        }
      })
      .filter((item) => item.daysWithoutTouch >= 2)
      .sort((left, right) => right.daysWithoutTouch - left.daysWithoutTouch)
      .slice(0, 6)
  }, [leads])

  const activeOpportunityByLeadId = useMemo(() => {
    const next = new Map<string, Opportunity>()
    opportunities.forEach((opportunity) => {
      const leadId = opportunity.lead?.id
      if (!leadId || opportunity.stage === 'WON' || opportunity.stage === 'LOST' || next.has(leadId)) return
      next.set(leadId, opportunity)
    })
    return next
  }, [opportunities])

  const leadDuplicateSignals = useMemo(() => {
    const emailMap = new Map<string, string[]>()
    const phoneMap = new Map<string, string[]>()
    const documentMap = new Map<string, string[]>()

    for (const lead of leads) {
      const email = normalizeLeadMatchValue(lead.email)
      const phone = normalizeLeadPhone(lead.telefono || lead.celular)
      const document = normalizeLeadMatchValue(lead.documento)

      if (email) emailMap.set(email, [...(emailMap.get(email) || []), lead.id])
      if (phone) phoneMap.set(phone, [...(phoneMap.get(phone) || []), lead.id])
      if (document) documentMap.set(document, [...(documentMap.get(document) || []), lead.id])
    }

    const next = new Map<string, string[]>()
    for (const lead of leads) {
      const reasons = new Set<string>()
      const email = normalizeLeadMatchValue(lead.email)
      const phone = normalizeLeadPhone(lead.telefono || lead.celular)
      const document = normalizeLeadMatchValue(lead.documento)

      if (document && (documentMap.get(document)?.length || 0) > 1) reasons.add('Coincidencia por documento')
      if (email && (emailMap.get(email)?.length || 0) > 1) reasons.add('Coincidencia por email')
      if (phone && (phoneMap.get(phone)?.length || 0) > 1) reasons.add('Coincidencia por teléfono')
      if (lead.convertedCliente) reasons.add('Ya existe como cliente ERP')
      if ((lead._count?.opportunities || 0) > 0) reasons.add('Ya tiene historial en pipeline')

      next.set(lead.id, [...reasons])
    }

    return next
  }, [leads])

  const leadFormDuplicateSignals = useMemo(() => {
    const reasons = new Set<string>()
    const document = normalizeLeadMatchValue(leadForm.documento)
    const email = normalizeLeadMatchValue(leadForm.email)
    const phone = normalizeLeadPhone(leadForm.telefono || leadForm.celular)

    const matchingLead = leads.find((lead) => {
      if (editingLeadId && lead.id === editingLeadId) return false
      const leadDocument = normalizeLeadMatchValue(lead.documento)
      const leadEmail = normalizeLeadMatchValue(lead.email)
      const leadPhone = normalizeLeadPhone(lead.telefono || lead.celular)
      return Boolean(
        (document && leadDocument && leadDocument === document)
        || (email && leadEmail && leadEmail === email)
        || (phone && leadPhone && leadPhone === phone)
      )
    })

    if (!matchingLead) return []
    if (document && normalizeLeadMatchValue(matchingLead.documento) === document) reasons.add(`Documento ya usado por ${matchingLead.nombre}`)
    if (email && normalizeLeadMatchValue(matchingLead.email) === email) reasons.add(`Email ya usado por ${matchingLead.nombre}`)
    if (phone && normalizeLeadPhone(matchingLead.telefono || matchingLead.celular) === phone) reasons.add(`Teléfono ya usado por ${matchingLead.nombre}`)
    if (matchingLead.convertedCliente) reasons.add('Ese registro ya existe como cliente ERP')

    return [...reasons]
  }, [editingLeadId, leadForm.celular, leadForm.documento, leadForm.email, leadForm.telefono, leads])

  function resetLeadForm() {
    setLeadForm({ nombre: '', empresaNombre: '', documento: '', email: '', telefono: '', celular: '', ciudad: '', source: 'OTRO', status: 'NEW', notes: '' })
  }

  function resetOpportunityForm(stage?: OpportunityStage) {
    setOpportunityForm({
      title: '',
      description: '',
      stage: stage ?? stageSettings[0]?.key ?? 'NEW',
      leadId: '',
      expectedValue: '',
      probabilityPct: '0',
      expectedCloseAt: '',
    })
  }

  function resetTaskForm() {
    setTaskForm({ title: '', description: '', status: 'OPEN', priority: 'NORMAL', leadId: '', opportunityId: '', dueAt: '' })
  }

  function closeLeadDialog() {
    setLeadDialogOpen(false)
    setEditingLeadId(null)
    resetLeadForm()
  }

  function closeOpportunityDialog() {
    setOpportunityDialogOpen(false)
    setEditingOpportunityId(null)
    resetOpportunityForm()
  }

  function closeTaskDialog() {
    setTaskDialogOpen(false)
    setEditingTaskId(null)
    resetTaskForm()
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

  function openCreateOpportunityForLead(args: { leadId: string; leadName: string; companyName?: string | null; notes?: string | null }) {
    setEditingOpportunityId(null)
    const lead = leads.find((item) => item.id === args.leadId)
    const suggested = lead ? getSuggestedOpportunityPreset(lead) : null
    resetOpportunityForm(suggested?.stage)
    setOpportunityForm((current) => ({
      ...current,
      leadId: args.leadId,
      title: buildOpportunityTitleFromLead({ nombre: args.leadName, empresaNombre: args.companyName, notes: args.notes }),
      stage: suggested?.stage ?? current.stage,
      probabilityPct: suggested?.probabilityPct ?? current.probabilityPct,
      expectedValue: suggested?.expectedValue ?? current.expectedValue,
    }))
    setOpportunityDialogOpen(true)
    setActiveTab('opportunities')
    setOpportunityView('pipeline')
  }

  function openLeadInPipeline(lead: Lead) {
    const activeOpportunity = activeOpportunityByLeadId.get(lead.id)
    if (activeOpportunity) {
      setActiveTab('opportunities')
      setOpportunityView('pipeline')
      setOpportunityStageFilter(activeOpportunity.stage)
      void openEditOpportunityDialog(activeOpportunity)
      return
    }

    openCreateOpportunityForLead({
      leadId: lead.id,
      leadName: lead.nombre,
      companyName: lead.empresaNombre,
      notes: null,
    })
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
      documento: row.documento || '',
      email: row.email || '',
      telefono: row.telefono || '',
      celular: row.celular || '',
      ciudad: row.ciudad || '',
      source: row.source,
      status: row.status,
      notes: row.notes || '',
    })
    setLeadDialogOpen(true)
  }

  function openCreateOpportunityDialog(stage?: OpportunityStage) {
    setEditingOpportunityId(null)
    resetOpportunityForm(stage)
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
      const payload = normalizeStageSettings(stageDrafts)
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
      const next = normalizeStageSettings(json.data)
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

  async function submitLead(options?: { openOpportunityAfterSave?: boolean }) {
    if (!leadForm.nombre.trim()) {
      alert('El nombre del lead es requerido.')
      return
    }

    setSavingLead(true)
    try {
      const isEditing = Boolean(editingLeadId)
      const leadDraft = {
        nombre: leadForm.nombre,
        empresaNombre: leadForm.empresaNombre,
        notes: leadForm.notes,
      }
      const json = await requestJson<Lead>(isEditing ? `/api/crm/leads/${editingLeadId}` : '/api/crm/leads', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadForm),
      })
      if (!json.success) {
        alert(json.error || (isEditing ? 'No se pudo actualizar el lead.' : 'No se pudo crear el lead.'))
        return
      }

      const savedLead = json.data
      await loadData()
      closeLeadDialog()

      if (options?.openOpportunityAfterSave && savedLead?.id) {
        openCreateOpportunityForLead({
          leadId: savedLead.id,
          leadName: leadDraft.nombre,
          companyName: leadDraft.empresaNombre,
          notes: leadDraft.notes,
        })
      }
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
      await loadData()
      closeOpportunityDialog()
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
      return false
    }
    await loadData()
    return true
  }

  function getStageOrderedIds(stage: OpportunityStage, currentOrder: Partial<Record<OpportunityStage, string[]>>) {
    const stageIds = opportunities.filter((row) => row.stage === stage).map((row) => row.id)
    const manualIds = currentOrder[stage] || []
    return [
      ...manualIds.filter((id) => stageIds.includes(id)),
      ...stageIds.filter((id) => !manualIds.includes(id)),
    ]
  }

  function reorderOpportunityCards(opportunityId: string, targetStage: OpportunityStage, beforeOpportunityId?: string | null) {
    const current = opportunities.find((row) => row.id === opportunityId)
    if (!current) return
    const sourceStage = draggingOpportunityStage || current.stage
    if (beforeOpportunityId === opportunityId) return

    setStageManualOrder((previous) => {
      const next = { ...previous }
      const sourceIds = getStageOrderedIds(sourceStage, previous).filter((id) => id !== opportunityId)
      const targetIdsBase = (sourceStage === targetStage ? sourceIds : getStageOrderedIds(targetStage, previous)).filter((id) => id !== opportunityId)
      const insertionIndex = beforeOpportunityId ? targetIdsBase.indexOf(beforeOpportunityId) : -1
      if (insertionIndex >= 0) targetIdsBase.splice(insertionIndex, 0, opportunityId)
      else targetIdsBase.push(opportunityId)
      next[sourceStage] = sourceIds
      next[targetStage] = targetIdsBase
      return next
    })
  }

  async function openOpportunityDealPanel(opportunity: Opportunity) {
    setOpportunityDealOpen(true)
    setOpportunityDealLoading(true)
    setActiveOpportunityDetail({ ...opportunity, description: '' })
    try {
      const json = await requestJson<OpportunityDetail>(`/api/crm/opportunities/${opportunity.id}`)
      if (json.success && json.data) {
        setActiveOpportunityDetail(json.data)
      }
    } finally {
      setOpportunityDealLoading(false)
    }
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
      await loadData()
      closeTaskDialog()
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

  function handleOpportunityDragStart(opportunityId: string, event?: React.DragEvent<HTMLDivElement>) {
    const current = opportunities.find((row) => row.id === opportunityId)
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', opportunityId)
    }
    setDraggingOpportunityId(opportunityId)
    setDraggingOpportunityStage(current?.stage ?? null)
  }

  function handleOpportunityDragEnd() {
    setDraggingOpportunityId(null)
    setDraggingOpportunityStage(null)
    setDragTargetStage(null)
    setDragTargetOpportunityId(null)
  }

  async function handleOpportunityDrop(stage: OpportunityStage, beforeOpportunityId?: string | null) {
    if (!draggingOpportunityId) return

    const current = opportunities.find((row) => row.id === draggingOpportunityId)
    reorderOpportunityCards(draggingOpportunityId, stage, beforeOpportunityId)
    setDraggingOpportunityId(null)
    setDraggingOpportunityStage(null)
    setDragTargetStage(null)
    setDragTargetOpportunityId(null)
    if (!current || current.stage === stage) return

    const success = await updateOpportunityStage(draggingOpportunityId, stage)
    if (!success) await loadData()
  }

  const opportunityPipelineBoard = (
    <div className={isFocusedOpportunities ? 'w-full overflow-x-auto pb-3 md:overflow-visible' : 'w-full overflow-x-auto pb-2 md:overflow-visible'}>
      <div
        className={isFocusedOpportunities
          ? 'flex min-w-max gap-4 md:min-w-0 md:flex-nowrap [&>*:nth-child(n+7)]:hidden'
          : 'flex min-w-max gap-4 md:min-w-0 md:flex-nowrap [&>*:nth-child(n+7)]:hidden'}
      >
        {opportunitiesByStage.map((column) => (
                <Card
                  key={column.key}
                  className={`w-[260px] shrink-0 overflow-hidden rounded-[24px] border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fbfdff)] shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)] transition-all md:min-w-0 md:flex-1 ${dragTargetStage === column.key ? 'ring-2 ring-sky-400 shadow-[0_24px_50px_-30px_rgba(14,165,233,0.35)]' : ''}`}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (draggingOpportunityId) {
                      setDragTargetStage(column.key)
                      setDragTargetOpportunityId(null)
                    }
                  }}
                  onDragLeave={() => {
                    if (dragTargetStage === column.key) {
                      setDragTargetStage(null)
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    void handleOpportunityDrop(column.key, null)
                  }}
                >
                  <CardHeader className="border-b border-slate-100 px-3 pb-2.5 pt-3" style={{ background: `linear-gradient(180deg, ${withAlpha(column.color, '16', 'rgba(148,163,184,0.12)')}, rgba(255,255,255,0.98))` }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                          <CircleDot className="h-3 w-3" style={{ color: column.color || '#64748b' }} />
                          {column.label}
                        </div>
                        <CardDescription className="text-[11px]">{formatMoney(column.total, locale)} proyectado</CardDescription>
                      </div>
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-700"
                          onClick={() => openCreateOpportunityDialog(column.key)}
                          title={`Nueva carta en ${column.label}`}
                          aria-label={`Nueva carta en ${column.label}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <div className="rounded-xl bg-white/85 px-2.5 py-1 text-right shadow-sm">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Deals</p>
                          <p className="text-sm font-semibold text-slate-900">{column.items.length}</p>
                        </div>
                      </div>
                    </div>
                    {dragTargetStage === column.key ? (
                      <div className="mt-2 rounded-2xl border border-dashed border-sky-300 bg-sky-50/80 px-3 py-2 text-xs font-medium text-sky-700">
                        Suelta aquí para mover la oportunidad a {column.label.toLowerCase()}.
                      </div>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-2 p-2.5">
                    <button
                      type="button"
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
                      onClick={() => openCreateOpportunityDialog(column.key)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar carta en {column.label.toLowerCase()}
                    </button>
                    {column.items.length === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-center">
                        <p className="text-xs font-medium text-slate-600">Sin oportunidades en esta etapa</p>
                        <p className="mt-1 text-[11px] leading-4 text-slate-500">Arrastra una tarjeta hasta aquí para actualizar el pipeline.</p>
                      </div>
                    ) : null}
                    {column.items.map((row) => {
                      const relationName = row.cliente?.nombre || row.lead?.nombre || 'Sin relación'
                      const assigneeName = row.assignedTo?.name || row.assignedTo?.email || 'Sin responsable'
                      const quoteLabel = row.cotizacion?.numero || 'Sin cotización'
                      const riskMeta = getOpportunityRiskMeta(row)
                      const score = getOpportunityScore(row)
                      const origin = row.originKey && row.originLabel
                        ? { key: row.originKey, label: row.originLabel }
                        : row.lead?.source
                          ? getLeadSourceFallbackMeta(row.lead.source)
                          : null
                      return (
                        <div
                          key={row.id}
                          className={row.id === draggingOpportunityId
                            ? 'rounded-[22px] border border-dashed border-sky-300 bg-sky-50/70 p-3.5 opacity-75'
                            : 'rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md'}
                          draggable
                          onClick={() => void openOpportunityDealPanel(row)}
                          onDragStart={(event) => handleOpportunityDragStart(row.id, event)}
                          onDragEnd={handleOpportunityDragEnd}
                          onDragOver={(event) => {
                            event.preventDefault()
                            if (draggingOpportunityId) {
                              setDragTargetStage(column.key)
                              setDragTargetOpportunityId(row.id)
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            void handleOpportunityDrop(column.key, row.id)
                          }}
                        >
                          <div className="space-y-3">
                            {dragTargetStage === column.key && dragTargetOpportunityId === row.id && draggingOpportunityId !== row.id ? (
                              <div className="rounded-full border border-dashed border-sky-300 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                                Insertar antes de esta tarjeta
                              </div>
                            ) : null}
                            <div className="flex items-start gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-[10px] font-semibold text-white shadow-sm">
                                {getInitials(relationName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold leading-tight text-slate-950">{row.title}</p>
                                    <p className="mt-0.5 truncate text-[11px] text-slate-500">{relationName}</p>
                                  </div>
                                  <div className="flex items-center gap-1 text-slate-400">
                                    <GripVertical className="h-3.5 w-3.5" />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Valor</p>
                                <p className="mt-1 text-xs font-semibold text-slate-950">{formatMoney(row.expectedValue, locale)}</p>
                              </div>
                              <div className={`rounded-xl border px-2.5 py-2 ${getProbabilitySurface(row.probabilityPct)}`}>
                                <p className="text-[10px] uppercase tracking-[0.12em]">Probabilidad</p>
                                <p className="mt-1 text-xs font-semibold">{row.probabilityPct}%</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Score</p>
                                <p className="mt-1 text-xs font-semibold text-slate-950">{score}/100</p>
                              </div>
                              <div className={`rounded-xl border px-2.5 py-2 ${riskMeta.className}`}>
                                <p className="text-[10px] uppercase tracking-[0.12em]">Riesgo</p>
                                <p className="mt-1 text-xs font-semibold">{riskMeta.label}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1 text-[10px] text-slate-600">
                              {origin ? <OriginBadge originKey={origin.key} label={origin.label} /> : null}
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                <CalendarClock className="h-3 w-3 text-slate-400" />
                                {getDaysToCloseLabel(row.expectedCloseAt, locale)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                <UserRound className="h-3 w-3 text-slate-400" />
                                {assigneeName}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5">
                                <Sparkles className="h-3 w-3 text-slate-400" />
                                {row._count?.tasks ?? 0} tareas · {row._count?.activities ?? 0} actividades
                              </span>
                            </div>

                            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-2.5 py-2 text-[10px] text-slate-600">
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate">{quoteLabel}</span>
                                <span className="truncate text-slate-400">Actualizada {formatDate(row.updatedAt, locale, naText)}</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1 pt-1">
                              {row.cotizacion ? (
                                <Button asChild variant="ghost" className="h-7 rounded-full border border-sky-200 px-2.5 text-[11px] text-sky-700 hover:bg-sky-50 hover:text-sky-800" onClick={(event) => event.stopPropagation()}>
                                  <Link href={`/dashboard/cotizador?id=${row.cotizacion.id}`}>
                                    Ver cotización
                                    <ArrowUpRight className="ml-1 h-3 w-3" />
                                  </Link>
                                </Button>
                              ) : row.cliente ? (
                                <Button asChild variant="ghost" className="h-7 rounded-full border border-sky-200 px-2.5 text-[11px] text-sky-700 hover:bg-sky-50 hover:text-sky-800" onClick={(event) => event.stopPropagation()}>
                                  <Link href={`/dashboard/cotizador?crmOpportunityId=${row.id}&clienteId=${row.cliente.id}&opportunityTitle=${encodeURIComponent(row.title)}`}>
                                    Crear cotización
                                    <ArrowUpRight className="ml-1 h-3 w-3" />
                                  </Link>
                                </Button>
                              ) : null}
                              <Button variant="ghost" className="h-7 rounded-full border border-slate-200 px-2.5 text-[11px] text-slate-600 hover:bg-slate-100 hover:text-slate-900" onClick={(event) => { event.stopPropagation(); void openEditOpportunityDialog(row) }}>
                                Editar deal
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              ))}
      </div>
    </div>
  )

  const opportunityListBoard = (
    <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
      <CardHeader className="border-b border-slate-100 pb-5">
        <CardTitle className="text-xl">Oportunidades ({opportunities.length})</CardTitle>
        <CardDescription>Pipeline comercial con valor esperado, probabilidad y acceso directo al cotizador.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-5">
        <div className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
          {!loading && opportunities.length === 0 ? <p className="text-sm text-muted-foreground">No hay oportunidades para mostrar.</p> : null}
          {opportunities.map((row) => {
            const riskMeta = getOpportunityRiskMeta(row)
            const score = getOpportunityScore(row)
            const origin = row.originKey && row.originLabel
              ? { key: row.originKey, label: row.originLabel }
              : row.lead?.source
                ? getLeadSourceFallbackMeta(row.lead.source)
                : null
            return <div key={row.id} className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-slate-900">{row.title}</span>
                    <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${getStageColor(row.stage) || '#f59e0b'}22`, color: getStageColor(row.stage) || '#b45309' }}>
                      {getStageLabel(row.stage)}
                    </span>
                    {origin ? <OriginBadge originKey={origin.key} label={origin.label} /> : null}
                  </div>
                  <p className="text-sm text-slate-600">{row.lead?.nombre || row.cliente?.nombre || 'Sin relación'} · cierre estimado {formatDate(row.expectedCloseAt, locale, 'Sin fecha')}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Actualizada: {formatDate(row.updatedAt, locale, naText)}</span>
                    <span>Probabilidad: {row.probabilityPct}%</span>
                    <span>Score: {score}/100</span>
                    <span className={`rounded-full border px-2.5 py-1 font-semibold ${riskMeta.className}`}>{riskMeta.label}</span>
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
          })}
        </div>
      </CardContent>
    </Card>
  )

  const opportunitiesWorkspace = (
    <div className={isFocusedOpportunities ? 'space-y-5' : 'space-y-4 pt-4'}>
      {isFocusedOpportunities ? null : (
        <div className="flex items-center justify-end gap-2">
          <Button variant={opportunityView === 'list' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setOpportunityView('list')}>
            Lista
          </Button>
          <Button variant={opportunityView === 'pipeline' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setOpportunityView('pipeline')}>
            Pipeline
          </Button>
        </div>
      )}

      {opportunityView === 'pipeline' ? opportunityPipelineBoard : null}
      {opportunityView === 'list' ? opportunityListBoard : null}
    </div>
  )

  return (
    <div className="space-y-4.5 pb-4">
      {isFocusedOpportunities ? (
        <>
          <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.18),_transparent_32%),linear-gradient(135deg,_#fffdf8_0%,_#f8fbff_48%,_#f2f7f4_100%)] shadow-[0_22px_52px_-36px_rgba(15,23,42,0.3)]">
            <div className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] xl:items-start lg:p-5">
              <div className="space-y-2">
                <ErpBreadcrumbs
                  items={[
                    { label: 'Dashboard', href: '/dashboard' },
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'Negociaciones' },
                  ]}
                />
                <div className="inline-flex items-center rounded-full border border-sky-200 bg-white/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-sky-700 backdrop-blur">
                  Pipeline CRM
                </div>
                <div className="space-y-1">
                  <h1 className="max-w-2xl text-xl font-semibold tracking-tight text-slate-950 lg:text-[28px]">Oportunidades y pipeline comercial</h1>
                  <p className="max-w-2xl text-xs leading-5 text-slate-600">El pipeline queda primero y siempre visible. El resto del contexto se consulta por tabs sin perder de vista el embudo.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="h-8 rounded-lg border-slate-200 bg-white/85 px-3 text-xs">
                    <Link href="/dashboard/crm/negociaciones">Volver a Negociaciones</Link>
                  </Button>
                  <Button className="h-8 rounded-lg bg-slate-950 px-3 text-xs text-white hover:bg-slate-800" onClick={() => openCreateOpportunityDialog()}>
                    Nuevo deal
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:self-start">
                <div className="min-w-0 rounded-lg border border-slate-200/80 bg-white/85 p-3 shadow-sm backdrop-blur">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Deals abiertos</p>
                  <p className="mt-1.5 text-xl font-semibold text-slate-950">{pipelineSummary.openCount}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Negocios activos dentro del pipeline.</p>
                </div>
                <div className="min-w-0 rounded-lg border border-emerald-200/80 bg-[linear-gradient(180deg,_rgba(236,253,245,0.95),_rgba(255,255,255,0.9))] p-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Valor ponderado</p>
                  <p className="mt-1.5 text-xl font-semibold text-emerald-950">{formatMoney(pipelineSummary.weightedValue, locale)}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-emerald-700/80">Proyección priorizada por probabilidad.</p>
                </div>
                <div className="min-w-0 rounded-lg border border-amber-200/80 bg-[linear-gradient(180deg,_rgba(255,251,235,0.96),_rgba(255,255,255,0.9))] p-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">Cierres vencidos</p>
                  <p className="mt-1.5 text-xl font-semibold text-amber-950">{pipelineSummary.overdueCount}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-amber-700/80">Deals que necesitan reacción inmediata.</p>
                </div>
                <div className="min-w-0 rounded-lg border border-sky-200/80 bg-[linear-gradient(180deg,_rgba(239,246,255,0.98),_rgba(255,255,255,0.9))] p-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700">Con cotización</p>
                  <p className="mt-1.5 text-xl font-semibold text-sky-950">{pipelineSummary.quotedCount}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-sky-700/80">Oportunidades ya conectadas con propuesta.</p>
                </div>
              </div>
            </div>
          </section>

          <CrmNegotiationsTabs />

          <section className="space-y-3">
            <Tabs value={focusedOpportunityTab} onValueChange={(value) => setFocusedOpportunityTab(value as 'filters' | 'list')}>
              <Card className="rounded-[22px] border-slate-200 bg-white/92 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.2)]">
                <CardContent className="p-2.5">
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                    <TabsList className="grid h-9 w-full max-w-[220px] grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                      <TabsTrigger value="filters" className="rounded-md px-3 py-1.5 text-[11px] data-[state=active]:bg-white data-[state=active]:shadow-sm">Filtros</TabsTrigger>
                      <TabsTrigger value="list" className="rounded-md px-3 py-1.5 text-[11px] data-[state=active]:bg-white data-[state=active]:shadow-sm">Lista</TabsTrigger>
                    </TabsList>
                    <div className="min-w-0 flex-1">
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por oportunidad, lead o cliente..." className="h-9 rounded-lg border-slate-200 bg-white text-sm" />
                    </div>
                    <div className="w-full xl:w-[170px]">
                      <Select value={opportunityStageFilter} onValueChange={(value) => setOpportunityStageFilter(value as 'ALL' | OpportunityStage)}>
                        <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Todas</SelectItem>
                          {visibleStageSettings.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline" className="h-9 rounded-lg border-slate-200 bg-white px-3 text-[11px]" onClick={clearFilters}>Limpiar filtros</Button>
                    <Button variant="outline" className="h-9 rounded-lg border-slate-200 bg-white px-3 text-[11px]" onClick={openStageDialog}>
                      Configurar pipeline
                    </Button>
                    <Button variant="outline" className="h-9 rounded-lg border-slate-200 bg-white px-3 text-[11px]" onClick={() => void loadData()}>
                      Refrescar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Tabs>

            {opportunityPipelineBoard}

            {focusedOpportunityTab === 'list' ? opportunityListBoard : null}
          </section>
        </>
      ) : (
        <>
          <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.18),_transparent_32%),linear-gradient(135deg,_#fffdf8_0%,_#f8fbff_48%,_#f2f7f4_100%)] shadow-[0_22px_52px_-36px_rgba(15,23,42,0.3)]">
            <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] xl:items-start lg:p-6">
              <div className="space-y-3">
                <ErpBreadcrumbs
                  items={[
                    { label: 'Dashboard', href: '/dashboard' },
                    { label: 'CRM' },
                  ]}
                />
                <div className="inline-flex items-center rounded-full border border-sky-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700 backdrop-blur">
                  Frente comercial
                </div>
                <div className="space-y-1.5">
                  <h1 className="max-w-2xl text-2xl font-semibold tracking-tight text-slate-950 lg:text-3xl">Un solo embudo comercial: captación, pipeline y seguimiento.</h1>
                  <p className="max-w-2xl text-[13px] leading-5 text-slate-600">La lógica sigue separada entre leads y oportunidades, pero la operación se lee como un mismo flujo: captar, calificar, convertir y cerrar con contexto ERP.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="relative min-w-0 max-w-xl flex-1">
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por lead, oportunidad o cliente..." className="h-10 rounded-xl border-slate-200 bg-white/90 pr-4 shadow-sm" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="h-9 rounded-xl border-emerald-200 bg-emerald-50/80 px-4 text-emerald-800 hover:bg-emerald-100">
                      <Link href="/dashboard/crm/chatbot">Panel chatbot</Link>
                    </Button>
                    <Button asChild variant="outline" className="h-9 rounded-xl border-slate-200 bg-white/80 px-4">
                      <Link href="/dashboard/crm/integraciones">Integraciones</Link>
                    </Button>
                    <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white/80 px-4" onClick={openStageDialog}>Configurar pipeline</Button>
                    <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white/80 px-4" onClick={() => void loadData()}>Refrescar</Button>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:self-start">
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-white/85 p-3.5 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Captación activa</p>
                  <p className="mt-2.5 text-2xl font-semibold text-slate-950">{stats.activeLeads}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Prospectos todavía en calificación.</p>
                </div>
                <div className="min-w-0 rounded-xl border border-emerald-200/80 bg-[linear-gradient(180deg,_rgba(236,253,245,0.95),_rgba(255,255,255,0.9))] p-3.5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Pipeline estimado</p>
                  <p className="mt-2.5 text-2xl font-semibold text-emerald-950">{formatMoney(stats.pipelineValue, locale)}</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-700/80">Valor proyectado de oportunidades activas.</p>
                </div>
                <div className="min-w-0 rounded-xl border border-amber-200/80 bg-[linear-gradient(180deg,_rgba(255,251,235,0.96),_rgba(255,255,255,0.9))] p-3.5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">Tareas abiertas</p>
                  <p className="mt-2.5 text-2xl font-semibold text-amber-950">{stats.openTasks}</p>
                  <p className="mt-1 text-xs leading-5 text-amber-700/80">Pendientes que requieren acción del equipo.</p>
                </div>
                <div className="sm:col-span-3 min-w-0 rounded-xl border border-slate-200/80 bg-white/85 p-3.5 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Origen principal de captación</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topOrigins.length === 0 ? <span className="text-xs text-slate-500">Sin datos de origen aún.</span> : null}
                    {topOrigins.map((item) => <span key={item.label} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">{item.label} · {item.count}</span>)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Card className="rounded-[26px] border-slate-200 bg-white/90 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.35)]">
            <CardContent className="grid gap-2.5 p-3 md:grid-cols-4 md:p-4">
              <div className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado lead</Label>
                <Select value={leadStatusFilter} onValueChange={(value) => setLeadStatusFilter(value as 'ALL' | LeadStatus)}>
                  <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    {LEAD_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Etapa oportunidad</Label>
                <Select value={opportunityStageFilter} onValueChange={(value) => setOpportunityStageFilter(value as 'ALL' | OpportunityStage)}>
                  <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas</SelectItem>
                    {stageSettings.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5">
                <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Estado tarea</Label>
                <Select value={taskStatusFilter} onValueChange={(value) => setTaskStatusFilter(value as 'ALL' | TaskStatus)}>
                  <SelectTrigger className="h-9 rounded-lg border-slate-200 bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas</SelectItem>
                    {TASK_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-2.5">
                <Button variant="outline" className="h-9 w-full rounded-lg border-slate-200 bg-white" onClick={clearFilters}>Limpiar filtros</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.3)]">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base">Prioridades de hoy</CardTitle>
              <CardDescription>Vista rápida para que el equipo comercial sepa dónde actuar primero sin recorrer todas las vistas del embudo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
              {priorities.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.action}
                  className={`grid gap-2 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${item.tone}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{item.title}</p>
                      <p className="mt-2 text-2xl font-semibold">{item.count}</p>
                    </div>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-current/10 bg-white/70 text-xs font-semibold">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="text-sm leading-5 opacity-80">{item.hint}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {!isFocusedOpportunities && !isFocusedTasks ? (
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'leads' | 'opportunities' | 'tasks')}>
        <div className="space-y-3">
          <div className="grid gap-2.5 rounded-[24px] border border-slate-200 bg-white/90 p-3.5 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.25)] md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">01 · Captación</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">Leads aún en validación comercial.</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Aquí se limpia origen, datos, prioridad y se decide si el prospecto merece pasar al pipeline.</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-[linear-gradient(180deg,_rgba(236,253,245,0.92),_#ffffff)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">02 · Pipeline</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">Oportunidades con valor, probabilidad y cierre.</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">Aquí vive la configuración del pipeline, el forecast y la conexión con cotizaciones.</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-[linear-gradient(180deg,_rgba(255,251,235,0.95),_#ffffff)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">03 · Seguimiento</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">Tareas y pendientes que mueven el embudo.</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">No compite con captación ni pipeline: sirve para ejecutar lo que cada etapa exige.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList className="h-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <TabsTrigger value="leads" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Captación</TabsTrigger>
              <TabsTrigger value="opportunities" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Pipeline</TabsTrigger>
              <TabsTrigger value="tasks" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Seguimiento</TabsTrigger>
            </TabsList>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white">
              <Link href="/dashboard/crm/negociaciones/calendario">Calendario</Link>
            </Button>
            {canAccessAnyChat ? <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white">
              <Link href="/dashboard/chat">Conversaciones</Link>
            </Button> : null}
            <Button asChild variant="outline" className="rounded-xl border-emerald-200 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100">
              <Link href="/dashboard/crm/chatbot">Mensajes chatbot</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white">
              <Link href="/dashboard/crm/integraciones">Canales e integraciones</Link>
            </Button>
            <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={openCreateLeadDialog}>Nuevo prospecto</Button>
            <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={openCreateTaskDialog}>Nuevo seguimiento</Button>
          </div>
          </div>
        </div>

        <TabsContent value="leads" className="space-y-4 pt-4">
          <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.28)]">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base">Cola de captación priorizada</CardTitle>
              <CardDescription>Prospectos que todavía están en calificación y ya piden una llamada, mensaje o tarea por falta de contacto reciente.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {leadFollowUpQueue.length === 0 ? <p className="text-sm text-slate-500">No hay leads sin contacto relevante en este momento.</p> : null}
              {leadFollowUpQueue.map(({ lead, daysWithoutTouch, priority }) => (
                <div key={lead.id} className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fbfdff)] p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/dashboard/crm/leads/${lead.id}`} className="text-sm font-semibold text-sky-700 hover:text-sky-800 hover:underline">
                        {lead.nombre}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{lead.empresaNombre || lead.email || lead.telefono || 'Sin dato principal'}</p>
                    </div>
                    <span className={priority === 'alta' ? 'rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700' : priority === 'media' ? 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700' : 'rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700'}>
                      {priority}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{daysWithoutTouch} d sin contacto</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{lead._count?.opportunities ?? 0} oportunidades</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{lead._count?.tasks ?? 0} tareas</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="h-8 rounded-full px-3 text-xs">
                      <Link href={`/dashboard/crm/agenda?leadId=${lead.id}`}>Agendar</Link>
                    </Button>
                    <Button variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => void openEditLeadDialog(lead)}>
                      Editar
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Captación ({leads.length})</CardTitle>
              <CardDescription>Prospectos comerciales en pre-calificación, con acceso rápido al detalle, timeline y paso al pipeline.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <div className="space-y-3">
                {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
                {!loading && leads.length === 0 ? <p className="text-sm text-muted-foreground">No hay leads para mostrar.</p> : null}
                {leads.map((lead) => {
                  const origin = lead.originKey && lead.originLabel ? { key: lead.originKey, label: lead.originLabel } : getLeadSourceFallbackMeta(lead.source)
                  const duplicateSignals = leadDuplicateSignals.get(lead.id) || []
                  const activeOpportunity = activeOpportunityByLeadId.get(lead.id)
                  return (
                    <div key={lead.id} className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-5 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/dashboard/crm/leads/${lead.id}`} className="text-lg font-semibold text-sky-700 hover:text-sky-800 hover:underline">
                              {lead.nombre}
                            </Link>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{lead.status}</span>
                            <OriginBadge originKey={origin.key} label={origin.label} />
                          </div>
                          <div className="grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                            <p>{lead.empresaNombre || 'Sin empresa'} · {lead.email || lead.telefono || lead.ciudad || naText}</p>
                            <p>Última actividad: {formatDate(lead.lastActivityAt || lead.createdAt, locale, naText)}</p>
                          </div>
                          {duplicateSignals.length ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {duplicateSignals.map((signal) => (
                                <span key={signal} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                                  {signal}
                                </span>
                              ))}
                            </div>
                          ) : null}
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
                            asChild
                          >
                            <Link href={`/dashboard/crm/agenda?leadId=${lead.id}`}>
                              Agendar
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-10 rounded-xl border border-slate-200 px-3 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                            onClick={() => void openEditLeadDialog(lead)}
                          >
                            Editar prospecto
                          </Button>
                          <Button
                            variant={activeOpportunity ? 'outline' : 'default'}
                            className={activeOpportunity ? 'h-10 rounded-xl border-emerald-200 bg-emerald-50 px-3 text-emerald-800 hover:bg-emerald-100' : 'h-10 rounded-xl bg-slate-950 px-3 text-white hover:bg-slate-800'}
                            onClick={() => openLeadInPipeline(lead)}
                          >
                            {activeOpportunity ? 'Abrir en pipeline' : 'Promover a pipeline'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opportunities">{opportunitiesWorkspace}</TabsContent>

        <TabsContent value="tasks" className="space-y-4 pt-4">
          <CrmNegotiationsTabs className="mb-1" />
          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Actividades ({tasks.length})</CardTitle>
              <CardDescription>Actividades comerciales que empujan captación y pipeline sin mezclar ambas lógicas.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <div className="space-y-3">
                {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
                {!loading && tasks.length === 0 ? <p className="text-sm text-muted-foreground">No hay tareas para mostrar.</p> : null}
                {tasks.map((task) => {
                  const origin = task.originKey && task.originLabel
                    ? { key: task.originKey, label: task.originLabel }
                    : task.lead?.originKey && task.lead?.originLabel
                      ? { key: task.lead.originKey, label: task.lead.originLabel }
                      : task.lead?.source
                        ? getLeadSourceFallbackMeta(task.lead.source)
                        : null
                  return (
                    <div key={task.id} className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-5 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold text-slate-900">{task.title}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{task.status}</span>
                            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">{task.priority}</span>
                            {origin ? <OriginBadge originKey={origin.key} label={origin.label} /> : null}
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
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      ) : isFocusedTasks ? (
        <div className="space-y-4 pt-1">
          <CrmNegotiationsTabs />
          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Actividades ({tasks.length})</CardTitle>
              <CardDescription>Actividades comerciales que empujan captación y pipeline sin mezclar ambas lógicas.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <div className="space-y-3">
                {loading ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
                {!loading && tasks.length === 0 ? <p className="text-sm text-muted-foreground">No hay actividades para mostrar.</p> : null}
                {tasks.map((task) => {
                  const origin = task.originKey && task.originLabel
                    ? { key: task.originKey, label: task.originLabel }
                    : task.lead?.originKey && task.lead?.originLabel
                      ? { key: task.lead.originKey, label: task.lead.originLabel }
                      : task.lead?.source
                        ? getLeadSourceFallbackMeta(task.lead.source)
                        : null
                  return (
                    <div key={task.id} className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-5 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold text-slate-900">{task.title}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">{task.status}</span>
                            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">{task.priority}</span>
                            {origin ? <OriginBadge originKey={origin.key} label={origin.label} /> : null}
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
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Dialog open={opportunityDealOpen} onOpenChange={setOpportunityDealOpen}>
        <DialogContent className="ml-auto h-[100vh] max-h-[100vh] w-full max-w-2xl rounded-none rounded-l-[30px] border-l border-slate-200 bg-white/98 p-0 shadow-[0_28px_80px_-30px_rgba(15,23,42,0.38)] sm:max-w-2xl">
          <div className="flex h-full min-h-0 flex-col">
            <DialogHeader className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] px-6 py-5">
              <DialogTitle>Deal en foco</DialogTitle>
              <DialogDescription>Consulta el contexto completo del negocio sin abandonar el pipeline.</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {opportunityDealLoading && !activeOpportunityDetail ? <p className="text-sm text-slate-500">Cargando deal...</p> : null}
              {activeOpportunityDetail ? (
                <div className="space-y-5">
                  <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fbfdff)] p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-2xl font-semibold text-slate-950">{activeOpportunityDetail.title}</span>
                          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: `${getStageColor(activeOpportunityDetail.stage) || '#64748b'}22`, color: getStageColor(activeOpportunityDetail.stage) || '#475569' }}>
                            {getStageLabel(activeOpportunityDetail.stage)}
                          </span>
                          {activeOpportunityDetail.originKey && activeOpportunityDetail.originLabel ? <OriginBadge originKey={activeOpportunityDetail.originKey} label={activeOpportunityDetail.originLabel} /> : null}
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{activeOpportunityDetail.cliente?.nombre || activeOpportunityDetail.lead?.nombre || 'Sin relación principal'}</p>
                      </div>
                      <div className={`rounded-2xl border px-3 py-2 ${getProbabilitySurface(activeOpportunityDetail.probabilityPct)}`}>
                        <p className="text-[11px] uppercase tracking-[0.14em]">Probabilidad</p>
                        <p className="mt-1 text-base font-semibold">{activeOpportunityDetail.probabilityPct}%</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Valor esperado</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{formatMoney(activeOpportunityDetail.expectedValue, locale)}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Cierre estimado</p>
                        <p className="mt-2 text-base font-semibold text-slate-950">{formatDate(activeOpportunityDetail.expectedCloseAt, locale, 'Sin fecha')}</p>
                        <p className="mt-1 text-xs text-slate-500">{getDaysToCloseLabel(activeOpportunityDetail.expectedCloseAt, locale)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Relación comercial</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p><span className="font-semibold text-slate-950">Lead:</span> {activeOpportunityDetail.lead?.nombre || 'No asociado'}</p>
                        <p><span className="font-semibold text-slate-950">Cliente:</span> {activeOpportunityDetail.cliente?.nombre || 'No convertido'}</p>
                        <p><span className="font-semibold text-slate-950">Responsable:</span> {activeOpportunityDetail.assignedTo?.name || activeOpportunityDetail.assignedTo?.email || 'Sin asignar'}</p>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Actividad vinculada</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p><span className="font-semibold text-slate-950">Tareas:</span> {activeOpportunityDetail._count?.tasks ?? 0}</p>
                        <p><span className="font-semibold text-slate-950">Actividades:</span> {activeOpportunityDetail._count?.activities ?? 0}</p>
                        <p><span className="font-semibold text-slate-950">Actualización:</span> {formatDate(activeOpportunityDetail.updatedAt, locale, naText)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Descripción del deal</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{activeOpportunityDetail.description?.trim() || 'Todavía no hay una descripción detallada para este deal.'}</p>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Cotización</p>
                    {activeOpportunityDetail.cotizacion ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{activeOpportunityDetail.cotizacion.numero}</p>
                          <p className="mt-1 text-sm text-slate-600">Estado {activeOpportunityDetail.cotizacion.estado} · Total {formatMoney(activeOpportunityDetail.cotizacion.total, locale)}</p>
                        </div>
                        <Button asChild className="rounded-xl">
                          <Link href={`/dashboard/cotizador?id=${activeOpportunityDetail.cotizacion.id}`}>Abrir cotización</Link>
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-600">Este deal aún no tiene cotización enlazada.</p>
                    )}
                  </div>

                  <CrmLinkedFilesPanel
                    entityType="OPPORTUNITY"
                    entityId={activeOpportunityDetail.id}
                    title="Repositorio del deal"
                    emptyLabel="Todavía no hay archivos compartidos o vinculados a esta oportunidad."
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
              {activeOpportunityDetail ? (
                <Button variant="outline" className="rounded-xl" onClick={() => void openEditOpportunityDialog(activeOpportunityDetail)}>
                  Editar deal
                </Button>
              ) : null}
              <Button variant="outline" className="rounded-xl" onClick={() => setOpportunityDealOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={leadDialogOpen} onOpenChange={(open) => { if (open) setLeadDialogOpen(true); else closeLeadDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLeadId ? 'Editar lead' : 'Nuevo lead'}</DialogTitle>
            <DialogDescription>{editingLeadId ? 'Actualiza la información comercial del prospecto y, si aplica, envíalo directo al pipeline desde aquí.' : 'Registra un prospecto para iniciar el seguimiento comercial.'}</DialogDescription>
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
            {leadFormDuplicateSignals.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900 md:col-span-2">
                <p className="font-semibold">Posible duplicado detectado</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {leadFormDuplicateSignals.map((signal) => <span key={signal} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800">{signal}</span>)}
                </div>
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Documento</Label>
                <Input value={leadForm.documento} onChange={(e) => setLeadForm((prev) => ({ ...prev, documento: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={leadForm.email} onChange={(e) => setLeadForm((prev) => ({ ...prev, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={leadForm.telefono} onChange={(e) => setLeadForm((prev) => ({ ...prev, telefono: e.target.value }))} placeholder={phonePlaceholder} />
              </div>
              <div className="grid gap-1.5">
                <Label>WhatsApp / Celular</Label>
                <Input value={leadForm.celular} onChange={(e) => setLeadForm((prev) => ({ ...prev, celular: e.target.value }))} placeholder={whatsappPlaceholder} />
                <p className="text-xs text-muted-foreground">Incluye el indicativo del país. Ejemplo: +57 300 123 4567.</p>
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
            <Button variant="outline" onClick={closeLeadDialog}>Cancelar</Button>
            {editingLeadId ? (
              <Button variant="outline" onClick={() => void submitLead({ openOpportunityAfterSave: true })} disabled={savingLead}>
                {savingLead ? 'Guardando...' : 'Guardar y pasar a pipeline'}
              </Button>
            ) : null}
            <Button onClick={() => void submitLead()} disabled={savingLead}>{savingLead ? 'Guardando...' : editingLeadId ? 'Guardar cambios' : 'Crear lead'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={opportunityDialogOpen} onOpenChange={(open) => { if (open) setOpportunityDialogOpen(true); else closeOpportunityDialog() }}>
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
            <Button variant="outline" onClick={closeOpportunityDialog}>Cancelar</Button>
            <Button onClick={() => void submitOpportunity()} disabled={savingOpportunity}>{savingOpportunity ? 'Guardando...' : editingOpportunityId ? 'Guardar cambios' : 'Crear oportunidad'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={(open) => { if (open) setTaskDialogOpen(true); else closeTaskDialog() }}>
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
            <Button variant="outline" onClick={closeTaskDialog}>Cancelar</Button>
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
