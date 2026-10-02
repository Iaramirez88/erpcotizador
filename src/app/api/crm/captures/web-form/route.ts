import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createInboundArtifacts, getConnectionToken, parseJsonObject } from '@/lib/crm-omnichannel'
import { normalizeString } from '@/lib/crm'
import { extractHostFromUrl, getPublicWebFormSettings, getReferrerHost, getRequestHost, isPublicWebFormDomainAllowed } from '@/lib/crm-public-web-form'
import {
  boundedFormString,
  enforcePublicFormRateLimit,
  hasOversizedPublicFormBody,
  isLikelyAutomatedSubmission,
  isSafePublicHttpUrl,
  isValidPublicFormEmail,
  readPublicFormJson,
  verifyTurnstileToken,
} from '@/lib/public-form-security'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    if (hasOversizedPublicFormBody(request)) {
      return NextResponse.json({ error: 'Formulario demasiado grande' }, { status: 413 })
    }

    const parsedBody = await readPublicFormJson(request)
    if (parsedBody.tooLarge) {
      return NextResponse.json({ error: 'Formulario demasiado grande' }, { status: 413 })
    }
    const body = parsedBody.body
    if (!body) {
      return NextResponse.json({ error: 'Formulario inválido o demasiado grande' }, { status: 400 })
    }

    const channelId = boundedFormString(body.channelId, 64)
    const providedToken = normalizeString(request.headers.get('x-crm-channel-token') || body?.token)

    if (!channelId) {
      return NextResponse.json({ error: 'channelId es requerido' }, { status: 400 })
    }

    const rateLimit = await enforcePublicFormRateLimit({ request, channelId })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados envíos. Intenta nuevamente más tarde.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      )
    }

    if (isLikelyAutomatedSubmission(body)) {
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const turnstile = await verifyTurnstileToken({
      token: boundedFormString(body.turnstileToken, 2048),
      request,
    })
    if (turnstile.configured && !turnstile.success) {
      return NextResponse.json({ error: 'No se pudo validar que eres una persona.' }, { status: 403 })
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
    const nombre = boundedFormString(body.nombre || payload.nombre || payload.name, 160)
    const email = boundedFormString(body.email || payload.email, 320).toLowerCase()
    const phone = boundedFormString(body.telefono || body.celular || payload.telefono || payload.celular || payload.phone, 40)
    const product = boundedFormString(body.producto || body.product || payload.producto || payload.product, 200)
    const baseMessageText = boundedFormString(body.mensaje || body.message || payload.mensaje || payload.message, 5000)
    const empresaNombre = boundedFormString(body.empresaNombre || payload.empresaNombre || payload.company, 200)
    const ciudad = boundedFormString(body.ciudad || payload.ciudad || payload.city, 160)
    const document = boundedFormString(body.documento || payload.documento, 80)
    const landingPageUrl = boundedFormString(body.landingPageUrl || payload.landingPageUrl || payload.pageUrl, 2048)
    const referrerUrl = boundedFormString(body.referrerUrl || payload.referrerUrl, 2048)
    const utmSource = boundedFormString(body.utmSource || payload.utmSource, 200)
    const utmMedium = boundedFormString(body.utmMedium || payload.utmMedium, 200)
    const utmCampaign = boundedFormString(body.utmCampaign || payload.utmCampaign, 200)
    const utmContent = boundedFormString(body.utmContent || payload.utmContent, 200)
    const utmTerm = boundedFormString(body.utmTerm || payload.utmTerm, 200)
    const messageText = [product ? `Producto: ${product}` : '', baseMessageText]
      .filter(Boolean)
      .join('\n\n')

    if (!isValidPublicFormEmail(email)) {
      return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
    }
    if (!isSafePublicHttpUrl(landingPageUrl) || !isSafePublicHttpUrl(referrerUrl)) {
      return NextResponse.json({ error: 'URL de origen inválida' }, { status: 400 })
    }

    const expectedToken = getConnectionToken(channel.settingsJson, channel.verifyToken)
    const publicSettings = getPublicWebFormSettings(channel.settingsJson)
    const requestHost = await getRequestHost()
    const referrerHost = await getReferrerHost()
    const candidateHost = referrerHost === requestHost ? extractHostFromUrl(referrerUrl || landingPageUrl) : referrerHost
    const publicEmbedAllowed = publicSettings.publicEmbedEnabled && isPublicWebFormDomainAllowed({
      allowedDomains: publicSettings.allowedDomains,
      candidateHost,
    })
    const tokenMatches = Boolean(expectedToken && providedToken === expectedToken)
    if (!tokenMatches && !publicEmbedAllowed) {
      return NextResponse.json({ error: 'Token inválido para captura web' }, { status: 403 })
    }

    if (!nombre && !email && !phone) {
      return NextResponse.json({ error: 'Se requiere al menos nombre, email o teléfono' }, { status: 400 })
    }

    const safeRawPayload = { ...body }
    delete safeRawPayload.token
    delete safeRawPayload.turnstileToken
    delete safeRawPayload.website
    delete safeRawPayload.formStartedAt

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
        rawPayloadJson: safeRawPayload as Prisma.InputJsonValue,
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