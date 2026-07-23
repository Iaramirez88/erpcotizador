import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { extractHostFromUrl, getPublicChatbotSettings, isChatbotDomainAllowed } from '@/lib/crm-public-chatbot'
import { getReferrerHost, getRequestHost } from '@/lib/crm-public-chatbot-server'
import { plainTextToRichTextHtml } from '@/lib/chatbot-rich-text'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ channelId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { channelId } = await context.params
    const { searchParams } = new URL(request.url)
    const externalThreadId = normalizeString(searchParams.get('threadId'))
    const rawParentReferrer = normalizeString(searchParams.get('parentReferrer'))

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

    const conversation = await prisma.crmConversation.findFirst({
      where: {
        channelConnectionId: channel.id,
        externalThreadId,
      },
      select: {
        id: true,
        status: true,
        unreadCount: true,
        lastMessageAt: true,
        messages: {
          orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
          take: 80,
            select: {
              id: true,
              direction: true,
              bodyText: true,
              occurredAt: true,
              sentByUser: { select: { name: true, email: true } },
              attachmentsJson: true,
              payloadJson: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation?.id || null,
        status: conversation?.status || 'OPEN',
        unreadCount: conversation?.unreadCount || 0,
        lastMessageAt: conversation?.lastMessageAt || null,
        messages: (conversation?.messages || []).map((message) => ({
          id: message.id,
          role: message.direction === 'OUTBOUND' ? 'assistant' : message.direction === 'SYSTEM' ? 'system' : 'user',
          body: message.bodyText || '',
          bodyHtml: message.payloadJson && typeof message.payloadJson === 'object' && !Array.isArray(message.payloadJson) && typeof message.payloadJson.chatRenderedHtml === 'string'
            ? message.payloadJson.chatRenderedHtml
            : plainTextToRichTextHtml(message.bodyText || ''),
          at: message.occurredAt,
          author: message.sentByUser?.name || message.sentByUser?.email || null,
          attachments: Array.isArray(message.attachmentsJson) ? message.attachmentsJson : [],
          meta: message.payloadJson && typeof message.payloadJson === 'object' && !Array.isArray(message.payloadJson)
            ? {
                nextField: typeof message.payloadJson.chatFlowNextField === 'string' ? message.payloadJson.chatFlowNextField : null,
                stageId: typeof message.payloadJson.chatFlowStageId === 'string' ? message.payloadJson.chatFlowStageId : null,
                quickActionIds: Array.isArray(message.payloadJson.chatQuickActionIds)
                  ? message.payloadJson.chatQuickActionIds.filter((item): item is string => typeof item === 'string')
                  : [],
                responseOptionIds: Array.isArray(message.payloadJson.chatFlowResponseOptionIds)
                  ? message.payloadJson.chatFlowResponseOptionIds.filter((item): item is string => typeof item === 'string')
                  : [],
                  pauseNodeId: typeof message.payloadJson.chatPauseNodeId === 'string' ? message.payloadJson.chatPauseNodeId : null,
                  pauseDurationMinutes: typeof message.payloadJson.chatPauseDurationMinutes === 'number' ? message.payloadJson.chatPauseDurationMinutes : null,
                  pauseDescription: typeof message.payloadJson.chatPauseDescription === 'string' ? message.payloadJson.chatPauseDescription : null,
                  pauseUntil: typeof message.payloadJson.chatPauseUntil === 'string' ? message.payloadJson.chatPauseUntil : null,
              }
            : undefined,
        })),
      },
    })
  } catch (error) {
    console.error('Error sincronizando chatbot público:', error)
    return NextResponse.json({ error: 'Error sincronizando chatbot público' }, { status: 500 })
  }
}