'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import type { PayrollPayslipRow, PayrollPeriodRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

export default function NominaPeriodosPage() {
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [payslips, setPayslips] = useState<PayrollPayslipRow[]>([])
  const { mode, setMode } = useDataViewMode('nomina.periodos', 'list')

  async function load() {
    const [periodsRes, payslipsRes] = await Promise.all([
      fetch('/api/nomina/periodos', { cache: 'no-store' }),
      fetch('/api/nomina/desprendibles', { cache: 'no-store' }),
    ])
    const [periodsJson, payslipsJson] = await Promise.all([
      periodsRes.json().catch(() => null),
      payslipsRes.json().catch(() => null),
    ])
    setPeriods((periodsJson?.data as PayrollPeriodRow[] | undefined) ?? [])
    setPayslips((payslipsJson?.data as PayrollPayslipRow[] | undefined) ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function contabilizar(periodId: string) {
    await fetch(`/api/nomina/periodos/${periodId}/contabilizar`, { method: 'POST' })
    await load()
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Nómina"
        title="Períodos y cálculo"
        description="Gestión de cortes de nómina, ejecución de cálculo, desprendibles y contabilización automática."
        stats={[
          { label: 'Periodicidad', value: '4', hint: 'Quincenal, mensual, semanal y jornales', tone: 'sky' },
          { label: 'Pagados', value: periods.filter((item) => item.status === 'PAGADA').length, hint: 'Períodos cerrados', tone: 'teal' },
          { label: 'Pendientes', value: periods.filter((item) => item.accountingStatus === 'PENDIENTE').length, hint: 'Sin asiento aún', tone: 'amber' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end">
        <DataViewToggle mode={mode} onChange={setMode} />
      </div>

      <Tabs defaultValue="periodos" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2 rounded-2xl">
          <TabsTrigger value="periodos">Períodos</TabsTrigger>
          <TabsTrigger value="desprendibles">Desprendibles</TabsTrigger>
        </TabsList>

        <TabsContent value="periodos" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="rounded-[26px] border-slate-200">
              <CardHeader>
                <CardTitle>Cortes de nómina</CardTitle>
                <CardDescription>Simulación de estados del ciclo: borrador, calculada, pagada y contabilizada.</CardDescription>
              </CardHeader>
              <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
                {periods.map((period) => (
                  <div key={period.id} className={mode === 'grid' ? 'rounded-[22px] border border-slate-200 bg-white p-4' : 'rounded-[18px] border border-slate-200 bg-white px-4 py-3'}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{period.label}</div>
                        <div className="text-sm text-slate-500">{period.range}</div>
                      </div>
                      <div className="flex gap-2">
                        <span className={period.status === 'PAGADA' ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800' : period.status === 'CALCULADA' ? 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800' : 'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700'}>
                          {period.status}
                        </span>
                        <span className={period.accountingStatus === 'CONTABILIZADA' ? 'rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800' : 'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700'}>
                          {period.accountingStatus}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-3">
                      <div>Empleados: {period.employeesCount}</div>
                      <div>Bruto: {formatCurrency(period.grossTotal)}</div>
                      <div>Deducciones: {formatCurrency(period.deductionsTotal)}</div>
                      <div>Neto: {formatCurrency(period.netTotal)}</div>
                      <div>Seguridad social: {formatCurrency(period.socialSecurityTotal)}</div>
                      <div>Parafiscales: {formatCurrency(period.parafiscalesTotal)}</div>
                    </div>
                    {period.accountingStatus === 'PENDIENTE' && period.status !== 'BORRADOR' ? (
                      <div className="mt-3 flex justify-end">
                        <Button variant="outline" className="rounded-xl" onClick={() => void contabilizar(period.id)}>Contabilizar</Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[26px] border-slate-200">
              <CardHeader>
                <CardTitle>Resumen del período seleccionado</CardTitle>
                <CardDescription>Base de la futura pantalla de cálculo por empleado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                {periods[0] ? <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="font-semibold text-slate-950">{periods[0].label}</div>
                    <div className="mt-1">Pago programado: {periods[0].paymentDate}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"><span>Devengado total</span><strong>{formatCurrency(periods[0].grossTotal)}</strong></div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"><span>Deducciones</span><strong>{formatCurrency(periods[0].deductionsTotal)}</strong></div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3"><span>Neto a pagar</span><strong>{formatCurrency(periods[0].netTotal)}</strong></div>
                  </div>
                </> : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">No hay períodos disponibles.</div>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="desprendibles">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>Desprendibles recientes</CardTitle>
              <CardDescription>Vista previa de recibos exportables por PDF, portal o correo.</CardDescription>
            </CardHeader>
            <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
              {payslips.map((receipt) => (
                <div key={receipt.id} className={mode === 'grid' ? 'flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-white p-4' : 'flex flex-col gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between'}>
                  <div>
                    <div className="font-semibold text-slate-950">{receipt.employeeName}</div>
                    <div className="text-sm text-slate-500">{receipt.periodLabel} · Pago: {receipt.paymentDate}</div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <span>{formatCurrency(receipt.netPay)}</span>
                    <span className={receipt.signed ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800' : 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'}>
                      {receipt.signed ? 'Firmado' : 'Pendiente'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{receipt.deliveredBy}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}