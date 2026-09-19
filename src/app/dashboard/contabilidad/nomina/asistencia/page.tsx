'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/components/providers/i18n-provider'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { nominaHref } from '@/lib/nomina-routes'
import type { PayrollEmployeeRow, PayrollPeriodRow } from '@/lib/payroll'
import type { PayrollAttendanceEntryRow } from '@/lib/payroll-operations'

const EMPTY_FORM = {
  employeeId: '',
  periodId: '',
  entryDate: '',
  shiftName: '',
  status: 'PRESENTE',
  checkInAt: '',
  checkOutAt: '',
  minutesLate: '0',
  overtimeMinutes: '0',
  leaveType: '',
  notes: '',
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(new Date(value))
  } catch {
    return value
  }
}

export default function NominaAsistenciaPage() {
  const [rows, setRows] = useState<PayrollAttendanceEntryRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'Attendance admin',
        title: 'Attendance Control',
        description: 'RRHH and payroll backoffice for shifts, lateness, leave and overtime before those events affect calculation or employee visibility.',
        actions: { create: 'Create attendance record', save: 'Save changes', add: 'Create record', cancel: 'Cancel', edit: 'Edit', remove: 'Delete' },
        dialog: { title: 'Attendance record', description: 'Store check-in, check-out, leave and overtime information tied to the employee and, optionally, the payroll period.' },
        labels: { employee: 'Employee', period: 'Period', date: 'Date', shift: 'Shift', status: 'Status', checkIn: 'Check-in', checkOut: 'Check-out', late: 'Late minutes', overtime: 'Overtime minutes', leave: 'Leave type', notes: 'Notes', noPeriod: 'No period' },
        errors: { save: 'Unable to save record', remove: 'Unable to delete record' },
      }
    : {
        eyebrow: 'Asistencia RRHH',
        title: 'Control de Asistencia',
        description: 'Backoffice de RRHH y nómina para turnos, tardanzas, permisos y horas extra antes de impactar cálculo o visibilidad del colaborador.',
        actions: { create: 'Crear registro de asistencia', save: 'Guardar cambios', add: 'Crear registro', cancel: 'Cancelar', edit: 'Editar', remove: 'Eliminar' },
        dialog: { title: 'Registro de asistencia', description: 'Guarda marcación de entrada, salida, permisos y horas extra vinculadas al empleado y, si aplica, al período.' },
        labels: { employee: 'Empleado', period: 'Período', date: 'Fecha', shift: 'Turno', status: 'Estado', checkIn: 'Entrada', checkOut: 'Salida', late: 'Minutos tarde', overtime: 'Minutos extra', leave: 'Tipo de permiso', notes: 'Notas', noPeriod: 'Sin período' },
        errors: { save: 'No fue posible guardar el registro', remove: 'No fue posible eliminar el registro' },
      }

  async function load() {
    const [attendanceRes, employeesRes, periodsRes] = await Promise.all([
      fetch('/api/nomina/asistencia', { cache: 'no-store' }),
      fetch('/api/nomina/empleados', { cache: 'no-store' }),
      fetch('/api/nomina/periodos', { cache: 'no-store' }),
    ])
    const [attendanceJson, employeesJson, periodsJson] = await Promise.all([
      attendanceRes.json().catch(() => null),
      employeesRes.json().catch(() => null),
      periodsRes.json().catch(() => null),
    ])
    const nextEmployees = (employeesJson?.data as PayrollEmployeeRow[] | undefined) ?? []
    const nextPeriods = (periodsJson?.data as PayrollPeriodRow[] | undefined) ?? []
    setRows((attendanceJson?.data as PayrollAttendanceEntryRow[] | undefined) ?? [])
    setEmployees(nextEmployees)
    setPeriods(nextPeriods)
    setForm((current) => ({
      ...current,
      employeeId: current.employeeId || nextEmployees[0]?.id || '',
      periodId: current.periodId || nextPeriods[0]?.id || '',
    }))
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditingId(null)
    setError(null)
    setForm({ ...EMPTY_FORM, employeeId: employees[0]?.id || '', periodId: periods[0]?.id || '', entryDate: new Date().toISOString().slice(0, 10), shiftName: language === 'en' ? 'Administrative shift' : 'Turno administrativo' })
    setDialogOpen(true)
  }

  function openEdit(item: PayrollAttendanceEntryRow) {
    setEditingId(item.id)
    setError(null)
    setForm({
      employeeId: item.employeeId,
      periodId: item.periodId ?? '',
      entryDate: item.entryDate.slice(0, 10),
      shiftName: item.shiftName,
      status: item.status,
      checkInAt: item.checkInAt ? item.checkInAt.slice(0, 16) : '',
      checkOutAt: item.checkOutAt ? item.checkOutAt.slice(0, 16) : '',
      minutesLate: String(item.minutesLate),
      overtimeMinutes: String(item.overtimeMinutes),
      leaveType: item.leaveType ?? '',
      notes: item.notes ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      ...form,
      periodId: form.periodId || null,
      minutesLate: Number(form.minutesLate || 0),
      overtimeMinutes: Number(form.overtimeMinutes || 0),
    }
    const res = await fetch('/api/nomina/asistencia', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? copy.errors.save)
      setSaving(false)
      return
    }
    setDialogOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm(language === 'en' ? 'Delete this attendance record?' : '¿Eliminar este registro de asistencia?')) return
    const res = await fetch('/api/nomina/asistencia', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? copy.errors.remove)
      return
    }
    await load()
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <Button asChild className="rounded-2xl">
              <Link href={nominaHref('novedades')}>{language === 'en' ? 'Open payroll changes' : 'Abrir novedades'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('portal-empleado')}>{language === 'en' ? 'View collaborator portal' : 'Ver portal del colaborador'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: language === 'en' ? 'Present' : 'Presentes', value: rows.filter((item) => item.status === 'PRESENTE').length, hint: language === 'en' ? 'Completed shifts' : 'Turnos completos', tone: 'teal' },
          { label: language === 'en' ? 'Late' : 'Tardanzas', value: rows.filter((item) => item.status === 'TARDE').length, hint: language === 'en' ? 'Needs follow-up' : 'Requieren seguimiento', tone: 'amber' },
          { label: language === 'en' ? 'Leave' : 'Permisos', value: rows.filter((item) => item.status === 'PERMISO' || item.status === 'VACACIONES' || item.status === 'INCAPACIDAD').length, hint: language === 'en' ? 'Authorized absences' : 'Ausencias autorizadas', tone: 'sky' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end">
        <Button className="rounded-xl" onClick={openCreate}>{copy.actions.create}</Button>
      </div>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{language === 'en' ? 'Administrative attendance tray used to validate presence, overtime and leave before payroll processing.' : 'Bandeja administrativa para validar presencia, horas extra y permisos antes del procesamiento de nómina.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2">
              <div>
                <div className="text-xs font-medium text-amber-800">{language === 'en' ? 'Overtime' : 'Horas extra'}</div>
                <div className="text-xs text-slate-500">{rows.reduce((sum, item) => sum + item.overtimeMinutes, 0)} min</div>
              </div>
              <div className="text-lg font-semibold text-slate-950">{Math.round((rows.reduce((sum, item) => sum + item.overtimeMinutes, 0) / 60) * 10) / 10} h</div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2">
              <div>
                <div className="text-xs font-medium text-emerald-800">{language === 'en' ? 'Vacation entries' : 'Vacaciones'}</div>
                <div className="text-xs text-slate-500">{language === 'en' ? 'Approved records' : 'Registros aprobados'}</div>
              </div>
              <div className="text-lg font-semibold text-slate-950">{rows.filter((item) => item.status === 'VACACIONES').length}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">{copy.labels.employee}</th>
                  <th className="px-3 py-2.5">{copy.labels.date} / {copy.labels.shift}</th>
                  <th className="px-3 py-2.5">{copy.labels.checkIn}</th>
                  <th className="px-3 py-2.5">{copy.labels.checkOut}</th>
                  <th className="px-3 py-2.5 text-right">{copy.labels.late}</th>
                  <th className="px-3 py-2.5 text-right">{copy.labels.overtime}</th>
                  <th className="px-3 py-2.5">{copy.labels.status}</th>
                  <th className="px-3 py-2.5 text-right">{language === 'en' ? 'Actions' : 'Acciones'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((item) => (
                  <tr key={item.id} className="align-middle hover:bg-slate-50/70">
                    <td className="max-w-[220px] px-3 py-2.5">
                      <div className="truncate font-medium text-slate-950">{item.employeeName}</div>
                      <div className="truncate text-xs text-slate-500">{item.periodLabel}{item.leaveType ? ` · ${item.leaveType}` : ''}</div>
                      {item.notes ? <div className="truncate text-xs text-slate-400" title={item.notes}>{item.notes}</div> : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="whitespace-nowrap text-slate-700">{formatDate(item.entryDate, locale)}</div>
                      <div className="text-xs text-slate-500">{item.shiftName}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{formatDate(item.checkInAt, locale)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{formatDate(item.checkOutAt, locale)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{item.minutesLate}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{item.overtimeMinutes}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700">{item.status}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => openEdit(item)}>{copy.actions.edit}</Button>
                        <Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => void handleDelete(item.id)}>{copy.actions.remove}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                      {language === 'en' ? 'No attendance records yet.' : 'No hay registros de asistencia todavía.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{copy.dialog.title}</DialogTitle>
            <DialogDescription>{copy.dialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>{copy.labels.employee}</Label><Select value={form.employeeId} onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.labels.period}</Label><Select value={form.periodId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, periodId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none__">{copy.labels.noPeriod}</SelectItem>{periods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.labels.date}</Label><Input type="date" value={form.entryDate} onChange={(event) => setForm((current) => ({ ...current, entryDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.shift}</Label><Input value={form.shiftName} onChange={(event) => setForm((current) => ({ ...current, shiftName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.status}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PRESENTE">{language === 'en' ? 'Present' : 'Presente'}</SelectItem><SelectItem value="TARDE">{language === 'en' ? 'Late' : 'Tarde'}</SelectItem><SelectItem value="AUSENTE">{language === 'en' ? 'Absent' : 'Ausente'}</SelectItem><SelectItem value="PERMISO">{language === 'en' ? 'Leave' : 'Permiso'}</SelectItem><SelectItem value="VACACIONES">{language === 'en' ? 'Vacation' : 'Vacaciones'}</SelectItem><SelectItem value="INCAPACIDAD">{language === 'en' ? 'Medical leave' : 'Incapacidad'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.labels.leave}</Label><Input value={form.leaveType} onChange={(event) => setForm((current) => ({ ...current, leaveType: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.checkIn}</Label><Input type="datetime-local" value={form.checkInAt} onChange={(event) => setForm((current) => ({ ...current, checkInAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.checkOut}</Label><Input type="datetime-local" value={form.checkOutAt} onChange={(event) => setForm((current) => ({ ...current, checkOutAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.late}</Label><Input type="number" value={form.minutesLate} onChange={(event) => setForm((current) => ({ ...current, minutesLate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.overtime}</Label><Input type="number" value={form.overtimeMinutes} onChange={(event) => setForm((current) => ({ ...current, overtimeMinutes: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.labels.notes}</Label><Textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></div>
          </div>
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{copy.actions.cancel}</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? (language === 'en' ? 'Saving...' : 'Guardando...') : editingId ? copy.actions.save : copy.actions.add}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}