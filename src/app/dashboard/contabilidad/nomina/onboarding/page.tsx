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
import type { PayrollEmployeeRow, PayrollOnboardingJourneyRow, PayrollPeriodRow } from '@/lib/payroll'
import type { PayrollPeopleOverview } from '@/lib/payroll-people'

const EMPTY_FORM = {
  employeeId: '',
  periodId: 'none',
  workflowTemplateId: 'none',
  title: '',
  status: 'PLANIFICADO',
  phase: 'PRE_INGRESO',
  employeeRole: '',
  locationLabel: '',
  welcomeMessage: '',
  startDate: '',
  targetDate: '',
  notes: '',
  checklistText: 'Crear usuario corporativo | TI | COMPLETADA\nAsignar documentos para firma | RRHH | EN_CURSO\nEnviar bienvenida y agenda | Líder | PENDIENTE',
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

function parseChecklistText(value: string) {
  return value
    .split('\n')
    .map((line, index) => {
      const [title, owner, status, dueLabel] = line.split('|').map((part) => part.trim())
      if (!title || !owner || !status) return null
      return {
        id: `step-${index + 1}`,
        title,
        owner,
        status,
        dueLabel: dueLabel || null,
      }
    })
    .filter((item): item is { id: string; title: string; owner: string; status: string; dueLabel: string | null } => item !== null)
}

function checklistToText(value: PayrollOnboardingJourneyRow['checklist']) {
  return value.map((item) => [item.title, item.owner, item.status, item.dueLabel ?? ''].filter(Boolean).join(' | ')).join('\n')
}

function statusClass(status: string) {
  const base = 'inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase shadow-sm'
  if (status === 'COMPLETADO' || status === 'COMPLETADA') return `${base} border-emerald-400 bg-emerald-500 text-white`
  if (status === 'BLOQUEADO' || status === 'BLOQUEADA') return `${base} border-rose-400 bg-rose-500 text-white`
  if (status === 'EN_CURSO') return `${base} border-amber-300 bg-amber-400 text-slate-950`
  return `${base} border-slate-800 bg-slate-900 text-white`
}

export default function NominaOnboardingPage() {
  const [rows, setRows] = useState<PayrollOnboardingJourneyRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [peopleOverview, setPeopleOverview] = useState<PayrollPeopleOverview | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'Onboarding admin',
        title: 'Real Onboarding',
        description: 'RRHH onboarding backoffice with operational journeys, checklist execution and handoff toward the collaborator portal and documents.',
        actions: { create: 'Create onboarding journey', save: 'Save changes', add: 'Create journey', cancel: 'Cancel', edit: 'Edit', remove: 'Delete' },
        dialog: { title: 'Onboarding journey', description: 'Assign the employee, operational phase, dates and checklist that drive the first days execution.' },
      }
    : {
        eyebrow: 'Onboarding RRHH',
        title: 'Onboarding real',
        description: 'Backoffice de RRHH para journeys operativos de ingreso, checklist ejecutable y traspaso controlado hacia portal y documentos del colaborador.',
        actions: { create: 'Crear journey de onboarding', save: 'Guardar cambios', add: 'Crear journey', cancel: 'Cancelar', edit: 'Editar', remove: 'Eliminar' },
        dialog: { title: 'Journey de onboarding', description: 'Asigna colaborador, fase operativa, fechas y checklist que gobiernan la ejecución de los primeros días.' },
      }

  const workflowOptions = (peopleOverview?.workflowTemplates ?? []).filter((item) => item.category === 'Onboarding')

  async function load() {
    const [journeysRes, employeesRes, periodsRes, peopleRes] = await Promise.all([
      fetch('/api/nomina/onboarding', { cache: 'no-store' }),
      fetch('/api/nomina/empleados', { cache: 'no-store' }),
      fetch('/api/nomina/periodos', { cache: 'no-store' }),
      fetch('/api/nomina/gestion-personas/overview', { cache: 'no-store' }),
    ])
    const [journeysJson, employeesJson, periodsJson, peopleJson] = await Promise.all([
      journeysRes.json().catch(() => null),
      employeesRes.json().catch(() => null),
      periodsRes.json().catch(() => null),
      peopleRes.json().catch(() => null),
    ])
    const nextEmployees = (employeesJson?.data as PayrollEmployeeRow[] | undefined) ?? []
    const nextPeriods = (periodsJson?.data as PayrollPeriodRow[] | undefined) ?? []
    const nextPeople = (peopleJson?.data as PayrollPeopleOverview | undefined) ?? null
    setRows((journeysJson?.data as PayrollOnboardingJourneyRow[] | undefined) ?? [])
    setEmployees(nextEmployees)
    setPeriods(nextPeriods)
    setPeopleOverview(nextPeople)
    setForm((current) => ({
      ...current,
      employeeId: current.employeeId || nextEmployees[0]?.id || '',
      periodId: current.periodId === 'none' && nextPeriods[0]?.id ? nextPeriods[0].id : current.periodId,
      workflowTemplateId: current.workflowTemplateId === 'none' && nextPeople?.workflowTemplates[0]?.id ? nextPeople.workflowTemplates[0].id : current.workflowTemplateId,
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
      workflowTemplateId: workflowOptions[0]?.id || 'none',
      startDate: new Date().toISOString().slice(0, 10),
      targetDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    })
    setDialogOpen(true)
  }

  function openEdit(item: PayrollOnboardingJourneyRow) {
    setEditingId(item.id)
    setError(null)
    setForm({
      employeeId: item.employeeId,
      periodId: item.periodId ?? 'none',
      workflowTemplateId: item.workflowTemplateId ?? 'none',
      title: item.title,
      status: item.status,
      phase: item.phase,
      employeeRole: item.employeeRole ?? '',
      locationLabel: item.locationLabel ?? '',
      welcomeMessage: item.welcomeMessage ?? '',
      startDate: item.startDate.slice(0, 10),
      targetDate: item.targetDate?.slice(0, 10) ?? '',
      notes: item.notes ?? '',
      checklistText: checklistToText(item.checklist),
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
      workflowTemplateId: form.workflowTemplateId === 'none' ? null : form.workflowTemplateId,
      checklist: parseChecklistText(form.checklistText),
    }
    const res = await fetch('/api/nomina/onboarding', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to save onboarding journey' : 'No fue posible guardar el journey'))
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
    if (!window.confirm(language === 'en' ? 'Delete this onboarding journey?' : '¿Eliminar este journey de onboarding?')) return
    const res = await fetch('/api/nomina/onboarding', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to delete onboarding journey' : 'No fue posible eliminar el journey'))
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
              <Link href={nominaHref('empleados')}>{language === 'en' ? 'Open employees' : 'Abrir empleados'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('portal-empleado')}>{language === 'en' ? 'View collaborator portal' : 'Ver portal del colaborador'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: language === 'en' ? 'Planned' : 'Planificados', value: rows.filter((item) => item.status === 'PLANIFICADO').length, hint: language === 'en' ? 'Not started yet' : 'Aún no arrancan', tone: 'amber' },
          { label: language === 'en' ? 'In progress' : 'En curso', value: rows.filter((item) => item.status === 'EN_CURSO').length, hint: language === 'en' ? 'Operational execution' : 'Ejecución operativa', tone: 'sky' },
          { label: language === 'en' ? 'Completed' : 'Completados', value: rows.filter((item) => item.status === 'COMPLETADO').length, hint: language === 'en' ? 'Ready for portal' : 'Listos para portal', tone: 'teal' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end">
        <Button className="rounded-xl" onClick={openCreate}>{copy.actions.create}</Button>
      </div>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{language === 'en' ? 'Operational journey tray' : 'Bandeja operativa de journeys'}</CardTitle>
          <CardDescription>{language === 'en' ? 'Each record tracks phase, responsible owner, dates and checklist handoff with workflows and payroll records.' : 'Cada registro controla fase, responsable, fechas y checklist conectado con workflows y registros de nómina.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">{language === 'en' ? 'Employee / journey' : 'Colaborador / journey'}</th>
                  <th className="px-3 py-2.5">{language === 'en' ? 'Phase / location' : 'Fase / ubicación'}</th>
                  <th className="px-3 py-2.5">{language === 'en' ? 'Owner / workflow' : 'Responsable / workflow'}</th>
                  <th className="px-3 py-2.5">{language === 'en' ? 'Dates' : 'Fechas'}</th>
                  <th className="px-3 py-2.5">Checklist</th>
                  <th className="px-3 py-2.5">{language === 'en' ? 'Status' : 'Estado'}</th>
                  <th className="px-3 py-2.5 text-right">{language === 'en' ? 'Actions' : 'Acciones'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((item) => {
                  const completedSteps = item.checklist.filter((step) => step.status === 'COMPLETADA' || step.status === 'COMPLETADO').length
                  const nextStep = item.checklist.find((step) => step.status !== 'COMPLETADA' && step.status !== 'COMPLETADO')
                  return (
                    <tr key={item.id} className="align-middle hover:bg-slate-50/70">
                      <td className="max-w-[240px] px-3 py-2.5">
                        <div className="truncate font-medium text-slate-950">{item.employeeName}</div>
                        <div className="truncate text-xs text-slate-600">{item.title}</div>
                        <div className="truncate text-xs text-slate-400">{item.employeeRole ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-slate-700">{item.phase.replaceAll('_', ' ')}</div>
                        <div className="text-xs text-slate-500">{item.locationLabel ?? '—'}</div>
                      </td>
                      <td className="max-w-[210px] px-3 py-2.5">
                        <div className="truncate text-slate-700">{item.ownerName ?? '—'}</div>
                        <div className="truncate text-xs text-slate-500">{item.workflowTemplateName ?? '—'}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">
                        <div>{formatDate(item.startDate, locale)}</div>
                        <div className="text-xs text-slate-500">{language === 'en' ? 'Target' : 'Objetivo'}: {formatDate(item.targetDate ?? null, locale)}</div>
                      </td>
                      <td className="max-w-[260px] px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }} /></div>
                          <span className="text-xs font-semibold text-slate-700">{item.progress}%</span>
                          <span className="text-xs text-slate-400">{completedSteps}/{item.checklist.length}</span>
                        </div>
                        {nextStep ? <div className="mt-1 flex min-w-0 items-center gap-2"><span className="truncate text-xs text-slate-600" title={nextStep.title}>{nextStep.title}</span><span className={statusClass(nextStep.status)}>{nextStep.status.replaceAll('_', ' ')}</span></div> : <div className="mt-1 text-xs text-emerald-700">{language === 'en' ? 'Checklist completed' : 'Checklist completado'}</div>}
                      </td>
                      <td className="px-3 py-2.5"><span className={statusClass(item.status)}>{item.status.replaceAll('_', ' ')}</span></td>
                      <td className="px-3 py-2.5"><div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => openEdit(item)}>{copy.actions.edit}</Button><Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => void handleDelete(item.id)}>{copy.actions.remove}</Button></div></td>
                    </tr>
                  )
                })}
                {!rows.length ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">{language === 'en' ? 'No onboarding journeys yet.' : 'No hay journeys de onboarding todavía.'}</td></tr> : null}
              </tbody>
            </table>
          </div>
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
            <div className="grid gap-2"><Label>{language === 'en' ? 'Workflow template' : 'Plantilla de workflow'}</Label><Select value={form.workflowTemplateId} onValueChange={(value) => setForm((current) => ({ ...current, workflowTemplateId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{language === 'en' ? 'No template' : 'Sin plantilla'}</SelectItem>{workflowOptions.map((workflow) => <SelectItem key={workflow.id} value={workflow.id}>{workflow.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Title' : 'Título'}</Label><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Status' : 'Estado'}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PLANIFICADO">{language === 'en' ? 'Planned' : 'Planificado'}</SelectItem><SelectItem value="EN_CURSO">{language === 'en' ? 'In progress' : 'En curso'}</SelectItem><SelectItem value="BLOQUEADO">{language === 'en' ? 'Blocked' : 'Bloqueado'}</SelectItem><SelectItem value="COMPLETADO">{language === 'en' ? 'Completed' : 'Completado'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Phase' : 'Fase'}</Label><Select value={form.phase} onValueChange={(value) => setForm((current) => ({ ...current, phase: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PRE_INGRESO">{language === 'en' ? 'Preboarding' : 'Preingreso'}</SelectItem><SelectItem value="DIA_1">{language === 'en' ? 'Day 1' : 'Día 1'}</SelectItem><SelectItem value="SEMANA_1">{language === 'en' ? 'Week 1' : 'Semana 1'}</SelectItem><SelectItem value="HABILITACION">{language === 'en' ? 'Enablement' : 'Habilitación'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Period' : 'Período'}</Label><Select value={form.periodId} onValueChange={(value) => setForm((current) => ({ ...current, periodId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{language === 'en' ? 'No period' : 'Sin período'}</SelectItem>{periods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Role' : 'Rol'}</Label><Input value={form.employeeRole} onChange={(event) => setForm((current) => ({ ...current, employeeRole: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Location' : 'Ubicación'}</Label><Input value={form.locationLabel} onChange={(event) => setForm((current) => ({ ...current, locationLabel: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Start date' : 'Fecha inicio'}</Label><Input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Target date' : 'Fecha objetivo'}</Label><Input type="date" value={form.targetDate} onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Welcome message' : 'Mensaje de bienvenida'}</Label><Textarea rows={2} value={form.welcomeMessage} onChange={(event) => setForm((current) => ({ ...current, welcomeMessage: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Checklist' : 'Checklist'}</Label><Textarea rows={5} value={form.checklistText} onChange={(event) => setForm((current) => ({ ...current, checklistText: event.target.value }))} /><p className="text-xs text-slate-500">{language === 'en' ? 'One line per step: title | owner | status | due label' : 'Una línea por paso: título | responsable | estado | etiqueta fecha'}</p></div>
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
