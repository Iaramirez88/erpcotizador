'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, FileSpreadsheet, ReceiptText, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { formatCurrency } from '@/lib/utils'
import type { PayrollEmployeeRow, PayrollNoveltyRow, PayrollPeriodRow, PayrollPayslipRow, PayrollSettlementRow } from '@/lib/payroll'

const payrollAreas = [
  {
    title: 'Empleados y contratos',
    href: '/dashboard/contabilidad/nomina/empleados',
    description: 'Fecha de ingreso, retiro, datos laborales, salario, tipo de contrato y afiliaciones.',
  },
  {
    title: 'Períodos y cálculo',
    href: '/dashboard/contabilidad/nomina/periodos',
    description: 'Cortes quincenales, mensuales, semanales y por jornales con cálculo de devengos y deducciones.',
  },
  {
    title: 'Novedades e incapacidades',
    href: '/dashboard/contabilidad/nomina/novedades',
    description: 'Horas extra, ausencias, licencias, incapacidades, descuentos y otros movimientos de nómina.',
  },
  {
    title: 'Liquidaciones',
    href: '/dashboard/contabilidad/nomina/liquidaciones',
    description: 'Retiros, liquidación final, vacaciones, cesantías, intereses y prima.',
  },
  {
    title: 'Reportes y desprendibles',
    href: '/dashboard/contabilidad/nomina/reportes',
    description: 'Historial de pagos, exportación de recibos y consolidado para seguridad social y parafiscales.',
  },
]

export default function NominaHomePage() {
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [novelties, setNovelties] = useState<PayrollNoveltyRow[]>([])
  const [settlements, setSettlements] = useState<PayrollSettlementRow[]>([])
  const [payslips, setPayslips] = useState<PayrollPayslipRow[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [employeesRes, periodsRes, noveltiesRes, settlementsRes, payslipsRes] = await Promise.all([
        fetch('/api/nomina/empleados', { cache: 'no-store' }),
        fetch('/api/nomina/periodos', { cache: 'no-store' }),
        fetch('/api/nomina/novedades', { cache: 'no-store' }),
        fetch('/api/nomina/liquidaciones', { cache: 'no-store' }),
        fetch('/api/nomina/desprendibles', { cache: 'no-store' }),
      ])
      const [employeesJson, periodsJson, noveltiesJson, settlementsJson, payslipsJson] = await Promise.all([
        employeesRes.json().catch(() => null),
        periodsRes.json().catch(() => null),
        noveltiesRes.json().catch(() => null),
        settlementsRes.json().catch(() => null),
        payslipsRes.json().catch(() => null),
      ])
      if (cancelled) return
      setEmployees((employeesJson?.data as PayrollEmployeeRow[] | undefined) ?? [])
      setPeriods((periodsJson?.data as PayrollPeriodRow[] | undefined) ?? [])
      setNovelties((noveltiesJson?.data as PayrollNoveltyRow[] | undefined) ?? [])
      setSettlements((settlementsJson?.data as PayrollSettlementRow[] | undefined) ?? [])
      setPayslips((payslipsJson?.data as PayrollPayslipRow[] | undefined) ?? [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const nextPeriod = periods[0]

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="ERP financiero"
        title="Nómina"
        description="Módulo base para nómina Colombia: empleados, contratos, novedades, incapacidades, cálculo, desprendibles, liquidaciones, historial de pagos y salida contable."
        stats={[
          { label: 'Activos', value: employees.filter((item) => item.status === 'ACTIVE').length, hint: 'Colaboradores en nómina', tone: 'sky' },
          { label: 'En cálculo', value: periods.filter((item) => item.status === 'CALCULADA').length, hint: 'Períodos pendientes por pagar', tone: 'amber' },
          { label: 'Contabilización', value: 'Lista', hint: 'Integración con reglas y asientos', tone: 'neutral' },
        ]}
      />

      <NominaSubnav />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {payrollAreas.map((area) => (
          <Card key={area.href} className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader>
              <CardTitle>{area.title}</CardTitle>
              <CardDescription>{area.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="rounded-xl">
                <Link href={area.href}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        </div>

        <div className="space-y-4">
          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarClock className="h-4.5 w-4.5 text-sky-700" /> Corte activo</CardTitle>
              <CardDescription>Periodo que está listo para revisión, desprendibles y contabilización.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {nextPeriod ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-base font-semibold text-slate-950">{nextPeriod.label}</div>
                  <div className="mt-1">{nextPeriod.range}</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div><span className="font-medium text-slate-900">Pago:</span> {nextPeriod.paymentDate}</div>
                    <div><span className="font-medium text-slate-900">Neto:</span> {formatCurrency(nextPeriod.netTotal)}</div>
                    <div><span className="font-medium text-slate-900">Seguridad social:</span> {formatCurrency(nextPeriod.socialSecurityTotal)}</div>
                    <div><span className="font-medium text-slate-900">Parafiscales:</span> {formatCurrency(nextPeriod.parafiscalesTotal)}</div>
                  </div>
                </div>
              ) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">No hay períodos creados todavía.</div>}
              <Button asChild className="w-full rounded-xl">
                <Link href="/dashboard/contabilidad/nomina/periodos">Ir al cálculo</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4.5 w-4.5 text-amber-600" /> Radar operativo</CardTitle>
              <CardDescription>Puntos que normalmente bloquean cierre, pago o archivo laboral.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                <span className="flex items-center gap-2"><Users className="h-4 w-4 text-sky-700" /> Empleados con alerta</span>
                <span className="font-semibold text-slate-950">{employees.filter((item) => item.alerts.length).length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                <span className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-sky-700" /> Desprendibles recientes</span>
                <span className="font-semibold text-slate-950">{payslips.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-sky-700" /> Novedades abiertas</span>
                <span className="font-semibold text-slate-950">{novelties.filter((item) => item.status !== 'APLICADA').length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Liquidaciones pendientes</span>
                <span className="font-semibold text-slate-950">{settlements.filter((item) => item.status !== 'PAGADA').length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}