export type ChatbotInactivityUnit = 'minutes' | 'hours' | 'days'

export type ChatbotInactivityAction = 'restart' | 'close'

export type ChatbotInactivityRule = {
  enabled: boolean
  timeoutValue: number
  timeoutUnit: ChatbotInactivityUnit
  timeoutMinutes: number
  action: ChatbotInactivityAction
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizePositiveInt(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.round(value))
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(parsed)) return Math.max(1, parsed)
  }
  return fallback
}

export function normalizeChatbotInactivityUnit(value: unknown): ChatbotInactivityUnit {
  if (value === 'minutes' || value === 'days') return value
  return 'hours'
}

export function normalizeChatbotInactivityAction(value: unknown): ChatbotInactivityAction {
  return value === 'close' ? 'close' : 'restart'
}

export function toChatbotInactivityMinutes(value: number, unit: ChatbotInactivityUnit) {
  if (unit === 'minutes') return value
  if (unit === 'days') return value * 24 * 60
  return value * 60
}

export function getDefaultChatbotInactivityRule(overrides?: Partial<Omit<ChatbotInactivityRule, 'timeoutMinutes'>>) {
  const timeoutValue = Math.max(1, Math.round(overrides?.timeoutValue ?? 12))
  const timeoutUnit = overrides?.timeoutUnit ?? 'hours'

  return {
    enabled: overrides?.enabled ?? false,
    timeoutValue,
    timeoutUnit,
    timeoutMinutes: toChatbotInactivityMinutes(timeoutValue, timeoutUnit),
    action: overrides?.action ?? 'restart',
  } satisfies ChatbotInactivityRule
}

export function normalizeChatbotInactivityRule(value: unknown, fallback?: Partial<Omit<ChatbotInactivityRule, 'timeoutMinutes'>>) {
  const defaults = getDefaultChatbotInactivityRule(fallback)
  const record = asRecord(value)
  if (!record) return defaults

  const timeoutValue = normalizePositiveInt(record.timeoutValue, defaults.timeoutValue)
  const timeoutUnit = normalizeChatbotInactivityUnit(record.timeoutUnit)

  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : defaults.enabled,
    timeoutValue,
    timeoutUnit,
    timeoutMinutes: toChatbotInactivityMinutes(timeoutValue, timeoutUnit),
    action: normalizeChatbotInactivityAction(record.action),
  } satisfies ChatbotInactivityRule
}