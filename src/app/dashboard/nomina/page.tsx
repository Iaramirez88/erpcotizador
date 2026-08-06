'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  FileHeart,
  FileSpreadsheet,
  Gift,
  HandHelping,
  HeartHandshake,
  LayoutGrid,
  LifeBuoy,
  ShieldAlert,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'
import { useDashboardAccess } from '@/components/dashboard/dashboard-access-context'
import { ErpPageHero, ErpSectionHeading } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { nominaHref } from '@/lib/nomina-routes'
import { formatCurrency } from '@/lib/utils'
import type { PayrollEmployeeRow, PayrollNoveltyRow, PayrollPeriodRow, PayrollSettlementRow } from '@/lib/payroll'
import type { PayrollPeopleOverview } from '@/lib/payroll-people'

type PortalSummary = {
  employee: null | {
    fullName: string
    role: string
    vacation: { earnedDays: number; takenDays: number; availableDays: number }
  }
  payslips: Array<{ id: string }>
  benefits: Array<{ id: string; status: string }>
  novelties: Array<{ id: string; type: string; status: string }>
  complaints: Array<{ id: string; status: string }>
}

type ApiDataResponse<T> = {
  data?: T
}

export default function NominaDashboardPage() {
  const { canAccessPayrollAdmin, hasPayrollPortal } = useDashboardAccess()
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [periods, setPeriods] = useState<PayrollPeriodRow[]>([])
  const [novelties, setNovelties] = useState<PayrollNoveltyRow[]>([])
  const [settlements, setSettlements] = useState<PayrollSettlementRow[]>([])
  const [peopleOverview, setPeopleOverview] = useState<PayrollPeopleOverview | null>(null)
  const [portal, setPortal] = useState<PortalSummary | null>(null)
  const isEmployeeOnly = hasPayrollPortal && !canAccessPayrollAdmin

  useEffect(() => {
    let cancelled = false

    async function load() {
      const portalRes = await fetch('/api/nomina/portal', { cache: 'no-store' })
      const portalJson = await portalRes.json().catch(() => null)

      let employeesJson: ApiDataResponse<PayrollEmployeeRow[]> | null = null
      let periodsJson: ApiDataResponse<PayrollPeriodRow[]> | null = null
      let noveltiesJson: ApiDataResponse<PayrollNoveltyRow[]> | null = null
      let settlementsJson: ApiDataResponse<PayrollSettlementRow[]> | null = null
      let peopleJson: ApiDataResponse<PayrollPeopleOverview> | null = null

      if (canAccessPayrollAdmin) {
        const [employeesRes, periodsRes, noveltiesRes, settlementsRes, peopleRes] = await Promise.all([
          fetch('/api/nomina/empleados', { cache: 'no-store' }),
          fetch('/api/nomina/periodos', { cache: 'no-store' }),
          fetch('/api/nomina/novedades', { cache: 'no-store' }),
          fetch('/api/nomina/liquidaciones', { cache: 'no-store' }),
          fetch('/api/nomina/gestion-personas/overview', { cache: 'no-store' }),
        ])

        ;[employeesJson, periodsJson, noveltiesJson, settlementsJson, peopleJson] = await Promise.all([
          employeesRes.json().catch(() => null),
          periodsRes.json().catch(() => null),
          noveltiesRes.json().catch(() => null),
          settlementsRes.json().catch(() => null),
          peopleRes.json().catch(() => null),
        ])
      }

      if (cancelled) return
      setEmployees((employeesJson?.data as PayrollEmployeeRow[] | undefined) ?? [])
      setPeriods((periodsJson?.data as PayrollPeriodRow[] | undefined) ?? [])
      setNovelties((noveltiesJson?.data as PayrollNoveltyRow[] | undefined) ?? [])
      setSettlements((settlementsJson?.data as PayrollSettlementRow[] | undefined) ?? [])
      setPeopleOverview((peopleJson?.data as PayrollPeopleOverview | undefined) ?? null)
      setPortal((portalJson?.data as PortalSummary | undefined) ?? null)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [canAccessPayrollAdmin])

  const activeEmployees = employees.filter((item) => item.status === 'ACTIVE').length
  const openPeriods = periods.filter((item) => item.status === 'BORRADOR' || item.status === 'CALCULADA').length
  const medicalLeaves = novelties.filter((item) => item.type === 'INCAPACIDAD' && item.status !== 'RECHAZADA').length
  const nextPeriod = periods[0] ?? null

  const adminCards = useMemo(() => [
    {
      title: 'Operación de nómina',
      href: nominaHref('periodos'),
      icon: CalendarClock,
      metric: `${openPeriods} ciclos abiertos`,
      hint: nextPeriod ? nextPeriod.label : 'Sin cortes activos',
      tone: 'from-sky-100 to-cyan-50 border-sky-200',
    },
    {
      title: 'Empleados y contratos',
      href: nominaHref('empleados'),
      icon: Users,
      metric: `${activeEmployees} activos`,
      hint: 'Altas, contratos y ficha laboral',
      tone: 'from-emerald-100 to-teal-50 border-emerald-200',
    },
    {
      title: 'Beneficios',
      href: nominaHref('beneficios'),
      icon: HeartHandshake,
      metric: `${portal?.benefits.length ?? 0} visibles`,
      hint: 'Bonos, descuentos y planes',
      tone: 'from-violet-100 to-fuchsia-50 border-violet-200',
    },
    {
      title: 'Denuncias y servicio',
      href: nominaHref('canal-denuncias'),
      icon: ShieldAlert,
      metric: `${portal?.complaints.length ?? 0} casos propios`,
      hint: 'Canal ético y soporte al colaborador',
      tone: 'from-amber-100 to-orange-50 border-amber-200',
    },
  ], [activeEmployees, nextPeriod, openPeriods, portal?.benefits.length, portal?.complaints.length])

  const employeeFeatures = [
    { icon: UserRound, label: 'Actualizar contacto y perfil profesional' },
    { icon: FileSpreadsheet, label: 'Ver desprendibles y documentos' },
    { icon: CalendarClock, label: 'Consultar vacaciones disponibles' },
    { icon: FileHeart, label: 'Radicar incapacidades con soporte' },
    { icon: HandHelping, label: 'Revisar beneficios y descuentos' },
    { icon: ShieldAlert, label: 'Enviar denuncias desde formulario guiado' },
  ]

  const employeeLandingCards = useMemo(() => [
    {
      title: 'Vacaciones disponibles',
      value: `${portal?.employee?.vacation.availableDays ?? 0} días`,
      detail: 'Consulta tu saldo visible y el histórico registrado.',
      href: nominaHref('portal-empleado'),
      icon: CalendarClock,
      tone: 'from-emerald-100 to-teal-50 border-emerald-200',
    },
    {
      title: 'Desprendibles y documentos',
      value: `${portal?.payslips.length ?? 0} recientes`,
      detail: 'Encuentra pagos, soportes y documentos compartidos por RRHH.',
      href: nominaHref('portal-empleado'),
      icon: FileSpreadsheet,
      tone: 'from-sky-100 to-cyan-50 border-sky-200',
    },
    {
      title: 'Beneficios activos',
      value: `${portal?.benefits.length ?? 0} visibles`,
      detail: 'Revisa solicitudes, descuentos y convenios disponibles.',
      href: nominaHref('portal-empleado'),
      icon: Gift,
      tone: 'from-violet-100 to-fuchsia-50 border-violet-200',
    },
    {
      title: 'Canal confidencial',
      value: `${portal?.complaints.length ?? 0} casos`,
      detail: 'Reporta novedades sensibles desde un formulario breve y trazable.',
      href: nominaHref('portal-empleado'),
      icon: ShieldAlert,
      tone: 'from-amber-100 to-orange-50 border-amber-200',
    },
  ], [portal?.benefits.length, portal?.complaints.length, portal?.employee?.vacation.availableDays, portal?.payslips.length])

  return (
    <div className="space-y-6">
      <ErpPageHero
        eyebrow={isEmployeeOnly ? 'Mi espacio laboral' : 'RRHH administrativo'}
        title={<span data-tour="nomina-title">{isEmployeeOnly ? 'Mi nómina y bienestar' : 'Nómina y RRHH'}</span>}
        description={isEmployeeOnly
          ? 'Consulta tu información laboral, vacaciones, desprendibles, beneficios y solicitudes desde un resumen personal sin entrar al backoffice de RRHH.'
          : 'La nómina ahora vive como módulo hermano con separación clara entre operación administrativa de RRHH y autoservicio del colaborador.'}
        actions={
          <>
            {isEmployeeOnly ? (
              <Button asChild className="rounded-2xl">
                <Link href={nominaHref('portal-empleado')}>Entrar a mi portal</Link>
              </Button>
            ) : (
              <>
                <Button asChild className="rounded-2xl">
                  <Link href={nominaHref('empleados')}>Gestionar RRHH</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-2xl bg-white/90">
                  <Link href={nominaHref('portal-empleado')}>{hasPayrollPortal ? 'Ver mi portal como colaborador' : 'Ver portal del empleado'}</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-2xl bg-white/90">
                  <Link href={nominaHref('periodos')}>Ir a períodos</Link>
                </Button>
              </>
            )}
          </>
        }
        stats={[
          isEmployeeOnly
            ? { label: 'Vacaciones', value: portal?.employee?.vacation.availableDays ?? 0, hint: 'Días disponibles', tone: 'teal' as const }
            : { label: 'Activos', value: activeEmployees, hint: 'Colaboradores en nómina', tone: 'sky' as const },
          isEmployeeOnly
            ? { label: 'Desprendibles', value: portal?.payslips.length ?? 0, hint: 'Historial reciente', tone: 'sky' as const }
            : { label: 'Cortes abiertos', value: openPeriods, hint: 'Ciclos en revisión o pago', tone: 'amber' as const },
          isEmployeeOnly
            ? { label: 'Beneficios', value: portal?.benefits.length ?? 0, hint: 'Solicitudes y convenios', tone: 'amber' as const }
            : { label: 'Workflows people', value: peopleOverview?.summary.activeWorkflows ?? 0, hint: 'Onboarding, servicio y desarrollo', tone: 'teal' as const },
        ]}
      />

      <NominaSubnav />

      {isEmployeeOnly ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#f2fff7_0%,#ffffff_42%,#f7fbff_100%)] p-6 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.34)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Mi resumen laboral
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Todo lo personal en una sola entrada</h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600">
                    Sin tablas administrativas ni procesos internos. Aquí entras a tu información, tus soportes y tus solicitudes visibles como colaborador.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/90 px-4 py-3 text-right shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estado personal</div>
                  <div className="mt-1 text-3xl font-semibold text-slate-950">{portal?.employee?.vacation.availableDays ?? 0}</div>
                  <div className="text-xs text-slate-500">días libres visibles</div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {employeeLandingCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <Link key={card.title} href={card.href} className={`group rounded-[26px] border bg-gradient-to-br p-5 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 ${card.tone}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-slate-700 shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
                      </div>
                      <div className="mt-5 text-lg font-semibold text-slate-950">{card.title}</div>
                      <div className="mt-2 text-sm font-medium text-slate-700">{card.value}</div>
                      <div className="mt-1 text-sm text-slate-500">{card.detail}</div>
                    </Link>
                  )
                })}
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(160deg,#fffaf0_0%,#ffffff_45%,#f8fbff_100%)] p-6 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.34)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Qué puedes hacer
              </div>

              <div className="mt-4 rounded-[26px] border border-white/80 bg-white/92 p-5 shadow-sm">
                <div className="text-lg font-semibold text-slate-950">{portal?.employee?.fullName ?? 'Portal personal activo'}</div>
                <div className="mt-1 text-sm text-slate-500">{portal?.employee?.role ?? 'Tu usuario ya puede operar en autoservicio.'}</div>
              </div>

              <div className="mt-5 space-y-3">
                {employeeFeatures.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white/85 px-4 py-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-sm text-slate-700">{item.label}</div>
                    </div>
                  )
                })}
              </div>

              <Button asChild className="mt-5 h-11 w-full rounded-2xl">
                <Link href={nominaHref('portal-empleado')}>Abrir autoservicio</Link>
              </Button>
            </section>
          </div>
        </>
      ) : (
        <>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(135deg,#eef6ff_0%,#ffffff_42%,#f8fbff_100%)] p-6 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.34)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                <LayoutGrid className="h-3.5 w-3.5" />
                Backoffice RRHH
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Operación administrativa clara</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Reclutamiento, empleados, nómina, beneficios, desempeño y cumplimiento desde una sola vista para el equipo administrativo. Menos texto, más decisiones rápidas.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/80 bg-white/90 px-4 py-3 text-right shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Alertas activas</div>
              <div className="mt-1 text-3xl font-semibold text-slate-950">{medicalLeaves + settlements.filter((item) => item.status === 'PENDIENTE').length}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {adminCards.map((card) => {
              const Icon = card.icon
              return (
                <Link key={card.title} href={card.href} className={`group rounded-[26px] border bg-gradient-to-br p-5 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 ${card.tone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-slate-700 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-5 text-lg font-semibold text-slate-950">{card.title}</div>
                  <div className="mt-2 text-sm font-medium text-slate-700">{card.metric}</div>
                  <div className="mt-1 text-sm text-slate-500">{card.hint}</div>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(160deg,#f6fff9_0%,#ffffff_48%,#f6fbff_100%)] p-6 shadow-[0_24px_60px_-35px_rgba(15,23,42,0.34)]">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" />
            Vista colaborador
          </div>

          <div className="mt-4 rounded-[26px] border border-white/80 bg-white/92 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-950">{portal?.employee?.fullName ?? 'Portal listo para autoservicio'}</div>
                <div className="mt-1 text-sm text-slate-500">{portal?.employee?.role ?? 'Superficie separada para que cada colaborador vea solo su propia información y solicitudes.'}</div>
              </div>
              <BadgeCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Vacaciones</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{portal?.employee?.vacation.availableDays ?? 0}</div>
                <div className="text-xs text-slate-500">días disponibles</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Desprendibles</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{portal?.payslips.length ?? 0}</div>
                <div className="text-xs text-slate-500">últimos pagos</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Beneficios</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{portal?.benefits.length ?? 0}</div>
                <div className="text-xs text-slate-500">bonos o solicitudes</div>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {employeeFeatures.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white/85 px-4 py-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-sm text-slate-700">{item.label}</div>
                </div>
              )
            })}
          </div>

          <Button asChild className="mt-5 h-11 w-full rounded-2xl">
            <Link href={nominaHref('portal-empleado')}>{hasPayrollPortal ? 'Entrar a mi portal personal' : 'Abrir vista del portal del empleado'}</Link>
          </Button>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.28)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BriefcaseBusiness className="h-4 w-4 text-sky-700" /> Administración de personal</CardTitle>
            <CardDescription>Altas, contratos, novedades, retiros y trazabilidad laboral.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">{activeEmployees} colaboradores activos y {settlements.filter((item) => item.status === 'PENDIENTE').length} liquidaciones por cerrar.</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">{novelties.filter((item) => item.status === 'RADICADA').length} novedades radicadas pendientes de validar.</div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.28)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><LifeBuoy className="h-4 w-4 text-emerald-700" /> Experiencia del colaborador</CardTitle>
            <CardDescription>Portal, beneficios, servicio y autoservicio con acceso controlado por usuario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">{peopleOverview?.portalHighlights.length ?? 0} contenidos ya preparados para publicar en el portal.</div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">{portal?.novelties.filter((item) => item.type === 'INCAPACIDAD').length ?? 0} incapacidades visibles para el empleado autenticado.</div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.28)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><HandHelping className="h-4 w-4 text-violet-700" /> Desarrollo y cultura</CardTitle>
            <CardDescription>Selección, desempeño, formación, encuestas y estructura people.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">{peopleOverview?.summary.activeWorkflows ?? 0} workflows activos entre onboarding, desempeño y gestión de personas.</div>
            <Button asChild variant="outline" className="w-full rounded-2xl bg-white">
              <Link href={nominaHref('gestion-personas')}>Abrir estación people</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.28)]">
        <CardHeader>
          <ErpSectionHeading title="Estado de nómina" description="Lectura rápida del corte activo y del impacto económico visible en el módulo." />
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Ciclo actual</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{nextPeriod?.label ?? 'Sin período'}</div>
            <div className="mt-1 text-sm text-slate-500">{nextPeriod?.status ?? 'Crea un período para empezar'}</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Neto estimado</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(nextPeriod?.netTotal ?? 0)}</div>
            <div className="mt-1 text-sm text-slate-500">Pago del corte visible</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Seguridad social</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(nextPeriod?.socialSecurityTotal ?? 0)}</div>
            <div className="mt-1 text-sm text-slate-500">Carga prestacional del período</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Parafiscales</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(nextPeriod?.parafiscalesTotal ?? 0)}</div>
            <div className="mt-1 text-sm text-slate-500">Aportes y obligaciones</div>
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  )
}