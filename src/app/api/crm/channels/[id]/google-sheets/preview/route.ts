import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'
import { fetchGoogleSheetsRows, getGoogleSheetsSettings } from '@/lib/crm-google-sheets'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
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

    const maxRows = Math.min(Number.parseInt(new URL(request.url).searchParams.get('limit') || '', 10) || 10, 50)
    const sheet = await fetchGoogleSheetsRows(settings)
    const normalizedSettings = getGoogleSheetsSettings(settings)

    return NextResponse.json({
      success: true,
      data: {
        channelId: channel.id,
        channelName: channel.name,
        csvUrl: sheet.csvUrl,
        headers: sheet.headers,
        totalRows: sheet.rows.length,
        preview: sheet.rows.slice(0, maxRows),
        settings: normalizedSettings,
      },
    })
  } catch (error) {
    console.error('Error previsualizando Google Sheets CRM:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error previsualizando Google Sheets' }, { status: 500 })
  }
}
