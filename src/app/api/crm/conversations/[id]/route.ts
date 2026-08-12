import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'
import { resolveCrmConversationAvatarUrl } from '@/lib/chat-avatar'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

function getBridgeKind(settingsJson: unknown) {
  if (!settingsJson || typeof settingsJson !== 'object' || Array.isArray(settingsJson)) return null
  return normalizeString((settingsJson as Record<string, unknown>).bridgeKind).toUpperCase() || null
}

async function getConversation(id: string, empresaId: string) {
  return prisma.crmConversation.findUnique({
    where: { id },
    include: {
      channelConnection: { select: { id: true, name: true, provider: true, status: true, settingsJson: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      lead: { select: { id: true, nombre: true, status: true, email: true, telefono: true, celular: true } },
      cliente: { select: { id: true, nombre: true, documento: true, email: true, telefono: true, celular: true } },
      opportunity: { select: { id: true, title: true, stage: true, expectedValue: true, probabilityPct: true, expectedCloseAt: true } },
      messages: {
        orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
        include: { sentByUser: { select: { id: true, name: true, email: true } } },
        take: 100,
      },
      captures: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  }).then((row) => (row && row.empresaId === empresaId ? row : null))
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'INBOX',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const row = await getConversation(id, access.empresaId)
    if (!row) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

    if (row.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: row.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    if (row.unreadCount > 0) {
      await prisma.crmConversation.update({
        where: { id: row.id },
        data: { unreadCount: 0 },
      })
      row.unreadCount = 0
    }

    const data = {
      ...row,
      contactAvatarUrl: resolveCrmConversationAvatarUrl({
        messages: row.messages,
        captures: row.captures,
      }),
      channelConnection: {
        id: row.channelConnection.id,
        name: row.channelConnection.name,
        provider: row.channelConnection.provider,
        status: row.channelConnection.status,
        bridgeKind: getBridgeKind(row.channelConnection.settingsJson),
      },
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error obteniendo conversación CRM:', error)
    return NextResponse.json({ error: 'Error obteniendo conversación CRM' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'INBOX',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await getConversation(id, access.empresaId)
    if (!current) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const action = normalizeString(body?.action).toLowerCase()

    if (action === 'rename') {
      const name = normalizeString(body?.name)
      if (!name) {
        return NextResponse.json({ error: 'Debes indicar el nombre.' }, { status: 400 })
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (current.leadId) {
          await tx.crmLead.updateMany({
            where: { id: current.leadId, empresaId: access.empresaId },
            data: { nombre: name },
          })
        }

        const conversation = await tx.crmConversation.update({
          where: { id: current.id },
          data: { contactDisplayName: name },
        })

        await tx.crmActivity.create({
          data: {
            empresaId: access.empresaId,
            sedeId: current.sedeId,
            type: 'OTHER',
            summary: 'Nombre de conversación actualizado',
            details: `Se actualizó el nombre visible a "${name}".`,
            leadId: current.leadId,
            opportunityId: current.opportunityId,
            clienteId: current.clienteId,
            occurredAt: new Date(),
            createdById: access.userId,
          },
        })

        return conversation
      })

      return NextResponse.json({ success: true, data: updated })
    }

    if (action === 'report') {
      const updated = await prisma.$transaction(async (tx) => {
        const conversation = await tx.crmConversation.update({
          where: { id: current.id },
          data: {
            status: 'SPAM',
            unreadCount: 0,
            resolvedAt: new Date(),
          },
        })

        await tx.crmActivity.create({
          data: {
            empresaId: access.empresaId,
            sedeId: current.sedeId,
            type: 'OTHER',
            summary: 'Conversación reportada',
            details: 'La conversación fue marcada como reportada y movida a SPAM.',
            leadId: current.leadId,
            opportunityId: current.opportunityId,
            clienteId: current.clienteId,
            occurredAt: new Date(),
            createdById: access.userId,
          },
        })

        return conversation
      })

      return NextResponse.json({ success: true, data: updated })
    }

    if (action === 'disable') {
      const updated = await prisma.$transaction(async (tx) => {
        const conversation = await tx.crmConversation.update({
          where: { id: current.id },
          data: {
            status: 'DISABLED',
            unreadCount: 0,
            resolvedAt: null,
          },
        })

        await tx.crmActivity.create({
          data: {
            empresaId: access.empresaId,
            sedeId: current.sedeId,
            type: 'OTHER',
            summary: 'Conversación deshabilitada temporalmente',
            details: 'La conversación se pausó temporalmente desde el inbox.',
            leadId: current.leadId,
            opportunityId: current.opportunityId,
            clienteId: current.clienteId,
            occurredAt: new Date(),
            createdById: access.userId,
          },
        })

        return conversation
      })

      return NextResponse.json({ success: true, data: updated })
    }

    return NextResponse.json({ error: 'Acción no soportada.' }, { status: 400 })
  } catch (error) {
    console.error('Error actualizando conversación CRM:', error)
    return NextResponse.json({ error: 'Error actualizando conversación CRM' }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'INBOX',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await getConversation(id, access.empresaId)
    if (!current) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    await prisma.crmConversation.delete({ where: { id: current.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando conversación CRM:', error)
    return NextResponse.json({ error: 'Error eliminando conversación CRM' }, { status: 500 })
  }
}