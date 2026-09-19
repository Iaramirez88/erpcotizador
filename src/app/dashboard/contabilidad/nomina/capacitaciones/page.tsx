'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/components/providers/i18n-provider'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaCompactTable, NominaStatusBadge } from '@/components/dashboard/nomina-compact-table'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
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

export default function NominaCapacitacionesPage() {
  const [rows, setRows] = useState<PayrollTrainingAssignmentRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

      <div className="flex justify-end">
        <Button className="rounded-xl" onClick={openCreate}>{copy.create}</Button>
      </div>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{language === 'en' ? 'Training assignments' : 'Asignaciones de formación'}</CardTitle>
          <CardDescription>{language === 'en' ? 'Administrative training tray to assign, complete and certify learning plans before they appear in the collaborator journey.' : 'Bandeja administrativa para asignar, cerrar y certificar planes de formación antes de reflejarlos en la ruta del colaborador.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <NominaCompactTable rows={rows} minWidth="1050px" emptyMessage={language === 'en' ? 'No training assignments yet.' : 'No hay capacitaciones todavía.'} columns={[
            { key: 'training', label: language === 'en' ? 'Training / employee' : 'Capacitación / colaborador', className: 'max-w-[280px]', render: (item) => <><div className="truncate font-medium text-slate-950">{item.title}</div><div className="truncate text-xs text-slate-700">{item.employeeName ?? '—'}</div><div className="truncate text-xs text-slate-400" title={item.summary ?? ''}>{item.summary ?? item.category}</div></> },
            { key: 'delivery', label: language === 'en' ? 'Category / modality' : 'Categoría / modalidad', render: (item) => <><div>{item.category}</div><div className="text-xs text-slate-500">{item.modality}</div></> },
            { key: 'provider', label: language === 'en' ? 'Provider / owner' : 'Proveedor / responsable', className: 'max-w-[190px]', render: (item) => <><div className="truncate">{item.provider ?? '—'}</div><div className="truncate text-xs text-slate-500">{item.ownerName ?? '—'}</div></> },
            { key: 'duration', label: language === 'en' ? 'Hours / score' : 'Horas / score', className: 'tabular-nums', render: (item) => <><div>{item.durationHours} h</div><div className="text-xs text-slate-500">Score: {item.score ?? '—'}</div></> },
            { key: 'dates', label: language === 'en' ? 'Due / completed' : 'Vence / completada', className: 'whitespace-nowrap', render: (item) => <><div>{formatDate(item.dueDate ?? null, locale)}</div><div className="text-xs text-slate-500">{formatDate(item.completedAt ?? null, locale)}</div></> },
            { key: 'status', label: language === 'en' ? 'Status' : 'Estado', render: (item) => <NominaStatusBadge status={item.status} /> },
            { key: 'actions', label: language === 'en' ? 'Actions' : 'Acciones', headerClassName: 'text-right', render: (item) => <div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => openEdit(item)}>{language === 'en' ? 'Edit' : 'Editar'}</Button><Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => void handleDelete(item.id)}>{language === 'en' ? 'Delete' : 'Eliminar'}</Button></div> },
          ]} />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-[28px]">
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
