"use client"

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, MoreVertical, Plus } from 'lucide-react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CrmFileLibraryPicker } from '@/components/crm/crm-file-library-picker'
import { useToast } from '@/hooks/use-toast'
import type { CrmFileItem } from '@/components/crm/crm-files-types'

type WorkspaceScope = 'SEDE' | 'USER'
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
  sede?: SedeOption | null
  ownerUser?: TeamUser | null
  members: WorkspaceMember[]
  projects: WorkspaceProject[]
  createdBy?: TeamUser | null
  _count?: { tasks: number; members: number }
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

function formatStatus(status: TaskStatus) {
  return STATUS_META[status]?.label || 'Sin estado'
}

function formatRole(role: WorkspaceRole | null | undefined) {
  if (role === 'MANAGER') return 'Manager'
  if (role === 'EDITOR') return 'Editor'
  if (role === 'VIEWER') return 'Viewer'
  return 'Sin rol'
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

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const response = await fetch(url, init)
  return (await response.json().catch(() => ({}))) as JsonResponse<T>
}

const WORKSPACE_PANEL_STORAGE_KEY = 'crm-task-workspaces:workspace-panel-collapsed'
const TASK_COLUMN_WIDTH_STORAGE_KEY = 'crm-task-workspaces:task-column-width'
const TASK_EXTRA_COLUMNS_STORAGE_KEY = 'crm-task-workspaces:task-extra-columns'
const TASK_PRIORITY_COLUMN_STORAGE_KEY = 'crm-task-workspaces:task-priority-column-visible'
const TASK_CREATED_AT_COLUMN_STORAGE_KEY = 'crm-task-workspaces:task-created-at-column-visible'

export function CrmTaskWorkspacesClient() {
  const searchParams = useSearchParams()
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const customFieldFileInputRef = useRef<HTMLInputElement | null>(null)
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [savingProject, setSavingProject] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [savingDetail, setSavingDetail] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false)
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
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
  const [taskColumnWidth, setTaskColumnWidth] = useState(160)
  const [showPriorityColumn, setShowPriorityColumn] = useState(true)
  const [showCreatedAtColumn, setShowCreatedAtColumn] = useState(false)
  const [visibleExtraTaskColumns, setVisibleExtraTaskColumns] = useState<ExtraTaskColumn[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [users, setUsers] = useState<TeamUser[]>([])
  const [sedes, setSedes] = useState<SedeOption[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null)
  const [customFieldUploadTarget, setCustomFieldUploadTarget] = useState<string | null>(null)
  const [workspaceForm, setWorkspaceForm] = useState({ name: '', description: '', scope: 'SEDE' as WorkspaceScope, sedeId: '', ownerUserId: '', memberUserIds: [] as string[] })
  const [projectForm, setProjectForm] = useState({ workspaceId: '', projectId: '', name: '', description: '' })
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueAt: '', priority: 'NORMAL' as TaskPriority, status: 'OPEN' as TaskStatus, colorHex: '#1D4ED8', assignedToUserIds: [] as string[], projectId: '' })
  const [detailForm, setDetailForm] = useState({ id: '', title: '', description: '', dueAt: '', priority: 'NORMAL' as TaskPriority, status: 'OPEN' as TaskStatus, colorHex: '#1D4ED8', attachmentsJson: [] as TaskAttachment[], customFieldsJson: [] as TaskCustomField[], assignedToUserIds: [] as string[], archived: false, projectId: '' })
  const [customFieldDraft, setCustomFieldDraft] = useState({ label: '', type: 'TEXT' as TaskCustomFieldType, textValue: '', file: null as TaskAttachment | null })
  const [workspaceSettingsForm, setWorkspaceSettingsForm] = useState({ id: '', name: '', description: '', ownerUserId: '', members: [] as Array<{ userId: string; role: WorkspaceRole }> })
  const [externalAttachmentForm, setExternalAttachmentForm] = useState(getInitialExternalAttachmentForm())
  const requestedTaskId = searchParams?.get('taskId') || ''
  const requestedWorkspaceId = searchParams?.get('workspaceId') || ''

  const selectedWorkspace = useMemo(() => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null, [selectedWorkspaceId, workspaces])
  const selectedProject = useMemo(() => selectedWorkspace?.projects.find((project) => project.id === selectedProjectId) ?? null, [selectedProjectId, selectedWorkspace])
  const canEditTasks = Boolean(selectedWorkspace?.permissions?.canEditTasks)
  const canManageWorkspace = Boolean(selectedWorkspace?.permissions?.canManage)
  const clampedTaskColumnWidth = useMemo(() => Math.min(240, Math.max(140, taskColumnWidth)), [taskColumnWidth])
  const totalTaskColumnCount = useMemo(() => 6 + visibleExtraTaskColumns.length + (showPriorityColumn ? 1 : 0) + (showCreatedAtColumn ? 1 : 0), [showCreatedAtColumn, showPriorityColumn, visibleExtraTaskColumns.length])
  const taskGridTemplate = useMemo(() => `repeat(${totalTaskColumnCount}, ${clampedTaskColumnWidth}px)`, [clampedTaskColumnWidth, totalTaskColumnCount])
  const taskTableMinWidth = useMemo(() => clampedTaskColumnWidth * totalTaskColumnCount + 80 + 48, [clampedTaskColumnWidth, totalTaskColumnCount])
  const quickTask = useMemo(() => quickTaskPanel ? tasks.find((task) => task.id === quickTaskPanel.taskId) ?? null : null, [quickTaskPanel, tasks])
  const quickTaskLatestHistory = useMemo(() => getLatestTaskHistoryEntry(quickTask), [quickTask])

  async function loadBase() {
    setLoading(true)
    try {
      const [workspaceRes, userRes, sedeRes] = await Promise.all([
        requestJson<Workspace[]>('/api/crm/task-workspaces'),
        requestJson<TeamUser[]>('/api/crm/assignees'),
        requestJson<SedeOption[]>('/api/crm/sedes'),
      ])
      const nextWorkspaces = Array.isArray(workspaceRes.data) ? workspaceRes.data : []
      setWorkspaces(nextWorkspaces)
      setUsers(Array.isArray(userRes.data) ? userRes.data : [])
      setSedes(Array.isArray(sedeRes.data) ? sedeRes.data : [])
      setSelectedWorkspaceId((current) => current && nextWorkspaces.some((workspace) => workspace.id === current) ? current : nextWorkspaces[0]?.id || '')
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = useCallback(async (workspaceId = selectedWorkspaceId) => {
    if (!workspaceId) {
      setTasks([])
      return
    }
    const query = new URLSearchParams({ workspaceId, includeArchived: String(showArchived) })
    const taskRes = await requestJson<TaskItem[]>(`/api/crm/tasks?${query.toString()}`)
    setTasks(Array.isArray(taskRes.data) ? taskRes.data.map((row) => normalizeTask(row)) : [])
  }, [selectedWorkspaceId, showArchived])

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
      setDetailDialogOpen(true)
    }
  }

  useEffect(() => { void loadBase() }, [])
  useEffect(() => { void loadTasks(selectedWorkspaceId) }, [loadTasks, selectedWorkspaceId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      setWorkspacePanelCollapsed(window.localStorage.getItem(WORKSPACE_PANEL_STORAGE_KEY) === 'true')
      const savedColumnWidth = Number(window.localStorage.getItem(TASK_COLUMN_WIDTH_STORAGE_KEY) || '')
      if (Number.isFinite(savedColumnWidth)) {
        setTaskColumnWidth(Math.min(240, Math.max(140, savedColumnWidth)))
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
    } catch {
      // ignore
    }
  }, [clampedTaskColumnWidth, showCreatedAtColumn, showPriorityColumn, visibleExtraTaskColumns, workspacePanelCollapsed])

  useEffect(() => {
    if (!requestedTaskId) return
    if (requestedWorkspaceId && requestedWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(requestedWorkspaceId)
    }
    void loadTaskDetail(requestedTaskId)
  }, [requestedTaskId, requestedWorkspaceId, selectedWorkspaceId])

  useEffect(() => {
    if (!selectedWorkspace) return
    setWorkspaceSettingsForm({ id: selectedWorkspace.id, name: selectedWorkspace.name, description: selectedWorkspace.description || '', ownerUserId: selectedWorkspace.ownerUser?.id || '', members: selectedWorkspace.members.map((member) => ({ userId: member.userId, role: member.role })) })
  }, [selectedWorkspace])

  useEffect(() => {
    if (!selectedWorkspace) {
      setSelectedProjectId('')
      return
    }
    setSelectedProjectId((current) => current && selectedWorkspace.projects.some((project) => project.id === current) ? current : selectedWorkspace.projects[0]?.id || '')
  }, [selectedWorkspace])

  useEffect(() => {
    setTaskForm((current) => current.projectId === selectedProjectId ? current : { ...current, projectId: selectedProjectId })
  }, [selectedProjectId])

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase()
    const projectScopedTasks = selectedProjectId ? tasks.filter((task) => task.project?.id === selectedProjectId) : tasks
    if (!term) return projectScopedTasks
    return projectScopedTasks.filter((task) => {
      const haystack = [task.title, task.description, task.createdBy?.name, task.workspace?.name, task.lead?.nombre, task.opportunity?.title, task.cliente?.nombre, ...task.assignments.map((assignment) => assignment.user.name || assignment.user.email || ''), ...(task.customFieldsJson || []).map((field) => `${field.label} ${field.textValue || field.file?.name || ''}`)].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [search, selectedProjectId, tasks])

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
    setWorkspaceSettingsForm({ id: workspace.id, name: workspace.name, description: workspace.description || '', ownerUserId: workspace.ownerUser?.id || '', members: workspace.members.map((member) => ({ userId: member.userId, role: member.role })) })
    setWorkspaceSettingsOpen(true)
  }

  function openProjectDialog(workspaceId = selectedWorkspaceId, project?: WorkspaceProject | null) {
    if (!workspaceId) return alert('Selecciona primero un espacio de trabajo.')
    const workspace = workspaces.find((item) => item.id === workspaceId) ?? null
    setProjectForm({
      workspaceId,
      projectId: project?.id || '',
      name: project?.name || '',
      description: project?.description || workspace?.description || '',
    })
    setProjectDialogOpen(true)
  }

  function openTaskCreationDialog(projectId = selectedProjectId) {
    if (!selectedWorkspaceId) return alert('Selecciona primero un espacio de trabajo.')
    if (!canEditTasks) return alert('Tu rol actual en este espacio es solo de lectura.')
    if (!projectId) return alert('Crea o selecciona primero un proyecto dentro del espacio.')
    setTaskForm((current) => ({ ...current, projectId }))
    setTaskDialogOpen(true)
  }

  function moveDetailTaskToSelectedProject() {
    if (!selectedProjectId) return alert('Selecciona un proyecto de destino en el panel del espacio.')
    setDetailForm((current) => ({ ...current, projectId: selectedProjectId }))
  }

  async function handleCreateWorkspace() {
    if (!workspaceForm.name.trim()) return alert('El nombre del espacio es requerido.')
    if (workspaceForm.scope === 'SEDE' && !workspaceForm.sedeId) return alert('Selecciona una sede para el espacio de trabajo.')
    if (workspaceForm.scope === 'USER' && !workspaceForm.ownerUserId) return alert('Selecciona un usuario responsable del espacio.')
    setSavingWorkspace(true)
    try {
      const json = await requestJson<Workspace>('/api/crm/task-workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(workspaceForm) })
      if (!json.success || !json.data) return alert(json.error || 'No se pudo crear el espacio de trabajo.')
      setWorkspaceDialogOpen(false)
      setWorkspaceForm({ name: '', description: '', scope: 'SEDE', sedeId: '', ownerUserId: '', memberUserIds: [] })
      await loadBase()
      setSelectedWorkspaceId(json.data.id)
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function handleSaveWorkspaceSettings() {
    if (!workspaceSettingsForm.id) return
    if (!canManageWorkspace) return alert('Solo un manager puede administrar miembros y roles.')
    if (!workspaceSettingsForm.name.trim()) return alert('El nombre del espacio es requerido.')
    setSavingWorkspace(true)
    try {
      const json = await requestJson<Workspace>(`/api/crm/task-workspaces/${workspaceSettingsForm.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: workspaceSettingsForm.name, description: workspaceSettingsForm.description, ownerUserId: workspaceSettingsForm.ownerUserId || null, members: workspaceSettingsForm.members }) })
      if (!json.success || !json.data) return alert(json.error || 'No se pudo actualizar el espacio.')
      setWorkspaceSettingsOpen(false)
      await loadBase()
      setSelectedWorkspaceId(json.data.id)
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function handleDeleteWorkspace(workspace: Workspace) {
    if (!workspace.permissions?.canManage) return alert('Solo un manager puede eliminar este espacio.')
    if (!window.confirm(`Se eliminará el espacio "${workspace.name}" si está vacío. ¿Deseas continuar?`)) return
    const json = await requestJson<null>(`/api/crm/task-workspaces/${workspace.id}`, { method: 'DELETE' })
    if (!json.success) return alert(json.error || 'No se pudo eliminar el espacio.')
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

  async function handleSaveProject() {
    if (!projectForm.workspaceId) return alert('Selecciona primero un espacio de trabajo.')
    if (!projectForm.name.trim()) return alert('El nombre del proyecto es requerido.')
    setSavingProject(true)
    try {
      const isEditing = Boolean(projectForm.projectId)
      const url = isEditing
        ? `/api/crm/task-workspaces/${projectForm.workspaceId}/projects/${projectForm.projectId}`
        : `/api/crm/task-workspaces/${projectForm.workspaceId}/projects`
      const method = isEditing ? 'PATCH' : 'POST'
      const json = await requestJson<WorkspaceProject>(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: projectForm.name, description: projectForm.description }) })
      if (!json.success || !json.data) return alert(json.error || `No se pudo ${isEditing ? 'actualizar' : 'crear'} el proyecto.`)
      setProjectDialogOpen(false)
      setProjectForm({ workspaceId: '', projectId: '', name: '', description: '' })
      await loadBase()
      setSelectedWorkspaceId(projectForm.workspaceId)
      setSelectedProjectId(json.data.id)
    } finally {
      setSavingProject(false)
    }
  }

  async function handleCreateTask() {
    if (!selectedWorkspaceId) return alert('Selecciona primero un espacio de trabajo.')
    if (!canEditTasks) return alert('Tu rol actual en este espacio es solo de lectura.')
    if (!taskForm.projectId) return alert('Selecciona un proyecto para la tarea.')
    if (!taskForm.title.trim()) return alert('El título de la tarea es requerido.')
    setSavingTask(true)
    try {
      const json = await requestJson<TaskItem>('/api/crm/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: selectedWorkspaceId, projectId: taskForm.projectId, title: taskForm.title, description: taskForm.description, dueAt: taskForm.dueAt || null, priority: taskForm.priority, status: taskForm.status, colorHex: normalizeHex(taskForm.colorHex), assignedToUserIds: taskForm.assignedToUserIds }) })
      if (!json.success) return alert(json.error || 'No se pudo crear la tarea.')
      setTaskDialogOpen(false)
      setTaskForm({ title: '', description: '', dueAt: '', priority: 'NORMAL', status: 'OPEN', colorHex: '#1D4ED8', assignedToUserIds: [], projectId: selectedProjectId || '' })
      await loadTasks(selectedWorkspaceId)
      toast({
        title: 'Tarea creada',
        description: taskForm.assignedToUserIds.length
          ? 'La tarea se creó y se notificó a los responsables asignados.'
          : 'La tarea se creó correctamente en el espacio de trabajo.',
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

  async function handleSaveDetail() {
    if (!detailForm.id) return
    if (!canEditTasks) return alert('Tu rol actual en este espacio es solo de lectura.')
    if (selectedWorkspace?.projects.length && !detailForm.projectId) return alert('Selecciona un proyecto antes de guardar la tarea.')
    setSavingDetail(true)
    try {
      const patch: Record<string, unknown> = { title: detailForm.title, description: detailForm.description, dueAt: detailForm.dueAt || null, priority: detailForm.priority, status: detailForm.status, colorHex: normalizeHex(detailForm.colorHex), attachmentsJson: detailForm.attachmentsJson, customFieldsJson: detailForm.customFieldsJson, assignedToUserIds: detailForm.assignedToUserIds, archived: detailForm.archived }
      if (selectedWorkspace?.projects.length || detailForm.projectId) patch.projectId = detailForm.projectId
      await handleUpdateTask(detailForm.id, patch, {
        title: 'Tarea actualizada',
        description: detailForm.assignedToUserIds.length
          ? 'Se guardaron los cambios y se mantuvo la asignación de responsables.'
          : 'Los cambios de la tarea se guardaron correctamente.',
      })
    } finally {
      setSavingDetail(false)
    }
  }

  async function handleAddNote() {
    if (!selectedTask || !noteDraft.trim()) return alert('Escribe una nota para registrar en el historial.')
    if (!canEditTasks) return alert('Tu rol actual en este espacio es solo de lectura.')
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
    if (!canEditTasks) return alert('Tu rol actual en este espacio es solo de lectura.')
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

      setDetailForm((current) => current.attachmentsJson.some((attachment) => attachment.url === json.data?.url)
        ? current
        : { ...current, attachmentsJson: [...current.attachmentsJson, json.data as TaskAttachment] })
      setExternalAttachmentForm(getInitialExternalAttachmentForm())
      setExternalAttachmentDialogOpen(false)
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
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800"
        title={assignment.user.name || assignment.user.email || assignment.user.id}
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
            className={`inline-flex items-center justify-between gap-2 rounded-full border px-3 py-2 text-sm font-semibold shadow-sm transition-colors ${statusMeta.badgeClass}`}
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
              onSelect={() => void handleUpdateTask(task.id, { status: option.value }, { title: 'Estado actualizado', description: `La tarea quedó en estado ${option.label.toLowerCase()}.` })}
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
            className={`inline-flex items-center justify-between gap-2 rounded-full border px-3 py-2 text-sm font-semibold shadow-sm transition-colors ${priorityMeta.badgeClass}`}
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
          <p className="truncate text-sm font-medium text-slate-700">{attachments[0]?.name || 'Adjunto'}</p>
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
        <p className="truncate text-sm font-medium text-slate-700">{firstField.label}</p>
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
        <p className="truncate text-sm font-medium text-slate-700">{latestHistory.message}</p>
        <p className="truncate text-xs text-slate-500">{formatDate(latestHistory.createdAt, 'Sin fecha')}</p>
      </div>
    )
  }

  function renderTaskCreatedAtColumn(task: TaskItem) {
    return (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-700">{formatDate(task.createdAt, 'Sin fecha')}</p>
        <p className="truncate text-xs text-slate-500">Creación de la tarea</p>
      </div>
    )
  }

  function renderTaskNoteColumn(task: TaskItem) {
    const notesCount = task.history.filter((entry) => entry.type === 'NOTE_ADDED').length

    return (
      <div className="flex items-center justify-between gap-2 overflow-hidden">
        <span className="truncate text-xs text-slate-500">{notesCount ? `${notesCount} nota(s)` : 'Sin notas'}</span>
        <Button variant="outline" size="sm" className="h-8 rounded-xl px-2.5" onClick={() => openQuickTaskPanel(task.id, 'note')} disabled={!canEditTasks}>
          Nota
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
    <div className="space-y-4.5 pb-4">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Espacios de trabajo' }]}
        eyebrow="Operación colaborativa"
        title="Espacios de trabajo y seguimiento interno"
        description="Administra espacios transversales del ERP, organiza tareas colaborativas, adjunta evidencia y centraliza seguimiento con estados más claros y visuales más fuertes."
        actions={<Button variant="outline" className="rounded-2xl border-slate-200 bg-white/85" onClick={() => setWorkspaceDialogOpen(true)}>Nuevo espacio</Button>}
        stats={[
          { label: 'Espacios', value: workspaces.length, hint: 'Contextos colaborativos visibles', tone: 'sky' },
          { label: 'No iniciadas', value: filteredTasks.filter((task) => task.status === 'OPEN' && !task.archivedAt).length, hint: 'Pendiente de arrancar', tone: 'amber' },
          { label: 'En curso', value: filteredTasks.filter((task) => task.status === 'IN_PROGRESS' && !task.archivedAt).length, hint: 'Ejecución activa', tone: 'teal' },
          { label: 'Finalizadas', value: filteredTasks.filter((task) => task.status === 'DONE').length, hint: 'Cerradas', tone: 'teal' },
        ]}
      />

      <div className={`grid gap-4 ${workspacePanelCollapsed ? 'xl:grid-cols-[minmax(0,1fr)]' : 'xl:grid-cols-[320px_minmax(0,1fr)]'}`}>
        {!workspacePanelCollapsed ? (
          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="text-xl">Espacios de trabajo</CardTitle>
              <CardDescription>Selecciona un espacio, ajusta sus opciones desde el menú y crea tareas solo dentro de un proyecto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 md:p-5">
              {loading ? <p className="text-sm text-muted-foreground">Cargando espacios...</p> : null}
              {!loading && workspaces.length === 0 ? <p className="text-sm text-muted-foreground">No tienes espacios de trabajo todavía.</p> : null}
              {workspaces.map((workspace) => {
                const isSelected = selectedWorkspaceId === workspace.id
                const canManageCurrentWorkspace = Boolean(workspace.permissions?.canManage)

                return (
                  <div key={workspace.id} className={isSelected ? 'w-full rounded-3xl border border-sky-300 bg-sky-50/80 p-4 text-left shadow-sm' : 'w-full rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-4 text-left shadow-sm transition-shadow hover:shadow-md'}>
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => setSelectedWorkspaceId(workspace.id)} className="min-w-0 flex-1 text-left">
                        <p className="font-semibold text-slate-950">{workspace.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{workspace.description || (workspace.scope === 'SEDE' ? workspace.sede?.nombre || 'Espacio por sede' : workspace.ownerUser?.name || workspace.ownerUser?.email || 'Espacio por usuario')}</p>
                      </button>
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col items-end gap-1">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{workspace.scope}</span>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">{formatRole(workspace.currentUserRole)}</span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={`Opciones de ${workspace.name}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
                            <DropdownMenuItem onSelect={() => setSelectedWorkspaceId(workspace.id)}>
                              Ver proyectos
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setSelectedWorkspaceId(workspace.id); openWorkspaceSettings(workspace) }}>
                              Asignar espacio
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setSelectedWorkspaceId(workspace.id); void openProjectDialog(workspace.id) }} disabled={!canManageCurrentWorkspace}>
                              Crear proyecto
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => { setSelectedWorkspaceId(workspace.id); openWorkspaceSettings(workspace) }} disabled={!canManageCurrentWorkspace}>
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
                            <p className="text-sm font-semibold text-slate-900">Proyectos</p>
                            <p className="text-xs text-slate-500">Selecciona un proyecto para habilitar el botón de crear tarea.</p>
                          </div>
                          <Button type="button" size="icon" className="h-10 w-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void openProjectDialog(workspace.id)} disabled={!canManageCurrentWorkspace}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant={!selectedProjectId ? 'default' : 'outline'} className={!selectedProjectId ? 'rounded-2xl bg-slate-950 text-white hover:bg-slate-800' : 'rounded-2xl'} onClick={() => setSelectedProjectId('')}>
                            Todos
                          </Button>
                          {workspace.projects.map((project) => (
                            <div key={project.id} className={selectedProjectId === project.id ? 'flex items-center gap-2 rounded-2xl border border-sky-300 bg-sky-700 px-3 py-2 text-white' : 'flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-700'}>
                              <button type="button" className="text-left" onClick={() => setSelectedProjectId(project.id)}>
                                <span className="block text-sm font-semibold">{project.name}</span>
                                <span className={selectedProjectId === project.id ? 'block text-[11px] text-sky-100' : 'block text-[11px] text-slate-500'}>{project._count?.tasks ?? 0} tarea(s)</span>
                              </button>
                              {canManageCurrentWorkspace ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className={selectedProjectId === project.id ? 'h-7 w-7 rounded-full text-white hover:bg-white/15 hover:text-white' : 'h-7 w-7 rounded-full text-slate-500 hover:text-slate-700'}>
                                      <MoreVertical className="h-3.5 w-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44 rounded-2xl p-1.5">
                                    <DropdownMenuItem onSelect={() => openProjectDialog(workspace.id, project)}>
                                      Renombrar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => void handleDeleteProject(project)} className="text-rose-600 focus:text-rose-700">
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        {!workspace.projects.length ? <p className="text-xs text-slate-500">Este espacio aún no tiene proyectos. Crea uno para empezar a registrar tareas.</p> : null}
                        <div className="flex items-center justify-between rounded-2xl border border-dashed border-slate-300 bg-white/70 px-3 py-2.5">
                          <div>
                            <p className="text-sm font-medium text-slate-900">Crear tarea</p>
                            <p className="text-xs text-slate-500">Disponible solo cuando elijas un proyecto del espacio.</p>
                          </div>
                          <Button type="button" size="icon" className="h-10 w-10 rounded-xl bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-300" onClick={() => openTaskCreationDialog()} disabled={!selectedProjectId || !workspace.permissions?.canEditTasks}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ) : null}

        <Card className="min-w-0 rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-xl">Tareas del espacio</CardTitle>
                <CardDescription>
                  {selectedWorkspace
                    ? `${selectedWorkspace.name}${selectedProject ? ` · Proyecto ${selectedProject.name}` : ' · Todos los proyectos'} · ${formatRole(selectedWorkspace.currentUserRole)}${selectedWorkspace.permissions?.canEditTasks ? ' con edición de tareas' : ' solo lectura'}`
                    : 'Tabla operativa con responsables, estado, color, evidencia y acceso a detalle completo.'}
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Button variant="outline" className="rounded-xl" onClick={() => setWorkspacePanelCollapsed((current) => !current)}>
                  {workspacePanelCollapsed ? 'Mostrar espacios' : 'Ocultar espacios'}
                </Button>
                {canManageWorkspace ? <Button variant="outline" className="rounded-xl" onClick={() => openWorkspaceSettings()}>Miembros y roles</Button> : null}
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por tarea, responsable, campo o descripción..." className="w-full rounded-xl sm:w-[320px]" />
                <Button variant="outline" className="rounded-xl" onClick={() => setShowArchived((current) => !current)}>{showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="rounded-xl">Columnas visibles</Button>
                  </DropdownMenuTrigger>
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
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
                  <Label htmlFor="task-column-width" className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ancho columnas</Label>
                  <input
                    id="task-column-width"
                    type="range"
                    min="140"
                    max="240"
                    step="10"
                    value={clampedTaskColumnWidth}
                    onChange={(event) => setTaskColumnWidth(Number(event.target.value))}
                    className="w-28 accent-slate-900"
                  />
                  <span className="min-w-[52px] text-xs font-semibold text-slate-600">{clampedTaskColumnWidth}px</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="min-w-0 p-0">
            <div className="w-full overflow-x-auto overscroll-x-contain pb-2">
              <div className="w-max" style={{ minWidth: `${taskTableMinWidth}px` }}>
                <div className="grid gap-4 border-b border-slate-100 px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500" style={{ gridTemplateColumns: taskGridTemplate }}>
                  <span>Tarea</span>
                  {showPriorityColumn ? <span>Prioridad</span> : null}
                  <span>Descripción</span>
                  <span>Responsables</span>
                  <span>Estado</span>
                  <span>Entrega</span>
                  {showCreatedAtColumn ? <span>Creada</span> : null}
                  {visibleExtraTaskColumns.includes('attachments') ? <span>Adjuntos</span> : null}
                  {visibleExtraTaskColumns.includes('custom-fields') ? <span>Campos</span> : null}
                  {visibleExtraTaskColumns.includes('history') ? <span>Último cambio</span> : null}
                  {visibleExtraTaskColumns.includes('note') ? <span>Nota rápida</span> : null}
                  <span>Acciones</span>
                </div>
                {filteredTasks.map((task) => {
                  const statusMeta = STATUS_META[task.status]
                  return (
                    <div
                      key={task.id}
                      className={`grid items-center gap-4 border-b px-6 py-2.5 text-sm text-slate-700 bg-gradient-to-r ${statusMeta.softClass}`}
                      style={{ gridTemplateColumns: taskGridTemplate, borderLeft: `5px solid ${normalizeHex(task.colorHex)}`, borderBottomColor: 'rgba(226,232,240,0.9)' }}
                    >
                      <p className="truncate font-semibold text-slate-950">{task.title}</p>
                      {showPriorityColumn ? <div className="overflow-hidden">{renderTaskPriorityControl(task)}</div> : null}
                      <p className="truncate text-slate-600">{task.description || 'Sin descripción'}</p>
                      <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden">{renderTaskAssignments(task)}</div>
                      <div className="overflow-hidden">{renderTaskStatusControl(task)}</div>
                      <div className="truncate text-slate-600">{task.completedAt ? `Completada: ${formatDate(task.completedAt, 'Sin fecha')}` : formatDate(task.dueAt, 'Sin fecha')}</div>
                      {showCreatedAtColumn ? <div className="overflow-hidden">{renderTaskCreatedAtColumn(task)}</div> : null}
                      {visibleExtraTaskColumns.includes('attachments') ? <div className="overflow-hidden">{renderTaskAttachmentsColumn(task)}</div> : null}
                      {visibleExtraTaskColumns.includes('custom-fields') ? <div className="overflow-hidden">{renderTaskCustomFieldsColumn(task)}</div> : null}
                      {visibleExtraTaskColumns.includes('history') ? <div className="overflow-hidden">{renderTaskHistoryColumn(task)}</div> : null}
                      {visibleExtraTaskColumns.includes('note') ? <div className="overflow-hidden">{renderTaskNoteColumn(task)}</div> : null}
                      <div className="flex items-center overflow-hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" aria-label={`Acciones para ${task.title}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-2xl p-1.5">
                            <DropdownMenuItem onSelect={() => void loadTaskDetail(task.id)}>
                              Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => void handleUpdateTask(task.id, { archived: !task.archivedAt }, { title: task.archivedAt ? 'Tarea restaurada' : 'Tarea archivada', description: task.archivedAt ? 'La tarea volvió a estar activa.' : 'La tarea se movió a archivadas.' })} disabled={!canEditTasks}>
                              {task.archivedAt ? 'Restaurar' : 'Archivar'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
                {!filteredTasks.length ? <div className="px-6 py-8 text-sm text-slate-500">{selectedWorkspace ? (selectedProject ? 'No hay tareas para mostrar en este proyecto.' : selectedWorkspace.projects.length ? 'Selecciona un proyecto o crea una tarea desde el botón +.' : 'Crea primero un proyecto dentro del espacio para empezar a registrar tareas.') : 'Selecciona un espacio de trabajo para ver tareas.'}</div> : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <p className="font-medium text-slate-900">{quickTaskLatestHistory.message}</p>
                  <span className="text-xs text-slate-500">{formatDate(quickTaskLatestHistory.createdAt, 'Sin fecha')}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{quickTaskLatestHistory.actorUser?.name || quickTaskLatestHistory.actorUser?.email || 'Sistema'} · {quickTaskLatestHistory.type}</p>
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

      <Dialog open={workspaceSettingsOpen} onOpenChange={setWorkspaceSettingsOpen}><DialogContent className="max-h-[90vh] max-w-[880px] overflow-y-auto"><DialogHeader><DialogTitle>Administrar espacio de trabajo</DialogTitle><DialogDescription>Edita miembros después de creado y aplica roles reales con restricciones operativas.</DialogDescription></DialogHeader><div className="grid gap-3 py-1.5"><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Nombre</Label><Input value={workspaceSettingsForm.name} onChange={(event) => setWorkspaceSettingsForm((current) => ({ ...current, name: event.target.value }))} disabled={!canManageWorkspace} /></div><div className="grid gap-1.5"><Label>Responsable</Label><Select value={workspaceSettingsForm.ownerUserId || '__none__'} onValueChange={(value) => setWorkspaceSettingsForm((current) => ({ ...current, ownerUserId: value === '__none__' ? '' : value, members: value !== '__none__' && !current.members.some((item) => item.userId === value) ? [...current.members, { userId: value, role: 'MANAGER' }] : current.members }))} disabled={!canManageWorkspace}><SelectTrigger><SelectValue placeholder="Selecciona un responsable" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin responsable</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name || user.email || user.id}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-1.5"><Label>Descripción</Label><Textarea value={workspaceSettingsForm.description} onChange={(event) => setWorkspaceSettingsForm((current) => ({ ...current, description: event.target.value }))} rows={3} disabled={!canManageWorkspace} /></div><div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]"><div className="grid gap-1.5"><Label>Agregar miembro</Label><Input value={workspaceMemberSearch} onChange={(event) => setWorkspaceMemberSearch(event.target.value)} placeholder="Busca usuarios para invitarlos al espacio..." disabled={!canManageWorkspace} /><div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5">{workspaceMemberCandidates.map((user) => <button key={user.id} type="button" onClick={() => setWorkspaceSettingsForm((current) => ({ ...current, members: [...current.members, { userId: user.id, role: 'VIEWER' }] }))} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left" disabled={!canManageWorkspace}><span>{user.name || user.email || user.id}</span><span className="text-xs text-slate-500">Agregar</span></button>)}{!workspaceMemberCandidates.length ? <p className="text-sm text-slate-400">No hay usuarios adicionales con ese filtro.</p> : null}</div></div><div className="grid gap-1.5"><Label>Miembros y roles</Label><div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5">{workspaceSettingsForm.members.map((member) => { const user = users.find((item) => item.id === member.userId); const locked = member.userId === selectedWorkspace?.createdBy?.id || member.userId === workspaceSettingsForm.ownerUserId; return <div key={member.userId} className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 md:grid-cols-[1fr_160px_96px] md:items-center"><div><p className="font-medium text-slate-950">{user?.name || user?.email || member.userId}</p><p className="text-xs text-slate-500">{locked ? 'Rol protegido por propiedad del espacio' : 'Puedes cambiar el rol o quitar el acceso'}</p></div><Select value={member.role} onValueChange={(value) => setWorkspaceSettingsForm((current) => ({ ...current, members: current.members.map((item) => item.userId === member.userId ? { ...item, role: value as WorkspaceRole } : item) }))} disabled={!canManageWorkspace || locked}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="VIEWER">Viewer</SelectItem><SelectItem value="EDITOR">Editor</SelectItem><SelectItem value="MANAGER">Manager</SelectItem></SelectContent></Select><Button variant="outline" onClick={() => setWorkspaceSettingsForm((current) => ({ ...current, members: current.members.filter((item) => item.userId !== member.userId) }))} disabled={!canManageWorkspace || locked}>Quitar</Button></div>})}</div></div></div></div><DialogFooter><Button variant="outline" onClick={() => setWorkspaceSettingsOpen(false)}>Cancelar</Button><Button onClick={() => void handleSaveWorkspaceSettings()} disabled={savingWorkspace || !canManageWorkspace}>{savingWorkspace ? 'Guardando...' : 'Guardar cambios'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={workspaceDialogOpen} onOpenChange={setWorkspaceDialogOpen}><DialogContent className="max-w-[760px]"><DialogHeader><DialogTitle>Nuevo espacio de trabajo</DialogTitle><DialogDescription>Define si el espacio pertenece a una sede o a un usuario, y luego invita quién puede verlo.</DialogDescription></DialogHeader><div className="grid gap-3 py-1.5"><div className="grid gap-1.5"><Label>Nombre</Label><Input value={workspaceForm.name} onChange={(event) => setWorkspaceForm((current) => ({ ...current, name: event.target.value }))} /></div><div className="grid gap-1.5"><Label>Descripción</Label><Textarea value={workspaceForm.description} onChange={(event) => setWorkspaceForm((current) => ({ ...current, description: event.target.value }))} rows={3} /></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Tipo de espacio</Label><Select value={workspaceForm.scope} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, scope: value as WorkspaceScope, sedeId: '', ownerUserId: '' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SEDE">Por sede</SelectItem><SelectItem value="USER">Por usuario</SelectItem></SelectContent></Select></div>{workspaceForm.scope === 'SEDE' ? <div className="grid gap-1.5"><Label>Sede</Label><Select value={workspaceForm.sedeId || '__none__'} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, sedeId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Selecciona una sede" /></SelectTrigger><SelectContent><SelectItem value="__none__">Selecciona</SelectItem>{sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}</SelectContent></Select></div> : <div className="grid gap-1.5"><Label>Usuario responsable</Label><Select value={workspaceForm.ownerUserId || '__none__'} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, ownerUserId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger><SelectContent><SelectItem value="__none__">Selecciona</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name || user.email || user.id}</SelectItem>)}</SelectContent></Select></div>}</div><div className="grid gap-1.5"><Label>Invitar usuarios con acceso</Label><Input value={workspaceSearch} onChange={(event) => setWorkspaceSearch(event.target.value)} placeholder="Busca usuarios por nombre o correo..." /><div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5">{workspaceCandidates.map((user) => { const selected = workspaceForm.memberUserIds.includes(user.id); return <button key={user.id} type="button" onClick={() => setWorkspaceForm((current) => ({ ...current, memberUserIds: selected ? current.memberUserIds.filter((item) => item !== user.id) : [...current.memberUserIds, user.id] }))} className={selected ? 'flex w-full items-center justify-between rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left'}><span>{user.name || user.email || user.id}</span><span className="text-xs text-slate-500">{selected ? 'Invitado' : 'Agregar'}</span></button>})}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setWorkspaceDialogOpen(false)}>Cancelar</Button><Button onClick={() => void handleCreateWorkspace()} disabled={savingWorkspace}>{savingWorkspace ? 'Guardando...' : 'Crear espacio'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}><DialogContent className="max-h-[90vh] max-w-[760px] overflow-y-auto"><DialogHeader><DialogTitle>Nueva tarea</DialogTitle><DialogDescription>Crea una tarea con estado inicial, color visual fuerte y responsables dentro del espacio seleccionado.</DialogDescription></DialogHeader><div className="grid gap-3 py-1.5"><div className="grid gap-1.5"><Label>Título</Label><Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} /></div><div className="grid gap-1.5"><Label>Descripción</Label><Textarea value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} rows={4} /></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Estado inicial</Label><Select value={taskForm.status} onValueChange={(value) => setTaskForm((current) => ({ ...current, status: value as TaskStatus }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">No iniciado</SelectItem><SelectItem value="IN_PROGRESS">En curso</SelectItem><SelectItem value="DONE">Finalizada</SelectItem><SelectItem value="CANCELED">Cancelada</SelectItem></SelectContent></Select></div><div className="grid gap-1.5"><Label>Prioridad</Label><Select value={taskForm.priority} onValueChange={(value) => setTaskForm((current) => ({ ...current, priority: value as TaskPriority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Baja</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">Alta</SelectItem></SelectContent></Select></div></div><div className="grid gap-1.5"><Label>Color de la tarea</Label><div className="flex flex-wrap items-center gap-2.5">{COLOR_PRESETS.map((color) => <button key={color} type="button" className={normalizeHex(taskForm.colorHex) === color ? 'h-9 w-9 rounded-full ring-4 ring-slate-300' : 'h-9 w-9 rounded-full ring-1 ring-slate-200'} style={{ backgroundColor: color }} onClick={() => setTaskForm((current) => ({ ...current, colorHex: color }))} />)}<Input type="color" value={normalizeHex(taskForm.colorHex)} onChange={(event) => setTaskForm((current) => ({ ...current, colorHex: event.target.value.toUpperCase() }))} className="h-9 w-12 rounded-lg p-1" /></div></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1.5"><Label>Fecha y hora de entrega</Label><Input type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))} /></div><div className="rounded-xl border border-slate-200 p-3" style={{ background: `linear-gradient(135deg, ${normalizeHex(taskForm.colorHex)} 0%, #ffffff 120%)` }}><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">Vista rápida</p><p className="mt-1.5 font-semibold text-white">{taskForm.title || 'Nueva tarea'}</p><p className="mt-1 text-sm text-white/85">{formatStatus(taskForm.status)} · {PRIORITY_META[taskForm.priority].label}</p></div></div><div className="grid gap-1.5"><Label>Asignar usuarios</Label><Input value={assigneeSearch} onChange={(event) => setAssigneeSearch(event.target.value)} placeholder="Busca usuarios por nombre o correo..." /><div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2.5">{taskAssigneeCandidates.map((user) => { const selected = taskForm.assignedToUserIds.includes(user.id); return <button key={user.id} type="button" onClick={() => setTaskForm((current) => ({ ...current, assignedToUserIds: selected ? current.assignedToUserIds.filter((item) => item !== user.id) : [...current.assignedToUserIds, user.id] }))} className={selected ? 'flex w-full items-center justify-between rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left'}><span>{user.name || user.email || user.id}</span><span className="text-xs text-slate-500">{selected ? 'Asignado' : 'Asignar'}</span></button>})}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancelar</Button><Button onClick={() => void handleCreateTask()} disabled={savingTask || !canEditTasks}>{savingTask ? 'Guardando...' : 'Crear tarea'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}><DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto"><DialogHeader><DialogTitle>{detailForm.title || 'Detalle de tarea'}</DialogTitle><DialogDescription>Edita todos los campos operativos, adjunta evidencia, agrega campos personalizados y controla el color visual de la tarea desde este modal.</DialogDescription></DialogHeader><input ref={attachmentInputRef} type="file" accept={attachmentAccept()} className="hidden" onChange={(event) => void handleAttachmentFile(event.target.files?.[0] || null)} /><input ref={customFieldFileInputRef} type="file" accept={attachmentAccept()} className="hidden" onChange={(event) => void handleCustomFieldFile(event.target.files?.[0] || null)} /><div className="grid gap-4 py-2"><Card className="overflow-hidden border-0 shadow-none"><CardContent className="rounded-[28px] border p-5" style={{ background: `radial-gradient(circle at top right, ${normalizeHex(detailForm.colorHex)}33, transparent 30%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)`, borderColor: `${normalizeHex(detailForm.colorHex)}55` }}><div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]"><div className="space-y-4"><div className="grid gap-2"><Label>Título</Label><Input value={detailForm.title} onChange={(event) => setDetailForm((current) => ({ ...current, title: event.target.value }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Descripción</Label><Textarea value={detailForm.description} onChange={(event) => setDetailForm((current) => ({ ...current, description: event.target.value }))} rows={5} disabled={!canEditTasks} /></div></div><div className="space-y-4"><div className="grid gap-2"><Label>Estado</Label><Select value={detailForm.status} onValueChange={(value) => setDetailForm((current) => ({ ...current, status: value as TaskStatus }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">No iniciado</SelectItem><SelectItem value="IN_PROGRESS">En curso</SelectItem><SelectItem value="DONE">Finalizada</SelectItem><SelectItem value="CANCELED">Cancelada</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Prioridad</Label><Select value={detailForm.priority} onValueChange={(value) => setDetailForm((current) => ({ ...current, priority: value as TaskPriority }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Baja</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">Alta</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Entrega</Label><Input type="datetime-local" value={detailForm.dueAt} onChange={(event) => setDetailForm((current) => ({ ...current, dueAt: event.target.value }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Color de la tarea</Label><div className="flex flex-wrap items-center gap-2">{COLOR_PRESETS.map((color) => <button key={color} type="button" className={normalizeHex(detailForm.colorHex) === color ? 'h-9 w-9 rounded-full ring-4 ring-slate-300' : 'h-9 w-9 rounded-full ring-1 ring-slate-200'} style={{ backgroundColor: color }} onClick={() => setDetailForm((current) => ({ ...current, colorHex: color }))} disabled={!canEditTasks} />)}<Input type="color" value={normalizeHex(detailForm.colorHex)} onChange={(event) => setDetailForm((current) => ({ ...current, colorHex: event.target.value.toUpperCase() }))} className="h-10 w-14 rounded-xl p-1" disabled={!canEditTasks} /></div></div></div></div><div className="mt-4 flex flex-wrap gap-2"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_META[detailForm.status].badgeClass}`}>{STATUS_META[detailForm.status].label}</span><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${PRIORITY_META[detailForm.priority].badgeClass}`}>{PRIORITY_META[detailForm.priority].label}</span><span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">Creada: {formatDate(selectedTask?.createdAt, 'Sin fecha')}</span><span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">Actualizada: {formatDate(selectedTask?.updatedAt, 'Sin fecha')}</span></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Responsables</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-[220px_1fr]"><div className="grid gap-2"><Label>Asignar colaborador</Label><Input value={detailAssigneeSearch} onChange={(event) => setDetailAssigneeSearch(event.target.value)} placeholder="Correo o nombre" disabled={!canEditTasks} /></div><div className="grid gap-3"><div className="flex flex-wrap gap-2">{detailForm.assignedToUserIds.map((userId) => { const user = users.find((item) => item.id === userId); return <button key={userId} type="button" onClick={() => setDetailForm((current) => ({ ...current, assignedToUserIds: current.assignedToUserIds.filter((item) => item !== userId) }))} className="rounded-full bg-sky-100 px-3 py-1.5 text-sm text-sky-800" disabled={!canEditTasks}>{user?.name || user?.email || userId} ×</button> })}{!detailForm.assignedToUserIds.length ? <span className="text-sm text-slate-400">Sin colaboradores asignados</span> : null}</div><div className="max-h-36 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">{detailAssigneeCandidates.map((user) => { const selected = detailForm.assignedToUserIds.includes(user.id); return <button key={user.id} type="button" onClick={() => setDetailForm((current) => ({ ...current, assignedToUserIds: selected ? current.assignedToUserIds.filter((item) => item !== user.id) : [...current.assignedToUserIds, user.id] }))} className={selected ? 'flex w-full items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left'} disabled={!canEditTasks}><span>{user.name || user.email || user.id}</span><span className="text-xs text-slate-500">{selected ? 'Asignado' : 'Agregar'}</span></button> })}</div></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Adjuntos de la tarea</CardTitle><CardDescription>Sube imágenes, audios, videos o documentos que sirvan como evidencia o referencia directa de la tarea.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-center gap-3"><Button variant="outline" onClick={() => attachmentInputRef.current?.click()} disabled={!canEditTasks || uploadingAttachment}>{uploadingAttachment ? 'Subiendo...' : 'Agregar adjunto'}</Button><Button variant="outline" onClick={() => setLibraryPickerOpen(true)} disabled={!canEditTasks}>Elegir desde biblioteca</Button><Button variant="outline" onClick={() => setExternalAttachmentDialogOpen(true)} disabled={!canEditTasks || uploadingAttachment}>Vincular Drive/OneDrive</Button><span className="text-sm text-slate-500">{detailForm.attachmentsJson.length} archivo(s) vinculados</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{detailForm.attachmentsJson.map((attachment) => <div key={attachment.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium text-slate-950 line-clamp-1">{attachment.name}</p><p className="mt-1 text-xs text-slate-500">{attachment.type.toUpperCase()} · {formatAttachmentSize(attachment.sizeBytes)}</p></div>{canEditTasks ? <Button variant="outline" className="h-8 rounded-lg px-2" onClick={() => setDetailForm((current) => ({ ...current, attachmentsJson: current.attachmentsJson.filter((item) => item.id !== attachment.id) }))}>Quitar</Button> : null}</div><div className="mt-3 rounded-xl border border-slate-200 bg-white p-2">{attachment.type === 'image' ? <div className="relative h-40 w-full overflow-hidden rounded-lg"><Image src={attachment.url} alt={attachment.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" unoptimized /></div> : null}{attachment.type === 'audio' ? <audio src={attachment.url} controls className="w-full" /> : null}{attachment.type === 'video' ? <video src={attachment.url} controls className="h-40 w-full rounded-lg bg-black object-cover" /> : null}{attachment.type === 'document' ? <div className="flex h-40 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-600">Documento disponible</div> : null}</div><a href={attachment.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:text-sky-900">Abrir archivo</a></div>)}{!detailForm.attachmentsJson.length ? <p className="text-sm text-slate-400">No hay adjuntos todavía.</p> : null}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Campos personalizados</CardTitle><CardDescription>Agrega campos de texto o de archivo y luego edítalos o elimínalos individualmente.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 md:grid-cols-[1fr_160px_1fr_140px] md:items-end"><div className="grid gap-2"><Label>Etiqueta</Label><Input value={customFieldDraft.label} onChange={(event) => setCustomFieldDraft((current) => ({ ...current, label: event.target.value }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Tipo</Label><Select value={customFieldDraft.type} onValueChange={(value) => setCustomFieldDraft((current) => ({ ...current, type: value as TaskCustomFieldType, textValue: '', file: null }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TEXT">Texto</SelectItem><SelectItem value="FILE">Archivo</SelectItem></SelectContent></Select></div>{customFieldDraft.type === 'TEXT' ? <div className="grid gap-2"><Label>Valor</Label><Input value={customFieldDraft.textValue} onChange={(event) => setCustomFieldDraft((current) => ({ ...current, textValue: event.target.value }))} disabled={!canEditTasks} /></div> : <div className="grid gap-2"><Label>Archivo</Label><Button variant="outline" onClick={() => { setCustomFieldUploadTarget('new'); customFieldFileInputRef.current?.click() }} disabled={!canEditTasks || uploadingAttachment}>{customFieldDraft.file ? 'Reemplazar archivo' : uploadingAttachment ? 'Subiendo...' : 'Subir archivo'}</Button>{customFieldDraft.file ? <p className="text-xs text-slate-500">{customFieldDraft.file.name}</p> : null}</div>}<Button onClick={handleAddCustomField} disabled={!canEditTasks}>Agregar campo</Button></div><div className="space-y-3">{detailForm.customFieldsJson.map((field) => <div key={field.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="grid gap-3 lg:grid-cols-[1fr_160px_1fr_110px] lg:items-start"><div className="grid gap-2"><Label>Etiqueta</Label><Input value={field.label} onChange={(event) => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item) }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Tipo</Label><Select value={field.type} onValueChange={(value) => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, type: value as TaskCustomFieldType, textValue: value === 'TEXT' ? item.textValue || '' : null, file: value === 'FILE' ? item.file || null : null } : item) }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TEXT">Texto</SelectItem><SelectItem value="FILE">Archivo</SelectItem></SelectContent></Select></div>{field.type === 'TEXT' ? <div className="grid gap-2"><Label>Contenido</Label><Input value={field.textValue || ''} onChange={(event) => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, textValue: event.target.value } : item) }))} disabled={!canEditTasks} /></div> : <div className="grid gap-2"><Label>Archivo</Label><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => { setCustomFieldUploadTarget(field.id); customFieldFileInputRef.current?.click() }} disabled={!canEditTasks || uploadingAttachment}>{field.file ? 'Reemplazar' : 'Subir'}</Button>{field.file ? <Button variant="outline" onClick={() => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, file: null } : item) }))} disabled={!canEditTasks}>Quitar archivo</Button> : null}</div>{field.file ? <a href={field.file.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-700">{field.file.name}</a> : <span className="text-sm text-slate-400">Sin archivo</span>}</div>}<div className="pt-6 lg:pt-7"><Button variant="outline" onClick={() => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.filter((item) => item.id !== field.id) }))} disabled={!canEditTasks}>Quitar</Button></div></div></div>)}{!detailForm.customFieldsJson.length ? <p className="text-sm text-slate-400">No hay campos personalizados todavía.</p> : null}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Historial de cambios</CardTitle></CardHeader><CardContent className="space-y-3">{selectedTask?.history.length ? selectedTask.history.map((entry) => <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600"><div className="flex items-center justify-between gap-3"><p className="font-medium text-slate-900">{entry.message}</p><span className="text-xs text-slate-500">{formatDate(entry.createdAt, 'Sin fecha')}</span></div><p className="mt-1 text-xs text-slate-500">{entry.actorUser?.name || entry.actorUser?.email || 'Sistema'} · {entry.type}</p></div>) : <p className="text-sm text-muted-foreground">Sin historial todavía.</p>}</CardContent></Card><Card><CardContent className="grid gap-4 p-4 md:grid-cols-[160px_1fr_140px] md:items-start"><Label className="pt-2">Crear nota</Label><Textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Contenido de la nota" rows={3} disabled={!canEditTasks} /><Button onClick={() => void handleAddNote()} disabled={savingNote || !canEditTasks}>{savingNote ? 'Guardando...' : 'Crear nota'}</Button><div className="md:col-span-3 space-y-2">{noteEntries.length ? noteEntries.map((entry) => <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600"><p className="font-medium text-slate-900">{entry.message}</p><p className="mt-1 text-xs text-slate-500">{entry.actorUser?.name || entry.actorUser?.email || 'Sistema'} · {formatDate(entry.createdAt, 'Sin fecha')}</p></div>) : <p className="text-sm text-muted-foreground">No hay notas.</p>}</div></CardContent></Card><Card><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium text-slate-900">Archivo</p><p className="text-sm text-slate-500">Puedes archivar la tarea sin perder historial, adjuntos ni responsables.</p></div><Button variant="outline" onClick={() => setDetailForm((current) => ({ ...current, archived: !current.archived }))} disabled={!canEditTasks}>{detailForm.archived ? 'Quitar de archivo' : 'Archivar tarea'}</Button></CardContent></Card></div><DialogFooter><Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Cerrar</Button><Button onClick={() => void handleSaveDetail()} disabled={savingDetail || !canEditTasks}>{savingDetail ? 'Guardando...' : 'Guardar cambios'}</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}><DialogContent className="max-w-[680px]"><DialogHeader><DialogTitle>{projectForm.projectId ? 'Editar proyecto' : 'Crear proyecto'}</DialogTitle><DialogDescription>Define el nombre y la descripción operativa del proyecto dentro del espacio seleccionado.</DialogDescription></DialogHeader><div className="grid gap-3 py-1.5"><div className="grid gap-1.5"><Label>Nombre del proyecto</Label><Input value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} placeholder="ecommerce" /></div><div className="grid gap-1.5"><Label>Descripción</Label><Textarea value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Objetivo, entregables o contexto operativo del proyecto" /></div></div><DialogFooter><Button variant="outline" onClick={() => setProjectDialogOpen(false)}>Cancelar</Button><Button onClick={() => void handleSaveProject()} disabled={savingProject}>{savingProject ? 'Guardando...' : projectForm.projectId ? 'Guardar cambios' : 'Crear proyecto'}</Button></DialogFooter></DialogContent></Dialog>
      <CrmFileLibraryPicker open={libraryPickerOpen} onOpenChange={setLibraryPickerOpen} onPick={handleLibraryAttachment} title="Seleccionar archivo del repositorio CRM" allowFolders={false} />
      <Dialog open={externalAttachmentDialogOpen} onOpenChange={setExternalAttachmentDialogOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Vincular desde Drive o OneDrive</DialogTitle><DialogDescription>Pega una URL compartida para registrarla como adjunto externo de esta tarea.</DialogDescription></DialogHeader><div className="grid gap-3 py-2"><div className="grid gap-2"><Label>Proveedor</Label><Select value={externalAttachmentForm.provider} onValueChange={(value) => setExternalAttachmentForm((current) => ({ ...current, provider: value as ExternalAttachmentProvider }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GOOGLE_DRIVE">Google Drive</SelectItem><SelectItem value="ONEDRIVE">OneDrive</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Nombre visible</Label><Input value={externalAttachmentForm.name} onChange={(event) => setExternalAttachmentForm((current) => ({ ...current, name: event.target.value }))} placeholder="Propuesta comercial Q2" /></div><div className="grid gap-2"><Label>URL compartida</Label><Input value={externalAttachmentForm.url} onChange={(event) => setExternalAttachmentForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://drive.google.com/... o https://onedrive.live.com/..." /></div></div><DialogFooter><Button variant="outline" onClick={() => { setExternalAttachmentDialogOpen(false); setExternalAttachmentForm(getInitialExternalAttachmentForm()) }}>Cancelar</Button><Button onClick={() => void handleExternalAttachmentLink()} disabled={uploadingAttachment}>{uploadingAttachment ? 'Vinculando...' : 'Vincular adjunto'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}
