'use client'

import { useEffect, useState } from 'react'
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
import type { PayrollEmployeeRow, PayrollPeriodRow, PayrollSettlementRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

export default function NominaLiquidacionesPage() {
  const [rows, setRows] = useState<PayrollSettlementRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
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
  })
  const { mode, setMode } = useDataViewMode('nomina.liquidaciones', 'list')

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
    setForm({ employeeId: employees[0]?.id || '', reason: 'RENUNCIA', status: 'PENDIENTE', retirementDate: '', liquidationDate: '', paymentDate: '', periodId: periods[0]?.id || '', workedDays: '', total: '', notes: '' })
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
      setError(json?.error ?? 'No fue posible crear la liquidación')
      setSaving(false)
      return
    }
    setDialogOpen(false)
    setEditingId(null)
    setForm({ employeeId: employees[0]?.id || '', reason: 'RENUNCIA', status: 'PENDIENTE', retirementDate: '', liquidationDate: '', paymentDate: '', periodId: periods[0]?.id || '', workedDays: '', total: '', notes: '' })
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminar esta liquidación?')) return
    const res = await fetch('/api/nomina/liquidaciones', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? 'No fue posible eliminar la liquidación')
      return
    }
    await load()
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Nómina"
        title={<span data-tour="nomina-liquidaciones-title">Liquidaciones y retiro</span>}
        description="Liquidación final por retiro, vacaciones, cesantías, intereses y demás conceptos prestacionales."
        stats={[
          { label: 'Pendientes', value: rows.filter((item) => item.status === 'PENDIENTE').length, hint: 'Retiros sin desembolso', tone: 'amber' },
          { label: 'Pagadas', value: rows.filter((item) => item.status === 'PAGADA').length, hint: 'Liquidaciones cerradas', tone: 'teal' },
          { label: 'Total estimado', value: formatCurrency(rows.reduce((sum, item) => sum + item.total, 0)), hint: 'Acumulado de la bandeja', tone: 'sky' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end" data-tour="nomina-liquidaciones-actions">
        <div className="flex flex-wrap gap-2">
          <DataViewToggle mode={mode} onChange={setMode} />
          <Button className="rounded-xl" onClick={openCreate}>Crear liquidación</Button>
        </div>
      </div>

      <Card className="rounded-[26px] border-slate-200" data-tour="nomina-liquidaciones-list">
        <CardHeader>
          <CardTitle>Bandeja de liquidaciones</CardTitle>
          <CardDescription>Vista previa de cálculos por retiro y control del pago final.</CardDescription>
        </CardHeader>
        <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
          {rows.map((settlement) => (
            <div key={settlement.id} className={mode === 'grid' ? 'rounded-[22px] border border-slate-200 bg-white p-4' : 'rounded-[18px] border border-slate-200 bg-white px-4 py-3'}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{settlement.employeeName}</div>
                  <div className="text-sm text-slate-500">Retiro: {settlement.retirementDate} · Motivo: {settlement.reason}</div>
                </div>
                <span className={settlement.status === 'PAGADA' ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800' : settlement.status === 'LIQUIDADA' ? 'rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800' : 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'}>
                  {settlement.status}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                <div>Días trabajados: {settlement.workedDays}</div>
                <div>Total liquidación: {formatCurrency(settlement.total)}</div>
                <div>Contabilización: {settlement.accountingStatus}</div>
              </div>
              {settlement.accountingStatus === 'PENDIENTE' && settlement.total > 0 ? <div className="mt-3 flex justify-end"><Button variant="outline" className="rounded-xl" onClick={() => void contabilizar(settlement.id)}>Contabilizar</Button></div> : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => openEdit(settlement)}>Editar</Button>
                <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(settlement.id)}>Eliminar</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Crear liquidación</DialogTitle>
            <DialogDescription>Registra el retiro y el cálculo final del colaborador.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>Empleado</Label><Select value={form.employeeId} onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2 md:col-span-2"><Label>Período</Label><Select value={form.periodId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, periodId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Sin período" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin período</SelectItem>{periods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Motivo</Label><Select value={form.reason} onValueChange={(value) => setForm((current) => ({ ...current, reason: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RENUNCIA">Renuncia</SelectItem><SelectItem value="TERMINACION">Terminación</SelectItem><SelectItem value="MUTUO_ACUERDO">Mutuo acuerdo</SelectItem><SelectItem value="JUSTA_CAUSA">Justa causa</SelectItem><SelectItem value="FIN_CONTRATO">Fin de contrato</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Estado</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PENDIENTE">Pendiente</SelectItem><SelectItem value="LIQUIDADA">Liquidada</SelectItem><SelectItem value="PAGADA">Pagada</SelectItem><SelectItem value="ANULADA">Anulada</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Fecha retiro</Label><Input type="date" value={form.retirementDate} onChange={(event) => setForm((current) => ({ ...current, retirementDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Fecha liquidación</Label><Input type="date" value={form.liquidationDate} onChange={(event) => setForm((current) => ({ ...current, liquidationDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Fecha pago</Label><Input type="date" value={form.paymentDate} onChange={(event) => setForm((current) => ({ ...current, paymentDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Días trabajados</Label><Input type="number" value={form.workedDays} onChange={(event) => setForm((current) => ({ ...current, workedDays: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Total liquidación</Label><Input type="number" value={form.total} onChange={(event) => setForm((current) => ({ ...current, total: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Notas</Label><Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} /></div>
          </div>
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear liquidación'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}