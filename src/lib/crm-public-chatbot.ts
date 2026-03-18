import { headers } from 'next/headers'

export type PublicChatbotSettings = {
  chatbotTitle: string
  chatbotPrompt: string
  assistantName: string
  accentColor: string
  publicEmbedEnabled: boolean
  allowHumanHandoff: boolean
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
    publicEmbedEnabled: settings.publicEmbedEnabled !== false,
    allowHumanHandoff: settings.allowHumanHandoff !== false,
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