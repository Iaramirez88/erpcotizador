import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { escapeHtml, renderEmail } from '@/lib/email-template'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppMediaMessage, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'
import type { WebFormRewardDeliveryMode, WebFormRewardType } from '@/lib/crm-web-form-purpose'
import {
  renderCrmResponseEmail,
  resolveCrmResponseEmailText,
  type CrmResponseEmailSettings,
  type CrmResponseEmailVariables,
} from '@/lib/crm-response-email'


export type WebFormRewardDispatchStatus = 'SENT' | 'FAILED' | 'UNAVAILABLE'

export type WebFormRewardDispatchResult = {
  delivery: 'EMAIL' | 'WHATSAPP'
  status: WebFormRewardDispatchStatus
  message: string
  supportUrl: string | null
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
  toEmail: string
  contactName: string
  rewardUrl: string
  rewardLabel: string
  emailSubject: string
  emailMessage: string
  responseEmail?: CrmResponseEmailSettings | null
  variables?: CrmResponseEmailVariables
}): Promise<WebFormRewardDispatchResult> {
  const to = args.toEmail.trim().toLowerCase()
  if (!to) {
    return { delivery: 'EMAIL', status: 'UNAVAILABLE', message: 'El visitante no dejó correo electrónico.', supportUrl: null }
  }

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
          bodyText: args.responseEmail.bodyText,
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
    replyTo: args.responseEmail?.replyTo || undefined,
  })
  if (!response.ok) {
    return { delivery: 'EMAIL', status: 'FAILED', message: response.error, supportUrl: null }
  }

  return { delivery: 'EMAIL', status: 'SENT', message: `Regalo enviado a ${to}.`, supportUrl: null }
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
    return { delivery: 'WHATSAPP', status: 'UNAVAILABLE', message: 'El visitante no dejó un número de WhatsApp.', supportUrl }
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
    }
  }

  const config = getWhatsAppDispatchConfig(selectedChannel)
  const fileName = `${(args.rewardLabel || 'regalo').replace(/[^a-zA-Z0-9-_ ]+/g, '').trim().slice(0, 60) || 'regalo'}.pdf`

  try {
    if (args.rewardType === 'PDF') {
      await sendWhatsAppMediaMessage({
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
      await sendWhatsAppTextMessage({
        config,
        to,
        bodyText: `${args.whatsAppMessage}\n${args.rewardLabel}: ${args.rewardUrl}`,
      })
    }

    return { delivery: 'WHATSAPP', status: 'SENT', message: 'Regalo enviado por WhatsApp.', supportUrl }
  } catch (error) {
    return {
      delivery: 'WHATSAPP',
      status: 'FAILED',
      message: error instanceof Error ? error.message : 'No se pudo enviar el regalo por WhatsApp.',
      supportUrl,
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
    toEmail: args.toEmail,
    contactName: args.contactName,
    rewardUrl: args.rewardUrl,
    rewardLabel: args.rewardLabel,
    emailSubject: args.emailSubject,
    emailMessage: args.emailMessage,
    responseEmail: args.responseEmail,
    variables: args.variables,
  })
}
