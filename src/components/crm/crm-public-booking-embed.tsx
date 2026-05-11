"use client"

import { useMemo, useState } from 'react'

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
}

type BookingFormState = {
  nombre: string
  email: string
  telefono: string
  producto: string
  mensaje: string
}

type CalendarCell = {
  key: string
  date: Date
  dayNumber: number
  isCurrentMonth: boolean
  isAvailable: boolean
}

const BOOKING_TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

function getInitialState(): BookingFormState {
  return {
    nombre: '',
    email: '',
    telefono: '',
    producto: '',
    mensaje: '',
  }
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

function formatBookingDate(value: Date) {
  return new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }).format(value)
}

function formatBookingMonth(value: Date) {
  return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(value)
}

function buildCalendarCells(monthDate: Date, availableKeys: Set<string>) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startWeekday = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const previousMonthDays = new Date(year, month, 0).getDate()
  const cells: CalendarCell[] = []

  for (let index = 0; index < startWeekday; index += 1) {
    const dayNumber = previousMonthDays - startWeekday + index + 1
    const date = new Date(year, month - 1, dayNumber)
    cells.push({ key: formatDateKey(date), date, dayNumber, isCurrentMonth: false, isAvailable: availableKeys.has(formatDateKey(date)) })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    cells.push({ key: formatDateKey(date), date, dayNumber: day, isCurrentMonth: true, isAvailable: availableKeys.has(formatDateKey(date)) })
  }

  while (cells.length % 7 !== 0) {
    const date = new Date(year, month + 1, cells.length % 7 === 0 ? 1 : cells.length - (startWeekday + daysInMonth) + 1)
    cells.push({ key: formatDateKey(date), date, dayNumber: date.getDate(), isCurrentMonth: false, isAvailable: availableKeys.has(formatDateKey(date)) })
  }

  return cells
}

export function CrmPublicBookingEmbed(props: CrmPublicBookingEmbedProps) {
  const [form, setForm] = useState<BookingFormState>(getInitialState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const availableDates = useMemo(() => {
    const base = startOfDay(new Date())
    return Array.from({ length: 45 }, (_, index) => addDays(base, index)).filter((date) => date.getDay() !== 0)
  }, [])
  const availableDateKeys = useMemo(() => new Set(availableDates.map((date) => formatDateKey(date))), [availableDates])
  const minMonth = useMemo(() => new Date(availableDates[0].getFullYear(), availableDates[0].getMonth(), 1), [availableDates])
  const maxMonth = useMemo(() => new Date(availableDates[availableDates.length - 1].getFullYear(), availableDates[availableDates.length - 1].getMonth(), 1), [availableDates])
  const [currentMonth, setCurrentMonth] = useState(minMonth)
  const [selectedDateKey, setSelectedDateKey] = useState(formatDateKey(availableDates[0]))
  const [selectedTime, setSelectedTime] = useState(BOOKING_TIME_SLOTS[0])

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

  const selectedDate = useMemo(
    () => availableDates.find((date) => formatDateKey(date) === selectedDateKey) || availableDates[0],
    [availableDates, selectedDateKey],
  )
  const selectedStartsAt = selectedDate && selectedTime ? `${selectedDateKey}T${selectedTime}` : ''
  const calendarCells = useMemo(() => buildCalendarCells(currentMonth, availableDateKeys), [availableDateKeys, currentMonth])

  function goToMonth(direction: -1 | 1) {
    const nextMonth = addMonths(currentMonth, direction)
    if (nextMonth < minMonth || nextMonth > maxMonth) return
    setCurrentMonth(nextMonth)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    if (!selectedStartsAt) {
      setSubmitting(false)
      setError('Selecciona primero la fecha y la hora de la cita.')
      return
    }

    try {
      const response = await fetch('/api/crm/captures/booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId: props.channelId,
          ...form,
          startsAt: selectedStartsAt,
          landingPageUrl: window.location.href,
          referrerUrl: document.referrer || '',
        }),
      })

      const json = await response.json().catch(() => ({})) as { error?: string; success?: boolean }
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'No se pudo registrar la cita.')
      }

      setSuccess(props.successMessage)
      setForm(getInitialState())
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo registrar la cita.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10" style={containerStyle}>
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[30px] border border-slate-200/80 bg-slate-950 px-6 py-7 text-white shadow-[0_25px_80px_rgba(15,23,42,0.24)]">
          <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ backgroundColor: `${props.accentColor}33`, color: '#fff' }}>
            Agenda online
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{props.title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{props.description}</p>

          <div className="mt-6 space-y-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Reserva seleccionada</p>
            <div>
              <p className="text-lg font-semibold text-white">{selectedDate ? formatBookingDate(selectedDate) : 'Sin fecha'}</p>
              <p className="text-sm text-slate-300">{selectedTime ? `${selectedTime} h` : 'Sin horario'}</p>
            </div>
            <p className="text-xs leading-5 text-slate-400">La cita entra directo al CRM y puede disparar confirmación por correo o WhatsApp según la configuración del canal.</p>
          </div>
        </aside>

        <div style={cardStyle}>
          <div className="mb-6 rounded-[26px] border border-slate-200 bg-slate-50/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Paso 1</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Selecciona la fecha y la hora</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Escoge un día disponible y luego el horario que mejor le funcione al prospecto.</p>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_280px]">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <button type="button" onClick={() => goToMonth(-1)} disabled={currentMonth <= minMonth} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40">
                    ‹
                  </button>
                  <p className="text-sm font-semibold capitalize text-slate-900">{formatBookingMonth(currentMonth)}</p>
                  <button type="button" onClick={() => goToMonth(1)} disabled={currentMonth >= maxMonth} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40">
                    ›
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
                </div>

                <div className="mt-3 grid grid-cols-7 gap-2">
                  {calendarCells.map((cell) => {
                    const selected = cell.key === selectedDateKey
                    return (
                      <button
                        key={`${cell.key}-${cell.isCurrentMonth ? 'current' : 'other'}`}
                        type="button"
                        onClick={() => {
                          if (!cell.isAvailable) return
                          setSelectedDateKey(cell.key)
                          setCurrentMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1))
                        }}
                        disabled={!cell.isAvailable}
                        className={selected
                          ? 'h-12 rounded-2xl border text-sm font-semibold text-white shadow-sm'
                          : cell.isAvailable
                            ? `h-12 rounded-2xl border border-slate-200 bg-white text-sm font-medium ${cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'} transition hover:border-slate-300`
                            : 'h-12 rounded-2xl border border-slate-100 bg-slate-50 text-sm text-slate-300'}
                        style={selected ? { backgroundColor: props.accentColor, borderColor: props.accentColor } : undefined}
                      >
                        {cell.dayNumber}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Hora</p>
                <p className="mt-1 text-xs text-slate-500">{selectedDate ? formatBookingDate(selectedDate) : 'Selecciona un día'}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {BOOKING_TIME_SLOTS.map((slot) => {
                    const selected = selectedTime === slot
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTime(slot)}
                        className={selected
                          ? 'h-12 rounded-2xl border text-sm font-semibold text-white shadow-sm'
                          : 'h-12 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white'}
                        style={selected ? { backgroundColor: props.accentColor, borderColor: props.accentColor } : undefined}
                      >
                        {slot}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <form className="grid gap-4" onSubmit={handleSubmit}>
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
              {props.showEmailField ? (
                <div className="grid gap-2" style={{ rowGap: `${props.fieldSpacing}px` }}>
                  <label className="text-sm font-medium" style={{ color: props.labelColor }}>{props.emailLabel}</label>
                  <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder={props.emailPlaceholder} className="h-12 border px-4 outline-none transition focus:ring-2" style={inputStyle} />
                </div>
              ) : null}
              {props.showPhoneField ? (
                <div className="grid gap-2" style={{ rowGap: `${props.fieldSpacing}px` }}>
                  <label className="text-sm font-medium" style={{ color: props.labelColor }}>{props.phoneLabel}</label>
                  <input value={form.telefono} onChange={(event) => setForm((current) => ({ ...current, telefono: event.target.value }))} placeholder={props.phonePlaceholder} className="h-12 border px-4 outline-none transition focus:ring-2" style={inputStyle} />
                </div>
              ) : null}
            </div>

            {props.showMessageField ? (
              <div className="grid gap-2" style={{ rowGap: `${props.fieldSpacing}px` }}>
                <label className="text-sm font-medium" style={{ color: props.labelColor }}>{props.messageLabel}</label>
                <textarea value={form.mensaje} onChange={(event) => setForm((current) => ({ ...current, mensaje: event.target.value }))} placeholder={props.messagePlaceholder} rows={5} className="border px-4 py-3 outline-none transition focus:ring-2" style={inputStyle} />
              </div>
            ) : null}

            {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            {success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p> : null}

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cita elegida</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selectedDate ? `${formatBookingDate(selectedDate)} · ${selectedTime}` : 'Selecciona un horario'}</p>
              </div>
              <button type="submit" disabled={submitting} className="inline-flex h-12 items-center justify-center rounded-2xl px-6 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70" style={{ backgroundColor: props.ctaColor, color: props.ctaTextColor }}>
                {submitting ? 'Registrando...' : props.submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}