import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { escapeHtml, renderEmail } from '@/lib/email-template'
import { normalizeString } from '@/lib/crm'
import { dispatchCrmTaskCalendarBridges } from '@/lib/crm-calendar-bridges'
import { createInboundArtifacts, getConnectionToken, parseJsonObject } from '@/lib/crm-omnichannel'
import { extractHostFromUrl, getPublicWebFormSettings, getReferrerHost, getRequestHost, isPublicWebFormDomainAllowed } from '@/lib/crm-public-web-form'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'

export const runtime = 'nodejs'

type DispatchResult = {
  channel: 'EMAIL' | 'WHATSAPP' | 'SLACK' | 'TEAMS'
  ok: boolean
  message: string
}

function getBooleanSetting(settings: Record<string, unknown>, key: string, fallback: boolean) {
  return typeof settings[key] === 'boolean' ? settings[key] as boolean : fallback
}

function formatBookingDate(value: Date) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(value)
}

function buildBookingSummary(args: {
  contactName: string
  startsAt: Date
  service: string
  message: string
}) {
  const lines = [
    `Cita agendada para ${args.contactName || 'prospecto'}`,
    `Fecha: ${formatBookingDate(args.startsAt)}`,
    args.service ? `Servicio: ${args.service}` : '',
    args.message ? `Notas: ${args.message}` : '',
  ].filter(Boolean)
  return lines.join('\n')
}

async function sendBookingEmail(args: {
  to: string
  contactName: string
  startsAt: Date
  service: string
  channelName: string
}) : Promise<DispatchResult> {
  const formattedDate = formatBookingDate(args.startsAt)
  const html = renderEmail({
    title: 'Confirmación de cita',
    preheader: `Tu cita quedó registrada para ${formattedDate}`,
    intro: `Hola ${args.contactName || 'cliente'},`,
    bodyHtml: [
      '<p>Tu cita fue registrada correctamente en nuestro CRM.</p>',
      `<p><strong>Canal:</strong> ${escapeHtml(args.channelName)}</p>`,
      `<p><strong>Fecha:</strong> ${escapeHtml(formattedDate)}</p>`,
      args.service ? `<p><strong>Servicio:</strong> ${escapeHtml(args.service)}</p>` : '',
    ].filter(Boolean).join(''),
    footerNote: 'Si necesitas reprogramar, responde este correo o contáctanos por WhatsApp.',
  })

  const response = await sendEmail({
    to: args.to,
    subject: `Confirmación de cita · ${formattedDate}`,
    html,
  })

  if (!response.ok) {
    return { channel: 'EMAIL', ok: false, message: response.error }
  }

  return { channel: 'EMAIL', ok: true, message: 'Correo de confirmación enviado.' }
}

async function sendBookingWhatsApp(args: {
  empresaId: string
  sedeId?: string | null
  to: string
  contactName: string
  startsAt: Date
  service: string
}) : Promise<DispatchResult> {
  const channels = await prisma.crmChannelConnection.findMany({
    where: {
      empresaId: args.empresaId,
      provider: { in: ['WHATSAPP_CLOUD', 'WHATSAPP_SANDBOX'] },
      status: { in: ['TESTING', 'ACTIVE'] },
      OR: args.sedeId ? [{ sedeId: args.sedeId }, { sedeId: null }] : [{ sedeId: null }, {}],
    },
    orderBy: [{ sedeId: 'desc' }, { updatedAt: 'desc' }],
  })

  const selectedChannel = channels.find((channel) => getWhatsAppDispatchConfig(channel).enabled)
  if (!selectedChannel) {
    return { channel: 'WHATSAPP', ok: false, message: 'No hay canal activo de WhatsApp para enviar la confirmación.' }
  }

  const config = getWhatsAppDispatchConfig(selectedChannel)
  try {
    await sendWhatsAppTextMessage({
      config,
      to: args.to,
      bodyText: [
        `Hola ${args.contactName || 'cliente'}, tu cita quedó registrada.`,
        `Fecha: ${formatBookingDate(args.startsAt)}`,
        args.service ? `Servicio: ${args.service}` : '',
      ].filter(Boolean).join('\n'),
    })
    return { channel: 'WHATSAPP', ok: true, message: 'WhatsApp de confirmación enviado.' }
  } catch (error) {
    return { channel: 'WHATSAPP', ok: false, message: error instanceof Error ? error.message : 'No se pudo enviar WhatsApp.' }
  }
}

async function dispatchInternalWebhookBridges(args: {
  empresaId: string
  sedeId?: string | null
  contactName: string
  startsAt: Date
  service: string
  notes: string
}) : Promise<DispatchResult[]> {
  const rows = await prisma.crmChannelConnection.findMany({
    where: {
      empresaId: args.empresaId,
      provider: 'WEB_FORM',
      status: { in: ['TESTING', 'ACTIVE'] },
      OR: args.sedeId ? [{ sedeId: args.sedeId }, { sedeId: null }] : [{ sedeId: null }, {}],
    },
    orderBy: [{ sedeId: 'desc' }, { updatedAt: 'desc' }],
  })

  const bridgeRows = rows.filter((row) => {
    const settings = parseJsonObject(row.settingsJson)
    const bridgeKind = normalizeString(settings.bridgeKind).toUpperCase()
    return bridgeKind === 'SLACK' || bridgeKind === 'TEAMS'
  })

  const payloadText = [
    'Nueva cita web registrada en CRM.',
    `Contacto: ${args.contactName || 'Prospecto'}`,
    `Fecha: ${formatBookingDate(args.startsAt)}`,
    args.service ? `Servicio: ${args.service}` : '',
    args.notes ? `Notas: ${args.notes}` : '',
  ].filter(Boolean).join('\n')

  return Promise.all(bridgeRows.map(async (row) => {
    const settings = parseJsonObject(row.settingsJson)
    const bridgeKind = normalizeString(settings.bridgeKind).toUpperCase()
    const webhookUrl = normalizeString(settings.outgoingWebhookUrl || settings.webhookUrl)
    if (!webhookUrl) {
      return {
        channel: bridgeKind === 'SLACK' ? 'SLACK' as const : 'TEAMS' as const,
        ok: false,
        message: `El bridge ${row.name} no tiene webhook configurado.`,
      }
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bridgeKind === 'SLACK'
        ? { text: payloadText }
        : {
            '@type': 'MessageCard',
            '@context': 'https://schema.org/extensions',
            summary: 'Nueva cita web',
            themeColor: '2563EB',
            title: 'Nueva cita web registrada',
            text: payloadText.replace(/\n/g, '<br/>'),
          }),
    })

    if (!response.ok) {
      return {
        channel: bridgeKind === 'SLACK' ? 'SLACK' as const : 'TEAMS' as const,
        ok: false,
        message: `${row.name} respondió ${response.status}.`,
      }
    }

    return {
      channel: bridgeKind === 'SLACK' ? 'SLACK' as const : 'TEAMS' as const,
      ok: true,
      message: `Notificación enviada a ${row.name}.`,
    }
  }))
}

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

    const bridgeKind = normalizeString(parseJsonObject(channel?.settingsJson).bridgeKind).toUpperCase()
    if (!channel || channel.provider !== 'WEB_FORM' || bridgeKind !== 'BOOKING') {
      return NextResponse.json({ error: 'Canal booking no encontrado' }, { status: 404 })
    }

    if (!['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ error: 'Canal no disponible para capturas' }, { status: 409 })
    }

    const payload = parseJsonObject(body?.payload)
    const nombre = normalizeString(body?.nombre || payload.nombre || payload.name)
    const email = normalizeString(body?.email || payload.email).toLowerCase()
    const phone = normalizeString(body?.telefono || body?.celular || payload.telefono || payload.phone)
    const service = normalizeString(body?.producto || body?.servicio || payload.producto || payload.servicio || payload.service)
    const baseMessage = normalizeString(body?.mensaje || payload.mensaje || payload.message)
    const startsAtRaw = normalizeString(body?.startsAt || body?.fechaHora || payload.startsAt || payload.fechaHora)
    const landingPageUrl = normalizeString(body?.landingPageUrl || payload.landingPageUrl || payload.pageUrl)
    const referrerUrl = normalizeString(body?.referrerUrl || payload.referrerUrl)
    const utmSource = normalizeString(body?.utmSource || payload.utmSource)
    const utmMedium = normalizeString(body?.utmMedium || payload.utmMedium) || 'booking-widget'
    const utmCampaign = normalizeString(body?.utmCampaign || payload.utmCampaign)
    const utmContent = normalizeString(body?.utmContent || payload.utmContent)
    const utmTerm = normalizeString(body?.utmTerm || payload.utmTerm)
    const startsAt = startsAtRaw ? new Date(startsAtRaw) : null

    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: 'startsAt es requerido y debe ser válido' }, { status: 400 })
    }

    if (!nombre || (!email && !phone)) {
      return NextResponse.json({ error: 'Se requiere nombre y al menos email o teléfono' }, { status: 400 })
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

    if (expectedToken && providedToken !== expectedToken && !publicEmbedAllowed) {
      return NextResponse.json({ error: 'Token inválido para agenda web' }, { status: 403 })
    }

    const eventAt = new Date()
    const messageText = buildBookingSummary({
      contactName: nombre,
      startsAt,
      service,
      message: baseMessage,
    })
    const externalThreadId = ['booking', channel.id, email || phone || nombre, startsAt.toISOString()].join(':')

    const artifacts = await prisma.$transaction(async (tx) => {
      const created = await createInboundArtifacts({
        client: tx,
        empresaId: channel.empresaId,
        sedeId: channel.sedeId,
        createdById: channel.createdBy.id,
        ownerUserId: channel.createdBy.id,
        channelConnectionId: channel.id,
        source: 'WEB',
        captureType: 'WEB_FORM',
        activityType: 'MEETING',
        messageType: 'EVENT',
        eventAt,
        nombre,
        email,
        phone,
        ciudad: '',
        messageText,
        externalThreadId,
        sourceLabel: 'Agenda web',
        sourceMedium: utmMedium,
        sourceCampaign: utmCampaign || null,
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
          service,
          startsAt: startsAt.toISOString(),
          message: baseMessage,
          landingPageUrl,
          referrerUrl,
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          utmTerm,
        },
      })

      const task = await tx.crmTask.create({
        data: {
          empresaId: channel.empresaId,
          sedeId: channel.sedeId,
          title: `Cita agendada: ${service || nombre}`,
          description: messageText,
          status: 'OPEN',
          priority: 'HIGH',
          dueAt: startsAt,
          leadId: created.lead.id,
          assignedToUserId: created.conversation.assignedToUserId || created.lead.ownerUserId || channel.createdBy.id,
          createdById: channel.createdBy.id,
        },
      })

      await tx.crmChannelConnection.update({
        where: { id: channel.id },
        data: { lastWebhookAt: eventAt, lastErrorAt: null, lastErrorMessage: null },
      })

      return { ...created, task }
    })

    const settings = parseJsonObject(channel.settingsJson)
    const notificationResults: DispatchResult[] = []
    if (getBooleanSetting(settings, 'bookingNotifyByEmail', true) && email) {
      notificationResults.push(await sendBookingEmail({
        to: email,
        contactName: nombre,
        startsAt,
        service,
        channelName: channel.name,
      }))
    }

    const normalizedRecipient = normalizeWhatsAppRecipient(phone)
    if (getBooleanSetting(settings, 'bookingNotifyByWhatsApp', true) && normalizedRecipient) {
      notificationResults.push(await sendBookingWhatsApp({
        empresaId: channel.empresaId,
        sedeId: channel.sedeId,
        to: normalizedRecipient,
        contactName: nombre,
        startsAt,
        service,
      }))
    }

    notificationResults.push(...await dispatchInternalWebhookBridges({
      empresaId: channel.empresaId,
      sedeId: channel.sedeId,
      contactName: nombre,
      startsAt,
      service,
      notes: baseMessage,
    }))

    const calendarSyncs = await dispatchCrmTaskCalendarBridges({
      empresaId: channel.empresaId,
      sedeId: channel.sedeId,
      eventName: 'crm.task.booked',
      task: {
        id: artifacts.task.id,
        title: artifacts.task.title,
        description: artifacts.task.description,
        status: artifacts.task.status,
        priority: artifacts.task.priority,
        dueAt: artifacts.task.dueAt,
        leadId: artifacts.task.leadId,
        opportunityId: artifacts.task.opportunityId,
        clienteId: artifacts.task.clienteId,
        assignedToUserId: artifacts.task.assignedToUserId,
        createdById: artifacts.task.createdById,
        colorHex: artifacts.task.colorHex,
      },
      lead: {
        id: artifacts.lead.id,
        nombre: artifacts.lead.nombre,
        email: artifacts.lead.email,
        phone: artifacts.lead.telefono,
      },
      meta: {
        bookingChannelId: channel.id,
        bookingChannelName: channel.name,
        service,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        leadId: artifacts.lead.id,
        conversationId: artifacts.conversation.id,
        messageId: artifacts.message.id,
        captureId: artifacts.capture.id,
        taskId: artifacts.task.id,
        notifications: notificationResults,
        calendarSyncs,
        testing: channel.status === 'TESTING',
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error capturando agenda web CRM:', error)
    return NextResponse.json({ error: 'Error capturando agenda web CRM' }, { status: 500 })
  }
}