import { decryptChannelSecret, encryptChannelSecret } from '@/lib/crm-channel-secrets'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'

type WebsiteServiceRecord = {
  id: string
  nombre: string
  descripcion: string | null
  websiteUrl: string | null
  domainName: string | null
  hostedAt: string | null
  startedAt: Date | null
  domainExpiresAt: Date | null
  hostingExpiresAt: Date | null
  soldAmount: number
  isPaid: boolean
  isCancelled: boolean
  loginUsername: string | null
  loginPasswordEncrypted: string | null
  contactName: string | null
  contactPhone: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  createdByUser?: { id: string; name: string | null; email: string | null } | null
  updatedByUser?: { id: string; name: string | null; email: string | null } | null
}

function normalizeString(value: string | null | undefined) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

export function encryptWebsiteServicePassword(value: string | null | undefined) {
  const normalized = normalizeString(value)
  return normalized ? encryptChannelSecret(normalized) : null
}

export function decryptWebsiteServicePassword(value: string | null | undefined) {
  return normalizeString(decryptChannelSecret(value))
}

export async function getWebsiteServicesAccessForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, empresaId: true },
  })

  if (!user?.id || !user.empresaId) {
    return {
      canAccess: false,
      canManageAssignments: false,
      isSuperAdmin: false,
      empresaId: null,
    }
  }

  const isSuperAdmin = isSuperAdminEmail(user.email)
  if (isSuperAdmin) {
    return {
      canAccess: true,
      canManageAssignments: true,
      isSuperAdmin: true,
      empresaId: user.empresaId,
    }
  }

  const row = await prisma.websiteServiceModuleAccess.findUnique({
    where: { empresaId_userId: { empresaId: user.empresaId, userId } },
    select: { id: true },
  })

  return {
    canAccess: Boolean(row?.id),
    canManageAssignments: false,
    isSuperAdmin: false,
    empresaId: user.empresaId,
  }
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export function getDaysUntil(date: Date | null | undefined) {
  if (!date) return null
  const current = startOfToday().getTime()
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - current) / (24 * 60 * 60 * 1000))
}

export function getExpiryState(date: Date | null | undefined) {
  const days = getDaysUntil(date)
  if (days == null) return { kind: 'none' as const, days: null }
  if (days < 0) return { kind: 'expired' as const, days }
  if (days <= 30) return { kind: 'warning' as const, days }
  return { kind: 'ok' as const, days }
}

export function serializeWebsiteService(service: WebsiteServiceRecord) {
  return {
    id: service.id,
    nombre: service.nombre,
    descripcion: service.descripcion,
    websiteUrl: service.websiteUrl,
    domainName: service.domainName,
    hostedAt: service.hostedAt,
    startedAt: service.startedAt?.toISOString() ?? null,
    domainExpiresAt: service.domainExpiresAt?.toISOString() ?? null,
    hostingExpiresAt: service.hostingExpiresAt?.toISOString() ?? null,
    soldAmount: service.soldAmount,
    isPaid: service.isPaid,
    isCancelled: service.isCancelled,
    loginUsername: service.loginUsername,
    loginPassword: decryptWebsiteServicePassword(service.loginPasswordEncrypted),
    contactName: service.contactName,
    contactPhone: service.contactPhone,
    notes: service.notes,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
    createdByUser: service.createdByUser
      ? { id: service.createdByUser.id, name: service.createdByUser.name, email: service.createdByUser.email }
      : null,
    updatedByUser: service.updatedByUser
      ? { id: service.updatedByUser.id, name: service.updatedByUser.name, email: service.updatedByUser.email }
      : null,
    domainExpiry: getExpiryState(service.domainExpiresAt),
    hostingExpiry: getExpiryState(service.hostingExpiresAt),
  }
}