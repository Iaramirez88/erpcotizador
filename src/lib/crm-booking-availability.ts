import {
  bookingTimeToMinutes,
  formatBookingDuration,
  getBookingWeekdayConfig,
  minutesToBookingTime,
  type BookingSettings,
} from '@/lib/crm-booking-settings'

export type BookingAppointment = {
  startsAt: Date
  durationMinutes: number
}

export type BookingSlotState = {
  time: string
  startsAt: string
  endsAt: string
  available: boolean
  remaining: number
  booked: number
  reason: 'AVAILABLE' | 'FULL' | 'PAST' | 'NOTICE'
}

export type BookingDayState = {
  dateKey: string
  weekday: number
  isBusinessDay: boolean
  isBlocked: boolean
  isPast: boolean
  slots: BookingSlotState[]
  availableCount: number
  bookedCount: number
  totalSlots: number
}

export function toBookingDateKey(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseBookingDateKey(dateKey: string, time = '00:00') {
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10))
  const [hours, minutes] = time.split(':').map((part) => Number.parseInt(part, 10))
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0)
}

export function addBookingDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

export function resolveBookingAppointmentDuration(description: string | null | undefined, fallbackMinutes: number) {
  const match = /duración:\s*(.+)/i.exec(description || '')
  if (!match) return fallbackMinutes

  const raw = match[1]
  const hoursMatch = /(\d+)\s*h/i.exec(raw)
  const minutesMatch = /(\d+)\s*min/i.exec(raw)
  const hours = hoursMatch ? Number.parseInt(hoursMatch[1], 10) : 0
  const minutes = minutesMatch ? Number.parseInt(minutesMatch[1], 10) : 0
  const total = (hours * 60) + minutes
  return total > 0 ? total : fallbackMinutes
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime()
}

export function countBookingOverlaps(args: {
  appointments: BookingAppointment[]
  slotStart: Date
  slotEnd: Date
  bufferMinutes?: number
}) {
  const buffer = args.bufferMinutes ?? 0
  return args.appointments.filter((appointment) => {
    const appointmentStart = appointment.startsAt
    const appointmentEnd = new Date(appointmentStart.getTime() + ((appointment.durationMinutes + buffer) * 60_000))
    const slotEndWithBuffer = new Date(args.slotEnd.getTime() + (buffer * 60_000))
    return overlaps(appointmentStart, appointmentEnd, args.slotStart, slotEndWithBuffer)
  }).length
}

export function buildBookingDayState(args: {
  settings: BookingSettings
  date: Date
  appointments: BookingAppointment[]
  now: Date
}): BookingDayState {
  const { settings, date, appointments, now } = args
  const dateKey = toBookingDateKey(date)
  const weekday = date.getDay()
  const weekdayConfig = getBookingWeekdayConfig(settings, weekday)
  const isBlocked = settings.blockedDates.includes(dateKey)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const isPast = date.getTime() < startOfToday.getTime()
  const isBusinessDay = weekdayConfig.enabled && !isBlocked

  if (!isBusinessDay) {
    return {
      dateKey,
      weekday,
      isBusinessDay,
      isBlocked,
      isPast,
      slots: [],
      availableCount: 0,
      bookedCount: 0,
      totalSlots: 0,
    }
  }

  const openMinutes = bookingTimeToMinutes(weekdayConfig.start)
  const closeMinutes = bookingTimeToMinutes(weekdayConfig.end)
  const latestStart = closeMinutes - settings.durationMinutes
  const noticeDeadline = new Date(now.getTime() + (settings.minNoticeMinutes * 60_000))
  const slots: BookingSlotState[] = []

  for (let cursor = openMinutes; cursor <= latestStart; cursor += settings.slotIntervalMinutes) {
    const time = minutesToBookingTime(cursor)
    const slotStart = parseBookingDateKey(dateKey, time)
    const slotEnd = new Date(slotStart.getTime() + (settings.durationMinutes * 60_000))
    const booked = countBookingOverlaps({
      appointments,
      slotStart,
      slotEnd,
      bufferMinutes: settings.bufferMinutes,
    })
    const remaining = Math.max(0, settings.capacityPerSlot - booked)
    const isPastSlot = slotStart.getTime() < now.getTime()
    const insideNotice = slotStart.getTime() < noticeDeadline.getTime()
    const reason: BookingSlotState['reason'] = isPastSlot
      ? 'PAST'
      : insideNotice
        ? 'NOTICE'
        : remaining <= 0
          ? 'FULL'
          : 'AVAILABLE'

    slots.push({
      time,
      startsAt: slotStart.toISOString(),
      endsAt: slotEnd.toISOString(),
      available: reason === 'AVAILABLE',
      remaining,
      booked,
      reason,
    })
  }

  return {
    dateKey,
    weekday,
    isBusinessDay,
    isBlocked,
    isPast,
    slots,
    availableCount: slots.filter((slot) => slot.available).length,
    bookedCount: slots.filter((slot) => slot.booked > 0).length,
    totalSlots: slots.length,
  }
}

export function buildBookingAvailability(args: {
  settings: BookingSettings
  fromDateKey: string
  days: number
  appointments?: BookingAppointment[]
  now?: Date
}) {
  const now = args.now ?? new Date()
  const appointments = args.appointments ?? []
  const start = parseBookingDateKey(args.fromDateKey)
  const safeDays = Math.max(1, Math.min(120, args.days))

  return Array.from({ length: safeDays }, (_, index) => buildBookingDayState({
    settings: args.settings,
    date: addBookingDays(start, index),
    appointments,
    now,
  }))
}

export function findBookingSlot(args: {
  settings: BookingSettings
  dateKey: string
  time: string
}) {
  const dayConfig = getBookingWeekdayConfig(args.settings, parseBookingDateKey(args.dateKey).getDay())
  if (!dayConfig.enabled) return null
  if (args.settings.blockedDates.includes(args.dateKey)) return null

  const timeMinutes = bookingTimeToMinutes(args.time)
  const openMinutes = bookingTimeToMinutes(dayConfig.start)
  const closeMinutes = bookingTimeToMinutes(dayConfig.end)
  if (timeMinutes < openMinutes) return null
  if (timeMinutes + args.settings.durationMinutes > closeMinutes) return null
  if ((timeMinutes - openMinutes) % args.settings.slotIntervalMinutes !== 0) return null

  const startsAt = parseBookingDateKey(args.dateKey, args.time)
  const endsAt = new Date(startsAt.getTime() + (args.settings.durationMinutes * 60_000))
  return { startsAt, endsAt, dayConfig }
}

export function describeBookingSettings(settings: BookingSettings) {
  const enabledDays = settings.businessHours.filter((item) => item.enabled).length
  return `${formatBookingDuration(settings.durationMinutes)} por cita · ${enabledDays} días activos · cupo ${settings.capacityPerSlot}`
}
