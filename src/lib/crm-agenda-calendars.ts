import type { Prisma, PrismaClient } from '@prisma/client'

export type CrmAgendaCalendarKind = 'GENERAL' | 'TASKS' | 'PROSPECT_MEETINGS' | 'PROJECTS' | 'CUSTOM'
export type CrmAgendaCalendarVisibility = 'TEAM' | 'PRIVATE'
export type CrmAgendaCalendarRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export type AgendaCalendarKindMeta = {
  value: CrmAgendaCalendarKind
  label: string
  description: string
  colorHex: string
}

export const CRM_AGENDA_CALENDAR_KINDS: AgendaCalendarKindMeta[] = [
  {
    value: 'PROSPECT_MEETINGS',
    label: 'Reuniones con prospectos',
    description: 'Citas y reuniones comerciales con leads del CRM.',
    colorHex: '#0ea5e9',
  },
  {
    value: 'PROJECTS',
    label: 'Proyectos',
    description: 'Hitos, entregas y seguimiento de proyectos.',
    colorHex: '#8b5cf6',
  },
  {
    value: 'TASKS',
    label: 'Tareas operativas',
    description: 'Pendientes internos del equipo, sin cliente asociado.',
    colorHex: '#f59e0b',
  },
  {
    value: 'GENERAL',
    label: 'Agenda general',
    description: 'Citas y tareas de todo el equipo comercial.',
    colorHex: '#10b981',
  },
  {
    value: 'CUSTOM',
    label: 'Calendario personalizado',
    description: 'Define tu propio uso y compártelo con quien necesites.',
    colorHex: '#64748b',
  },
]

export const CRM_AGENDA_CALENDAR_COLORS = [
  '#0ea5e9',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#14b8a6',
  '#64748b',
  '#0f172a',
] as const

const DEFAULT_CALENDAR_COLOR = '#0ea5e9'
const CALENDAR_COLOR_PATTERN = /^#([0-9a-f]{6})$/i

type DbClient = PrismaClient | Prisma.TransactionClient

type CalendarAccessShape = {
  ownerUserId: string | null
  createdById: string
  visibility: string
  members: Array<{ userId: string; role: string }>
}

export function parseAgendaCalendarKind(value: unknown): CrmAgendaCalendarKind {
  if (typeof value !== 'string') return 'GENERAL'
  const normalized = value.trim().toUpperCase()
  const found = CRM_AGENDA_CALENDAR_KINDS.find((kind) => kind.value === normalized)
  return found ? found.value : 'GENERAL'
}

export function parseAgendaCalendarVisibility(value: unknown): CrmAgendaCalendarVisibility {
  return typeof value === 'string' && value.trim().toUpperCase() === 'PRIVATE' ? 'PRIVATE' : 'TEAM'
}

export function normalizeAgendaCalendarColor(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CALENDAR_COLOR
  const trimmed = value.trim()
  return CALENDAR_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : DEFAULT_CALENDAR_COLOR
}

export function getAgendaCalendarKindMeta(kind: string): AgendaCalendarKindMeta {
  return CRM_AGENDA_CALENDAR_KINDS.find((item) => item.value === kind) ?? CRM_AGENDA_CALENDAR_KINDS[3]
}

export function isAgendaCalendarVisibleForUser(calendar: CalendarAccessShape, userId: string): boolean {
  if (calendar.visibility !== 'PRIVATE') return true
  if (calendar.ownerUserId === userId || calendar.createdById === userId) return true
  return calendar.members.some((member) => member.userId === userId)
}

export function getAgendaCalendarRole(calendar: CalendarAccessShape, userId: string): CrmAgendaCalendarRole | null {
  if (calendar.ownerUserId === userId || calendar.createdById === userId) return 'OWNER'
  const member = calendar.members.find((item) => item.userId === userId)
  if (!member) return null
  if (member.role === 'OWNER' || member.role === 'EDITOR' || member.role === 'VIEWER') return member.role
  return 'VIEWER'
}

export function canManageAgendaCalendar(calendar: CalendarAccessShape, userId: string): boolean {
  const role = getAgendaCalendarRole(calendar, userId)
  return role === 'OWNER' || role === 'EDITOR'
}

export function canCreateInAgendaCalendar(calendar: CalendarAccessShape, userId: string): boolean {
  if (calendar.visibility !== 'PRIVATE') return true
  return Boolean(getAgendaCalendarRole(calendar, userId))
}

export const agendaCalendarInclude = {
  members: {
    orderBy: [{ role: 'asc' as const }, { createdAt: 'asc' as const }],
    select: {
      id: true,
      userId: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  },
  _count: { select: { tasks: true } },
} satisfies Prisma.CrmAgendaCalendarInclude

export async function getAccessibleAgendaCalendarIds(client: DbClient, args: { empresaId: string; userId: string }) {
  const rows = await client.crmAgendaCalendar.findMany({
    where: {
      empresaId: args.empresaId,
      archivedAt: null,
      OR: [
        { visibility: 'TEAM' },
        { ownerUserId: args.userId },
        { createdById: args.userId },
        { members: { some: { userId: args.userId } } },
      ],
    },
    select: { id: true },
  })

  return rows.map((row) => row.id)
}

export async function getAccessibleAgendaCalendars(client: DbClient, args: { empresaId: string; userId: string }) {
  const rows = await client.crmAgendaCalendar.findMany({
    where: {
      empresaId: args.empresaId,
      archivedAt: null,
      OR: [
        { visibility: 'TEAM' },
        { ownerUserId: args.userId },
        { createdById: args.userId },
        { members: { some: { userId: args.userId } } },
      ],
    },
    orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    include: agendaCalendarInclude,
  })

  return rows.map((calendar) => ({
    ...calendar,
    canManage: canManageAgendaCalendar(calendar, args.userId),
    role: getAgendaCalendarRole(calendar, args.userId),
  }))
}

export async function getAccessibleAgendaCalendar(
  client: DbClient,
  args: { calendarId: string; empresaId: string; userId: string },
) {
  const calendar = await client.crmAgendaCalendar.findFirst({
    where: {
      id: args.calendarId,
      empresaId: args.empresaId,
      archivedAt: null,
      OR: [
        { visibility: 'TEAM' },
        { ownerUserId: args.userId },
        { createdById: args.userId },
        { members: { some: { userId: args.userId } } },
      ],
    },
    include: agendaCalendarInclude,
  })

  return calendar
}

export function normalizeAgendaCalendarName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, 80)
}

export function normalizeAgendaCalendarDescription(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 300)
}

export function normalizeAgendaCalendarMemberIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const unique = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (trimmed) unique.add(trimmed)
  }
  return Array.from(unique)
}
