"use client"

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CrmFileLibraryPicker } from '@/components/crm/crm-file-library-picker'
import type { CrmFileItem } from '@/components/crm/crm-files-types'

type WorkspaceScope = 'SEDE' | 'USER'
type WorkspaceRole = 'VIEWER' | 'EDITOR' | 'MANAGER'
type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELED'
type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH'
type TaskHistoryType = 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'DUE_DATE_CHANGED' | 'ASSIGNEES_CHANGED' | 'NOTE_ADDED' | 'ATTACHMENTS_CHANGED' | 'CUSTOM_FIELDS_CHANGED' | 'ARCHIVED' | 'RESTORED'
type TaskAttachmentType = 'image' | 'audio' | 'video' | 'document'
type TaskCustomFieldType = 'TEXT' | 'FILE'

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

type Workspace = {
  id: string
  name: string
  description?: string | null
  scope: WorkspaceScope
  sede?: SedeOption | null
  ownerUser?: TeamUser | null
  members: WorkspaceMember[]
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
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const response = await fetch(url, init)
  return (await response.json().catch(() => ({}))) as JsonResponse<T>
}

export function CrmTaskWorkspacesClient() {
  const searchParams = useSearchParams()
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const customFieldFileInputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [savingDetail, setSavingDetail] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false)
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)
  const [workspaceSearch, setWorkspaceSearch] = useState('')
  const [workspaceMemberSearch, setWorkspaceMemberSearch] = useState('')
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [detailAssigneeSearch, setDetailAssigneeSearch] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [users, setUsers] = useState<TeamUser[]>([])
  const [sedes, setSedes] = useState<SedeOption[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('')
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null)
  const [customFieldUploadTarget, setCustomFieldUploadTarget] = useState<string | null>(null)
  const [workspaceForm, setWorkspaceForm] = useState({ name: '', description: '', scope: 'SEDE' as WorkspaceScope, sedeId: '', ownerUserId: '', memberUserIds: [] as string[] })
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueAt: '', priority: 'NORMAL' as TaskPriority, status: 'OPEN' as TaskStatus, colorHex: '#1D4ED8', assignedToUserIds: [] as string[] })
  const [detailForm, setDetailForm] = useState({ id: '', title: '', description: '', dueAt: '', priority: 'NORMAL' as TaskPriority, status: 'OPEN' as TaskStatus, colorHex: '#1D4ED8', attachmentsJson: [] as TaskAttachment[], customFieldsJson: [] as TaskCustomField[], assignedToUserIds: [] as string[], archived: false })
  const [customFieldDraft, setCustomFieldDraft] = useState({ label: '', type: 'TEXT' as TaskCustomFieldType, textValue: '', file: null as TaskAttachment | null })
  const [workspaceSettingsForm, setWorkspaceSettingsForm] = useState({ id: '', name: '', description: '', ownerUserId: '', members: [] as Array<{ userId: string; role: WorkspaceRole }> })
  const requestedTaskId = searchParams?.get('taskId') || ''
  const requestedWorkspaceId = searchParams?.get('workspaceId') || ''

  const selectedWorkspace = useMemo(() => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null, [selectedWorkspaceId, workspaces])
  const canEditTasks = Boolean(selectedWorkspace?.permissions?.canEditTasks)
  const canManageWorkspace = Boolean(selectedWorkspace?.permissions?.canManage)

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
      })
      setCustomFieldDraft({ label: '', type: 'TEXT', textValue: '', file: null })
      setDetailDialogOpen(true)
    }
  }

  useEffect(() => { void loadBase() }, [])
  useEffect(() => { void loadTasks(selectedWorkspaceId) }, [loadTasks, selectedWorkspaceId])

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

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tasks
    return tasks.filter((task) => {
      const haystack = [task.title, task.description, task.createdBy?.name, task.workspace?.name, task.lead?.nombre, task.opportunity?.title, task.cliente?.nombre, ...task.assignments.map((assignment) => assignment.user.name || assignment.user.email || ''), ...(task.customFieldsJson || []).map((field) => `${field.label} ${field.textValue || field.file?.name || ''}`)].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [search, tasks])

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

  function openWorkspaceSettings() {
    if (!selectedWorkspace) return
    setWorkspaceSettingsForm({ id: selectedWorkspace.id, name: selectedWorkspace.name, description: selectedWorkspace.description || '', ownerUserId: selectedWorkspace.ownerUser?.id || '', members: selectedWorkspace.members.map((member) => ({ userId: member.userId, role: member.role })) })
    setWorkspaceSettingsOpen(true)
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

  async function handleCreateTask() {
    if (!selectedWorkspaceId) return alert('Selecciona primero un espacio de trabajo.')
    if (!canEditTasks) return alert('Tu rol actual en este espacio es solo de lectura.')
    if (!taskForm.title.trim()) return alert('El título de la tarea es requerido.')
    setSavingTask(true)
    try {
      const json = await requestJson<TaskItem>('/api/crm/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: selectedWorkspaceId, title: taskForm.title, description: taskForm.description, dueAt: taskForm.dueAt || null, priority: taskForm.priority, status: taskForm.status, colorHex: normalizeHex(taskForm.colorHex), assignedToUserIds: taskForm.assignedToUserIds }) })
      if (!json.success) return alert(json.error || 'No se pudo crear la tarea.')
      setTaskDialogOpen(false)
      setTaskForm({ title: '', description: '', dueAt: '', priority: 'NORMAL', status: 'OPEN', colorHex: '#1D4ED8', assignedToUserIds: [] })
      await loadTasks(selectedWorkspaceId)
    } finally {
      setSavingTask(false)
    }
  }

  async function handleUpdateTask(taskId: string, patch: Record<string, unknown>) {
    const json = await requestJson<TaskItem>(`/api/crm/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    if (!json.success) {
      alert(json.error || 'No se pudo actualizar la tarea.')
      return false
    }
    await loadTasks(selectedWorkspaceId)
    if (detailDialogOpen) await loadTaskDetail(taskId)
    return true
  }

  async function handleSaveDetail() {
    if (!detailForm.id) return
    if (!canEditTasks) return alert('Tu rol actual en este espacio es solo de lectura.')
    setSavingDetail(true)
    try {
      await handleUpdateTask(detailForm.id, { title: detailForm.title, description: detailForm.description, dueAt: detailForm.dueAt || null, priority: detailForm.priority, status: detailForm.status, colorHex: normalizeHex(detailForm.colorHex), attachmentsJson: detailForm.attachmentsJson, customFieldsJson: detailForm.customFieldsJson, assignedToUserIds: detailForm.assignedToUserIds, archived: detailForm.archived })
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
    } finally {
      setSavingNote(false)
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

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Espacios de trabajo' }]}
        eyebrow="Operación colaborativa"
        title="Espacios de trabajo y seguimiento interno"
        description="Administra espacios transversales del ERP, organiza tareas colaborativas, adjunta evidencia y centraliza seguimiento con estados más claros y visuales más fuertes."
        actions={<><Button variant="outline" className="rounded-2xl border-slate-200 bg-white/85" onClick={() => setWorkspaceDialogOpen(true)}>Nuevo espacio</Button><Button className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => setTaskDialogOpen(true)} disabled={!selectedWorkspaceId || !canEditTasks}>Nueva tarea</Button></>}
        stats={[
          { label: 'Espacios', value: workspaces.length, hint: 'Contextos colaborativos visibles', tone: 'sky' },
          { label: 'No iniciadas', value: filteredTasks.filter((task) => task.status === 'OPEN' && !task.archivedAt).length, hint: 'Pendiente de arrancar', tone: 'amber' },
          { label: 'En curso', value: filteredTasks.filter((task) => task.status === 'IN_PROGRESS' && !task.archivedAt).length, hint: 'Ejecución activa', tone: 'teal' },
          { label: 'Finalizadas', value: filteredTasks.filter((task) => task.status === 'DONE').length, hint: 'Cerradas', tone: 'teal' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]"><CardHeader className="border-b border-slate-100 pb-5"><CardTitle className="text-xl">Espacios de trabajo</CardTitle><CardDescription>Selecciona un espacio para ver tareas, miembros y permisos efectivos.</CardDescription></CardHeader><CardContent className="space-y-3 p-4 md:p-5">{loading ? <p className="text-sm text-muted-foreground">Cargando espacios...</p> : null}{!loading && workspaces.length === 0 ? <p className="text-sm text-muted-foreground">No tienes espacios de trabajo todavía.</p> : null}{workspaces.map((workspace) => <button key={workspace.id} type="button" onClick={() => setSelectedWorkspaceId(workspace.id)} className={selectedWorkspaceId === workspace.id ? 'w-full rounded-3xl border border-sky-300 bg-sky-50/80 p-4 text-left shadow-sm' : 'w-full rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-4 text-left shadow-sm transition-shadow hover:shadow-md'}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{workspace.name}</p><p className="mt-1 text-sm text-slate-600">{workspace.description || (workspace.scope === 'SEDE' ? workspace.sede?.nombre || 'Espacio por sede' : workspace.ownerUser?.name || workspace.ownerUser?.email || 'Espacio por usuario')}</p></div><div className="flex flex-col items-end gap-1"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{workspace.scope}</span><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">{formatRole(workspace.currentUserRole)}</span></div></div><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{workspace._count?.tasks ?? 0} tareas</span><span>{workspace._count?.members ?? workspace.members.length} miembros</span></div></button>)}</CardContent></Card>

        <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]"><CardHeader className="border-b border-slate-100 pb-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle className="text-xl">Tareas del espacio</CardTitle><CardDescription>{selectedWorkspace ? `${selectedWorkspace.name} · ${formatRole(selectedWorkspace.currentUserRole)}${selectedWorkspace.permissions?.canEditTasks ? ' con edición de tareas' : ' solo lectura'}` : 'Tabla operativa con responsables, estado, color, evidencia y acceso a detalle completo.'}</CardDescription></div><div className="flex flex-wrap gap-2">{canManageWorkspace ? <Button variant="outline" className="rounded-xl" onClick={openWorkspaceSettings}>Miembros y roles</Button> : null}<Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por tarea, responsable, campo o descripción..." className="w-[320px] rounded-xl" /><Button variant="outline" className="rounded-xl" onClick={() => setShowArchived((current) => !current)}>{showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}</Button></div></div></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><div className="min-w-[1080px]"><div className="grid grid-cols-[1.35fr_1.3fr_0.75fr_1fr_0.9fr_0.85fr] gap-4 border-b border-slate-100 px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"><span>Tarea</span><span>Descripción</span><span>Responsables</span><span>Estado</span><span>Entrega</span><span>Acciones</span></div>{filteredTasks.map((task) => { const statusMeta = STATUS_META[task.status]; return <div key={task.id} className={`grid grid-cols-[1.35fr_1.3fr_0.75fr_1fr_0.9fr_0.85fr] items-center gap-4 border-b px-6 py-3 text-sm text-slate-700 bg-gradient-to-r ${statusMeta.softClass}`} style={{ borderLeft: `5px solid ${normalizeHex(task.colorHex)}`, borderBottomColor: 'rgba(226,232,240,0.9)' }}><div className="flex min-w-0 items-center gap-2"><p className="truncate font-semibold text-slate-950">{task.title}</p><span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_META[task.priority].badgeClass}`}>{PRIORITY_META[task.priority].label}</span></div><p className="truncate text-slate-600">{task.description || 'Sin descripción'}</p><div className="flex min-w-0 flex-wrap items-center gap-2">{task.assignments.length === 0 ? <span className="text-xs text-slate-400">Sin responsables</span> : null}{task.assignments.map((assignment) => <span key={assignment.id} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800" title={assignment.user.name || assignment.user.email || assignment.user.id}>{initials(assignment.user.name, assignment.user.email)}</span>)}</div><div><Select value={task.status} onValueChange={(value) => void handleUpdateTask(task.id, { status: value })} disabled={!canEditTasks}><SelectTrigger className={`h-10 rounded-xl border font-semibold shadow-sm ${STATUS_SELECT_CLASS[task.status]}`}><SelectValue>{formatStatus(task.status)}</SelectValue></SelectTrigger><SelectContent><SelectItem value="OPEN">No iniciado</SelectItem><SelectItem value="IN_PROGRESS">En curso</SelectItem><SelectItem value="DONE">Finalizada</SelectItem><SelectItem value="CANCELED">Cancelada</SelectItem></SelectContent></Select></div><div className="truncate text-slate-600">{task.completedAt ? `Completada: ${formatDate(task.completedAt, 'Sin fecha')}` : formatDate(task.dueAt, 'Sin fecha')}</div><div className="flex items-center gap-2"><Button variant="outline" className="rounded-xl" onClick={() => void loadTaskDetail(task.id)}>Ver detalles</Button><Button variant="outline" className="rounded-xl" onClick={() => void handleUpdateTask(task.id, { archived: !task.archivedAt })} disabled={!canEditTasks}>{task.archivedAt ? 'Restaurar' : 'Archivar'}</Button></div></div>})}{!filteredTasks.length ? <div className="px-6 py-8 text-sm text-slate-500">No hay tareas para mostrar en este espacio.</div> : null}</div></div></CardContent></Card>
      </div>

      <Dialog open={workspaceSettingsOpen} onOpenChange={setWorkspaceSettingsOpen}><DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle>Administrar espacio de trabajo</DialogTitle><DialogDescription>Edita miembros después de creado y aplica roles reales con restricciones operativas.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><Label>Nombre</Label><Input value={workspaceSettingsForm.name} onChange={(event) => setWorkspaceSettingsForm((current) => ({ ...current, name: event.target.value }))} disabled={!canManageWorkspace} /></div><div className="grid gap-2"><Label>Responsable</Label><Select value={workspaceSettingsForm.ownerUserId || '__none__'} onValueChange={(value) => setWorkspaceSettingsForm((current) => ({ ...current, ownerUserId: value === '__none__' ? '' : value, members: value !== '__none__' && !current.members.some((item) => item.userId === value) ? [...current.members, { userId: value, role: 'MANAGER' }] : current.members }))} disabled={!canManageWorkspace}><SelectTrigger><SelectValue placeholder="Selecciona un responsable" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin responsable</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name || user.email || user.id}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-2"><Label>Descripción</Label><Textarea value={workspaceSettingsForm.description} onChange={(event) => setWorkspaceSettingsForm((current) => ({ ...current, description: event.target.value }))} rows={3} disabled={!canManageWorkspace} /></div><div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]"><div className="grid gap-2"><Label>Agregar miembro</Label><Input value={workspaceMemberSearch} onChange={(event) => setWorkspaceMemberSearch(event.target.value)} placeholder="Busca usuarios para invitarlos al espacio..." disabled={!canManageWorkspace} /><div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">{workspaceMemberCandidates.map((user) => <button key={user.id} type="button" onClick={() => setWorkspaceSettingsForm((current) => ({ ...current, members: [...current.members, { userId: user.id, role: 'VIEWER' }] }))} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left" disabled={!canManageWorkspace}><span>{user.name || user.email || user.id}</span><span className="text-xs text-slate-500">Agregar</span></button>)}{!workspaceMemberCandidates.length ? <p className="text-sm text-slate-400">No hay usuarios adicionales con ese filtro.</p> : null}</div></div><div className="grid gap-2"><Label>Miembros y roles</Label><div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">{workspaceSettingsForm.members.map((member) => { const user = users.find((item) => item.id === member.userId); const locked = member.userId === selectedWorkspace?.createdBy?.id || member.userId === workspaceSettingsForm.ownerUserId; return <div key={member.userId} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[1fr_170px_110px] md:items-center"><div><p className="font-medium text-slate-950">{user?.name || user?.email || member.userId}</p><p className="text-xs text-slate-500">{locked ? 'Rol protegido por propiedad del espacio' : 'Puedes cambiar el rol o quitar el acceso'}</p></div><Select value={member.role} onValueChange={(value) => setWorkspaceSettingsForm((current) => ({ ...current, members: current.members.map((item) => item.userId === member.userId ? { ...item, role: value as WorkspaceRole } : item) }))} disabled={!canManageWorkspace || locked}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="VIEWER">Viewer</SelectItem><SelectItem value="EDITOR">Editor</SelectItem><SelectItem value="MANAGER">Manager</SelectItem></SelectContent></Select><Button variant="outline" onClick={() => setWorkspaceSettingsForm((current) => ({ ...current, members: current.members.filter((item) => item.userId !== member.userId) }))} disabled={!canManageWorkspace || locked}>Quitar</Button></div>})}</div></div></div></div><DialogFooter><Button variant="outline" onClick={() => setWorkspaceSettingsOpen(false)}>Cancelar</Button><Button onClick={() => void handleSaveWorkspaceSettings()} disabled={savingWorkspace || !canManageWorkspace}>{savingWorkspace ? 'Guardando...' : 'Guardar cambios'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={workspaceDialogOpen} onOpenChange={setWorkspaceDialogOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Nuevo espacio de trabajo</DialogTitle><DialogDescription>Define si el espacio pertenece a una sede o a un usuario, y luego invita quién puede verlo.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>Nombre</Label><Input value={workspaceForm.name} onChange={(event) => setWorkspaceForm((current) => ({ ...current, name: event.target.value }))} /></div><div className="grid gap-2"><Label>Descripción</Label><Textarea value={workspaceForm.description} onChange={(event) => setWorkspaceForm((current) => ({ ...current, description: event.target.value }))} rows={3} /></div><div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><Label>Tipo de espacio</Label><Select value={workspaceForm.scope} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, scope: value as WorkspaceScope, sedeId: '', ownerUserId: '' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SEDE">Por sede</SelectItem><SelectItem value="USER">Por usuario</SelectItem></SelectContent></Select></div>{workspaceForm.scope === 'SEDE' ? <div className="grid gap-2"><Label>Sede</Label><Select value={workspaceForm.sedeId || '__none__'} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, sedeId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Selecciona una sede" /></SelectTrigger><SelectContent><SelectItem value="__none__">Selecciona</SelectItem>{sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}</SelectContent></Select></div> : <div className="grid gap-2"><Label>Usuario responsable</Label><Select value={workspaceForm.ownerUserId || '__none__'} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, ownerUserId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger><SelectContent><SelectItem value="__none__">Selecciona</SelectItem>{users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name || user.email || user.id}</SelectItem>)}</SelectContent></Select></div>}</div><div className="grid gap-2"><Label>Invitar usuarios con acceso</Label><Input value={workspaceSearch} onChange={(event) => setWorkspaceSearch(event.target.value)} placeholder="Busca usuarios por nombre o correo..." /><div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">{workspaceCandidates.map((user) => { const selected = workspaceForm.memberUserIds.includes(user.id); return <button key={user.id} type="button" onClick={() => setWorkspaceForm((current) => ({ ...current, memberUserIds: selected ? current.memberUserIds.filter((item) => item !== user.id) : [...current.memberUserIds, user.id] }))} className={selected ? 'flex w-full items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left'}><span>{user.name || user.email || user.id}</span><span className="text-xs text-slate-500">{selected ? 'Invitado' : 'Agregar'}</span></button>})}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setWorkspaceDialogOpen(false)}>Cancelar</Button><Button onClick={() => void handleCreateWorkspace()} disabled={savingWorkspace}>{savingWorkspace ? 'Guardando...' : 'Crear espacio'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}><DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle>Nueva tarea</DialogTitle><DialogDescription>Crea una tarea con estado inicial, color visual fuerte y responsables dentro del espacio seleccionado.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>Título</Label><Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} /></div><div className="grid gap-2"><Label>Descripción</Label><Textarea value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} rows={4} /></div><div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><Label>Estado inicial</Label><Select value={taskForm.status} onValueChange={(value) => setTaskForm((current) => ({ ...current, status: value as TaskStatus }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">No iniciado</SelectItem><SelectItem value="IN_PROGRESS">En curso</SelectItem><SelectItem value="DONE">Finalizada</SelectItem><SelectItem value="CANCELED">Cancelada</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Prioridad</Label><Select value={taskForm.priority} onValueChange={(value) => setTaskForm((current) => ({ ...current, priority: value as TaskPriority }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Baja</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">Alta</SelectItem></SelectContent></Select></div></div><div className="grid gap-2"><Label>Color de la tarea</Label><div className="flex flex-wrap items-center gap-3">{COLOR_PRESETS.map((color) => <button key={color} type="button" className={normalizeHex(taskForm.colorHex) === color ? 'h-10 w-10 rounded-full ring-4 ring-slate-300' : 'h-10 w-10 rounded-full ring-1 ring-slate-200'} style={{ backgroundColor: color }} onClick={() => setTaskForm((current) => ({ ...current, colorHex: color }))} />)}<Input type="color" value={normalizeHex(taskForm.colorHex)} onChange={(event) => setTaskForm((current) => ({ ...current, colorHex: event.target.value.toUpperCase() }))} className="h-10 w-14 rounded-xl p-1" /></div></div><div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><Label>Fecha y hora de entrega</Label><Input type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))} /></div><div className="rounded-2xl border border-slate-200 p-4" style={{ background: `linear-gradient(135deg, ${normalizeHex(taskForm.colorHex)} 0%, #ffffff 120%)` }}><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">Vista rápida</p><p className="mt-2 font-semibold text-white">{taskForm.title || 'Nueva tarea'}</p><p className="mt-1 text-sm text-white/85">{formatStatus(taskForm.status)} · {PRIORITY_META[taskForm.priority].label}</p></div></div><div className="grid gap-2"><Label>Asignar usuarios</Label><Input value={assigneeSearch} onChange={(event) => setAssigneeSearch(event.target.value)} placeholder="Busca usuarios por nombre o correo..." /><div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">{taskAssigneeCandidates.map((user) => { const selected = taskForm.assignedToUserIds.includes(user.id); return <button key={user.id} type="button" onClick={() => setTaskForm((current) => ({ ...current, assignedToUserIds: selected ? current.assignedToUserIds.filter((item) => item !== user.id) : [...current.assignedToUserIds, user.id] }))} className={selected ? 'flex w-full items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left'}><span>{user.name || user.email || user.id}</span><span className="text-xs text-slate-500">{selected ? 'Asignado' : 'Asignar'}</span></button>})}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancelar</Button><Button onClick={() => void handleCreateTask()} disabled={savingTask || !canEditTasks}>{savingTask ? 'Guardando...' : 'Crear tarea'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}><DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto"><DialogHeader><DialogTitle>{detailForm.title || 'Detalle de tarea'}</DialogTitle><DialogDescription>Edita todos los campos operativos, adjunta evidencia, agrega campos personalizados y controla el color visual de la tarea desde este modal.</DialogDescription></DialogHeader><input ref={attachmentInputRef} type="file" accept={attachmentAccept()} className="hidden" onChange={(event) => void handleAttachmentFile(event.target.files?.[0] || null)} /><input ref={customFieldFileInputRef} type="file" accept={attachmentAccept()} className="hidden" onChange={(event) => void handleCustomFieldFile(event.target.files?.[0] || null)} /><div className="grid gap-4 py-2"><Card className="overflow-hidden border-0 shadow-none"><CardContent className="rounded-[28px] border p-5" style={{ background: `radial-gradient(circle at top right, ${normalizeHex(detailForm.colorHex)}33, transparent 30%), linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)`, borderColor: `${normalizeHex(detailForm.colorHex)}55` }}><div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]"><div className="space-y-4"><div className="grid gap-2"><Label>Título</Label><Input value={detailForm.title} onChange={(event) => setDetailForm((current) => ({ ...current, title: event.target.value }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Descripción</Label><Textarea value={detailForm.description} onChange={(event) => setDetailForm((current) => ({ ...current, description: event.target.value }))} rows={5} disabled={!canEditTasks} /></div></div><div className="space-y-4"><div className="grid gap-2"><Label>Estado</Label><Select value={detailForm.status} onValueChange={(value) => setDetailForm((current) => ({ ...current, status: value as TaskStatus }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">No iniciado</SelectItem><SelectItem value="IN_PROGRESS">En curso</SelectItem><SelectItem value="DONE">Finalizada</SelectItem><SelectItem value="CANCELED">Cancelada</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Prioridad</Label><Select value={detailForm.priority} onValueChange={(value) => setDetailForm((current) => ({ ...current, priority: value as TaskPriority }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LOW">Baja</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">Alta</SelectItem></SelectContent></Select></div><div className="grid gap-2"><Label>Entrega</Label><Input type="datetime-local" value={detailForm.dueAt} onChange={(event) => setDetailForm((current) => ({ ...current, dueAt: event.target.value }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Color de la tarea</Label><div className="flex flex-wrap items-center gap-2">{COLOR_PRESETS.map((color) => <button key={color} type="button" className={normalizeHex(detailForm.colorHex) === color ? 'h-9 w-9 rounded-full ring-4 ring-slate-300' : 'h-9 w-9 rounded-full ring-1 ring-slate-200'} style={{ backgroundColor: color }} onClick={() => setDetailForm((current) => ({ ...current, colorHex: color }))} disabled={!canEditTasks} />)}<Input type="color" value={normalizeHex(detailForm.colorHex)} onChange={(event) => setDetailForm((current) => ({ ...current, colorHex: event.target.value.toUpperCase() }))} className="h-10 w-14 rounded-xl p-1" disabled={!canEditTasks} /></div></div></div></div><div className="mt-4 flex flex-wrap gap-2"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_META[detailForm.status].badgeClass}`}>{STATUS_META[detailForm.status].label}</span><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${PRIORITY_META[detailForm.priority].badgeClass}`}>{PRIORITY_META[detailForm.priority].label}</span><span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">Creada: {formatDate(selectedTask?.createdAt, 'Sin fecha')}</span><span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">Actualizada: {formatDate(selectedTask?.updatedAt, 'Sin fecha')}</span></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Responsables</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-[220px_1fr]"><div className="grid gap-2"><Label>Asignar colaborador</Label><Input value={detailAssigneeSearch} onChange={(event) => setDetailAssigneeSearch(event.target.value)} placeholder="Correo o nombre" disabled={!canEditTasks} /></div><div className="grid gap-3"><div className="flex flex-wrap gap-2">{detailForm.assignedToUserIds.map((userId) => { const user = users.find((item) => item.id === userId); return <button key={userId} type="button" onClick={() => setDetailForm((current) => ({ ...current, assignedToUserIds: current.assignedToUserIds.filter((item) => item !== userId) }))} className="rounded-full bg-sky-100 px-3 py-1.5 text-sm text-sky-800" disabled={!canEditTasks}>{user?.name || user?.email || userId} ×</button> })}{!detailForm.assignedToUserIds.length ? <span className="text-sm text-slate-400">Sin colaboradores asignados</span> : null}</div><div className="max-h-36 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">{detailAssigneeCandidates.map((user) => { const selected = detailForm.assignedToUserIds.includes(user.id); return <button key={user.id} type="button" onClick={() => setDetailForm((current) => ({ ...current, assignedToUserIds: selected ? current.assignedToUserIds.filter((item) => item !== user.id) : [...current.assignedToUserIds, user.id] }))} className={selected ? 'flex w-full items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left'} disabled={!canEditTasks}><span>{user.name || user.email || user.id}</span><span className="text-xs text-slate-500">{selected ? 'Asignado' : 'Agregar'}</span></button> })}</div></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Adjuntos de la tarea</CardTitle><CardDescription>Sube imágenes, audios, videos o documentos que sirvan como evidencia o referencia directa de la tarea.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-center gap-3"><Button variant="outline" onClick={() => attachmentInputRef.current?.click()} disabled={!canEditTasks || uploadingAttachment}>{uploadingAttachment ? 'Subiendo...' : 'Agregar adjunto'}</Button><Button variant="outline" onClick={() => setLibraryPickerOpen(true)} disabled={!canEditTasks}>Elegir desde biblioteca</Button><span className="text-sm text-slate-500">{detailForm.attachmentsJson.length} archivo(s) vinculados</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{detailForm.attachmentsJson.map((attachment) => <div key={attachment.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium text-slate-950 line-clamp-1">{attachment.name}</p><p className="mt-1 text-xs text-slate-500">{attachment.type.toUpperCase()} · {formatAttachmentSize(attachment.sizeBytes)}</p></div>{canEditTasks ? <Button variant="outline" className="h-8 rounded-lg px-2" onClick={() => setDetailForm((current) => ({ ...current, attachmentsJson: current.attachmentsJson.filter((item) => item.id !== attachment.id) }))}>Quitar</Button> : null}</div><div className="mt-3 rounded-xl border border-slate-200 bg-white p-2">{attachment.type === 'image' ? <div className="relative h-40 w-full overflow-hidden rounded-lg"><Image src={attachment.url} alt={attachment.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" unoptimized /></div> : null}{attachment.type === 'audio' ? <audio src={attachment.url} controls className="w-full" /> : null}{attachment.type === 'video' ? <video src={attachment.url} controls className="h-40 w-full rounded-lg bg-black object-cover" /> : null}{attachment.type === 'document' ? <div className="flex h-40 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-600">Documento disponible</div> : null}</div><a href={attachment.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:text-sky-900">Abrir archivo</a></div>)}{!detailForm.attachmentsJson.length ? <p className="text-sm text-slate-400">No hay adjuntos todavía.</p> : null}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Campos personalizados</CardTitle><CardDescription>Agrega campos de texto o de archivo y luego edítalos o elimínalos individualmente.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 md:grid-cols-[1fr_160px_1fr_140px] md:items-end"><div className="grid gap-2"><Label>Etiqueta</Label><Input value={customFieldDraft.label} onChange={(event) => setCustomFieldDraft((current) => ({ ...current, label: event.target.value }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Tipo</Label><Select value={customFieldDraft.type} onValueChange={(value) => setCustomFieldDraft((current) => ({ ...current, type: value as TaskCustomFieldType, textValue: '', file: null }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TEXT">Texto</SelectItem><SelectItem value="FILE">Archivo</SelectItem></SelectContent></Select></div>{customFieldDraft.type === 'TEXT' ? <div className="grid gap-2"><Label>Valor</Label><Input value={customFieldDraft.textValue} onChange={(event) => setCustomFieldDraft((current) => ({ ...current, textValue: event.target.value }))} disabled={!canEditTasks} /></div> : <div className="grid gap-2"><Label>Archivo</Label><Button variant="outline" onClick={() => { setCustomFieldUploadTarget('new'); customFieldFileInputRef.current?.click() }} disabled={!canEditTasks || uploadingAttachment}>{customFieldDraft.file ? 'Reemplazar archivo' : uploadingAttachment ? 'Subiendo...' : 'Subir archivo'}</Button>{customFieldDraft.file ? <p className="text-xs text-slate-500">{customFieldDraft.file.name}</p> : null}</div>}<Button onClick={handleAddCustomField} disabled={!canEditTasks}>Agregar campo</Button></div><div className="space-y-3">{detailForm.customFieldsJson.map((field) => <div key={field.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="grid gap-3 lg:grid-cols-[1fr_160px_1fr_110px] lg:items-start"><div className="grid gap-2"><Label>Etiqueta</Label><Input value={field.label} onChange={(event) => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item) }))} disabled={!canEditTasks} /></div><div className="grid gap-2"><Label>Tipo</Label><Select value={field.type} onValueChange={(value) => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, type: value as TaskCustomFieldType, textValue: value === 'TEXT' ? item.textValue || '' : null, file: value === 'FILE' ? item.file || null : null } : item) }))} disabled={!canEditTasks}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TEXT">Texto</SelectItem><SelectItem value="FILE">Archivo</SelectItem></SelectContent></Select></div>{field.type === 'TEXT' ? <div className="grid gap-2"><Label>Contenido</Label><Input value={field.textValue || ''} onChange={(event) => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, textValue: event.target.value } : item) }))} disabled={!canEditTasks} /></div> : <div className="grid gap-2"><Label>Archivo</Label><div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => { setCustomFieldUploadTarget(field.id); customFieldFileInputRef.current?.click() }} disabled={!canEditTasks || uploadingAttachment}>{field.file ? 'Reemplazar' : 'Subir'}</Button>{field.file ? <Button variant="outline" onClick={() => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.map((item) => item.id === field.id ? { ...item, file: null } : item) }))} disabled={!canEditTasks}>Quitar archivo</Button> : null}</div>{field.file ? <a href={field.file.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-700">{field.file.name}</a> : <span className="text-sm text-slate-400">Sin archivo</span>}</div>}<div className="pt-6 lg:pt-7"><Button variant="outline" onClick={() => setDetailForm((current) => ({ ...current, customFieldsJson: current.customFieldsJson.filter((item) => item.id !== field.id) }))} disabled={!canEditTasks}>Quitar</Button></div></div></div>)}{!detailForm.customFieldsJson.length ? <p className="text-sm text-slate-400">No hay campos personalizados todavía.</p> : null}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Historial de cambios</CardTitle></CardHeader><CardContent className="space-y-3">{selectedTask?.history.length ? selectedTask.history.map((entry) => <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600"><div className="flex items-center justify-between gap-3"><p className="font-medium text-slate-900">{entry.message}</p><span className="text-xs text-slate-500">{formatDate(entry.createdAt, 'Sin fecha')}</span></div><p className="mt-1 text-xs text-slate-500">{entry.actorUser?.name || entry.actorUser?.email || 'Sistema'} · {entry.type}</p></div>) : <p className="text-sm text-muted-foreground">Sin historial todavía.</p>}</CardContent></Card><Card><CardContent className="grid gap-4 p-4 md:grid-cols-[160px_1fr_140px] md:items-start"><Label className="pt-2">Crear nota</Label><Textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Contenido de la nota" rows={3} disabled={!canEditTasks} /><Button onClick={() => void handleAddNote()} disabled={savingNote || !canEditTasks}>{savingNote ? 'Guardando...' : 'Crear nota'}</Button><div className="md:col-span-3 space-y-2">{noteEntries.length ? noteEntries.map((entry) => <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600"><p className="font-medium text-slate-900">{entry.message}</p><p className="mt-1 text-xs text-slate-500">{entry.actorUser?.name || entry.actorUser?.email || 'Sistema'} · {formatDate(entry.createdAt, 'Sin fecha')}</p></div>) : <p className="text-sm text-muted-foreground">No hay notas.</p>}</div></CardContent></Card><Card><CardContent className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium text-slate-900">Archivo</p><p className="text-sm text-slate-500">Puedes archivar la tarea sin perder historial, adjuntos ni responsables.</p></div><Button variant="outline" onClick={() => setDetailForm((current) => ({ ...current, archived: !current.archived }))} disabled={!canEditTasks}>{detailForm.archived ? 'Quitar de archivo' : 'Archivar tarea'}</Button></CardContent></Card></div><DialogFooter><Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Cerrar</Button><Button onClick={() => void handleSaveDetail()} disabled={savingDetail || !canEditTasks}>{savingDetail ? 'Guardando...' : 'Guardar cambios'}</Button></DialogFooter></DialogContent></Dialog>
      <CrmFileLibraryPicker open={libraryPickerOpen} onOpenChange={setLibraryPickerOpen} onPick={handleLibraryAttachment} title="Seleccionar archivo del repositorio CRM" allowFolders={false} />
    </div>
  )
}
