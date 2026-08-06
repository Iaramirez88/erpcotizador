'use client'

import Link from 'next/link'
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
import { nominaHref } from '@/lib/nomina-routes'
import type { PayrollEmployeeRow, PayrollWhistleblowerCaseRow } from '@/lib/payroll'

const EMPTY_FORM = {
  employeeId: 'none',
  title: '',
  category: 'ACOSO',
  severity: 'MEDIA',
  status: 'RECIBIDA',
  anonymousReport: false,
  confidentialityLevel: 'ALTA',
  reportedChannel: 'PORTAL',
  reporterName: '',
  reporterEmail: '',
  reporterRole: '',
  accusedArea: '',
  occurredAt: '',
  summary: '',
  evidenceSummary: '',
  resolution: '',
  followUpRequired: true,
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
  if (status === 'RESUELTA') return 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800'
  if (status === 'INVESTIGACION') return 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'
  if (status === 'EN_COMITE') return 'rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-800'
  return 'rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800'
}

export default function NominaCanalDenunciasPage() {
  const [rows, setRows] = useState<PayrollWhistleblowerCaseRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mode, setMode } = useDataViewMode('nomina.canal-denuncias', 'grid')
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'Ethics admin',
        title: 'Whistleblowing Channel',
        description: 'Confidential RRHH and compliance backoffice to receive, investigate and close cases submitted through the separated collaborator experience.',
        actions: { create: 'Create case', save: 'Save changes', add: 'Create case', cancel: 'Cancel', edit: 'Edit', remove: 'Delete' },
        dialog: { title: 'Whistleblowing case', description: 'Store the complaint, confidentiality level, assigned owner and investigation outcome.' },
      }
    : {
        eyebrow: 'Ética y cumplimiento',
        title: 'Canal de Denuncias',
        description: 'Backoffice confidencial de RRHH y cumplimiento para recibir, investigar y cerrar reportes enviados desde la superficie separada del colaborador.',
        actions: { create: 'Crear caso', save: 'Guardar cambios', add: 'Crear caso', cancel: 'Cancelar', edit: 'Editar', remove: 'Eliminar' },
        dialog: { title: 'Caso de denuncia', description: 'Guarda la denuncia, el nivel de confidencialidad, el responsable asignado y el resultado de la investigación.' },
      }

  async function load() {
    const [casesRes, employeesRes] = await Promise.all([
      fetch('/api/nomina/canal-denuncias', { cache: 'no-store' }),
      fetch('/api/nomina/empleados', { cache: 'no-store' }),
    ])
    const [casesJson, employeesJson] = await Promise.all([
      casesRes.json().catch(() => null),
      employeesRes.json().catch(() => null),
    ])
    setRows((casesJson?.data as PayrollWhistleblowerCaseRow[] | undefined) ?? [])
    setEmployees((employeesJson?.data as PayrollEmployeeRow[] | undefined) ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditingId(null)
    setError(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(item: PayrollWhistleblowerCaseRow) {
    setEditingId(item.id)
    setError(null)
    setForm({
      employeeId: item.employeeId ?? 'none',
      title: item.title,
      category: item.category,
      severity: item.severity,
      status: item.status,
      anonymousReport: item.anonymousReport,
      confidentialityLevel: item.confidentialityLevel,
      reportedChannel: item.reportedChannel,
      reporterName: item.reporterName ?? '',
      reporterEmail: item.reporterEmail ?? '',
      reporterRole: item.reporterRole ?? '',
      accusedArea: item.accusedArea ?? '',
      occurredAt: item.occurredAt?.slice(0, 10) ?? '',
      summary: item.summary,
      evidenceSummary: item.evidenceSummary ?? '',
      resolution: item.resolution ?? '',
      followUpRequired: item.followUpRequired,
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
      employeeId: form.employeeId === 'none' ? null : form.employeeId,
      reporterName: form.anonymousReport ? '' : form.reporterName,
      reporterEmail: form.anonymousReport ? '' : form.reporterEmail,
    }
    const res = await fetch('/api/nomina/canal-denuncias', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to save case' : 'No fue posible guardar el caso'))
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
    if (!window.confirm(language === 'en' ? 'Delete this complaint case?' : '¿Eliminar este caso de denuncia?')) return
    const res = await fetch('/api/nomina/canal-denuncias', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to delete case' : 'No fue posible eliminar el caso'))
      return
    }
    await load()
  }

  const activeCases = rows.filter((item) => item.status !== 'RESUELTA')
  const resolvedCases = rows.filter((item) => item.status === 'RESUELTA')

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <Button asChild className="rounded-2xl">
              <Link href={nominaHref('portal-empleado')}>{language === 'en' ? 'View employee form' : 'Ver formulario del colaborador'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('servicio-colaborador')}>{language === 'en' ? 'Open service center' : 'Abrir servicio al colaborador'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: language === 'en' ? 'Received' : 'Recibidas', value: rows.filter((item) => item.status === 'RECIBIDA').length, hint: language === 'en' ? 'Pending triage' : 'Pendientes de triage', tone: 'amber' },
          { label: language === 'en' ? 'Investigation' : 'Investigación', value: rows.filter((item) => item.status === 'INVESTIGACION' || item.status === 'EN_COMITE').length, hint: language === 'en' ? 'Active handling' : 'Gestión activa', tone: 'sky' },
          { label: language === 'en' ? 'Resolved' : 'Resueltas', value: resolvedCases.length, hint: language === 'en' ? 'Closed with traceability' : 'Cerradas con trazabilidad', tone: 'teal' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end gap-2">
        <DataViewToggle mode={mode} onChange={setMode} />
        <Button className="rounded-xl" onClick={openCreate}>{copy.actions.create}</Button>
      </div>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{language === 'en' ? 'Active confidential cases' : 'Casos confidenciales activos'}</CardTitle>
          <CardDescription>{language === 'en' ? 'Reports under intake, investigation or committee review.' : 'Reportes en recepción, investigación o revisión por comité.'}</CardDescription>
        </CardHeader>
        <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {activeCases.map((item) => (
            <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{item.title}</div>
                  <div className="text-sm text-slate-500">{item.anonymousReport ? (language === 'en' ? 'Anonymous report' : 'Reporte anónimo') : item.employeeName ?? item.reporterName ?? '—'}</div>
                </div>
                <span className={statusClass(item.status)}>{item.status}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>{language === 'en' ? 'Category' : 'Categoría'}: {item.category}</div>
                <div>{language === 'en' ? 'Severity' : 'Severidad'}: {item.severity}</div>
                <div>{language === 'en' ? 'Confidentiality' : 'Confidencialidad'}: {item.confidentialityLevel}</div>
                <div>{language === 'en' ? 'Channel' : 'Canal'}: {item.reportedChannel}</div>
                <div>{language === 'en' ? 'Assigned to' : 'Asignado a'}: {item.assignedToName ?? '—'}</div>
                <div>{language === 'en' ? 'Area involved' : 'Área involucrada'}: {item.accusedArea ?? '—'}</div>
                <div>{language === 'en' ? 'Occurred' : 'Ocurrió'}: {formatDate(item.occurredAt ?? null, locale)}</div>
              </div>
              <p className="mt-3 text-sm text-slate-600">{item.summary}</p>
              {item.evidenceSummary ? <div className="mt-3 text-sm text-slate-500">{item.evidenceSummary}</div> : null}
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
          <CardTitle>{language === 'en' ? 'Resolved investigations' : 'Investigaciones resueltas'}</CardTitle>
          <CardDescription>{language === 'en' ? 'Closed reports with final action and evidence trail.' : 'Reportes cerrados con acción final y trazabilidad de soporte.'}</CardDescription>
        </CardHeader>
        <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
          {resolvedCases.map((item) => (
            <div key={item.id} className="rounded-[22px] border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{item.title}</div>
                  <div className="text-sm text-slate-500">{item.anonymousReport ? (language === 'en' ? 'Anonymous report' : 'Reporte anónimo') : item.employeeName ?? item.reporterName ?? '—'}</div>
                </div>
                <span className={statusClass(item.status)}>{item.status}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>{language === 'en' ? 'Resolved by' : 'Resuelto por'}: {item.resolvedByName ?? '—'}</div>
                <div>{language === 'en' ? 'Resolved' : 'Resuelto'}: {formatDate(item.resolvedAt ?? null, locale)}</div>
                <div>{language === 'en' ? 'Follow-up' : 'Seguimiento'}: {item.followUpRequired ? (language === 'en' ? 'Required' : 'Requerido') : (language === 'en' ? 'Closed' : 'Cerrado')}</div>
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
            <div className="grid gap-2"><Label>{language === 'en' ? 'Reporter employee' : 'Empleado reportante'}</Label><Select value={form.employeeId} onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{language === 'en' ? 'No employee link' : 'Sin vínculo de empleado'}</SelectItem>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"><div><Label>{language === 'en' ? 'Anonymous report' : 'Reporte anónimo'}</Label><p className="text-xs text-slate-500">{language === 'en' ? 'Hide reporter identity in the case.' : 'Oculta la identidad del reportante en el caso.'}</p></div><Switch checked={form.anonymousReport} onCheckedChange={(checked) => setForm((current) => ({ ...current, anonymousReport: checked }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Title' : 'Título'}</Label><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Category' : 'Categoría'}</Label><Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACOSO">{language === 'en' ? 'Harassment' : 'Acoso'}</SelectItem><SelectItem value="ETICA">{language === 'en' ? 'Ethics' : 'Ética'}</SelectItem><SelectItem value="DATOS">{language === 'en' ? 'Data privacy' : 'Protección de datos'}</SelectItem><SelectItem value="FRAUDE">{language === 'en' ? 'Fraud' : 'Fraude'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Severity' : 'Severidad'}</Label><Select value={form.severity} onValueChange={(value) => setForm((current) => ({ ...current, severity: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BAJA">{language === 'en' ? 'Low' : 'Baja'}</SelectItem><SelectItem value="MEDIA">{language === 'en' ? 'Medium' : 'Media'}</SelectItem><SelectItem value="ALTA">{language === 'en' ? 'High' : 'Alta'}</SelectItem><SelectItem value="CRITICA">{language === 'en' ? 'Critical' : 'Crítica'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Status' : 'Estado'}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RECIBIDA">{language === 'en' ? 'Received' : 'Recibida'}</SelectItem><SelectItem value="INVESTIGACION">{language === 'en' ? 'Investigation' : 'Investigación'}</SelectItem><SelectItem value="EN_COMITE">{language === 'en' ? 'Committee' : 'En comité'}</SelectItem><SelectItem value="RESUELTA">{language === 'en' ? 'Resolved' : 'Resuelta'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Confidentiality' : 'Confidencialidad'}</Label><Select value={form.confidentialityLevel} onValueChange={(value) => setForm((current) => ({ ...current, confidentialityLevel: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MEDIA">{language === 'en' ? 'Medium' : 'Media'}</SelectItem><SelectItem value="ALTA">{language === 'en' ? 'High' : 'Alta'}</SelectItem><SelectItem value="CRITICA">{language === 'en' ? 'Critical' : 'Crítica'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Channel' : 'Canal'}</Label><Select value={form.reportedChannel} onValueChange={(value) => setForm((current) => ({ ...current, reportedChannel: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PORTAL">Portal</SelectItem><SelectItem value="FORMULARIO">{language === 'en' ? 'Form' : 'Formulario'}</SelectItem><SelectItem value="EMAIL">Email</SelectItem><SelectItem value="WHATSAPP">WhatsApp</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Reporter name' : 'Nombre reportante'}</Label><Input value={form.reporterName} onChange={(event) => setForm((current) => ({ ...current, reporterName: event.target.value }))} disabled={form.anonymousReport} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Reporter email' : 'Correo reportante'}</Label><Input value={form.reporterEmail} onChange={(event) => setForm((current) => ({ ...current, reporterEmail: event.target.value }))} disabled={form.anonymousReport} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Reporter role' : 'Rol reportante'}</Label><Input value={form.reporterRole} onChange={(event) => setForm((current) => ({ ...current, reporterRole: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Area involved' : 'Área involucrada'}</Label><Input value={form.accusedArea} onChange={(event) => setForm((current) => ({ ...current, accusedArea: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Occurred at' : 'Fecha ocurrencia'}</Label><Input type="date" value={form.occurredAt} onChange={(event) => setForm((current) => ({ ...current, occurredAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'First response' : 'Primera respuesta'}</Label><Input type="date" value={form.firstResponseAt} onChange={(event) => setForm((current) => ({ ...current, firstResponseAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Resolved at' : 'Fecha resolución'}</Label><Input type="date" value={form.resolvedAt} onChange={(event) => setForm((current) => ({ ...current, resolvedAt: event.target.value }))} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"><div><Label>{language === 'en' ? 'Follow-up required' : 'Requiere seguimiento'}</Label><p className="text-xs text-slate-500">{language === 'en' ? 'Keep the case visible after resolution.' : 'Mantiene visible el caso después del cierre.'}</p></div><Switch checked={form.followUpRequired} onCheckedChange={(checked) => setForm((current) => ({ ...current, followUpRequired: checked }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Summary' : 'Resumen'}</Label><Textarea rows={3} value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Evidence summary' : 'Resumen de evidencias'}</Label><Textarea rows={3} value={form.evidenceSummary} onChange={(event) => setForm((current) => ({ ...current, evidenceSummary: event.target.value }))} /></div>
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
