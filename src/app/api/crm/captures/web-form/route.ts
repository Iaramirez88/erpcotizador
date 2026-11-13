import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createInboundArtifacts, getConnectionToken, parseJsonObject } from '@/lib/crm-omnichannel'
import { normalizeString } from '@/lib/crm'
import { extractHostFromUrl, getPublicWebFormSettings, getReferrerHost, getRequestHost, isPublicWebFormDomainAllowed } from '@/lib/crm-public-web-form'
import { normalizeWebFormCouponCode } from '@/lib/crm-web-form-purpose'
import { dispatchWebFormReward, resolveWebFormRewardDelivery } from '@/lib/crm-web-form-reward'
import { sendEmail } from '@/lib/email'
import { getCrmResponseEmailSettings, renderCrmResponseEmail } from '@/lib/crm-response-email'
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

type SubmittedCustomField = {
  key: string
  label: string
  type: string
  value: string
}

function normalizeSubmittedCustomFields(value: unknown): SubmittedCustomField[] {
  if (!Array.isArray(value)) return []

  const fields: SubmittedCustomField[] = []
  value.slice(0, 40).forEach((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const key = boundedFormString(row.key, 80)
    const label = boundedFormString(row.label, 160)
    if (!key && !label) return

    const rawValue = row.value
    const normalizedValue = Array.isArray(rawValue)
      ? rawValue
          .map((entry) => (entry && typeof entry === 'object'
            ? boundedFormString((entry as Record<string, unknown>).name, 160)
            : boundedFormString(entry, 160)))
          .filter(Boolean)
          .join(', ')
      : typeof rawValue === 'boolean'
        ? (rawValue ? 'Sí' : 'No')
        : boundedFormString(rawValue, 1000)

    fields.push({
      key: key || label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      label: label || key,
      type: boundedFormString(row.type, 24),
      value: normalizedValue.slice(0, 1000),
    })
  })

  return fields
}

function normalizeSubmittedVariables(value: unknown) {
  if (!Array.isArray(value)) return []

  return value.slice(0, 30).flatMap((item) => {
    const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
    const key = boundedFormString(row.key, 80)
    const variableValue = boundedFormString(row.value, 400)
    const label = boundedFormString(row.label, 120)
    if (!key || !variableValue) return []
    return [{ key, label: label || key, value: variableValue }]
  })
}

function resolvePublicDestination(rawValue: string, requestUrl: string) {
  const value = String(rawValue ?? '').trim()
  if (!value) return ''

  try {
    const resolved = new URL(value, requestUrl).toString()
    return isSafePublicHttpUrl(resolved) ? resolved : ''
  } catch {
    return ''
  }
}

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
    const gclid = boundedFormString(body.gclid || payload.gclid, 255)
    const messageText = [product ? `Producto: ${product}` : '', baseMessageText]
      .filter(Boolean)
      .join('\n\n')
    const customFields = normalizeSubmittedCustomFields(body.customFields || payload.customFields)
    const variables = normalizeSubmittedVariables(body.variables || payload.variables)

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

    const purposeConfig = publicSettings.purpose
    const rewardUrl = resolvePublicDestination(purposeConfig.incentive.rewardUrl, request.url)
    const rewardAvailable = purposeConfig.purpose === 'INCENTIVE' && Boolean(rewardUrl)
    const rewardDelivery = resolveWebFormRewardDelivery(purposeConfig.incentive.deliveryMode, body.rewardDelivery)
    const couponCode = normalizeWebFormCouponCode(body.couponCode || payload.couponCode)
      || (purposeConfig.coupon.enabled ? purposeConfig.coupon.code : '')
    const coupon = couponCode
      ? {
          code: couponCode,
          label: purposeConfig.coupon.label,
          message: purposeConfig.coupon.message,
        }
      : null
    const couponRedirectUrl = purposeConfig.coupon.enabled
      ? resolvePublicDestination(purposeConfig.coupon.redirectUrl, request.url)
      : ''
    const redirectUrl = purposeConfig.purpose === 'THANK_YOU_REDIRECT'
      ? resolvePublicDestination(purposeConfig.redirect.url, request.url)
      : couponRedirectUrl
    const leadTags = [
      `formulario:${purposeConfig.purpose.toLowerCase()}`,
      coupon ? `cupon:${coupon.code.toLowerCase()}` : '',
    ].filter(Boolean)

    const safeRawPayload = { ...body }
    delete safeRawPayload.token
    delete safeRawPayload.turnstileToken
    delete safeRawPayload.website
    delete safeRawPayload.formStartedAt

    const normalizedDataPayload = {
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
      gclid,
      landingPageUrl,
      referrerUrl,
      purpose: purposeConfig.purpose,
      customFields,
      variables,
      coupon,
      reward: rewardAvailable
        ? {
            type: purposeConfig.incentive.rewardType,
            label: purposeConfig.incentive.rewardLabel,
            delivery: rewardDelivery,
          }
        : null,
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
        tags: leadTags,
        sourceLabel: 'Formulario web',
        sourceCampaign: utmCampaign || (coupon ? `cupon-${coupon.code.toLowerCase()}` : null),
        sourceMedium: utmMedium || 'web-form',
        sourceContent: utmContent || (coupon ? coupon.code : null),
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        gclid,
        landingPageUrl,
        referrerUrl,
        rawPayloadJson: safeRawPayload as Prisma.InputJsonValue,
        normalizedDataJson: normalizedDataPayload,
      })

      await tx.crmChannelConnection.update({
        where: { id: channel.id },
        data: { lastWebhookAt: eventAt, lastErrorAt: null, lastErrorMessage: null },
      })

      return artifacts
    })

    let rewardResult: {
      type: string
      label: string
      url: string
      delivery: 'EMAIL' | 'WHATSAPP'
      status: string
      message: string
      supportUrl: string | null
    } | null = null

    if (rewardAvailable) {
      const dispatch = await dispatchWebFormReward({
        empresaId: channel.empresaId,
        sedeId: channel.sedeId,
        delivery: rewardDelivery,
        contactName: nombre,
        toEmail: email,
        toPhone: phone,
        rewardType: purposeConfig.incentive.rewardType,
        rewardUrl,
        rewardLabel: purposeConfig.incentive.rewardLabel,
        emailSubject: purposeConfig.incentive.emailSubject,
        emailMessage: purposeConfig.incentive.emailMessage,
        whatsAppMessage: purposeConfig.incentive.whatsAppMessage,
        supportNumber: purposeConfig.incentive.whatsAppSupport,
        responseEmail: getCrmResponseEmailSettings(channel.settingsJson),
        variables: {
          nombre,
          email,
          telefono: phone,
          servicio: product,
          canal: channel.name,
          cupon: coupon?.code || '',
          enlace: rewardUrl,
          fecha: new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(eventAt),
        },
      })

      rewardResult = {
        type: purposeConfig.incentive.rewardType,
        label: purposeConfig.incentive.rewardLabel,
        url: rewardUrl,
        delivery: dispatch.delivery,
        status: dispatch.status,
        message: dispatch.message,
        supportUrl: dispatch.supportUrl,
      }

      try {
        await prisma.crmLeadCapture.update({
          where: { id: result.capture.id },
          data: {
            normalizedDataJson: {
              ...normalizedDataPayload,
              rewardDelivery: {
                delivery: dispatch.delivery,
                status: dispatch.status,
                message: dispatch.message,
              },
            } as Prisma.InputJsonValue,
          },
        })
      } catch (rewardTraceError) {
        console.error('No se pudo registrar la entrega del regalo web-form:', rewardTraceError)
      }
    }

    const responseEmailSettings = getCrmResponseEmailSettings(channel.settingsJson)
    let responseEmailResult: { status: 'SENT' | 'FAILED' | 'SKIPPED'; message: string } | null = null
    const rewardEmailSent = rewardResult?.delivery === 'EMAIL' && rewardResult.status === 'SENT'

    if (responseEmailSettings.enabled && email && !rewardEmailSent) {
      const rendered = renderCrmResponseEmail({
        settings: responseEmailSettings,
        variables: {
          nombre,
          email,
          telefono: phone,
          servicio: product,
          canal: channel.name,
          cupon: coupon?.code || '',
          enlace: rewardUrl,
          fecha: new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' }).format(eventAt),
        },
      })

      const sent = await sendEmail({
        to: email,
        subject: rendered.subject,
        html: rendered.html,
        fromName: responseEmailSettings.fromName,
        replyTo: responseEmailSettings.replyTo || undefined,
      })

      responseEmailResult = sent.ok
        ? { status: 'SENT', message: 'Correo de respuesta enviado al visitante.' }
        : { status: 'FAILED', message: sent.error }

      try {
        await prisma.crmLeadCapture.update({
          where: { id: result.capture.id },
          data: {
            normalizedDataJson: {
              ...normalizedDataPayload,
              ...(rewardResult
                ? {
                    rewardDelivery: {
                      delivery: rewardResult.delivery,
                      status: rewardResult.status,
                      message: rewardResult.message,
                    },
                  }
                : {}),
              responseEmail: responseEmailResult,
            } as Prisma.InputJsonValue,
          },
        })
      } catch (responseEmailTraceError) {
        console.error('No se pudo registrar el correo de respuesta web-form:', responseEmailTraceError)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        leadId: result.lead.id,
        conversationId: result.conversation.id,
        messageId: result.message.id,
        captureId: result.capture.id,
        testing: channel.status === 'TESTING',
        purpose: purposeConfig.purpose,
        coupon: coupon ? { code: coupon.code, label: coupon.label, message: coupon.message } : null,
        reward: rewardResult,
        responseEmail: responseEmailResult,
        redirect: redirectUrl
          ? {
              url: redirectUrl,
              delaySeconds: purposeConfig.purpose === 'THANK_YOU_REDIRECT' ? purposeConfig.redirect.delaySeconds : 0,
              message: purposeConfig.purpose === 'THANK_YOU_REDIRECT' ? purposeConfig.redirect.message : '',
            }
          : null,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error capturando formulario web CRM:', error)
    return NextResponse.json({ error: 'Error capturando formulario web CRM' }, { status: 500 })
  }
}