"use client"

import { CalendarClock, Clock, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  BOOKING_WEEKDAY_LABELS,
  formatBookingDuration,
  type BookingBusinessDay,
  type BookingSettingsFormState,
} from '@/lib/crm-booking-settings'

type Props = {
  form: BookingSettingsFormState
  patchForm: (patch: Partial<BookingSettingsFormState>) => void
  notifyEmail?: boolean
  notifyWhatsApp?: boolean
  onNotifyEmailChange?: (checked: boolean) => void
  onNotifyWhatsAppChange?: (checked: boolean) => void
}

function patchBusinessDay(
  form: BookingSettingsFormState,
  patchForm: (patch: Partial<BookingSettingsFormState>) => void,
  day: number,
  patch: Partial<BookingBusinessDay>,
) {
  const next = form.bookingBusinessHours.map((item) => (item.day === day ? { ...item, ...patch, day } : item))
  patchForm({ bookingBusinessHours: next })
}

export function CrmIntegrationsBookingSection(props: Props) {
  const { form, patchForm } = props
  const enabledDays = form.bookingBusinessHours.filter((day) => day.enabled).length
  const blockedCount = form.bookingBlockedDates.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean).length

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-sky-200 bg-sky-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Agenda pública independiente</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
              Esta configuración solo aplica al canal de agendamiento. El visitante ve un calendario grande desde hoy, los días con cupo y los horarios ya ocupados por la agenda real del CRM.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-sky-800">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-3 py-1"><Clock className="h-3.5 w-3.5" />{formatBookingDuration(Number.parseInt(form.bookingDurationMinutes, 10) || 30)}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-3 py-1"><CalendarClock className="h-3.5 w-3.5" />{enabledDays} días activos</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-white px-3 py-1"><Users className="h-3.5 w-3.5" />Cupo {form.bookingCapacityPerSlot || '1'}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label>Duración de la cita (min)</Label>
          <Input value={form.bookingDurationMinutes} onChange={(event) => patchForm({ bookingDurationMinutes: event.target.value })} inputMode="numeric" className="h-11 rounded-xl" />
          <p className="text-xs text-slate-500">Bloque que ocupa cada cita en la agenda.</p>
        </div>
        <div className="grid gap-2">
          <Label>Intervalo entre horarios (min)</Label>
          <Input value={form.bookingSlotIntervalMinutes} onChange={(event) => patchForm({ bookingSlotIntervalMinutes: event.target.value })} inputMode="numeric" className="h-11 rounded-xl" />
          <p className="text-xs text-slate-500">Cada cuántos minutos se ofrece un nuevo cupo.</p>
        </div>
        <div className="grid gap-2">
          <Label>Margen entre citas (min)</Label>
          <Input value={form.bookingBufferMinutes} onChange={(event) => patchForm({ bookingBufferMinutes: event.target.value })} inputMode="numeric" className="h-11 rounded-xl" />
          <p className="text-xs text-slate-500">Tiempo de limpieza o traslado antes del siguiente cupo.</p>
        </div>
        <div className="grid gap-2">
          <Label>Cupos por horario</Label>
          <Input value={form.bookingCapacityPerSlot} onChange={(event) => patchForm({ bookingCapacityPerSlot: event.target.value })} inputMode="numeric" className="h-11 rounded-xl" />
          <p className="text-xs text-slate-500">1 = exclusivo. Más de 1 permite citas simultáneas.</p>
        </div>
        <div className="grid gap-2">
          <Label>Anticipación mínima (min)</Label>
          <Input value={form.bookingMinNoticeMinutes} onChange={(event) => patchForm({ bookingMinNoticeMinutes: event.target.value })} inputMode="numeric" className="h-11 rounded-xl" />
          <p className="text-xs text-slate-500">No se ofrecen horarios más cercanos que este margen.</p>
        </div>
        <div className="grid gap-2">
          <Label>Agendar hasta (días)</Label>
          <Input value={form.bookingMaxAdvanceDays} onChange={(event) => patchForm({ bookingMaxAdvanceDays: event.target.value })} inputMode="numeric" className="h-11 rounded-xl" />
          <p className="text-xs text-slate-500">Ventana máxima hacia adelante en el calendario.</p>
        </div>
        <div className="grid gap-2">
          <Label>Etiqueta de duración</Label>
          <Input value={form.bookingDurationLabel} onChange={(event) => patchForm({ bookingDurationLabel: event.target.value })} className="h-11 rounded-xl" placeholder="30 min" />
          <p className="text-xs text-slate-500">Texto visible para el visitante.</p>
        </div>
        <div className="grid gap-2">
          <Label>Código de zona horaria</Label>
          <Input value={form.bookingTimezoneLabel} onChange={(event) => patchForm({ bookingTimezoneLabel: event.target.value })} className="h-11 rounded-xl" placeholder="America/Bogota" />
          <p className="text-xs text-slate-500">Se muestra junto al nombre del canal.</p>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Horario semanal</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Activa los días que aceptan citas y define su ventana horaria.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">{enabledDays} de 7 días</span>
        </div>

        <div className="mt-4 space-y-2">
          {form.bookingBusinessHours.map((day) => (
            <div key={day.day} className="grid items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 md:grid-cols-[minmax(0,1fr)_140px_140px_auto]">
              <div className="flex items-center gap-3">
                <Switch
                  checked={day.enabled}
                  onCheckedChange={(checked) => patchBusinessDay(form, patchForm, day.day, { enabled: checked })}
                  aria-label={`Activar ${BOOKING_WEEKDAY_LABELS[day.day]}`}
                />
                <span className="text-sm font-medium text-slate-800">{BOOKING_WEEKDAY_LABELS[day.day]}</span>
              </div>
              <Input
                type="time"
                value={day.start}
                disabled={!day.enabled}
                onChange={(event) => patchBusinessDay(form, patchForm, day.day, { start: event.target.value })}
                className="h-10 rounded-xl bg-white"
              />
              <Input
                type="time"
                value={day.end}
                disabled={!day.enabled}
                onChange={(event) => patchBusinessDay(form, patchForm, day.day, { end: event.target.value })}
                className="h-10 rounded-xl bg-white"
              />
              <span className="text-xs font-medium text-slate-500">
                {day.enabled ? `${day.start} - ${day.end}` : 'Cerrado'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Fechas bloqueadas</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Una fecha por línea en formato AAAA-MM-DD. Se muestran como día cerrado aunque sea día hábil.</p>
          <Textarea
            value={form.bookingBlockedDates}
            onChange={(event) => patchForm({ bookingBlockedDates: event.target.value })}
            rows={6}
            placeholder={'2026-01-01\n2026-04-02'}
            className="mt-3 rounded-xl"
          />
          <p className="mt-2 text-xs font-medium text-slate-500">{blockedCount} fechas bloqueadas</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Confirmaciones al agendar</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">El diseño y los textos se configuran en la pestaña Correo de respuesta.</p>
          <div className="mt-3 space-y-3">
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-sm text-slate-700">
              <span>Enviar correo de confirmación</span>
              <Switch
                checked={props.notifyEmail ?? true}
                onCheckedChange={props.onNotifyEmailChange}
                disabled={!props.onNotifyEmailChange}
                aria-label="Enviar correo de confirmación"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-sm text-slate-700">
              <span>Enviar WhatsApp de confirmación</span>
              <Switch
                checked={props.notifyWhatsApp ?? true}
                onCheckedChange={props.onNotifyWhatsAppChange}
                disabled={!props.onNotifyWhatsAppChange}
                aria-label="Enviar WhatsApp de confirmación"
              />
            </label>
          </div>
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-xs leading-5 text-slate-500">
            Los horarios ocupados, las citas cerradas y las canceladas se recalculan desde la agenda del CRM cada vez que el visitante abre el calendario.
          </div>
        </div>
      </div>
    </div>
  )
}

