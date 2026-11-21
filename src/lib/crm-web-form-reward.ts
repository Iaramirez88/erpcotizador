import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { escapeHtml, renderEmail } from '@/lib/email-template'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppMediaMessage, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'
import { checkOutboundQuota, formatViolation, recordOutboundUsageEvent, releaseOutboundQuota } from '@/lib/messaging-quota'
import type { WebFormRewardDeliveryMode, WebFormRewardType } from '@/lib/crm-web-form-purpose'
import { loadRewardPdfAttachment, type RewardAttachment } from '@/lib/crm-reward-file'
import {
  renderCrmResponseEmail,
  resolveCrmResponseEmailText,
  type CrmResponseEmailSettings,
  type CrmResponseEmailVariables,
} from '@/lib/crm-response-email'


export type WebFormRewardDispatchStatus = 'SENT' | 'FAILED' | 'UNAVAILABLE'

/**
 * `ATTACHED`: el PDF viajó adjunto en el correo.
 * `LINK_ONLY`: no se pudo adjuntar y se envió el enlace firmado de descarga.
 * `NOT_APPLICABLE`: el regalo es un link o se entregó por WhatsApp.
 */
export type WebFormRewardAttachmentStatus = 'ATTACHED' | 'LINK_ONLY' | 'NOT_APPLICABLE'

export type WebFormRewardDispatchResult = {
  delivery: 'EMAIL' | 'WHATSAPP'
  status: WebFormRewardDispatchStatus
  message: string
  supportUrl: string | null
  attachment: WebFormRewardAttachmentStatus
}

export function resolveWebFormRewardDelivery(mode: WebFormRewardDeliveryMode, requested: unknown): 'EMAIL' | 'WHATSAPP' {
  if (mode === 'EMAIL' || mode === 'WHATSAPP') return mode
  return String(requested ?? '').trim().toUpperCase() === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL'
}

export function buildWhatsAppSupportUrl(rawNumber: string, message: string) {
  const digits = String(rawNumber ?? '').replace(/[^0-9]/g, '')
  if (!digits) return null
  const text = encodeURIComponent(message)
  return `https://wa.me/${digits}?text=${text}`
}

async function dispatchRewardByEmail(args: {
  empresaId: string
  toEmail: string
  contactName: string
  rewardType: WebFormRewardType
  rewardUrl: string
  /** URL original del archivo (sin firmar) para leerlo y adjuntarlo. */
  attachmentSourceUrl?: string | null
  rewardLabel: string
  emailSubject: string
  emailMessage: string
  responseEmail?: CrmResponseEmailSettings | null
  variables?: CrmResponseEmailVariables
}): Promise<WebFormRewardDispatchResult> {
  const to = args.toEmail.trim().toLowerCase()
  if (!to) {
    return {
      delivery: 'EMAIL',
      status: 'UNAVAILABLE',
      message: 'El visitante no dejó correo electrónico.',
      supportUrl: null,
      attachment: 'NOT_APPLICABLE',
    }
  }

  // El regalo llegaba como enlace al dominio y el visitante tenía que abrirlo
  // en el navegador. Si es un PDF, se adjunta al correo para que lo descargue
  // directo desde su bandeja; el enlace queda como respaldo.
  const attachmentResult: { attachment: RewardAttachment | null; reason?: string } = args.rewardType === 'PDF'
    ? await loadRewardPdfAttachment({
        rewardUrl: args.attachmentSourceUrl || args.rewardUrl,
        empresaId: args.empresaId,
        rewardLabel: args.rewardLabel,
      }).then((result) => (result.ok ? { attachment: result.attachment } : { attachment: null, reason: result.reason }))
    : { attachment: null }

  const attachment = attachmentResult.attachment
  if (args.rewardType === 'PDF' && !attachment && attachmentResult.reason) {
    console.warn('No se pudo adjuntar el PDF del regalo; se enviará el enlace de descarga:', attachmentResult.reason)
  }

  const attachmentNote = attachment
    ? 'Tu archivo va adjunto a este correo. Si no lo encuentras, usa el botón de descarga.'
    : ''

  const variables: CrmResponseEmailVariables = {
    nombre: args.contactName,
    email: to,
    ...args.variables,
  }
  const subject = resolveCrmResponseEmailText(args.emailSubject, variables) || args.emailSubject

  const styledEmail = args.responseEmail?.enabled
    ? renderCrmResponseEmail({
        settings: {
          ...args.responseEmail,
          subject: args.emailSubject,
          title: args.responseEmail.title || args.rewardLabel,
          intro: args.emailMessage || args.responseEmail.intro,
          bodyText: [args.responseEmail.bodyText, attachmentNote].filter(Boolean).join('\n'),
          ctaLabel: args.rewardLabel,
          ctaUrl: args.rewardUrl,
        },
        variables,
      })
    : null

  const html = styledEmail?.html ?? renderEmail({
    title: args.emailSubject,
    preheader: args.rewardLabel,
    intro: `Hola ${args.contactName || 'cliente'},`,
    bodyHtml: [
      `<p>${escapeHtml(args.emailMessage)}</p>`,
      attachmentNote ? `<p>${escapeHtml(attachmentNote)}</p>` : '',
      `<p><strong>${escapeHtml(args.rewardLabel)}</strong><br /><a href="${escapeHtml(args.rewardUrl)}">${escapeHtml(args.rewardUrl)}</a></p>`,
    ].join(''),
    cta: { label: args.rewardLabel, href: args.rewardUrl },
    footerNote: 'Recibes este correo porque completaste un formulario en nuestro sitio web.',
  })

  const response = await sendEmail({
    to,
    subject: styledEmail?.subject || subject,
    html,
    fromName: args.responseEmail?.fromName,
    fromEmail: args.responseEmail?.fromEmail || undefined,
    replyTo: args.responseEmail?.replyTo || undefined,
    ...(attachment ? { attachments: [attachment] } : {}),
  })
  if (!response.ok) {
    return { delivery: 'EMAIL', status: 'FAILED', message: response.error, supportUrl: null, attachment: 'NOT_APPLICABLE' }
  }

  return {
    delivery: 'EMAIL',
    status: 'SENT',
    message: attachment ? `Regalo enviado a ${to} con el PDF adjunto.` : `Regalo enviado a ${to} con enlace de descarga.`,
    supportUrl: null,
    attachment: attachment ? 'ATTACHED' : args.rewardType === 'PDF' ? 'LINK_ONLY' : 'NOT_APPLICABLE',
  }
}

async function dispatchRewardByWhatsApp(args: {
  empresaId: string
  sedeId?: string | null
  toPhone: string
  rewardType: WebFormRewardType
  rewardUrl: string
  rewardLabel: string
  whatsAppMessage: string
  supportNumber: string
}): Promise<WebFormRewardDispatchResult> {
  const to = normalizeWhatsAppRecipient(args.toPhone)
  const supportUrl = buildWhatsAppSupportUrl(
    args.supportNumber,
    `${args.whatsAppMessage}\n${args.rewardLabel}: ${args.rewardUrl}`,
  )

  if (!to) {
    return {
      delivery: 'WHATSAPP',
      status: 'UNAVAILABLE',
      message: 'El visitante no dejó un número de WhatsApp.',
      supportUrl,
      attachment: 'NOT_APPLICABLE',
    }
  }

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
    return {
      delivery: 'WHATSAPP',
      status: 'UNAVAILABLE',
      message: 'No hay un canal de WhatsApp Cloud activo para entregar el regalo.',
      supportUrl,
      attachment: 'NOT_APPLICABLE',
    }
  }

  const config = getWhatsAppDispatchConfig(selectedChannel)
  const fileName = `${(args.rewardLabel || 'regalo').replace(/[^a-zA-Z0-9-_ ]+/g, '').trim().slice(0, 60) || 'regalo'}.pdf`

  const quotaCheck = await checkOutboundQuota({ empresaId: args.empresaId, channelConnectionId: selectedChannel.id, provider: selectedChannel.provider, settingsJson: selectedChannel.settingsJson })
  if (!quotaCheck.allowed) {
    return {
      delivery: 'WHATSAPP',
      status: 'FAILED',
      message: quotaCheck.violation ? formatViolation(quotaCheck.violation) : 'Límite de mensajería alcanzado.',
      supportUrl,
      attachment: 'NOT_APPLICABLE',
    }
  }

  try {
    let result
    if (args.rewardType === 'PDF') {
      result = await sendWhatsAppMediaMessage({
        config,
        to,
        attachment: {
          type: 'DOCUMENT',
          url: args.rewardUrl,
          filename: fileName,
          caption: args.whatsAppMessage,
        },
      })
    } else {
      result = await sendWhatsAppTextMessage({
        config,
        to,
        bodyText: `${args.whatsAppMessage}\n${args.rewardLabel}: ${args.rewardUrl}`,
      })
    }

    await recordOutboundUsageEvent({ empresaId: args.empresaId, channelConnectionId: selectedChannel.id, provider: selectedChannel.provider, status: result.providerMessageId ? 'SENT' : 'FAILED', providerMessageId: result.providerMessageId })

    return {
      delivery: 'WHATSAPP',
      status: 'SENT',
      message: 'Regalo enviado por WhatsApp.',
      supportUrl,
      attachment: 'NOT_APPLICABLE',
    }
  } catch (error) {
    await releaseOutboundQuota({ empresaId: args.empresaId, channelConnectionId: selectedChannel.id, provider: selectedChannel.provider })
    return {
      delivery: 'WHATSAPP',
      status: 'FAILED',
      message: error instanceof Error ? error.message : 'No se pudo enviar el regalo por WhatsApp.',
      supportUrl,
      attachment: 'NOT_APPLICABLE',
    }
  }
}

export async function dispatchWebFormReward(args: {
  empresaId: string
  sedeId?: string | null
  delivery: 'EMAIL' | 'WHATSAPP'
  contactName: string
  toEmail: string
  toPhone: string
  rewardType: WebFormRewardType
  rewardUrl: string
  /** URL original del archivo (sin firmar) para leerlo y adjuntarlo. */
  attachmentSourceUrl?: string | null
  rewardLabel: string
  emailSubject: string
  emailMessage: string
  whatsAppMessage: string
  supportNumber: string
  responseEmail?: CrmResponseEmailSettings | null
  variables?: CrmResponseEmailVariables
}): Promise<WebFormRewardDispatchResult> {
  if (args.delivery === 'WHATSAPP') {
    return dispatchRewardByWhatsApp(args)
  }

  return dispatchRewardByEmail({
    empresaId: args.empresaId,
    toEmail: args.toEmail,
    contactName: args.contactName,
    rewardType: args.rewardType,
    rewardUrl: args.rewardUrl,
    attachmentSourceUrl: args.attachmentSourceUrl,
    rewardLabel: args.rewardLabel,
    emailSubject: args.emailSubject,
    emailMessage: args.emailMessage,
    responseEmail: args.responseEmail,
    variables: args.variables,
  })
}
