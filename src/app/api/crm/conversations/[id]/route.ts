import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'

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
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
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