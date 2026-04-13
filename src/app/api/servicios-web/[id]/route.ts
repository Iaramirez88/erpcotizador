import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { encryptWebsiteServicePassword, getWebsiteServicesAccessForUser, serializeWebsiteService } from '@/lib/website-services'
import { normalizeWebsiteServiceCustomFields } from '@/lib/website-service-fields'

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

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireWebsiteServicesAccess()
  if (!guard.ok) return guard.response

  const { id } = await context.params
  const existing = await prisma.websiteService.findFirst({
    where: { id, empresaId: guard.access.empresaId },
    select: { id: true },
  })

  if (!existing?.id) {
    return NextResponse.json({ ok: false, error: 'Servicio web no encontrado.' }, { status: 404 })
  }

  try {
    const body = await req.json().catch(() => null)
    const nombre = normalizeString(body?.nombre)
    if (!nombre) {
      return NextResponse.json({ ok: false, error: 'El nombre del servicio es obligatorio.' }, { status: 400 })
    }

    const shouldUpdatePassword = Object.prototype.hasOwnProperty.call(body ?? {}, 'loginPassword')
      && typeof body?.loginPassword === 'string'
      && body.loginPassword.trim().length > 0

    const updated = await prisma.websiteService.update({
      where: { id },
      data: {
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
        loginPasswordEncrypted: shouldUpdatePassword ? encryptWebsiteServicePassword(body?.loginPassword) : undefined,
        contactName: normalizeString(body?.contactName),
        contactPhone: normalizeString(body?.contactPhone),
        contactEmail: normalizeString(body?.contactEmail),
        notes: normalizeString(body?.notes),
        customFieldsJson: normalizeWebsiteServiceCustomFields(body?.customFieldsJson),
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
        contactEmail: true,
        notes: true,
        customFieldsJson: true,
        createdAt: true,
        updatedAt: true,
        createdByUser: { select: { id: true, name: true, email: true } },
        updatedByUser: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ ok: true, item: serializeWebsiteService(updated) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el servicio web.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireWebsiteServicesAccess()
  if (!guard.ok) return guard.response

  const { id } = await context.params
  const existing = await prisma.websiteService.findFirst({
    where: { id, empresaId: guard.access.empresaId },
    select: { id: true, nombre: true },
  })

  if (!existing?.id) {
    return NextResponse.json({ ok: false, error: 'Servicio web no encontrado.' }, { status: 404 })
  }

  await prisma.websiteService.delete({ where: { id } })

  return NextResponse.json({ ok: true, deletedId: existing.id, deletedName: existing.nombre })
}