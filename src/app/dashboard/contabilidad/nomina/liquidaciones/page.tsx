'use client'

import { useEffect, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import type { PayrollSettlementRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

export default function NominaLiquidacionesPage() {
  const [rows, setRows] = useState<PayrollSettlementRow[]>([])
  const { mode, setMode } = useDataViewMode('nomina.liquidaciones', 'list')

  async function load() {
    const res = await fetch('/api/nomina/liquidaciones', { cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as { data?: PayrollSettlementRow[] } | null
    setRows(json?.data ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function contabilizar(settlementId: string) {
    await fetch(`/api/nomina/liquidaciones/${settlementId}/contabilizar`, { method: 'POST' })
    await load()
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Nómina"
        title="Liquidaciones y retiro"
        description="Liquidación final por retiro, vacaciones, cesantías, intereses y demás conceptos prestacionales."
        stats={[
          { label: 'Pendientes', value: rows.filter((item) => item.status === 'PENDIENTE').length, hint: 'Retiros sin desembolso', tone: 'amber' },
          { label: 'Pagadas', value: rows.filter((item) => item.status === 'PAGADA').length, hint: 'Liquidaciones cerradas', tone: 'teal' },
          { label: 'Total estimado', value: formatCurrency(rows.reduce((sum, item) => sum + item.total, 0)), hint: 'Acumulado de la bandeja', tone: 'sky' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end">
        <DataViewToggle mode={mode} onChange={setMode} />
      </div>

      <Card className="rounded-[26px] border-slate-200">
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
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}