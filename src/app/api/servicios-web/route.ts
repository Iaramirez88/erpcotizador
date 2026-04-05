import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser, encryptWebsiteServicePassword, getDaysUntil, serializeWebsiteService } from '@/lib/website-services'

export const runtime = 'nodejs'

function normalizeString(value: unknown) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

function parseDateField(value: unknown, field: string) {
  const normalized = normalizeString(value)
  if (!normalized) return null
  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Fecha inválida en ${field}.`)
  }
  return parsed
}

function parseAmount(value: unknown) {
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : 0
}

async function requireWebsiteServicesAccess() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 }) }
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Sesión inválida' }, { status: 401 }) }
  }

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess || !access.empresaId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Prohibido' }, { status: 403 }) }
  }

  return { ok: true as const, userId, access }
}

function buildSummary(items: Array<ReturnType<typeof serializeWebsiteService>>) {
  return {
    total: items.length,
    paid: items.filter((item) => item.isPaid).length,
    cancelled: items.filter((item) => item.isCancelled).length,
    domainDueSoon: items.filter((item) => item.domainExpiry.kind === 'warning').length,
    hostingDueSoon: items.filter((item) => item.hostingExpiry.kind === 'warning').length,
    expiredDomains: items.filter((item) => item.domainExpiry.kind === 'expired').length,
    expiredHosting: items.filter((item) => item.hostingExpiry.kind === 'expired').length,
  }
}

function buildAlerts(items: Array<ReturnType<typeof serializeWebsiteService>>) {
  return items
    .flatMap((item) => {
      const alerts: Array<{
        serviceId: string
        serviceName: string
        kind: 'DOMAIN' | 'HOSTING'
        status: 'warning' | 'expired'
        days: number
        dueDate: string
      }> = []

      if (item.domainExpiresAt && (item.domainExpiry.kind === 'warning' || item.domainExpiry.kind === 'expired') && typeof item.domainExpiry.days === 'number') {
        alerts.push({
          serviceId: item.id,
          serviceName: item.nombre,
          kind: 'DOMAIN',
          status: item.domainExpiry.kind,
          days: item.domainExpiry.days,
          dueDate: item.domainExpiresAt,
        })
      }

      if (item.hostingExpiresAt && (item.hostingExpiry.kind === 'warning' || item.hostingExpiry.kind === 'expired') && typeof item.hostingExpiry.days === 'number') {
        alerts.push({
          serviceId: item.id,
          serviceName: item.nombre,
          kind: 'HOSTING',
          status: item.hostingExpiry.kind,
          days: item.hostingExpiry.days,
          dueDate: item.hostingExpiresAt,
        })
      }

      return alerts
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'expired' ? -1 : 1
      return a.days - b.days
    })
}

export async function GET() {
  const guard = await requireWebsiteServicesAccess()
  if (!guard.ok) return guard.response

  const services = await prisma.websiteService.findMany({
    where: { empresaId: guard.access.empresaId },
    orderBy: [{ isCancelled: 'asc' }, { domainExpiresAt: 'asc' }, { hostingExpiresAt: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      websiteUrl: true,
      domainName: true,
      hostedAt: true,
      startedAt: true,
      domainExpiresAt: true,
      hostingExpiresAt: true,
      soldAmount: true,
      isPaid: true,
      isCancelled: true,
      loginUsername: true,
      loginPasswordEncrypted: true,
      contactName: true,
      contactPhone: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      createdByUser: { select: { id: true, name: true, email: true } },
      updatedByUser: { select: { id: true, name: true, email: true } },
    },
  })

  const items = services.map((service) => serializeWebsiteService(service))

  return NextResponse.json({
    ok: true,
    access: {
      canAccess: true,
      canManageAssignments: guard.access.canManageAssignments,
      isSuperAdmin: guard.access.isSuperAdmin,
    },
    summary: buildSummary(items),
    alerts: buildAlerts(items),
    items,
  })
}

export async function POST(req: NextRequest) {
  const guard = await requireWebsiteServicesAccess()
  if (!guard.ok) return guard.response

  try {
    const body = await req.json().catch(() => null)
    const nombre = normalizeString(body?.nombre)
    if (!nombre) {
      return NextResponse.json({ ok: false, error: 'El nombre del servicio es obligatorio.' }, { status: 400 })
    }

    const loginPassword = Object.prototype.hasOwnProperty.call(body ?? {}, 'loginPassword')
      ? encryptWebsiteServicePassword(body?.loginPassword)
      : null

    const created = await prisma.websiteService.create({
      data: {
        empresaId: guard.access.empresaId,
        nombre,
        descripcion: normalizeString(body?.descripcion),
        websiteUrl: normalizeString(body?.websiteUrl),
        domainName: normalizeString(body?.domainName),
        hostedAt: normalizeString(body?.hostedAt),
        startedAt: parseDateField(body?.startedAt, 'fecha de creación'),
        domainExpiresAt: parseDateField(body?.domainExpiresAt, 'vencimiento de dominio'),
        hostingExpiresAt: parseDateField(body?.hostingExpiresAt, 'vencimiento de hosting'),
        soldAmount: parseAmount(body?.soldAmount),
        isPaid: Boolean(body?.isPaid),
        isCancelled: Boolean(body?.isCancelled),
        loginUsername: normalizeString(body?.loginUsername),
        loginPasswordEncrypted: loginPassword,
        contactName: normalizeString(body?.contactName),
        contactPhone: normalizeString(body?.contactPhone),
        notes: normalizeString(body?.notes),
        createdByUserId: guard.userId,
        updatedByUserId: guard.userId,
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        websiteUrl: true,
        domainName: true,
        hostedAt: true,
        startedAt: true,
        domainExpiresAt: true,
        hostingExpiresAt: true,
        soldAmount: true,
        isPaid: true,
        isCancelled: true,
        loginUsername: true,
        loginPasswordEncrypted: true,
        contactName: true,
        contactPhone: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        createdByUser: { select: { id: true, name: true, email: true } },
        updatedByUser: { select: { id: true, name: true, email: true } },
      },
    })

    const alerts = [created.domainExpiresAt, created.hostingExpiresAt].filter(Boolean)
    if (alerts.some((value) => {
      const days = getDaysUntil(value)
      return typeof days === 'number' && days <= 30
    })) {
      await prisma.notification.create({
        data: {
          empresaId: guard.access.empresaId,
          userId: guard.userId,
          type: 'WARNING',
          title: `Servicio web ${created.nombre} con vencimiento cercano`,
          body: 'Revisa dominio y hosting en la vista centralizada de servicios web.',
          actionUrl: '/dashboard/configuracion/servicios-web',
          actionLabel: 'Abrir servicios web',
        },
      }).catch(() => null)
    }

    return NextResponse.json({ ok: true, item: serializeWebsiteService(created) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el servicio web.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}