'use client'

import { useEffect, useState } from 'react'
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
import type { PayrollEmployeeRow, PayrollNoveltyRow, PayrollPeriodRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

export default function NominaNovedadesPage() {
  const [rows, setRows] = useState<PayrollNoveltyRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
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
  })
  const { mode, setMode } = useDataViewMode('nomina.novedades', 'list')

  useEffect(() => {
    let cancelled = false
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
      if (!cancelled) {
        const nextEmployees = employeesJson?.data ?? []
        const nextPeriods = periodsJson?.data ?? []
        setRows(noveltiesJson?.data ?? [])
        setEmployees(nextEmployees)
        setPeriods(nextPeriods)
        setForm((current) => ({ ...current, employeeId: current.employeeId || nextEmployees[0]?.id || '', periodId: current.periodId || nextPeriods[0]?.id || '' }))
      }
    }
    void load()
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
    setForm({ employeeId: employees[0]?.id || '', type: 'HORA_EXTRA', detail: '', status: 'RADICADA', source: 'MANUAL', amount: '', days: '', quantity: '', periodId: periods[0]?.id || '', occurredOn: '', startsAt: '', endsAt: '', supportNumber: '' })
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
      setError(json?.error ?? 'No fue posible crear la novedad')
      setSaving(false)
      return
    }
    setDialogOpen(false)
    setEditingId(null)
    setForm({ employeeId: employees[0]?.id || '', type: 'HORA_EXTRA', detail: '', status: 'RADICADA', source: 'MANUAL', amount: '', days: '', quantity: '', periodId: periods[0]?.id || '', occurredOn: '', startsAt: '', endsAt: '', supportNumber: '' })
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Eliminar esta novedad?')) return
    const res = await fetch('/api/nomina/novedades', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? 'No fue posible eliminar la novedad')
      return
    }
    await load()
  }

  const incapacidades = rows.filter((item) => item.type === 'INCAPACIDAD')
  const operativas = rows.filter((item) => item.type !== 'INCAPACIDAD')

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Nómina"
        title={<span data-tour="nomina-novedades-title">Novedades e incapacidades</span>}
        description="Registro de horas extra, recargos, ausencias, incapacidades, licencias, embargos, préstamos y descuentos."
        stats={[
          { label: 'Radicadas', value: rows.filter((item) => item.status === 'RADICADA').length, hint: 'Pendientes de validar', tone: 'amber' },
          { label: 'Aplicadas', value: rows.filter((item) => item.status === 'APLICADA').length, hint: 'Ya afectan nómina', tone: 'teal' },
          { label: 'Incapacidades', value: incapacidades.length, hint: 'Con soporte médico', tone: 'sky' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end" data-tour="nomina-novedades-actions">
        <div className="flex flex-wrap gap-2">
          <DataViewToggle mode={mode} onChange={setMode} />
          <Button className="rounded-xl" onClick={openCreate}>Crear novedad</Button>
        </div>
      </div>

      <Tabs defaultValue="operativas" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-2xl">
          <TabsTrigger value="operativas">Novedades</TabsTrigger>
          <TabsTrigger value="incapacidades">Incapacidades</TabsTrigger>
        </TabsList>
        <TabsContent value="operativas">
          <Card className="rounded-[26px] border-slate-200" data-tour="nomina-novedades-list">
            <CardHeader>
              <CardTitle>Novedades aplicables al período</CardTitle>
              <CardDescription>Horas extra, descuentos, licencias y otros eventos de cálculo.</CardDescription>
            </CardHeader>
            <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
              {operativas.map((item) => (
                <div key={item.id} className={mode === 'grid' ? 'rounded-[22px] border border-slate-200 bg-white p-4' : 'rounded-[18px] border border-slate-200 bg-white px-4 py-3'}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{item.employeeName}</div>
                      <div className="text-sm text-slate-500">{item.periodLabel}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{item.type}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{item.detail}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {typeof item.amount === 'number' ? <span className="rounded-full border border-slate-200 px-2.5 py-1">Valor: {formatCurrency(item.amount)}</span> : null}
                    {typeof item.days === 'number' ? <span className="rounded-full border border-slate-200 px-2.5 py-1">Días: {item.days}</span> : null}
                    <span className="rounded-full border border-slate-200 px-2.5 py-1">{item.status}</span>
                    <span className="rounded-full border border-slate-200 px-2.5 py-1">{item.source}</span>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => openEdit(item)}>Editar</Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(item.id)}>Eliminar</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="incapacidades">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>Incapacidades y licencias médicas</CardTitle>
              <CardDescription>Base para soportes, origen, días reconocidos y cálculo del auxilio.</CardDescription>
            </CardHeader>
            <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
              {incapacidades.map((item) => (
                <div key={item.id} className={mode === 'grid' ? 'rounded-[22px] border border-amber-200 bg-amber-50/60 p-4' : 'rounded-[18px] border border-amber-200 bg-amber-50/60 px-4 py-3'}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{item.employeeName}</div>
                      <div className="text-sm text-slate-600">{item.detail}</div>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">{item.status}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">{item.periodLabel}</span>
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">{item.days ?? 0} días</span>
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1">{item.source}</span>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => openEdit(item)}>Editar</Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(item.id)}>Eliminar</Button>
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
            <DialogTitle>Crear novedad</DialogTitle>
            <DialogDescription>Registra incapacidades, horas extra, descuentos o licencias desde nómina.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>Empleado</Label><Select value={form.employeeId} onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2 md:col-span-2"><Label>Período</Label><Select value={form.periodId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, periodId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Sin período" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin período</SelectItem>{periods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Tipo</Label><Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INCAPACIDAD">Incapacidad</SelectItem><SelectItem value="HORA_EXTRA">Hora extra</SelectItem><SelectItem value="AUSENCIA">Ausencia</SelectItem><SelectItem value="LICENCIA">Licencia</SelectItem><SelectItem value="BONIFICACION">Bonificación</SelectItem><SelectItem value="DESCUENTO">Descuento</SelectItem><SelectItem value="RECARGO">Recargo</SelectItem><SelectItem value="COMISION">Comisión</SelectItem><SelectItem value="EMBARGO">Embargo</SelectItem><SelectItem value="PRESTAMO">Préstamo</SelectItem><SelectItem value="VACACIONES">Vacaciones</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Estado</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RADICADA">Radicada</SelectItem><SelectItem value="VALIDADA">Validada</SelectItem><SelectItem value="APLICADA">Aplicada</SelectItem><SelectItem value="RECHAZADA">Rechazada</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Valor</Label><Input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Días</Label><Input type="number" value={form.days} onChange={(event) => setForm((current) => ({ ...current, days: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Cantidad</Label><Input type="number" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Fecha ocurrencia</Label><Input type="date" value={form.occurredOn} onChange={(event) => setForm((current) => ({ ...current, occurredOn: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Desde</Label><Input type="date" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Hasta</Label><Input type="date" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Número soporte</Label><Input value={form.supportNumber} onChange={(event) => setForm((current) => ({ ...current, supportNumber: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Detalle</Label><Textarea value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} rows={3} /></div>
          </div>
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear novedad'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}