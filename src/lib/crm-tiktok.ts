import { Prisma, type CrmChannelProvider } from '@prisma/client'
import { decryptChannelSecret, encryptChannelSecret } from '@/lib/crm-channel-secrets'
import { normalizeString } from '@/lib/crm'
import { parseJsonObject } from '@/lib/crm-omnichannel'

/**
 * Integración nativa de TikTok (ENTREGA 2: esqueleto de arquitectura).
 *
 * Proveedores: TIKTOK_LEADS (Lead Generation) y TIKTOK_MESSAGING (Business Messaging).
 *
 * IMPORTANTE: los endpoints y scopes de OAuth/API de TikTok deben verificarse
 * contra la documentación oficial antes de ENTREGA 3/4. Aquí NO se simulan
 * conexiones: las funciones de API lanzan error explícito hasta contar con
 * credenciales y aprobaciones verificadas.
 */

export const TIKTOK_PROVIDERS: CrmChannelProvider[] = ['TIKTOK_LEADS', 'TIKTOK_MESSAGING']

export type TikTokAdvertiserAccount = { id: string; name: string }
export type TikTokBusinessAccount = { id: string; name: string }

export type TikTokConnectionSnapshot = {
  connectedUserId: string | null
  connectedUserName: string | null
  tokenType: string | null
  tokenKind: string | null
  grantedScopes: string[]
  expiresAt: string | null
  advertiserAccounts: TikTokAdvertiserAccount[]
  businessAccounts: TikTokBusinessAccount[]
}

export function isTikTokProvider(provider: CrmChannelProvider): boolean {
  return provider === 'TIKTOK_LEADS' || provider === 'TIKTOK_MESSAGING'
}

export function getTikTokAccessToken(settingsJson: unknown): string {
  const settings = parseJsonObject(settingsJson)
  const encrypted = normalizeString(settings.tiktokAccessTokenEncrypted)
  if (encrypted) return decryptChannelSecret(encrypted)
  return normalizeString(settings.tiktokAccessToken || settings.accessToken)
}

export function buildTikTokSettingsPatch(args: {
  currentSettingsJson: unknown
  snapshot: TikTokConnectionSnapshot
  accessToken: string
  selectedAdvertiserId?: string | null
  selectedBusinessAccountId?: string | null
}) {
  const settings = parseJsonObject(args.currentSettingsJson)

  const settingsPatch: Record<string, unknown> = {
    ...settings,
    tiktokConnectedAt: new Date().toISOString(),
    tiktokConnectedUserId: args.snapshot.connectedUserId,
    tiktokConnectedUserName: args.snapshot.connectedUserName,
    tiktokGrantedScopes: args.snapshot.grantedScopes,
    tiktokTokenType: args.snapshot.tokenType,
    tiktokTokenKind: args.snapshot.tokenKind,
    tiktokTokenExpiresAt: args.snapshot.expiresAt,
    tiktokLastSyncAt: new Date().toISOString(),
    tiktokAccessTokenEncrypted: encryptChannelSecret(args.accessToken),
    tiktokAdvertiserAccounts: args.snapshot.advertiserAccounts,
    tiktokBusinessAccounts: args.snapshot.businessAccounts,
    tiktokSelectedAdvertiserId: normalizeString(args.selectedAdvertiserId) || normalizeString(settings.tiktokSelectedAdvertiserId) || null,
    tiktokSelectedBusinessAccountId: normalizeString(args.selectedBusinessAccountId) || normalizeString(settings.tiktokSelectedBusinessAccountId) || null,
  }

  return settingsPatch as Prisma.InputJsonValue
}

export function clearTikTokSettings(settingsJson: unknown) {
  const settings = parseJsonObject(settingsJson)
  const next = { ...settings }

  for (const key of [
    'tiktokConnectedAt',
    'tiktokConnectedUserId',
    'tiktokConnectedUserName',
    'tiktokGrantedScopes',
    'tiktokTokenType',
    'tiktokTokenKind',
    'tiktokTokenExpiresAt',
    'tiktokLastSyncAt',
    'tiktokAccessTokenEncrypted',
    'tiktokAdvertiserAccounts',
    'tiktokBusinessAccounts',
    'tiktokSelectedAdvertiserId',
    'tiktokSelectedBusinessAccountId',
  ]) {
    delete next[key]
  }

  return next as Prisma.InputJsonValue
}

// ---------------------------------------------------------------------------
// Funciones de API de TikTok. NO se simulan: requieren credenciales y
// aprobaciones verificadas. Se implementan en ENTREGA 3 (Leads) y 4 (Messaging).
// ---------------------------------------------------------------------------

export async function listTikTokAdvertiserAccounts(_accessToken: string): Promise<TikTokAdvertiserAccount[]> {
  throw new Error('TikTok Ads Leads: consulta de cuentas publicitarias pendiente de ENTREGA 3 (requiere credenciales verificadas).')
}

export async function listTikTokLeadForms(_accessToken: string, _advertiserId: string): Promise<Array<{ id: string; name: string }>> {
  throw new Error('TikTok Ads Leads: consulta de formularios pendiente de ENTREGA 3 (requiere credenciales verificadas).')
}

export async function fetchTikTokLead(_accessToken: string, _leadId: string): Promise<Record<string, unknown>> {
  throw new Error('TikTok Ads Leads: recuperación de lead pendiente de ENTREGA 3 (requiere credenciales verificadas).')
}
