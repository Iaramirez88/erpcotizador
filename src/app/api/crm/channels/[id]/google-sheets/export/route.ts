import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'
import { buildGoogleSheetsExportCsv } from '@/lib/crm-google-sheets'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
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
      select: { id: true, name: true, provider: true, sedeId: true, settingsJson: true },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    if (channel.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: channel.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    const settings = parseJsonObject(channel.settingsJson)
    if (channel.provider !== 'WEB_FORM' || normalizeString(settings.bridgeKind).toUpperCase() !== 'GOOGLE_SHEETS') {
      return NextResponse.json({ error: 'El canal no está configurado como Google Sheets Bridge' }, { status: 409 })
    }

    const limit = Math.min(Number.parseInt(new URL(request.url).searchParams.get('limit') || '', 10) || 250, 1000)
    const captures = await prisma.crmLeadCapture.findMany({
      where: {
        empresaId: access.empresaId,
        channelConnectionId: channel.id,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        lead: {
          select: {
            id: true,
            nombre: true,
            email: true,
            telefono: true,
            empresaNombre: true,
            ciudad: true,
            documento: true,
            status: true,
          },
        },
        conversation: {
          select: {
            id: true,
            sourceCampaign: true,
            sourceMedium: true,
            sourceContent: true,
            opportunity: {
              select: {
                id: true,
                title: true,
                stage: true,
                expectedValue: true,
                probabilityPct: true,
                expectedCloseAt: true,
              },
            },
          },
        },
      },
    })

    const rows = captures.map((capture) => ({
      fechaCaptura: capture.createdAt.toISOString(),
      canal: channel.name,
      nombre: capture.lead?.nombre || '',
      email: capture.lead?.email || '',
      telefono: capture.lead?.telefono || '',
      empresa: capture.lead?.empresaNombre || '',
      ciudad: capture.lead?.ciudad || '',
      documento: capture.lead?.documento || '',
      leadStatus: capture.lead?.status || '',
      sourceCampaign: capture.conversation?.sourceCampaign || capture.utmCampaign || '',
      sourceMedium: capture.conversation?.sourceMedium || capture.utmMedium || '',
      sourceContent: capture.conversation?.sourceContent || capture.utmContent || '',
      landingPageUrl: capture.landingPageUrl || '',
      utmSource: capture.utmSource || '',
      utmMedium: capture.utmMedium || '',
      utmCampaign: capture.utmCampaign || '',
      utmContent: capture.utmContent || '',
      utmTerm: capture.utmTerm || '',
      opportunityTitle: capture.conversation?.opportunity?.title || '',
      opportunityStage: capture.conversation?.opportunity?.stage || '',
      expectedValue: capture.conversation?.opportunity?.expectedValue || '',
      probabilityPct: capture.conversation?.opportunity?.probabilityPct || '',
      expectedCloseAt: capture.conversation?.opportunity?.expectedCloseAt?.toISOString() || '',
    }))

    const csv = buildGoogleSheetsExportCsv(rows)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="crm-google-sheets-${channel.id}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exportando Google Sheets CRM:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error exportando Google Sheets' }, { status: 500 })
  }
}
