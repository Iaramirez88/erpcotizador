import { NextResponse } from 'next/server'
import { AccessLevel, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess } from '@/lib/crm'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string; versionId: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id, versionId } = await context.params
    const channel = await prisma.crmChannelConnection.findFirst({
      where: { id, empresaId: access.empresaId },
      select: { id: true, sedeId: true, settingsJson: true },
    })
    if (!channel) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    if (channel.sedeId) {
      const denied = await assertCrmSedeAccess({
        sedeId: channel.sedeId,
        empresaId: access.empresaId,
        userId: access.userId,
        minLevel: AccessLevel.WRITE,
      })
      if (denied) return denied
    }

    const version = await prisma.crmChannelSettingsVersion.findFirst({
      where: { id: versionId, channelConnectionId: id },
      select: { id: true, versionNumber: true, settingsJson: true },
    })
    if (!version) {
      return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Respaldamos el estado actual antes de restaurar (permite deshacer la restauración).
      const latest = await tx.crmChannelSettingsVersion.findFirst({
        where: { channelConnectionId: id },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true },
      })
      await tx.crmChannelSettingsVersion.create({
        data: {
          channelConnectionId: id,
          versionNumber: (latest?.versionNumber ?? 0) + 1,
          settingsJson: (channel.settingsJson ?? {}) as Prisma.InputJsonValue,
          changeNote: `Restauración de la versión ${version.versionNumber}`,
          createdByUserId: access.userId,
        },
      })

      return tx.crmChannelConnection.update({
        where: { id },
        data: { settingsJson: version.settingsJson as Prisma.InputJsonValue },
        include: {
          sede: { select: { id: true, nombre: true, codigo: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { conversations: true, captures: true } },
        },
      })
    })

    return NextResponse.json({ success: true, data: { ...updated, restoredFromVersion: version.versionNumber } })
  } catch (error) {
    console.error('Error restaurando versión de configuración:', error)
    return NextResponse.json({ error: 'Error restaurando versión de configuración' }, { status: 500 })
  }
}
