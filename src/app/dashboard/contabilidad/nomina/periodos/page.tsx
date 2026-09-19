'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaCompactTable, NominaStatusBadge } from '@/components/dashboard/nomina-compact-table'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/components/providers/i18n-provider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { nominaHref } from '@/lib/nomina-routes'
import type { PayrollPayslipRow, PayrollPeriodRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

type SedeOption = { id: string; nombre: string }

export default function NominaPeriodosPage() {
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [payslips, setPayslips] = useState<PayrollPayslipRow[]>([])
  const [sedes, setSedes] = useState<SedeOption[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    label: '',
    frequency: 'QUINCENAL',
    status: 'BORRADOR',
    sedeId: '',
    startsAt: '',
    endsAt: '',
    paymentDate: '',
    notes: '',
  })
  const { language } = useI18n()

  const copy = language === 'en'
    ? {
        eyebrow: 'Payroll cycle admin',
        title: 'Periods and calculation',
        description: 'Payroll backoffice for cycle creation, calculation, payslips and accounting posting before the employee consumes the resulting outputs.',
        stats: {
          frequency: 'Cadence',
          frequencyHint: 'Biweekly, monthly, weekly and day-rate',
          paid: 'Paid',
          paidHint: 'Closed periods',
          pending: 'Pending',
          pendingHint: 'Without journal entry yet',
        },
        create: 'Create period',
        tabs: { periods: 'Periods', payslips: 'Payslips' },
        cards: {
          periodsTitle: 'Payroll cycles',
          periodsDescription: 'Cycle status simulation: draft, calculated, paid and posted.',
          summaryTitle: 'Selected period summary',
          summaryDescription: 'Foundation for the future employee-level calculation screen.',
          payslipsTitle: 'Recent payslips',
          payslipsDescription: 'Preview of receipts exportable by PDF, portal or email.',
        },
        metrics: {
          employees: 'Employees',
          gross: 'Gross',
          deductions: 'Deductions',
          net: 'Net pay',
          socialSecurity: 'Social security',
          parafiscales: 'Payroll taxes',
        },
        actions: { post: 'Post', edit: 'Edit', delete: 'Delete', cancel: 'Cancel', save: 'Save changes', add: 'Create period' },
        empty: { periods: 'No periods available.' },
        labels: {
          scheduledPayment: 'Scheduled payment',
          totalGross: 'Total gross pay',
          signed: 'Signed',
          pending: 'Pending',
          payment: 'Payment',
        },
        dialog: {
          createTitle: 'Create payroll period',
          editTitle: 'Edit payroll period',
          description: 'Open a new cycle for calculation, payment and accounting posting.',
          name: 'Name',
          namePlaceholder: 'Example: First half of April payroll',
          branch: 'Branch',
          allBranches: 'All / no branch',
          frequency: 'Frequency',
          status: 'Status',
          startDate: 'Start date',
          endDate: 'End date',
          paymentDate: 'Payment date',
          notes: 'Notes',
        },
        errors: {
          save: 'Unable to save payroll period',
          delete: 'Unable to delete payroll period',
        },
        confirmDelete: 'Delete this period?',
      }
    : {
        eyebrow: 'Ciclos de nómina',
        title: 'Períodos y cálculo',
        description: 'Backoffice de nómina para cortes, cálculo, desprendibles y contabilización antes de que el colaborador consuma los resultados finales.',
        stats: {
          frequency: 'Periodicidad',
          frequencyHint: 'Quincenal, mensual, semanal y jornales',
          paid: 'Pagados',
          paidHint: 'Períodos cerrados',
          pending: 'Pendientes',
          pendingHint: 'Sin asiento aún',
        },
        create: 'Crear período',
        tabs: { periods: 'Períodos', payslips: 'Desprendibles' },
        cards: {
          periodsTitle: 'Cortes de nómina',
          periodsDescription: 'Simulación de estados del ciclo: borrador, calculada, pagada y contabilizada.',
          summaryTitle: 'Resumen del período seleccionado',
          summaryDescription: 'Base de la futura pantalla de cálculo por empleado.',
          payslipsTitle: 'Desprendibles recientes',
          payslipsDescription: 'Vista previa de recibos exportables por PDF, portal o correo.',
        },
        metrics: {
          employees: 'Empleados',
          gross: 'Bruto',
          deductions: 'Deducciones',
          net: 'Neto a pagar',
          socialSecurity: 'Seguridad social',
          parafiscales: 'Parafiscales',
        },
        actions: { post: 'Contabilizar', edit: 'Editar', delete: 'Eliminar', cancel: 'Cancelar', save: 'Guardar cambios', add: 'Crear período' },
        empty: { periods: 'No hay períodos disponibles.' },
        labels: {
          scheduledPayment: 'Pago programado',
          totalGross: 'Devengado total',
          signed: 'Firmado',
          pending: 'Pendiente',
          payment: 'Pago',
        },
        dialog: {
          createTitle: 'Crear período de nómina',
          editTitle: 'Editar período de nómina',
          description: 'Abre un nuevo corte para cálculo, pago y contabilización.',
          name: 'Nombre',
          namePlaceholder: 'Ejemplo: Nómina quincena abril 1',
          branch: 'Sede',
          allBranches: 'Todas / sin sede',
          frequency: 'Frecuencia',
          status: 'Estado',
          startDate: 'Fecha inicio',
          endDate: 'Fecha fin',
          paymentDate: 'Fecha pago',
          notes: 'Notas',
        },
        errors: {
          save: 'No fue posible crear el período',
          delete: 'No fue posible eliminar el período',
        },
        confirmDelete: '¿Eliminar este período?',
      }

  const periodStatusLabel = {
    BORRADOR: language === 'en' ? 'Draft' : 'Borrador',
    CALCULADA: language === 'en' ? 'Calculated' : 'Calculada',
    PAGADA: language === 'en' ? 'Paid' : 'Pagada',
    CERRADA: language === 'en' ? 'Closed' : 'Cerrada',
  } as const

  const accountingStatusLabel = {
    PENDIENTE: language === 'en' ? 'Pending' : 'Pendiente',
    CONTABILIZADA: language === 'en' ? 'Posted' : 'Contabilizada',
  } as const

  const frequencyLabel = {
    QUINCENAL: language === 'en' ? 'Biweekly' : 'Quincenal',
    MENSUAL: language === 'en' ? 'Monthly' : 'Mensual',
    SEMANAL: language === 'en' ? 'Weekly' : 'Semanal',
    JORNAL: language === 'en' ? 'Day-rate' : 'Jornal',
  } as const

  async function load() {
    const [periodsRes, payslipsRes, sedesRes] = await Promise.all([
      fetch('/api/nomina/periodos', { cache: 'no-store' }),
      fetch('/api/nomina/desprendibles', { cache: 'no-store' }),
      fetch('/api/sedes', { cache: 'no-store' }),
    ])
    const [periodsJson, payslipsJson, sedesJson] = await Promise.all([
      periodsRes.json().catch(() => null),
      payslipsRes.json().catch(() => null),
      sedesRes.json().catch(() => null),
    ])
    setPeriods((periodsJson?.data as PayrollPeriodRow[] | undefined) ?? [])
    setPayslips((payslipsJson?.data as PayrollPayslipRow[] | undefined) ?? [])
    setSedes((sedesJson?.data as SedeOption[] | undefined) ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function contabilizar(periodId: string) {
    await fetch(`/api/nomina/periodos/${periodId}/contabilizar`, { method: 'POST' })
    await load()
  }

  function openCreate() {
    setEditingId(null)
    setError(null)
    setForm({ label: '', frequency: 'QUINCENAL', status: 'BORRADOR', sedeId: sedes[0]?.id || '', startsAt: '', endsAt: '', paymentDate: '', notes: '' })
    setDialogOpen(true)
  }

  function openEdit(period: PayrollPeriodRow) {
    setEditingId(period.id)
    setError(null)
    setForm({
      label: period.label,
      frequency: period.frequency,
      status: period.status,
      sedeId: period.sedeId ?? '',
      startsAt: period.startsAt.slice(0, 10),
      endsAt: period.endsAt.slice(0, 10),
      paymentDate: period.paymentDate.slice(0, 10),
      notes: period.notes ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/nomina/periodos', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), ...form, sedeId: form.sedeId || null }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? copy.errors.save)
      setSaving(false)
      return
    }
    setDialogOpen(false)
    setEditingId(null)
    setForm({ label: '', frequency: 'QUINCENAL', status: 'BORRADOR', sedeId: sedes[0]?.id || '', startsAt: '', endsAt: '', paymentDate: '', notes: '' })
    await load()
    setSaving(false)
  }

  async function handleDelete(periodId: string) {
    if (!window.confirm(copy.confirmDelete)) return
    const res = await fetch('/api/nomina/periodos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: periodId }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? copy.errors.delete)
      return
    }
    await load()
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow={copy.eyebrow}
        title={<span data-tour="nomina-periodos-title">{copy.title}</span>}
        description={copy.description}
        actions={
          <>
            <Button asChild className="rounded-2xl">
              <Link href={nominaHref('reportes')}>{language === 'en' ? 'Open documents and payslips' : 'Abrir documentos y desprendibles'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('portal-empleado')}>{language === 'en' ? 'View collaborator portal' : 'Ver portal del colaborador'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: copy.stats.frequency, value: '4', hint: copy.stats.frequencyHint, tone: 'sky' },
          { label: copy.stats.paid, value: periods.filter((item) => item.status === 'PAGADA').length, hint: copy.stats.paidHint, tone: 'teal' },
          { label: copy.stats.pending, value: periods.filter((item) => item.accountingStatus === 'PENDIENTE').length, hint: copy.stats.pendingHint, tone: 'amber' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end" data-tour="nomina-periodos-actions">
        <div className="flex flex-wrap gap-2">
          <Button className="rounded-xl" onClick={openCreate}>{copy.create}</Button>
        </div>
      </div>

      <Tabs defaultValue="periodos" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-2xl">
          <TabsTrigger value="periodos">{copy.tabs.periods}</TabsTrigger>
          <TabsTrigger value="desprendibles">{copy.tabs.payslips}</TabsTrigger>
        </TabsList>

        <TabsContent value="periodos" className="space-y-4">
          <div className="space-y-4">
            <Card className="rounded-[26px] border-slate-200" data-tour="nomina-periodos-list">
              <CardHeader>
                <CardTitle>{copy.cards.periodsTitle}</CardTitle>
                <CardDescription>{copy.cards.periodsDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <NominaCompactTable rows={periods} minWidth="1260px" emptyMessage={copy.empty.periods} columns={[
                  { key: 'period', label: language === 'en' ? 'Period / range' : 'Período / rango', className: 'max-w-[240px]', render: (period) => <><div className="truncate font-medium text-slate-950">{period.label}</div><div className="text-xs text-slate-500">{period.range}</div><div className="text-xs text-slate-400">{frequencyLabel[period.frequency as keyof typeof frequencyLabel] ?? period.frequency}</div></> },
                  { key: 'employees', label: copy.metrics.employees, className: 'text-center tabular-nums', headerClassName: 'text-center', render: (period) => period.employeesCount },
                  { key: 'gross', label: copy.metrics.gross, className: 'whitespace-nowrap text-right tabular-nums', headerClassName: 'text-right', render: (period) => formatCurrency(period.grossTotal) },
                  { key: 'deductions', label: copy.metrics.deductions, className: 'whitespace-nowrap text-right tabular-nums', headerClassName: 'text-right', render: (period) => formatCurrency(period.deductionsTotal) },
                  { key: 'net', label: copy.metrics.net, className: 'whitespace-nowrap text-right font-semibold tabular-nums', headerClassName: 'text-right', render: (period) => formatCurrency(period.netTotal) },
                  { key: 'contributions', label: language === 'en' ? 'Security / taxes' : 'Seguridad / parafiscales', className: 'whitespace-nowrap text-right tabular-nums', headerClassName: 'text-right', render: (period) => <><div>{formatCurrency(period.socialSecurityTotal)}</div><div className="text-xs text-slate-500">{formatCurrency(period.parafiscalesTotal)}</div></> },
                  { key: 'status', label: copy.dialog.status, render: (period) => <div className="space-y-1"><NominaStatusBadge status={periodStatusLabel[period.status as keyof typeof periodStatusLabel] ?? period.status} /><div><NominaStatusBadge status={accountingStatusLabel[period.accountingStatus as keyof typeof accountingStatusLabel] ?? period.accountingStatus} /></div></div> },
                  { key: 'actions', label: language === 'en' ? 'Actions' : 'Acciones', headerClassName: 'text-right', render: (period) => <div className="flex justify-end gap-1.5">{period.accountingStatus === 'PENDIENTE' && period.status !== 'BORRADOR' ? <Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => void contabilizar(period.id)}>{copy.actions.post}</Button> : null}<Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => openEdit(period)}>{copy.actions.edit}</Button><Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => void handleDelete(period.id)}>{copy.actions.delete}</Button></div> },
                ]} />
              </CardContent>
            </Card>

            <Card className="rounded-[26px] border-slate-200">
              <CardHeader>
                <CardTitle>{copy.cards.summaryTitle}</CardTitle>
                <CardDescription>{copy.cards.summaryDescription}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-4">
                {periods[0] ? <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="font-semibold text-slate-950">{periods[0].label}</div>
                    <div className="mt-1">{copy.labels.scheduledPayment}: {periods[0].paymentDate}</div>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"><span>{copy.labels.totalGross}</span><strong>{formatCurrency(periods[0].grossTotal)}</strong></div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"><span>{copy.metrics.deductions}</span><strong>{formatCurrency(periods[0].deductionsTotal)}</strong></div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"><span>{copy.metrics.net}</span><strong>{formatCurrency(periods[0].netTotal)}</strong></div>
                </> : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">{copy.empty.periods}</div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="desprendibles">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>{copy.cards.payslipsTitle}</CardTitle>
              <CardDescription>{copy.cards.payslipsDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <NominaCompactTable rows={payslips} minWidth="760px" emptyMessage={language === 'en' ? 'No payslips available.' : 'No hay desprendibles disponibles.'} columns={[
                { key: 'employee', label: language === 'en' ? 'Employee' : 'Empleado', render: (receipt) => <div className="font-medium text-slate-950">{receipt.employeeName}</div> },
                { key: 'period', label: copy.tabs.periods, render: (receipt) => receipt.periodLabel },
                { key: 'payment', label: copy.labels.payment, className: 'whitespace-nowrap', render: (receipt) => receipt.paymentDate },
                { key: 'net', label: copy.metrics.net, className: 'whitespace-nowrap text-right font-semibold tabular-nums', headerClassName: 'text-right', render: (receipt) => formatCurrency(receipt.netPay) },
                { key: 'delivery', label: language === 'en' ? 'Delivery' : 'Entrega', render: (receipt) => receipt.deliveredBy },
                { key: 'status', label: copy.dialog.status, render: (receipt) => <NominaStatusBadge status={receipt.signed ? copy.labels.signed : copy.labels.pending} /> },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{editingId ? copy.dialog.editTitle : copy.dialog.createTitle}</DialogTitle>
            <DialogDescription>{copy.dialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>{copy.dialog.name}</Label><Input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder={copy.dialog.namePlaceholder} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.dialog.branch}</Label><Select value={form.sedeId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, sedeId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder={copy.dialog.allBranches} /></SelectTrigger><SelectContent><SelectItem value="__none__">{copy.dialog.allBranches}</SelectItem>{sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.dialog.frequency}</Label><Select value={form.frequency} onValueChange={(value) => setForm((current) => ({ ...current, frequency: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="QUINCENAL">{frequencyLabel.QUINCENAL}</SelectItem><SelectItem value="MENSUAL">{frequencyLabel.MENSUAL}</SelectItem><SelectItem value="SEMANAL">{frequencyLabel.SEMANAL}</SelectItem><SelectItem value="JORNAL">{frequencyLabel.JORNAL}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.dialog.status}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BORRADOR">{periodStatusLabel.BORRADOR}</SelectItem><SelectItem value="CALCULADA">{periodStatusLabel.CALCULADA}</SelectItem><SelectItem value="PAGADA">{periodStatusLabel.PAGADA}</SelectItem><SelectItem value="CERRADA">{periodStatusLabel.CERRADA}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.dialog.startDate}</Label><Input type="date" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.dialog.endDate}</Label><Input type="date" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.dialog.paymentDate}</Label><Input type="date" value={form.paymentDate} onChange={(event) => setForm((current) => ({ ...current, paymentDate: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.dialog.notes}</Label><Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} /></div>
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