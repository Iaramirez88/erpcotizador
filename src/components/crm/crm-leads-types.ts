export type CrmLeadLifecycleStatus =
  | 'NEW'
  | 'PENDING_REVIEW'
  | 'NURTURING'
  | 'QUALIFIED'
  | 'SALES_ASSIGNED'
  | 'CONVERTED'
  | 'DISCARDED'
  | 'DO_NOT_CONTACT'

export type CrmLeadScoreBand = 'COLD' | 'WARM' | 'HOT'

export type CrmLeadOwner = { id: string; name: string | null; email: string }

export type CrmLeadRow = {
  id: string
  nombre: string
  empresaNombre: string | null
  email: string | null
  telefono: string | null
  celular: string | null
  status: string
  source: string
  sourceKey: string | null
  sourceLabel: string | null
  originKey?: string
  originLabel?: string
  lifecycleStatus: CrmLeadLifecycleStatus
  score: number
  scoreBand: CrmLeadScoreBand
  serviceInterest: string | null
  campaignName: string | null
  formName: string | null
  ownerUserId: string | null
  sedeId: string | null
  contactId: string | null
  assignedAt: string | null
  createdAt: string
  lastActivityAt: string | null
  lastCaptureAt: string | null
  ownerUser: CrmLeadOwner | null
  contact: {
    id: string
    nombre: string
    apellido: string | null
    email: string | null
    telefono: string | null
    celular: string | null
  } | null
  _count: { captures: number; conversations: number; opportunities: number; tasks: number }
}

export type CrmLeadFacets = {
  byStatus: Record<string, number>
  all: number
  unassigned: number
  scope: string
}

export type CrmLeadPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type CrmLeadTimelineEntry = {
  id: string
  kind: 'capture' | 'score' | 'activity' | 'conversation' | 'opportunity' | 'task' | 'sequence'
  occurredAt: string
  title: string
  description: string | null
  actor: { id: string | null; name: string | null } | null
  channel: string | null
  entity: { type: string; id: string }
  metadata: Record<string, unknown>
}

export type CrmLeadDetail = {
  contact: {
    id: string
    nombre: string
    apellido: string | null
    email: string | null
    telefono: string | null
    celular: string | null
    empresaNombre: string | null
    documento: string | null
    ciudad: string | null
    status: string
    consents: Array<{
      channel: string
      status: string
      source: string | null
      grantedAt: string | null
      revokedAt: string | null
    }>
  } | null
  captures: Array<{
    id: string
    captureType: string
    formName: string | null
    campaignName: string | null
    serviceInterest: string | null
    resourceLabel: string | null
    isFirstTouch: boolean
    scoreDelta: number
    createdAt: string
    channelConnection: { name: string; provider: string } | null
  }>
  scoreEvents: Array<{ id: string; eventType: string; points: number; dedupeKey: string; occurredAt: string }>
  opportunities: Array<{
    id: string
    title: string
    stage: string
    expectedValue: number
    createdAt: string
    wonAt: string | null
    lostAt: string | null
  }>
  tasks: Array<{ id: string; title: string; status: string; dueAt: string | null; completedAt: string | null }>
  conversations: Array<{
    id: string
    status: string
    firstInboundAt: string | null
    lastMessageAt: string | null
    directionLastMessage: string | null
    channelConnection: { name: string; provider: string } | null
  }>
  sequenceEnrollments: Array<{
    id: string
    status: string
    currentStepOrder: number
    nextRunAt: string | null
    stoppedReason: string | null
    sequence: { id: string; name: string; status: string }
  }>
}

export type CrmLeadDetailResponse = CrmLeadRow & {
  detail: CrmLeadDetail | null
  timeline: CrmLeadTimelineEntry[]
  scope: string
}

export const LIFECYCLE_LABELS: Record<CrmLeadLifecycleStatus, string> = {
  NEW: 'Nuevo',
  PENDING_REVIEW: 'Pendiente',
  NURTURING: 'Nutrición',
  QUALIFIED: 'Calificado',
  SALES_ASSIGNED: 'Asignado',
  CONVERTED: 'Convertido',
  DISCARDED: 'Descartado',
  DO_NOT_CONTACT: 'No contactar',
}

export const LIFECYCLE_STYLES: Record<CrmLeadLifecycleStatus, string> = {
  NEW: 'bg-sky-50 text-sky-700 border-sky-200',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  NURTURING: 'bg-violet-50 text-violet-700 border-violet-200',
  QUALIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SALES_ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  CONVERTED: 'bg-teal-50 text-teal-700 border-teal-200',
  DISCARDED: 'bg-slate-100 text-slate-600 border-slate-200',
  DO_NOT_CONTACT: 'bg-rose-50 text-rose-700 border-rose-200',
}

export const SCORE_BAND_LABELS: Record<CrmLeadScoreBand, string> = {
  COLD: 'Frío',
  WARM: 'Tibio',
  HOT: 'Caliente',
}

export const SCORE_BAND_STYLES: Record<CrmLeadScoreBand, string> = {
  COLD: 'bg-slate-100 text-slate-600 border-slate-200',
  WARM: 'bg-amber-50 text-amber-700 border-amber-200',
  HOT: 'bg-rose-50 text-rose-700 border-rose-200',
}

export const LEAD_VIEWS: Array<{ id: string; label: string; statuses: CrmLeadLifecycleStatus[] }> = [
  { id: 'all', label: 'Todos', statuses: [] },
  { id: 'new', label: 'Nuevos', statuses: ['NEW'] },
  { id: 'pending', label: 'Sin gestionar', statuses: ['NEW', 'PENDING_REVIEW'] },
  { id: 'nurturing', label: 'Nutrición', statuses: ['NURTURING'] },
  { id: 'qualified', label: 'Calificados', statuses: ['QUALIFIED'] },
  { id: 'assigned', label: 'Asignados', statuses: ['SALES_ASSIGNED'] },
  { id: 'converted', label: 'Convertidos', statuses: ['CONVERTED'] },
  { id: 'discarded', label: 'Descartados', statuses: ['DISCARDED'] },
]

export function formatRelativeDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `hace ${days} d`
  return date.toLocaleDateString('es-CO')
}

