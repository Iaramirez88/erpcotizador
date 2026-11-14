import { NextResponse } from 'next/server'
import { AccessLevel, type CrmContactStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'
import { canAccessCrmRecord, resolveCrmRequestScope } from '@/lib/crm-scope'
import { loadContactTimeline } from '@/lib/crm-timeline'
import { normalizeContactEmail, normalizePhoneForStorage } from '@/lib/crm-contact-identity'

export const runtime = 'nodejs'

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CONTACTS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const contact = await prisma.crmContact.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, nombre: true, lifecycleStatus: true } },
        cliente: { select: { id: true, nombre: true, documento: true } },
        ownerUser: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        leads: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            nombre: true,
            lifecycleStatus: true,
            score: true,
            scoreBand: true,
            createdAt: true,
            lastActivityAt: true,
          },
        },
        captures: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            captureType: true,
            formName: true,
            campaignName: true,
            serviceInterest: true,
            createdAt: true,
          },
        },
        conversations: {
          orderBy: { lastMessageAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            lastMessageAt: true,
            directionLastMessage: true,
            channelConnection: { select: { name: true, provider: true } },
          },
        },
        opportunities: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, title: true, stage: true, expectedValue: true, createdAt: true },
        },
        consents: {
          select: { channel: true, status: true, source: true, grantedAt: true, revokedAt: true },
        },
      },
    })

    if (!contact || contact.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
    }

    const scope = await resolveCrmRequestScope(access, { subdomain: 'CONTACTS', action: 'READ' })
    if (!canAccessCrmRecord(scope, 'contact', contact)) {
      return NextResponse.json({ error: 'Sin acceso a este contacto' }, { status: 403 })
    }

    const timeline = await loadContactTimeline({
      client: prisma,
      empresaId: access.empresaId,
      contactId: contact.id,
      limit: 60,
    })

    return NextResponse.json({ success: true, data: { ...contact, timeline, scope: scope.level } })
  } catch (error) {
    console.error('Error obteniendo contacto CRM:', error)
    return NextResponse.json({ error: 'Error obteniendo contacto CRM' }, { status: 500 })
  }
}


export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CONTACTS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await prisma.crmContact.findUnique({
      where: { id },
      select: {
        id: true,
        empresaId: true,
        sedeId: true,
        leadId: true,
        clienteId: true,
        nombre: true,
        ownerUserId: true,
        createdById: true,
      },
    })

    if (!current || current.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
    }

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const scope = await resolveCrmRequestScope(access, { subdomain: 'CONTACTS', action: 'UPDATE' })
    if (!canAccessCrmRecord(scope, 'contact', current)) {
      return NextResponse.json({ error: 'Sin acceso a este contacto' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const nombre = normalizeString(body?.nombre)
    const email = normalizeString(body?.email)
    const telefono = normalizeString(body?.telefono)
    const celular = normalizeString(body?.celular)
    const cargo = normalizeString(body?.cargo)
    const notes = normalizeString(body?.notes)
    const empresaNombre = normalizeString(body?.empresaNombre)
    const documento = normalizeString(body?.documento)
    const ciudad = normalizeString(body?.ciudad)
    const statusRaw = normalizeString(body?.status).toUpperCase() as CrmContactStatus
    const ownerUserId = normalizeString(body?.ownerUserId)
    const tags = Array.isArray(body?.tags)
      ? Array.from(new Set(body.tags.map((item) => normalizeString(item)).filter(Boolean)))
      : null
    const isPrimary = Object.prototype.hasOwnProperty.call(body ?? {}, 'isPrimary') ? Boolean(body?.isPrimary) : undefined

    const updated = await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.crmContact.updateMany({
          where: {
            empresaId: access.empresaId,
            id: { not: current.id },
            ...(current.leadId ? { leadId: current.leadId } : {}),
            ...(current.clienteId ? { clienteId: current.clienteId } : {}),
          },
          data: { isPrimary: false },
        })
      }

      return tx.crmContact.update({
        where: { id: current.id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'nombre') ? { nombre: nombre || current.nombre } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'email')
            ? { email: email || null, emailNormalized: normalizeContactEmail(email) || null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'telefono') ? { telefono: telefono || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'celular') ? { celular: celular || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'telefono') ||
          Object.prototype.hasOwnProperty.call(body ?? {}, 'celular')
            ? { phoneNormalized: normalizePhoneForStorage(celular || telefono) || null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'cargo') ? { cargo: cargo || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'notes') ? { notes: notes || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'empresaNombre')
            ? { empresaNombre: empresaNombre || null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'documento') ? { documento: documento || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'ciudad') ? { ciudad: ciudad || null } : {}),
          ...(['ACTIVE', 'INACTIVE', 'DO_NOT_CONTACT'].includes(statusRaw) ? { status: statusRaw } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'ownerUserId')
            ? { ownerUserId: ownerUserId || null }
            : {}),
          ...(tags ? { tags } : {}),
          ...(isPrimary !== undefined ? { isPrimary } : {}),
        },
        include: {
          lead: { select: { id: true, nombre: true } },
          cliente: { select: { id: true, nombre: true, documento: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      })
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error actualizando contacto CRM:', error)
    return NextResponse.json({ error: 'Error actualizando contacto CRM' }, { status: 500 })
  }
}