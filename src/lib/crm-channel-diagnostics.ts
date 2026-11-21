import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'

/**
 * Diagnóstico operativo de bridges de captura (Gmail, Outlook, TikTok, YouTube,
 * Meta Lead Ads, formularios externos). Deriva un estado legible para que cada
 * empresa pueda verificar su integración sin entrar a Google Apps Script.
 */

const BRIDGE_KINDS = new Set(['GMAIL', 'OUTLOOK', 'TIKTOK', 'YOUTUBE', 'META_LEAD_ADS', 'EXTERNAL_FORM'])

export type BridgeDiagnostics = {
  connected: boolean
  listening: boolean
  detectedEmails: number
  syncedProspects: number
  lastSyncAt: string | null
  lastErrorType: 'CHANNEL' | 'AUTH' | null
  lastErrorMessage: string | null
}

const LISTENING_WINDOW_MS = 24 * 60 * 60 * 1000

export function isBridgeDiagnosticsApplicable(bridgeKind: unknown): boolean {
  return BRIDGE_KINDS.has(normalizeString(bridgeKind).toUpperCase())
}

function classifyErrorType(message: string | null): 'CHANNEL' | 'AUTH' | null {
  const normalized = normalizeString(message)
  if (!normalized) return null
  const lower = normalized.toLowerCase()
  if (lower.startsWith('[auth]')) return 'AUTH'
  if (lower.startsWith('[channel]')) return 'CHANNEL'
  if (/(auth|credential|token|401|invalid|no autoriz|permis|unauthoriz)/.test(lower)) return 'AUTH'
  return 'CHANNEL'
}

export async function computeBridgeDiagnostics(args: {
  channelId: string
  verifyToken: string | null
  lastWebhookAt: Date | null
  lastErrorAt: Date | null
  lastErrorMessage: string | null
}): Promise<BridgeDiagnostics> {
  const [detectedEmails, syncedProspects] = await Promise.all([
    prisma.crmMessage.count({ where: { conversation: { channelConnectionId: args.channelId }, direction: 'INBOUND' } }),
    prisma.crmLeadCapture.count({ where: { channelConnectionId: args.channelId } }),
  ])

  const lastSyncAt = args.lastWebhookAt

  return {
    connected: Boolean(args.verifyToken),
    listening: Boolean(lastSyncAt && Date.now() - lastSyncAt.getTime() <= LISTENING_WINDOW_MS),
    detectedEmails,
    syncedProspects,
    lastSyncAt: lastSyncAt ? lastSyncAt.toISOString() : null,
    lastErrorType: args.lastErrorAt ? classifyErrorType(args.lastErrorMessage) : null,
    lastErrorMessage: args.lastErrorMessage,
  }
}
