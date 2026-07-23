import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { extractHostFromUrl, getPublicChatbotSettings, isChatbotDomainAllowed } from '@/lib/crm-public-chatbot'
import { getReferrerHost, getRequestHost } from '@/lib/crm-public-chatbot-server'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ channelId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { channelId } = await context.params
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const externalThreadId = normalizeString(body.threadId)
    const rawParentReferrer = normalizeString(body.parentReferrer)

    if (!externalThreadId) {
      return NextResponse.json({ error: 'threadId es requerido' }, { status: 400 })
    }

    const channel = await prisma.crmChannelConnection.findUnique({
      where: { id: channelId },
      select: { id: true, provider: true, status: true, settingsJson: true },
    })

    if (!channel || channel.provider !== 'WEB_CHATBOT' || !['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ error: 'Canal chatbot no disponible' }, { status: 404 })
    }

    const settings = getPublicChatbotSettings(channel.settingsJson)
    if (!settings.publicEmbedEnabled) {
      return NextResponse.json({ error: 'Embed público deshabilitado' }, { status: 403 })
    }

    const requestHost = await getRequestHost()
    const referrerHost = await getReferrerHost()
    const parentHost = referrerHost === requestHost ? extractHostFromUrl(rawParentReferrer) : referrerHost
    if (!isChatbotDomainAllowed({ allowedDomains: settings.allowedDomains, candidateHost: parentHost || requestHost, appHost: requestHost })) {
      return NextResponse.json({ error: 'Dominio no autorizado para este chatbot' }, { status: 403 })
    }

    await prisma.crmConversation.updateMany({
      where: {
        channelConnectionId: channel.id,
        externalThreadId,
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cerrando chatbot público:', error)
    return NextResponse.json({ error: 'Error cerrando chatbot público' }, { status: 500 })
  }
}