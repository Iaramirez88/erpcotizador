import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createInboundArtifacts, getConnectionToken, parseJsonObject } from '@/lib/crm-omnichannel'
import { normalizeString } from '@/lib/crm'
import { extractHostFromUrl, getPublicWebFormSettings, isPublicWebFormDomainAllowed } from '@/lib/crm-public-web-form'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const channelId = normalizeString(body?.channelId)
    const providedToken = normalizeString(request.headers.get('x-crm-channel-token') || body?.token)

    if (!channelId) {
      return NextResponse.json({ error: 'channelId es requerido' }, { status: 400 })
    }

    const channel = await prisma.crmChannelConnection.findUnique({
      where: { id: channelId },
      include: { createdBy: { select: { id: true } } },
    })

    if (!channel || channel.provider !== 'WEB_FORM') {
      return NextResponse.json({ error: 'Canal web-form no encontrado' }, { status: 404 })
    }

    if (!['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ error: 'Canal no disponible para capturas' }, { status: 409 })
    }

    const eventAt = new Date()
    const payload = parseJsonObject(body?.payload)
    const nombre = normalizeString(body?.nombre || payload.nombre || payload.name)
    const email = normalizeString(body?.email || payload.email).toLowerCase()
    const phone = normalizeString(body?.telefono || body?.celular || payload.telefono || payload.celular || payload.phone)
    const product = normalizeString(body?.producto || body?.product || payload.producto || payload.product)
    const baseMessageText = normalizeString(body?.mensaje || body?.message || payload.mensaje || payload.message)
    const empresaNombre = normalizeString(body?.empresaNombre || payload.empresaNombre || payload.company)
    const ciudad = normalizeString(body?.ciudad || payload.ciudad || payload.city)
    const document = normalizeString(body?.documento || payload.documento)
    const landingPageUrl = normalizeString(body?.landingPageUrl || payload.landingPageUrl || payload.pageUrl)
    const referrerUrl = normalizeString(body?.referrerUrl || payload.referrerUrl)
    const utmSource = normalizeString(body?.utmSource || payload.utmSource)
    const utmMedium = normalizeString(body?.utmMedium || payload.utmMedium)
    const utmCampaign = normalizeString(body?.utmCampaign || payload.utmCampaign)
    const utmContent = normalizeString(body?.utmContent || payload.utmContent)
    const utmTerm = normalizeString(body?.utmTerm || payload.utmTerm)
    const messageText = [product ? `Producto: ${product}` : '', baseMessageText]
      .filter(Boolean)
      .join('\n\n')

    const expectedToken = getConnectionToken(channel.settingsJson, channel.verifyToken)
    const publicSettings = getPublicWebFormSettings(channel.settingsJson)
    const candidateHost = extractHostFromUrl(referrerUrl || landingPageUrl)
    const publicEmbedAllowed = publicSettings.publicEmbedEnabled && isPublicWebFormDomainAllowed({
      allowedDomains: publicSettings.allowedDomains,
      candidateHost,
    })
    if (expectedToken && providedToken !== expectedToken && !publicEmbedAllowed) {
      return NextResponse.json({ error: 'Token inválido para captura web' }, { status: 403 })
    }

    if (!nombre && !email && !phone) {
      return NextResponse.json({ error: 'Se requiere al menos nombre, email o teléfono' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const artifacts = await createInboundArtifacts({
        client: tx,
        empresaId: channel.empresaId,
        sedeId: channel.sedeId,
        createdById: channel.createdBy.id,
        ownerUserId: channel.createdBy.id,
        channelConnectionId: channel.id,
        source: 'WEB',
        captureType: 'WEB_FORM',
        activityType: 'NOTE',
        messageType: 'FORM_SUBMISSION',
        eventAt,
        nombre,
        empresaNombre,
        email,
        phone,
        document,
        ciudad,
        messageText,
        sourceLabel: 'Formulario web',
        sourceCampaign: utmCampaign || null,
        sourceMedium: utmMedium || 'web-form',
        sourceContent: utmContent || null,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        landingPageUrl,
        referrerUrl,
        rawPayloadJson: (body ?? {}) as Prisma.InputJsonValue,
        normalizedDataJson: {
          nombre,
          email,
          phone,
          empresaNombre,
          ciudad,
          document,
          product,
          messageText,
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          utmTerm,
          landingPageUrl,
          referrerUrl,
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
    }, { status: 201 })
  } catch (error) {
    console.error('Error capturando formulario web CRM:', error)
    return NextResponse.json({ error: 'Error capturando formulario web CRM' }, { status: 500 })
  }
}