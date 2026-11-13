"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/components/providers/i18n-provider'

export type PublicBookingBusinessDay = {
  day: number
  enabled: boolean
  start: string
  end: string
}

type CrmPublicBookingEmbedProps = {
  channelId: string
  title: string
  description: string
  submitLabel: string
  successMessage: string
  accentColor: string
  pageBackgroundColor: string
  backgroundColor: string
  fontFamily: string
  fontSize: string
  labelColor: string
  inputTextColor: string
  inputBackgroundColor: string
  inputBorderColor: string
  ctaColor: string
  ctaTextColor: string
  formCardRadius: string
  inputRadius: string
  fieldSpacing: string
  formPadding: string
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  serviceLabel: string
  servicePlaceholder: string
  messageLabel: string
  messagePlaceholder: string
  showEmailField: boolean
  showPhoneField: boolean
  showServiceField: boolean
  showMessageField: boolean
  durationMinutes: number
  durationLabel: string
  slotIntervalMinutes: number
  capacityPerSlot: number
  minNoticeMinutes: number
  maxAdvanceDays: number
  timezoneLabel: string
  businessHours: PublicBookingBusinessDay[]
  blockedDates: string[]
  notifyEmail: boolean
  notifyWhatsApp: boolean
}

type BookingFormState = {
  nombre: string
  email: string
  telefono: string
  producto: string
  mensaje: string
}

type SlotState = {
  time: string
  startsAt: string
  endsAt: string
  available: boolean
  remaining: number
  booked: number
  reason: 'AVAILABLE' | 'FULL' | 'PAST' | 'NOTICE'
}

type DayState = {
  dateKey: string
  weekday: number
  isBusinessDay: boolean
  isBlocked: boolean
  isPast: boolean
  slots: SlotState[]
  availableCount: number
  bookedCount: number
  totalSlots: number
}

type BookingResult = {
  startsAt: string
  endsAt: string
  dateKey: string
  time: string
  timeRange: string
  durationMinutes: number
  notifications: Array<{ channel: string; ok: boolean; message: string }>
}

type AvailabilityPayload = {
  success?: boolean
  error?: string
  data?: {
    days?: DayState[]
  }
}

const WEEKDAY_LABELS: Record<'es' | 'en', string[]> = {
  es: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}

function getInitialState(): BookingFormState {
  return { nombre: '', email: '', telefono: '', producto: '', mensaje: '' }
}

function startOfDay(value: Date) {
  const next = new Date(value)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(value: Date, months: number) {
  return new Date(value.getFullYear(), value.getMonth() + months, 1)
}

function formatDateKey(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, '0')
  const day = `${value.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocale(language: 'es' | 'en') {
  return language === 'en' ? 'en-US' : 'es-CO'
}

function formatSelectedDate(dateKey: string, language: 'es' | 'en') {
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10))
  const date = new Date(year, (month || 1) - 1, day || 1)
  return new Intl.DateTimeFormat(getLocale(language), { weekday: 'long', day: '2-digit', month: 'long' }).format(date)
}

function formatBookingMonth(value: Date, language: 'es' | 'en') {
  return new Intl.DateTimeFormat(getLocale(language), { month: 'long', year: 'numeric' }).format(value)
}

function formatSlotRange(slot: SlotState) {
  const durationMinutes = Math.max(0, Math.round((new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60_000))
  const [hours, minutes] = slot.time.split(':').map((part) => Number.parseInt(part, 10))
  const endTotal = (hours * 60) + minutes + durationMinutes
  const endHours = `${Math.floor(endTotal / 60) % 24}`.padStart(2, '0')
  const endMinutes = `${endTotal % 60}`.padStart(2, '0')
  return `${slot.time} - ${endHours}:${endMinutes}`
}

function buildCalendarCells(monthDate: Date) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startWeekday = (firstDay.getDay() + 6) % 7
  const startDate = addDays(firstDay, -startWeekday)

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(startDate, index)
    return {
      key: formatDateKey(date),
      date,
      dayNumber: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
    }
  })
}

export function CrmPublicBookingEmbed(props: CrmPublicBookingEmbedProps) {
  const { language, t } = useI18n()
  const today = useMemo(() => startOfDay(new Date()), [])
  const minMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today])
  const maxDate = useMemo(() => addDays(today, props.maxAdvanceDays), [props.maxAdvanceDays, today])
  const maxMonth = useMemo(() => new Date(maxDate.getFullYear(), maxDate.getMonth(), 1), [maxDate])

  const [currentMonth, setCurrentMonth] = useState(minMonth)
  const [days, setDays] = useState<Record<string, DayState>>({})
  const [loadingAvailability, setLoadingAvailability] = useState(true)
  const [availabilityError, setAvailabilityError] = useState('')
  const [selectedDateKey, setSelectedDateKey] = useState('')
  const [selectedStartsAt, setSelectedStartsAt] = useState('')
  const [form, setForm] = useState<BookingFormState>(getInitialState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BookingResult | null>(null)

  const containerStyle = useMemo(() => ({
    background: `radial-gradient(circle at top, ${props.pageBackgroundColor}, #ffffff 72%)`,
    fontFamily: props.fontFamily,
  }), [props.fontFamily, props.pageBackgroundColor])

  const cardStyle = useMemo(() => ({
    backgroundColor: props.backgroundColor,
    borderRadius: `${props.formCardRadius}px`,
    padding: `${props.formPadding}px`,
    boxShadow: '0 30px 80px rgba(15, 23, 42, 0.12)',
  }), [props.backgroundColor, props.formCardRadius, props.formPadding])

  const inputStyle = useMemo(() => ({
    borderColor: props.inputBorderColor,
    backgroundColor: props.inputBackgroundColor,
    color: props.inputTextColor,
    borderRadius: `${props.inputRadius}px`,
    fontSize: `${props.fontSize}px`,
  }), [props.fontSize, props.inputBackgroundColor, props.inputBorderColor, props.inputRadius, props.inputTextColor])

  const loadAvailability = useCallback(async () => {
    setLoadingAvailability(true)
    setAvailabilityError('')
    try {
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const from = monthStart.getTime() < today.getTime() ? today : monthStart
      const spanDays = Math.min(62, Math.max(31, Math.ceil((new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 7).getTime() - from.getTime()) / 86_400_000)))
      const query = new URLSearchParams({
        channelId: props.channelId,
        from: formatDateKey(from),
        days: String(spanDays),
      })
      const response = await fetch(`/api/crm/booking/availability?${query.toString()}`, { cache: 'no-store' })
      const json = await response.json().catch(() => ({})) as AvailabilityPayload
      if (!response.ok || !json.success || !Array.isArray(json.data?.days)) {
        throw new Error(json.error || t('crm.booking.availabilityError'))
      }

      setDays((current) => {
        const next = { ...current }
        json.data?.days?.forEach((day) => {
          next[day.dateKey] = day
        })
        return next
      })
    } catch (loadError) {
      setAvailabilityError(loadError instanceof Error ? loadError.message : t('crm.booking.availabilityError'))
    } finally {
      setLoadingAvailability(false)
    }
  }, [currentMonth, props.channelId, t, today])

  useEffect(() => {
    void loadAvailability()
  }, [loadAvailability])

  useEffect(() => {
    if (selectedDateKey) return
    const todayKey = formatDateKey(today)
    const todayState = days[todayKey]
    if (todayState && todayState.availableCount > 0) {
      setSelectedDateKey(todayKey)
    }
  }, [days, selectedDateKey, today])

  const calendarCells = useMemo(() => buildCalendarCells(currentMonth), [currentMonth])
  const selectedDay = selectedDateKey ? days[selectedDateKey] : undefined
  const selectedSlot = selectedDay?.slots.find((slot) => slot.startsAt === selectedStartsAt)
  const weekDayLabels = WEEKDAY_LABELS[language]
  const showEmailInput = props.showEmailField || props.notifyEmail || !props.showPhoneField
  const showPhoneInput = props.showPhoneField || props.notifyWhatsApp || !props.showEmailField

  function goToMonth(direction: -1 | 1) {
    const nextMonth = addMonths(currentMonth, direction)
    if (nextMonth.getTime() < minMonth.getTime() || nextMonth.getTime() > maxMonth.getTime()) return
    setCurrentMonth(nextMonth)
  }

  function handleSelectDay(dateKey: string) {
    setSelectedDateKey(dateKey)
    setSelectedStartsAt('')
    setError('')
  }


  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!selectedSlot) {
      setError(t('crm.booking.validation.selectDateTime'))
      return
    }

    if (!form.nombre.trim()) {
      setError(language === 'en' ? 'Your name is required.' : 'Tu nombre es obligatorio.')
      return
    }

    if (!form.email.trim() && !form.telefono.trim()) {
      setError(language === 'en' ? 'Leave an email or a phone number so we can confirm.' : 'Deja un correo o un teléfono para poder confirmar.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/crm/captures/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: props.channelId,
          ...form,
          startsAt: selectedSlot.startsAt,
          landingPageUrl: window.location.href,
          referrerUrl: document.referrer || '',
        }),
      })

      const json = await response.json().catch(() => ({})) as {
        error?: string
        success?: boolean
        data?: {
          startsAt?: string
          endsAt?: string
          durationMinutes?: number
          notifications?: Array<{ channel: string; ok: boolean; message: string }>
        }
      }

      if (!response.ok || !json.success) {
        throw new Error(json.error || t('crm.booking.errors.submitFailed'))
      }

      setResult({
        startsAt: json.data?.startsAt || selectedSlot.startsAt,
        endsAt: json.data?.endsAt || selectedSlot.endsAt,
        dateKey: selectedDateKey,
        time: selectedSlot.time,
        timeRange: formatSlotRange(selectedSlot),
        durationMinutes: json.data?.durationMinutes || props.durationMinutes,
        notifications: Array.isArray(json.data?.notifications) ? json.data.notifications : [],
      })
      setForm(getInitialState())
      setSelectedStartsAt('')
      void loadAvailability()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('crm.booking.errors.submitFailed'))
      void loadAvailability()
    } finally {
      setSubmitting(false)
    }
  }

  function handleBookAnother() {
    setResult(null)
    setSelectedDateKey('')
    setSelectedStartsAt('')
    setCurrentMonth(minMonth)
    void loadAvailability()
  }


  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10" style={containerStyle}>
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-slate-950 px-6 py-7 text-white shadow-[0_25px_80px_rgba(15,23,42,0.24)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ backgroundColor: `${props.accentColor}33`, color: '#fff' }}>
              {t('crm.booking.badge')}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
              {t('crm.booking.duration')}: {props.durationLabel}
            </span>
            <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200">
              {t('crm.booking.timezone')}: {props.timezoneLabel}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{props.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{props.description}</p>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{t('crm.booking.openAgendaHint')}</p>
        </header>

        {result ? (
          <section className="rounded-[30px] border border-emerald-200 bg-white p-6 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {t('crm.booking.confirmedTitle')}
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">{props.successMessage}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t('crm.booking.confirmedDescription')}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('crm.booking.selectedDay')}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{formatSelectedDate(result.dateKey, language)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('crm.booking.time')}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{result.timeRange || result.time}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('crm.booking.duration')}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{result.durationMinutes} min</p>
              </div>
            </div>

            {result.notifications.length ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('crm.booking.notifications')}</p>
                <ul className="mt-2 space-y-1.5">
                  {result.notifications.map((notification, index) => (
                    <li key={`${notification.channel}-${index}`} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className={notification.ok ? 'mt-0.5 text-emerald-600' : 'mt-0.5 text-amber-600'}>●</span>
                      <span><strong className="font-semibold">{notification.channel}</strong> · {notification.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleBookAnother}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: props.ctaColor, color: props.ctaTextColor }}
            >
              {t('crm.booking.bookAnother')}
            </button>
          </section>
        ) : (
          <>

            <section className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('crm.booking.step1')}</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{t('crm.booking.chooseDay')}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{t('crm.booking.weekViewHint')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setCurrentMonth(minMonth)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300">
                    {t('crm.booking.today')}
                  </button>
                  <button type="button" onClick={() => goToMonth(-1)} disabled={currentMonth.getTime() <= minMonth.getTime()} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Mes anterior">
                    ‹
                  </button>
                  <p className="min-w-[140px] text-center text-sm font-semibold capitalize text-slate-900">{formatBookingMonth(currentMonth, language)}</p>
                  <button type="button" onClick={() => goToMonth(1)} disabled={currentMonth.getTime() >= maxMonth.getTime()} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Mes siguiente">
                    ›
                  </button>
                  <button type="button" onClick={() => void loadAvailability()} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300">
                    {loadingAvailability ? '…' : t('crm.booking.refreshAvailability')}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:gap-2">
                {weekDayLabels.map((label) => <span key={label}>{label}</span>)}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
                {calendarCells.map((cell) => {
                  const dayState = days[cell.key]
                  const isPast = cell.date.getTime() < today.getTime()
                  const isClosed = !dayState || !dayState.isBusinessDay
                  const isFull = Boolean(dayState) && dayState.isBusinessDay && dayState.availableCount === 0
                  const isLimited = Boolean(dayState) && dayState.availableCount > 0 && dayState.availableCount <= 2
                  const isAvailable = Boolean(dayState) && dayState.availableCount > 0
                  const selectable = isAvailable && !isPast
                  const isSelected = cell.key === selectedDateKey

                  const baseClass = 'relative flex min-h-[70px] flex-col items-start justify-between rounded-2xl border p-2 text-left transition sm:min-h-[86px] sm:p-2.5'
                  const stateClass = isSelected
                    ? 'text-white shadow-sm'
                    : selectable
                      ? isLimited
                        ? 'border-amber-200 bg-amber-50/80 text-amber-900 hover:border-amber-300'
                        : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:border-emerald-300'
                      : isFull
                        ? 'border-rose-100 bg-rose-50/60 text-rose-500'
                        : 'border-slate-100 bg-slate-50 text-slate-400'

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      disabled={!selectable}
                      onClick={() => handleSelectDay(cell.key)}
                      aria-pressed={isSelected}
                      className={`${baseClass} ${stateClass} ${cell.isCurrentMonth ? '' : 'opacity-50'} ${selectable ? '' : 'cursor-not-allowed'}`}
                      style={isSelected ? { backgroundColor: props.accentColor, borderColor: props.accentColor } : undefined}
                    >
                      <span className="text-sm font-semibold leading-none">{cell.dayNumber}</span>
                      <span className="mt-1 w-full text-[10px] font-semibold uppercase leading-tight tracking-[0.08em]">
                        {isPast
                          ? '—'
                          : isClosed
                            ? t('crm.booking.legendClosed')
                            : isFull
                              ? t('crm.booking.legendFull')
                              : isAvailable
                                ? `${dayState?.availableCount ?? 0}`
                                : '—'}
                      </span>
                      {isAvailable ? (
                        <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : isLimited ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                      ) : null}
                    </button>
                  )
                })}
              </div>


              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t('crm.booking.legendAvailable')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />{t('crm.booking.legendLimited')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-400" />{t('crm.booking.legendFull')}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" />{t('crm.booking.legendClosed')}</span>
                {loadingAvailability ? <span className="normal-case tracking-normal text-slate-400">{t('crm.booking.availabilityLoading')}</span> : null}
              </div>

              {availabilityError ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <span>{availabilityError}</span>
                  <button type="button" onClick={() => void loadAvailability()} className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800">
                    {t('crm.booking.retry')}
                  </button>
                </div>
              ) : null}
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('crm.booking.chooseTime')}</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                    {selectedDateKey ? formatSelectedDate(selectedDateKey, language) : t('crm.booking.pickDay')}
                  </h2>
                </div>
                {selectedDay ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                    {selectedDay.availableCount} {t('crm.booking.availableShort')} · {selectedDay.bookedCount} {t('crm.booking.bookedShort')}
                  </span>
                ) : null}
              </div>

              {!selectedDateKey ? (
                <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                  {t('crm.booking.weekViewHint')}
                </p>
              ) : !selectedDay || selectedDay.slots.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                  {t('crm.booking.noSlots')}
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {selectedDay.slots.map((slot) => {
                    const isSelected = slot.startsAt === selectedStartsAt
                    const disabled = !slot.available
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedStartsAt(slot.startsAt)}
                        aria-pressed={isSelected}
                        className={isSelected
                          ? 'rounded-2xl border px-3 py-3 text-left text-white shadow-sm'
                          : disabled
                            ? 'cursor-not-allowed rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 text-left text-slate-400'
                            : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left text-slate-700 transition hover:border-slate-300 hover:bg-slate-50'}
                        style={isSelected ? { backgroundColor: props.accentColor, borderColor: props.accentColor } : undefined}
                      >
                        <span className="block text-sm font-semibold">{formatSlotRange(slot)}</span>
                        <span className={`mt-0.5 block text-[11px] font-medium ${isSelected ? 'text-white/80' : disabled ? 'text-slate-400' : 'text-slate-500'}`}>
                          {slot.reason === 'FULL'
                            ? t('crm.booking.slotFull')
                            : slot.reason === 'PAST'
                              ? t('crm.booking.slotPast')
                              : slot.reason === 'NOTICE'
                                ? t('crm.booking.slotNotice')
                                : slot.remaining > 1
                                  ? t('crm.booking.slotSeatsLeft').replace('{count}', String(slot.remaining))
                                  : t('crm.booking.availableShort')}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>


            <section className="rounded-[30px] border border-slate-200 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]" style={cardStyle}>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('crm.booking.contactStep')}</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{t('crm.booking.confirmStep')}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {props.notifyEmail && props.notifyWhatsApp
                        ? (language === 'en' ? 'We confirm by email or WhatsApp.' : 'Te confirmamos por correo o WhatsApp.')
                        : props.notifyWhatsApp
                          ? (language === 'en' ? 'We confirm by WhatsApp.' : 'Te confirmamos por WhatsApp.')
                          : props.notifyEmail
                            ? (language === 'en' ? 'We confirm by email.' : 'Te confirmamos por correo.')
                            : ''}
                    </p>
                  </div>
                  {selectedSlot ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                      {formatSelectedDate(selectedDateKey, language)} · {formatSlotRange(selectedSlot)}
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2" style={{ rowGap: `${props.fieldSpacing}px` }}>
                    <label className="text-sm font-medium" style={{ color: props.labelColor }}>{props.nameLabel}</label>
                    <input required value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} placeholder={props.namePlaceholder} className="h-12 border px-4 outline-none transition focus:ring-2" style={inputStyle} />
                  </div>
                  {props.showServiceField ? (
                    <div className="grid gap-2" style={{ rowGap: `${props.fieldSpacing}px` }}>
                      <label className="text-sm font-medium" style={{ color: props.labelColor }}>{props.serviceLabel}</label>
                      <input value={form.producto} onChange={(event) => setForm((current) => ({ ...current, producto: event.target.value }))} placeholder={props.servicePlaceholder} className="h-12 border px-4 outline-none transition focus:ring-2" style={inputStyle} />
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {showEmailInput ? (
                    <div className="grid gap-2" style={{ rowGap: `${props.fieldSpacing}px` }}>
                      <label className="text-sm font-medium" style={{ color: props.labelColor }}>{props.emailLabel}</label>
                      <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder={props.emailPlaceholder} className="h-12 border px-4 outline-none transition focus:ring-2" style={inputStyle} />
                    </div>
                  ) : null}
                  {showPhoneInput ? (
                    <div className="grid gap-2" style={{ rowGap: `${props.fieldSpacing}px` }}>
                      <label className="text-sm font-medium" style={{ color: props.labelColor }}>{props.phoneLabel}</label>
                      <input value={form.telefono} onChange={(event) => setForm((current) => ({ ...current, telefono: event.target.value }))} placeholder={props.phonePlaceholder} className="h-12 border px-4 outline-none transition focus:ring-2" style={inputStyle} />
                    </div>
                  ) : null}
                </div>

                {props.showMessageField ? (
                  <div className="grid gap-2" style={{ rowGap: `${props.fieldSpacing}px` }}>
                    <label className="text-sm font-medium" style={{ color: props.labelColor }}>{props.messageLabel}</label>
                    <textarea value={form.mensaje} onChange={(event) => setForm((current) => ({ ...current, mensaje: event.target.value }))} placeholder={props.messagePlaceholder} rows={4} className="border px-4 py-3 outline-none transition focus:ring-2" style={inputStyle} />
                  </div>
                ) : null}


                {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

                <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('crm.booking.selectedReservation')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {selectedSlot
                        ? `${formatSelectedDate(selectedDateKey, language)} · ${formatSlotRange(selectedSlot)}`
                        : t('crm.booking.pickTime')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{t('crm.booking.summaryHint')}</p>
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || !selectedSlot}
                    className="inline-flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: props.ctaColor, color: props.ctaTextColor }}
                  >
                    {submitting ? t('crm.booking.submitting') : props.submitLabel}
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

