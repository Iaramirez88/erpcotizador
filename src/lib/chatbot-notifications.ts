import { Prisma, PrismaClient } from '@prisma/client'
import { sendEmail } from '@/lib/email'
import { escapeHtml, renderEmail } from '@/lib/email-template'
import type { ChatbotQuickActionNotificationConfig } from '@/lib/crm-chatbot-flow'
import { normalizeString } from '@/lib/crm'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient, sendWhatsAppTextMessage } from '@/lib/crm-whatsapp'
import { sendTelegramMessage } from '@/lib/telegram'

export type ChatbotNotificationChannel = 'email' | 'whatsapp' | 'telegram'

type ChatbotNotificationDbClient = Prisma.TransactionClient | PrismaClient

type ResolvedChatbotNotificationRecipients = {
  internalUserIds: string[]
  emails: string[]
  whatsapp: string[]
  telegram: string[]
}

function splitConfigValues(value: string) {
  return value.split(/[\n,;|]+/).map((item) => item.trim()).filter(Boolean)
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => normalizeString(item)).filter(Boolean)))
}

export function normalizeChatbotNotificationChannels(values: string[]) {
  const channels = new Set<ChatbotNotificationChannel>()

  for (const value of values) {
    const normalized = normalizeString(value).toLowerCase()
    if (!normalized) continue
    if (normalized === 'email' || normalized === 'correo' || normalized === 'mail') {
      channels.add('email')
      continue
    }
    if (normalized === 'whatsapp' || normalized === 'wa') {
      channels.add('whatsapp')
      continue
    }
    if (normalized === 'telegram' || normalized === 'tg') {
      channels.add('telegram')
    }
  }

  return channels
}

async function resolveChatbotNotificationRecipients(db: ChatbotNotificationDbClient, args: { empresaId: string; rawRecipients: string[] }) {
  const explicitEmails = new Set<string>()
  const explicitPhones = new Set<string>()
  const explicitTelegram = new Set<string>()
  const candidateUserIds = new Set<string>()
  const candidateUserEmails = new Set<string>()

  for (const rawValue of args.rawRecipients) {
    const value = normalizeString(rawValue)
    if (!value) continue
    const lowered = value.toLowerCase()

    if (lowered.startsWith('tg:') || lowered.startsWith('telegram:')) {
      const chatId = value.includes(':') ? value.slice(value.indexOf(':') + 1).trim() : ''
      if (chatId) explicitTelegram.add(chatId)
      continue
    }

    if (lowered.startsWith('wa:') || lowered.startsWith('whatsapp:')) {
      const phone = normalizeWhatsAppRecipient(value.slice(value.indexOf(':') + 1))
      if (phone) explicitPhones.add(phone)
      continue
    }

    if (value.includes('@')) {
      explicitEmails.add(value)
      candidateUserEmails.add(value)
      continue
    }

    const normalizedPhone = normalizeWhatsAppRecipient(value)
    if (normalizedPhone && normalizedPhone.replace(/\D/g, '').length >= 8) {
      explicitPhones.add(normalizedPhone)
      continue
    }

    candidateUserIds.add(value)
  }

  const users = (candidateUserIds.size || candidateUserEmails.size)
    ? await db.user.findMany({
        where: {
          empresaId: args.empresaId,
          OR: [
            ...(candidateUserIds.size ? [{ id: { in: Array.from(candidateUserIds) } }] : []),
            ...(candidateUserEmails.size ? [{ email: { in: Array.from(candidateUserEmails) } }] : []),
          ],
        },
        select: { id: true, email: true, telefono: true },
      })
    : []

  users.forEach((user) => {
    if (user.email) explicitEmails.add(user.email)
    const phone = normalizeWhatsAppRecipient(user.telefono)
    if (phone) explicitPhones.add(phone)
  })

  return {
    internalUserIds: users.map((user) => user.id),
    emails: Array.from(explicitEmails),
    whatsapp: Array.from(explicitPhones),
    telegram: Array.from(explicitTelegram),
  } satisfies ResolvedChatbotNotificationRecipients
}

async function sendChatbotNotificationEmail(args: {
  to: string[]
  actionLabel: string
  companyName: string
  bodyText: string
}) {
  if (!args.to.length) {
    return { sentCount: 0, warnings: [] as string[] }
  }

  const html = renderEmail({
    title: `Automatizacion del chatbot: ${args.actionLabel}`,
    preheader: `Se ejecuto la accion ${args.actionLabel}`,
    intro: args.companyName ? `Empresa: ${args.companyName}` : 'Se ejecuto una automatizacion del chatbot.',
    bodyHtml: args.bodyText
      .split('\n')
      .map((line) => `<p style="margin:0 0 10px; color:#374151;">${escapeHtml(line)}</p>`)
      .join(''),
  })

  const response = await sendEmail({
    to: args.to,
    subject: `Chatbot: ${args.actionLabel}`,
    html,
  })

  if (!response.ok) {
    return { sentCount: 0, warnings: [response.error] }
  }

  return { sentCount: args.to.length, warnings: [] as string[] }
}

async function sendChatbotNotificationWhatsApp(db: ChatbotNotificationDbClient, args: {
  empresaId: string
  sedeId: string | null
  to: string[]
  bodyText: string
}) {
  if (!args.to.length) {
    return { sentCount: 0, warnings: [] as string[] }
  }

  const channels = await db.crmChannelConnection.findMany({
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
    return { sentCount: 0, warnings: ['No hay canal activo de WhatsApp para esta empresa.'] }
  }

  const config = getWhatsAppDispatchConfig(selectedChannel)
  const settled = await Promise.allSettled(args.to.map((phone) => sendWhatsAppTextMessage({
    config,
    to: phone,
    bodyText: args.bodyText,
  })))

  const sentCount = settled.filter((item) => item.status === 'fulfilled').length
  const warnings = settled
    .filter((item): item is PromiseRejectedResult => item.status === 'rejected')
    .map((item) => item.reason instanceof Error ? item.reason.message : 'No se pudo enviar WhatsApp.')

  return { sentCount, warnings }
}

async function sendChatbotNotificationTelegram(args: { to: string[]; bodyText: string }) {
  if (!args.to.length) {
    return { sentCount: 0, warnings: [] as string[] }
  }

  const responses = await Promise.all(args.to.map((chatId) => sendTelegramMessage({ chatId, message: args.bodyText })))
  const sentCount = responses.filter((item) => item.ok).length
  const warnings = responses.filter((item) => !item.ok).map((item) => item.error)
  return { sentCount, warnings }
}

export async function dispatchChatbotActionNotifications(args: {
  db: ChatbotNotificationDbClient
  empresaId: string
  sedeId: string | null
  createdByUserId: string
  fallbackUserIds?: string[]
  notificationConfig: ChatbotQuickActionNotificationConfig
  actionLabel: string
  notificationBodyText: string
  companyName?: string
  internalNotificationBody?: string
  internalNotificationActionUrl?: string
  internalNotificationActionLabel?: string
}) {
  const notificationRecipients = args.notificationConfig.notifyMe
    ? uniqueStrings(splitConfigValues(args.notificationConfig.notifyRecipients))
    : []

  const resolvedRecipients = await resolveChatbotNotificationRecipients(args.db, {
    empresaId: args.empresaId,
    rawRecipients: notificationRecipients,
  })

  const targetUserIds = uniqueStrings([
    ...resolvedRecipients.internalUserIds,
    notificationRecipients.length ? null : args.createdByUserId,
    ...(notificationRecipients.length ? [] : (args.fallbackUserIds ?? [])),
  ])

  if (!notificationRecipients.length && targetUserIds.length) {
    const fallbackUsers = await args.db.user.findMany({
      where: {
        empresaId: args.empresaId,
        id: { in: targetUserIds },
      },
      select: { email: true, telefono: true },
    })
    resolvedRecipients.emails = uniqueStrings([
      ...resolvedRecipients.emails,
      ...fallbackUsers.map((user) => user.email),
    ])
    resolvedRecipients.whatsapp = uniqueStrings([
      ...resolvedRecipients.whatsapp,
      ...fallbackUsers.map((user) => normalizeWhatsAppRecipient(user.telefono)),
    ])
  }

  if (args.internalNotificationBody && targetUserIds.length) {
    await args.db.notification.createMany({
      data: targetUserIds.map((userId) => ({
        type: 'INFO',
        title: args.actionLabel ? `Automatizacion del chatbot: ${args.actionLabel}` : 'Automatizacion del chatbot',
        body: args.internalNotificationBody,
        empresaId: args.empresaId,
        sedeId: args.sedeId,
        userId,
        actionUrl: args.internalNotificationActionUrl || '/dashboard/crm',
        actionLabel: args.internalNotificationActionLabel || 'Abrir CRM',
      })),
    })
  }

  const warnings: string[] = []
  const normalizedChannels = normalizeChatbotNotificationChannels(args.notificationConfig.notifyChannels)
  const counts = {
    internal: targetUserIds.length,
    email: 0,
    whatsapp: 0,
    telegram: 0,
  }

  if (normalizedChannels.has('email')) {
    const result = await sendChatbotNotificationEmail({
      to: resolvedRecipients.emails,
      actionLabel: args.actionLabel,
      companyName: args.companyName || '',
      bodyText: args.notificationBodyText,
    })
    counts.email = result.sentCount
    warnings.push(...result.warnings)
  }

  if (normalizedChannels.has('whatsapp')) {
    const result = await sendChatbotNotificationWhatsApp(args.db, {
      empresaId: args.empresaId,
      sedeId: args.sedeId,
      to: resolvedRecipients.whatsapp,
      bodyText: args.notificationBodyText,
    })
    counts.whatsapp = result.sentCount
    warnings.push(...result.warnings)
  }

  if (normalizedChannels.has('telegram')) {
    const result = await sendChatbotNotificationTelegram({
      to: resolvedRecipients.telegram,
      bodyText: args.notificationBodyText,
    })
    counts.telegram = result.sentCount
    warnings.push(...result.warnings)
  }

  return {
    counts,
    warnings: uniqueStrings(warnings),
    resolvedRecipients,
    normalizedChannels: Array.from(normalizedChannels),
  }
}
