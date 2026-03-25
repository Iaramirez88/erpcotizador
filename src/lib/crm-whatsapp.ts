import type { CrmChannelProvider, Prisma } from '@prisma/client'
import { normalizeString } from '@/lib/crm'
import { decryptChannelSecret } from '@/lib/crm-channel-secrets'
import { parseJsonObject } from '@/lib/crm-omnichannel'

type ChannelConfigInput = {
  provider: CrmChannelProvider
  externalPhoneNumberId?: string | null
  externalPageId?: string | null
  settingsJson?: Prisma.JsonValue | null
}

export type WhatsAppDispatchConfig = {
  enabled: boolean
  phoneNumberId: string | null
  accessToken: string | null
  apiVersion: string
}

export type WhatsAppDispatchResult = {
  providerMessageId: string | null
  payloadJson: Prisma.InputJsonValue
}

export type WhatsAppMediaAttachment = {
  type: 'IMAGE' | 'AUDIO' | 'DOCUMENT'
  url: string
  filename?: string | null
  caption?: string | null
}

export function getWhatsAppDispatchConfig(channel: ChannelConfigInput): WhatsAppDispatchConfig {
  const settings = parseJsonObject(channel.settingsJson)
  const phoneNumberId = normalizeString(channel.externalPhoneNumberId || channel.externalPageId || settings.phoneNumberId)
  const encryptedMetaToken = normalizeString(settings.metaAccessTokenEncrypted)
  const accessToken = normalizeString(settings.whatsappAccessToken || settings.metaAccessToken || settings.accessToken || decryptChannelSecret(encryptedMetaToken))
  const apiVersion = normalizeString(settings.whatsappApiVersion || settings.apiVersion) || 'v23.0'
  const enabled = (channel.provider === 'WHATSAPP_CLOUD' || channel.provider === 'WHATSAPP_SANDBOX') && Boolean(phoneNumberId && accessToken)

  return {
    enabled,
    phoneNumberId: phoneNumberId || null,
    accessToken: accessToken || null,
    apiVersion,
  }
}

export function normalizeWhatsAppRecipient(value: string | null | undefined): string {
  const raw = normalizeString(value)
  if (!raw) return ''

  const keepPlus = raw.startsWith('+')
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return ''
  return keepPlus ? `+${digits}` : digits
}

export async function sendWhatsAppTextMessage(args: {
  config: WhatsAppDispatchConfig
  to: string
  bodyText: string
}) : Promise<WhatsAppDispatchResult> {
  if (!args.config.phoneNumberId || !args.config.accessToken) {
    throw new Error('El canal de WhatsApp no tiene credenciales productivas completas.')
  }

  const response = await fetch(`https://graph.facebook.com/${args.config.apiVersion}/${args.config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.config.accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: args.to,
      type: 'text',
      text: {
        preview_url: false,
        body: args.bodyText,
      },
    }),
  })

  const responseJson = await response.json().catch(() => ({})) as Record<string, unknown>
  const messages = Array.isArray(responseJson.messages) ? responseJson.messages.map((item) => parseJsonObject(item)) : []
  const firstMessage = messages[0] ?? {}
  const providerMessageId = normalizeString(firstMessage.id) || null

  if (!response.ok) {
    const errorPayload = parseJsonObject(responseJson.error)
    const errorMessage = normalizeString(errorPayload.message) || `WhatsApp Cloud API respondió ${response.status}`
    throw new Error(errorMessage)
  }

  return {
    providerMessageId,
    payloadJson: {
      provider: 'WHATSAPP_CLOUD',
      response: responseJson,
      request: {
        to: args.to,
        type: 'text',
      },
    } as Prisma.InputJsonValue,
  }
}

export async function sendWhatsAppMediaMessage(args: {
  config: WhatsAppDispatchConfig
  to: string
  attachment: WhatsAppMediaAttachment
}) : Promise<WhatsAppDispatchResult> {
  if (!args.config.phoneNumberId || !args.config.accessToken) {
    throw new Error('El canal de WhatsApp no tiene credenciales productivas completas.')
  }

  const mediaType = args.attachment.type.toLowerCase()
  const mediaPayload = mediaType === 'image'
    ? { link: args.attachment.url, caption: normalizeString(args.attachment.caption) || undefined }
    : mediaType === 'document'
      ? { link: args.attachment.url, caption: normalizeString(args.attachment.caption) || undefined, filename: normalizeString(args.attachment.filename) || undefined }
      : { link: args.attachment.url }

  const response = await fetch(`https://graph.facebook.com/${args.config.apiVersion}/${args.config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.config.accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: args.to,
      type: mediaType,
      [mediaType]: mediaPayload,
    }),
  })

  const responseJson = await response.json().catch(() => ({})) as Record<string, unknown>
  const messages = Array.isArray(responseJson.messages) ? responseJson.messages.map((item) => parseJsonObject(item)) : []
  const firstMessage = messages[0] ?? {}
  const providerMessageId = normalizeString(firstMessage.id) || null

  if (!response.ok) {
    const errorPayload = parseJsonObject(responseJson.error)
    const errorMessage = normalizeString(errorPayload.message) || `WhatsApp Cloud API respondió ${response.status}`
    throw new Error(errorMessage)
  }

  return {
    providerMessageId,
    payloadJson: {
      provider: 'WHATSAPP_CLOUD',
      response: responseJson,
      request: {
        to: args.to,
        type: args.attachment.type,
        attachment: args.attachment,
      },
    } as Prisma.InputJsonValue,
  }
}