import { headers } from 'next/headers'
import {
  type ChatbotFlowStage,
  type ChatbotQuickAction,
  normalizeChatbotFlowStages,
  normalizeChatbotQuickActions,
} from '@/lib/crm-chatbot-flow'

export type PublicChatbotSettings = {
  chatbotTitle: string
  chatbotPrompt: string
  assistantName: string
  accentColor: string
  pageBackgroundColor: string
  backgroundColor: string
  fontFamily: string
  launcherLabel: string
  launcherIcon: string
  launcherPosition: 'right' | 'left'
  launcherSize: 'compact' | 'standard' | 'large'
  chatbotCustomCss: string
  floatingLauncherEnabled: boolean
  publicEmbedEnabled: boolean
  allowHumanHandoff: boolean
  showProductField: boolean
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  productLabel: string
  productPlaceholder: string
  messageLabel: string
  messagePlaceholder: string
  quickActions: ChatbotQuickAction[]
  flowStages: ChatbotFlowStage[]
  allowedDomains: string[]
}

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

function matchesAllowedHost(host: string, allowedHost: string) {
  if (!allowedHost) return false
  if (host === allowedHost) return true
  return host.endsWith(`.${allowedHost}`)
}

export function getPublicChatbotSettings(settingsJson: unknown): PublicChatbotSettings {
  const settings = settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson)
    ? settingsJson as Record<string, unknown>
    : {}

  const rawAllowedDomains = typeof settings.allowedDomains === 'string' ? settings.allowedDomains : ''
  const allowedDomains = rawAllowedDomains
    .split(/[\n,;]+/)
    .map((value) => normalizeHost(value))
    .filter(Boolean)

  return {
    chatbotTitle: typeof settings.chatbotTitle === 'string' && settings.chatbotTitle.trim() ? settings.chatbotTitle.trim() : 'Asesor virtual SGDigital',
    chatbotPrompt: typeof settings.chatbotPrompt === 'string' && settings.chatbotPrompt.trim() ? settings.chatbotPrompt.trim() : 'Cuéntanos tu proyecto y te contactamos.',
    assistantName: typeof settings.assistantName === 'string' && settings.assistantName.trim() ? settings.assistantName.trim() : 'Asesor virtual SGDigital',
    accentColor: typeof settings.accentColor === 'string' && settings.accentColor.trim() ? settings.accentColor.trim() : '#1d4ed8',
    pageBackgroundColor: typeof settings.pageBackgroundColor === 'string' && settings.pageBackgroundColor.trim() ? settings.pageBackgroundColor.trim() : '#eef5ff',
    backgroundColor: typeof settings.backgroundColor === 'string' && settings.backgroundColor.trim() ? settings.backgroundColor.trim() : '#f8fbff',
    fontFamily: typeof settings.fontFamily === 'string' && settings.fontFamily.trim() ? settings.fontFamily.trim() : 'ui-sans-serif, system-ui, sans-serif',
    launcherLabel: typeof settings.launcherLabel === 'string' && settings.launcherLabel.trim() ? settings.launcherLabel.trim() : 'Abrir asesor virtual',
    launcherIcon: typeof settings.launcherIcon === 'string' && settings.launcherIcon.trim() ? settings.launcherIcon.trim() : 'Bot',
    launcherPosition: settings.launcherPosition === 'left' ? 'left' : 'right',
    launcherSize: settings.launcherSize === 'compact' ? 'compact' : settings.launcherSize === 'large' ? 'large' : 'standard',
    chatbotCustomCss: typeof settings.chatbotCustomCss === 'string' ? settings.chatbotCustomCss : '',
    floatingLauncherEnabled: settings.floatingLauncherEnabled !== false,
    publicEmbedEnabled: settings.publicEmbedEnabled !== false,
    allowHumanHandoff: settings.allowHumanHandoff !== false,
    showProductField: settings.showProductField !== false,
    nameLabel: typeof settings.nameLabel === 'string' && settings.nameLabel.trim() ? settings.nameLabel.trim() : 'Nombre',
    namePlaceholder: typeof settings.namePlaceholder === 'string' && settings.namePlaceholder.trim() ? settings.namePlaceholder.trim() : 'Tu nombre',
    emailLabel: typeof settings.emailLabel === 'string' && settings.emailLabel.trim() ? settings.emailLabel.trim() : 'Correo',
    emailPlaceholder: typeof settings.emailPlaceholder === 'string' && settings.emailPlaceholder.trim() ? settings.emailPlaceholder.trim() : 'tu@correo.com',
    phoneLabel: typeof settings.phoneLabel === 'string' && settings.phoneLabel.trim() ? settings.phoneLabel.trim() : 'Teléfono',
    phonePlaceholder: typeof settings.phonePlaceholder === 'string' && settings.phonePlaceholder.trim() ? settings.phonePlaceholder.trim() : 'Tu WhatsApp o teléfono',
    productLabel: typeof settings.productLabel === 'string' && settings.productLabel.trim() ? settings.productLabel.trim() : 'Producto a cotizar',
    productPlaceholder: typeof settings.productPlaceholder === 'string' && settings.productPlaceholder.trim() ? settings.productPlaceholder.trim() : 'Ej: mugs, flyers, etiquetas',
    messageLabel: typeof settings.messageLabel === 'string' && settings.messageLabel.trim() ? settings.messageLabel.trim() : 'Mensaje',
    messagePlaceholder: typeof settings.messagePlaceholder === 'string' && settings.messagePlaceholder.trim() ? settings.messagePlaceholder.trim() : 'Cuéntanos qué necesitas y en qué cantidad.',
    quickActions: normalizeChatbotQuickActions(settings.quickActions),
    flowStages: normalizeChatbotFlowStages(settings.flowStages),
    allowedDomains,
  }
}

export function extractHostFromUrl(rawValue: string | null | undefined) {
  if (!rawValue) return ''
  try {
    return normalizeHost(new URL(rawValue).host)
  } catch {
    return normalizeHost(rawValue)
  }
}

export function isChatbotDomainAllowed(args: {
  allowedDomains: string[]
  candidateHost?: string | null
  appHost?: string | null
}) {
  const candidateHost = normalizeHost(args.candidateHost || '')
  const appHost = normalizeHost(args.appHost || '')

  if (!args.allowedDomains.length) return true
  if (!candidateHost) return false
  if (appHost && candidateHost === appHost) return true

  return args.allowedDomains.some((allowedHost) => matchesAllowedHost(candidateHost, allowedHost))
}

export async function getRequestHost() {
  const requestHeaders = await headers()
  return normalizeHost(requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
}

export async function getReferrerHost() {
  const requestHeaders = await headers()
  return extractHostFromUrl(requestHeaders.get('referer'))
}