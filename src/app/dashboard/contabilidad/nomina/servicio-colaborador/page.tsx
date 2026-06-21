'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/components/providers/i18n-provider'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import type { PayrollEmployeeRow, PayrollEmployeeServiceCaseRow, PayrollPeriodRow } from '@/lib/payroll'

const EMPTY_FORM = {
  employeeId: '',
  periodId: 'none',
  title: '',
  category: 'CERTIFICADOS',
  channel: 'PORTAL',
  priority: 'MEDIA',
  status: 'ABIERTO',
  portalVisibility: true,
  employeeRole: '',
  summary: '',
  resolution: '',
  slaHours: '24',
  requestedAt: '',
  firstResponseAt: '',
  resolvedAt: '',
  notes: '',
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

function statusClass(status: string) {
  if (status === 'RESUELTO') return 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800'
  if (status === 'EN_GESTION') return 'rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800'
  if (status === 'EN_ESPERA') return 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'
  return 'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700'
}

export default function NominaServicioColaboradorPage() {
  const [rows, setRows] = useState<PayrollEmployeeServiceCaseRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mode, setMode } = useDataViewMode('nomina.servicio-colaborador', 'grid')
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'Payroll + HR',
        title: 'Employee Service Center',
        description: 'Operational case tray for certificates, access, payroll data changes and portal support linked to the employee record.',
        actions: { create: 'Create service case', save: 'Save changes', add: 'Create case', cancel: 'Cancel', edit: 'Edit', remove: 'Delete' },
        dialog: { title: 'Service case', description: 'Store the employee request, service level, current status and closing notes.' },
      }
    : {
        eyebrow: 'Nómina + HR',
        title: 'Servicio al Colaborador',
        description: 'Bandeja operativa de casos para certificados, accesos, cambios de datos de nómina y soporte del portal ligados a la ficha del colaborador.',
        actions: { create: 'Crear caso de servicio', save: 'Guardar cambios', add: 'Crear caso', cancel: 'Cancelar', edit: 'Editar', remove: 'Eliminar' },
        dialog: { title: 'Caso de servicio', description: 'Guarda la solicitud del colaborador, el nivel de servicio, el estado actual y las notas de cierre.' },
      }

  async function load() {
    const [casesRes, employeesRes, periodsRes] = await Promise.all([
      fetch('/api/nomina/servicio-colaborador', { cache: 'no-store' }),
      fetch('/api/nomina/empleados', { cache: 'no-store' }),
      fetch('/api/nomina/periodos', { cache: 'no-store' }),
    ])
    const [casesJson, employeesJson, periodsJson] = await Promise.all([
      casesRes.json().catch(() => null),
      employeesRes.json().catch(() => null),
      periodsRes.json().catch(() => null),
    ])
    const nextEmployees = (employeesJson?.data as PayrollEmployeeRow[] | undefined) ?? []
    const nextPeriods = (periodsJson?.data as PayrollPeriodRow[] | undefined) ?? []
    setRows((casesJson?.data as PayrollEmployeeServiceCaseRow[] | undefined) ?? [])
    setEmployees(nextEmployees)
    setPeriods(nextPeriods)
    setForm((current) => ({
      ...current,
      employeeId: current.employeeId || nextEmployees[0]?.id || '',
      periodId: current.periodId === 'none' && nextPeriods[0]?.id ? nextPeriods[0].id : current.periodId,
    }))
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditingId(null)
    setError(null)
    setForm({
      ...EMPTY_FORM,
      employeeId: employees[0]?.id || '',
      periodId: periods[0]?.id || 'none',
      requestedAt: new Date().toISOString().slice(0, 10),
    })
    setDialogOpen(true)
  }

  function openEdit(item: PayrollEmployeeServiceCaseRow) {
    setEditingId(item.id)
    setError(null)
    setForm({
      employeeId: item.employeeId,
      periodId: item.periodId ?? 'none',
      title: item.title,
      category: item.category,
      channel: item.channel,
      priority: item.priority,
      status: item.status,
      portalVisibility: item.portalVisibility,
      employeeRole: item.employeeRole ?? '',
      summary: item.summary,
      resolution: item.resolution ?? '',
      slaHours: String(item.slaHours),
      requestedAt: item.requestedAt.slice(0, 10),
      firstResponseAt: item.firstResponseAt?.slice(0, 10) ?? '',
      resolvedAt: item.resolvedAt?.slice(0, 10) ?? '',
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
      periodId: form.periodId === 'none' ? null : form.periodId,
      slaHours: Number(form.slaHours || 24),
    }
    const res = await fetch('/api/nomina/servicio-colaborador', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to save service case' : 'No fue posible guardar el caso'))
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
    if (!window.confirm(language === 'en' ? 'Delete this service case?' : '¿Eliminar este caso de servicio?')) return
    const res = await fetch('/api/nomina/servicio-colaborador', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to delete service case' : 'No fue posible eliminar el caso'))
      return
    }
    await load()
  }

  const openCases = rows.filter((item) => item.status !== 'RESUELTO')
  const resolvedCases = rows.filter((item) => item.status === 'RESUELTO')

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        stats={[
          { label: language === 'en' ? 'Open' : 'Abiertos', value: rows.filter((item) => item.status === 'ABIERTO').length, hint: language === 'en' ? 'New requests' : 'Solicitudes nuevas', tone: 'amber' },
          { label: language === 'en' ? 'In progress' : 'En gestión', value: rows.filter((item) => item.status === 'EN_GESTION').length, hint: language === 'en' ? 'Assigned cases' : 'Casos asignados', tone: 'sky' },
          { label: language === 'en' ? 'Resolved' : 'Resueltos', value: resolvedCases.length, hint: language === 'en' ? 'Closed with response' : 'Cerrados con respuesta', tone: 'teal' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end gap-2">
        <DataViewToggle mode={mode} onChange={setMode} />
        <Button className="rounded-xl" onClick={openCreate}>{copy.actions.create}</Button>
      </div>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{language === 'en' ? 'Active service queue' : 'Cola activa de servicio'}</CardTitle>
          <CardDescription>{language === 'en' ? 'Requests that still need action, response or supporting documentation.' : 'Solicitudes que todavía requieren gestión, respuesta o soporte documental.'}</CardDescription>
        </CardHeader>
        <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {openCases.map((item) => (
            <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{item.title}</div>
                  <div className="text-sm text-slate-500">{item.employeeName}</div>
                </div>
                <span className={statusClass(item.status)}>{item.status}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>{language === 'en' ? 'Category' : 'Categoría'}: {item.category}</div>
                <div>{language === 'en' ? 'Priority' : 'Prioridad'}: {item.priority}</div>
                <div>{language === 'en' ? 'Channel' : 'Canal'}: {item.channel}</div>
                <div>{language === 'en' ? 'Assigned to' : 'Asignado a'}: {item.assignedToName ?? '—'}</div>
                <div>{language === 'en' ? 'Period' : 'Período'}: {item.periodLabel}</div>
                <div>{language === 'en' ? 'SLA' : 'SLA'}: {item.slaHours}h</div>
                <div>{language === 'en' ? 'Requested' : 'Solicitado'}: {formatDate(item.requestedAt, locale)}</div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{item.summary}</p>
              {item.notes ? <div className="mt-3 text-sm text-slate-500">{item.notes}</div> : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => openEdit(item)}>{copy.actions.edit}</Button>
                <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(item.id)}>{copy.actions.remove}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{language === 'en' ? 'Resolved and portal-visible cases' : 'Casos resueltos y visibles en portal'}</CardTitle>
          <CardDescription>{language === 'en' ? 'Closed requests with response traceability and employee-facing visibility.' : 'Solicitudes cerradas con trazabilidad de respuesta y visibilidad hacia el colaborador.'}</CardDescription>
        </CardHeader>
        <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
          {resolvedCases.map((item) => (
            <div key={item.id} className="rounded-[22px] border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{item.title}</div>
                  <div className="text-sm text-slate-500">{item.employeeName}</div>
                </div>
                <span className={statusClass(item.status)}>{item.status}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>{language === 'en' ? 'Resolved by' : 'Resuelto por'}: {item.resolvedByName ?? '—'}</div>
                <div>{language === 'en' ? 'Resolved' : 'Resuelto'}: {formatDate(item.resolvedAt ?? null, locale)}</div>
                <div>{language === 'en' ? 'Portal visible' : 'Visible en portal'}: {item.portalVisibility ? (language === 'en' ? 'Yes' : 'Sí') : 'No'}</div>
              </div>
              {item.resolution ? <p className="mt-3 text-sm text-slate-600">{item.resolution}</p> : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => openEdit(item)}>{copy.actions.edit}</Button>
                <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(item.id)}>{copy.actions.remove}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{copy.dialog.title}</DialogTitle>
            <DialogDescription>{copy.dialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2"><Label>{language === 'en' ? 'Employee' : 'Empleado'}</Label><Select value={form.employeeId} onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Period' : 'Período'}</Label><Select value={form.periodId} onValueChange={(value) => setForm((current) => ({ ...current, periodId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{language === 'en' ? 'No period' : 'Sin período'}</SelectItem>{periods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Title' : 'Título'}</Label><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Category' : 'Categoría'}</Label><Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CERTIFICADOS">{language === 'en' ? 'Certificates' : 'Certificados'}</SelectItem><SelectItem value="DATOS">{language === 'en' ? 'Data changes' : 'Actualización de datos'}</SelectItem><SelectItem value="ACCESOS">{language === 'en' ? 'Access' : 'Accesos'}</SelectItem><SelectItem value="PORTAL">{language === 'en' ? 'Portal support' : 'Soporte portal'}</SelectItem><SelectItem value="NOMINA">{language === 'en' ? 'Payroll support' : 'Soporte nómina'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Channel' : 'Canal'}</Label><Select value={form.channel} onValueChange={(value) => setForm((current) => ({ ...current, channel: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PORTAL">Portal</SelectItem><SelectItem value="EMAIL">Email</SelectItem><SelectItem value="WHATSAPP">WhatsApp</SelectItem><SelectItem value="PRESENCIAL">{language === 'en' ? 'In person' : 'Presencial'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Priority' : 'Prioridad'}</Label><Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BAJA">{language === 'en' ? 'Low' : 'Baja'}</SelectItem><SelectItem value="MEDIA">{language === 'en' ? 'Medium' : 'Media'}</SelectItem><SelectItem value="ALTA">{language === 'en' ? 'High' : 'Alta'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Status' : 'Estado'}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ABIERTO">{language === 'en' ? 'Open' : 'Abierto'}</SelectItem><SelectItem value="EN_GESTION">{language === 'en' ? 'In progress' : 'En gestión'}</SelectItem><SelectItem value="EN_ESPERA">{language === 'en' ? 'Waiting' : 'En espera'}</SelectItem><SelectItem value="RESUELTO">{language === 'en' ? 'Resolved' : 'Resuelto'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Employee role' : 'Rol del colaborador'}</Label><Input value={form.employeeRole} onChange={(event) => setForm((current) => ({ ...current, employeeRole: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'SLA hours' : 'Horas SLA'}</Label><Input type="number" value={form.slaHours} onChange={(event) => setForm((current) => ({ ...current, slaHours: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Requested at' : 'Fecha solicitud'}</Label><Input type="date" value={form.requestedAt} onChange={(event) => setForm((current) => ({ ...current, requestedAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'First response' : 'Primera respuesta'}</Label><Input type="date" value={form.firstResponseAt} onChange={(event) => setForm((current) => ({ ...current, firstResponseAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Resolved at' : 'Fecha resolución'}</Label><Input type="date" value={form.resolvedAt} onChange={(event) => setForm((current) => ({ ...current, resolvedAt: event.target.value }))} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"><div><Label>{language === 'en' ? 'Visible in portal' : 'Visible en portal'}</Label><p className="text-xs text-slate-500">{language === 'en' ? 'Show the response to the employee self-service view.' : 'Muestra la respuesta en autoservicio del colaborador.'}</p></div><Switch checked={form.portalVisibility} onCheckedChange={(checked) => setForm((current) => ({ ...current, portalVisibility: checked }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Summary' : 'Resumen'}</Label><Textarea rows={3} value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Resolution' : 'Resolución'}</Label><Textarea rows={3} value={form.resolution} onChange={(event) => setForm((current) => ({ ...current, resolution: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Notes' : 'Notas'}</Label><Textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></div>
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
