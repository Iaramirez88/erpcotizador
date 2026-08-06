'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/components/providers/i18n-provider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import type { PayrollEmployeeRow, PayrollNoveltyRow, PayrollPeriodRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

const EMPTY_FORM = {
  employeeId: '',
  type: 'HORA_EXTRA',
  detail: '',
  status: 'RADICADA',
  source: 'MANUAL',
  amount: '',
  days: '',
  quantity: '',
  periodId: '',
  occurredOn: '',
  startsAt: '',
  endsAt: '',
  supportNumber: '',
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

export default function NominaNovedadesPage() {
  const [rows, setRows] = useState<PayrollNoveltyRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const { mode, setMode } = useDataViewMode('nomina.novedades', 'list')
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'Payroll changes admin',
        title: 'Payroll Changes and Leave',
        description: 'Administrative payroll event register for overtime, absences, leave, loans and deductions before they impact calculation or employee outputs.',
        stats: {
          filed: 'Filed',
          applied: 'Applied',
          leave: 'Medical leave',
          filedHint: 'Pending validation',
          appliedHint: 'Already impacts payroll',
          leaveHint: 'With support attached',
        },
        actions: { create: 'Create payroll change', save: 'Save changes', add: 'Create change', cancel: 'Cancel', edit: 'Edit', remove: 'Delete' },
        tabs: { operational: 'Changes', leave: 'Medical leave' },
        sections: {
          operationalTitle: 'Changes applied to the period',
          operationalDescription: 'Overtime, deductions, leave and other payroll calculation events.',
          leaveTitle: 'Medical leave and health absences',
          leaveDescription: 'Base record for supports, origin, approved days and subsidy calculation.',
        },
        dialog: {
          titleCreate: 'Create payroll change',
          titleEdit: 'Edit payroll change',
          description: 'Record medical leave, overtime, deductions or leave entries directly from payroll.',
        },
        labels: {
          employee: 'Employee',
          period: 'Period',
          noPeriod: 'No period',
          type: 'Type',
          status: 'Status',
          amount: 'Amount',
          days: 'Days',
          quantity: 'Quantity',
          occurredOn: 'Occurrence date',
          startsAt: 'From',
          endsAt: 'To',
          supportNumber: 'Support number',
          detail: 'Detail',
          value: 'Amount',
          source: 'Source',
        },
        types: {
          INCAPACIDAD: 'Medical leave',
          HORA_EXTRA: 'Overtime',
          AUSENCIA: 'Absence',
          LICENCIA: 'Leave',
          BONIFICACION: 'Bonus',
          DESCUENTO: 'Deduction',
          RECARGO: 'Surcharge',
          COMISION: 'Commission',
          EMBARGO: 'Garnishment',
          PRESTAMO: 'Loan',
          VACACIONES: 'Vacation',
        },
        statuses: {
          RADICADA: 'Filed',
          VALIDADA: 'Validated',
          APLICADA: 'Applied',
          RECHAZADA: 'Rejected',
        },
      }
    : {
        eyebrow: 'Novedades RRHH',
        title: 'Novedades e incapacidades',
        description: 'Registro administrativo de horas extra, ausencias, incapacidades, préstamos y descuentos antes de impactar cálculo y salidas visibles al colaborador.',
        stats: {
          filed: 'Radicadas',
          applied: 'Aplicadas',
          leave: 'Incapacidades',
          filedHint: 'Pendientes de validar',
          appliedHint: 'Ya afectan nómina',
          leaveHint: 'Con soporte adjunto',
        },
        actions: { create: 'Crear novedad', save: 'Guardar cambios', add: 'Crear novedad', cancel: 'Cancelar', edit: 'Editar', remove: 'Eliminar' },
        tabs: { operational: 'Novedades', leave: 'Incapacidades' },
        sections: {
          operationalTitle: 'Novedades aplicables al período',
          operationalDescription: 'Horas extra, descuentos, licencias y otros eventos de cálculo.',
          leaveTitle: 'Incapacidades y licencias médicas',
          leaveDescription: 'Base para soportes, origen, días reconocidos y cálculo del auxilio.',
        },
        dialog: {
          titleCreate: 'Crear novedad',
          titleEdit: 'Editar novedad',
          description: 'Registra incapacidades, horas extra, descuentos o licencias desde nómina.',
        },
        labels: {
          employee: 'Empleado',
          period: 'Período',
          noPeriod: 'Sin período',
          type: 'Tipo',
          status: 'Estado',
          amount: 'Valor',
          days: 'Días',
          quantity: 'Cantidad',
          occurredOn: 'Fecha ocurrencia',
          startsAt: 'Desde',
          endsAt: 'Hasta',
          supportNumber: 'Número soporte',
          detail: 'Detalle',
          value: 'Valor',
          source: 'Fuente',
        },
        types: {
          INCAPACIDAD: 'Incapacidad',
          HORA_EXTRA: 'Hora extra',
          AUSENCIA: 'Ausencia',
          LICENCIA: 'Licencia',
          BONIFICACION: 'Bonificación',
          DESCUENTO: 'Descuento',
          RECARGO: 'Recargo',
          COMISION: 'Comisión',
          EMBARGO: 'Embargo',
          PRESTAMO: 'Préstamo',
          VACACIONES: 'Vacaciones',
        },
        statuses: {
          RADICADA: 'Radicada',
          VALIDADA: 'Validada',
          APLICADA: 'Aplicada',
          RECHAZADA: 'Rechazada',
        },
      }

  useEffect(() => {
    let cancelled = false
    async function initialLoad() {
      const [noveltiesRes, employeesRes, periodsRes] = await Promise.all([
        fetch('/api/nomina/novedades', { cache: 'no-store' }),
        fetch('/api/nomina/empleados', { cache: 'no-store' }),
        fetch('/api/nomina/periodos', { cache: 'no-store' }),
      ])
      const [noveltiesJson, employeesJson, periodsJson] = await Promise.all([
        noveltiesRes.json().catch(() => null),
        employeesRes.json().catch(() => null),
        periodsRes.json().catch(() => null),
      ])
      if (!cancelled) {
        const nextEmployees = employeesJson?.data ?? []
        const nextPeriods = periodsJson?.data ?? []
        setRows(noveltiesJson?.data ?? [])
        setEmployees(nextEmployees)
        setPeriods(nextPeriods)
        setForm((current) => ({ ...current, employeeId: current.employeeId || nextEmployees[0]?.id || '', periodId: current.periodId || nextPeriods[0]?.id || '' }))
      }
    }
    void initialLoad()
    return () => {
      cancelled = true
    }
  }, [])

  async function load() {
    const [noveltiesRes, employeesRes, periodsRes] = await Promise.all([
      fetch('/api/nomina/novedades', { cache: 'no-store' }),
      fetch('/api/nomina/empleados', { cache: 'no-store' }),
      fetch('/api/nomina/periodos', { cache: 'no-store' }),
    ])
    const [noveltiesJson, employeesJson, periodsJson] = await Promise.all([
      noveltiesRes.json().catch(() => null),
      employeesRes.json().catch(() => null),
      periodsRes.json().catch(() => null),
    ])
    const nextEmployees = employeesJson?.data ?? []
    const nextPeriods = periodsJson?.data ?? []
    setRows(noveltiesJson?.data ?? [])
    setEmployees(nextEmployees)
    setPeriods(nextPeriods)
    setForm((current) => ({ ...current, employeeId: current.employeeId || nextEmployees[0]?.id || '', periodId: current.periodId || nextPeriods[0]?.id || '' }))
  }

  function openCreate() {
    setEditingId(null)
    setError(null)
    setForm({ ...EMPTY_FORM, employeeId: employees[0]?.id || '', periodId: periods[0]?.id || '', occurredOn: new Date().toISOString().slice(0, 10) })
    setDialogOpen(true)
  }

  function openEdit(item: PayrollNoveltyRow) {
    setEditingId(item.id)
    setError(null)
    setForm({
      employeeId: item.employeeId,
      type: item.type,
      detail: item.detail,
      status: item.status,
      source: item.source,
      amount: item.amount ? String(item.amount) : '',
      days: item.days ? String(item.days) : '',
      quantity: item.quantity ? String(item.quantity) : '',
      periodId: item.periodId ?? '',
      occurredOn: item.occurredOn?.slice(0, 10) ?? '',
      startsAt: item.startsAt?.slice(0, 10) ?? '',
      endsAt: item.endsAt?.slice(0, 10) ?? '',
      supportNumber: item.supportNumber ?? '',
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
      amount: form.amount ? Number(form.amount) : undefined,
      days: form.days ? Number(form.days) : undefined,
      quantity: form.quantity ? Number(form.quantity) : undefined,
    }
    const res = await fetch('/api/nomina/novedades', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Could not save payroll change' : 'No fue posible guardar la novedad'))
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
    if (!window.confirm(language === 'en' ? 'Delete this payroll change?' : '¿Eliminar esta novedad?')) return
    const res = await fetch('/api/nomina/novedades', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Could not delete payroll change' : 'No fue posible eliminar la novedad'))
      return
    }
    await load()
  }

  const incapacidades = rows.filter((item) => item.type === 'INCAPACIDAD')
  const operativas = rows.filter((item) => item.type !== 'INCAPACIDAD')

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow={copy.eyebrow}
        title={<span data-tour="nomina-novedades-title">{copy.title}</span>}
        description={copy.description}
        actions={
          <>
            <Button asChild className="rounded-2xl">
              <Link href={nominaHref('periodos')}>{language === 'en' ? 'Open payroll periods' : 'Abrir períodos'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('portal-empleado')}>{language === 'en' ? 'View collaborator portal' : 'Ver portal del colaborador'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: copy.stats.filed, value: rows.filter((item) => item.status === 'RADICADA').length, hint: copy.stats.filedHint, tone: 'amber' },
          { label: copy.stats.applied, value: rows.filter((item) => item.status === 'APLICADA').length, hint: copy.stats.appliedHint, tone: 'teal' },
          { label: copy.stats.leave, value: incapacidades.length, hint: copy.stats.leaveHint, tone: 'sky' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end" data-tour="nomina-novedades-actions">
        <div className="flex flex-wrap gap-2">
          <DataViewToggle mode={mode} onChange={setMode} />
          <Button className="rounded-xl" onClick={openCreate}>{copy.actions.create}</Button>
        </div>
      </div>

      <Tabs defaultValue="operativas" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-2xl">
          <TabsTrigger value="operativas">{copy.tabs.operational}</TabsTrigger>
          <TabsTrigger value="incapacidades">{copy.tabs.leave}</TabsTrigger>
        </TabsList>
        <TabsContent value="operativas">
          <Card className="rounded-[26px] border-slate-200" data-tour="nomina-novedades-list">
            <CardHeader>
              <CardTitle>{copy.sections.operationalTitle}</CardTitle>
              <CardDescription>{copy.sections.operationalDescription}</CardDescription>
            </CardHeader>
            <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
              {operativas.map((item) => (
                <div key={item.id} className={mode === 'grid' ? 'rounded-[22px] border border-slate-200 bg-white p-4' : 'rounded-[18px] border border-slate-200 bg-white px-4 py-3'}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{item.employeeName}</div>
                      <div className="text-sm text-slate-500">{item.periodLabel}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{copy.types[item.type]}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{item.detail}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {typeof item.amount === 'number' ? <span className="rounded-full border border-slate-200 px-2.5 py-1">{copy.labels.value}: {formatCurrency(item.amount)}</span> : null}
                    {typeof item.days === 'number' ? <span className="rounded-full border border-slate-200 px-2.5 py-1">{copy.labels.days}: {item.days}</span> : null}
                    {typeof item.quantity === 'number' ? <span className="rounded-full border border-slate-200 px-2.5 py-1">{copy.labels.quantity}: {item.quantity}</span> : null}
                    <span className="rounded-full border border-slate-200 px-2.5 py-1">{copy.statuses[item.status]}</span>
                    <span className="rounded-full border border-slate-200 px-2.5 py-1">{copy.labels.source}: {item.source}</span>
                    <span className="rounded-full border border-slate-200 px-2.5 py-1">{formatDate(item.occurredOn, locale)}</span>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => openEdit(item)}>{copy.actions.edit}</Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(item.id)}>{copy.actions.remove}</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="incapacidades">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>{copy.sections.leaveTitle}</CardTitle>
              <CardDescription>{copy.sections.leaveDescription}</CardDescription>
            </CardHeader>
            <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
              {incapacidades.map((item) => (
                <div key={item.id} className={mode === 'grid' ? 'rounded-[22px] border border-amber-200 bg-amber-50/60 p-4' : 'rounded-[18px] border border-amber-200 bg-amber-50/60 px-4 py-3'}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{item.employeeName}</div>
                      <div className="text-sm text-slate-600">{item.detail}</div>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">{copy.statuses[item.status]}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">{item.periodLabel}</span>
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">{copy.labels.days}: {item.days ?? 0}</span>
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">{copy.labels.supportNumber}: {item.supportNumber ?? '—'}</span>
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">{formatDate(item.startsAt, locale)} - {formatDate(item.endsAt, locale)}</span>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => openEdit(item)}>{copy.actions.edit}</Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(item.id)}>{copy.actions.remove}</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{editingId ? copy.dialog.titleEdit : copy.dialog.titleCreate}</DialogTitle>
            <DialogDescription>{copy.dialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>{copy.labels.employee}</Label><Select value={form.employeeId} onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue placeholder={copy.labels.employee} /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.labels.period}</Label><Select value={form.periodId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, periodId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder={copy.labels.noPeriod} /></SelectTrigger><SelectContent><SelectItem value="__none__">{copy.labels.noPeriod}</SelectItem>{periods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.labels.type}</Label><Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INCAPACIDAD">{copy.types.INCAPACIDAD}</SelectItem><SelectItem value="HORA_EXTRA">{copy.types.HORA_EXTRA}</SelectItem><SelectItem value="AUSENCIA">{copy.types.AUSENCIA}</SelectItem><SelectItem value="LICENCIA">{copy.types.LICENCIA}</SelectItem><SelectItem value="BONIFICACION">{copy.types.BONIFICACION}</SelectItem><SelectItem value="DESCUENTO">{copy.types.DESCUENTO}</SelectItem><SelectItem value="RECARGO">{copy.types.RECARGO}</SelectItem><SelectItem value="COMISION">{copy.types.COMISION}</SelectItem><SelectItem value="EMBARGO">{copy.types.EMBARGO}</SelectItem><SelectItem value="PRESTAMO">{copy.types.PRESTAMO}</SelectItem><SelectItem value="VACACIONES">{copy.types.VACACIONES}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.labels.status}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RADICADA">{copy.statuses.RADICADA}</SelectItem><SelectItem value="VALIDADA">{copy.statuses.VALIDADA}</SelectItem><SelectItem value="APLICADA">{copy.statuses.APLICADA}</SelectItem><SelectItem value="RECHAZADA">{copy.statuses.RECHAZADA}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.labels.amount}</Label><Input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.days}</Label><Input type="number" value={form.days} onChange={(event) => setForm((current) => ({ ...current, days: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.quantity}</Label><Input type="number" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.occurredOn}</Label><Input type="date" value={form.occurredOn} onChange={(event) => setForm((current) => ({ ...current, occurredOn: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.startsAt}</Label><Input type="date" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.endsAt}</Label><Input type="date" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.labels.supportNumber}</Label><Input value={form.supportNumber} onChange={(event) => setForm((current) => ({ ...current, supportNumber: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.labels.detail}</Label><Textarea value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} rows={3} /></div>
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