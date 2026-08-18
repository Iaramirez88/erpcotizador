"use client"

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Archive, ArrowDownUp, ChevronDown, Columns3, Eye, GripVertical, LayoutPanelLeft, MoreVertical, PencilLine, Pin, Plus, Rows3, Search as SearchIcon, Users } from 'lucide-react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CrmFileLibraryPicker } from '@/components/crm/crm-file-library-picker'
import { useToast } from '@/hooks/use-toast'
import type { CrmFileItem } from '@/components/crm/crm-files-types'

type WorkspaceScope = 'SEDE' | 'USER'
type WorkspaceVisibility = 'PUBLIC' | 'PRIVATE' | 'HIDDEN'
type WorkspaceRole = 'VIEWER' | 'EDITOR' | 'MANAGER'
type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELED'
type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH'
type TaskHistoryType = 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'DUE_DATE_CHANGED' | 'ASSIGNEES_CHANGED' | 'NOTE_ADDED' | 'ATTACHMENTS_CHANGED' | 'CUSTOM_FIELDS_CHANGED' | 'ARCHIVED' | 'RESTORED'
type TaskAttachmentType = 'image' | 'audio' | 'video' | 'document'
type TaskCustomFieldType = 'TEXT' | 'FILE'
type ExternalAttachmentProvider = 'GOOGLE_DRIVE' | 'ONEDRIVE'

type TeamUser = {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
  sedeDefaultId?: string | null
  sedeMembershipIds?: string[]
}

type SedeOption = {
  id: string
  nombre: string
  codigo?: string | null
}

type WorkspaceMember = {
  id: string
  role: WorkspaceRole
  userId: string
  user: TeamUser
}

type WorkspaceProject = {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  createdAt: string
  updatedAt: string
  _count?: { tasks: number }
}

type Workspace = {
  id: string
  name: string
  description?: string | null
  scope: WorkspaceScope
  visibility?: WorkspaceVisibility
  sede?: SedeOption | null
  sedes?: SedeOption[]
  ownerUser?: TeamUser | null
  members: WorkspaceMember[]
  projects: WorkspaceProject[]
  createdBy?: TeamUser | null
  _count?: { tasks: number; members: number }
  currentUserId?: string
  currentUserRole?: WorkspaceRole | null
  permissions?: {
    canView: boolean
    canEditTasks: boolean
    canManage: boolean
  }
}

type TaskHistoryEntry = {
  id: string
  type: TaskHistoryType
  message: string
  createdAt: string
  actorUser?: TeamUser | null
}

type TaskAssignment = {
  id: string
  userId: string
  user: TeamUser
}

type TaskAttachment = {
  id: string
  name: string
  url: string
  type: TaskAttachmentType
  mimeType: string | null
  sizeBytes: number | null
  uploadedAt: string
  provider?: 'UPLOAD' | 'LIBRARY' | 'GOOGLE_DRIVE' | 'ONEDRIVE' | null
  externalId?: string | null
}

type TaskCustomField = {
  id: string
  label: string
  type: TaskCustomFieldType
  textValue: string | null
  file: TaskAttachment | null
}

type TaskItem = {
  id: string
  title: string
  description?: string | null
  colorHex?: string | null
  status: TaskStatus
  priority: TaskPriority
  dueAt?: string | null
  completedAt?: string | null
  archivedAt?: string | null
  createdAt: string
  updatedAt: string
  workspace?: Workspace | null
  project?: WorkspaceProject | null
  assignments: TaskAssignment[]
  createdBy?: TeamUser | null
  history: TaskHistoryEntry[]
  lead?: { id: string; nombre: string } | null
  opportunity?: { id: string; title: string } | null
  cliente?: { id: string; nombre: string; documento: string } | null
  attachmentsJson?: TaskAttachment[] | null
  customFieldsJson?: TaskCustomField[] | null
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }
type QuickTaskPanelMode = 'attachments' | 'custom-fields' | 'history' | 'note'
type ExtraTaskColumn = 'attachments' | 'custom-fields' | 'history' | 'note'
type TaskSortDirection = 'asc' | 'desc'
type TaskViewMode = 'SPACE' | 'MINE' | 'ALL_SPACES'
type DragPayload = { type: 'project'; projectId: string } | { type: 'task'; taskId: string }
type TaskWorkspaceSettings = { requireTaskCancellationReason: boolean }
type TaskWorkspaceBootstrap = { workspaces: Workspace[]; settings: TaskWorkspaceSettings }

const COLOR_PRESETS = ['#0F172A', '#1D4ED8', '#0F766E', '#BE185D', '#7C3AED', '#C2410C', '#DC2626', '#16A34A']

const STATUS_META: Record<TaskStatus, { label: string; badgeClass: string; softClass: string }> = {
  OPEN: { label: 'No iniciado', badgeClass: 'bg-slate-900 text-white border-slate-800', softClass: 'from-slate-50 via-white to-slate-100 border-slate-200' },
  IN_PROGRESS: { label: 'En curso', badgeClass: 'bg-amber-400 text-slate-950 border-amber-300', softClass: 'from-amber-50 via-white to-orange-100 border-amber-200' },
  DONE: { label: 'Finalizada', badgeClass: 'bg-emerald-500 text-white border-emerald-400', softClass: 'from-emerald-50 via-white to-lime-100 border-emerald-200' },
  CANCELED: { label: 'Cancelada', badgeClass: 'bg-rose-500 text-white border-rose-400', softClass: 'from-rose-50 via-white to-pink-100 border-rose-200' },
}

const PRIORITY_META: Record<TaskPriority, { label: string; badgeClass: string }> = {
  LOW: { label: 'Baja', badgeClass: 'bg-sky-100 text-sky-800 border-sky-200' },
  NORMAL: { label: 'Normal', badgeClass: 'bg-violet-100 text-violet-800 border-violet-200' },
  HIGH: { label: 'Alta', badgeClass: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
}

const STATUS_SELECT_CLASS: Record<TaskStatus, string> = {
  OPEN: 'border-slate-300 bg-slate-900 text-white',
  IN_PROGRESS: 'border-amber-300 bg-amber-400 text-slate-950',
  DONE: 'border-emerald-300 bg-emerald-500 text-white',
  CANCELED: 'border-rose-300 bg-rose-500 text-white',
}

function createId(prefix: string) {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}-${uuid}`
}

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || 'U').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? 'U'
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (a + b).toUpperCase()
}

function getUserLabel(user?: Pick<TeamUser, 'name' | 'email'> | null) {
  if (user?.name?.trim()) return user.name.trim()
  if (user?.email?.trim()) return user.email.trim()
  return 'Usuario sin nombre'
}

function getWorkspaceSedes(workspace?: Pick<Workspace, 'sede' | 'sedes'> | null) {
  const deduped = new Map<string, SedeOption>()
  ;(workspace?.sedes || []).forEach((sede) => {
    if (sede?.id) deduped.set(sede.id, sede)
  })
  if (workspace?.sede?.id) deduped.set(workspace.sede.id, workspace.sede)
  return Array.from(deduped.values())
}

function getWorkspaceDescription(workspace: Workspace) {
  if (workspace.description?.trim()) return workspace.description.trim()
  if (workspace.scope === 'SEDE') {
    const names = getWorkspaceSedes(workspace).map((sede) => sede.nombre).filter(Boolean)
    return names.length ? names.join(', ') : 'Espacio por sede'
  }
  return workspace.ownerUser?.name || workspace.ownerUser?.email || 'Espacio por usuario'
}

function truncateText(value: string, maxLength = 30) {
  const normalized = value.trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, Math.max(0, maxLength)).trimEnd()}...`
}

function formatStatus(status: TaskStatus) {
  return STATUS_META[status]?.label || 'Sin estado'
}

function formatRole(role: WorkspaceRole | null | undefined) {
  if (role === 'MANAGER') return 'Administrador'
  if (role === 'EDITOR') return 'Editor'
  if (role === 'VIEWER') return 'Lector'
  return 'Sin rol'
}

function serializeDragPayload(payload: DragPayload) {
  return JSON.stringify(payload)
}

function parseDragPayload(value: string): DragPayload | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as DragPayload
    if (parsed?.type === 'project' && parsed.projectId) return parsed
    if (parsed?.type === 'task' && parsed.taskId) return parsed
  } catch {
    // ignore invalid payloads
  }
  return null
}

function normalizeHex(value: string | null | undefined) {
  const raw = String(value || '').trim().toUpperCase()
  return /^#([0-9A-F]{6})$/.test(raw) ? raw : '#1D4ED8'
}

function normalizeAttachments(value: unknown): TaskAttachment[] {
  if (!Array.isArray(value)) return []
  const attachments: TaskAttachment[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    const name = String(row.name || '').trim()
    const url = String(row.url || '').trim()
    const type = String(row.type || '').trim().toLowerCase() as TaskAttachmentType
    if (!name || !url || !['image', 'audio', 'video', 'document'].includes(type)) return null
    attachments.push({
      id: String(row.id || `attachment-${index + 1}`),
      name,
      url,
      type,
      mimeType: typeof row.mimeType === 'string' ? row.mimeType : null,
      sizeBytes: typeof row.sizeBytes === 'number' ? row.sizeBytes : null,
      uploadedAt: typeof row.uploadedAt === 'string' ? row.uploadedAt : new Date().toISOString(),
      provider: typeof row.provider === 'string' ? row.provider as TaskAttachment['provider'] : null,
      externalId: typeof row.externalId === 'string' ? row.externalId : null,
    })
  })
  return attachments
}

function normalizeCustomFields(value: unknown): TaskCustomField[] {
  if (!Array.isArray(value)) return []
  const fields: TaskCustomField[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return null
    const row = item as Record<string, unknown>
    const label = String(row.label || '').trim()
    const type = String(row.type || '').trim().toUpperCase() as TaskCustomFieldType
    if (!label || (type !== 'TEXT' && type !== 'FILE')) return null
    const fileArray = normalizeAttachments(row.file ? [row.file] : [])
    fields.push({
      id: String(row.id || `field-${index + 1}`),
      label,
      type,
      textValue: type === 'TEXT' ? String(row.textValue || '').trim() : null,
      file: type === 'FILE' ? fileArray[0] ?? null : null,
    })
  })
  return fields
}

function normalizeTask(row: TaskItem): TaskItem {
  return {
    ...row,
    colorHex: typeof row.colorHex === 'string' ? normalizeHex(row.colorHex) : null,
    attachmentsJson: normalizeAttachments(row.attachmentsJson),
    customFieldsJson: normalizeCustomFields(row.customFieldsJson),
  }
}

function formatAttachmentSize(sizeBytes?: number | null) {
  if (!sizeBytes || !Number.isFinite(sizeBytes)) return 'Sin tamaño'
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function attachmentAccept() {
  return 'image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'
}

function mapLibraryItemToAttachment(item: CrmFileItem): TaskAttachment {
  return {
    id: item.id,
    name: item.name,
    url: item.url || '',
    type: item.type === 'image' || item.type === 'audio' || item.type === 'video' ? item.type : 'document',
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    uploadedAt: item.updatedAt,
    provider: 'LIBRARY',
    externalId: item.id,
  }
}

function getInitialExternalAttachmentForm() {
  return {
    provider: 'GOOGLE_DRIVE' as ExternalAttachmentProvider,
    name: '',
    url: '',
  }
}

function getLatestTaskHistoryEntry(task: TaskItem | null | undefined) {
  if (!task?.history?.length) return null
  return [...task.history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
}

function getSortedTaskHistoryEntries(history: TaskHistoryEntry[] | null | undefined) {
  if (!history?.length) return []
  return [...history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function formatTaskHistoryType(type: TaskHistoryType) {
  switch (type) {
    case 'CREATED':
      return 'Creacion'
    case 'UPDATED':
      return 'Datos actualizados'
    case 'STATUS_CHANGED':
      return 'Estado actualizado'
    case 'PRIORITY_CHANGED':
      return 'Prioridad actualizada'
    case 'DUE_DATE_CHANGED':
      return 'Fecha actualizada'
    case 'ASSIGNEES_CHANGED':
      return 'Responsables actualizados'
    case 'NOTE_ADDED':
      return 'Nota agregada'
    case 'ATTACHMENTS_CHANGED':
      return 'Adjuntos actualizados'
    case 'CUSTOM_FIELDS_CHANGED':
      return 'Campos personalizados actualizados'
    case 'ARCHIVED':
      return 'Tarea archivada'
    case 'RESTORED':
      return 'Tarea restaurada'
    default:
      return 'Cambio registrado'
  }
}

function translateTaskHistoryMessage(message: string, type?: TaskHistoryType) {
  const translations: Array<[string, string]> = [
    ['IN_PROGRESS', 'En curso'],
    ['CANCELED', 'Cancelada'],
    ['OPEN', 'No iniciado'],
    ['DONE', 'Finalizada'],
    ['NORMAL', 'Normal'],
    ['HIGH', 'Alta'],
    ['LOW', 'Baja'],
  ]

  let normalized = message
  translations.forEach(([source, target]) => {
    normalized = normalized.replaceAll(source, target)
  })

  if (type === 'UPDATED' && normalized === 'Se actualizaron los detalles de la tarea.') {
    return 'Se actualizaron los datos principales de la tarea.'
  }

  return normalized
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const response = await fetch(url, init)
  return (await response.json().catch(() => ({}))) as JsonResponse<T>
}

const WORKSPACE_PANEL_STORAGE_KEY = 'crm-task-workspaces:workspace-panel-collapsed'
const TASK_COLUMN_WIDTH_STORAGE_KEY = 'crm-task-workspaces:task-column-width'
const TASK_EXTRA_COLUMNS_STORAGE_KEY = 'crm-task-workspaces:task-extra-columns'
const TASK_PRIORITY_COLUMN_STORAGE_KEY = 'crm-task-workspaces:task-priority-column-visible'
const TASK_CREATED_AT_COLUMN_STORAGE_KEY = 'crm-task-workspaces:task-created-at-column-visible'
const TASK_PAGE_SIZE_STORAGE_KEY = 'crm-task-workspaces:task-page-size'
const LAST_WORKSPACE_STORAGE_KEY = 'crm-task-workspaces:last-workspace-id'

function normalizePinnedTaskIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)))
}

function normalizeOrderedTaskIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)))
}

function reorderValues(values: string[], fromValue: string, toValue: string) {
  return reorderValuesByPlacement(values, fromValue, toValue, 'before')
}

function reorderValuesByPlacement(values: string[], fromValue: string, toValue: string, placement: 'before' | 'after') {
  if (!fromValue || !toValue || fromValue === toValue) return values
  const next = [...values]
  const fromIndex = next.indexOf(fromValue)
  const toIndex = next.indexOf(toValue)
  if (fromIndex === -1 || toIndex === -1) return values
  const [moved] = next.splice(fromIndex, 1)
  const targetIndex = next.indexOf(toValue)
  if (targetIndex === -1) return values
  next.splice(placement === 'after' ? targetIndex + 1 : targetIndex, 0, moved)
  return next
}

function requestCancellationReason(taskTitle: string, required: boolean) {
  const response = window.prompt(
    required
      ? `Debes registrar el motivo de anulación para la tarea "${taskTitle}".`
      : `Si deseas, registra el motivo de anulación para la tarea "${taskTitle}".`,
    '',
  )
  if (response === null) return null
  const normalized = response.trim()
  if (required && !normalized) return ''
  return normalized
}

export function CrmTaskWorkspacesClient() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const customFieldFileInputRef = useRef<HTMLInputElement | null>(null)
  const workspaceGridRef = useRef<HTMLDivElement | null>(null)
  const handledNotificationTaskRef = useRef<string>('')
  const detailDialogOpenedFromNotificationRef = useRef(false)
  const notificationCleanupTimerRef = useRef<number | null>(null)
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [savingProject, setSavingProject] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [movingTask, setMovingTask] = useState(false)
  const [savingDetail, setSavingDetail] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [search, setSearch] = useState('')
  const [searchPanelOpen, setSearchPanelOpen] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false)
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false)
  const [workspaceListSearch, setWorkspaceListSearch] = useState('')
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskMoveDialogOpen, setTaskMoveDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)
  const [externalAttachmentDialogOpen, setExternalAttachmentDialogOpen] = useState(false)
  const [workspaceSearch, setWorkspaceSearch] = useState('')
  const [workspaceMemberSearch, setWorkspaceMemberSearch] = useState('')
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [detailAssigneeSearch, setDetailAssigneeSearch] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [quickTaskPanel, setQuickTaskPanel] = useState<{ taskId: string; mode: QuickTaskPanelMode } | null>(null)
  const [quickNoteDraft, setQuickNoteDraft] = useState('')
  const [savingQuickNote, setSavingQuickNote] = useState(false)
  const [workspacePanelCollapsed, setWorkspacePanelCollapsed] = useState(false)
  const [taskViewMode, setTaskViewMode] = useState<TaskViewMode>('MINE')
  const [taskColumnWidth, setTaskColumnWidth] = useState(150)
  const [taskSortDirection, setTaskSortDirection] = useState<TaskSortDirection>('desc')
  const [taskPageSize, setTaskPageSize] = useState(10)
  const [taskPage, setTaskPage] = useState(1)
  const [showPriorityColumn, setShowPriorityColumn] = useState(true)
  const [showCreatedAtColumn, setShowCreatedAtColumn] = useState(true)
  const [visibleExtraTaskColumns, setVisibleExtraTaskColumns] = useState<ExtraTaskColumn[]>([])
  const [dragOverWorkspaceId, setDragOverWorkspaceId] = useState('')
  const [dragOverProjectId, setDragOverProjectId] = useState('')
  const [dragOverTaskId, setDragOverTaskId] = useState('')
  const [dragOverTaskPlacement, setDragOverTaskPlacement] = useState<'before' | 'after'>('before')
  const [currentUserId, setCurrentUserId] = useState('')
  const [pinnedTaskIds, setPinnedTaskIds] = useState<string[]>([])
  const [orderedTaskIds, setOrderedTaskIds] = useState<string[]>([])
  const [taskSettings, setTaskSettings] = useState<TaskWorkspaceSettings>({ requireTaskCancellationReason: false })
  const [workspaceViewportHeight, setWorkspaceViewportHeight] = useState<number | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [users, setUsers] = useState<TeamUser[]>([])
  const [sedes, setSedes] = useState<SedeOption[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null)
  const [taskCancelDialogOpen, setTaskCancelDialogOpen] = useState(false)
  const [taskCancelTarget, setTaskCancelTarget] = useState<TaskItem | null>(null)
  const [taskCancelReason, setTaskCancelReason] = useState('')
  const [cancellingTask, setCancellingTask] = useState(false)
  const [customFieldUploadTarget, setCustomFieldUploadTarget] = useState<string | null>(null)
  const [workspaceForm, setWorkspaceForm] = useState({ name: '', description: '', scope: 'SEDE' as WorkspaceScope, visibility: 'PRIVATE' as WorkspaceVisibility, sedeId: '', sedeIds: [] as string[], ownerUserId: '', memberUserIds: [] as string[] })
  const [projectForm, setProjectForm] = useState({ sourceWorkspaceId: '', workspaceId: '', projectId: '', name: '', description: '' })
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueAt: '', priority: 'NORMAL' as TaskPriority, status: 'OPEN' as TaskStatus, colorHex: '#1D4ED8', assignedToUserIds: [] as string[], workspaceId: '', projectId: '' })
  const [taskMoveForm, setTaskMoveForm] = useState({ taskId: '', workspaceId: '', projectId: '' })
  const [detailForm, setDetailForm] = useState({ id: '', title: '', description: '', dueAt: '', priority: 'NORMAL' as TaskPriority, status: 'OPEN' as TaskStatus, colorHex: '#1D4ED8', attachmentsJson: [] as TaskAttachment[], customFieldsJson: [] as TaskCustomField[], assignedToUserIds: [] as string[], archived: false, projectId: '' })
  const [customFieldDraft, setCustomFieldDraft] = useState({ label: '', type: 'TEXT' as TaskCustomFieldType, textValue: '', file: null as TaskAttachment | null })
  const [workspaceSettingsForm, setWorkspaceSettingsForm] = useState({ id: '', name: '', description: '', scope: 'SEDE' as WorkspaceScope, visibility: 'PRIVATE' as WorkspaceVisibility, sedeIds: [] as string[], ownerUserId: '', members: [] as Array<{ userId: string; role: WorkspaceRole }> })
  const [externalAttachmentForm, setExternalAttachmentForm] = useState(getInitialExternalAttachmentForm())
  const requestedTaskId = searchParams?.get('taskId') || ''
  const requestedWorkspaceId = searchParams?.get('workspaceId') || ''

  const selectedWorkspace = useMemo(() => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null, [selectedWorkspaceId, workspaces])
  const selectedProject = useMemo(() => selectedWorkspace?.projects.find((project) => project.id === selectedProjectId) ?? null, [selectedProjectId, selectedWorkspace])
  const canManageWorkspace = Boolean(selectedWorkspace?.permissions?.canManage)
  const manageableWorkspaces = useMemo(() => workspaces.filter((workspace) => workspace.permissions?.canManage), [workspaces])
  const editableWorkspaces = useMemo(() => workspaces.filter((workspace) => workspace.permissions?.canEditTasks), [workspaces])
  const editableWorkspaceIds = useMemo(() => new Set(editableWorkspaces.map((workspace) => workspace.id)), [editableWorkspaces])
  const canCreateTask = Boolean(currentUserId)
  const selectedMoveWorkspace = useMemo(() => workspaces.find((workspace) => workspace.id === taskMoveForm.workspaceId) ?? null, [taskMoveForm.workspaceId, workspaces])
  const clampedTaskColumnWidth = useMemo(() => Math.min(220, Math.max(120, taskColumnWidth)), [taskColumnWidth])
  const showCrossWorkspaceColumn = taskViewMode !== 'SPACE'
  const totalTaskColumnCount = useMemo(() => 7 + visibleExtraTaskColumns.length + (showCrossWorkspaceColumn ? 1 : 0) + (showPriorityColumn ? 1 : 0) + (showCreatedAtColumn ? 1 : 0), [showCreatedAtColumn, showCrossWorkspaceColumn, showPriorityColumn, visibleExtraTaskColumns.length])
  const taskGridTemplate = useMemo(() => `repeat(${totalTaskColumnCount}, ${clampedTaskColumnWidth}px)`, [clampedTaskColumnWidth, totalTaskColumnCount])
  const taskTableMinWidth = useMemo(() => clampedTaskColumnWidth * totalTaskColumnCount + 32, [clampedTaskColumnWidth, totalTaskColumnCount])
  const quickTask = useMemo(() => quickTaskPanel ? tasks.find((task) => task.id === quickTaskPanel.taskId) ?? null : null, [quickTaskPanel, tasks])
  const quickTaskLatestHistory = useMemo(() => getLatestTaskHistoryEntry(quickTask), [quickTask])
  const selectedTaskHistory = useMemo(() => getSortedTaskHistoryEntries(selectedTask?.history), [selectedTask])
  const selectedTaskCanEdit = Boolean(selectedTask && currentUserId && (!selectedTask.workspace?.id || editableWorkspaceIds.has(selectedTask.workspace.id)))
  const quickTaskCanEdit = Boolean(quickTask && currentUserId && (!quickTask.workspace?.id || editableWorkspaceIds.has(quickTask.workspace.id)))
  const canEditTasks = Boolean(selectedWorkspace?.permissions?.canEditTasks || selectedTaskCanEdit || quickTaskCanEdit)

  async function loadBase() {
    setLoading(true)
    try {
      const [workspaceRes, userRes, sedeRes, meRes, uiPrefRes] = await Promise.all([
        requestJson<TaskWorkspaceBootstrap>('/api/crm/task-workspaces'),
        requestJson<TeamUser[]>('/api/crm/assignees'),
        requestJson<SedeOption[]>('/api/crm/sedes'),
        requestJson<{ id: string }>('/api/me'),
        requestJson<{ report?: { tasks?: { pinnedTaskIds?: string[]; orderedTaskIds?: string[] } } }>('/api/ui-preferences'),
      ])
      const nextWorkspaces = Array.isArray(workspaceRes.data?.workspaces) ? workspaceRes.data.workspaces : []
      const lastWorkspaceId = typeof window !== 'undefined' ? window.localStorage.getItem(LAST_WORKSPACE_STORAGE_KEY) || '' : ''
      setWorkspaces(nextWorkspaces)
      setTaskSettings(workspaceRes.data?.settings ?? { requireTaskCancellationReason: false })
      setUsers(Array.isArray(userRes.data) ? userRes.data : [])
      setSedes(Array.isArray(sedeRes.data) ? sedeRes.data : [])
      setCurrentUserId(meRes.data?.id || nextWorkspaces[0]?.currentUserId || '')
      setPinnedTaskIds(normalizePinnedTaskIds(uiPrefRes.data?.report?.tasks?.pinnedTaskIds))
      setOrderedTaskIds(normalizeOrderedTaskIds(uiPrefRes.data?.report?.tasks?.orderedTaskIds))
      setSelectedWorkspaceId((current) => {
        if (requestedWorkspaceId && nextWorkspaces.some((workspace) => workspace.id === requestedWorkspaceId)) {
          return requestedWorkspaceId
        }
        if (current && nextWorkspaces.some((workspace) => workspace.id === current)) {
          return current
        }
        if (lastWorkspaceId && nextWorkspaces.some((workspace) => workspace.id === lastWorkspaceId)) {
          return lastWorkspaceId
        }
        return nextWorkspaces[0]?.id || ''
      })
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = useCallback(async (workspaceId = selectedWorkspaceId, viewMode = taskViewMode) => {
    if ((viewMode === 'MINE' && !currentUserId) || (viewMode === 'SPACE' && !workspaceId)) {
      setTasks([])
      return
    }
    const query = new URLSearchParams({ includeArchived: String(showArchived) })
    if (viewMode === 'SPACE' && workspaceId) {
      query.set('workspaceId', workspaceId)
    }
    if (viewMode === 'MINE' && currentUserId) {
      query.set('assignedToUserId', currentUserId)
    }
    if (viewMode === 'MINE' || viewMode === 'ALL_SPACES') {
      query.set('accessibleWorkspaces', 'true')
    }
    const taskRes = await requestJson<TaskItem[]>(`/api/crm/tasks?${query.toString()}`)
    setTasks(Array.isArray(taskRes.data) ? taskRes.data.map((row) => normalizeTask(row)) : [])
  }, [currentUserId, selectedWorkspaceId, showArchived, taskViewMode])

  async function loadTaskDetail(taskId: string) {
    const detailRes = await requestJson<TaskItem>(`/api/crm/tasks/${taskId}`)
    const row = detailRes.success && detailRes.data ? normalizeTask(detailRes.data) : null
    setSelectedTask(row)
    if (row) {
      if (row.workspace?.id && row.workspace.id !== selectedWorkspaceId) {
        setSelectedWorkspaceId(row.workspace.id)
      }
      if (row.project?.id) {
        setSelectedProjectId(row.project.id)
      }
      setDetailForm({
        id: row.id,
        title: row.title,
        description: row.description || '',
        dueAt: row.dueAt ? new Date(row.dueAt).toISOString().slice(0, 16) : '',
        priority: row.priority,
        status: row.status,
        colorHex: normalizeHex(row.colorHex),
        attachmentsJson: row.attachmentsJson || [],
        customFieldsJson: row.customFieldsJson || [],
        assignedToUserIds: row.assignments.map((assignment) => assignment.userId),
        archived: Boolean(row.archivedAt),
        projectId: row.project?.id || '',
      })
      setCustomFieldDraft({ label: '', type: 'TEXT', textValue: '', file: null })
      if (requestedTaskId === taskId) {
        detailDialogOpenedFromNotificationRef.current = true
      }
      setDetailDialogOpen(true)
    }
  }

  useEffect(() => { void loadBase() }, [])
  useEffect(() => { void loadTasks(selectedWorkspaceId, taskViewMode) }, [loadTasks, selectedWorkspaceId, taskViewMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedWorkspacePanelState = window.localStorage.getItem(WORKSPACE_PANEL_STORAGE_KEY)
      if (savedWorkspacePanelState === 'true' || savedWorkspacePanelState === 'false') {
        setWorkspacePanelCollapsed(savedWorkspacePanelState === 'true')
      } else {
        setWorkspacePanelCollapsed(window.innerWidth < 1280)
      }
      const savedColumnWidth = Number(window.localStorage.getItem(TASK_COLUMN_WIDTH_STORAGE_KEY) || '')
      if (Number.isFinite(savedColumnWidth)) {
        setTaskColumnWidth(Math.min(220, Math.max(120, savedColumnWidth)))
      }
      const savedExtraColumns = JSON.parse(window.localStorage.getItem(TASK_EXTRA_COLUMNS_STORAGE_KEY) || '[]') as unknown
      if (Array.isArray(savedExtraColumns)) {
        setVisibleExtraTaskColumns(savedExtraColumns.filter((item): item is ExtraTaskColumn => item === 'attachments' || item === 'custom-fields' || item === 'history' || item === 'note'))
      }
      const savedPriorityColumn = window.localStorage.getItem(TASK_PRIORITY_COLUMN_STORAGE_KEY)
      if (savedPriorityColumn === 'true' || savedPriorityColumn === 'false') {
        setShowPriorityColumn(savedPriorityColumn === 'true')
      }
      const savedCreatedAtColumn = window.localStorage.getItem(TASK_CREATED_AT_COLUMN_STORAGE_KEY)
      if (savedCreatedAtColumn === 'true' || savedCreatedAtColumn === 'false') {
        setShowCreatedAtColumn(savedCreatedAtColumn === 'true')
      }
      const savedPageSize = Number(window.localStorage.getItem(TASK_PAGE_SIZE_STORAGE_KEY) || '')
      if ([10, 20, 30, 50].includes(savedPageSize)) {
        setTaskPageSize(savedPageSize)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(WORKSPACE_PANEL_STORAGE_KEY, String(workspacePanelCollapsed))
      window.localStorage.setItem(TASK_COLUMN_WIDTH_STORAGE_KEY, String(clampedTaskColumnWidth))
      window.localStorage.setItem(TASK_EXTRA_COLUMNS_STORAGE_KEY, JSON.stringify(visibleExtraTaskColumns))
      window.localStorage.setItem(TASK_PRIORITY_COLUMN_STORAGE_KEY, String(showPriorityColumn))
      window.localStorage.setItem(TASK_CREATED_AT_COLUMN_STORAGE_KEY, String(showCreatedAtColumn))
      window.localStorage.setItem(TASK_PAGE_SIZE_STORAGE_KEY, String(taskPageSize))
    } catch {
      // ignore
    }
  }, [clampedTaskColumnWidth, showCreatedAtColumn, showPriorityColumn, taskPageSize, visibleExtraTaskColumns, workspacePanelCollapsed])

  useEffect(() => {
    setTaskPage(1)
  }, [search, selectedProjectId, selectedWorkspaceId, showArchived, taskPageSize, taskSortDirection, taskViewMode])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const measure = () => {
      if (window.innerWidth < 1280) {
        setWorkspaceViewportHeight(null)
        return
      }
      const top = workspaceGridRef.current?.getBoundingClientRect().top ?? 0
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight
      setWorkspaceViewportHeight(Math.max(520, Math.floor(viewportHeight - top - 20)))
    }

    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [workspacePanelCollapsed])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!selectedWorkspaceId) return
    try {
      window.localStorage.setItem(LAST_WORKSPACE_STORAGE_KEY, selectedWorkspaceId)
    } catch {
      // ignore
    }
  }, [selectedWorkspaceId])

  useEffect(() => {
    if (!requestedTaskId) {
      handledNotificationTaskRef.current = ''
      detailDialogOpenedFromNotificationRef.current = false
      return
    }
    if (!requestedTaskId) return
    const requestKey = `${requestedWorkspaceId}:${requestedTaskId}`
    if (handledNotificationTaskRef.current === requestKey) return
    if (loading) return
    if (!workspaces.length) return

    if (requestedWorkspaceId) {
      const workspaceExists = workspaces.some((workspace) => workspace.id === requestedWorkspaceId)
      if (!workspaceExists) return
      if (requestedWorkspaceId !== selectedWorkspaceId) {
        setSelectedWorkspaceId(requestedWorkspaceId)
        return
      }
    } else if (!selectedWorkspaceId) {
      return
    }

    handledNotificationTaskRef.current = requestKey
    void loadTaskDetail(requestedTaskId)
  }, [loading, requestedTaskId, requestedWorkspaceId, selectedWorkspaceId, workspaces])

  useEffect(() => {
    if (detailDialogOpen) return
    if (!requestedTaskId) return
    if (!detailDialogOpenedFromNotificationRef.current) return
    if (typeof window === 'undefined') return

    detailDialogOpenedFromNotificationRef.current = false
    handledNotificationTaskRef.current = ''
    setSelectedTask(null)
    setNoteDraft('')

    const params = new URLSearchParams(window.location.search)
    params.delete('taskId')
    const resolvedPathname = pathname || window.location.pathname
    const nextUrl = params.toString() ? `${resolvedPathname}?${params.toString()}` : resolvedPathname

    if (notificationCleanupTimerRef.current) {
      window.clearTimeout(notificationCleanupTimerRef.current)
    }

    notificationCleanupTimerRef.current = window.setTimeout(() => {
      router.replace(nextUrl, { scroll: false })
      notificationCleanupTimerRef.current = null
    }, 120)
  }, [detailDialogOpen, pathname, requestedTaskId, router])

  useEffect(() => {
    return () => {
      if (notificationCleanupTimerRef.current && typeof window !== 'undefined') {
        window.clearTimeout(notificationCleanupTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedWorkspace) return
    setWorkspaceSettingsForm({
      id: selectedWorkspace.id,
      name: selectedWorkspace.name,
      description: selectedWorkspace.description || '',
      scope: selectedWorkspace.scope,
      visibility: selectedWorkspace.visibility || 'PRIVATE',
      sedeIds: getWorkspaceSedes(selectedWorkspace).map((sede) => sede.id),
      ownerUserId: selectedWorkspace.ownerUser?.id || '',
      members: selectedWorkspace.members.map((member) => ({ userId: member.userId, role: member.role })),
    })
  }, [selectedWorkspace])

  useEffect(() => {
    if (!selectedWorkspace) {
      setSelectedProjectId('')
      return
    }
    setSelectedProjectId((current) => current && selectedWorkspace.projects.some((project) => project.id === current) ? current : '')
  }, [selectedWorkspace])

  useEffect(() => {
    setTaskForm((current) => current.projectId === selectedProjectId && current.workspaceId === selectedWorkspaceId
      ? current
      : { ...current, workspaceId: selectedWorkspaceId, projectId: selectedProjectId })
  }, [selectedProjectId, selectedWorkspaceId])

  useEffect(() => {
    if (!currentUserId) return
    setTaskForm((current) => current.assignedToUserIds.includes(currentUserId)
      ? current
      : { ...current, assignedToUserIds: [...current.assignedToUserIds, currentUserId] })
  }, [currentUserId])

  useEffect(() => {
    if (search) {
      setSearchPanelOpen(true)
    }
  }, [search])

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase()
    const projectScopedTasks = taskViewMode === 'SPACE' && selectedProjectId ? tasks.filter((task) => task.project?.id === selectedProjectId) : tasks
    const matchingTasks = !term ? projectScopedTasks : projectScopedTasks.filter((task) => {
      const haystack = [task.title, task.description, task.createdBy?.name, task.workspace?.name, task.lead?.nombre, task.opportunity?.title, task.cliente?.nombre, ...task.assignments.map((assignment) => assignment.user.name || assignment.user.email || ''), ...(task.customFieldsJson || []).map((field) => `${field.label} ${field.textValue || field.file?.name || ''}`)].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })

    const pinnedVisibleIds = pinnedTaskIds.filter((taskId) => matchingTasks.some((task) => task.id === taskId))
    const pinnedIndex = new Map(pinnedVisibleIds.map((taskId, index) => [taskId, index]))
    const orderedVisibleIds = orderedTaskIds.filter((taskId) => matchingTasks.some((task) => task.id === taskId) && !pinnedVisibleIds.includes(taskId))
    const orderedIndex = new Map(orderedVisibleIds.map((taskId, index) => [taskId, index]))

    return [...matchingTasks].sort((left, right) => {
      const leftPinnedIndex = pinnedIndex.get(left.id)
      const rightPinnedIndex = pinnedIndex.get(right.id)
      if (leftPinnedIndex !== undefined || rightPinnedIndex !== undefined) {
        if (leftPinnedIndex === undefined) return 1
        if (rightPinnedIndex === undefined) return -1
        return leftPinnedIndex - rightPinnedIndex
      }
      const leftOrderedIndex = orderedIndex.get(left.id)
      const rightOrderedIndex = orderedIndex.get(right.id)
      if (leftOrderedIndex !== undefined || rightOrderedIndex !== undefined) {
        if (leftOrderedIndex === undefined) return 1
        if (rightOrderedIndex === undefined) return -1
        return leftOrderedIndex - rightOrderedIndex
      }
      const leftTime = new Date(left.createdAt).getTime()
      const rightTime = new Date(right.createdAt).getTime()
      return taskSortDirection === 'asc' ? leftTime - rightTime : rightTime - leftTime
    })
  }, [orderedTaskIds, pinnedTaskIds, search, selectedProjectId, taskSortDirection, taskViewMode, tasks])

  const totalTaskPages = useMemo(() => Math.max(1, Math.ceil(filteredTasks.length / taskPageSize)), [filteredTasks.length, taskPageSize])
  const paginatedTasks = useMemo(() => {
    const safePage = Math.min(taskPage, totalTaskPages)
    const start = (safePage - 1) * taskPageSize
    return filteredTasks.slice(start, start + taskPageSize)
  }, [filteredTasks, taskPage, taskPageSize, totalTaskPages])
  const visibleTaskRange = useMemo(() => {
    if (!filteredTasks.length) return { start: 0, end: 0 }
    const safePage = Math.min(taskPage, totalTaskPages)
    const start = (safePage - 1) * taskPageSize + 1
    const end = Math.min(filteredTasks.length, start + paginatedTasks.length - 1)
    return { start, end }
  }, [filteredTasks.length, paginatedTasks.length, taskPage, taskPageSize, totalTaskPages])
  const visibleTaskPages = useMemo(() => {
    if (totalTaskPages <= 5) return Array.from({ length: totalTaskPages }, (_, index) => index + 1)
    const start = Math.max(1, taskPage - 2)
    const end = Math.min(totalTaskPages, start + 4)
    const normalizedStart = Math.max(1, end - 4)
    return Array.from({ length: end - normalizedStart + 1 }, (_, index) => normalizedStart + index)
  }, [taskPage, totalTaskPages])

  useEffect(() => {
    setTaskPage((current) => Math.min(current, totalTaskPages))
  }, [totalTaskPages])

  function canEditTask(task: TaskItem) {
    if (!currentUserId) return false
    if (!task.workspace?.id) return true
    return editableWorkspaceIds.has(task.workspace.id)
  }

  async function savePinnedTasks(nextPinnedTaskIds: string[]) {
    setPinnedTaskIds(nextPinnedTaskIds)
    const json = await requestJson<{ report?: { tasks?: { pinnedTaskIds?: string[]; orderedTaskIds?: string[] } } }>('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: { tasks: { pinnedTaskIds: nextPinnedTaskIds, orderedTaskIds } } }),
    })
    if (!json.success) {
      throw new Error(json.error || 'No se pudieron guardar las tareas ancladas.')
    }
  }

  async function saveOrderedTasks(nextOrderedTaskIds: string[]) {
    setOrderedTaskIds(nextOrderedTaskIds)
    const json = await requestJson<{ report?: { tasks?: { pinnedTaskIds?: string[]; orderedTaskIds?: string[] } } }>('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: { tasks: { pinnedTaskIds, orderedTaskIds: nextOrderedTaskIds } } }),
    })
    if (!json.success) {
      throw new Error(json.error || 'No se pudo guardar el orden manual de tareas.')
    }
  }

  function isTaskPinned(taskId: string) {
    return pinnedTaskIds.includes(taskId)
  }

  async function toggleTaskPinned(task: TaskItem) {
    const pinned = isTaskPinned(task.id)
    const nextPinnedTaskIds = pinned
      ? pinnedTaskIds.filter((taskId) => taskId !== task.id)
      : [...filteredTasks.filter((item) => pinnedTaskIds.includes(item.id)).map((item) => item.id), task.id]
          .sort((leftId, rightId) => {
            const leftTask = tasks.find((item) => item.id === leftId)
            const rightTask = tasks.find((item) => item.id === rightId)
            const leftTime = new Date(leftTask?.createdAt || 0).getTime()
            const rightTime = new Date(rightTask?.createdAt || 0).getTime()
            return rightTime - leftTime
          })
    try {
      await savePinnedTasks(nextPinnedTaskIds)
      toast({
        title: pinned ? 'Tarea desanclada' : 'Tarea anclada',
        description: pinned ? 'La tarea volvió al flujo normal.' : 'La tarea quedó fija al inicio de tu vista.',
      })
    } catch (error) {
      setPinnedTaskIds((current) => current)
      alert(error instanceof Error ? error.message : 'No se pudo actualizar el anclaje.')
    }
  }

  async function reorderPinnedTasks(fromTaskId: string, toTaskId: string, placement: 'before' | 'after') {
    const nextPinnedTaskIds = reorderValuesByPlacement(pinnedTaskIds, fromTaskId, toTaskId, placement)
    if (nextPinnedTaskIds === pinnedTaskIds) return
    try {
      await savePinnedTasks(nextPinnedTaskIds)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo reordenar el anclaje.')
    }
  }

  async function reorderVisibleTasks(fromTaskId: string, toTaskId: string, placement: 'before' | 'after') {
    const visibleUnpinnedIds = filteredTasks
      .filter((task) => !pinnedTaskIds.includes(task.id))
      .map((task) => task.id)

    if (!visibleUnpinnedIds.includes(fromTaskId) || !visibleUnpinnedIds.includes(toTaskId)) return

    const normalizedCurrentOrder = [
      ...orderedTaskIds.filter((taskId) => visibleUnpinnedIds.includes(taskId)),
      ...visibleUnpinnedIds.filter((taskId) => !orderedTaskIds.includes(taskId)),
    ]

    const nextVisibleOrder = reorderValuesByPlacement(normalizedCurrentOrder, fromTaskId, toTaskId, placement)
    if (nextVisibleOrder === normalizedCurrentOrder) return

    const visibleSet = new Set(visibleUnpinnedIds)
    const preserved = orderedTaskIds.filter((taskId) => !visibleSet.has(taskId))
    const nextOrderedTaskIds = [...preserved, ...nextVisibleOrder]

    try {
      await saveOrderedTasks(nextOrderedTaskIds)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'No se pudo reordenar la tarea.')
    }
  }

  function handleSelectWorkspace(workspaceId: string) {
    setTaskViewMode('SPACE')
    setSelectedWorkspaceId(workspaceId)
  }

  function handleShowMyTasks() {
    setTaskViewMode('MINE')
    setSelectedProjectId('')
  }

  function handleShowAllAccessibleTasks() {
    setTaskViewMode('ALL_SPACES')
    setSelectedProjectId('')
  }

  const workspaceCandidates = useMemo(() => {
    const term = workspaceSearch.trim().toLowerCase()
    return users.filter((user) => !term || (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term))
  }, [users, workspaceSearch])

  const workspaceMemberCandidates = useMemo(() => {
    const term = workspaceMemberSearch.trim().toLowerCase()
    const selectedIds = new Set(workspaceSettingsForm.members.map((member) => member.userId))
    return users.filter((user) => {
      if (selectedIds.has(user.id)) return false
      return !term || (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term)
    })
  }, [users, workspaceMemberSearch, workspaceSettingsForm.members])

  const filteredWorkspaces = useMemo(() => {
    const term = workspaceListSearch.trim().toLowerCase()
    if (!term) return workspaces

    return workspaces.filter((workspace) => {
      const description = getWorkspaceDescription(workspace)
      return workspace.name.toLowerCase().includes(term)
        || description.toLowerCase().includes(term)
        || workspace.scope.toLowerCase().includes(term)
    })
  }, [workspaceListSearch, workspaces])

  const taskAssigneeCandidates = useMemo(() => {
    const term = assigneeSearch.trim().toLowerCase()
    return users.filter((user) => !term || (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term))
  }, [users, assigneeSearch])

  const detailAssigneeCandidates = useMemo(() => {
    const term = detailAssigneeSearch.trim().toLowerCase()
    return users.filter((user) => !term || (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term))
  }, [users, detailAssigneeSearch])

  const noteEntries = useMemo(() => selectedTask?.history.filter((entry) => entry.type === 'NOTE_ADDED') ?? [], [selectedTask])

  function openWorkspaceSettings(workspace = selectedWorkspace) {
    if (!workspace) return
    setWorkspaceSettingsForm({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description || '',
      scope: workspace.scope,
      visibility: workspace.visibility || 'PRIVATE',
      sedeIds: getWorkspaceSedes(workspace).map((sede) => sede.id),
      ownerUserId: workspace.ownerUser?.id || '',
      members: workspace.members.map((member) => ({ userId: member.userId, role: member.role })),
    })
    setWorkspaceSettingsOpen(true)
  }

  function openProjectDialog(workspaceId = selectedWorkspaceId, project?: WorkspaceProject | null) {
    if (!workspaceId) return alert('Selecciona primero un proyecto.')
    const workspace = workspaces.find((item) => item.id === workspaceId) ?? null
    setProjectForm({
      sourceWorkspaceId: workspaceId,
      workspaceId,
      projectId: project?.id || '',
      name: project?.name || '',
      description: project?.description || workspace?.description || '',
    })
    setProjectDialogOpen(true)
  }

  function openTaskCreationDialog(projectId = selectedProjectId) {
    if (!canCreateTask) return alert('No se pudo resolver tu usuario actual para crear la tarea.')
    const workspaceId = selectedWorkspaceId || ''
    setTaskForm({
      title: '',
      description: '',
      dueAt: '',
      priority: 'NORMAL',
      status: 'OPEN',
      colorHex: '#1D4ED8',
      assignedToUserIds: currentUserId ? [currentUserId] : [],
      workspaceId,
      projectId: projectId || '',
    })
    setTaskDialogOpen(true)
  }

  function moveDetailTaskToSelectedProject() {
    if (!selectedProjectId) return alert('Selecciona un proyecto de destino en el panel del espacio.')
    setDetailForm((current) => ({ ...current, projectId: selectedProjectId }))
  }

  async function handleCreateWorkspace() {
    if (!workspaceForm.name.trim()) return alert('El nombre del proyecto es requerido.')
    if (workspaceForm.scope === 'SEDE' && !workspaceForm.sedeIds.length) return alert('Selecciona al menos una sede para el proyecto.')
    if (workspaceForm.scope === 'USER' && !workspaceForm.ownerUserId) return alert('Selecciona un usuario responsable del proyecto.')
    setSavingWorkspace(true)
    try {
      const json = await requestJson<Workspace>('/api/crm/task-workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(workspaceForm) })
      if (!json.success || !json.data) return alert(json.error || 'No se pudo crear el proyecto.')
      setWorkspaceDialogOpen(false)
      setWorkspaceForm({ name: '', description: '', scope: 'SEDE', visibility: 'PRIVATE', sedeId: '', sedeIds: [], ownerUserId: '', memberUserIds: [] })
      await loadBase()
      setSelectedWorkspaceId(json.data.id)
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function handleSaveWorkspaceSettings() {
    if (!workspaceSettingsForm.id) return
    if (!canManageWorkspace) return alert('Solo un manager puede administrar miembros y roles.')
    if (!workspaceSettingsForm.name.trim()) return alert('El nombre del proyecto es requerido.')
    if (workspaceSettingsForm.scope === 'SEDE' && !workspaceSettingsForm.sedeIds.length) return alert('Selecciona al menos una sede para el proyecto.')
    setSavingWorkspace(true)
    try {
      const json = await requestJson<Workspace>(`/api/crm/task-workspaces/${workspaceSettingsForm.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: workspaceSettingsForm.name, description: workspaceSettingsForm.description, visibility: workspaceSettingsForm.visibility, ownerUserId: workspaceSettingsForm.ownerUserId || null, sedeIds: workspaceSettingsForm.scope === 'SEDE' ? workspaceSettingsForm.sedeIds : [], members: workspaceSettingsForm.members }) })
      if (!json.success || !json.data) return alert(json.error || 'No se pudo actualizar el proyecto.')
      setWorkspaceSettingsOpen(false)
      await loadBase()
      setSelectedWorkspaceId(json.data.id)
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function handleDeleteWorkspace(workspace: Workspace) {
    if (!workspace.permissions?.canManage) return alert('Solo un manager puede eliminar este proyecto.')
    if (!window.confirm(`Se eliminará el proyecto "${workspace.name}" si está vacío. ¿Deseas continuar?`)) return
    const json = await requestJson<null>(`/api/crm/task-workspaces/${workspace.id}`, { method: 'DELETE' })
    if (!json.success) return alert(json.error || 'No se pudo eliminar el proyecto.')
    await loadBase()
  }

  async function handleDeleteProject(project: WorkspaceProject) {
    if (!selectedWorkspaceId) return alert('Selecciona primero un espacio de trabajo.')
    if (!window.confirm(`Se eliminará el proyecto "${project.name}" si no tiene tareas. ¿Deseas continuar?`)) return
    const json = await requestJson<null>(`/api/crm/task-workspaces/${selectedWorkspaceId}/projects/${project.id}`, { method: 'DELETE' })
    if (!json.success) return alert(json.error || 'No se pudo eliminar el proyecto.')
    await loadBase()
    if (selectedProjectId === project.id) {
      setSelectedProjectId('')
    }
  }

  async function moveProjectToWorkspace(project: WorkspaceProject, targetWorkspaceId: string) {
    if (!targetWorkspaceId || targetWorkspaceId === project.workspaceId) return false
    const json = await requestJson<WorkspaceProject>(`/api/crm/task-workspaces/${project.workspaceId}/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: project.name,
        description: project.description || '',
        workspaceId: targetWorkspaceId,
      }),
    })
    if (!json.success || !json.data) {
      alert(json.error || 'No se pudo mover el proyecto.')
      return false
    }
    await loadBase()
    setSelectedWorkspaceId(targetWorkspaceId)
    setSelectedProjectId(project.id)
    toast({ title: 'Lista movida', description: 'La lista y sus tareas quedaron en el nuevo proyecto.' })
    return true
  }

  async function handleSaveProject() {
    if (!projectForm.workspaceId) return alert('Selecciona primero un espacio de trabajo.')
    if (!projectForm.name.trim()) return alert('El nombre del proyecto es requerido.')
    setSavingProject(true)
    try {
      const isEditing = Boolean(projectForm.projectId)
      const url = isEditing
        ? `/api/crm/task-workspaces/${projectForm.sourceWorkspaceId || projectForm.workspaceId}/projects/${projectForm.projectId}`
        : `/api/crm/task-workspaces/${projectForm.workspaceId}/projects`
      const method = isEditing ? 'PATCH' : 'POST'
      const json = await requestJson<WorkspaceProject>(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: projectForm.name, description: projectForm.description, workspaceId: projectForm.workspaceId }) })
      if (!json.success || !json.data) return alert(json.error || `No se pudo ${isEditing ? 'actualizar' : 'crear'} el proyecto.`)
      setProjectDialogOpen(false)
      setProjectForm({ sourceWorkspaceId: '', workspaceId: '', projectId: '', name: '', description: '' })
      await loadBase()
      setSelectedWorkspaceId(projectForm.workspaceId)
      setSelectedProjectId(json.data.id)
    } finally {
      setSavingProject(false)
    }
  }

  async function handleCreateTask() {
    if (!taskForm.title.trim()) return alert('El título de la tarea es requerido.')
    setSavingTask(true)
    try {
      const normalizedAssigneeIds = Array.from(new Set([...(currentUserId ? [currentUserId] : []), ...taskForm.assignedToUserIds]))
      const json = await requestJson<TaskItem>('/api/crm/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: taskForm.workspaceId || null, projectId: taskForm.projectId || null, title: taskForm.title, description: taskForm.description, dueAt: taskForm.dueAt || null, priority: taskForm.priority, status: taskForm.status, colorHex: normalizeHex(taskForm.colorHex), assignedToUserIds: normalizedAssigneeIds }) })
      if (!json.success) return alert(json.error || 'No se pudo crear la tarea.')
      setTaskDialogOpen(false)
      setTaskForm({ title: '', description: '', dueAt: '', priority: 'NORMAL', status: 'OPEN', colorHex: '#1D4ED8', assignedToUserIds: currentUserId ? [currentUserId] : [], workspaceId: selectedWorkspaceId || '', projectId: selectedProjectId || '' })
      await loadTasks(selectedWorkspaceId, taskViewMode)
      toast({
        title: 'Tarea creada',
        description: normalizedAssigneeIds.length
          ? 'La tarea se creó y se notificó a los responsables asignados.'
          : 'La tarea se creó correctamente.',
      })
    } finally {
      setSavingTask(false)
    }
  }

  async function handleUpdateTask(taskId: string, patch: Record<string, unknown>, successMessage?: { title: string; description?: string }) {
    const json = await requestJson<TaskItem>(`/api/crm/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    if (!json.success) {
      alert(json.error || 'No se pudo actualizar la tarea.')
      return false
    }
    await loadTasks(selectedWorkspaceId)
    if (detailDialogOpen) await loadTaskDetail(taskId)
    if (successMessage) {
      toast(successMessage)
    }
    return true
  }

  async function moveTaskToProject(task: TaskItem, workspaceId: string, projectId: string) {
    if (!workspaceId) return false
    if (task.workspace?.id === workspaceId && task.project?.id === projectId) return false
    const updated = await handleUpdateTask(task.id, { workspaceId, projectId }, {
      title: 'Tarea movida',
      description: projectId ? 'La tarea quedó ubicada en la lista seleccionada.' : 'La tarea quedó relacionada al proyecto seleccionado.',
    })
    if (!updated) return false
    await loadBase()
    setSelectedWorkspaceId(workspaceId)
    setSelectedProjectId(projectId)
    return true
  }

  function openMoveTaskDialog(task: TaskItem) {
    setTaskMoveForm({
      taskId: task.id,
      workspaceId: task.workspace?.id || selectedWorkspaceId,
      projectId: task.project?.id || '',
    })
    setTaskMoveDialogOpen(true)
  }

  async function handleMoveTask() {
    const task = tasks.find((item) => item.id === taskMoveForm.taskId) ?? null
    if (!task) return alert('La tarea ya no está disponible.')
    if (!taskMoveForm.workspaceId) return alert('Selecciona un proyecto de destino.')
    setMovingTask(true)
    try {
      const moved = await moveTaskToProject(task, taskMoveForm.workspaceId, taskMoveForm.projectId)
      if (!moved) return
      setTaskMoveDialogOpen(false)
      setTaskMoveForm({ taskId: '', workspaceId: '', projectId: '' })
    } finally {
      setMovingTask(false)
    }
  }

  async function handleDeleteTask(task: TaskItem) {
    if (!canEditTask(task)) return alert('Solo un editor o administrador puede eliminar tareas.')
    if (task.createdBy?.id !== currentUserId) return alert('Solo puedes eliminar tareas creadas por tu usuario.')
    setTaskCancelTarget(task)
    setTaskCancelReason('')
    setTaskCancelDialogOpen(true)
  }

  async function handleConfirmTaskCancellation() {
    if (!taskCancelTarget) return
    if (taskSettings.requireTaskCancellationReason && !taskCancelReason.trim()) {
      alert('Debes registrar el motivo de anulación para continuar.')
      return
    }

    setCancellingTask(true)
    try {
      const json = await requestJson<TaskItem>(`/api/crm/tasks/${taskCancelTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: taskCancelReason.trim() || null }),
      })
      if (!json.success) return alert(json.error || 'No se pudo anular la tarea.')

      if (selectedTask?.id === taskCancelTarget.id && !showArchived) {
        setDetailDialogOpen(false)
        setSelectedTask(null)
      }

      setTaskCancelDialogOpen(false)
      setTaskCancelTarget(null)
      setTaskCancelReason('')
      await loadTasks(selectedWorkspaceId)
      await loadBase()
      toast({
        title: 'Tarea anulada',
        description: taskCancelReason.trim()
          ? 'La tarea quedó archivada y el motivo se registró en historial y notificaciones.'
          : 'La tarea quedó archivada para conservar la trazabilidad.',
      })
    } finally {
      setCancellingTask(false)
    }
  }

  function closeTaskCancellationDialog() {
    if (cancellingTask) return
    setTaskCancelDialogOpen(false)
    setTaskCancelTarget(null)
    setTaskCancelReason('')
  }

  function goToPreviousTaskPage() {
    setTaskPage((current) => Math.max(1, current - 1))
  }

  function goToNextTaskPage() {
    setTaskPage((current) => Math.min(totalTaskPages, current + 1))
  }

  function goToTaskPage(page: number) {
    setTaskPage(Math.min(totalTaskPages, Math.max(1, page)))
  }

  function handleProjectDragStart(project: WorkspaceProject, event: React.DragEvent<HTMLDivElement>) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', serializeDragPayload({ type: 'project', projectId: project.id }))
  }

  function handleTaskDragStart(task: TaskItem, event: React.DragEvent<HTMLDivElement>) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', serializeDragPayload({ type: 'task', taskId: task.id }))
  }

  async function handleWorkspaceDrop(targetWorkspaceId: string, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOverWorkspaceId('')
    const payload = parseDragPayload(event.dataTransfer.getData('text/plain'))
    if (payload?.type !== 'project') return
    const project = workspaces.flatMap((workspace) => workspace.projects).find((item) => item.id === payload.projectId)
    if (!project) return
    await moveProjectToWorkspace(project, targetWorkspaceId)
  }

  async function handleProjectDrop(targetWorkspaceId: string, targetProjectId: string, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOverProjectId('')
    const payload = parseDragPayload(event.dataTransfer.getData('text/plain'))
    if (payload?.type !== 'task') return
    const task = tasks.find((item) => item.id === payload.taskId)
    if (!task) return
    await moveTaskToProject(task, targetWorkspaceId, targetProjectId)
  }

  async function handleTaskRowDrop(targetTask: TaskItem, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOverTaskId('')
    setDragOverTaskPlacement('before')
    const payload = parseDragPayload(event.dataTransfer.getData('text/plain'))
    if (payload?.type !== 'task' || payload.taskId === targetTask.id) return

    const draggedTask = tasks.find((item) => item.id === payload.taskId) ?? null
    if (!draggedTask || !canEditTask(draggedTask)) return

    if (isTaskPinned(payload.taskId) && isTaskPinned(targetTask.id)) {
      await reorderPinnedTasks(payload.taskId, targetTask.id, dragOverTaskPlacement)
      return
    }

    if (!isTaskPinned(payload.taskId) && !isTaskPinned(targetTask.id)) {
      await reorderVisibleTasks(payload.taskId, targetTask.id, dragOverTaskPlacement)
      return
    }

    const targetWorkspaceId = targetTask.workspace?.id || ''
    const targetProjectId = targetTask.project?.id || ''
    if (!targetWorkspaceId) return

    await moveTaskToProject(draggedTask, targetWorkspaceId, targetProjectId)
  }

  async function handlePinnedTaskDrop(targetTaskId: string, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOverTaskId('')
    setDragOverTaskPlacement('before')
    const payload = parseDragPayload(event.dataTransfer.getData('text/plain'))
    if (payload?.type !== 'task') return
    if (!isTaskPinned(payload.taskId) || !isTaskPinned(targetTaskId)) return
    await reorderPinnedTasks(payload.taskId, targetTaskId, dragOverTaskPlacement)
  }

  async function handleSaveDetail() {
    if (!detailForm.id) return
    if (selectedTask && !canEditTask(selectedTask)) return alert('Tu rol actual no permite editar esta tarea.')
    setSavingDetail(true)
    try {
      const patch: Record<string, unknown> = { title: detailForm.title, description: detailForm.description, dueAt: detailForm.dueAt || null, priority: detailForm.priority, status: detailForm.status, colorHex: normalizeHex(detailForm.colorHex), attachmentsJson: detailForm.attachmentsJson, customFieldsJson: detailForm.customFieldsJson, assignedToUserIds: detailForm.assignedToUserIds, archived: detailForm.archived }
      if (selectedTask && selectedTask.status !== 'CANCELED' && detailForm.status === 'CANCELED') {
        const reason = requestCancellationReason(detailForm.title || selectedTask.title, taskSettings.requireTaskCancellationReason)
        if (reason === null) return
        if (taskSettings.requireTaskCancellationReason && !reason) {
          alert('Debes registrar el motivo de anulación para continuar.')
          return
        }
        patch.cancellationReason = reason || null
      }
      patch.projectId = detailForm.projectId || null
      await handleUpdateTask(detailForm.id, patch, {
        title: detailForm.status === 'CANCELED' && selectedTask?.status !== 'CANCELED' ? 'Tarea anulada' : 'Tarea actualizada',
        description: detailForm.status === 'CANCELED' && selectedTask?.status !== 'CANCELED'
          ? 'La tarea quedó anulada y su traza se guardó en historial y notificaciones.'
          : detailForm.assignedToUserIds.length
            ? 'Se guardaron los cambios y se mantuvo la asignación de responsables.'
            : 'Los cambios de la tarea se guardaron correctamente.',
      })
    } finally {
      setSavingDetail(false)
    }
  }

  async function handleAddNote() {
    if (!selectedTask || !noteDraft.trim()) return alert('Escribe una nota para registrar en el historial.')
    if (!canEditTask(selectedTask)) return alert('Tu rol actual no permite editar esta tarea.')
    setSavingNote(true)
    try {
      const json = await requestJson<TaskItem>(`/api/crm/tasks/${selectedTask.id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: noteDraft }) })
      if (!json.success || !json.data) return alert(json.error || 'No se pudo agregar la nota.')
      setSelectedTask(normalizeTask(json.data))
      setNoteDraft('')
      await loadTasks(selectedWorkspaceId)
      toast({
        title: 'Nota registrada',
        description: 'La nota quedó en el historial y se notificó a los responsables.',
      })
    } finally {
      setSavingNote(false)
    }
  }

  function replaceTaskInState(task: TaskItem) {
    setTasks((current) => current.map((item) => item.id === task.id ? task : item))
    setSelectedTask((current) => current?.id === task.id ? task : current)
  }

  function openQuickTaskPanel(taskId: string, mode: QuickTaskPanelMode) {
    setQuickTaskPanel({ taskId, mode })
    if (mode === 'note') {
      setQuickNoteDraft('')
    }
  }

  async function handleQuickAddNote() {
    if (!quickTask || !quickNoteDraft.trim()) return alert('Escribe una nota para registrar en el historial.')
    if (!canEditTask(quickTask)) return alert('Tu rol actual no permite editar esta tarea.')
    setSavingQuickNote(true)
    try {
      const json = await requestJson<TaskItem>(`/api/crm/tasks/${quickTask.id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: quickNoteDraft }) })
      if (!json.success || !json.data) return alert(json.error || 'No se pudo agregar la nota.')
      replaceTaskInState(normalizeTask(json.data))
      setQuickNoteDraft('')
      setQuickTaskPanel(null)
      toast({
        title: 'Nota registrada',
        description: 'La nota se agregó y los responsables recibieron la novedad.',
      })
    } finally {
      setSavingQuickNote(false)
    }
  }

  async function uploadAttachment(file: File) {
    if (!detailForm.id) {
      alert('Abre una tarea antes de adjuntar archivos.')
      return null
    }
    setUploadingAttachment(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`/api/crm/tasks/${detailForm.id}/attachments`, { method: 'POST', body: formData })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<TaskAttachment>
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo subir el adjunto.')
        return null
      }
      return json.data
    } finally {
      setUploadingAttachment(false)
      if (attachmentInputRef.current) attachmentInputRef.current.value = ''
      if (customFieldFileInputRef.current) customFieldFileInputRef.current.value = ''
    }
  }

  async function handleAttachmentFile(file: File | null) {
    if (!file) return
    const uploaded = await uploadAttachment(file)
    if (!uploaded) return
    setDetailForm((current) => ({ ...current, attachmentsJson: [...current.attachmentsJson, uploaded] }))
  }

  async function handleLibraryAttachment(item: CrmFileItem) {
    if (!item.url) {
      alert('Solo puedes vincular archivos existentes de la biblioteca, no carpetas.')
      return
    }
    const attachment = mapLibraryItemToAttachment(item)
    setDetailForm((current) => current.attachmentsJson.some((existing) => existing.url === attachment.url)
      ? current
      : { ...current, attachmentsJson: [...current.attachmentsJson, attachment] })
  }

  async function handleExternalAttachmentLink() {
    const url = externalAttachmentForm.url.trim()
    const name = externalAttachmentForm.name.trim()
    if (!detailForm.id) return
    if (!url) return alert('Pega la URL compartida de Drive o OneDrive.')

    setUploadingAttachment(true)
    try {
      const response = await fetch(`/api/crm/tasks/${detailForm.id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: externalAttachmentForm.provider,
          name,
          url,
        }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<TaskAttachment>
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo vincular el archivo externo.')
        return
      }

      setDetailForm((current) => current.attachmentsJson.some((existing) => existing.url === json.data?.url)
        ? current
        : { ...current, attachmentsJson: [...current.attachmentsJson, json.data as TaskAttachment] })
      setExternalAttachmentForm(getInitialExternalAttachmentForm())
    } finally {
      setUploadingAttachment(false)
    }
  }

  async function handleCustomFieldFile(file: File | null) {
    if (!file) return
    const uploaded = await uploadAttachment(file)
    if (!uploaded) return
    if (customFieldUploadTarget && customFieldUploadTarget !== 'new') {
      setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((field) => field.id === customFieldUploadTarget ? { ...field, file: uploaded } : field) }))
    } else {
      setCustomFieldDraft((current) => ({ ...current, file: uploaded }))
    }
    setCustomFieldUploadTarget(null)
  }

  function handleAddCustomField() {
    const label = customFieldDraft.label.trim()
    if (!label) return alert('Escribe un nombre para el campo personalizado.')
    if (customFieldDraft.type === 'TEXT' && !customFieldDraft.textValue.trim()) return alert('Completa el contenido del campo de texto.')
    if (customFieldDraft.type === 'FILE' && !customFieldDraft.file) return alert('Sube un archivo para este campo personalizado.')
    setDetailForm((current) => ({ ...current, customFieldsJson: [...current.customFieldsJson, { id: createId('field'), label, type: customFieldDraft.type, textValue: customFieldDraft.type === 'TEXT' ? customFieldDraft.textValue.trim() : null, file: customFieldDraft.type === 'FILE' ? customFieldDraft.file : null }] }))
    setCustomFieldDraft({ label: '', type: 'TEXT', textValue: '', file: null })
  }

  function renderTaskAssignments(task: TaskItem) {
    if (!task.assignments.length) {
      return <span className="text-xs text-slate-400">Sin responsables</span>
    }

    return task.assignments.map((assignment) => (
      <span
        key={assignment.id}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[11px] font-semibold text-sky-800"
        title={getUserLabel(assignment.user)}
      >
        {initials(assignment.user.name, assignment.user.email)}
      </span>
    ))
  }

  function renderTaskStatusControl(task: TaskItem) {
    const statusMeta = STATUS_META[task.status]
    const statusOptions: Array<{ value: TaskStatus; label: string; className: string }> = [
      { value: 'OPEN', label: 'No iniciado', className: STATUS_META.OPEN.badgeClass },
      { value: 'IN_PROGRESS', label: 'En curso', className: STATUS_META.IN_PROGRESS.badgeClass },
      { value: 'DONE', label: 'Finalizada', className: STATUS_META.DONE.badgeClass },
      { value: 'CANCELED', label: 'Cancelada', className: STATUS_META.CANCELED.badgeClass },
    ]

    if (!canEditTasks) {
      return (
        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.badgeClass}`}>
          {statusMeta.label}
        </span>
      )
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-between gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors ${statusMeta.badgeClass}`}
            style={{ width: `${clampedTaskColumnWidth}px`, maxWidth: `${clampedTaskColumnWidth}px` }}
            aria-label={`Cambiar estado. Actual: ${statusMeta.label}`}
          >
            <span className="truncate">{statusMeta.label}</span>
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 rounded-2xl p-2">
          {statusOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => {
                if (option.value === 'CANCELED' && task.status !== 'CANCELED') {
                  const reason = requestCancellationReason(task.title, taskSettings.requireTaskCancellationReason)
                  if (reason === null) return
                  if (taskSettings.requireTaskCancellationReason && !reason) {
                    alert('Debes registrar el motivo de anulación para continuar.')
                    return
                  }
                  void handleUpdateTask(task.id, { status: option.value, cancellationReason: reason || null }, { title: 'Tarea anulada', description: reason ? 'La anulación quedó registrada con motivo.' : 'La tarea quedó anulada y archivada.' })
                  return
                }
                void handleUpdateTask(task.id, { status: option.value }, { title: 'Estado actualizado', description: `La tarea quedó en estado ${option.label.toLowerCase()}.` })
              }}
              className="rounded-xl px-2 py-1.5"
            >
              <span className={`inline-flex w-full items-center justify-between rounded-full border px-3 py-2 text-sm font-semibold ${option.className}`}>
                <span>{option.label}</span>
                {task.status === option.value ? <span className="text-xs opacity-80">Actual</span> : null}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  function renderTaskPriorityControl(task: TaskItem) {
    const priorityMeta = PRIORITY_META[task.priority]
    const priorityOptions: Array<{ value: TaskPriority; label: string; className: string }> = [
      { value: 'LOW', label: 'Baja', className: PRIORITY_META.LOW.badgeClass },
      { value: 'NORMAL', label: 'Normal', className: PRIORITY_META.NORMAL.badgeClass },
      { value: 'HIGH', label: 'Alta', className: PRIORITY_META.HIGH.badgeClass },
    ]

    if (!canEditTasks) {
      return (
        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${priorityMeta.badgeClass}`}>
          {priorityMeta.label}
        </span>
      )
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center justify-between gap-2 rounded-full border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors ${priorityMeta.badgeClass}`}
            style={{ width: `${clampedTaskColumnWidth}px`, maxWidth: `${clampedTaskColumnWidth}px` }}
            aria-label={`Cambiar prioridad. Actual: ${priorityMeta.label}`}
          >
            <span className="truncate">{priorityMeta.label}</span>
            <ChevronDown className="h-4 w-4 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 rounded-2xl p-2">
          {priorityOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => void handleUpdateTask(task.id, { priority: option.value }, { title: 'Prioridad actualizada', description: `La tarea quedó con prioridad ${option.label.toLowerCase()}.` })}
              className="rounded-xl px-2 py-1.5"
            >
              <span className={`inline-flex w-full items-center justify-between rounded-full border px-3 py-2 text-sm font-semibold ${option.className}`}>
                <span>{option.label}</span>
                {task.priority === option.value ? <span className="text-xs opacity-80">Actual</span> : null}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  function renderTaskAttachmentsColumn(task: TaskItem) {
    const attachments = task.attachmentsJson ?? []
    const firstImage = attachments.find((attachment) => attachment.type === 'image')

    if (!attachments.length) {
      return <span className="text-xs text-slate-400">Sin adjuntos</span>
    }

    return (
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        {firstImage ? (
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Image src={firstImage.url} alt={firstImage.name} fill className="object-cover" sizes="40px" unoptimized />
          </div>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[10px] font-semibold uppercase text-slate-500">
            {attachments[0]?.type || 'file'}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-700">{attachments[0]?.name || 'Adjunto'}</p>
          <p className="text-xs text-slate-500">{attachments.length} archivo(s)</p>
        </div>
      </div>
    )
  }

  function renderTaskCustomFieldsColumn(task: TaskItem) {
    const customFields = task.customFieldsJson ?? []
    const firstField = customFields[0]

    if (!firstField) {
      return <span className="text-xs text-slate-400">Sin campos</span>
    }

    return (
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-700">{firstField.label}</p>
        <p className="truncate text-xs text-slate-500">{firstField.type === 'TEXT' ? (firstField.textValue || 'Sin valor') : (firstField.file?.name || 'Archivo')}</p>
      </div>
    )
  }

  function renderTaskHistoryColumn(task: TaskItem) {
    const latestHistory = getLatestTaskHistoryEntry(task)

    if (!latestHistory) {
      return <span className="text-xs text-slate-400">Sin historial</span>
    }

    return (
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-700">{translateTaskHistoryMessage(latestHistory.message, latestHistory.type)}</p>
        <p className="truncate text-xs text-slate-500">{formatDate(latestHistory.createdAt, 'Sin fecha')}</p>
      </div>
    )
  }

  function renderTaskCreatedAtColumn(task: TaskItem) {
    return (
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-700">{formatDate(task.createdAt, 'Sin fecha')}</p>
        <p className="truncate text-xs text-slate-500">Creación de la tarea</p>
      </div>
    )
  }

  function renderTaskCreatedByColumn(task: TaskItem) {
    return (
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-700">{getUserLabel(task.createdBy)}</p>
        <p className="truncate text-xs text-slate-500">Usuario creador</p>
      </div>
    )
  }

  function renderTaskNoteColumn(task: TaskItem) {
    const notesCount = task.history.filter((entry) => entry.type === 'NOTE_ADDED').length

    return (
      <div className="flex items-center justify-between gap-2 overflow-hidden">
        <span className="truncate text-xs text-slate-500">{notesCount ? `${notesCount} nota(s)` : 'Sin notas'}</span>
        <Button variant="outline" size="sm" className="h-7 rounded-lg px-2 text-[11px]" onClick={() => openQuickTaskPanel(task.id, 'note')} disabled={!canEditTasks}>
          Nota rápida
        </Button>
      </div>
    )
  }

  function toggleExtraTaskColumn(column: ExtraTaskColumn, checked: boolean) {
    setVisibleExtraTaskColumns((current) => {
      if (checked) {
        return current.includes(column) ? current : [...current, column]
      }
      return current.filter((item) => item !== column)
    })
  }

  return (
    <div className="space-y-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Proyectos' }]}
        title="Tareas y proyectos"
        description="Crea tareas de forma directa, relaciónalas opcionalmente con proyectos o listas existentes, y centraliza el seguimiento con responsables, evidencia y estados claros."
        actions={<div className="flex flex-wrap items-center gap-2"><DropdownMenu><DropdownMenuTrigger asChild><Button className="rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" />Crear tarea<ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5"><DropdownMenuItem onSelect={() => openTaskCreationDialog('')}>Crear sin relación</DropdownMenuItem><DropdownMenuItem onSelect={() => openTaskCreationDialog(selectedProjectId || '')} disabled={!selectedWorkspaceId}>Crear en proyecto actual</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setWorkspaceDialogOpen(true)}>Crear proyecto</DropdownMenuItem></DropdownMenuContent></DropdownMenu><Button variant="outline" className="rounded-2xl border-slate-200 bg-white/85 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10" onClick={() => setWorkspaceDialogOpen(true)}>Nuevo proyecto</Button></div>}
        stats={[
          { label: 'Proyectos', value: workspaces.length, hint: 'Contextos colaborativos visibles', tone: 'sky' },
          { label: 'No iniciadas', value: filteredTasks.filter((task) => task.status === 'OPEN' && !task.archivedAt).length, hint: 'Pendiente de arrancar', tone: 'amber' },
          { label: 'En curso', value: filteredTasks.filter((task) => task.status === 'IN_PROGRESS' && !task.archivedAt).length, hint: 'Ejecución activa', tone: 'teal' },
          { label: 'Finalizadas', value: filteredTasks.filter((task) => task.status === 'DONE').length, hint: 'Cerradas', tone: 'teal' },
        ]}
      />

      <div
        ref={workspaceGridRef}
        className={`grid gap-4 xl:min-h-0 xl:overflow-hidden ${workspacePanelCollapsed ? 'xl:grid-cols-[minmax(0,1fr)]' : 'xl:grid-cols-[320px_minmax(0,1fr)]'}`}
        style={workspaceViewportHeight ? { height: `${workspaceViewportHeight}px` } : undefined}
      >
        {!workspacePanelCollapsed ? (
          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)] xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Proyectos</CardTitle>
              <CardDescription>Selecciona un proyecto, ajusta sus opciones desde el menú y administra sus listas cuando las necesites.</CardDescription>
              <div className="relative mt-4">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={workspaceListSearch}
                  onChange={(event) => setWorkspaceListSearch(event.target.value)}
                  placeholder="Buscar proyecto por nombre o descripción"
                  className="h-11 rounded-2xl border-slate-200 pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="min-h-0 space-y-3 p-4 md:p-5 xl:flex-1 xl:overflow-y-auto">
              {loading ? <p className="text-sm text-muted-foreground">Cargando proyectos...</p> : null}
              {!loading && workspaces.length === 0 ? <p className="text-sm text-muted-foreground">No tienes proyectos todavía.</p> : null}
              {!loading && workspaces.length > 0 && filteredWorkspaces.length === 0 ? <p className="text-sm text-muted-foreground">No encontré proyectos con ese criterio.</p> : null}
              {filteredWorkspaces.map((workspace) => {
                const isSelected = taskViewMode === 'SPACE' && selectedWorkspaceId === workspace.id
                const canManageCurrentWorkspace = Boolean(workspace.permissions?.canManage)
                const fullDescription = getWorkspaceDescription(workspace)
                const shortDescription = truncateText(fullDescription, 30)

                return (
                  <div
                    key={workspace.id}
                    onDragOver={(event) => {
                      event.preventDefault()
                      if (canManageCurrentWorkspace) setDragOverWorkspaceId(workspace.id)
                    }}
                    onDragLeave={() => setDragOverWorkspaceId((current) => current === workspace.id ? '' : current)}
                    onDrop={(event) => void handleWorkspaceDrop(workspace.id, event)}
                    className={isSelected
                      ? `w-full rounded-3xl border bg-sky-50/80 p-4 text-left shadow-sm ${dragOverWorkspaceId === workspace.id ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-sky-300'}`
                      : `w-full rounded-3xl border bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-4 text-left shadow-sm transition-shadow hover:shadow-md ${dragOverWorkspaceId === workspace.id ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-slate-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={() => handleSelectWorkspace(workspace.id)} className="block min-w-0 text-left">
                          <p className="font-semibold uppercase leading-5 text-slate-950">{workspace.name}</p>
                        </button>
                        <p className="mt-2 text-sm leading-6 text-slate-600" title={fullDescription}>{shortDescription}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{workspace.scope}</span>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">{formatRole(workspace.currentUserRole)}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={`Opciones de ${workspace.name}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
                            <DropdownMenuItem onSelect={() => handleSelectWorkspace(workspace.id)}>
                              Ver listas
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { handleSelectWorkspace(workspace.id); openWorkspaceSettings(workspace) }}>
                              Administrar miembros
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { handleSelectWorkspace(workspace.id); void openProjectDialog(workspace.id) }} disabled={!canManageCurrentWorkspace}>
                              Crear lista
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { handleSelectWorkspace(workspace.id); openWorkspaceSettings(workspace) }} disabled={!canManageCurrentWorkspace}>
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void handleDeleteWorkspace(workspace)} disabled={!canManageCurrentWorkspace} className="text-rose-600 focus:text-rose-700">
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>{workspace._count?.tasks ?? 0} tareas</span>
                      <span>{workspace._count?.members ?? workspace.members.length} miembros</span>
                    </div>

                    {isSelected ? (
                      <div className="mt-4 space-y-3 border-t border-sky-200/70 pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Listas</p>
                            <p className="text-xs text-slate-500">Cada lista ocupa todo el ancho y desde su botón + puedes crear tareas o gestionarla.</p>
                          </div>
                          <Button type="button" size="icon" className="h-10 w-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void openProjectDialog(workspace.id)} disabled={!canManageCurrentWorkspace}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid gap-2">
                          <Button type="button" variant={!selectedProjectId ? 'default' : 'outline'} className={!selectedProjectId ? 'justify-start rounded-2xl bg-slate-950 text-white hover:bg-slate-800' : 'justify-start rounded-2xl'} onClick={() => setSelectedProjectId('')}>
                            Todos
                          </Button>
                          {workspace.projects.map((project) => (
                            <div
                              key={project.id}
                              draggable={canManageCurrentWorkspace}
                              onDragStart={(event) => handleProjectDragStart(project, event)}
                              onDragOver={(event) => {
                                event.preventDefault()
                                if (workspace.permissions?.canEditTasks) setDragOverProjectId(project.id)
                              }}
                              onDragLeave={() => setDragOverProjectId((current) => current === project.id ? '' : current)}
                              onDrop={(event) => void handleProjectDrop(workspace.id, project.id, event)}
                              className={`w-full overflow-hidden rounded-2xl border bg-white shadow-sm ${dragOverProjectId === project.id ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-slate-200'}`}
                            >
                              <div className={selectedProjectId === project.id ? 'flex items-center justify-between gap-3 border-b border-sky-200 bg-sky-600 px-4 py-2.5 text-white' : 'flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-900'}>
                                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedProjectId(project.id)}>
                                  <span className="flex items-center gap-2 text-sm font-semibold">
                                    <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                    <span className="truncate">{project.name}</span>
                                  </span>
                                </button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className={selectedProjectId === project.id ? 'h-8 w-8 rounded-full text-white hover:bg-white/15 hover:text-white' : 'h-8 w-8 rounded-full text-slate-600 hover:bg-white hover:text-slate-900'}
                                      aria-label={`Crear o gestionar ${project.name}`}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48 rounded-2xl p-1.5">
                                    <DropdownMenuItem onSelect={() => openTaskCreationDialog(project.id)} disabled={!canCreateTask}>
                                      Crear tarea
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => openProjectDialog(workspace.id, project)} disabled={!canManageCurrentWorkspace}>
                                      Editar o mover lista
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => void handleDeleteProject(project)} disabled={!canManageCurrentWorkspace} className="text-rose-600 focus:text-rose-700">
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-600">
                                <div className="min-w-0">
                                  <p className="truncate text-xs text-slate-700">{project.description || 'Sin descripción operativa por ahora.'}</p>
                                  <p className="mt-1 text-xs text-slate-500">{project._count?.tasks ?? 0} tarea(s)</p>
                                </div>
                                <Button
                                  type="button"
                                  variant={selectedProjectId === project.id ? 'default' : 'outline'}
                                  className={selectedProjectId === project.id ? 'h-8 rounded-xl bg-slate-950 px-3 text-xs text-white hover:bg-slate-800' : 'h-8 rounded-xl px-3 text-xs'}
                                  onClick={() => setSelectedProjectId(project.id)}
                                >
                                  {selectedProjectId === project.id ? 'Activo' : 'Seleccionar'}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {!workspace.projects.length ? <p className="text-xs text-slate-500">Este proyecto aún no tiene listas. Puedes seguir creando tareas directas o agregar una lista cuando haga falta.</p> : null}
                        {selectedProjectId ? <p className="text-xs text-slate-500">Puedes crear tareas desde el botón + de la lista activa o desde el botón principal Crear tarea.</p> : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ) : null}

        <Card className="min-w-0 rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)] xl:flex xl:h-full xl:min-h-0 xl:flex-col">
          <TooltipProvider delayDuration={150}>
            <CardHeader className="border-b border-slate-100 pb-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-xl">{taskViewMode === 'MINE' ? 'Mis tareas' : taskViewMode === 'ALL_SPACES' ? 'Todas las tareas' : 'Tareas del proyecto'}</CardTitle>
                  {taskViewMode === 'SPACE' ? (
                    <CardDescription>
                      {selectedWorkspace
                        ? `${selectedWorkspace.name}${selectedProject ? ` · Lista ${selectedProject.name}` : ' · Todas las listas'} · ${formatRole(selectedWorkspace.currentUserRole)}${selectedWorkspace.permissions?.canEditTasks ? ' con edición de tareas' : ' solo lectura'}`
                        : 'Tabla operativa con responsables, creado por, estado, color, evidencia y acceso a detalle completo.'}
                    </CardDescription>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" className="h-9 gap-2 rounded-xl px-3 sm:w-9 sm:px-0" onClick={() => setWorkspacePanelCollapsed((current) => !current)} aria-label={workspacePanelCollapsed ? 'Mostrar espacios' : 'Ocultar espacios'}>
                          <LayoutPanelLeft className="h-4 w-4" />
                          <span className="text-xs sm:hidden">Proyectos</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{workspacePanelCollapsed ? 'Mostrar proyectos' : 'Ocultar proyectos'}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant={taskViewMode === 'MINE' ? 'default' : 'outline'} className="h-9 gap-2 rounded-xl px-3 sm:w-9 sm:px-0" onClick={handleShowMyTasks} aria-label="Ver mis tareas">
                          <PencilLine className="h-4 w-4" />
                          <span className="text-xs sm:hidden">Mías</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Todas mis tareas asignadas</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant={taskViewMode === 'ALL_SPACES' ? 'default' : 'outline'} className="h-9 gap-2 rounded-xl px-3 sm:w-9 sm:px-0" onClick={handleShowAllAccessibleTasks} aria-label="Ver todas las tareas de espacios asignados">
                          <Rows3 className="h-4 w-4" />
                          <span className="text-xs sm:hidden">Todas</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Todas las tareas de proyectos asignados</TooltipContent>
                    </Tooltip>
                    {canManageWorkspace ? <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => openWorkspaceSettings()} aria-label="Miembros y roles"><Users className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Miembros y roles</TooltipContent></Tooltip> : null}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant={searchPanelOpen ? 'default' : 'outline'} size="icon" className="h-9 w-9 rounded-xl" onClick={() => setSearchPanelOpen((current) => !current)} aria-label="Buscar tareas">
                          <SearchIcon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Buscar por tarea, responsable, campo o descripción</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant={showArchived ? 'default' : 'outline'} size="icon" className="h-9 w-9 rounded-xl" onClick={() => setShowArchived((current) => !current)} aria-label={showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}</TooltipContent>
                    </Tooltip>
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" aria-label="Columnas visibles">
                              <Columns3 className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Columnas visibles</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
                        <DropdownMenuCheckboxItem checked={showPriorityColumn} onCheckedChange={(checked) => setShowPriorityColumn(Boolean(checked))}>
                          Prioridad
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={showCreatedAtColumn} onCheckedChange={(checked) => setShowCreatedAtColumn(Boolean(checked))}>
                          Fecha de creación
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem checked={visibleExtraTaskColumns.includes('attachments')} onCheckedChange={(checked) => toggleExtraTaskColumn('attachments', Boolean(checked))}>
                          Adjuntos
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={visibleExtraTaskColumns.includes('custom-fields')} onCheckedChange={(checked) => toggleExtraTaskColumn('custom-fields', Boolean(checked))}>
                          Campos personalizados
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={visibleExtraTaskColumns.includes('history')} onCheckedChange={(checked) => toggleExtraTaskColumn('history', Boolean(checked))}>
                          Último cambio
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={visibleExtraTaskColumns.includes('note')} onCheckedChange={(checked) => toggleExtraTaskColumn('note', Boolean(checked))}>
                          Nota rápida
                        </DropdownMenuCheckboxItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="hidden items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 lg:flex">
                      <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Ancho</span>
                      <input
                        type="range"
                        min="120"
                        max="220"
                        step="10"
                        value={clampedTaskColumnWidth}
                        onChange={(event) => setTaskColumnWidth(Number(event.target.value))}
                        className="w-24 accent-slate-900"
                      />
                      <span className="min-w-[46px] text-[11px] font-semibold text-slate-600">{clampedTaskColumnWidth}px</span>
                    </div>
                  </div>
                  {searchPanelOpen ? <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." className="h-9 w-full rounded-xl text-sm sm:w-[220px]" /> : null}
                  <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 lg:hidden sm:w-fit">
                    <Label className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Ancho</Label>
                    <input
                      type="range"
                      min="120"
                      max="220"
                      step="10"
                      value={clampedTaskColumnWidth}
                      onChange={(event) => setTaskColumnWidth(Number(event.target.value))}
                      className="w-full accent-slate-900 sm:w-24"
                    />
                    <span className="min-w-[46px] text-[11px] font-semibold text-slate-600">{clampedTaskColumnWidth}px</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 p-0 xl:flex-1 xl:min-h-0 xl:overflow-hidden">
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
                <div className="w-max min-h-full" style={{ minWidth: `${taskTableMinWidth}px` }}>
                  <div className="grid gap-3 border-b border-slate-100 bg-white px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 xl:sticky xl:top-0 xl:z-10" style={{ gridTemplateColumns: taskGridTemplate }}>
                  <span>Tarea</span>
                  {showCrossWorkspaceColumn ? <span>Proyecto</span> : null}
                  {showPriorityColumn ? <span>Prioridad</span> : null}
                  <span>Descripción</span>
                  <span>Responsables</span>
                  <span>Creado por</span>
                  <span>Estado</span>
                  <span>Entrega</span>
                  {showCreatedAtColumn ? <button type="button" className="inline-flex items-center gap-1 text-left hover:text-slate-900" onClick={() => setTaskSortDirection((current) => current === 'asc' ? 'desc' : 'asc')}><span>Creada</span><ArrowDownUp className="h-3.5 w-3.5" /></button> : null}
                  {visibleExtraTaskColumns.includes('attachments') ? <span>Adjuntos</span> : null}
                  {visibleExtraTaskColumns.includes('custom-fields') ? <span>Campos</span> : null}
                  {visibleExtraTaskColumns.includes('history') ? <span>Último cambio</span> : null}
                  {visibleExtraTaskColumns.includes('note') ? <span>Nota rápida</span> : null}
                  <span>Acciones</span>
                </div>
                  {paginatedTasks.map((task) => {
                  const statusMeta = STATUS_META[task.status]
                  const canEditCurrentTask = canEditTask(task)
                  const canDeleteTask = Boolean(canEditCurrentTask && currentUserId && task.createdBy?.id === currentUserId && (task.status !== 'CANCELED' || !task.archivedAt))
                  const pinned = isTaskPinned(task.id)
                  return (
                    <div
                      key={task.id}
                      draggable={canEditCurrentTask}
                      onDragStart={(event) => handleTaskDragStart(task, event)}
                      onDragEnd={() => {
                        setDragOverTaskId('')
                        setDragOverTaskPlacement('before')
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        const bounds = event.currentTarget.getBoundingClientRect()
                        const placement = event.clientY - bounds.top < bounds.height / 2 ? 'before' : 'after'
                        setDragOverTaskId(task.id)
                        setDragOverTaskPlacement(placement)
                      }}
                      onDragLeave={() => {
                        setDragOverTaskId((current) => current === task.id ? '' : current)
                      }}
                      onDrop={(event) => {
                        if (pinned) {
                          void handlePinnedTaskDrop(task.id, event)
                          return
                        }
                        void handleTaskRowDrop(task, event)
                      }}
                      className={`group relative grid items-center gap-3 border-b px-4 py-2 text-xs text-slate-700 bg-gradient-to-r transition-[margin,box-shadow,colors,transform] duration-300 ease-out ${dragOverTaskId === task.id ? 'border-emerald-400 ring-2 ring-inset ring-emerald-200' : ''} ${dragOverTaskId === task.id && dragOverTaskPlacement === 'before' ? 'mt-6' : ''} ${dragOverTaskId === task.id && dragOverTaskPlacement === 'after' ? 'mb-6' : ''} ${statusMeta.softClass}`}
                      style={{ gridTemplateColumns: taskGridTemplate, borderLeft: `5px solid ${normalizeHex(task.colorHex)}`, borderBottomColor: 'rgba(226,232,240,0.9)' }}
                    >
                      {dragOverTaskId === task.id && dragOverTaskPlacement === 'before' ? <div className="pointer-events-none absolute -top-5 left-4 right-4 h-4 rounded-full border-2 border-dashed border-emerald-300 bg-emerald-100/85 shadow-[0_0_0_6px_rgba(110,231,183,0.16)] transition-all duration-300 ease-out animate-[pulse_1.6s_ease-in-out_infinite]" aria-hidden="true" /> : null}
                      <div className="flex min-w-0 items-center gap-2"><GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-slate-400 active:cursor-grabbing" /><div className="min-w-0 flex-1"><Tooltip><TooltipTrigger asChild><p className="truncate font-semibold text-slate-950">{task.title}</p></TooltipTrigger><TooltipContent><p className="max-w-sm break-words text-xs">{task.title}</p></TooltipContent></Tooltip></div><Button variant="ghost" size="icon" className={pinned ? 'h-7 w-7 shrink-0 rounded-full text-amber-600 opacity-100 hover:bg-amber-100 hover:text-amber-700' : 'h-7 w-7 shrink-0 rounded-full opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-900 group-hover:opacity-100'} aria-label={pinned ? `Desanclar ${task.title}` : `Anclar ${task.title}`} onClick={() => void toggleTaskPinned(task)}><Pin className="h-3.5 w-3.5" /></Button></div>
                      {showCrossWorkspaceColumn ? <div className="min-w-0"><p className="truncate font-medium text-slate-900">{task.workspace?.name || 'Sin proyecto'}</p><p className="truncate text-[11px] text-slate-500">{task.project?.name || 'Sin lista'}</p></div> : null}
                      {showPriorityColumn ? <div className="overflow-hidden">{renderTaskPriorityControl(task)}</div> : null}
                      <div className="min-w-0"><Tooltip><TooltipTrigger asChild><p className="truncate text-slate-600">{task.description || 'Sin descripción'}</p></TooltipTrigger><TooltipContent><p className="max-w-sm break-words text-xs">{task.description || 'Sin descripción'}</p></TooltipContent></Tooltip></div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden">{renderTaskAssignments(task)}</div>
                      <div className="overflow-hidden">{renderTaskCreatedByColumn(task)}</div>
                      <div className="overflow-hidden">{renderTaskStatusControl(task)}</div>
                      <div className="truncate text-slate-600">{task.completedAt ? `Completada: ${formatDate(task.completedAt, 'Sin fecha')}` : formatDate(task.dueAt, 'Sin fecha')}</div>
                      {showCreatedAtColumn ? <div className="overflow-hidden">{renderTaskCreatedAtColumn(task)}</div> : null}
                      {visibleExtraTaskColumns.includes('attachments') ? <div className="overflow-hidden">{renderTaskAttachmentsColumn(task)}</div> : null}
                      {visibleExtraTaskColumns.includes('custom-fields') ? <div className="overflow-hidden">{renderTaskCustomFieldsColumn(task)}</div> : null}
                      {visibleExtraTaskColumns.includes('history') ? <div className="overflow-hidden">{renderTaskHistoryColumn(task)}</div> : null}
                      {visibleExtraTaskColumns.includes('note') ? <div className="overflow-hidden">{renderTaskNoteColumn(task)}</div> : null}
                      {dragOverTaskId === task.id && dragOverTaskPlacement === 'after' ? <div className="pointer-events-none absolute -bottom-5 left-4 right-4 h-4 rounded-full border-2 border-dashed border-emerald-300 bg-emerald-100/85 shadow-[0_0_0_6px_rgba(110,231,183,0.16)] transition-all duration-300 ease-out animate-[pulse_1.6s_ease-in-out_infinite]" aria-hidden="true" /> : null}
                      <div className="flex items-center gap-1 overflow-hidden">
                        <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" aria-label={`Ver detalle de ${task.title}`} onClick={() => void loadTaskDetail(task.id)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" aria-label={`Acciones para ${task.title}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-2xl p-1.5">
                            <DropdownMenuItem onSelect={() => void handleUpdateTask(task.id, { archived: !task.archivedAt }, { title: task.archivedAt ? 'Tarea restaurada' : 'Tarea archivada', description: task.archivedAt ? 'La tarea volvió a estar activa.' : 'La tarea se movió a archivadas.' })} disabled={!canEditCurrentTask}>
                              {task.archivedAt ? 'Restaurar' : 'Archivar'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => openMoveTaskDialog(task)} disabled={!canEditCurrentTask}>
                              Mover tarea
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void handleDeleteTask(task)} disabled={!canDeleteTask} className="text-rose-600 focus:text-rose-700">
                              {task.status === 'CANCELED' && task.archivedAt ? 'Ya anulada' : 'Anular'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
                  {!filteredTasks.length ? <div className="px-6 py-8 text-sm text-slate-500">{taskViewMode === 'MINE' ? 'No tienes tareas asignadas para mostrar.' : taskViewMode === 'ALL_SPACES' ? 'No hay tareas para mostrar en tus proyectos asignados.' : selectedWorkspace ? (selectedProject ? 'No hay tareas para mostrar en esta lista.' : selectedWorkspace.projects.length ? 'No hay tareas para mostrar en este proyecto.' : 'Todavía no hay tareas en este proyecto. Puedes crear una tarea directa o agregar una lista.') : 'Selecciona un proyecto para ver tareas o usa Crear tarea para registrar una nueva.'}</div> : null}
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span>{filteredTasks.length ? `Mostrando ${visibleTaskRange.start}-${visibleTaskRange.end} de ${filteredTasks.length} tareas` : 'Sin tareas para paginar'}</span>
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Por página</Label>
                    <Select value={String(taskPageSize)} onValueChange={(value) => setTaskPageSize(Number(value))}>
                      <SelectTrigger className="h-8 w-[92px] rounded-xl bg-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 rounded-xl px-3 text-xs" onClick={goToPreviousTaskPage} disabled={taskPage <= 1}>
                    Anterior
                  </Button>
                  {visibleTaskPages.map((page) => (
                    <Button key={page} variant={page === taskPage ? 'default' : 'outline'} size="sm" className="h-8 min-w-8 rounded-xl px-2 text-xs" onClick={() => goToTaskPage(page)}>
                      {page}
                    </Button>
                  ))}
                  <Button variant="outline" size="sm" className="h-8 rounded-xl px-3 text-xs" onClick={goToNextTaskPage} disabled={taskPage >= totalTaskPages}>
                    Siguiente
                  </Button>
                </div>
              </div>
            </div>
            </CardContent>
          </TooltipProvider>
        </Card>
      </div>

      <Dialog open={taskCancelDialogOpen} onOpenChange={(open) => { if (!open) closeTaskCancellationDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Anular tarea</DialogTitle>
            <DialogDescription>
              {taskCancelTarget
                ? `La tarea ${taskCancelTarget.title} se marcará como cancelada y archivada para conservar el historial.`
                : 'Selecciona una tarea válida.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Esta acción ya no borra la tarea físicamente. Se guardará la traza en historial y se notificará a los involucrados.
            </div>
            <div className="grid gap-2">
              <Label>Motivo{taskSettings.requireTaskCancellationReason ? ' obligatorio' : ' opcional'}</Label>
              <Textarea
                value={taskCancelReason}
                onChange={(event) => setTaskCancelReason(event.target.value)}
                rows={4}
                placeholder="Ejemplo: el cliente canceló el requerimiento, se duplicó la tarea o ya no aplica."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTaskCancellationDialog} disabled={cancellingTask}>Cancelar</Button>
            <Button onClick={() => void handleConfirmTaskCancellation()} disabled={cancellingTask}>
              {cancellingTask ? 'Anulando...' : 'Confirmar anulación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(quickTaskPanel)} onOpenChange={(open) => { if (!open) setQuickTaskPanel(null) }}>
        <DialogContent className={quickTaskPanel?.mode === 'note' ? 'max-w-md' : 'max-w-2xl'}>
          <DialogHeader>
            <DialogTitle>
              {quickTaskPanel?.mode === 'attachments' ? 'Adjuntos de la tarea' : null}
              {quickTaskPanel?.mode === 'custom-fields' ? 'Campos personalizados' : null}
              {quickTaskPanel?.mode === 'history' ? 'Último cambio' : null}
              {quickTaskPanel?.mode === 'note' ? 'Crear nota rápida' : null}
            </DialogTitle>
            <DialogDescription>
              {quickTask ? quickTask.title : 'Selecciona una tarea válida.'}
            </DialogDescription>
          </DialogHeader>

          {quickTaskPanel?.mode === 'attachments' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {quickTask?.attachmentsJson?.length ? quickTask.attachmentsJson.map((attachment) => (
                <div key={attachment.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-950">{attachment.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{attachment.type.toUpperCase()} · {formatAttachmentSize(attachment.sizeBytes)}</p>
                    </div>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {attachment.type === 'image' ? (
                      <div className="relative h-32 w-full">
                        <Image src={attachment.url} alt={attachment.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 320px" unoptimized />
                      </div>
                    ) : (
                      <div className="flex h-24 items-center justify-center px-3 text-center text-sm text-slate-500">
                        {attachment.mimeType || 'Archivo disponible'}
                      </div>
                    )}
                  </div>
                  <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:text-sky-900">Abrir archivo</a>
                </div>
              )) : <p className="text-sm text-slate-500">Esta tarea no tiene adjuntos.</p>}
            </div>
          ) : null}

          {quickTaskPanel?.mode === 'custom-fields' ? (
            <div className="space-y-3">
              {quickTask?.customFieldsJson?.length ? quickTask.customFieldsJson.map((field) => (
                <div key={field.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-950">{field.label}</p>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{field.type}</span>
                  </div>
                  {field.type === 'TEXT' ? <p className="mt-2 text-sm text-slate-600">{field.textValue || 'Sin contenido'}</p> : null}
                  {field.type === 'FILE' ? (
                    field.file ? (
                      <div className="mt-2 space-y-2">
                        {field.file.type === 'image' ? (
                          <div className="relative h-28 w-full overflow-hidden rounded-xl border border-slate-200">
                            <Image src={field.file.url} alt={field.file.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 320px" unoptimized />
                          </div>
                        ) : null}
                        <a href={field.file.url} target="_blank" rel="noreferrer" className="inline-flex text-sm font-medium text-sky-700 hover:text-sky-900">{field.file.name}</a>
                      </div>
                    ) : <p className="mt-2 text-sm text-slate-500">Sin archivo asociado.</p>
                  ) : null}
                </div>
              )) : <p className="text-sm text-slate-500">Esta tarea no tiene campos personalizados.</p>}
            </div>
          ) : null}

          {quickTaskPanel?.mode === 'history' ? (
            quickTaskLatestHistory ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900">{translateTaskHistoryMessage(quickTaskLatestHistory.message, quickTaskLatestHistory.type)}</p>
                  <span className="text-xs text-slate-500">{formatDate(quickTaskLatestHistory.createdAt, 'Sin fecha')}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{quickTaskLatestHistory.actorUser?.name || quickTaskLatestHistory.actorUser?.email || 'Sistema'} · {formatTaskHistoryType(quickTaskLatestHistory.type)}</p>
              </div>
            ) : <p className="text-sm text-slate-500">Esta tarea no tiene historial todavía.</p>
          ) : null}

          {quickTaskPanel?.mode === 'note' ? (
            <div className="space-y-3">
              <Textarea value={quickNoteDraft} onChange={(event) => setQuickNoteDraft(event.target.value)} placeholder="Escribe una nota breve para esta tarea..." rows={4} disabled={!canEditTasks} />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setQuickTaskPanel(null)}>Cancelar</Button>
                <Button onClick={() => void handleQuickAddNote()} disabled={savingQuickNote || !canEditTasks}>{savingQuickNote ? 'Guardando...' : 'Guardar nota'}</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={workspaceSettingsOpen} onOpenChange={setWorkspaceSettingsOpen}><DialogContent className="max-h-[90vh] max-w-[880px] overflow-y-auto"><DialogHeader><DialogTitle>Administrar proyecto</DialogTitle><DialogDescription>Define privacidad, miembros y responsables sin afectar las tareas ya existentes.</DialogDescription></DialogHeader><div className="grid gap-3 py-1.5"><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Nombre</Label><Input value={workspaceSettingsForm.name} onChange={(event) => setWorkspaceSettingsForm((current) => ({ ...current, name: event.target.value }))} disabled={!canManageWorkspace} /></div><div className="grid gap-1.5"><Label>Responsable</Label><Select value={workspaceSettingsForm.ownerUserId || '__none__'} onValueChange={(value) => setWorkspaceSettingsForm((current) => ({ ...current, ownerUserId: value === '__none__' ? '' : value, members: value !== '__none__' && !current.members.some((item) => item.userId === value) ? [...current.members, { userId: value, role: 'MANAGER' }] : current.members }))} disabled={!canManageWorkspace}><SelectTrigger><SelectValue placeholder="Selecciona un responsable" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin responsable</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id}>{getUserLabel(user)}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-1.5"><Label>Descripción</Label><Textarea value={workspaceSettingsForm.description} onChange={(event) => setWorkspaceSettingsForm((current) => ({ ...current, description: event.target.value }))} rows={3} disabled={!canManageWorkspace} /></div><div className="grid gap-1.5"><Label>Privacidad</Label><Select value={workspaceSettingsForm.visibility} onValueChange={(value) => setWorkspaceSettingsForm((current) => ({ ...current, visibility: value as WorkspaceVisibility }))} disabled={!canManageWorkspace}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PUBLIC">Público</SelectItem><SelectItem value="PRIVATE">Privado</SelectItem><SelectItem value="HIDDEN">Oculto</SelectItem></SelectContent></Select><p className="text-xs text-slate-500">Público permite visibilidad general de la empresa. Privado y oculto conservan acceso por miembros.</p></div>{workspaceSettingsForm.scope === 'SEDE' ? <div className="grid gap-1.5"><Label>Sedes vinculadas</Label><Select value="__none__" onValueChange={(value) => { if (value === '__none__') return; setWorkspaceSettingsForm((current) => ({ ...current, sedeIds: current.sedeIds.includes(value) ? current.sedeIds : [...current.sedeIds, value] })) }} disabled={!canManageWorkspace}><SelectTrigger><SelectValue placeholder="Selecciona y agrega sedes" /></SelectTrigger><SelectContent><SelectItem value="__none__">Selecciona</SelectItem>{sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}</SelectContent></Select><div className="flex flex-wrap gap-2">{workspaceSettingsForm.sedeIds.length ? workspaceSettingsForm.sedeIds.map((sedeId) => { const sede = sedes.find((item) => item.id === sedeId); return <button key={sedeId} type="button" onClick={() => setWorkspaceSettingsForm((current) => ({ ...current, sedeIds: current.sedeIds.filter((item) => item !== sedeId) }))} className="rounded-full bg-sky-100 px-3 py-1.5 text-sm text-sky-800" disabled={!canManageWorkspace}>{sede?.nombre || sedeId} ×</button> }) : <span className="text-sm text-slate-400">Sin sedes vinculadas.</span>}</div></div> : null}<div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]"><div className="grid gap-1.5"><Label>Agregar miembro</Label><Input value={workspaceMemberSearch} onChange={(event) => setWorkspaceMemberSearch(event.target.value)} placeholder="Busca usuarios para invitarlos al proyecto..." disabled={!canManageWorkspace} /><div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5">{workspaceMemberCandidates.map((user) => <button key={user.id} type="button" onClick={() => setWorkspaceSettingsForm((current) => ({ ...current, members: [...current.members, { userId: user.id, role: 'VIEWER' }] }))} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left" disabled={!canManageWorkspace}><span>{getUserLabel(user)}</span><span className="text-xs text-slate-500">Agregar</span></button>)}{!workspaceMemberCandidates.length ? <p className="text-sm text-slate-400">No hay usuarios adicionales con ese filtro.</p> : null}</div></div><div className="grid gap-1.5"><Label>Miembros y roles</Label><div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5">{workspaceSettingsForm.members.map((member) => { const user = users.find((item) => item.id === member.userId); const locked = member.userId === selectedWorkspace?.createdBy?.id || member.userId === workspaceSettingsForm.ownerUserId; return <div key={member.userId} className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 md:grid-cols-[1fr_160px_96px] md:items-center"><div><p className="font-medium text-slate-950">{getUserLabel(user)}</p><p className="text-xs text-slate-500">{locked ? 'Rol protegido por propiedad del proyecto' : 'Puedes cambiar el rol o quitar el acceso'}</p></div><Select value={member.role} onValueChange={(value) => setWorkspaceSettingsForm((current) => ({ ...current, members: current.members.map((item) => item.userId === member.userId ? { ...item, role: value as WorkspaceRole } : item) }))} disabled={!canManageWorkspace || locked}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="VIEWER">Lector</SelectItem><SelectItem value="EDITOR">Editor</SelectItem><SelectItem value="MANAGER">Administrador</SelectItem></SelectContent></Select><Button variant="outline" onClick={() => setWorkspaceSettingsForm((current) => ({ ...current, members: current.members.filter((item) => item.userId !== member.userId) }))} disabled={!canManageWorkspace || locked}>Quitar</Button></div>})}</div></div></div></div><DialogFooter><Button variant="outline" onClick={() => setWorkspaceSettingsOpen(false)}>Cancelar</Button><Button onClick={() => void handleSaveWorkspaceSettings()} disabled={savingWorkspace || !canManageWorkspace}>{savingWorkspace ? 'Guardando...' : 'Guardar cambios'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={workspaceDialogOpen} onOpenChange={setWorkspaceDialogOpen}><DialogContent className="max-w-[760px]"><DialogHeader><DialogTitle>Nuevo proyecto</DialogTitle><DialogDescription>Define privacidad, responsable y miembros. Las tareas podrán relacionarse a este proyecto de forma opcional.</DialogDescription></DialogHeader><div className="grid gap-3 py-1.5"><div className="grid gap-1.5"><Label>Nombre</Label><Input value={workspaceForm.name} onChange={(event) => setWorkspaceForm((current) => ({ ...current, name: event.target.value }))} /></div><div className="grid gap-1.5"><Label>Descripción</Label><Textarea value={workspaceForm.description} onChange={(event) => setWorkspaceForm((current) => ({ ...current, description: event.target.value }))} rows={3} /></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Tipo base</Label><Select value={workspaceForm.scope} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, scope: value as WorkspaceScope, sedeId: '', sedeIds: [], ownerUserId: '', memberUserIds: [] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SEDE">Por sede</SelectItem><SelectItem value="USER">Por usuario</SelectItem></SelectContent></Select></div><div className="grid gap-1.5"><Label>Privacidad</Label><Select value={workspaceForm.visibility} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, visibility: value as WorkspaceVisibility }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PUBLIC">Público</SelectItem><SelectItem value="PRIVATE">Privado</SelectItem><SelectItem value="HIDDEN">Oculto</SelectItem></SelectContent></Select></div>{workspaceForm.scope === 'SEDE' ? <div className="grid gap-1.5 md:col-span-2"><Label>Sedes</Label><Select value="__none__" onValueChange={(value) => { if (value === '__none__') return; setWorkspaceForm((current) => { const nextSedeIds = current.sedeIds.includes(value) ? current.sedeIds : [...current.sedeIds, value]; return { ...current, sedeId: nextSedeIds[0] || value, sedeIds: nextSedeIds } }) }}><SelectTrigger><SelectValue placeholder="Selecciona y agrega sedes" /></SelectTrigger><SelectContent><SelectItem value="__none__">Selecciona</SelectItem>{sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}</SelectContent></Select><div className="flex flex-wrap gap-2">{workspaceForm.sedeIds.length ? workspaceForm.sedeIds.map((sedeId) => { const sede = sedes.find((item) => item.id === sedeId); return <button key={sedeId} type="button" onClick={() => setWorkspaceForm((current) => { const nextSedeIds = current.sedeIds.filter((item) => item !== sedeId); return { ...current, sedeId: nextSedeIds[0] || '', sedeIds: nextSedeIds } })} className="rounded-full bg-sky-100 px-3 py-1.5 text-sm text-sky-800">{sede?.nombre || sedeId} ×</button> }) : <span className="text-sm text-slate-400">Agrega una o varias sedes para este proyecto.</span>}</div></div> : <div className="grid gap-1.5 md:col-span-2"><Label>Usuario responsable</Label><Select value={workspaceForm.ownerUserId || '__none__'} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, ownerUserId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger><SelectContent><SelectItem value="__none__">Selecciona</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id}>{getUserLabel(user)}</SelectItem>)}</SelectContent></Select></div>}</div><div className="grid gap-1.5"><Label>Invitar usuarios con acceso</Label><Input value={workspaceSearch} onChange={(event) => setWorkspaceSearch(event.target.value)} placeholder="Busca usuarios por nombre o correo..." /><div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5">{workspaceCandidates.map((user) => { const selected = workspaceForm.memberUserIds.includes(user.id); return <button key={user.id} type="button" onClick={() => setWorkspaceForm((current) => ({ ...current, memberUserIds: selected ? current.memberUserIds.filter((item) => item !== user.id) : [...current.memberUserIds, user.id] }))} className={selected ? 'flex w-full items-center justify-between rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left'}><span>{getUserLabel(user)}</span><span className="text-xs text-slate-500">{selected ? 'Invitado' : 'Agregar'}</span></button>})}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setWorkspaceDialogOpen(false)}>Cancelar</Button><Button onClick={() => void handleCreateWorkspace()} disabled={savingWorkspace}>{savingWorkspace ? 'Guardando...' : 'Crear proyecto'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}><DialogContent className="max-h-[90vh] max-w-[760px] overflow-y-auto"><DialogHeader><DialogTitle>Nueva tarea</DialogTitle><DialogDescription>Crea una tarea directa y relaciónala de forma opcional con un proyecto o una lista existente.</DialogDescription></DialogHeader><div className="grid gap-3 py-1.5"><div className="grid gap-1.5"><Label>Título</Label><Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} /></div><div className="grid gap-1.5"><Label>Descripción</Label><Textarea value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} rows={4} /></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Estado inicial</Label><Select value={taskForm.status} onValueChange={(value) => setTaskForm((current) => ({ ...current, status: value as TaskStatus }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">No iniciado</SelectItem><SelectItem value="IN_PROGRESS">En curso</SelectItem><SelectItem value="DONE">Finalizada</SelectItem><SelectItem value="CANCELED">Cancelada</SelectItem></SelectContent></Select></div><div className="grid gap-1.5"><Label>Prioridad</Label><Select value={taskForm.priority} onValueChange={(value) => setTaskForm((current) => ({ ...current, priority: value as TaskPriority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Baja</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">Alta</SelectItem></SelectContent></Select></div></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Relacionar con proyecto</Label><Select value={taskForm.workspaceId || '__none__'} onValueChange={(value) => setTaskForm((current) => ({ ...current, workspaceId: value === '__none__' ? '' : value, projectId: value === '__none__' ? '' : current.projectId }))}><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin proyecto</SelectItem>{editableWorkspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-1.5"><Label>Relacionar con lista</Label><Select value={taskForm.projectId || '__none__'} onValueChange={(value) => setTaskForm((current) => ({ ...current, projectId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin lista</SelectItem>{(editableWorkspaces.find((workspace) => workspace.id === taskForm.workspaceId)?.projects || []).map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div></div><div className="flex justify-end"><Button type="button" variant="outline" className="rounded-xl" onClick={() => setWorkspaceDialogOpen(true)}>Crear proyecto nuevo</Button></div><div className="grid gap-1.5"><Label>Color de la tarea</Label><div className="flex flex-wrap items-center gap-2.5">{COLOR_PRESETS.map((color) => <button key={color} type="button" className={normalizeHex(taskForm.colorHex) === color ? 'h-9 w-9 rounded-full ring-4 ring-slate-300' : 'h-9 w-9 rounded-full ring-1 ring-slate-200'} style={{ backgroundColor: color }} onClick={() => setTaskForm((current) => ({ ...current, colorHex: color }))} />)}<Input type="color" value={normalizeHex(taskForm.colorHex)} onChange={(event) => setTaskForm((current) => ({ ...current, colorHex: event.target.value.toUpperCase() }))} className="h-9 w-12 rounded-lg p-1" /></div></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Fecha y hora de entrega</Label><Input type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))} /></div><div className="rounded-xl border border-slate-200 p-3" style={{ background: `linear-gradient(135deg, ${normalizeHex(taskForm.colorHex)} 0%, #ffffff 120%)` }}><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">Vista rápida</p><p className="mt-1.5 font-semibold text-white">{taskForm.title || 'Nueva tarea'}</p><p className="mt-1 text-sm text-white/85">{formatStatus(taskForm.status)} · {PRIORITY_META[taskForm.priority].label}</p><p className="mt-2 text-xs text-white/80">Creado por: {users.find((user) => user.id === currentUserId)?.name || 'Usuario actual'}</p></div></div><div className="grid gap-1.5"><Label>Responsables</Label><Input value={assigneeSearch} onChange={(event) => setAssigneeSearch(event.target.value)} placeholder="Busca usuarios por nombre o correo..." /><div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5">{taskAssigneeCandidates.map((user) => { const selected = taskForm.assignedToUserIds.includes(user.id); const isCurrentUser = user.id === currentUserId; return <button key={user.id} type="button" onClick={() => { if (isCurrentUser && selected) return; setTaskForm((current) => ({ ...current, assignedToUserIds: selected ? current.assignedToUserIds.filter((item) => item !== user.id) : [...current.assignedToUserIds, user.id] })) }} className={selected ? 'flex w-full items-center justify-between rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left'}><span>{getUserLabel(user)}</span><span className="text-xs text-slate-500">{isCurrentUser ? 'Creador y responsable' : selected ? 'Asignado' : 'Asignar'}</span></button>})}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancelar</Button><Button onClick={() => void handleCreateTask()} disabled={savingTask || !canCreateTask}>{savingTask ? 'Guardando...' : 'Crear tarea'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}><DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto"><DialogHeader><DialogTitle>{detailForm.title || 'Detalle de tarea'}</DialogTitle><DialogDescription>Edita todos los campos operativos, adjunta evidencia, agrega campos personalizados y controla el color visual de la tarea desde este modal.</DialogDescription></DialogHeader><input ref={attachmentInputRef} type="file" accept={attachmentAccept()} className="hidden" onChange={(event) => void handleAttachmentFile(event.target.files?.[0] || null)} /><input ref={customFieldFileInputRef} type="file" accept={attachmentAccept()} className="hidden" onChange={(event) => void handleCustomFieldFile(event.target.files?.[0] || null)} /><div className="grid gap-4 py-2"><Card className="overflow-hidden border-0 shadow-none"><CardContent className="rounded-[28px] border p-5" style={{ background: `radial-gradient(circle at top right, ${normalizeHex(detailForm.colorHex)}33, transparent 30%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)`, borderColor: `${normalizeHex(detailForm.colorHex)}55` }}><div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]"><div className="space-y-4"><div className="grid gap-2"><Label>Título</Label><Input value={detailForm.title} onChange={(event) => setDetailForm((current) => ({ ...current, title: event.target.value }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Descripción</Label><Textarea value={detailForm.description} onChange={(event) => setDetailForm((current) => ({ ...current, description: event.target.value }))} rows={5} disabled={!canEditTasks} /></div></div><div className="space-y-4"><div className="grid gap-2"><Label>Estado</Label><Select value={detailForm.status} onValueChange={(value) => setDetailForm((current) => ({ ...current, status: value as TaskStatus }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">No iniciado</SelectItem><SelectItem value="IN_PROGRESS">En curso</SelectItem><SelectItem value="DONE">Finalizada</SelectItem><SelectItem value="CANCELED">Cancelada</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Prioridad</Label><Select value={detailForm.priority} onValueChange={(value) => setDetailForm((current) => ({ ...current, priority: value as TaskPriority }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Baja</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">Alta</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Entrega</Label><Input type="datetime-local" value={detailForm.dueAt} onChange={(event) => setDetailForm((current) => ({ ...current, dueAt: event.target.value }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Color de la tarea</Label><div className="flex flex-wrap items-center gap-2">{COLOR_PRESETS.map((color) => <button key={color} type="button" className={normalizeHex(detailForm.colorHex) === color ? 'h-9 w-9 rounded-full ring-4 ring-slate-300' : 'h-9 w-9 rounded-full ring-1 ring-slate-200'} style={{ backgroundColor: color }} onClick={() => setDetailForm((current) => ({ ...current, colorHex: color }))} disabled={!canEditTasks} />)}<Input type="color" value={normalizeHex(detailForm.colorHex)} onChange={(event) => setDetailForm((current) => ({ ...current, colorHex: event.target.value.toUpperCase() }))} className="h-10 w-14 rounded-xl p-1" disabled={!canEditTasks} /></div></div></div></div><div className="mt-4 flex flex-wrap gap-2"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_META[detailForm.status].badgeClass}`}>{STATUS_META[detailForm.status].label}</span><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${PRIORITY_META[detailForm.priority].badgeClass}`}>{PRIORITY_META[detailForm.priority].label}</span><span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">Creada: {formatDate(selectedTask?.createdAt, 'Sin fecha')}</span><span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">Actualizada: {formatDate(selectedTask?.updatedAt, 'Sin fecha')}</span></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Responsables</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-[220px_1fr]"><div className="grid gap-2"><Label>Asignar colaborador</Label><Input value={detailAssigneeSearch} onChange={(event) => setDetailAssigneeSearch(event.target.value)} placeholder="Correo o nombre" disabled={!canEditTasks} /></div><div className="grid gap-3"><div className="flex flex-wrap gap-2">{detailForm.assignedToUserIds.map((userId) => { const user = users.find((item) => item.id === userId); return <button key={userId} type="button" onClick={() => setDetailForm((current) => ({ ...current, assignedToUserIds: current.assignedToUserIds.filter((item) => item !== userId) }))} className="rounded-full bg-sky-100 px-3 py-1.5 text-sm text-sky-800" disabled={!canEditTasks}>{user?.name || user?.email || userId} ×</button> })}{!detailForm.assignedToUserIds.length ? <span className="text-sm text-slate-400">Sin colaboradores asignados</span> : null}</div><div className="max-h-36 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">{detailAssigneeCandidates.map((user) => { const selected = detailForm.assignedToUserIds.includes(user.id); return <button key={user.id} type="button" onClick={() => setDetailForm((current) => ({ ...current, assignedToUserIds: selected ? current.assignedToUserIds.filter((item) => item !== user.id) : [...current.assignedToUserIds, user.id] }))} className={selected ? 'flex w-full items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left'} disabled={!canEditTasks}><span>{getUserLabel(user)}</span><span className="text-xs text-slate-500">{selected ? 'Asignado' : 'Agregar'}</span></button> })}</div></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Adjuntos de la tarea</CardTitle><CardDescription>Sube imágenes, audios, videos o documentos que sirvan como evidencia o referencia directa de la tarea.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-center gap-3"><Button variant="outline" onClick={() => attachmentInputRef.current?.click()} disabled={!canEditTasks || uploadingAttachment}>{uploadingAttachment ? 'Subiendo...' : 'Agregar adjunto'}</Button><Button variant="outline" onClick={() => setLibraryPickerOpen(true)} disabled={!canEditTasks}>Elegir desde biblioteca</Button><Button variant="outline" onClick={() => setExternalAttachmentDialogOpen(true)} disabled={!canEditTasks || uploadingAttachment}>Vincular Drive/OneDrive</Button><span className="text-sm text-slate-500">{detailForm.attachmentsJson.length} archivo(s) vinculados</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{detailForm.attachmentsJson.map((attachment) => <div key={attachment.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium text-slate-950 line-clamp-1">{attachment.name}</p><p className="mt-1 text-xs text-slate-500">{attachment.type.toUpperCase()} · {formatAttachmentSize(attachment.sizeBytes)}</p></div>{canEditTasks ? <Button variant="outline" className="h-8 rounded-lg px-2" onClick={() => setDetailForm((current) => ({ ...current, attachmentsJson: current.attachmentsJson.filter((item) => item.id !== attachment.id) }))}>Quitar</Button> : null}</div><div className="mt-3 rounded-xl border border-slate-200 bg-white p-2">{attachment.type === 'image' ? <div className="relative h-40 w-full overflow-hidden rounded-lg"><Image src={attachment.url} alt={attachment.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" unoptimized /></div> : null}{attachment.type === 'audio' ? <audio src={attachment.url} controls className="w-full" /> : null}{attachment.type === 'video' ? <video src={attachment.url} controls className="h-40 w-full rounded-lg bg-black object-cover" /> : null}{attachment.type === 'document' ? <div className="flex h-40 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-600">Documento disponible</div> : null}</div><a href={attachment.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:text-sky-900">Abrir archivo</a></div>)}{!detailForm.attachmentsJson.length ? <p className="text-sm text-slate-400">No hay adjuntos todavía.</p> : null}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Campos personalizados</CardTitle><CardDescription>Agrega campos de texto o de archivo y luego edítalos o elimínalos individualmente.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 md:grid-cols-[1fr_160px_1fr_140px] md:items-end"><div className="grid gap-2"><Label>Etiqueta</Label><Input value={customFieldDraft.label} onChange={(event) => setCustomFieldDraft((current) => ({ ...current, label: event.target.value }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Tipo</Label><Select value={customFieldDraft.type} onValueChange={(value) => setCustomFieldDraft((current) => ({ ...current, type: value as TaskCustomFieldType, textValue: '', file: null }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TEXT">Texto</SelectItem><SelectItem value="FILE">Archivo</SelectItem></SelectContent></Select></div>{customFieldDraft.type === 'TEXT' ? <div className="grid gap-2"><Label>Valor</Label><Input value={customFieldDraft.textValue} onChange={(event) => setCustomFieldDraft((current) => ({ ...current, textValue: event.target.value }))} disabled={!canEditTasks} /></div> : <div className="grid gap-2"><Label>Archivo</Label><Button variant="outline" onClick={() => { setCustomFieldUploadTarget('new'); customFieldFileInputRef.current?.click() }} disabled={!canEditTasks || uploadingAttachment}>{customFieldDraft.file ? 'Reemplazar archivo' : uploadingAttachment ? 'Subiendo...' : 'Subir archivo'}</Button>{customFieldDraft.file ? <p className="text-xs text-slate-500">{customFieldDraft.file.name}</p> : null}</div>}<Button onClick={handleAddCustomField} disabled={!canEditTasks}>Agregar campo</Button></div><div className="space-y-3">{detailForm.customFieldsJson.map((field) => <div key={field.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="grid gap-3 lg:grid-cols-[1fr_160px_1fr_110px] lg:items-start"><div className="grid gap-2"><Label>Etiqueta</Label><Input value={field.label} onChange={(event) => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item) }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Tipo</Label><Select value={field.type} onValueChange={(value) => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, type: value as TaskCustomFieldType, textValue: value === 'TEXT' ? item.textValue || '' : null, file: value === 'FILE' ? item.file || null : null } : item) }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TEXT">Texto</SelectItem><SelectItem value="FILE">Archivo</SelectItem></SelectContent></Select></div>{field.type === 'TEXT' ? <div className="grid gap-2"><Label>Contenido</Label><Input value={field.textValue || ''} onChange={(event) => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, textValue: event.target.value } : item) }))} disabled={!canEditTasks} /></div> : <div className="grid gap-2"><Label>Archivo</Label><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => { setCustomFieldUploadTarget(field.id); customFieldFileInputRef.current?.click() }} disabled={!canEditTasks || uploadingAttachment}>{field.file ? 'Reemplazar' : 'Subir'}</Button>{field.file ? <Button variant="outline" onClick={() => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, file: null } : item) }))} disabled={!canEditTasks}>Quitar archivo</Button> : null}</div>{field.file ? <a href={field.file.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-700">{field.file.name}</a> : <span className="text-sm text-slate-400">Sin archivo</span>}</div>}<div className="pt-6 lg:pt-7"><Button variant="outline" onClick={() => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.filter((item) => item.id !== field.id) }))} disabled={!canEditTasks}>Quitar</Button></div></div></div>)}{!detailForm.customFieldsJson.length ? <p className="text-sm text-slate-400">No hay campos personalizados todavía.</p> : null}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Historial de cambios</CardTitle></CardHeader><CardContent className="space-y-3">{selectedTask?.history.length ? selectedTask.history.map((entry) => <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600"><div className="flex items-center justify-between gap-3"><p className="font-medium text-slate-900">{entry.message}</p><span className="text-xs text-slate-500">{formatDate(entry.createdAt, 'Sin fecha')}</span></div><p className="mt-1 text-xs text-slate-500">{entry.actorUser?.name || entry.actorUser?.email || 'Sistema'} · {entry.type}</p></div>) : <p className="text-sm text-muted-foreground">Sin historial todavía.</p>}</CardContent></Card><Card><CardContent className="grid gap-4 p-4 md:grid-cols-[160px_1fr_140px] md:items-start"><Label className="pt-2">Crear nota</Label><Textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Contenido de la nota" rows={3} disabled={!canEditTasks} /><Button onClick={() => void handleAddNote()} disabled={savingNote || !canEditTasks}>{savingNote ? 'Guardando...' : 'Crear nota'}</Button><div className="md:col-span-3 space-y-2">{noteEntries.length ? noteEntries.map((entry) => <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600"><p className="font-medium text-slate-900">{entry.message}</p><p className="mt-1 text-xs text-slate-500">{entry.actorUser?.name || entry.actorUser?.email || 'Sistema'} · {formatDate(entry.createdAt, 'Sin fecha')}</p></div>) : <p className="text-sm text-muted-foreground">No hay notas.</p>}</div></CardContent></Card><Card><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium text-slate-900">Archivo</p><p className="text-sm text-slate-500">Puedes archivar la tarea sin perder historial, adjuntos ni responsables.</p></div><Button variant="outline" onClick={() => setDetailForm((current) => ({ ...current, archived: !current.archived }))} disabled={!canEditTasks}>{detailForm.archived ? 'Quitar de archivo' : 'Archivar tarea'}</Button></CardContent></Card></div><DialogFooter><Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Cerrar</Button><Button onClick={() => void handleSaveDetail()} disabled={savingDetail || !canEditTasks}>{savingDetail ? 'Guardando...' : 'Guardar cambios'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={taskMoveDialogOpen} onOpenChange={setTaskMoveDialogOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Mover tarea</DialogTitle><DialogDescription>Relaciona la tarea con otro proyecto y, si hace falta, con una lista de destino.</DialogDescription></DialogHeader><div className="grid gap-3 py-2"><div className="grid gap-2"><Label>Proyecto de destino</Label><Select value={taskMoveForm.workspaceId || '__none__'} onValueChange={(value) => { const nextWorkspace = editableWorkspaces.find((workspace) => workspace.id === value) ?? null; setTaskMoveForm((current) => ({ ...current, workspaceId: value === '__none__' ? '' : value, projectId: nextWorkspace?.projects.some((project) => project.id === current.projectId) ? current.projectId : '' })) }}><SelectTrigger><SelectValue placeholder="Selecciona un proyecto" /></SelectTrigger><SelectContent>{editableWorkspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Lista de destino</Label><Select value={taskMoveForm.projectId || '__none__'} onValueChange={(value) => setTaskMoveForm((current) => ({ ...current, projectId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin lista</SelectItem>{selectedMoveWorkspace?.projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setTaskMoveDialogOpen(false)}>Cancelar</Button><Button onClick={() => void handleMoveTask()} disabled={movingTask}>{movingTask ? 'Moviendo...' : 'Mover tarea'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}><DialogContent className="max-w-[680px]"><DialogHeader><DialogTitle>{projectForm.projectId ? 'Editar lista' : 'Crear lista'}</DialogTitle><DialogDescription>Define el nombre, la descripción y, si hace falta, el proyecto de destino de la lista.</DialogDescription></DialogHeader><div className="grid gap-3 py-1.5"><div className="grid gap-1.5"><Label>Proyecto</Label><Select value={projectForm.workspaceId || '__none__'} onValueChange={(value) => setProjectForm((current) => ({ ...current, workspaceId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Selecciona un proyecto" /></SelectTrigger><SelectContent>{manageableWorkspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-1.5"><Label>Nombre de la lista</Label><Input value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} placeholder="Pendientes comerciales" /></div><div className="grid gap-1.5"><Label>Descripción</Label><Textarea value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Objetivo, entregables o contexto operativo de la lista" /></div></div><DialogFooter><Button variant="outline" onClick={() => setProjectDialogOpen(false)}>Cancelar</Button><Button onClick={() => void handleSaveProject()} disabled={savingProject}>{savingProject ? 'Guardando...' : projectForm.projectId ? 'Guardar cambios' : 'Crear lista'}</Button></DialogFooter></DialogContent></Dialog>
      <CrmFileLibraryPicker open={libraryPickerOpen} onOpenChange={setLibraryPickerOpen} onPick={handleLibraryAttachment} title="Seleccionar archivo del repositorio CRM" allowFolders={false} />
      <Dialog open={externalAttachmentDialogOpen} onOpenChange={setExternalAttachmentDialogOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Vincular desde Drive o OneDrive</DialogTitle><DialogDescription>Pega una URL compartida para registrarla como adjunto externo de esta tarea.</DialogDescription></DialogHeader><div className="grid gap-3 py-2"><div className="grid gap-2"><Label>Proveedor</Label><Select value={externalAttachmentForm.provider} onValueChange={(value) => setExternalAttachmentForm((current) => ({ ...current, provider: value as ExternalAttachmentProvider }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GOOGLE_DRIVE">Google Drive</SelectItem><SelectItem value="ONEDRIVE">OneDrive</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Nombre visible</Label><Input value={externalAttachmentForm.name} onChange={(event) => setExternalAttachmentForm((current) => ({ ...current, name: event.target.value }))} placeholder="Propuesta comercial Q2" /></div><div className="grid gap-2"><Label>URL compartida</Label><Input value={externalAttachmentForm.url} onChange={(event) => setExternalAttachmentForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://drive.google.com/... o https://onedrive.live.com/..." /></div></div><DialogFooter><Button variant="outline" onClick={() => { setExternalAttachmentDialogOpen(false); setExternalAttachmentForm(getInitialExternalAttachmentForm()) }}>Cancelar</Button><Button onClick={() => void handleExternalAttachmentLink()} disabled={uploadingAttachment}>{uploadingAttachment ? 'Vinculando...' : 'Vincular adjunto'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}



