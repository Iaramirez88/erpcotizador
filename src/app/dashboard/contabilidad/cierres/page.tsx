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
import type { AccountingPeriodRow } from '@/lib/accounting-core'

export default function ContabilidadCierresPage() {
  const [periods, setPeriods] = useState<AccountingPeriodRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    label: '',
    status: 'OPEN',
    startsAt: '',
    endsAt: '',
    notes: '',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/contabilidad/periodos', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as { data?: AccountingPeriodRow[] } | null
      if (!cancelled) setPeriods(json?.data ?? [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function reload() {
    const res = await fetch('/api/contabilidad/periodos', { cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as { data?: AccountingPeriodRow[] } | null
    setPeriods(json?.data ?? [])
  }

  async function handleCreate() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/contabilidad/periodos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? 'No fue posible crear el período contable')
      setSaving(false)
      return
    }
    setDialogOpen(false)
    setForm({ label: '', status: 'OPEN', startsAt: '', endsAt: '', notes: '' })
    await reload()
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Contabilidad"
        title={<span data-tour="contabilidad-cierres-title">Períodos y cierres</span>}
        description="Bloqueo de meses, cierres anuales, ajustes de fin de período y control de aperturas, que es clave para disciplina contable real."
        stats={[
          { label: 'Períodos', value: periods.length, hint: 'Registrados en el nuevo núcleo', tone: 'sky' },
          { label: 'Abiertos', value: periods.filter((item) => item.status === 'OPEN').length, hint: 'Disponibles para trabajo contable', tone: 'amber' },
          { label: 'Cerrados/Bloqueados', value: periods.filter((item) => item.status !== 'OPEN').length, hint: 'Control del histórico', tone: 'teal' },
        ]}
      />

      <ContabilidadSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-sky-200 bg-sky-50/70 p-4 text-sm text-slate-700" data-tour="contabilidad-cierres-create">
        <span>Esta es la entrada para crear períodos contables antes de registrar comprobantes del núcleo nuevo.</span>
        <Button className="rounded-xl" onClick={() => setDialogOpen(true)}>Crear período contable</Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[26px] border-slate-200" data-tour="contabilidad-cierres-list">
          <CardHeader>
            <CardTitle>Períodos registrados</CardTitle>
            <CardDescription>Conectado al API base de períodos contables para apertura, cierre y bloqueo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            {periods.length ? periods.map((period) => (
              <div key={period.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{period.label}</div>
                    <div className="text-sm text-slate-500">{period.code} · {period.range}</div>
                  </div>
                  <div className="text-sm font-medium text-slate-700">{period.status}</div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <div>Comprobantes: {period.vouchersCount}</div>
                  <div>Cierre: {period.closedAt || 'Sin cierre'}</div>
                  <div>Bloqueo: {period.lockedAt || 'Sin bloqueo'}</div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                Aún no hay períodos contables creados en el núcleo nuevo.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Asientos de cierre esperados</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 text-sm text-slate-600">
            {[
              'Cierre de ingresos y gastos.',
              'Reclasificaciones de saldos.',
              'Provisiones y ajustes NIIF.',
              'Apertura del nuevo período.',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">{item}</div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Crear período contable</DialogTitle>
            <DialogDescription>Abre un período del núcleo nuevo para registrar comprobantes y futuros cierres.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>Nombre</Label><Input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ejemplo: Abril 2026" /></div>
            <div className="grid gap-2"><Label>Estado</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="OPEN">Abierto</SelectItem><SelectItem value="CLOSED">Cerrado</SelectItem><SelectItem value="LOCKED">Bloqueado</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Fecha inicio</Label><Input type="date" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Fecha fin</Label><Input type="date" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Notas</Label><Input value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></div>
          </div>
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleCreate()} disabled={saving}>{saving ? 'Guardando...' : 'Crear período'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}