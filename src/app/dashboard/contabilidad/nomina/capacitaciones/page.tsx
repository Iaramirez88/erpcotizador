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
import { Textarea } from '@/components/ui/textarea'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import { nominaHref } from '@/lib/nomina-routes'
import type { PayrollEmployeeRow, PayrollTrainingAssignmentRow } from '@/lib/payroll'

const EMPTY_FORM = {
  employeeId: 'none',
  title: '',
  category: 'NOMINA',
  status: 'PLANIFICADA',
  modality: 'VIRTUAL',
  provider: '',
  durationHours: '0',
  dueDate: '',
  completedAt: '',
  score: '',
  certificateUrl: '',
  summary: '',
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
  if (status === 'COMPLETADA') return 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800'
  if (status === 'EN_CURSO') return 'rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800'
  if (status === 'PLANIFICADA') return 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'
  return 'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700'
}

export default function NominaCapacitacionesPage() {
  const [rows, setRows] = useState<PayrollTrainingAssignmentRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mode, setMode } = useDataViewMode('nomina.capacitaciones', 'grid')
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'Learning admin',
        title: 'Learning',
        description: 'RRHH learning backoffice for training assignments, providers and completion tracking before certificates or updates surface to the collaborator.',
        create: 'Create training',
      }
    : {
        eyebrow: 'Formación RRHH',
        title: 'Capacitaciones',
        description: 'Backoffice de formación RRHH para asignaciones, proveedores y cierre de capacitaciones antes de reflejar certificados o avances al colaborador.',
        create: 'Crear capacitación',
      }

  async function load() {
    const [trainingsRes, employeesRes] = await Promise.all([
      fetch('/api/nomina/capacitaciones', { cache: 'no-store' }),
      fetch('/api/nomina/empleados', { cache: 'no-store' }),
    ])
    const trainingsJson = (await trainingsRes.json().catch(() => null)) as { data?: PayrollTrainingAssignmentRow[] } | null
    const employeesJson = (await employeesRes.json().catch(() => null)) as { data?: PayrollEmployeeRow[] } | null
    setRows(trainingsJson?.data ?? [])
    setEmployees(employeesJson?.data ?? [])
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

  function openEdit(item: PayrollTrainingAssignmentRow) {
    const employee = employees.find((entry) => entry.fullName === item.employeeName)
    setEditingId(item.id)
    setError(null)
    setForm({
      employeeId: employee?.id ?? 'none',
      title: item.title,
      category: item.category,
      status: item.status,
      modality: item.modality,
      provider: item.provider ?? '',
      durationHours: String(item.durationHours),
      dueDate: item.dueDate?.slice(0, 10) ?? '',
      completedAt: item.completedAt?.slice(0, 10) ?? '',
      score: item.score != null ? String(item.score) : '',
      certificateUrl: item.certificateUrl ?? '',
      summary: item.summary ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      employeeId: form.employeeId === 'none' ? null : form.employeeId,
      title: form.title,
      category: form.category,
      status: form.status,
      modality: form.modality,
      provider: form.provider,
      durationHours: Number(form.durationHours || 0),
      dueDate: form.dueDate || null,
      completedAt: form.completedAt || null,
      score: form.score ? Number(form.score) : null,
      certificateUrl: form.certificateUrl,
      summary: form.summary,
    }
    const res = await fetch('/api/nomina/capacitaciones', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to save training' : 'No fue posible guardar la capacitación'))
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
    if (!window.confirm(language === 'en' ? 'Delete this training assignment?' : '¿Eliminar esta capacitación?')) return
    const res = await fetch('/api/nomina/capacitaciones', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to delete training' : 'No fue posible eliminar la capacitación'))
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
              <Link href={nominaHref('gestion-personas')}>{language === 'en' ? 'Open people station' : 'Abrir estación people'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('portal-empleado')}>{language === 'en' ? 'View collaborator portal' : 'Ver portal del colaborador'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: language === 'en' ? 'Planned' : 'Planificadas', value: rows.filter((item) => item.status === 'PLANIFICADA').length, hint: language === 'en' ? 'Upcoming sessions' : 'Sesiones próximas', tone: 'amber' },
          { label: language === 'en' ? 'In progress' : 'En curso', value: rows.filter((item) => item.status === 'EN_CURSO').length, hint: language === 'en' ? 'Active completion' : 'Cierre activo', tone: 'sky' },
          { label: language === 'en' ? 'Completed' : 'Completadas', value: rows.filter((item) => item.status === 'COMPLETADA').length, hint: language === 'en' ? 'Closed learning' : 'Formación cerrada', tone: 'teal' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end gap-2">
        <DataViewToggle mode={mode} onChange={setMode} />
        <Button className="rounded-xl" onClick={openCreate}>{copy.create}</Button>
      </div>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{language === 'en' ? 'Training assignments' : 'Asignaciones de formación'}</CardTitle>
          <CardDescription>{language === 'en' ? 'Administrative training tray to assign, complete and certify learning plans before they appear in the collaborator journey.' : 'Bandeja administrativa para asignar, cerrar y certificar planes de formación antes de reflejarlos en la ruta del colaborador.'}</CardDescription>
        </CardHeader>
        <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {rows.map((item) => (
            <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{item.title}</div>
                  <div className="text-sm text-slate-500">{item.category}</div>
                </div>
                <span className={statusClass(item.status)}>{item.status}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>{language === 'en' ? 'Employee' : 'Empleado'}: {item.employeeName ?? '—'}</div>
                <div>{language === 'en' ? 'Modality' : 'Modalidad'}: {item.modality}</div>
                <div>{language === 'en' ? 'Provider' : 'Proveedor'}: {item.provider ?? '—'}</div>
                <div>{language === 'en' ? 'Hours' : 'Horas'}: {item.durationHours}</div>
                <div>{language === 'en' ? 'Due date' : 'Vence'}: {formatDate(item.dueDate ?? null, locale)}</div>
                <div>{language === 'en' ? 'Completed' : 'Completada'}: {formatDate(item.completedAt ?? null, locale)}</div>
                <div>{language === 'en' ? 'Score' : 'Score'}: {item.score ?? '—'}</div>
                <div>{language === 'en' ? 'Owner' : 'Responsable'}: {item.ownerName ?? '—'}</div>
              </div>
              {item.summary ? <p className="mt-3 text-sm text-slate-600">{item.summary}</p> : null}
              {item.certificateUrl ? <div className="mt-3 text-xs text-slate-500">{item.certificateUrl}</div> : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => openEdit(item)}>{language === 'en' ? 'Edit' : 'Editar'}</Button>
                <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(item.id)}>{language === 'en' ? 'Delete' : 'Eliminar'}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{language === 'en' ? 'Training assignment' : 'Asignación de capacitación'}</DialogTitle>
            <DialogDescription>{language === 'en' ? 'Capture the employee, provider, modality and completion details.' : 'Captura el empleado, proveedor, modalidad y datos de cierre.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2"><Label>{language === 'en' ? 'Employee' : 'Empleado'}</Label><Select value={form.employeeId} onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{language === 'en' ? 'No employee linked' : 'Sin empleado ligado'}</SelectItem>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Title' : 'Título'}</Label><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Category' : 'Categoría'}</Label><Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NOMINA">{language === 'en' ? 'Payroll' : 'Nómina'}</SelectItem><SelectItem value="LIDERAZGO">{language === 'en' ? 'Leadership' : 'Liderazgo'}</SelectItem><SelectItem value="ANALITICA">{language === 'en' ? 'Analytics' : 'Analítica'}</SelectItem><SelectItem value="CUMPLIMIENTO">{language === 'en' ? 'Compliance' : 'Cumplimiento'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Status' : 'Estado'}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PLANIFICADA">{language === 'en' ? 'Planned' : 'Planificada'}</SelectItem><SelectItem value="EN_CURSO">{language === 'en' ? 'In progress' : 'En curso'}</SelectItem><SelectItem value="COMPLETADA">{language === 'en' ? 'Completed' : 'Completada'}</SelectItem><SelectItem value="VENCIDA">{language === 'en' ? 'Expired' : 'Vencida'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Modality' : 'Modalidad'}</Label><Select value={form.modality} onValueChange={(value) => setForm((current) => ({ ...current, modality: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="VIRTUAL">Virtual</SelectItem><SelectItem value="PRESENCIAL">{language === 'en' ? 'In person' : 'Presencial'}</SelectItem><SelectItem value="HIBRIDA">{language === 'en' ? 'Hybrid' : 'Híbrida'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Provider' : 'Proveedor'}</Label><Input value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Hours' : 'Horas'}</Label><Input type="number" value={form.durationHours} onChange={(event) => setForm((current) => ({ ...current, durationHours: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Score' : 'Score'}</Label><Input type="number" step="0.1" value={form.score} onChange={(event) => setForm((current) => ({ ...current, score: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Due date' : 'Fecha límite'}</Label><Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Completed at' : 'Fecha cierre'}</Label><Input type="date" value={form.completedAt} onChange={(event) => setForm((current) => ({ ...current, completedAt: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Certificate URL' : 'URL certificado'}</Label><Input value={form.certificateUrl} onChange={(event) => setForm((current) => ({ ...current, certificateUrl: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Summary' : 'Resumen'}</Label><Textarea rows={3} value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} /></div>
          </div>
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{language === 'en' ? 'Cancel' : 'Cancelar'}</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? (language === 'en' ? 'Saving...' : 'Guardando...') : editingId ? (language === 'en' ? 'Save changes' : 'Guardar cambios') : (language === 'en' ? 'Create training' : 'Crear capacitación')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
