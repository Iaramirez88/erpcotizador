import crypto from 'node:crypto'
import fs from 'fs/promises'
import path from 'path'
import type { CrmChannelConnection, Prisma } from '@prisma/client'
import { normalizeString } from '@/lib/crm'
import { getMetaAccessToken } from '@/lib/crm-meta'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import type { NormalizedWebhookInboundEvent } from '@/lib/crm-webhook-normalizer'

type WebhookChannelRecord = Pick<CrmChannelConnection, 'id' | 'empresaId' | 'provider' | 'settingsJson'>

type StoredInboundAttachment = {
  type: 'image' | 'audio' | 'document'
  url: string
  name: string | null
  alt: string | null
  mimeType: string | null
  providerMediaId?: string | null
  sizeBytes?: number | null
}

const META_GRAPH_VERSION = 'v23.0'

const MIME_EXTENSION_BY_TYPE: Record<string, string> = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'audio/mp3': '.mp3',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/opus': '.ogg',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
  'audio/x-wav': '.wav',
  'application/pdf': '.pdf',
}

function sanitizeFileName(input: string) {
  const normalized = input
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim()

  return normalized || 'adjunto'
}

function ensureExtension(fileName: string, mimeType: string | null, fallbackType: StoredInboundAttachment['type']) {
  if (path.extname(fileName)) return fileName

  const mappedExtension = mimeType ? MIME_EXTENSION_BY_TYPE[mimeType.toLowerCase()] : null
  if (mappedExtension) return `${fileName}${mappedExtension}`
  if (fallbackType === 'image') return `${fileName}.jpg`
  if (fallbackType === 'audio') return `${fileName}.ogg`
  return `${fileName}.bin`
}

function buildPublicInboundMediaDir(channel: WebhookChannelRecord) {
  return path.join(process.cwd(), 'public', 'uploads', 'crm-inbound-media', channel.empresaId, channel.id)
}

function buildPublicInboundMediaUrl(channel: WebhookChannelRecord, fileName: string) {
  return `/uploads/crm-inbound-media/${encodeURIComponent(channel.empresaId)}/${encodeURIComponent(channel.id)}/${encodeURIComponent(fileName)}`
}

function normalizeAttachmentType(rawType: string) {
  const value = normalizeString(rawType).toLowerCase()
  if (value === 'image') return 'image'
  if (value === 'audio') return 'audio'
  if (value === 'file' || value === 'document') return 'document'
  return null
}

function mergeAttachmentMetadata(event: NormalizedWebhookInboundEvent, attachments: StoredInboundAttachment[]) {
  if (!attachments.length) return event

  const base = event.normalizedDataJson && typeof event.normalizedDataJson === 'object' && !Array.isArray(event.normalizedDataJson)
    ? event.normalizedDataJson as Record<string, unknown>
    : {}

  return {
    ...event,
    attachmentsJson: attachments as Prisma.InputJsonValue,
    normalizedDataJson: {
      ...base,
      attachments,
    } as Prisma.InputJsonValue,
  }
}

function normalizeMetaMessagingAttachments(message: Record<string, unknown>) {
  const attachments = Array.isArray(message.attachments) ? message.attachments.map((item) => parseJsonObject(item)) : []

  const normalized = attachments
    .map((attachment): StoredInboundAttachment | null => {
      const payload = parseJsonObject(attachment.payload)
      const type = normalizeAttachmentType(normalizeString(attachment.type))
      const url = normalizeString(payload.url)
      if (!type || !url) return null

      return {
        type,
        url,
        name: normalizeString(payload.title || payload.name || payload.url) || null,
        alt: normalizeString(payload.title || payload.name) || null,
        mimeType: null,
      } satisfies StoredInboundAttachment
    })

  return normalized.filter((item): item is StoredInboundAttachment => item !== null)
}

async function downloadWhatsAppInboundMedia(args: {
  channel: WebhookChannelRecord
  messageType: 'image' | 'audio' | 'document'
  mediaId: string
  mimeType: string | null
  fileName: string | null
  alt: string | null
}) {
  const accessToken = getMetaAccessToken(args.channel.settingsJson)
  if (!accessToken) return null

  const metadataResponse = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${args.mediaId}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })
  const metadataJson = await metadataResponse.json().catch(() => ({})) as Record<string, unknown>

  if (!metadataResponse.ok) {
    const errorMessage = normalizeString(parseJsonObject(metadataJson.error).message) || `Meta media respondió ${metadataResponse.status}`
    throw new Error(errorMessage)
  }

  const downloadUrl = normalizeString(metadataJson.url)
  if (!downloadUrl) return null

  const resolvedMimeType = normalizeString(metadataJson.mime_type) || args.mimeType || null
  const requestedName = normalizeString(args.fileName) || `${args.messageType}-${args.mediaId}`
  const baseName = ensureExtension(sanitizeFileName(requestedName), resolvedMimeType, args.messageType)
  const finalName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${baseName}`
  const outputDir = buildPublicInboundMediaDir(args.channel)
  const outputFile = path.join(outputDir, finalName)

  const fileResponse = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  })

  if (!fileResponse.ok) {
    throw new Error(`No se pudo descargar media Meta (${fileResponse.status}).`)
  }

  const bytes = Buffer.from(await fileResponse.arrayBuffer())
  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputFile, bytes)

  return {
    type: args.messageType,
    url: buildPublicInboundMediaUrl(args.channel, finalName),
    name: baseName,
    alt: args.alt,
    mimeType: resolvedMimeType,
    providerMediaId: args.mediaId,
    sizeBytes: bytes.byteLength,
  } satisfies StoredInboundAttachment
}

async function resolveWhatsAppAttachments(channel: WebhookChannelRecord, event: NormalizedWebhookInboundEvent) {
  const payload = event.rawPayloadJson && typeof event.rawPayloadJson === 'object' && !Array.isArray(event.rawPayloadJson)
    ? event.rawPayloadJson as Record<string, unknown>
    : {}
  const message = parseJsonObject(payload.message)
  const messageType = normalizeString(message.type).toLowerCase()

  if (messageType !== 'image' && messageType !== 'audio' && messageType !== 'document') {
    return event
  }

  const media = parseJsonObject(message[messageType])
  const mediaId = normalizeString(media.id)
  if (!mediaId) return event

  try {
    const stored = await downloadWhatsAppInboundMedia({
      channel,
      messageType,
      mediaId,
      mimeType: normalizeString(media.mime_type) || null,
      fileName: normalizeString(media.filename) || null,
      alt: normalizeString(media.caption || media.filename) || event.messageText || null,
    })

    return stored ? mergeAttachmentMetadata(event, [stored]) : event
  } catch (error) {
    console.error('[CRM Webhook Media] No se pudo persistir media inbound de WhatsApp.', {
      channelId: channel.id,
      provider: channel.provider,
      mediaId,
      error: error instanceof Error ? error.message : 'Error inesperado',
    })
    return event
  }
}

export async function enrichWebhookInboundEventsWithAttachments(args: {
  channel: WebhookChannelRecord
  events: NormalizedWebhookInboundEvent[]
}) {
  return Promise.all(args.events.map(async (event) => {
    if (Array.isArray(event.attachmentsJson) && event.attachmentsJson.length > 0) {
      return event
    }

    if (args.channel.provider === 'WHATSAPP_CLOUD' || args.channel.provider === 'WHATSAPP_SANDBOX') {
      return resolveWhatsAppAttachments(args.channel, event)
    }

    if (args.channel.provider === 'MESSENGER' || args.channel.provider === 'FACEBOOK_PAGE' || args.channel.provider === 'INSTAGRAM_DM') {
      const payload = event.rawPayloadJson && typeof event.rawPayloadJson === 'object' && !Array.isArray(event.rawPayloadJson)
        ? event.rawPayloadJson as Record<string, unknown>
        : {}
      const attachments = normalizeMetaMessagingAttachments(parseJsonObject(payload.message))
      return attachments.length ? mergeAttachmentMetadata(event, attachments) : event
    }

    return event
  }))
}