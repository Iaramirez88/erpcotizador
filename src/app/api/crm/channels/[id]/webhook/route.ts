import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createInboundArtifacts, getConnectionToken, parseJsonObject, parseMaybeDate } from '@/lib/crm-omnichannel'
import { normalizeString } from '@/lib/crm'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const channel = await prisma.crmChannelConnection.findUnique({ where: { id } })
  if (!channel) return new NextResponse('Not found', { status: 404 })

  const { searchParams } = new URL(request.url)
  const verifyToken = normalizeString(searchParams.get('hub.verify_token') || searchParams.get('verify_token'))
  const challenge = normalizeString(searchParams.get('hub.challenge') || searchParams.get('challenge'))
  const expectedToken = getConnectionToken(channel.settingsJson, channel.verifyToken)

  if (!challenge) {
    return NextResponse.json({ ok: true, provider: channel.provider, status: channel.status })
  }

  if (expectedToken && verifyToken !== expectedToken) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  return new NextResponse(challenge, { status: 200 })
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const channel = await prisma.crmChannelConnection.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true } } },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    if (!['WHATSAPP_CLOUD', 'WHATSAPP_SANDBOX', 'MESSENGER', 'FACEBOOK_PAGE', 'INSTAGRAM_DM'].includes(channel.provider)) {
      return NextResponse.json({ error: 'Canal no soporta webhook' }, { status: 400 })
    }

    if (!['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ error: 'Canal no disponible para webhook' }, { status: 409 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const providedToken = normalizeString(
      request.headers.get('x-crm-webhook-token') ||
      request.headers.get('x-verify-token') ||
      body?.token
    )
    const expectedToken = getConnectionToken(channel.settingsJson, channel.verifyToken)

    if (expectedToken && providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Token inválido para webhook' }, { status: 403 })
    }

    const payload = parseJsonObject(body?.payload)
    const sender = parseJsonObject(body?.sender)
    const contact = parseJsonObject(body?.contact)
    const metadata = parseJsonObject(body?.metadata)
    const eventAt = parseMaybeDate(body?.occurredAt || payload.occurredAt || payload.timestamp)

    const externalThreadId = normalizeString(body?.externalThreadId || payload.externalThreadId || payload.chatId || payload.threadId || sender.id)
    const providerMessageId = normalizeString(body?.providerMessageId || payload.providerMessageId || payload.messageId || payload.id)
    const providerLeadId = normalizeString(body?.providerLeadId || sender.id || contact.id)
    const nombre = normalizeString(body?.nombre || contact.name || sender.name)
    const phone = normalizeString(body?.telefono || contact.phone || sender.phone || sender.wa_id)
    const email = normalizeString(body?.email || contact.email || sender.email).toLowerCase()
    const empresaNombre = normalizeString(body?.empresaNombre || contact.company)
    const ciudad = normalizeString(body?.ciudad || contact.city)
    const messageText = normalizeString(body?.message || body?.text || payload.message || payload.text || payload.body)

    if (!externalThreadId && !phone && !email) {
      return NextResponse.json({ error: 'Webhook sin identificador conversacional' }, { status: 400 })
    }

    const source = channel.provider === 'MESSENGER' || channel.provider === 'FACEBOOK_PAGE' ? 'OTRO' : 'WHATSAPP'
    const captureType = channel.provider === 'MESSENGER' || channel.provider === 'FACEBOOK_PAGE' ? 'MESSENGER_INBOUND' : 'WHATSAPP_INBOUND'
    const sourceLabel = channel.provider === 'MESSENGER' || channel.provider === 'FACEBOOK_PAGE' ? 'Messenger/Facebook' : 'WhatsApp'

    const result = await prisma.$transaction(async (tx) => {
      const artifacts = await createInboundArtifacts({
        client: tx,
        empresaId: channel.empresaId,
        sedeId: channel.sedeId,
        createdById: channel.createdBy.id,
        ownerUserId: channel.createdBy.id,
        channelConnectionId: channel.id,
        source,
        captureType,
        activityType: source === 'WHATSAPP' ? 'WHATSAPP' : 'OTHER',
        messageType: 'TEXT',
        eventAt,
        nombre,
        empresaNombre,
        email,
        phone,
        ciudad,
        messageText,
        externalThreadId,
        providerMessageId,
        providerLeadId,
        sourceLabel,
        sourceCampaign: normalizeString(metadata.campaign),
        sourceMedium: normalizeString(metadata.medium) || channel.provider,
        sourceContent: normalizeString(metadata.content),
        rawPayloadJson: (body ?? {}) as Prisma.InputJsonValue,
        normalizedDataJson: {
          externalThreadId,
          providerMessageId,
          providerLeadId,
          nombre,
          email,
          phone,
          empresaNombre,
          ciudad,
          messageText,
          provider: channel.provider,
        },
      })

      await tx.crmChannelConnection.update({
        where: { id: channel.id },
        data: { lastWebhookAt: eventAt, lastErrorAt: null, lastErrorMessage: null },
      })

      return artifacts
    })

    return NextResponse.json({
      success: true,
      data: {
        leadId: result.lead.id,
        conversationId: result.conversation.id,
        messageId: result.message.id,
        captureId: result.capture.id,
        testing: channel.status === 'TESTING',
      },
    })
  } catch (error) {
    console.error('Error procesando webhook CRM:', error)
    await prisma.crmChannelConnection.updateMany({
      where: { id },
      data: { lastErrorAt: new Date(), lastErrorMessage: error instanceof Error ? error.message : 'Error inesperado' },
    })
    return NextResponse.json({ error: 'Error procesando webhook CRM' }, { status: 500 })
  }
}