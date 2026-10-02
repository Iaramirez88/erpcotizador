import type {
  HelpTicketActivityType,
  HelpTicketChannel,
  HelpTicketPriority,
  HelpTicketStatus,
  HelpTicketType,
  Prisma,
} from '@prisma/client'

export const HELP_TICKET_STATUSES: HelpTicketStatus[] = [
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
  'CANCELED',
]

export const HELP_TICKET_PRIORITIES: HelpTicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
export const HELP_TICKET_TYPES: HelpTicketType[] = ['CUSTOMER', 'INTERNAL', 'TECHNICAL_SUPPORT', 'INCIDENT', 'REQUEST', 'QUESTION', 'IMPROVEMENT']
export const HELP_TICKET_CHANNELS: HelpTicketChannel[] = ['WEB_PANEL', 'ADMIN', 'EMAIL', 'WHATSAPP', 'INTERNAL']

export const helpTicketListInclude = {
  requester: { select: { id: true, name: true, email: true, image: true } },
  assignedTo: { select: { id: true, name: true, email: true, image: true } },
  cliente: { select: { id: true, nombre: true, documento: true } },
  _count: { select: { messages: true, activities: true } },
} satisfies Prisma.HelpTicketInclude

export const helpTicketDetailInclude = {
  ...helpTicketListInclude,
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, name: true, email: true, image: true } } },
  },
  activities: {
    orderBy: { createdAt: 'asc' as const },
    include: { actor: { select: { id: true, name: true, email: true, image: true } } },
  },
} satisfies Prisma.HelpTicketInclude

export function normalizeText(value: unknown, maxLength = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function parseHelpTicketStatus(value: unknown): HelpTicketStatus | null {
  return typeof value === 'string' && HELP_TICKET_STATUSES.includes(value as HelpTicketStatus)
    ? value as HelpTicketStatus
    : null
}

export function parseHelpTicketPriority(value: unknown): HelpTicketPriority | null {
  return typeof value === 'string' && HELP_TICKET_PRIORITIES.includes(value as HelpTicketPriority)
    ? value as HelpTicketPriority
    : null
}

export function parseHelpTicketType(value: unknown): HelpTicketType | null {
  return typeof value === 'string' && HELP_TICKET_TYPES.includes(value as HelpTicketType)
    ? value as HelpTicketType
    : null
}

export function parseHelpTicketChannel(value: unknown): HelpTicketChannel | null {
  return typeof value === 'string' && HELP_TICKET_CHANNELS.includes(value as HelpTicketChannel)
    ? value as HelpTicketChannel
    : null
}

export function isHelpTicketManager(access: { membershipRole: string | null; isSystemSuperAdmin: boolean }) {
  return access.isSystemSuperAdmin || access.membershipRole === 'ADMIN' || access.membershipRole === 'MANAGER'
}

export function canManageHelpTicket(
  access: { userId: string; membershipRole: string | null; isSystemSuperAdmin: boolean },
  ticket: { assignedToId: string | null }
) {
  return isHelpTicketManager(access) || ticket.assignedToId === access.userId
}

export function canAccessHelpTicket(
  access: { userId: string; empresaId: string; sedeId: string; membershipRole: string | null; isSystemSuperAdmin: boolean },
  ticket: { empresaId: string; sedeId: string; requesterId: string; assignedToId: string | null }
) {
  if (ticket.empresaId !== access.empresaId || ticket.sedeId !== access.sedeId) return false
  return isHelpTicketManager(access) || ticket.requesterId === access.userId || ticket.assignedToId === access.userId
}

export function activityTypeForStatus(status: HelpTicketStatus): HelpTicketActivityType {
  if (status === 'ESCALATED') return 'ESCALATED'
  if (status === 'RESOLVED') return 'RESOLVED'
  if (status === 'CLOSED') return 'CLOSED'
  return 'STATUS_CHANGED'
}

export function normalizeHelpTicketAttachments(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const record = item as Record<string, unknown>
    const name = normalizeText(record.name, 180)
    const url = normalizeText(record.url, 1500)
    if (!name || !url || (!url.startsWith('/uploads/') && !/^https?:\/\//i.test(url))) return []
    return [{
      name,
      url,
      type: record.type === 'image' ? 'image' : 'document',
      mimeType: normalizeText(record.mimeType, 120) || null,
      sizeBytes: typeof record.sizeBytes === 'number' ? record.sizeBytes : null,
    }]
  })
}
