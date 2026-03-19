import { AccessLevel, ModuleKey, type Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { assertCrmSedeAccess } from '@/lib/crm'
import { clearMetaSettings } from '@/lib/crm-meta'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const channel = await prisma.crmChannelConnection.findFirst({
      where: { id, empresaId: access.empresaId },
      select: { id: true, sedeId: true, settingsJson: true },
    })

    if (!channel) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    if (channel.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: channel.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const updated = await prisma.crmChannelConnection.update({
      where: { id: channel.id },
      data: {
        externalAccountId: null,
        externalPageId: null,
        externalPhoneNumberId: null,
        settingsJson: clearMetaSettings(channel.settingsJson) as Prisma.InputJsonValue,
        lastSyncAt: null,
      },
      include: {
        sede: { select: { id: true, nombre: true, codigo: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { conversations: true, captures: true } },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error desconectando Meta:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo desconectar Meta.' }, { status: 500 })
  }
}