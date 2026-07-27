import type { CrmActivityType, CrmChannelProvider, CrmLeadCaptureType, CrmLeadSource, CrmMessageType, Prisma } from '@prisma/client'
import { normalizeString } from '@/lib/crm'
import { parseJsonObject, parseMaybeDate } from '@/lib/crm-omnichannel'

type JsonObject = Record<string, unknown>

export type NormalizedWebhookInboundEvent = {
  eventAt: Date
  eventDirection: 'INBOUND' | 'OUTBOUND'
  externalThreadId: string | null
  providerMessageId: string | null
  providerLeadId: string | null
  messageOrigin: 'CUSTOMER' | 'PHONE_APP' | 'CRM_AGENT' | 'BOT' | 'SYSTEM'
  nombre: string | null
  phone: string | null
  email: string | null
  empresaNombre: string | null
  ciudad: string | null
  messageText: string | null
  messageType: CrmMessageType
  sourceCampaign: string | null
  sourceMedium: string | null
  sourceContent: string | null
  rawPayloadJson: Prisma.InputJsonValue
  normalizedDataJson: Prisma.InputJsonValue
}

export type WebhookInboundMapping = {
  source: CrmLeadSource
  captureType: CrmLeadCaptureType
  activityType: CrmActivityType
  sourceLabel: string
}

export type WebhookMessageStatusUpdate = {
  eventAt: Date
  providerMessageId: string | null
  externalThreadId: string | null
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
  rawPayloadJson: Prisma.InputJsonValue
  errorMessage: string | null
  applyToConversationBefore?: boolean
}

export type NormalizedWebhookPayload = {
  events: NormalizedWebhookInboundEvent[]
  statusUpdates: WebhookMessageStatusUpdate[]
  ignoredReason: string | null
}

export function getWebhookInboundMapping(provider: CrmChannelProvider): WebhookInboundMapping {
  if (provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX') {
    return {
      source: 'WHATSAPP',
      captureType: 'WHATSAPP_INBOUND',
      activityType: 'WHATSAPP',
      sourceLabel: 'WhatsApp',
    }
  }

  if (provider === 'INSTAGRAM_DM') {
    return {
      source: 'OTRO',
      captureType: 'MESSENGER_INBOUND',
      activityType: 'OTHER',
      sourceLabel: 'Instagram DM',
    }
  }

  return {
    source: 'OTRO',
    captureType: 'MESSENGER_INBOUND',
    activityType: 'OTHER',
    sourceLabel: 'Messenger/Facebook',
  }
}

export function normalizeWebhookInboundPayload(args: {
  provider: CrmChannelProvider
  body: Record<string, unknown> | null
}): NormalizedWebhookPayload {
  const body = args.body ?? {}

  const whatsappEvents = normalizeWhatsAppMetaPayload(args.provider, body)
  if (whatsappEvents.events.length || whatsappEvents.ignoredReason) return whatsappEvents

  const metaEvents = normalizeMessengerMetaPayload(args.provider, body)
  if (metaEvents.events.length || metaEvents.ignoredReason) return metaEvents

  return normalizeSimplifiedPayload(args.provider, body)
}

function normalizeWhatsAppMetaPayload(provider: CrmChannelProvider, body: Record<string, unknown>): NormalizedWebhookPayload {
  const object = normalizeString(body.object).toLowerCase()
  const entries = Array.isArray(body.entry) ? body.entry : []
  if (provider !== 'WHATSAPP_CLOUD' && provider !== 'WHATSAPP_SANDBOX' && object !== 'whatsapp_business_account') {
    return { events: [], statusUpdates: [], ignoredReason: null }
  }

  const events: NormalizedWebhookInboundEvent[] = []
  const statusUpdates: WebhookMessageStatusUpdate[] = []
  let ignoredReason: string | null = null

  for (const entryValue of entries) {
    const entry = parseJsonObject(entryValue)
    const changes = Array.isArray(entry.changes) ? entry.changes : []

    for (const changeValue of changes) {
      const change = parseJsonObject(changeValue)
      const value = parseJsonObject(change.value)
      const contacts = Array.isArray(value.contacts) ? value.contacts.map((item) => parseJsonObject(item)) : []
      const messages = Array.isArray(value.messages) ? value.messages.map((item) => parseJsonObject(item)) : []
      const statuses = Array.isArray(value.statuses) ? value.statuses.map((item) => parseJsonObject(item)) : []

      if (!messages.length && statuses.length) {
        ignoredReason = 'Evento recibido solo con estados de entrega o lectura.'
      }

      for (const statusRow of statuses) {
        const normalizedStatus = normalizeWhatsAppStatus(statusRow)
        if (!normalizedStatus) continue
        statusUpdates.push({
          eventAt: normalizedStatus.eventAt,
          providerMessageId: normalizedStatus.providerMessageId,
          externalThreadId: normalizedStatus.externalThreadId,
          status: normalizedStatus.status,
          rawPayloadJson: {
            object: body.object ?? null,
            entry,
            change,
            value,
            status: statusRow,
          } as Prisma.InputJsonValue,
          errorMessage: normalizedStatus.errorMessage,
        })
      }

      for (const message of messages) {
        const from = normalizeString(message.from)
        const contact = contacts.find((item) => normalizeString(item.wa_id) === from) ?? contacts[0] ?? {}
        const profile = parseJsonObject(contact.profile)
        const messageTypeRaw = normalizeString(message.type).toLowerCase()
        const normalized = normalizeWhatsAppMessage(messageTypeRaw, message)
        const eventAt = parseMaybeDate(message.timestamp || value.timestamp || entry.time)

        events.push({
          eventAt,
          eventDirection: 'INBOUND',
          externalThreadId: from || normalizeString(value.metadata && parseJsonObject(value.metadata).phone_number_id) || null,
          providerMessageId: normalizeString(message.id) || null,
          providerLeadId: from || null,
          messageOrigin: 'CUSTOMER',
          nombre: normalizeString(profile.name) || null,
          phone: from || null,
          email: null,
          empresaNombre: null,
          ciudad: null,
          messageText: normalized.messageText,
          messageType: normalized.messageType,
          sourceCampaign: normalizeString(parseJsonObject(value.metadata).campaign) || null,
          sourceMedium: normalizeString(parseJsonObject(value.metadata).medium) || provider,
          sourceContent: normalizeString(parseJsonObject(value.metadata).content) || null,
          rawPayloadJson: {
            object: body.object ?? null,
            entry,
            change,
            value,
            contact,
            message,
          } as Prisma.InputJsonValue,
          normalizedDataJson: {
            provider,
            from,
            profileName: normalizeString(profile.name) || null,
            messageType: messageTypeRaw || 'text',
            messageText: normalized.messageText,
            providerMessageId: normalizeString(message.id) || null,
          } as Prisma.InputJsonValue,
        })
      }
    }
  }

  return { events, statusUpdates, ignoredReason }
}

function normalizeMessengerMetaPayload(provider: CrmChannelProvider, body: Record<string, unknown>): NormalizedWebhookPayload {
  const object = normalizeString(body.object).toLowerCase()
  const entries = Array.isArray(body.entry) ? body.entry : []
  const isMetaMessagingProvider = provider === 'MESSENGER' || provider === 'FACEBOOK_PAGE' || provider === 'INSTAGRAM_DM'
  if (!isMetaMessagingProvider && object !== 'page' && object !== 'instagram') {
    return { events: [], statusUpdates: [], ignoredReason: null }
  }

  const events: NormalizedWebhookInboundEvent[] = []
  const statusUpdates: WebhookMessageStatusUpdate[] = []
  let ignoredReason: string | null = null

  for (const entryValue of entries) {
    const entry = parseJsonObject(entryValue)
    const messagingEvents = Array.isArray(entry.messaging) ? entry.messaging.map((item) => parseJsonObject(item)) : []
    const changes = Array.isArray(entry.changes) ? entry.changes.map((item) => parseJsonObject(item)) : []

    for (const messaging of messagingEvents) {
      const sender = parseJsonObject(messaging.sender)
      const recipient = parseJsonObject(messaging.recipient)
      const message = parseJsonObject(messaging.message)
      const postback = parseJsonObject(messaging.postback)
      const delivery = parseJsonObject(messaging.delivery)
      const read = parseJsonObject(messaging.read)
      const isEcho = Boolean(message.is_echo)
      const senderId = normalizeString(sender.id)
      const recipientId = normalizeString(recipient.id)

      const deliveryMids = Array.isArray(delivery.mids) ? delivery.mids.map((item) => normalizeString(item)).filter(Boolean) : []
      const deliveryEventAt = parseMaybeDate(delivery.watermark || messaging.timestamp || entry.time)
      for (const mid of deliveryMids) {
        statusUpdates.push({
          eventAt: deliveryEventAt,
          providerMessageId: mid,
          externalThreadId: senderId || recipientId || null,
          status: 'DELIVERED',
          rawPayloadJson: { object: body.object ?? null, entry, messaging, delivery } as Prisma.InputJsonValue,
          errorMessage: null,
        })
      }

      if (Object.keys(read).length > 0) {
        statusUpdates.push({
          eventAt: parseMaybeDate(read.watermark || messaging.timestamp || entry.time),
          providerMessageId: null,
          externalThreadId: senderId || recipientId || null,
          status: 'READ',
          rawPayloadJson: { object: body.object ?? null, entry, messaging, read } as Prisma.InputJsonValue,
          errorMessage: null,
          applyToConversationBefore: true,
        })
      }

      if (isEcho) {
        const normalizedEcho = normalizeMetaMessagingEvent(message, postback)
        const eventAt = parseMaybeDate(messaging.timestamp || entry.time)

        if (recipientId || normalizedEcho.providerMessageId) {
          events.push({
            eventAt,
            eventDirection: 'OUTBOUND',
            externalThreadId: recipientId || senderId || null,
            providerMessageId: normalizedEcho.providerMessageId,
            providerLeadId: recipientId || null,
            messageOrigin: 'PHONE_APP',
            nombre: normalizeString(parseJsonObject(messaging.contact).name || recipient.name) || null,
            phone: normalizeString(parseJsonObject(messaging.contact).phone || recipient.phone) || null,
            email: normalizeString(parseJsonObject(messaging.contact).email || recipient.email).toLowerCase() || null,
            empresaNombre: normalizeString(parseJsonObject(messaging.contact).company) || null,
            ciudad: normalizeString(parseJsonObject(messaging.contact).city) || null,
            messageText: normalizedEcho.messageText,
            messageType: normalizedEcho.messageType,
            sourceCampaign: normalizeString(parseJsonObject(messaging.metadata).campaign) || null,
            sourceMedium: normalizeString(parseJsonObject(messaging.metadata).medium) || provider,
            sourceContent: normalizeString(parseJsonObject(messaging.metadata).content) || null,
            rawPayloadJson: {
              object: body.object ?? null,
              entry,
              messaging,
              sender,
              recipient,
              message,
              postback,
              isEcho: true,
            } as Prisma.InputJsonValue,
            normalizedDataJson: {
              provider,
              senderId: senderId || null,
              recipientId: recipientId || null,
              messageText: normalizedEcho.messageText,
              messageType: normalizedEcho.messageType,
              providerMessageId: normalizedEcho.providerMessageId,
              isEcho: true,
            } as Prisma.InputJsonValue,
          })
        } else {
          ignoredReason = 'Evento echo saliente sin identificador utilizable.'
        }
        continue
      }

      const normalized = normalizeMetaMessagingEvent(message, postback)
      const eventAt = parseMaybeDate(messaging.timestamp || entry.time)

      if (!senderId && !normalized.providerMessageId) continue

      events.push({
        eventAt,
        eventDirection: 'INBOUND',
        externalThreadId: senderId || normalizeString(recipient.id) || null,
        providerMessageId: normalized.providerMessageId,
        providerLeadId: senderId || null,
        messageOrigin: 'CUSTOMER',
        nombre: normalizeString(parseJsonObject(messaging.contact).name || sender.name) || null,
        phone: normalizeString(parseJsonObject(messaging.contact).phone || sender.phone) || null,
        email: normalizeString(parseJsonObject(messaging.contact).email || sender.email).toLowerCase() || null,
        empresaNombre: normalizeString(parseJsonObject(messaging.contact).company) || null,
        ciudad: normalizeString(parseJsonObject(messaging.contact).city) || null,
        messageText: normalized.messageText,
        messageType: normalized.messageType,
        sourceCampaign: normalizeString(parseJsonObject(messaging.metadata).campaign) || null,
        sourceMedium: normalizeString(parseJsonObject(messaging.metadata).medium) || provider,
        sourceContent: normalizeString(parseJsonObject(messaging.metadata).content) || null,
        rawPayloadJson: {
          object: body.object ?? null,
          entry,
          messaging,
          sender,
          recipient,
          message,
          postback,
        } as Prisma.InputJsonValue,
        normalizedDataJson: {
          provider,
          senderId: senderId || null,
          recipientId: normalizeString(recipient.id) || null,
          messageText: normalized.messageText,
          messageType: normalized.messageType,
          providerMessageId: normalized.providerMessageId,
        } as Prisma.InputJsonValue,
      })
    }

    if (!messagingEvents.length && changes.length) {
      ignoredReason = 'Evento Meta recibido sin bloque messaging utilizable.'
    }
  }

  return { events, statusUpdates, ignoredReason }
}

function normalizeSimplifiedPayload(provider: CrmChannelProvider, body: Record<string, unknown>): NormalizedWebhookPayload {
  const payload = parseJsonObject(body.payload)
  const sender = parseJsonObject(body.sender)
  const contact = parseJsonObject(body.contact)
  const metadata = parseJsonObject(body.metadata)
  const eventAt = parseMaybeDate(body.occurredAt || payload.occurredAt || payload.timestamp)

  const externalThreadId = normalizeString(body.externalThreadId || payload.externalThreadId || payload.chatId || payload.threadId || sender.id)
  const providerMessageId = normalizeString(body.providerMessageId || payload.providerMessageId || payload.messageId || payload.id)
  const providerLeadId = normalizeString(body.providerLeadId || sender.id || contact.id)
  const nombre = normalizeString(body.nombre || contact.name || sender.name)
  const phone = normalizeString(body.telefono || contact.phone || sender.phone || sender.wa_id)
  const email = normalizeString(body.email || contact.email || sender.email).toLowerCase()
  const empresaNombre = normalizeString(body.empresaNombre || contact.company)
  const ciudad = normalizeString(body.ciudad || contact.city)
  const messageText = normalizeString(body.message || body.text || payload.message || payload.text || payload.body)

  if (!externalThreadId && !phone && !email && !providerMessageId) {
    return { events: [], statusUpdates: [], ignoredReason: 'Webhook sin identificador conversacional.' }
  }

  return {
    events: [
      {
        eventAt,
        eventDirection: 'INBOUND',
        externalThreadId: externalThreadId || null,
        providerMessageId: providerMessageId || null,
        providerLeadId: providerLeadId || null,
        messageOrigin: 'CUSTOMER',
        nombre: nombre || null,
        phone: phone || null,
        email: email || null,
        empresaNombre: empresaNombre || null,
        ciudad: ciudad || null,
        messageText: messageText || null,
        messageType: 'TEXT',
        sourceCampaign: normalizeString(metadata.campaign) || null,
        sourceMedium: normalizeString(metadata.medium) || provider,
        sourceContent: normalizeString(metadata.content) || null,
        rawPayloadJson: body as Prisma.InputJsonValue,
        normalizedDataJson: {
          provider,
          externalThreadId: externalThreadId || null,
          providerMessageId: providerMessageId || null,
          providerLeadId: providerLeadId || null,
          nombre: nombre || null,
          email: email || null,
          phone: phone || null,
          empresaNombre: empresaNombre || null,
          ciudad: ciudad || null,
          messageText: messageText || null,
        } as Prisma.InputJsonValue,
      },
    ],
    statusUpdates: [],
    ignoredReason: null,
  }
}

function normalizeWhatsAppStatus(statusRow: JsonObject): {
  eventAt: Date
  providerMessageId: string | null
  externalThreadId: string | null
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
  errorMessage: string | null
} | null {
  const rawStatus = normalizeString(statusRow.status).toLowerCase()
  const providerMessageId = normalizeString(statusRow.id)
  const externalThreadId = normalizeString(statusRow.recipient_id)
  const eventAt = parseMaybeDate(statusRow.timestamp)
  const errors = Array.isArray(statusRow.errors) ? statusRow.errors.map((item) => parseJsonObject(item)) : []
  const errorMessage = normalizeString(errors[0]?.title || errors[0]?.message)

  switch (rawStatus) {
    case 'sent':
      return { eventAt, providerMessageId: providerMessageId || null, externalThreadId: externalThreadId || null, status: 'SENT', errorMessage: null }
    case 'delivered':
      return { eventAt, providerMessageId: providerMessageId || null, externalThreadId: externalThreadId || null, status: 'DELIVERED', errorMessage: null }
    case 'read':
      return { eventAt, providerMessageId: providerMessageId || null, externalThreadId: externalThreadId || null, status: 'READ', errorMessage: null }
    case 'failed':
      return { eventAt, providerMessageId: providerMessageId || null, externalThreadId: externalThreadId || null, status: 'FAILED', errorMessage: errorMessage || 'WhatsApp reportó fallo de entrega.' }
    default:
      return null
  }
}

function normalizeWhatsAppMessage(messageTypeRaw: string, message: JsonObject): { messageType: CrmMessageType; messageText: string | null } {
  const text = parseJsonObject(message.text)
  const image = parseJsonObject(message.image)
  const audio = parseJsonObject(message.audio)
  const document = parseJsonObject(message.document)
  const button = parseJsonObject(message.button)
  const interactive = parseJsonObject(message.interactive)
  const reaction = parseJsonObject(message.reaction)

  switch (messageTypeRaw) {
    case 'text':
      return { messageType: 'TEXT', messageText: normalizeString(text.body) || null }
    case 'image':
      return { messageType: 'IMAGE', messageText: normalizeString(image.caption) || '[Imagen]' }
    case 'audio':
      return { messageType: 'AUDIO', messageText: '[Audio]' }
    case 'document':
      return { messageType: 'DOCUMENT', messageText: normalizeString(document.caption || document.filename) || '[Documento]' }
    case 'button':
      return { messageType: 'EVENT', messageText: normalizeString(button.text) || '[Botón]' }
    case 'interactive': {
      const buttonReply = parseJsonObject(interactive.button_reply)
      const listReply = parseJsonObject(interactive.list_reply)
      const flowReply = parseJsonObject(interactive.nfm_reply)
      return {
        messageType: 'EVENT',
        messageText: normalizeString(buttonReply.title || listReply.title || flowReply.name || interactive.type) || '[Interacción]',
      }
    }
    case 'reaction':
      return { messageType: 'EVENT', messageText: normalizeString(reaction.emoji) ? `Reacción: ${normalizeString(reaction.emoji)}` : '[Reacción]' }
    default:
      return { messageType: 'EVENT', messageText: messageTypeRaw ? `[${messageTypeRaw}]` : null }
  }
}

function normalizeMetaMessagingEvent(message: JsonObject, postback: JsonObject): {
  providerMessageId: string | null
  messageType: CrmMessageType
  messageText: string | null
} {
  const attachments = Array.isArray(message.attachments) ? message.attachments.map((item) => parseJsonObject(item)) : []
  const firstAttachment = attachments[0] ?? {}
  const attachmentPayload = parseJsonObject(firstAttachment.payload)
  const attachmentType = normalizeString(firstAttachment.type).toLowerCase()
  const text = normalizeString(message.text)
  const postbackTitle = normalizeString(postback.title)
  const postbackPayload = normalizeString(postback.payload)

  if (text) {
    return {
      providerMessageId: normalizeString(message.mid) || null,
      messageType: 'TEXT',
      messageText: text,
    }
  }

  if (postbackTitle || postbackPayload) {
    return {
      providerMessageId: normalizeString(postback.mid || message.mid) || null,
      messageType: 'EVENT',
      messageText: postbackTitle || postbackPayload || '[Postback]',
    }
  }

  if (attachmentType === 'image') {
    return {
      providerMessageId: normalizeString(message.mid) || null,
      messageType: 'IMAGE',
      messageText: normalizeString(attachmentPayload.title || attachmentPayload.url) || '[Imagen]',
    }
  }

  if (attachmentType === 'audio') {
    return {
      providerMessageId: normalizeString(message.mid) || null,
      messageType: 'AUDIO',
      messageText: '[Audio]',
    }
  }

  if (attachmentType === 'file') {
    return {
      providerMessageId: normalizeString(message.mid) || null,
      messageType: 'DOCUMENT',
      messageText: normalizeString(attachmentPayload.name || attachmentPayload.url) || '[Archivo]',
    }
  }

  return {
    providerMessageId: normalizeString(message.mid || postback.mid) || null,
    messageType: 'EVENT',
    messageText: attachmentType ? `[${attachmentType}]` : null,
  }
}