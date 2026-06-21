'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock, FileSpreadsheet, ReceiptText, Users } from 'lucide-react'
import { useI18n } from '@/components/providers/i18n-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { formatCurrency } from '@/lib/utils'
import type { PayrollEmployeeRow, PayrollNoveltyRow, PayrollPeriodRow, PayrollPayslipRow, PayrollSettlementRow } from '@/lib/payroll'
import type { PayrollPeopleOverview } from '@/lib/payroll-people'

type ModuleGroupItem = {
  title: string
  description: string
  href?: string
  status: 'connected' | 'blueprint'
}

type ModuleGroup = {
  title: string
  icon: string
  items: ModuleGroupItem[]
}

export default function NominaHomePage() {
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [novelties, setNovelties] = useState<PayrollNoveltyRow[]>([])
  const [settlements, setSettlements] = useState<PayrollSettlementRow[]>([])
  const [payslips, setPayslips] = useState<PayrollPayslipRow[]>([])
  const [peopleOverview, setPeopleOverview] = useState<PayrollPeopleOverview | null>(null)
  const { language } = useI18n()

  const copy = language === 'en'
    ? {
        eyebrow: 'Financial ERP',
        title: 'Payroll',
        description: 'Core payroll module for Colombia with a Buk-like people management layer: employees, contracts, workflows, self-service portal and people reporting over the same data base.',
        quickTitle: 'Where is each process started?',
        quickDescription: 'Keep the most used entry points visible to avoid jumping across screens.',
        quickActions: {
          employee: 'Create employee or contract',
          novelty: 'Create payroll change',
          period: 'Create period',
          settlement: 'Create settlement',
          people: 'Open People Management',
        },
        spotlightTitle: 'People Management',
        spotlightDescription: 'This new station groups organizational structure, employee portal, users and profiles, workflows and reporting with demo records already stored in database.',
        spotlightButton: 'Open station',
        moduleStatus: {
          connected: 'Connected',
          blueprint: 'Blueprint',
        },
        groupAction: 'Open',
        activeCutTitle: 'Active cycle',
        activeCutDescription: 'Period ready for review, payslips and accounting output.',
        noPeriods: 'No payroll periods created yet.',
        goToCalculation: 'Go to payroll run',
        radarTitle: 'Operational radar',
        radarDescription: 'Typical blockers for closing, paying or filing employment records.',
        employeesAlert: 'Employees with alerts',
        payslipsRecent: 'Recent payslips',
        noveltiesOpen: 'Open changes',
        settlementsPending: 'Pending settlements',
        labels: {
          payDate: 'Payment',
          net: 'Net',
          social: 'Social security',
          parafiscales: 'Payroll taxes',
        },
        groups: [
          {
            title: 'Administration',
            icon: '📋',
            items: [
              { title: 'Payroll software', description: 'Payroll calculation, periods, payslips and accounting output.', href: '/dashboard/contabilidad/nomina/periodos', status: 'connected' },
              { title: 'Attendance control', description: 'Real screen with shifts, lateness, leave and overtime records stored in database.', href: '/dashboard/contabilidad/nomina/asistencia', status: 'connected' },
              { title: 'E-signature and documents', description: 'Current document output references payslips and employee history.', href: '/dashboard/contabilidad/nomina/reportes', status: 'connected' },
              { title: 'Onboarding', description: 'Real operational tray with journeys, checklist execution and employee handoff.', href: '/dashboard/contabilidad/nomina/onboarding', status: 'connected' },
              { title: 'Whistleblowing channel', description: 'Confidential case tray for ethics, harassment, privacy and fraud reports with tracked resolution.', href: '/dashboard/contabilidad/nomina/canal-denuncias', status: 'connected' },
              { title: 'Employee service center', description: 'Real service tray for certificates, payroll updates, access and employee portal support.', href: '/dashboard/contabilidad/nomina/servicio-colaborador', status: 'connected' },
              { title: 'Asset management', description: 'Use the existing internal allocation flow as current reference surface.', href: '/dashboard/dotaciones', status: 'connected' },
            ],
          },
          {
            title: 'Organizational Development',
            icon: '🚀',
            items: [
              { title: 'Recruiting', description: 'Real candidate pipeline with openings, stages, scoring and offer readiness for payroll and people roles.', href: '/dashboard/contabilidad/nomina/seleccion', status: 'connected' },
              { title: 'Communication and recognition', description: 'Now represented through the employee portal station.', href: '/dashboard/contabilidad/nomina/gestion-personas', status: 'connected' },
              { title: 'Surveys', description: 'Real survey campaign tray for climate, onboarding and benefits feedback with participation metrics.', href: '/dashboard/contabilidad/nomina/encuestas', status: 'connected' },
              { title: 'Performance management', description: 'Real review cycles with employee linkage, calibration and development plans.', href: '/dashboard/contabilidad/nomina/desempeno', status: 'connected' },
              { title: 'Learning', description: 'Real training assignments with employee linkage, provider, modality and completion tracking.', href: '/dashboard/contabilidad/nomina/capacitaciones', status: 'connected' },
            ],
          },
          {
            title: 'Benefits',
            icon: '🫶',
            items: [
              { title: 'Benefits management', description: 'Real request tray for points, plans, payroll advances and discount packs.', href: '/dashboard/contabilidad/nomina/beneficios', status: 'connected' },
              { title: 'Payroll advances', description: 'Operational requests connected to payroll employees and exposed inside benefits management.', href: '/dashboard/contabilidad/nomina/beneficios', status: 'connected' },
              { title: 'Benefit plans', description: 'Real catalog of plans with pricing, points and vendor traceability inside the benefits tray.', href: '/dashboard/contabilidad/nomina/beneficios', status: 'connected' },
              { title: 'Discount packs', description: 'Real partner-backed packs with spotlight, copay and discount configuration.', href: '/dashboard/contabilidad/nomina/beneficios', status: 'connected' },
            ],
          },
        ] as ModuleGroup[],
      }
    : {
        eyebrow: 'ERP financiero',
        title: 'Nómina',
        description: 'Módulo base para nómina Colombia con una nueva capa de gestión de personas estilo Buk: empleados, contratos, workflows, portal del colaborador y reportería sobre la misma base de datos.',
        quickTitle: '¿Dónde se crea cada cosa?',
        quickDescription: 'Deja visibles los puntos de entrada más usados para arrancar el flujo sin buscar en varias pantallas.',
        quickActions: {
          employee: 'Crear empleado o contrato',
          novelty: 'Crear novedad',
          period: 'Crear período',
          settlement: 'Crear liquidación',
          people: 'Abrir Gestión de Personas',
        },
        spotlightTitle: 'Gestión de Personas',
        spotlightDescription: 'La nueva estación agrupa estructura organizacional, portal del colaborador, usuarios y perfiles, workflows y reportería con registros demo ya persistidos en base de datos.',
        spotlightButton: 'Abrir estación',
        moduleStatus: {
          connected: 'Conectado',
          blueprint: 'Blueprint',
        },
        groupAction: 'Abrir',
        activeCutTitle: 'Corte activo',
        activeCutDescription: 'Periodo que está listo para revisión, desprendibles y contabilización.',
        noPeriods: 'No hay períodos creados todavía.',
        goToCalculation: 'Ir al cálculo',
        radarTitle: 'Radar operativo',
        radarDescription: 'Puntos que normalmente bloquean cierre, pago o archivo laboral.',
        employeesAlert: 'Empleados con alerta',
        payslipsRecent: 'Desprendibles recientes',
        noveltiesOpen: 'Novedades abiertas',
        settlementsPending: 'Liquidaciones pendientes',
        labels: {
          payDate: 'Pago',
          net: 'Neto',
          social: 'Seguridad social',
          parafiscales: 'Parafiscales',
        },
        groups: [
          {
            title: 'Administración',
            icon: '📋',
            items: [
              { title: 'Software de Nómina', description: 'Cálculo de nómina, períodos, desprendibles y salida contable.', href: '/dashboard/contabilidad/nomina/periodos', status: 'connected' },
              { title: 'Control de Asistencia', description: 'Pantalla real con turnos, tardanzas, permisos y horas extra persistidos en base de datos.', href: '/dashboard/contabilidad/nomina/asistencia', status: 'connected' },
              { title: 'Firma Electrónica y Gestión de Documentos', description: 'La salida documental actual toma desprendibles e historial laboral como referencia.', href: '/dashboard/contabilidad/nomina/reportes', status: 'connected' },
              { title: 'Onboarding', description: 'Bandeja operativa real con journeys, checklist ejecutable y handoff del colaborador.', href: '/dashboard/contabilidad/nomina/onboarding', status: 'connected' },
              { title: 'Canal de Denuncias', description: 'Bandeja confidencial para ética, acoso, privacidad y fraude con resolución trazable.', href: '/dashboard/contabilidad/nomina/canal-denuncias', status: 'connected' },
              { title: 'Servicio al Colaborador', description: 'Bandeja real para certificados, actualizaciones de nómina, accesos y soporte del portal.', href: '/dashboard/contabilidad/nomina/servicio-colaborador', status: 'connected' },
              { title: 'Gestión de Activos', description: 'Toma como referencia la superficie existente de asignación interna.', href: '/dashboard/dotaciones', status: 'connected' },
            ],
          },
          {
            title: 'Desarrollo Organizacional',
            icon: '🚀',
            items: [
              { title: 'Selección', description: 'Pipeline real de candidatos con vacantes, etapas, scoring y alistamiento para oferta.', href: '/dashboard/contabilidad/nomina/seleccion', status: 'connected' },
              { title: 'Comunicación y Reconocimiento', description: 'Ahora queda representado dentro de la estación de portal del colaborador.', href: '/dashboard/contabilidad/nomina/gestion-personas', status: 'connected' },
              { title: 'Encuestas', description: 'Bandeja real de campañas para clima, onboarding y beneficios con métricas de participación.', href: '/dashboard/contabilidad/nomina/encuestas', status: 'connected' },
              { title: 'Gestión del Desempeño', description: 'Ciclos reales con empleado, score, calibración y plan de desarrollo.', href: '/dashboard/contabilidad/nomina/desempeno', status: 'connected' },
              { title: 'Capacitaciones', description: 'Asignaciones reales con empleado, proveedor, modalidad y avance de cierre.', href: '/dashboard/contabilidad/nomina/capacitaciones', status: 'connected' },
            ],
          },
          {
            title: 'Beneficios',
            icon: '🫶',
            items: [
              { title: 'Gestión de Beneficios', description: 'Bandeja real de puntos, planes, adelantos de nómina y packs de descuentos.', href: '/dashboard/contabilidad/nomina/beneficios', status: 'connected' },
              { title: 'Adelantos de Nómina', description: 'Solicitudes operativas conectadas al colaborador y expuestas dentro de gestión de beneficios.', href: '/dashboard/contabilidad/nomina/beneficios', status: 'connected' },
              { title: 'Planes de Beneficios', description: 'Catálogo real de planes con pricing, puntos y trazabilidad del aliado dentro de la misma bandeja.', href: '/dashboard/contabilidad/nomina/beneficios', status: 'connected' },
              { title: 'Pack de Descuentos', description: 'Packs reales con destaque, copago y configuración de descuento sobre la misma superficie.', href: '/dashboard/contabilidad/nomina/beneficios', status: 'connected' },
            ],
          },
        ] as ModuleGroup[],
      }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [employeesRes, periodsRes, noveltiesRes, settlementsRes, payslipsRes, peopleRes] = await Promise.all([
        fetch('/api/nomina/empleados', { cache: 'no-store' }),
        fetch('/api/nomina/periodos', { cache: 'no-store' }),
        fetch('/api/nomina/novedades', { cache: 'no-store' }),
        fetch('/api/nomina/liquidaciones', { cache: 'no-store' }),
        fetch('/api/nomina/desprendibles', { cache: 'no-store' }),
        fetch('/api/nomina/gestion-personas/overview', { cache: 'no-store' }),
      ])
      const [employeesJson, periodsJson, noveltiesJson, settlementsJson, payslipsJson, peopleJson] = await Promise.all([
        employeesRes.json().catch(() => null),
        periodsRes.json().catch(() => null),
        noveltiesRes.json().catch(() => null),
        settlementsRes.json().catch(() => null),
        payslipsRes.json().catch(() => null),
        peopleRes.json().catch(() => null),
      ])
      if (cancelled) return
      setEmployees((employeesJson?.data as PayrollEmployeeRow[] | undefined) ?? [])
      setPeriods((periodsJson?.data as PayrollPeriodRow[] | undefined) ?? [])
      setNovelties((noveltiesJson?.data as PayrollNoveltyRow[] | undefined) ?? [])
      setSettlements((settlementsJson?.data as PayrollSettlementRow[] | undefined) ?? [])
      setPayslips((payslipsJson?.data as PayrollPayslipRow[] | undefined) ?? [])
      setPeopleOverview((peopleJson?.data as PayrollPeopleOverview | undefined) ?? null)
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
        eyebrow={copy.eyebrow}
        title={<span data-tour="nomina-title">{copy.title}</span>}
        description={copy.description}
        stats={[
          { label: 'Activos', value: employees.filter((item) => item.status === 'ACTIVE').length, hint: 'Colaboradores en nómina', tone: 'sky' },
          { label: 'En cálculo', value: periods.filter((item) => item.status === 'CALCULADA').length, hint: 'Períodos pendientes por pagar', tone: 'amber' },
          { label: language === 'en' ? 'People station' : 'Estación people', value: peopleOverview?.summary.activeWorkflows ?? 0, hint: language === 'en' ? 'Active workflows with demo records' : 'Workflows activos con registros demo', tone: 'neutral' },
        ]}
      />

      <NominaSubnav />

      <Card className="rounded-[26px] border-sky-200 bg-sky-50/70 shadow-[0_20px_40px_-32px_rgba(14,116,144,0.35)]" data-tour="nomina-quick-actions">
        <CardHeader>
          <CardTitle>{copy.quickTitle}</CardTitle>
          <CardDescription>{copy.quickDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild className="rounded-xl">
            <Link href="/dashboard/contabilidad/nomina/empleados">{copy.quickActions.employee}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl bg-white/80">
            <Link href="/dashboard/contabilidad/nomina/novedades">{copy.quickActions.novelty}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl bg-white/80">
            <Link href="/dashboard/contabilidad/nomina/periodos">{copy.quickActions.period}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl bg-white/80">
            <Link href="/dashboard/contabilidad/nomina/liquidaciones">{copy.quickActions.settlement}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl bg-white/80">
            <Link href="/dashboard/contabilidad/nomina/gestion-personas">{copy.quickActions.people}</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="grid gap-4 xl:grid-cols-3" data-tour="nomina-modules">
        {copy.groups.map((group) => (
          <Card key={group.title} className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-[1.15rem]">
                <span className="text-2xl">{group.icon}</span>
                <span>{group.title}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.items.map((item) => (
                <div key={item.title} className="rounded-[22px] border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-600">{item.description}</div>
                    </div>
                    <span className={item.status === 'connected' ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800' : 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'}>
                      {copy.moduleStatus[item.status]}
                    </span>
                  </div>
                  {item.href ? (
                    <div className="mt-3">
                      <Button asChild variant="outline" className="rounded-xl bg-slate-50">
                        <Link href={item.href}>{copy.groupAction}</Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        </div>

        <div className="space-y-4">
          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarClock className="h-4.5 w-4.5 text-sky-700" /> {copy.activeCutTitle}</CardTitle>
              <CardDescription>{copy.activeCutDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {nextPeriod ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-base font-semibold text-slate-950">{nextPeriod.label}</div>
                  <div className="mt-1">{nextPeriod.range}</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div><span className="font-medium text-slate-900">{copy.labels.payDate}:</span> {nextPeriod.paymentDate}</div>
                    <div><span className="font-medium text-slate-900">{copy.labels.net}:</span> {formatCurrency(nextPeriod.netTotal)}</div>
                    <div><span className="font-medium text-slate-900">{copy.labels.social}:</span> {formatCurrency(nextPeriod.socialSecurityTotal)}</div>
                    <div><span className="font-medium text-slate-900">{copy.labels.parafiscales}:</span> {formatCurrency(nextPeriod.parafiscalesTotal)}</div>
                  </div>
                </div>
              ) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">{copy.noPeriods}</div>}
              <Button asChild className="w-full rounded-xl">
                <Link href="/dashboard/contabilidad/nomina/periodos">{copy.goToCalculation}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-sky-200 bg-sky-50/60 shadow-[0_20px_40px_-32px_rgba(14,116,144,0.35)]">
            <CardHeader>
              <CardTitle>{copy.spotlightTitle}</CardTitle>
              <CardDescription>{copy.spotlightDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-sky-100 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">{language === 'en' ? 'Org units' : 'Unidades orgánicas'}</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{peopleOverview?.orgUnits.length ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">{language === 'en' ? 'Portal cards' : 'Tarjetas portal'}</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{peopleOverview?.portalHighlights.length ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">{language === 'en' ? 'Profiles' : 'Perfiles'}</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{peopleOverview?.accessProfiles.length ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">{language === 'en' ? 'Reports' : 'Reportes'}</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{peopleOverview?.reports.length ?? 0}</div>
                </div>
              </div>
              <Button asChild className="w-full rounded-xl">
                <Link href="/dashboard/contabilidad/nomina/gestion-personas">{copy.spotlightButton}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4.5 w-4.5 text-amber-600" /> {copy.radarTitle}</CardTitle>
              <CardDescription>{copy.radarDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                <span className="flex items-center gap-2"><Users className="h-4 w-4 text-sky-700" /> {copy.employeesAlert}</span>
                <span className="font-semibold text-slate-950">{employees.filter((item) => item.alerts.length).length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                <span className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-sky-700" /> {copy.payslipsRecent}</span>
                <span className="font-semibold text-slate-950">{payslips.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-sky-700" /> {copy.noveltiesOpen}</span>
                <span className="font-semibold text-slate-950">{novelties.filter((item) => item.status !== 'APLICADA').length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
                <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> {copy.settlementsPending}</span>
                <span className="font-semibold text-slate-950">{settlements.filter((item) => item.status !== 'PAGADA').length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}