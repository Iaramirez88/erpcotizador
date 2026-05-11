export type CrmOriginProvider = 'WHATSAPP_CLOUD' | 'WHATSAPP_SANDBOX' | 'FACEBOOK_PAGE' | 'MESSENGER' | 'WEB_FORM' | 'WEB_CHATBOT' | 'INSTAGRAM_DM'
export type CrmBridgeKind = 'GENERIC' | 'BOOKING' | 'GMAIL' | 'OUTLOOK' | 'GOOGLE_SHEETS' | 'GOOGLE_CALENDAR' | 'MICROSOFT_365_CALENDAR' | 'SLACK' | 'TEAMS' | 'META_LEAD_ADS' | 'EXTERNAL_FORM' | 'TIKTOK' | 'YOUTUBE'
export type CrmLeadSource = 'WEB' | 'REFERIDO' | 'WHATSAPP' | 'LLAMADA' | 'IMPORT' | 'OTRO'

export type CrmOriginKey =
  | 'EMAIL_GMAIL'
  | 'EMAIL_OUTLOOK'
  | 'GOOGLE_SHEETS'
  | 'FORM_WEB'
  | 'CHATBOT_WEB'
  | 'LEAD_TIKTOK'
  | 'LEAD_YOUTUBE'
  | 'WHATSAPP'
  | 'MESSENGER_FACEBOOK'
  | 'INSTAGRAM_DM'
  | 'PHONE_CALL'
  | 'REFERRAL'
  | 'IMPORT'
  | 'OTHER'

export type CrmOriginMeta = {
  key: CrmOriginKey
  label: string
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function getBridgeKindFromSettings(settingsJson: unknown): CrmBridgeKind | null {
  if (!settingsJson || typeof settingsJson !== 'object' || Array.isArray(settingsJson)) return null
  const bridgeKind = normalizeString((settingsJson as Record<string, unknown>).bridgeKind).toUpperCase()
  if (!bridgeKind) return null
  return bridgeKind as CrmBridgeKind
}

export function getCrmOriginMeta(args: {
  provider?: CrmOriginProvider | null
  bridgeKind?: CrmBridgeKind | null
  source?: CrmLeadSource | string | null
}): CrmOriginMeta {
  if (args.provider === 'WEB_FORM') {
    if (args.bridgeKind === 'BOOKING') return { key: 'FORM_WEB', label: 'Agenda web' }
    if (args.bridgeKind === 'GMAIL') return { key: 'EMAIL_GMAIL', label: 'Correo Gmail' }
    if (args.bridgeKind === 'OUTLOOK') return { key: 'EMAIL_OUTLOOK', label: 'Correo Outlook' }
    if (args.bridgeKind === 'GOOGLE_SHEETS') return { key: 'GOOGLE_SHEETS', label: 'Google Sheets' }
    if (args.bridgeKind === 'GOOGLE_CALENDAR') return { key: 'OTHER', label: 'Google Calendar' }
    if (args.bridgeKind === 'MICROSOFT_365_CALENDAR') return { key: 'OTHER', label: 'Microsoft 365 Calendar' }
    if (args.bridgeKind === 'SLACK') return { key: 'OTHER', label: 'Slack' }
    if (args.bridgeKind === 'TEAMS') return { key: 'OTHER', label: 'Microsoft Teams' }
    if (args.bridgeKind === 'META_LEAD_ADS') return { key: 'MESSENGER_FACEBOOK', label: 'Meta Lead Ads' }
    if (args.bridgeKind === 'EXTERNAL_FORM') return { key: 'FORM_WEB', label: 'Formulario externo' }
    if (args.bridgeKind === 'TIKTOK') return { key: 'LEAD_TIKTOK', label: 'Lead TikTok' }
    if (args.bridgeKind === 'YOUTUBE') return { key: 'LEAD_YOUTUBE', label: 'Lead YouTube' }
    return { key: 'FORM_WEB', label: 'Formulario web' }
  }

  if (args.provider === 'WEB_CHATBOT') return { key: 'CHATBOT_WEB', label: 'Chatbot web' }
  if (args.provider === 'WHATSAPP_CLOUD' || args.provider === 'WHATSAPP_SANDBOX') return { key: 'WHATSAPP', label: 'WhatsApp' }
  if (args.provider === 'FACEBOOK_PAGE' || args.provider === 'MESSENGER') return { key: 'MESSENGER_FACEBOOK', label: 'Messenger/Facebook' }
  if (args.provider === 'INSTAGRAM_DM') return { key: 'INSTAGRAM_DM', label: 'Instagram DM' }

  const source = normalizeString(args.source).toUpperCase()
  if (source === 'WEB') return { key: 'FORM_WEB', label: 'Formulario web' }
  if (source === 'REFERIDO') return { key: 'REFERRAL', label: 'Referido' }
  if (source === 'WHATSAPP') return { key: 'WHATSAPP', label: 'WhatsApp' }
  if (source === 'LLAMADA') return { key: 'PHONE_CALL', label: 'Llamada' }
  if (source === 'IMPORT') return { key: 'IMPORT', label: 'Importado' }
  return { key: 'OTHER', label: source || 'Otro' }
}
