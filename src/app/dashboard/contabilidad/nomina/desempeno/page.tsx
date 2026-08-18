'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
import type { PayrollEmployeeRow, PayrollPerformanceReviewRow } from '@/lib/payroll'

const EMPTY_FORM = {
  employeeId: 'none',
  cycleTitle: '',
  reviewType: 'OBJETIVOS',
  status: 'BORRADOR',
  managerName: '',
  competencyFocus: '',
  score: '',
  targetScore: '',
  dueDate: '',
  completedAt: '',
  salesTargetAmount: '',
  salesAchievedAmount: '',
  salesTargetDeals: '',
  salesAchievedDeals: '',
  developmentPlan: '',
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
  if (status === 'CERRADA') return 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800'
  if (status === 'EN_CALIBRACION') return 'rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800'
  if (status === 'ABIERTA') return 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'
  return 'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700'
}

export default function NominaDesempenoPage() {
  const [rows, setRows] = useState<PayrollPerformanceReviewRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mode, setMode } = useDataViewMode('nomina.desempeno', 'grid')
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'Performance admin',
        title: 'Performance',
        description: 'RRHH performance backoffice for review cycles, leadership calibration and development follow-up, separated from the collaborator self-service surface.',
        create: 'Create review',
        cardTitle: 'Performance cycles',
        cardDescription: 'Administrative review tray for open evaluations, calibration and closures without mixing with the employee-facing portal.',
      }
    : {
        eyebrow: 'Desempeño RRHH',
        title: 'Desempeño',
        description: 'Backoffice de desempeño RRHH para ciclos de evaluación, calibración y seguimiento de desarrollo, separado del autoservicio del colaborador.',
        create: 'Crear evaluación',
        cardTitle: 'Ciclos de desempeño',
        cardDescription: 'Bandeja administrativa para controlar evaluaciones abiertas, calibración y cierres sin mezclar esta operación con el portal del colaborador.',
      }

  async function load() {
    const [reviewsRes, employeesRes] = await Promise.all([
      fetch('/api/nomina/desempeno', { cache: 'no-store' }),
      fetch('/api/nomina/empleados', { cache: 'no-store' }),
    ])
    const reviewsJson = (await reviewsRes.json().catch(() => null)) as { data?: PayrollPerformanceReviewRow[] } | null
    const employeesJson = (await employeesRes.json().catch(() => null)) as { data?: PayrollEmployeeRow[] } | null
    setRows(reviewsJson?.data ?? [])
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

  function openEdit(item: PayrollPerformanceReviewRow) {
    const employee = employees.find((entry) => entry.fullName === item.employeeName)
    setEditingId(item.id)
    setError(null)
    setForm({
      employeeId: employee?.id ?? 'none',
      cycleTitle: item.cycleTitle,
      reviewType: item.reviewType,
      status: item.status,
      managerName: item.managerName ?? '',
      competencyFocus: item.competencyFocus,
      score: item.score != null ? String(item.score) : '',
      targetScore: item.targetScore != null ? String(item.targetScore) : '',
      dueDate: item.dueDate?.slice(0, 10) ?? '',
      completedAt: item.completedAt?.slice(0, 10) ?? '',
      salesTargetAmount: item.salesTargetAmount != null ? String(item.salesTargetAmount) : '',
      salesAchievedAmount: item.salesAchievedAmount != null ? String(item.salesAchievedAmount) : '',
      salesTargetDeals: item.salesTargetDeals != null ? String(item.salesTargetDeals) : '',
      salesAchievedDeals: item.salesAchievedDeals != null ? String(item.salesAchievedDeals) : '',
      developmentPlan: item.developmentPlan ?? '',
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
      cycleTitle: form.cycleTitle,
      reviewType: form.reviewType,
      status: form.status,
      managerName: form.managerName,
      competencyFocus: form.competencyFocus,
      score: form.score ? Number(form.score) : null,
      targetScore: form.targetScore ? Number(form.targetScore) : null,
      dueDate: form.dueDate || null,
      completedAt: form.completedAt || null,
      salesTargetAmount: form.salesTargetAmount ? Number(form.salesTargetAmount) : null,
      salesAchievedAmount: form.salesAchievedAmount ? Number(form.salesAchievedAmount) : null,
      salesTargetDeals: form.salesTargetDeals ? Number(form.salesTargetDeals) : null,
      salesAchievedDeals: form.salesAchievedDeals ? Number(form.salesAchievedDeals) : null,
      developmentPlan: form.developmentPlan,
      summary: form.summary,
    }
    const res = await fetch('/api/nomina/desempeno', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to save review' : 'No fue posible guardar la evaluación'))
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
    if (!window.confirm(language === 'en' ? 'Delete this performance review?' : '¿Eliminar esta evaluación de desempeño?')) return
    const res = await fetch('/api/nomina/desempeno', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to delete review' : 'No fue posible eliminar la evaluación'))
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
          { label: language === 'en' ? 'Open' : 'Abiertas', value: rows.filter((item) => item.status === 'ABIERTA').length, hint: language === 'en' ? 'Waiting on inputs' : 'Esperando respuestas', tone: 'amber' },
          { label: language === 'en' ? 'Calibration' : 'Calibración', value: rows.filter((item) => item.status === 'EN_CALIBRACION').length, hint: language === 'en' ? 'Leadership review' : 'Revisión de liderazgo', tone: 'sky' },
          { label: language === 'en' ? 'Closed' : 'Cerradas', value: rows.filter((item) => item.status === 'CERRADA').length, hint: language === 'en' ? 'Completed cycles' : 'Ciclos terminados', tone: 'teal' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end gap-2">
        <DataViewToggle mode={mode} onChange={setMode} />
        <Button className="rounded-xl" onClick={openCreate}>{copy.create}</Button>
      </div>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{copy.cardTitle}</CardTitle>
          <CardDescription>{copy.cardDescription}</CardDescription>
        </CardHeader>
        <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {rows.map((item) => (
            <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{item.cycleTitle}</div>
                  <div className="text-sm text-slate-500">{item.reviewType}</div>
                </div>
                <span className={statusClass(item.status)}>{item.status}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>{language === 'en' ? 'Employee' : 'Empleado'}: {item.employeeName ?? '—'}</div>
                <div>{language === 'en' ? 'Manager' : 'Líder'}: {item.managerName ?? '—'}</div>
                <div>{language === 'en' ? 'Competency focus' : 'Foco de competencia'}: {item.competencyFocus}</div>
                <div>{language === 'en' ? 'Score' : 'Score'}: {item.score ?? '—'}</div>
                <div>{language === 'en' ? 'Target' : 'Meta'}: {item.targetScore ?? '—'}</div>
                <div>{language === 'en' ? 'Sales target' : 'Meta ventas'}: {item.salesTargetAmount ?? '—'}</div>
                <div>{language === 'en' ? 'Sales achieved' : 'Ventas logradas'}: {item.salesAchievedAmount ?? '—'}</div>
                <div>{language === 'en' ? 'Deals achieved' : 'Negocios logrados'}: {item.salesAchievedDeals ?? '—'} / {item.salesTargetDeals ?? '—'}</div>
                <div>{language === 'en' ? 'Goal progress' : 'Cumplimiento'}: {item.goalProgressPercent != null ? `${item.goalProgressPercent}%` : '—'}</div>
                <div>{language === 'en' ? 'Due date' : 'Vence'}: {formatDate(item.dueDate ?? null, locale)}</div>
                <div>{language === 'en' ? 'Completed' : 'Completada'}: {formatDate(item.completedAt ?? null, locale)}</div>
                <div>{language === 'en' ? 'Owner' : 'Responsable'}: {item.ownerName ?? '—'}</div>
              </div>
              {item.chartSeries.length ? <div className="mt-4 h-48 rounded-2xl border border-slate-200 bg-slate-50/70 p-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={item.chartSeries}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} /><YAxis tickLine={false} axisLine={false} fontSize={11} /><Tooltip formatter={(value: number) => value.toLocaleString('es-CO')} /><Bar dataKey="target" name={language === 'en' ? 'Target' : 'Meta'} fill="#94a3b8" radius={[8, 8, 0, 0]} /><Bar dataKey="actual" name={language === 'en' ? 'Actual' : 'Real'} fill="#0f766e" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div> : null}
              {item.summary ? <p className="mt-3 text-sm text-slate-600">{item.summary}</p> : null}
              {item.developmentPlan ? <div className="mt-3 text-sm text-slate-500">{item.developmentPlan}</div> : null}
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
            <DialogTitle>{language === 'en' ? 'Performance review' : 'Evaluación de desempeño'}</DialogTitle>
            <DialogDescription>{language === 'en' ? 'Capture the cycle, employee, score and development plan.' : 'Captura el ciclo, empleado, score y plan de desarrollo.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2"><Label>{language === 'en' ? 'Employee' : 'Empleado'}</Label><Select value={form.employeeId} onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{language === 'en' ? 'No employee linked' : 'Sin empleado ligado'}</SelectItem>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Cycle title' : 'Título del ciclo'}</Label><Input value={form.cycleTitle} onChange={(event) => setForm((current) => ({ ...current, cycleTitle: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Review type' : 'Tipo de evaluación'}</Label><Select value={form.reviewType} onValueChange={(value) => setForm((current) => ({ ...current, reviewType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OBJETIVOS">{language === 'en' ? 'Goals' : 'Objetivos'}</SelectItem><SelectItem value="360">360</SelectItem><SelectItem value="90_DIAS">{language === 'en' ? '90 days' : '90 días'}</SelectItem><SelectItem value="POTENCIAL">{language === 'en' ? 'Potential' : 'Potencial'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Status' : 'Estado'}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BORRADOR">{language === 'en' ? 'Draft' : 'Borrador'}</SelectItem><SelectItem value="ABIERTA">{language === 'en' ? 'Open' : 'Abierta'}</SelectItem><SelectItem value="EN_CALIBRACION">{language === 'en' ? 'In calibration' : 'En calibración'}</SelectItem><SelectItem value="CERRADA">{language === 'en' ? 'Closed' : 'Cerrada'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Manager' : 'Líder'}</Label><Input value={form.managerName} onChange={(event) => setForm((current) => ({ ...current, managerName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Competency focus' : 'Foco de competencia'}</Label><Input value={form.competencyFocus} onChange={(event) => setForm((current) => ({ ...current, competencyFocus: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Score' : 'Score'}</Label><Input type="number" step="0.1" value={form.score} onChange={(event) => setForm((current) => ({ ...current, score: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Target score' : 'Meta de score'}</Label><Input type="number" step="0.1" value={form.targetScore} onChange={(event) => setForm((current) => ({ ...current, targetScore: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Due date' : 'Fecha límite'}</Label><Input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Completed at' : 'Fecha cierre'}</Label><Input type="date" value={form.completedAt} onChange={(event) => setForm((current) => ({ ...current, completedAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Sales target amount' : 'Meta en ventas'}</Label><Input type="number" value={form.salesTargetAmount} onChange={(event) => setForm((current) => ({ ...current, salesTargetAmount: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Sales achieved amount' : 'Ventas logradas'}</Label><Input type="number" value={form.salesAchievedAmount} onChange={(event) => setForm((current) => ({ ...current, salesAchievedAmount: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Target deals' : 'Meta de negocios'}</Label><Input type="number" value={form.salesTargetDeals} onChange={(event) => setForm((current) => ({ ...current, salesTargetDeals: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Achieved deals' : 'Negocios logrados'}</Label><Input type="number" value={form.salesAchievedDeals} onChange={(event) => setForm((current) => ({ ...current, salesAchievedDeals: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Summary' : 'Resumen'}</Label><Textarea rows={3} value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Development plan' : 'Plan de desarrollo'}</Label><Textarea rows={3} value={form.developmentPlan} onChange={(event) => setForm((current) => ({ ...current, developmentPlan: event.target.value }))} /></div>
          </div>
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{language === 'en' ? 'Cancel' : 'Cancelar'}</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? (language === 'en' ? 'Saving...' : 'Guardando...') : editingId ? (language === 'en' ? 'Save changes' : 'Guardar cambios') : (language === 'en' ? 'Create review' : 'Crear evaluación')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
