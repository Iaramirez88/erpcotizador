import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { buildGmailAppsScriptSnippet } from '@/lib/crm-integration-assets'
import { getRequestBaseUrl } from '@/lib/app-url'

export const runtime = 'nodejs'

/**
 * Auto-provisionamiento de Gmail Inbox Bridge:
 * genera canal + token exclusivo + script de Apps Script configurado, en un solo paso.
 */
export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'CONFIGURE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const name = normalizeString(body?.name) || 'Gmail Inbox Bridge'
    const sedeId = normalizeString(body?.sedeId) || access.sedeId || null
    const token = crypto.randomUUID()

    const channel = await prisma.crmChannelConnection.create({
      data: {
        empresaId: access.empresaId,
        sedeId,
        provider: 'WEB_FORM',
        status: 'TESTING',
        name,
        verifyToken: token,
        settingsJson: { bridgeKind: 'GMAIL', testingToken: token },
        createdById: access.userId,
      },
    })

    const baseUrl = getRequestBaseUrl(request) || (process.env.APP_URL || process.env.NEXTAUTH_URL || '').replace(/\/$/, '')
    const script = buildGmailAppsScriptSnippet({ baseUrl, channelId: channel.id, token })

    return NextResponse.json({ success: true, data: { channelId: channel.id, token, script } }, { status: 201 })
  } catch (error) {
    console.error('Error auto-provisionando Gmail Bridge:', error)
    return NextResponse.json({ error: 'Error auto-provisionando Gmail Bridge' }, { status: 500 })
  }
}
