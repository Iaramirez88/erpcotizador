export type BookingBusinessDay = {
  day: number
  enabled: boolean
  start: string
  end: string
}

export type BookingSettings = {
  durationMinutes: number
  slotIntervalMinutes: number
  bufferMinutes: number
  capacityPerSlot: number
  minNoticeMinutes: number
  maxAdvanceDays: number
  timezoneLabel: string
  durationLabel: string
  businessHours: BookingBusinessDay[]
  blockedDates: string[]
}

export type BookingSettingsFormState = {
  bookingDurationMinutes: string
  bookingSlotIntervalMinutes: string
  bookingBufferMinutes: string
  bookingCapacityPerSlot: string
  bookingMinNoticeMinutes: string
  bookingMaxAdvanceDays: string
  bookingTimezoneLabel: string
  bookingDurationLabel: string
  bookingBusinessHours: BookingBusinessDay[]
  bookingBlockedDates: string
}

export const BOOKING_WEEKDAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

function normalizeString(value: unknown) {
  return String(value ?? '').trim()
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(normalizeString(value).replace(/[^0-9-]/g, ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

export function normalizeBookingTime(value: unknown, fallback: string) {
  const raw = normalizeString(value)
  return TIME_PATTERN.test(raw) ? raw : fallback
}

export function bookingTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10))
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0
  return (hours * 60) + minutes
}

export function minutesToBookingTime(totalMinutes: number) {
  const safe = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalMinutes)))
  const hours = `${Math.floor(safe / 60)}`.padStart(2, '0')
  const minutes = `${safe % 60}`.padStart(2, '0')
  return `${hours}:${minutes}`
}

export function formatBookingDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '30 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`
}

export function normalizeBookingDateKey(value: unknown) {
  const raw = normalizeString(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ''
  const [year, month, day] = raw.split('-').map((part) => Number.parseInt(part, 10))
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return ''
  return raw
}

function getDefaultBusinessHours(): BookingBusinessDay[] {
  return [
    { day: 0, enabled: false, start: '09:00', end: '13:00' },
    { day: 1, enabled: true, start: '09:00', end: '18:00' },
    { day: 2, enabled: true, start: '09:00', end: '18:00' },
    { day: 3, enabled: true, start: '09:00', end: '18:00' },
    { day: 4, enabled: true, start: '09:00', end: '18:00' },
    { day: 5, enabled: true, start: '09:00', end: '18:00' },
    { day: 6, enabled: true, start: '09:00', end: '13:00' },
  ]
}

function normalizeBusinessHours(value: unknown): BookingBusinessDay[] {
  const defaults = getDefaultBusinessHours()
  if (!Array.isArray(value)) return defaults

  return defaults.map((fallback) => {
    const match = value.find((item) => item && typeof item === 'object' && Number((item as Record<string, unknown>).day) === fallback.day) as Record<string, unknown> | undefined
    if (!match) return fallback
    const start = normalizeBookingTime(match.start, fallback.start)
    const end = normalizeBookingTime(match.end, fallback.end)
    return {
      day: fallback.day,
      enabled: typeof match.enabled === 'boolean' ? match.enabled : fallback.enabled,
      start,
      end: bookingTimeToMinutes(end) > bookingTimeToMinutes(start) ? end : fallback.end,
    }
  })
}

function normalizeBlockedDates(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : normalizeString(value).split(/[\n,;]+/)
  const unique = new Set<string>()
  list.forEach((item) => {
    const dateKey = normalizeBookingDateKey(item)
    if (dateKey) unique.add(dateKey)
  })
  return [...unique].sort()
}

export function normalizeBookingSettings(settingsJson: unknown): BookingSettings {
  const settings = settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson)
    ? settingsJson as Record<string, unknown>
    : {}

  const durationMinutes = clampNumber(settings.bookingDurationMinutes, 30, 5, 480)
  const slotIntervalMinutes = clampNumber(settings.bookingSlotIntervalMinutes, durationMinutes, 5, 480)

  return {
    durationMinutes,
    slotIntervalMinutes,
    bufferMinutes: clampNumber(settings.bookingBufferMinutes, 0, 0, 240),
    capacityPerSlot: clampNumber(settings.bookingCapacityPerSlot, 1, 1, 50),
    minNoticeMinutes: clampNumber(settings.bookingMinNoticeMinutes, 120, 0, 60 * 24 * 30),
    maxAdvanceDays: clampNumber(settings.bookingMaxAdvanceDays, 60, 1, 365),
    timezoneLabel: normalizeString(settings.bookingTimezoneLabel) || 'America/Bogota',
    durationLabel: normalizeString(settings.bookingDurationLabel),
    businessHours: normalizeBusinessHours(settings.bookingBusinessHours),
    blockedDates: normalizeBlockedDates(settings.bookingBlockedDates),
  }
}

export function getBookingSettings(settingsJson: unknown): BookingSettings {
  const normalized = normalizeBookingSettings(settingsJson)
  return { ...normalized, durationLabel: normalized.durationLabel || formatBookingDuration(normalized.durationMinutes) }
}

export function getDefaultBookingSettingsFormState(): BookingSettingsFormState {
  const defaults = getBookingSettings(null)
  return {
    bookingDurationMinutes: String(defaults.durationMinutes),
    bookingSlotIntervalMinutes: String(defaults.slotIntervalMinutes),
    bookingBufferMinutes: String(defaults.bufferMinutes),
    bookingCapacityPerSlot: String(defaults.capacityPerSlot),
    bookingMinNoticeMinutes: String(defaults.minNoticeMinutes),
    bookingMaxAdvanceDays: String(defaults.maxAdvanceDays),
    bookingTimezoneLabel: defaults.timezoneLabel,
    bookingDurationLabel: defaults.durationLabel,
    bookingBusinessHours: defaults.businessHours,
    bookingBlockedDates: defaults.blockedDates.join('\n'),
  }
}

export function getBookingSettingsFormState(settingsJson: unknown): BookingSettingsFormState {
  const normalized = getBookingSettings(settingsJson)
  return {
    bookingDurationMinutes: String(normalized.durationMinutes),
    bookingSlotIntervalMinutes: String(normalized.slotIntervalMinutes),
    bookingBufferMinutes: String(normalized.bufferMinutes),
    bookingCapacityPerSlot: String(normalized.capacityPerSlot),
    bookingMinNoticeMinutes: String(normalized.minNoticeMinutes),
    bookingMaxAdvanceDays: String(normalized.maxAdvanceDays),
    bookingTimezoneLabel: normalized.timezoneLabel,
    bookingDurationLabel: normalized.durationLabel,
    bookingBusinessHours: normalized.businessHours,
    bookingBlockedDates: normalized.blockedDates.join('\n'),
  }
}

export function pickBookingSettingsFormState(source: Partial<BookingSettingsFormState> | null | undefined): BookingSettingsFormState {
  const defaults = getDefaultBookingSettingsFormState()
  const input = source ?? {}

  return {
    bookingDurationMinutes: normalizeString(input.bookingDurationMinutes) || defaults.bookingDurationMinutes,
    bookingSlotIntervalMinutes: normalizeString(input.bookingSlotIntervalMinutes) || defaults.bookingSlotIntervalMinutes,
    bookingBufferMinutes: normalizeString(input.bookingBufferMinutes) || defaults.bookingBufferMinutes,
    bookingCapacityPerSlot: normalizeString(input.bookingCapacityPerSlot) || defaults.bookingCapacityPerSlot,
    bookingMinNoticeMinutes: normalizeString(input.bookingMinNoticeMinutes) || defaults.bookingMinNoticeMinutes,
    bookingMaxAdvanceDays: normalizeString(input.bookingMaxAdvanceDays) || defaults.bookingMaxAdvanceDays,
    bookingTimezoneLabel: normalizeString(input.bookingTimezoneLabel) || defaults.bookingTimezoneLabel,
    bookingDurationLabel: normalizeString(input.bookingDurationLabel) || defaults.bookingDurationLabel,
    bookingBusinessHours: normalizeBusinessHours(input.bookingBusinessHours ?? defaults.bookingBusinessHours),
    bookingBlockedDates: normalizeString(input.bookingBlockedDates) || defaults.bookingBlockedDates,
  }
}

export function serializeBookingSettingsFormState(state: BookingSettingsFormState) {
  const normalized = getBookingSettings({
    bookingDurationMinutes: state.bookingDurationMinutes,
    bookingSlotIntervalMinutes: state.bookingSlotIntervalMinutes,
    bookingBufferMinutes: state.bookingBufferMinutes,
    bookingCapacityPerSlot: state.bookingCapacityPerSlot,
    bookingMinNoticeMinutes: state.bookingMinNoticeMinutes,
    bookingMaxAdvanceDays: state.bookingMaxAdvanceDays,
    bookingTimezoneLabel: state.bookingTimezoneLabel,
    bookingDurationLabel: state.bookingDurationLabel,
    bookingBusinessHours: state.bookingBusinessHours,
    bookingBlockedDates: state.bookingBlockedDates,
  })

  return {
    bookingDurationMinutes: normalized.durationMinutes,
    bookingSlotIntervalMinutes: normalized.slotIntervalMinutes,
    bookingBufferMinutes: normalized.bufferMinutes,
    bookingCapacityPerSlot: normalized.capacityPerSlot,
    bookingMinNoticeMinutes: normalized.minNoticeMinutes,
    bookingMaxAdvanceDays: normalized.maxAdvanceDays,
    bookingTimezoneLabel: normalized.timezoneLabel,
    bookingDurationLabel: normalized.durationLabel,
    bookingBusinessHours: normalized.businessHours,
    bookingBlockedDates: normalized.blockedDates,
  }
}

export function getBookingWeekdayConfig(settings: BookingSettings, weekday: number) {
  return settings.businessHours.find((item) => item.day === weekday) ?? { day: weekday, enabled: false, start: '09:00', end: '09:00' }
}
