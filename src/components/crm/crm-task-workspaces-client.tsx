"use client"

import { useEffect, useMemo, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type WorkspaceScope = 'SEDE' | 'USER'
type WorkspaceRole = 'VIEWER' | 'EDITOR' | 'MANAGER'
type TaskStatus = 'OPEN' | 'DONE' | 'CANCELED'
type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH'
type TaskHistoryType = 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'DUE_DATE_CHANGED' | 'ASSIGNEES_CHANGED' | 'NOTE_ADDED' | 'ARCHIVED' | 'RESTORED'

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

type TaskItem = {
  id: string
  title: string
  description?: string | null
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
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

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
  if (status === 'OPEN') return 'No iniciado'
  if (status === 'DONE') return 'Finalizada'
  return 'Cancelada'
}

function formatRole(role: WorkspaceRole | null | undefined) {
  if (role === 'MANAGER') return 'Manager'
  if (role === 'EDITOR') return 'Editor'
  if (role === 'VIEWER') return 'Viewer'
  return 'Sin rol'
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const response = await fetch(url, init)
  return (await response.json().catch(() => ({}))) as JsonResponse<T>
}

export function CrmTaskWorkspacesClient() {
  const [loading, setLoading] = useState(true)
  const [savingWorkspace, setSavingWorkspace] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [savingDetail, setSavingDetail] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false)
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
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
  const [workspaceForm, setWorkspaceForm] = useState({
    name: '',
    description: '',
    scope: 'SEDE' as WorkspaceScope,
    sedeId: '',
    ownerUserId: '',
    memberUserIds: [] as string[],
  })
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueAt: '',
    priority: 'NORMAL' as TaskPriority,
    assignedToUserIds: [] as string[],
  })
  const [detailForm, setDetailForm] = useState({
    id: '',
    title: '',
    description: '',
    dueAt: '',
    priority: 'NORMAL' as TaskPriority,
    status: 'OPEN' as TaskStatus,
    assignedToUserIds: [] as string[],
    archived: false,
  })
  const [workspaceSettingsForm, setWorkspaceSettingsForm] = useState({
    id: '',
    name: '',
    description: '',
    ownerUserId: '',
    members: [] as Array<{ userId: string; role: WorkspaceRole }>,
  })

  const selectedWorkspace = useMemo(() => {
    return workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
  }, [selectedWorkspaceId, workspaces])

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

  async function loadTasks(workspaceId = selectedWorkspaceId) {
    if (!workspaceId) {
      setTasks([])
      return
    }
    const query = new URLSearchParams({ workspaceId, includeArchived: String(showArchived) })
    const taskRes = await requestJson<TaskItem[]>(`/api/crm/tasks?${query.toString()}`)
    setTasks(Array.isArray(taskRes.data) ? taskRes.data : [])
  }

  async function loadTaskDetail(taskId: string) {
    const detailRes = await requestJson<TaskItem>(`/api/crm/tasks/${taskId}`)
    const row = detailRes.success && detailRes.data ? detailRes.data : null
    setSelectedTask(row)
    if (row) {
      setDetailForm({
        id: row.id,
        title: row.title,
        description: row.description || '',
        dueAt: row.dueAt ? new Date(row.dueAt).toISOString().slice(0, 16) : '',
        priority: row.priority,
        status: row.status,
        assignedToUserIds: row.assignments.map((assignment) => assignment.userId),
        archived: Boolean(row.archivedAt),
      })
      setDetailDialogOpen(true)
    }
  }

  useEffect(() => {
    void loadBase()
  }, [])

  useEffect(() => {
    void loadTasks(selectedWorkspaceId)
  }, [selectedWorkspaceId, showArchived])

  useEffect(() => {
    if (!selectedWorkspace) return
    setWorkspaceSettingsForm({
      id: selectedWorkspace.id,
      name: selectedWorkspace.name,
      description: selectedWorkspace.description || '',
      ownerUserId: selectedWorkspace.ownerUser?.id || '',
      members: selectedWorkspace.members.map((member) => ({ userId: member.userId, role: member.role })),
    })
  }, [selectedWorkspace])

  const filteredTasks = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tasks
    return tasks.filter((task) => {
      const haystack = [
        task.title,
        task.description,
        task.createdBy?.name,
        task.workspace?.name,
        task.lead?.nombre,
        task.opportunity?.title,
        task.cliente?.nombre,
        ...task.assignments.map((assignment) => assignment.user.name || assignment.user.email || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [search, tasks])

  const workspaceCandidates = useMemo(() => {
    const term = workspaceSearch.trim().toLowerCase()
    return users.filter((user) => {
      if (!term) return true
      return (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term)
    })
  }, [users, workspaceSearch])

  const workspaceMemberCandidates = useMemo(() => {
    const term = workspaceMemberSearch.trim().toLowerCase()
    const selectedIds = new Set(workspaceSettingsForm.members.map((member) => member.userId))
    return users.filter((user) => {
      if (selectedIds.has(user.id)) return false
      if (!term) return true
      return (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term)
    })
  }, [users, workspaceMemberSearch, workspaceSettingsForm.members])

  const taskAssigneeCandidates = useMemo(() => {
    const term = assigneeSearch.trim().toLowerCase()
    return users.filter((user) => {
      if (!term) return true
      return (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term)
    })
  }, [users, assigneeSearch])

  const detailAssigneeCandidates = useMemo(() => {
    const term = detailAssigneeSearch.trim().toLowerCase()
    return users.filter((user) => {
      if (!term) return true
      return (user.name || '').toLowerCase().includes(term) || (user.email || '').toLowerCase().includes(term)
    })
  }, [users, detailAssigneeSearch])

  const noteEntries = useMemo(() => {
    return selectedTask?.history.filter((entry) => entry.type === 'NOTE_ADDED') ?? []
  }, [selectedTask])

  function openWorkspaceSettings() {
    if (!selectedWorkspace) return
    setWorkspaceSettingsForm({
      id: selectedWorkspace.id,
      name: selectedWorkspace.name,
      description: selectedWorkspace.description || '',
      ownerUserId: selectedWorkspace.ownerUser?.id || '',
      members: selectedWorkspace.members.map((member) => ({ userId: member.userId, role: member.role })),
    })
    setWorkspaceSettingsOpen(true)
  }

  async function handleCreateWorkspace() {
    if (!workspaceForm.name.trim()) {
      alert('El nombre del espacio es requerido.')
      return
    }
    if (workspaceForm.scope === 'SEDE' && !workspaceForm.sedeId) {
      alert('Selecciona una sede para el espacio de trabajo.')
      return
    }
    if (workspaceForm.scope === 'USER' && !workspaceForm.ownerUserId) {
      alert('Selecciona un usuario responsable del espacio.')
      return
    }

    setSavingWorkspace(true)
    try {
      const json = await requestJson<Workspace>('/api/crm/task-workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workspaceForm),
      })
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo crear el espacio de trabajo.')
        return
      }
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
    if (!canManageWorkspace) {
      alert('Solo un manager puede administrar miembros y roles.')
      return
    }
    if (!workspaceSettingsForm.name.trim()) {
      alert('El nombre del espacio es requerido.')
      return
    }

    setSavingWorkspace(true)
    try {
      const json = await requestJson<Workspace>(`/api/crm/task-workspaces/${workspaceSettingsForm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workspaceSettingsForm.name,
          description: workspaceSettingsForm.description,
          ownerUserId: workspaceSettingsForm.ownerUserId || null,
          members: workspaceSettingsForm.members,
        }),
      })
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo actualizar el espacio.')
        return
      }
      setWorkspaceSettingsOpen(false)
      await loadBase()
      setSelectedWorkspaceId(json.data.id)
    } finally {
      setSavingWorkspace(false)
    }
  }

  async function handleCreateTask() {
    if (!selectedWorkspaceId) {
      alert('Selecciona primero un espacio de trabajo.')
      return
    }
    if (!canEditTasks) {
      alert('Tu rol actual en este espacio es solo de lectura.')
      return
    }
    if (!taskForm.title.trim()) {
      alert('El título de la tarea es requerido.')
      return
    }

    setSavingTask(true)
    try {
      const json = await requestJson<TaskItem>('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          title: taskForm.title,
          description: taskForm.description,
          dueAt: taskForm.dueAt || null,
          priority: taskForm.priority,
          assignedToUserIds: taskForm.assignedToUserIds,
        }),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo crear la tarea.')
        return
      }
      setTaskDialogOpen(false)
      setTaskForm({ title: '', description: '', dueAt: '', priority: 'NORMAL', assignedToUserIds: [] })
      await loadTasks(selectedWorkspaceId)
    } finally {
      setSavingTask(false)
    }
  }

  async function handleUpdateTask(taskId: string, patch: Record<string, unknown>) {
    const json = await requestJson<TaskItem>(`/api/crm/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!json.success) {
      alert(json.error || 'No se pudo actualizar la tarea.')
      return false
    }
    await loadTasks(selectedWorkspaceId)
    if (detailDialogOpen) {
      await loadTaskDetail(taskId)
    }
    return true
  }

  async function handleSaveDetail() {
    if (!detailForm.id) return
    if (!canEditTasks) {
      alert('Tu rol actual en este espacio es solo de lectura.')
      return
    }
    setSavingDetail(true)
    try {
      await handleUpdateTask(detailForm.id, {
        title: detailForm.title,
        description: detailForm.description,
        dueAt: detailForm.dueAt || null,
        priority: detailForm.priority,
        status: detailForm.status,
        assignedToUserIds: detailForm.assignedToUserIds,
        archived: detailForm.archived,
      })
    } finally {
      setSavingDetail(false)
    }
  }

  async function handleAddNote() {
    if (!selectedTask || !noteDraft.trim()) {
      alert('Escribe una nota para registrar en el historial.')
      return
    }
    if (!canEditTasks) {
      alert('Tu rol actual en este espacio es solo de lectura.')
      return
    }
    setSavingNote(true)
    try {
      const json = await requestJson<TaskItem>(`/api/crm/tasks/${selectedTask.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteDraft }),
      })
      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo agregar la nota.')
        return
      }
      setSelectedTask(json.data)
      setNoteDraft('')
      await loadTasks(selectedWorkspaceId)
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Espacios de trabajo' },
        ]}
        eyebrow="Operación colaborativa"
        title="Espacios de trabajo y seguimiento interno"
        description="Administra espacios transversales del ERP, organiza tareas colaborativas y conecta el seguimiento sin convertir una orden de trabajo en el mismo objeto."
        actions={
          <>
            <Button variant="outline" className="rounded-2xl border-slate-200 bg-white/85" onClick={() => setWorkspaceDialogOpen(true)}>
              Nuevo espacio
            </Button>
            <Button className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => setTaskDialogOpen(true)} disabled={!selectedWorkspaceId || !canEditTasks}>
              Nueva tarea
            </Button>
          </>
        }
        stats={[
          { label: 'Espacios', value: workspaces.length, hint: 'Contextos colaborativos visibles', tone: 'sky' },
          { label: 'Tareas visibles', value: filteredTasks.length, hint: showArchived ? 'Incluye archivadas' : 'Solo activas', tone: 'teal' },
          { label: 'Pendientes', value: filteredTasks.filter((task) => task.status === 'OPEN' && !task.archivedAt).length, hint: 'Sin cerrar', tone: 'amber' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardTitle className="text-xl">Espacios de trabajo</CardTitle>
            <CardDescription>Selecciona un espacio para ver tareas, miembros y permisos efectivos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-5">
            {loading ? <p className="text-sm text-muted-foreground">Cargando espacios...</p> : null}
            {!loading && workspaces.length === 0 ? <p className="text-sm text-muted-foreground">No tienes espacios de trabajo todavía.</p> : null}
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                onClick={() => setSelectedWorkspaceId(workspace.id)}
                className={selectedWorkspaceId === workspace.id ? 'w-full rounded-3xl border border-sky-300 bg-sky-50/80 p-4 text-left shadow-sm' : 'w-full rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,_#ffffff,_#fbfdff)] p-4 text-left shadow-sm transition-shadow hover:shadow-md'}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{workspace.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{workspace.description || (workspace.scope === 'SEDE' ? workspace.sede?.nombre || 'Espacio por sede' : workspace.ownerUser?.name || workspace.ownerUser?.email || 'Espacio por usuario')}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{workspace.scope}</span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">{formatRole(workspace.currentUserRole)}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{workspace._count?.tasks ?? 0} tareas</span>
                  <span>{workspace._count?.members ?? workspace.members.length} miembros</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-xl">Tareas del espacio</CardTitle>
                <CardDescription>
                  {selectedWorkspace
                    ? `${selectedWorkspace.name} · ${formatRole(selectedWorkspace.currentUserRole)}${selectedWorkspace.permissions?.canEditTasks ? ' con edición de tareas' : ' solo lectura'}`
                    : 'Tabla operativa con responsables, estado, archivo y acceso a detalle completo.'}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManageWorkspace ? <Button variant="outline" className="rounded-xl" onClick={openWorkspaceSettings}>Miembros y roles</Button> : null}
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por tarea, responsable o descripción..." className="w-[280px] rounded-xl" />
                <Button variant="outline" className="rounded-xl" onClick={() => setShowArchived((current) => !current)}>
                  {showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[1.2fr_1.3fr_1fr_1fr_1fr_1.1fr_0.8fr] gap-4 border-b border-slate-100 px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>Tarea</span>
                  <span>Descripción</span>
                  <span>Responsables</span>
                  <span>Estado</span>
                  <span>Fecha</span>
                  <span>Acciones</span>
                  <span>Archivar</span>
                </div>
                {filteredTasks.map((task) => (
                  <div key={task.id} className="grid grid-cols-[1.2fr_1.3fr_1fr_1fr_1fr_1.1fr_0.8fr] gap-4 border-b border-slate-100 px-6 py-4 text-sm text-slate-700">
                    <div>
                      <p className="font-semibold text-slate-950">{task.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{task.workspace?.name || 'Sin espacio'}</p>
                    </div>
                    <p className="truncate">{task.description || 'Sin descripción'}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {task.assignments.length === 0 ? <span className="text-xs text-slate-400">Sin responsables</span> : null}
                      {task.assignments.map((assignment) => (
                        <span key={assignment.id} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800" title={assignment.user.name || assignment.user.email || assignment.user.id}>
                          {initials(assignment.user.name, assignment.user.email)}
                        </span>
                      ))}
                    </div>
                    <Select value={task.status} onValueChange={(value) => void handleUpdateTask(task.id, { status: value })} disabled={!canEditTasks}>
                      <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white"><SelectValue>{formatStatus(task.status)}</SelectValue></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN">No iniciado</SelectItem>
                        <SelectItem value="DONE">Finalizada</SelectItem>
                        <SelectItem value="CANCELED">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>{formatDate(task.dueAt, 'Sin fecha')}</span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => void loadTaskDetail(task.id)}>Ver detalles</Button>
                    </div>
                    <div>
                      <Button variant="outline" className="rounded-xl" onClick={() => void handleUpdateTask(task.id, { archived: !task.archivedAt })} disabled={!canEditTasks}>
                        {task.archivedAt ? 'Restaurar' : 'Archivar'}
                      </Button>
                    </div>
                  </div>
                ))}
                {!filteredTasks.length ? <div className="px-6 py-8 text-sm text-slate-500">No hay tareas para mostrar en este espacio.</div> : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={workspaceSettingsOpen} onOpenChange={setWorkspaceSettingsOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Administrar espacio de trabajo</DialogTitle>
            <DialogDescription>Edita miembros después de creado y aplica roles reales con restricciones operativas.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input value={workspaceSettingsForm.name} onChange={(event) => setWorkspaceSettingsForm((current) => ({ ...current, name: event.target.value }))} disabled={!canManageWorkspace} />
              </div>
              <div className="grid gap-2">
                <Label>Responsable</Label>
                <Select
                  value={workspaceSettingsForm.ownerUserId || '__none__'}
                  onValueChange={(value) => setWorkspaceSettingsForm((current) => ({
                    ...current,
                    ownerUserId: value === '__none__' ? '' : value,
                    members: value !== '__none__' && !current.members.some((item) => item.userId === value)
                      ? [...current.members, { userId: value, role: 'MANAGER' }]
                      : current.members,
                  }))}
                  disabled={!canManageWorkspace}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona un responsable" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin responsable</SelectItem>
                    {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name || user.email || user.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea value={workspaceSettingsForm.description} onChange={(event) => setWorkspaceSettingsForm((current) => ({ ...current, description: event.target.value }))} rows={3} disabled={!canManageWorkspace} />
            </div>
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="grid gap-2">
                <Label>Agregar miembro</Label>
                <Input value={workspaceMemberSearch} onChange={(event) => setWorkspaceMemberSearch(event.target.value)} placeholder="Busca usuarios para invitarlos al espacio..." disabled={!canManageWorkspace} />
                <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                  {workspaceMemberCandidates.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setWorkspaceSettingsForm((current) => ({
                        ...current,
                        members: [...current.members, { userId: user.id, role: 'VIEWER' }],
                      }))}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left"
                      disabled={!canManageWorkspace}
                    >
                      <span>{user.name || user.email || user.id}</span>
                      <span className="text-xs text-slate-500">Agregar</span>
                    </button>
                  ))}
                  {!workspaceMemberCandidates.length ? <p className="text-sm text-slate-400">No hay usuarios adicionales con ese filtro.</p> : null}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Miembros y roles</Label>
                <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                  {workspaceSettingsForm.members.map((member) => {
                    const user = users.find((item) => item.id === member.userId)
                    const locked = member.userId === selectedWorkspace?.createdBy?.id || member.userId === workspaceSettingsForm.ownerUserId
                    return (
                      <div key={member.userId} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[1fr_170px_110px] md:items-center">
                        <div>
                          <p className="font-medium text-slate-950">{user?.name || user?.email || member.userId}</p>
                          <p className="text-xs text-slate-500">{locked ? 'Rol protegido por propiedad del espacio' : 'Puedes cambiar el rol o quitar el acceso'}</p>
                        </div>
                        <Select
                          value={member.role}
                          onValueChange={(value) => setWorkspaceSettingsForm((current) => ({
                            ...current,
                            members: current.members.map((item) => item.userId === member.userId ? { ...item, role: value as WorkspaceRole } : item),
                          }))}
                          disabled={!canManageWorkspace || locked}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="VIEWER">Viewer</SelectItem>
                            <SelectItem value="EDITOR">Editor</SelectItem>
                            <SelectItem value="MANAGER">Manager</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => setWorkspaceSettingsForm((current) => ({ ...current, members: current.members.filter((item) => item.userId !== member.userId) }))} disabled={!canManageWorkspace || locked}>
                          Quitar
                        </Button>
                      </div>
                    )
                  })}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600">
                  <p><strong>Viewer:</strong> solo consulta tareas, historial y miembros.</p>
                  <p><strong>Editor:</strong> crea, edita tareas y agrega notas.</p>
                  <p><strong>Manager:</strong> administra miembros, roles y configuración del espacio.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkspaceSettingsOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveWorkspaceSettings()} disabled={savingWorkspace || !canManageWorkspace}>{savingWorkspace ? 'Guardando...' : 'Guardar cambios'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={workspaceDialogOpen} onOpenChange={setWorkspaceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo espacio de trabajo</DialogTitle>
            <DialogDescription>Define si el espacio pertenece a una sede o a un usuario, y luego invita quién puede verlo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={workspaceForm.name} onChange={(event) => setWorkspaceForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea value={workspaceForm.description} onChange={(event) => setWorkspaceForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Tipo de espacio</Label>
                <Select value={workspaceForm.scope} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, scope: value as WorkspaceScope, sedeId: '', ownerUserId: '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEDE">Por sede</SelectItem>
                    <SelectItem value="USER">Por usuario</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {workspaceForm.scope === 'SEDE' ? (
                <div className="grid gap-2">
                  <Label>Sede</Label>
                  <Select value={workspaceForm.sedeId || '__none__'} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, sedeId: value === '__none__' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona una sede" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Selecciona</SelectItem>
                      {sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Usuario responsable</Label>
                  <Select value={workspaceForm.ownerUserId || '__none__'} onValueChange={(value) => setWorkspaceForm((current) => ({ ...current, ownerUserId: value === '__none__' ? '' : value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Selecciona</SelectItem>
                      {users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name || user.email || user.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Invitar usuarios con acceso</Label>
              <Input value={workspaceSearch} onChange={(event) => setWorkspaceSearch(event.target.value)} placeholder="Busca usuarios por nombre o correo..." />
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                {workspaceCandidates.map((user) => {
                  const selected = workspaceForm.memberUserIds.includes(user.id)
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setWorkspaceForm((current) => ({
                        ...current,
                        memberUserIds: selected ? current.memberUserIds.filter((item) => item !== user.id) : [...current.memberUserIds, user.id],
                      }))}
                      className={selected ? 'flex w-full items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left'}
                    >
                      <span>{user.name || user.email || user.id}</span>
                      <span className="text-xs text-slate-500">{selected ? 'Invitado' : 'Agregar'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkspaceDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleCreateWorkspace()} disabled={savingWorkspace}>{savingWorkspace ? 'Guardando...' : 'Crear espacio'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
            <DialogDescription>Crea una tarea dentro del espacio seleccionado y asigna responsables existentes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Textarea value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} rows={4} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Fecha y hora de entrega</Label>
                <Input type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))} />
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
            <div className="grid gap-2">
              <Label>Asignar usuarios</Label>
              <Input value={assigneeSearch} onChange={(event) => setAssigneeSearch(event.target.value)} placeholder="Busca usuarios por nombre o correo..." />
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                {taskAssigneeCandidates.map((user) => {
                  const selected = taskForm.assignedToUserIds.includes(user.id)
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setTaskForm((current) => ({
                        ...current,
                        assignedToUserIds: selected ? current.assignedToUserIds.filter((item) => item !== user.id) : [...current.assignedToUserIds, user.id],
                      }))}
                      className={selected ? 'flex w-full items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left'}
                    >
                      <span>{user.name || user.email || user.id}</span>
                      <span className="text-xs text-slate-500">{selected ? 'Asignado' : 'Asignar'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleCreateTask()} disabled={savingTask || !canEditTasks}>{savingTask ? 'Guardando...' : 'Crear tarea'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailForm.title || 'Detalle de tarea'}</DialogTitle>
            <DialogDescription>Edita la tarea, revisa historial, asigna colaboradores y registra notas sin salir del modal.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Card>
              <CardContent className="grid gap-4 p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Agregada el</p>
                  <p className="mt-1 text-sm text-slate-700">{formatDate(selectedTask?.createdAt, 'Sin fecha')}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Última actualización</p>
                  <p className="mt-1 text-sm text-slate-700">{formatDate(selectedTask?.updatedAt, 'Sin fecha')}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Título</Label>
                    <Input value={detailForm.title} onChange={(event) => setDetailForm((current) => ({ ...current, title: event.target.value }))} disabled={!canEditTasks} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Descripción</Label>
                    <Textarea value={detailForm.description} onChange={(event) => setDetailForm((current) => ({ ...current, description: event.target.value }))} rows={4} disabled={!canEditTasks} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historial de cambios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedTask?.history.length ? selectedTask.history.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{entry.message}</p>
                      <span className="text-xs text-slate-500">{formatDate(entry.createdAt, 'Sin fecha')}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{entry.actorUser?.name || entry.actorUser?.email || 'Sistema'} · {entry.type}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Sin historial todavía.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_220px] md:items-end">
                <div className="grid gap-2">
                  <Label>Fecha y hora de entrega</Label>
                  <Input type="datetime-local" value={detailForm.dueAt} onChange={(event) => setDetailForm((current) => ({ ...current, dueAt: event.target.value }))} disabled={!canEditTasks} />
                </div>
                <Button onClick={() => void handleSaveDetail()} disabled={savingDetail || !canEditTasks}>{savingDetail ? 'Guardando...' : 'Guardar cambios'}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">
                <div className="grid gap-2">
                  <Label>Asignar colaborador</Label>
                  <Input value={detailAssigneeSearch} onChange={(event) => setDetailAssigneeSearch(event.target.value)} placeholder="Correo o nombre" disabled={!canEditTasks} />
                </div>
                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    {detailForm.assignedToUserIds.map((userId) => {
                      const user = users.find((item) => item.id === userId)
                      return (
                        <button key={userId} type="button" onClick={() => setDetailForm((current) => ({ ...current, assignedToUserIds: current.assignedToUserIds.filter((item) => item !== userId) }))} className="rounded-full bg-sky-100 px-3 py-1.5 text-sm text-sky-800" disabled={!canEditTasks}>
                          {user?.name || user?.email || userId} ×
                        </button>
                      )
                    })}
                    {!detailForm.assignedToUserIds.length ? <span className="text-sm text-slate-400">Sin colaboradores asignados</span> : null}
                  </div>
                  <div className="max-h-36 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                    {detailAssigneeCandidates.map((user) => {
                      const selected = detailForm.assignedToUserIds.includes(user.id)
                      return (
                        <button key={user.id} type="button" onClick={() => setDetailForm((current) => ({ ...current, assignedToUserIds: selected ? current.assignedToUserIds.filter((item) => item !== user.id) : [...current.assignedToUserIds, user.id] }))} className={selected ? 'flex w-full items-center justify-between rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-left' : 'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left'} disabled={!canEditTasks}>
                          <span>{user.name || user.email || user.id}</span>
                          <span className="text-xs text-slate-500">{selected ? 'Asignado' : 'Agregar'}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid gap-4 p-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Estado actual</Label>
                  <Select value={detailForm.status} onValueChange={(value) => setDetailForm((current) => ({ ...current, status: value as TaskStatus }))} disabled={!canEditTasks}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">No iniciado</SelectItem>
                      <SelectItem value="DONE">Finalizada</SelectItem>
                      <SelectItem value="CANCELED">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Prioridad</Label>
                  <Select value={detailForm.priority} onValueChange={(value) => setDetailForm((current) => ({ ...current, priority: value as TaskPriority }))} disabled={!canEditTasks}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Baja</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="HIGH">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid gap-4 p-4 md:grid-cols-[160px_1fr_140px] md:items-start">
                <Label className="pt-2">Crear nota</Label>
                <Input value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Contenido de la nota" disabled={!canEditTasks} />
                <Button onClick={() => void handleAddNote()} disabled={savingNote || !canEditTasks}>{savingNote ? 'Guardando...' : 'Crear nota'}</Button>
                <div className="md:col-span-3 space-y-2">
                  {noteEntries.length ? noteEntries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600">
                      <p className="font-medium text-slate-900">{entry.message}</p>
                      <p className="mt-1 text-xs text-slate-500">{entry.actorUser?.name || entry.actorUser?.email || 'Sistema'} · {formatDate(entry.createdAt, 'Sin fecha')}</p>
                    </div>
                  )) : <p className="text-sm text-muted-foreground">No hay notas.</p>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-slate-900">Archivo</p>
                  <p className="text-sm text-slate-500">Puedes archivar la tarea sin perder historial ni responsables.</p>
                </div>
                <Button variant="outline" onClick={() => setDetailForm((current) => ({ ...current, archived: !current.archived }))} disabled={!canEditTasks}>
                  {detailForm.archived ? 'Quitar de archivo' : 'Archivar tarea'}
                </Button>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Cerrar</Button>
            <Button onClick={() => void handleSaveDetail()} disabled={savingDetail || !canEditTasks}>{savingDetail ? 'Guardando...' : 'Guardar cambios'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
