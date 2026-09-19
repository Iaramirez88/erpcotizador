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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { nominaHref } from '@/lib/nomina-routes'
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
  const base = 'inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase shadow-sm'
  if (status === 'RESUELTO') return `${base} border-emerald-400 bg-emerald-500 text-white`
  if (status === 'EN_GESTION') return `${base} border-amber-300 bg-amber-400 text-slate-950`
  if (status === 'EN_ESPERA') return `${base} border-sky-400 bg-sky-500 text-white`
  return `${base} border-slate-800 bg-slate-900 text-white`
}

function priorityClass(priority: string) {
  if (priority === 'ALTA') return 'border-rose-200 bg-rose-100 text-rose-800'
  if (priority === 'BAJA') return 'border-sky-200 bg-sky-100 text-sky-800'
  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function ServiceCasesTable({ rows, language, locale, onEdit, onDelete }: { rows: PayrollEmployeeServiceCaseRow[]; language: string; locale: string; onEdit: (item: PayrollEmployeeServiceCaseRow) => void; onDelete: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[1160px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-medium text-slate-500">
          <tr>
            <th className="px-3 py-2.5">{language === 'en' ? 'Employee / case' : 'Colaborador / caso'}</th>
            <th className="px-3 py-2.5">{language === 'en' ? 'Category / channel' : 'Categoría / canal'}</th>
            <th className="px-3 py-2.5">{language === 'en' ? 'Owner / period' : 'Responsable / período'}</th>
            <th className="px-3 py-2.5">{language === 'en' ? 'Priority / SLA' : 'Prioridad / SLA'}</th>
            <th className="px-3 py-2.5">{language === 'en' ? 'Dates' : 'Fechas'}</th>
            <th className="px-3 py-2.5">{language === 'en' ? 'Portal' : 'Portal'}</th>
            <th className="px-3 py-2.5">{language === 'en' ? 'Status' : 'Estado'}</th>
            <th className="px-3 py-2.5 text-right">{language === 'en' ? 'Actions' : 'Acciones'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((item) => (
            <tr key={item.id} className="align-middle hover:bg-slate-50/70">
              <td className="max-w-[280px] px-3 py-2.5">
                <div className="truncate font-medium text-slate-950">{item.employeeName}</div>
                <div className="truncate text-xs text-slate-700">{item.title}</div>
                <div className="truncate text-xs text-slate-400" title={item.summary}>{item.summary}</div>
              </td>
              <td className="px-3 py-2.5"><div className="text-slate-700">{item.category}</div><div className="text-xs text-slate-500">{item.channel}</div></td>
              <td className="max-w-[190px] px-3 py-2.5"><div className="truncate text-slate-700">{item.status === 'RESUELTO' ? item.resolvedByName ?? item.assignedToName ?? '—' : item.assignedToName ?? '—'}</div><div className="truncate text-xs text-slate-500">{item.periodLabel}</div></td>
              <td className="px-3 py-2.5"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${priorityClass(item.priority)}`}>{item.priority}</span><div className="mt-1 text-xs text-slate-500">SLA: {item.slaHours}h</div></td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-700"><div>{formatDate(item.requestedAt, locale)}</div><div className="text-xs text-slate-500">{item.resolvedAt ? `${language === 'en' ? 'Resolved' : 'Resuelto'}: ${formatDate(item.resolvedAt, locale)}` : item.firstResponseAt ? `${language === 'en' ? 'Response' : 'Respuesta'}: ${formatDate(item.firstResponseAt, locale)}` : (language === 'en' ? 'No response yet' : 'Sin respuesta')}</div></td>
              <td className="px-3 py-2.5"><span className={item.portalVisibility ? 'text-xs font-medium text-emerald-700' : 'text-xs text-slate-400'}>{item.portalVisibility ? (language === 'en' ? 'Visible' : 'Visible') : (language === 'en' ? 'Internal' : 'Interno')}</span></td>
              <td className="px-3 py-2.5"><span className={statusClass(item.status)}>{item.status.replaceAll('_', ' ')}</span></td>
              <td className="px-3 py-2.5"><div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => onEdit(item)}>{language === 'en' ? 'Edit' : 'Editar'}</Button><Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => onDelete(item.id)}>{language === 'en' ? 'Delete' : 'Eliminar'}</Button></div></td>
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">{language === 'en' ? 'No service cases in this queue.' : 'No hay casos de servicio en esta bandeja.'}</td></tr> : null}
        </tbody>
      </table>
    </div>
  )
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
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'HR service admin',
        title: 'Employee Service Center',
        description: 'RRHH service backoffice for certificates, data changes, access requests and portal support coming from the collaborator experience.',
        actions: { create: 'Create service case', save: 'Save changes', add: 'Create case', cancel: 'Cancel', edit: 'Edit', remove: 'Delete' },
        dialog: { title: 'Service case', description: 'Store the employee request, service level, current status and closing notes.' },
      }
    : {
        eyebrow: 'RRHH servicio',
        title: 'Servicio al Colaborador',
        description: 'Backoffice de servicio RRHH para certificados, accesos, cambios de datos de nómina y soporte del portal que nacen desde la experiencia del colaborador.',
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
        actions={
          <>
            <Button asChild className="rounded-2xl">
              <Link href={nominaHref('portal-empleado')}>{language === 'en' ? 'View employee portal' : 'Ver portal del colaborador'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('canal-denuncias')}>{language === 'en' ? 'Open ethics cases' : 'Abrir casos éticos'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: language === 'en' ? 'Open' : 'Abiertos', value: rows.filter((item) => item.status === 'ABIERTO').length, hint: language === 'en' ? 'New requests' : 'Solicitudes nuevas', tone: 'amber' },
          { label: language === 'en' ? 'In progress' : 'En gestión', value: rows.filter((item) => item.status === 'EN_GESTION').length, hint: language === 'en' ? 'Assigned cases' : 'Casos asignados', tone: 'sky' },
          { label: language === 'en' ? 'Resolved' : 'Resueltos', value: resolvedCases.length, hint: language === 'en' ? 'Closed with response' : 'Cerrados con respuesta', tone: 'teal' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end">
        <Button className="rounded-xl" onClick={openCreate}>{copy.actions.create}</Button>
      </div>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{language === 'en' ? 'Active service queue' : 'Cola activa de servicio'}</CardTitle>
          <CardDescription>{language === 'en' ? 'Requests that still need action, response or supporting documentation.' : 'Solicitudes que todavía requieren gestión, respuesta o soporte documental.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <ServiceCasesTable rows={openCases} language={language} locale={locale} onEdit={openEdit} onDelete={(id) => void handleDelete(id)} />
        </CardContent>
      </Card>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{language === 'en' ? 'Resolved and portal-visible cases' : 'Casos resueltos y visibles en portal'}</CardTitle>
          <CardDescription>{language === 'en' ? 'Closed requests with response traceability and employee-facing visibility.' : 'Solicitudes cerradas con trazabilidad de respuesta y visibilidad hacia el colaborador.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <ServiceCasesTable rows={resolvedCases} language={language} locale={locale} onEdit={openEdit} onDelete={(id) => void handleDelete(id)} />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-[28px]">
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
