import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const channel = await prisma.crmChannelConnection.findFirst({
      where: { id, empresaId: access.empresaId },
      select: { id: true },
    })
    if (!channel) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    const versions = await prisma.crmChannelSettingsVersion.findMany({
      where: { channelConnectionId: id },
      orderBy: { versionNumber: 'desc' },
      take: 100,
      select: {
        id: true,
        versionNumber: true,
        changeNote: true,
        createdByUser: { select: { id: true, name: true, email: true } },
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, data: versions })
  } catch (error) {
    console.error('Error listando versiones de configuración:', error)
    return NextResponse.json({ error: 'Error listando versiones de configuración' }, { status: 500 })
  }
}
