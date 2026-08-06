'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/components/providers/i18n-provider'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import { nominaHref } from '@/lib/nomina-routes'
import type { PayrollEmployeeRow, PayrollPeriodRow, PayrollSettlementRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

const EMPTY_FORM = {
  employeeId: '',
  reason: 'RENUNCIA',
  status: 'PENDIENTE',
  retirementDate: '',
  liquidationDate: '',
  paymentDate: '',
  periodId: '',
  workedDays: '',
  total: '',
  notes: '',
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

export default function NominaLiquidacionesPage() {
  const [rows, setRows] = useState<PayrollSettlementRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const { mode, setMode } = useDataViewMode('nomina.liquidaciones', 'list')
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'Offboarding admin',
        title: 'Settlements and Offboarding',
        description: 'RRHH and payroll backoffice for offboarding, final payout, accounting handoff and employee exit traceability.',
        stats: {
          pending: 'Pending',
          paid: 'Paid',
          total: 'Estimated total',
          pendingHint: 'Offboardings awaiting payout',
          paidHint: 'Closed settlements',
          totalHint: 'Current tray total',
        },
        actions: { create: 'Create settlement', save: 'Save changes', add: 'Create settlement', cancel: 'Cancel', edit: 'Edit', remove: 'Delete', post: 'Post to accounting' },
        list: { title: 'Settlement tray', description: 'Preview of termination calculations and final payment control.' },
        dialog: { titleCreate: 'Create settlement', titleEdit: 'Edit settlement', description: 'Register the employee exit and the final payroll settlement.' },
        labels: {
          employee: 'Employee',
          period: 'Period',
          noPeriod: 'No period',
          reason: 'Reason',
          status: 'Status',
          retirementDate: 'Retirement date',
          liquidationDate: 'Settlement date',
          paymentDate: 'Payment date',
          workedDays: 'Worked days',
          total: 'Settlement total',
          notes: 'Notes',
          accounting: 'Accounting',
          payout: 'Settlement total',
        },
        reasons: {
          RENUNCIA: 'Resignation',
          TERMINACION: 'Termination',
          MUTUO_ACUERDO: 'Mutual agreement',
          JUSTA_CAUSA: 'Just cause',
          FIN_CONTRATO: 'End of contract',
        },
        statuses: {
          PENDIENTE: 'Pending',
          LIQUIDADA: 'Settled',
          PAGADA: 'Paid',
          ANULADA: 'Voided',
        },
        accountingStatus: {
          PENDIENTE: 'Pending',
          CONTABILIZADA: 'Posted',
        },
      }
    : {
        eyebrow: 'Retiro RRHH',
        title: 'Liquidaciones y retiro',
        description: 'Backoffice de RRHH y nómina para liquidación final, pago pendiente, pase contable y trazabilidad de salida del colaborador.',
        stats: {
          pending: 'Pendientes',
          paid: 'Pagadas',
          total: 'Total estimado',
          pendingHint: 'Retiros sin desembolso',
          paidHint: 'Liquidaciones cerradas',
          totalHint: 'Acumulado de la bandeja',
        },
        actions: { create: 'Crear liquidación', save: 'Guardar cambios', add: 'Crear liquidación', cancel: 'Cancelar', edit: 'Editar', remove: 'Eliminar', post: 'Contabilizar' },
        list: { title: 'Bandeja de liquidaciones', description: 'Vista previa de cálculos por retiro y control del pago final.' },
        dialog: { titleCreate: 'Crear liquidación', titleEdit: 'Editar liquidación', description: 'Registra el retiro y el cálculo final del colaborador.' },
        labels: {
          employee: 'Empleado',
          period: 'Período',
          noPeriod: 'Sin período',
          reason: 'Motivo',
          status: 'Estado',
          retirementDate: 'Fecha retiro',
          liquidationDate: 'Fecha liquidación',
          paymentDate: 'Fecha pago',
          workedDays: 'Días trabajados',
          total: 'Total liquidación',
          notes: 'Notas',
          accounting: 'Contabilización',
          payout: 'Total liquidación',
        },
        reasons: {
          RENUNCIA: 'Renuncia',
          TERMINACION: 'Terminación',
          MUTUO_ACUERDO: 'Mutuo acuerdo',
          JUSTA_CAUSA: 'Justa causa',
          FIN_CONTRATO: 'Fin de contrato',
        },
        statuses: {
          PENDIENTE: 'Pendiente',
          LIQUIDADA: 'Liquidada',
          PAGADA: 'Pagada',
          ANULADA: 'Anulada',
        },
        accountingStatus: {
          PENDIENTE: 'Pendiente',
          CONTABILIZADA: 'Contabilizada',
        },
      }

  async function load() {
    const [settlementsRes, employeesRes, periodsRes] = await Promise.all([
      fetch('/api/nomina/liquidaciones', { cache: 'no-store' }),
      fetch('/api/nomina/empleados', { cache: 'no-store' }),
      fetch('/api/nomina/periodos', { cache: 'no-store' }),
    ])
    const [settlementsJson, employeesJson, periodsJson] = await Promise.all([
      settlementsRes.json().catch(() => null),
      employeesRes.json().catch(() => null),
      periodsRes.json().catch(() => null),
    ])
    const nextEmployees = (employeesJson?.data as PayrollEmployeeRow[] | undefined) ?? []
    const nextPeriods = (periodsJson?.data as PayrollPeriodRow[] | undefined) ?? []
    setRows((settlementsJson?.data as PayrollSettlementRow[] | undefined) ?? [])
    setEmployees(nextEmployees)
    setPeriods(nextPeriods)
    setForm((current) => ({ ...current, employeeId: current.employeeId || nextEmployees[0]?.id || '', periodId: current.periodId || nextPeriods[0]?.id || '' }))
  }

  useEffect(() => {
    void load()
  }, [])

  async function contabilizar(settlementId: string) {
    await fetch(`/api/nomina/liquidaciones/${settlementId}/contabilizar`, { method: 'POST' })
    await load()
  }

  function openCreate() {
    setEditingId(null)
    setError(null)
    setForm({ ...EMPTY_FORM, employeeId: employees[0]?.id || '', periodId: periods[0]?.id || '', retirementDate: new Date().toISOString().slice(0, 10) })
    setDialogOpen(true)
  }

  function openEdit(item: PayrollSettlementRow) {
    setEditingId(item.id)
    setError(null)
    setForm({
      employeeId: item.employeeId,
      reason: item.reason,
      status: item.status,
      retirementDate: item.retirementDate.slice(0, 10),
      liquidationDate: item.liquidationDate?.slice(0, 10) ?? '',
      paymentDate: item.paymentDate?.slice(0, 10) ?? '',
      periodId: item.periodId ?? '',
      workedDays: String(item.workedDays),
      total: String(item.total),
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
      periodId: form.periodId || undefined,
      workedDays: Number(form.workedDays),
      total: form.total ? Number(form.total) : 0,
    }
    const res = await fetch('/api/nomina/liquidaciones', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Could not save settlement' : 'No fue posible guardar la liquidación'))
      setSaving(false)
      return
    }
    setDialogOpen(false)
    setEditingId(null)
    setForm({ ...EMPTY_FORM, employeeId: employees[0]?.id || '', periodId: periods[0]?.id || '' })
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm(language === 'en' ? 'Delete this settlement?' : '¿Eliminar esta liquidación?')) return
    const res = await fetch('/api/nomina/liquidaciones', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Could not delete settlement' : 'No fue posible eliminar la liquidación'))
      return
    }
    await load()
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow={copy.eyebrow}
        title={<span data-tour="nomina-liquidaciones-title">{copy.title}</span>}
        description={copy.description}
        actions={
          <>
            <Button asChild className="rounded-2xl">
              <Link href={nominaHref('empleados')}>{language === 'en' ? 'Open employee records' : 'Abrir fichas de empleado'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('reportes')}>{language === 'en' ? 'Open settlement documents' : 'Abrir documentos de liquidación'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: copy.stats.pending, value: rows.filter((item) => item.status === 'PENDIENTE').length, hint: copy.stats.pendingHint, tone: 'amber' },
          { label: copy.stats.paid, value: rows.filter((item) => item.status === 'PAGADA').length, hint: copy.stats.paidHint, tone: 'teal' },
          { label: copy.stats.total, value: formatCurrency(rows.reduce((sum, item) => sum + item.total, 0)), hint: copy.stats.totalHint, tone: 'sky' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end" data-tour="nomina-liquidaciones-actions">
        <div className="flex flex-wrap gap-2">
          <DataViewToggle mode={mode} onChange={setMode} />
          <Button className="rounded-xl" onClick={openCreate}>{copy.actions.create}</Button>
        </div>
      </div>

      <Card className="rounded-[26px] border-slate-200" data-tour="nomina-liquidaciones-list">
        <CardHeader>
          <CardTitle>{copy.list.title}</CardTitle>
          <CardDescription>{copy.list.description}</CardDescription>
        </CardHeader>
        <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
          {rows.map((settlement) => (
            <div key={settlement.id} className={mode === 'grid' ? 'rounded-[22px] border border-slate-200 bg-white p-4' : 'rounded-[18px] border border-slate-200 bg-white px-4 py-3'}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{settlement.employeeName}</div>
                  <div className="text-sm text-slate-500">{copy.labels.retirementDate}: {formatDate(settlement.retirementDate, locale)} · {copy.labels.reason}: {copy.reasons[settlement.reason]}</div>
                </div>
                <span className={settlement.status === 'PAGADA' ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800' : settlement.status === 'LIQUIDADA' ? 'rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800' : 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'}>
                  {copy.statuses[settlement.status]}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                <div>{copy.labels.workedDays}: {settlement.workedDays}</div>
                <div>{copy.labels.payout}: {formatCurrency(settlement.total)}</div>
                <div>{copy.labels.accounting}: {copy.accountingStatus[settlement.accountingStatus]}</div>
              </div>
              <div className="mt-2 grid gap-2 text-sm text-slate-500 md:grid-cols-3">
                <div>{copy.labels.period}: {settlement.periodId ? periods.find((period) => period.id === settlement.periodId)?.label ?? copy.labels.noPeriod : copy.labels.noPeriod}</div>
                <div>{copy.labels.liquidationDate}: {formatDate(settlement.liquidationDate, locale)}</div>
                <div>{copy.labels.paymentDate}: {formatDate(settlement.paymentDate, locale)}</div>
              </div>
              {settlement.notes ? <div className="mt-2 text-sm text-slate-600">{copy.labels.notes}: {settlement.notes}</div> : null}
              {settlement.accountingStatus === 'PENDIENTE' && settlement.total > 0 ? <div className="mt-3 flex justify-end"><Button variant="outline" className="rounded-xl" onClick={() => void contabilizar(settlement.id)}>{copy.actions.post}</Button></div> : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => openEdit(settlement)}>{copy.actions.edit}</Button>
                <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(settlement.id)}>{copy.actions.remove}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{editingId ? copy.dialog.titleEdit : copy.dialog.titleCreate}</DialogTitle>
            <DialogDescription>{copy.dialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>{copy.labels.employee}</Label><Select value={form.employeeId} onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue placeholder={copy.labels.employee} /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.labels.period}</Label><Select value={form.periodId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, periodId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder={copy.labels.noPeriod} /></SelectTrigger><SelectContent><SelectItem value="__none__">{copy.labels.noPeriod}</SelectItem>{periods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.labels.reason}</Label><Select value={form.reason} onValueChange={(value) => setForm((current) => ({ ...current, reason: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RENUNCIA">{copy.reasons.RENUNCIA}</SelectItem><SelectItem value="TERMINACION">{copy.reasons.TERMINACION}</SelectItem><SelectItem value="MUTUO_ACUERDO">{copy.reasons.MUTUO_ACUERDO}</SelectItem><SelectItem value="JUSTA_CAUSA">{copy.reasons.JUSTA_CAUSA}</SelectItem><SelectItem value="FIN_CONTRATO">{copy.reasons.FIN_CONTRATO}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.labels.status}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PENDIENTE">{copy.statuses.PENDIENTE}</SelectItem><SelectItem value="LIQUIDADA">{copy.statuses.LIQUIDADA}</SelectItem><SelectItem value="PAGADA">{copy.statuses.PAGADA}</SelectItem><SelectItem value="ANULADA">{copy.statuses.ANULADA}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.labels.retirementDate}</Label><Input type="date" value={form.retirementDate} onChange={(event) => setForm((current) => ({ ...current, retirementDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.liquidationDate}</Label><Input type="date" value={form.liquidationDate} onChange={(event) => setForm((current) => ({ ...current, liquidationDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.paymentDate}</Label><Input type="date" value={form.paymentDate} onChange={(event) => setForm((current) => ({ ...current, paymentDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.workedDays}</Label><Input type="number" value={form.workedDays} onChange={(event) => setForm((current) => ({ ...current, workedDays: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.labels.total}</Label><Input type="number" value={form.total} onChange={(event) => setForm((current) => ({ ...current, total: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.labels.notes}</Label><Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} /></div>
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