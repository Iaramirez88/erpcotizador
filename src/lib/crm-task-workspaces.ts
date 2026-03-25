import { Prisma, type PrismaClient } from '@prisma/client'

type DbClient = PrismaClient | Prisma.TransactionClient
export type WorkspaceMemberRole = 'VIEWER' | 'EDITOR' | 'MANAGER'
export type WorkspaceCapability = 'view' | 'edit' | 'manage'
export type TaskAttachmentType = 'image' | 'audio' | 'video' | 'document'
export type TaskCustomFieldType = 'TEXT' | 'FILE'

export type TaskAttachment = {
  id: string
  name: string
  url: string
  type: TaskAttachmentType
  mimeType: string | null
  sizeBytes: number | null
  uploadedAt: string
}

export type TaskCustomField = {
  id: string
  label: string
  type: TaskCustomFieldType
  textValue: string | null
  file: TaskAttachment | null
}

const TASK_ATTACHMENT_TYPES: TaskAttachmentType[] = ['image', 'audio', 'video', 'document']

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeTaskAttachment(value: unknown, index: number): TaskAttachment | null {
  if (!isRecord(value)) return null
  const name = normalizeString(value.name)
  const url = normalizeString(value.url)
  const rawType = normalizeString(value.type).toLowerCase() as TaskAttachmentType
  if (!name || !url || !TASK_ATTACHMENT_TYPES.includes(rawType)) return null

  const uploadedAtRaw = normalizeString(value.uploadedAt)
  const uploadedAt = uploadedAtRaw && !Number.isNaN(new Date(uploadedAtRaw).getTime()) ? new Date(uploadedAtRaw).toISOString() : new Date().toISOString()
  const sizeBytes = typeof value.sizeBytes === 'number' && Number.isFinite(value.sizeBytes) ? value.sizeBytes : null

  return {
    id: normalizeString(value.id) || `attachment-${index + 1}`,
    name,
    url,
    type: rawType,
    mimeType: normalizeString(value.mimeType) || null,
    sizeBytes,
    uploadedAt,
  }
}

export function normalizeTaskAttachments(value: unknown): TaskAttachment[] {
  if (!Array.isArray(value)) return []
  const attachments = value
    .map((item, index) => normalizeTaskAttachment(item, index))
    .filter((item): item is TaskAttachment => Boolean(item))
  return attachments
}

export function normalizeTaskCustomFields(value: unknown): TaskCustomField[] {
  if (!Array.isArray(value)) return []

  const fields: TaskCustomField[] = []
  value.forEach((item, index) => {
    if (!isRecord(item)) return
    const label = normalizeString(item.label)
    const rawType = normalizeString(item.type).toUpperCase() as TaskCustomFieldType
    if (!label || (rawType !== 'TEXT' && rawType !== 'FILE')) return

    const field: TaskCustomField = {
      id: normalizeString(item.id) || `field-${index + 1}`,
      label,
      type: rawType,
      textValue: rawType === 'TEXT' ? normalizeString(item.textValue || item.value) || null : null,
      file: rawType === 'FILE' ? normalizeTaskAttachment(item.file || item.value, index) : null,
    }

    fields.push(field)
  })

  return fields
}

export function normalizeTaskColorHex(value: unknown): string | null {
  const raw = normalizeString(value)
  if (!raw) return null
  return /^#([0-9a-fA-F]{6})$/.test(raw) ? raw.toUpperCase() : null
}

export const crmTaskWorkspaceInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  ownerUser: { select: { id: true, name: true, email: true } },
  sede: { select: { id: true, nombre: true, codigo: true } },
  members: {
    orderBy: [{ role: 'desc' as const }, { user: { name: 'asc' as const } }],
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  _count: { select: { tasks: true, members: true } },
} satisfies Prisma.CrmTaskWorkspaceInclude

export type CrmTaskWorkspaceWithAccess = Prisma.CrmTaskWorkspaceGetPayload<{
  include: typeof crmTaskWorkspaceInclude
}>

export const crmTaskInclude = {
  workspace: {
    include: crmTaskWorkspaceInclude,
  },
  assignedTo: { select: { id: true, name: true, email: true } },
  assignments: {
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: [{ createdAt: 'asc' as const }],
  },
  createdBy: { select: { id: true, name: true, email: true } },
  lead: { select: { id: true, nombre: true } },
  opportunity: { select: { id: true, title: true, stage: true } },
  cliente: { select: { id: true, nombre: true, documento: true } },
  history: {
    include: {
      actorUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ createdAt: 'desc' as const }],
    take: 60,
  },
} satisfies Prisma.CrmTaskInclude

export async function getAccessibleTaskWorkspaceIds(client: DbClient, args: { empresaId: string; userId: string }) {
  const rows = await client.crmTaskWorkspace.findMany({
    where: {
      empresaId: args.empresaId,
      OR: [
        { createdById: args.userId },
        { ownerUserId: args.userId },
        { members: { some: { userId: args.userId } } },
      ],
    },
    select: { id: true },
  })

  return rows.map((row) => row.id)
}

export async function getAccessibleTaskWorkspace(client: DbClient, args: { workspaceId: string; empresaId: string; userId: string }) {
  return client.crmTaskWorkspace.findFirst({
    where: {
      id: args.workspaceId,
      empresaId: args.empresaId,
      OR: [
        { createdById: args.userId },
        { ownerUserId: args.userId },
        { members: { some: { userId: args.userId } } },
      ],
    },
    include: crmTaskWorkspaceInclude,
  })
}

export function getWorkspaceRoleForUser(workspace: Pick<CrmTaskWorkspaceWithAccess, 'createdById' | 'ownerUserId' | 'members'>, userId: string): WorkspaceMemberRole | null {
  if (workspace.createdById === userId || workspace.ownerUserId === userId) return 'MANAGER'
  const member = workspace.members.find((item) => item.userId === userId)
  return (member?.role as WorkspaceMemberRole | undefined) ?? null
}

export function canUserAccessWorkspace(workspace: Pick<CrmTaskWorkspaceWithAccess, 'createdById' | 'ownerUserId' | 'members'>, userId: string, capability: WorkspaceCapability): boolean {
  const role = getWorkspaceRoleForUser(workspace, userId)
  if (!role) return false
  if (capability === 'view') return true
  if (capability === 'edit') return role === 'EDITOR' || role === 'MANAGER'
  return role === 'MANAGER'
}

export function mapWorkspaceForUser(workspace: CrmTaskWorkspaceWithAccess, userId: string) {
  const currentUserRole = getWorkspaceRoleForUser(workspace, userId)
  return {
    ...workspace,
    currentUserRole,
    permissions: {
      canView: Boolean(currentUserRole),
      canEditTasks: currentUserRole === 'EDITOR' || currentUserRole === 'MANAGER',
      canManage: currentUserRole === 'MANAGER',
    },
  }
}

export async function appendTaskHistory(
  client: DbClient,
  args: {
    empresaId: string
    taskId: string
    actorUserId?: string | null
    type: Prisma.CrmTaskHistoryUncheckedCreateInput['type']
    message: string
    metadata?: Prisma.InputJsonValue
  },
) {
  return client.crmTaskHistory.create({
    data: {
      empresaId: args.empresaId,
      taskId: args.taskId,
      actorUserId: args.actorUserId ?? null,
      type: args.type,
      message: args.message,
      metadata: args.metadata ?? {},
    },
  })
}

export function normalizeUserIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
  return Array.from(new Set(ids))
}