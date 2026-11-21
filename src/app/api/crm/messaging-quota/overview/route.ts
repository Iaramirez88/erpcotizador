import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import {
  buildQuotaAlerts,
  buildUsageMeters,
  EMPRESA_PROVIDER_KEY,
  readUsageSnapshot,
  reconcileUsageCounters,
  resolveMessagingQuota,
  type MessagingUsageSnapshot,
} from '@/lib/messaging-quota'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const channels = await prisma.crmChannelConnection.findMany({
      where: { empresaId: access.empresaId },
      select: { id: true, name: true, provider: true, status: true, settingsJson: true },
      orderBy: { createdAt: 'asc' },
    })

    const empresaUsage: MessagingUsageSnapshot = {
      perChannelDaily: 0,
      perChannelMonthly: 0,
      perEmpresaDaily: 0,
      perEmpresaMonthly: 0,
    }

    const channelRows: Array<Record<string, unknown>> = []

    for (const channel of channels) {
      const provider = normalizeString(channel.provider)

      try {
        await reconcileUsageCounters({ empresaId: access.empresaId, channelConnectionId: channel.id, provider })
      } catch {
        // La reconciliación es best-effort; el contador atómico sigue siendo la fuente.
      }

      const usage = await readUsageSnapshot({ empresaId: access.empresaId, channelConnectionId: channel.id, provider })
      const quota = await resolveMessagingQuota({
        empresaId: access.empresaId,
        channelConnectionId: channel.id,
        provider,
        settingsJson: channel.settingsJson,
      })

      empresaUsage.perEmpresaDaily += usage.perChannelDaily
      empresaUsage.perEmpresaMonthly += usage.perChannelMonthly

      channelRows.push({
        id: channel.id,
        name: channel.name,
        provider,
        status: channel.status,
        quota,
        usage,
        meters: buildUsageMeters(quota, usage),
        alerts: buildQuotaAlerts(quota, usage),
      })
    }

    const empresaQuota = await resolveMessagingQuota({ empresaId: access.empresaId, provider: EMPRESA_PROVIDER_KEY })

    const totalOutbound = await prisma.crmMessage.count({
      where: { empresaId: access.empresaId, direction: 'OUTBOUND', providerMessageId: { not: null } },
    })

    return NextResponse.json({
      success: true,
      data: {
        empresa: {
          quota: empresaQuota,
          usage: empresaUsage,
          meters: buildUsageMeters(empresaQuota, empresaUsage),
          alerts: buildQuotaAlerts(empresaQuota, empresaUsage),
        },
        channels: channelRows,
        summary: {
          totalOutbound,
          today: empresaUsage.perEmpresaDaily,
          thisMonth: empresaUsage.perEmpresaMonthly,
          activeChannels: channels.filter((c) => c.status === 'ACTIVE').length,
        },
      },
    })
  } catch (error) {
    console.error('Error obteniendo consumo de mensajería:', error)
    return NextResponse.json({ error: 'Error obteniendo consumo de mensajería' }, { status: 500 })
  }
}
