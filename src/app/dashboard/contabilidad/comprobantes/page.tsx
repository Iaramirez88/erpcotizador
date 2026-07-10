'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { ContabilidadSubnav } from '@/components/dashboard/contabilidad-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AccountingVoucherRow } from '@/lib/accounting-core'
import { formatCurrency } from '@/lib/utils'

type AccountOption = { id: string; code: string; name: string }
type CostCenterOption = { id: string; code: string; name: string }
type PeriodOption = { id: string; label: string; status: 'OPEN' | 'LOCKED' | 'CLOSED' }
type VoucherLineDraft = {
  accountId: string
  costCenterId: string
  debit: string
  credit: string
  memo: string
  thirdPartyName: string
  thirdPartyDocument: string
}

type VoucherForm = {
  periodId: string
  voucherType: string
  status: string
  date: string
  description: string
  thirdPartyName: string
  thirdPartyDocument: string
  externalReference: string
  notes: string
  lines: VoucherLineDraft[]
}

const workQueues = [
  { title: 'Borradores', detail: 'Comprobantes pendientes por revisión, numeración y soporte.', tone: 'border-amber-200 bg-amber-50/60' },
  { title: 'Aprobados', detail: 'Listos para afectar libros y auxiliares sin editar el histórico.', tone: 'border-sky-200 bg-sky-50/60' },
  { title: 'Anulados', detail: 'Histórico con razón, usuario y trazabilidad de reversión.', tone: 'border-slate-200 bg-slate-50/80' },
]

function createEmptyLine(accountId = ''): VoucherLineDraft {
  return {
    accountId,
    costCenterId: '',
    debit: '',
    credit: '',
    memo: '',
    thirdPartyName: '',
    thirdPartyDocument: '',
  }
}

function createInitialForm(defaultPeriodId = '', defaultDebitAccountId = '', defaultCreditAccountId = ''): VoucherForm {
  return {
    periodId: defaultPeriodId,
    voucherType: 'DIARIO',
    status: 'DRAFT',
    date: '',
    description: '',
    thirdPartyName: '',
    thirdPartyDocument: '',
    externalReference: '',
    notes: '',
    lines: [createEmptyLine(defaultDebitAccountId), createEmptyLine(defaultCreditAccountId || defaultDebitAccountId)],
  }
}

export default function ContabilidadComprobantesPage() {
  const [rows, setRows] = useState<AccountingVoucherRow[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])
  const [periods, setPeriods] = useState<PeriodOption[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<VoucherForm>(() => createInitialForm())

  const openPeriods = useMemo(() => periods.filter((period) => period.status === 'OPEN'), [periods])
  const totals = useMemo(() => {
    return form.lines.reduce(
      (acc, line) => ({
        debit: acc.debit + (Number(line.debit) || 0),
        credit: acc.credit + (Number(line.credit) || 0),
      }),
      { debit: 0, credit: 0 },
    )
  }, [form.lines])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [vouchersRes, accountsRes, periodsRes, costCentersRes] = await Promise.all([
        fetch('/api/contabilidad/comprobantes', { cache: 'no-store' }),
        fetch('/api/contabilidad/cuentas', { cache: 'no-store' }),
        fetch('/api/contabilidad/periodos', { cache: 'no-store' }),
        fetch('/api/contabilidad/centros-de-costo', { cache: 'no-store' }),
      ])
      const [vouchersJson, accountsJson, periodsJson, costCentersJson] = await Promise.all([
        vouchersRes.json().catch(() => null),
        accountsRes.json().catch(() => null),
        periodsRes.json().catch(() => null),
        costCentersRes.json().catch(() => null),
      ])
      if (cancelled) return
      const nextPeriods = (periodsJson?.data as PeriodOption[] | undefined) ?? []
      const nextAccounts = (accountsJson?.data as AccountOption[] | undefined) ?? []
      const defaultPeriodId = nextPeriods.find((period) => period.status === 'OPEN')?.id ?? ''
      const defaultDebitAccountId = nextAccounts[0]?.id ?? ''
      const defaultCreditAccountId = nextAccounts[1]?.id ?? nextAccounts[0]?.id ?? ''
      setRows((vouchersJson?.data as AccountingVoucherRow[] | undefined) ?? [])
      setAccounts(nextAccounts)
      setCostCenters((costCentersJson?.data as CostCenterOption[] | undefined) ?? [])
      setPeriods(nextPeriods)
      setForm((current) => ({
        ...current,
        periodId: current.periodId || defaultPeriodId,
        lines: current.lines.length
          ? current.lines.map((line, index) => ({
              ...line,
              accountId: line.accountId || (index === 0 ? defaultDebitAccountId : defaultCreditAccountId),
            }))
          : [createEmptyLine(defaultDebitAccountId), createEmptyLine(defaultCreditAccountId)],
      }))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function reload() {
    const res = await fetch('/api/contabilidad/comprobantes', { cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as { data?: AccountingVoucherRow[] } | null
    setRows(json?.data ?? [])
  }

  function updateLine(index: number, patch: Partial<VoucherLineDraft>) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    }))
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, createEmptyLine(accounts[0]?.id ?? '')],
    }))
  }

  function removeLine(index: number) {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
    }))
  }

  async function handleCreate() {
    setSaving(true)
    setError(null)
    const normalizedLines = form.lines
      .map((line) => ({
        accountId: line.accountId,
        costCenterId: line.costCenterId || null,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        memo: line.memo || null,
        thirdPartyName: line.thirdPartyName || null,
        thirdPartyDocument: line.thirdPartyDocument || null,
      }))
      .filter((line) => line.accountId)

    if (!form.description.trim()) {
      setError('La descripción es requerida.')
      setSaving(false)
      return
    }

    if (!form.date) {
      setError('La fecha es requerida.')
      setSaving(false)
      return
    }

    if (normalizedLines.length < 2) {
      setError('Agrega al menos dos líneas contables.')
      setSaving(false)
      return
    }

    const totalDebit = Math.round(normalizedLines.reduce((sum, line) => sum + line.debit, 0))
    const totalCredit = Math.round(normalizedLines.reduce((sum, line) => sum + line.credit, 0))

    if (totalDebit <= 0 || totalCredit <= 0 || totalDebit !== totalCredit) {
      setError('El comprobante debe cuadrar en débito y crédito antes de guardarse.')
      setSaving(false)
      return
    }

    const res = await fetch('/api/contabilidad/comprobantes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodId: form.periodId || null,
        voucherType: form.voucherType,
        status: form.status,
        date: form.date,
        description: form.description,
        thirdPartyName: form.thirdPartyName || null,
        thirdPartyDocument: form.thirdPartyDocument || null,
        externalReference: form.externalReference || null,
        notes: form.notes || null,
        lines: normalizedLines,
      }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? 'No fue posible crear el comprobante')
      setSaving(false)
      return
    }
    setDialogOpen(false)
    setForm(createInitialForm(openPeriods[0]?.id || '', accounts[0]?.id || '', accounts[1]?.id || accounts[0]?.id || ''))
    await reload()
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Contabilidad"
        title={<span data-tour="contabilidad-comprobantes-title">Comprobantes contables</span>}
        description="Mesa de trabajo para comprobantes manuales, ajustes, reclasificaciones, provisiones, cierres y reversos con trazabilidad completa."
        stats={[
          { label: 'Comprobantes', value: rows.length, hint: 'Registros creados en el núcleo contable', tone: 'sky' },
          { label: 'Borradores', value: rows.filter((item) => item.status === 'DRAFT').length, hint: 'Pendientes de revisión', tone: 'neutral' },
          { label: 'Aprobados/Posteados', value: rows.filter((item) => item.status === 'APPROVED' || item.status === 'POSTED').length, hint: 'Con flujo de control', tone: 'teal' },
        ]}
      />

      <ContabilidadSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-sky-200 bg-sky-50/70 p-4 text-sm text-slate-700" data-tour="contabilidad-comprobantes-create">
        <span>Aquí se crean comprobantes manuales, ajustes, aperturas y cierres del núcleo contable.</span>
        <Button className="rounded-xl" onClick={() => setDialogOpen(true)}>Crear comprobante</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[26px] border-slate-200" data-tour="contabilidad-comprobantes-list">
          <CardHeader>
            <CardTitle>Comprobantes recientes</CardTitle>
            <CardDescription>Bandeja inicial conectada al API base de comprobantes contables.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.length ? rows.slice(0, 8).map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{row.code} · {row.voucherType}</div>
                    <div className="text-sm text-slate-500">{row.periodLabel} · {row.date}</div>
                  </div>
                  <div className="text-sm font-medium text-slate-700">{row.status}</div>
                </div>
                <div className="mt-2 text-sm text-slate-600">{row.description}</div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
                  <div>Tercero: {row.thirdPartyName || 'Sin tercero'}</div>
                  <div>Débito: {formatCurrency(row.totalDebit)}</div>
                  <div>Crédito: {formatCurrency(row.totalCredit)}</div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                Aún no hay comprobantes creados desde el nuevo núcleo contable.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Bandejas objetivo</CardTitle>
            <CardDescription>Estructura sugerida para que el equipo contable trabaje sin mezclar configuración con operación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workQueues.map((queue) => (
              <div key={queue.title} className={`rounded-2xl border p-4 ${queue.tone}`}>
                <div className="font-semibold text-slate-950">{queue.title}</div>
                <div className="mt-1 text-sm text-slate-600">{queue.detail}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Crear comprobante</DialogTitle>
            <DialogDescription>Registra un comprobante completo con múltiples líneas, centros de costo y referencias del tercero.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2">
                <Label>Período</Label>
                <Select value={form.periodId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, periodId: value === '__none__' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder="Sin período" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin período</SelectItem>
                    {openPeriods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tipo</Label>
                <Select value={form.voucherType} onValueChange={(value) => setForm((current) => ({ ...current, voucherType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIARIO">Diario</SelectItem>
                    <SelectItem value="INGRESO">Ingreso</SelectItem>
                    <SelectItem value="EGRESO">Egreso</SelectItem>
                    <SelectItem value="AJUSTE">Ajuste</SelectItem>
                    <SelectItem value="CIERRE">Cierre</SelectItem>
                    <SelectItem value="APERTURA">Apertura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Borrador</SelectItem>
                    <SelectItem value="APPROVED">Aprobado</SelectItem>
                    <SelectItem value="POSTED">Posteado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Fecha</Label>
                <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="grid gap-2 md:col-span-2 xl:col-span-4">
                <Label>Descripción</Label>
                <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Tercero</Label>
                <Input value={form.thirdPartyName} onChange={(event) => setForm((current) => ({ ...current, thirdPartyName: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Documento tercero</Label>
                <Input value={form.thirdPartyDocument} onChange={(event) => setForm((current) => ({ ...current, thirdPartyDocument: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Referencia externa</Label>
                <Input value={form.externalReference} onChange={(event) => setForm((current) => ({ ...current, externalReference: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Notas</Label>
                <Input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Líneas del comprobante</div>
                  <div className="text-xs text-slate-500">Cada línea puede llevar su cuenta, centro de costo, memo y tercero específico.</div>
                </div>
                <Button type="button" variant="outline" onClick={addLine}>Agregar línea</Button>
              </div>

              <div className="mt-4 space-y-3">
                {form.lines.map((line, index) => (
                  <div key={`line-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-900">Línea {index + 1}</div>
                      <Button type="button" variant="ghost" onClick={() => removeLine(index)} disabled={form.lines.length <= 2}>Quitar</Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="grid gap-2 xl:col-span-2">
                        <Label>Cuenta</Label>
                        <Select value={line.accountId || '__empty__'} onValueChange={(value) => updateLine(index, { accountId: value === '__empty__' ? '' : value })}>
                          <SelectTrigger><SelectValue placeholder="Selecciona cuenta" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__empty__">Selecciona cuenta</SelectItem>
                            {accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Centro de costo</Label>
                        <Select value={line.costCenterId || '__none__'} onValueChange={(value) => updateLine(index, { costCenterId: value === '__none__' ? '' : value })}>
                          <SelectTrigger><SelectValue placeholder="Sin centro" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin centro</SelectItem>
                            {costCenters.map((costCenter) => <SelectItem key={costCenter.id} value={costCenter.id}>{costCenter.code} - {costCenter.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Memo</Label>
                        <Input value={line.memo} onChange={(event) => updateLine(index, { memo: event.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Débito</Label>
                        <Input type="number" min="0" step="1" value={line.debit} onChange={(event) => updateLine(index, { debit: event.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Crédito</Label>
                        <Input type="number" min="0" step="1" value={line.credit} onChange={(event) => updateLine(index, { credit: event.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Tercero línea</Label>
                        <Input value={line.thirdPartyName} onChange={(event) => updateLine(index, { thirdPartyName: event.target.value })} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Documento línea</Label>
                        <Input value={line.thirdPartyDocument} onChange={(event) => updateLine(index, { thirdPartyDocument: event.target.value })} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 md:grid-cols-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-sky-700">Débito total</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(totals.debit)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-sky-700">Crédito total</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(totals.credit)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-sky-700">Estado</div>
                  <div className="mt-1 text-sm font-medium text-slate-950">{Math.round(totals.debit) === Math.round(totals.credit) && totals.debit > 0 ? 'Cuadrado' : 'Pendiente por cuadrar'}</div>
                </div>
              </div>
            </div>
          </div>
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>{saving ? 'Guardando...' : 'Crear comprobante'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}