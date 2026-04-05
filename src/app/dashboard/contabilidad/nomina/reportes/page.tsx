'use client'

import { useEffect, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import type { PayrollPayslipRow, PayrollPeriodRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

export default function NominaReportesPage() {
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [payslips, setPayslips] = useState<PayrollPayslipRow[]>([])
  const { mode, setMode } = useDataViewMode('nomina.reportes', 'list')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [periodsRes, payslipsRes] = await Promise.all([
        fetch('/api/nomina/periodos', { cache: 'no-store' }),
        fetch('/api/nomina/desprendibles', { cache: 'no-store' }),
      ])
      const [periodsJson, payslipsJson] = await Promise.all([
        periodsRes.json().catch(() => null),
        payslipsRes.json().catch(() => null),
      ])
      if (cancelled) return
      setPeriods((periodsJson?.data as PayrollPeriodRow[] | undefined) ?? [])
      setPayslips((payslipsJson?.data as PayrollPayslipRow[] | undefined) ?? [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Nómina"
        title="Reportes y desprendibles"
        description="Historial de pagos, exportación de recibos, consolidado de aportes y reportes operativos de nómina."
        stats={[
          { label: 'Salida', value: 'PDF/Excel', hint: 'Recibos y exportaciones', tone: 'sky' },
          { label: 'Recibos', value: payslips.length, hint: 'Historial disponible', tone: 'teal' },
          { label: 'Pagos', value: formatCurrency(periods.filter((item) => item.status === 'PAGADA').reduce((sum, item) => sum + item.netTotal, 0)), hint: 'Neto histórico visible', tone: 'neutral' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end">
        <DataViewToggle mode={mode} onChange={setMode} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Salidas planeadas</CardTitle>
            <CardDescription>Entregables del módulo una vez conectemos motor y base de datos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            {[
              'Desprendible individual PDF por empleado y período',
              'Historial de pagos por empleado',
              'Consolidado seguridad social y parafiscales',
              'Exportación bancaria para dispersión',
              'Resumen contable por período y centro de costo',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white p-3">{item}</div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Historial reciente de desprendibles</CardTitle>
              <CardDescription>Histórico real de desprendibles generados por período y empleado.</CardDescription>
          </CardHeader>
            <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
            {payslips.map((receipt) => (
              <div key={receipt.id} className={mode === 'grid' ? 'flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-white p-4' : 'flex flex-col gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between'}>
                <div>
                  <div className="font-semibold text-slate-950">{receipt.employeeName}</div>
                  <div className="text-sm text-slate-500">{receipt.periodLabel} · {receipt.paymentDate}</div>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <span>{formatCurrency(receipt.netPay)}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{receipt.deliveredBy}</span>
                  <span className={receipt.signed ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800' : 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'}>
                    {receipt.signed ? 'Firmado' : 'Pendiente'}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}