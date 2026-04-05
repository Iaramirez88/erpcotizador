'use client'

import { useEffect, useState } from 'react'
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
type PeriodOption = { id: string; label: string }

const workQueues = [
  { title: 'Borradores', detail: 'Comprobantes pendientes por revisión, numeración y soporte.', tone: 'border-amber-200 bg-amber-50/60' },
  { title: 'Aprobados', detail: 'Listos para afectar libros y auxiliares sin editar el histórico.', tone: 'border-sky-200 bg-sky-50/60' },
  { title: 'Anulados', detail: 'Histórico con razón, usuario y trazabilidad de reversión.', tone: 'border-slate-200 bg-slate-50/80' },
]

export default function ContabilidadComprobantesPage() {
  const [rows, setRows] = useState<AccountingVoucherRow[]>([])
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [periods, setPeriods] = useState<PeriodOption[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    periodId: '',
    voucherType: 'DIARIO',
    status: 'DRAFT',
    date: '',
    description: '',
    thirdPartyName: '',
    debitAccountId: '',
    creditAccountId: '',
    amount: '',
    memo: '',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [vouchersRes, accountsRes, periodsRes] = await Promise.all([
        fetch('/api/contabilidad/comprobantes', { cache: 'no-store' }),
        fetch('/api/contabilidad/cuentas', { cache: 'no-store' }),
        fetch('/api/contabilidad/periodos', { cache: 'no-store' }),
      ])
      const [vouchersJson, accountsJson, periodsJson] = await Promise.all([
        vouchersRes.json().catch(() => null),
        accountsRes.json().catch(() => null),
        periodsRes.json().catch(() => null),
      ])
      if (cancelled) return
      const nextPeriods = (periodsJson?.data as PeriodOption[] | undefined) ?? []
      setRows((vouchersJson?.data as AccountingVoucherRow[] | undefined) ?? [])
      setAccounts((accountsJson?.data as AccountOption[] | undefined) ?? [])
      setPeriods(nextPeriods)
      setForm((current) => ({
        ...current,
        periodId: current.periodId || nextPeriods[0]?.id || '',
        debitAccountId: current.debitAccountId || (accountsJson?.data?.[0]?.id ?? ''),
        creditAccountId: current.creditAccountId || (accountsJson?.data?.[1]?.id ?? accountsJson?.data?.[0]?.id ?? ''),
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

  async function handleCreate() {
    setSaving(true)
    setError(null)
    const amount = Number(form.amount)
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
        lines: [
          { accountId: form.debitAccountId, debit: amount, credit: 0, memo: form.memo || null },
          { accountId: form.creditAccountId, debit: 0, credit: amount, memo: form.memo || null },
        ],
      }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? 'No fue posible crear el comprobante')
      setSaving(false)
      return
    }
    setDialogOpen(false)
    setForm({ periodId: periods[0]?.id || '', voucherType: 'DIARIO', status: 'DRAFT', date: '', description: '', thirdPartyName: '', debitAccountId: accounts[0]?.id || '', creditAccountId: accounts[1]?.id || accounts[0]?.id || '', amount: '', memo: '' })
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
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Crear comprobante</DialogTitle>
            <DialogDescription>Alta rápida con dos líneas cuadradas para operación manual inicial.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2"><Label>Período</Label><Select value={form.periodId || '__none__'} onValueChange={(value) => setForm((current) => ({ ...current, periodId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Sin período" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin período</SelectItem>{periods.map((period) => <SelectItem key={period.id} value={period.id}>{period.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Tipo</Label><Select value={form.voucherType} onValueChange={(value) => setForm((current) => ({ ...current, voucherType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DIARIO">Diario</SelectItem><SelectItem value="INGRESO">Ingreso</SelectItem><SelectItem value="EGRESO">Egreso</SelectItem><SelectItem value="AJUSTE">Ajuste</SelectItem><SelectItem value="CIERRE">Cierre</SelectItem><SelectItem value="APERTURA">Apertura</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Estado</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DRAFT">Borrador</SelectItem><SelectItem value="APPROVED">Aprobado</SelectItem><SelectItem value="POSTED">Posteado</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Fecha</Label><Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Descripción</Label><Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Tercero</Label><Input value={form.thirdPartyName} onChange={(event) => setForm((current) => ({ ...current, thirdPartyName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Cuenta débito</Label><Select value={form.debitAccountId} onValueChange={(value) => setForm((current) => ({ ...current, debitAccountId: value }))}><SelectTrigger><SelectValue placeholder="Selecciona cuenta" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Cuenta crédito</Label><Select value={form.creditAccountId} onValueChange={(value) => setForm((current) => ({ ...current, creditAccountId: value }))}><SelectTrigger><SelectValue placeholder="Selecciona cuenta" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Valor</Label><Input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Memo</Label><Input value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} /></div>
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