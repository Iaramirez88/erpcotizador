import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { computeBridgeDiagnostics, isBridgeDiagnosticsApplicable } from '@/lib/crm-channel-diagnostics'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

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
      select: { id: true, settingsJson: true, verifyToken: true, lastWebhookAt: true, lastErrorAt: true, lastErrorMessage: true },
    })
    if (!channel) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const bridgeKind = normalizeString((channel.settingsJson as Record<string, unknown> | null | undefined)?.bridgeKind)
    if (!isBridgeDiagnosticsApplicable(bridgeKind)) {
      return NextResponse.json({ success: true, data: { diagnostics: null } })
    }

    const diagnostics = await computeBridgeDiagnostics({
      channelId: channel.id,
      verifyToken: channel.verifyToken,
      lastWebhookAt: channel.lastWebhookAt,
      lastErrorAt: channel.lastErrorAt,
      lastErrorMessage: channel.lastErrorMessage,
    })

    return NextResponse.json({ success: true, data: { diagnostics } })
  } catch (error) {
    console.error('Error obteniendo diagnóstico del bridge:', error)
    return NextResponse.json({ error: 'Error obteniendo diagnóstico del bridge' }, { status: 500 })
  }
}
