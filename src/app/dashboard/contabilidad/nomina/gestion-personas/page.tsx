'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Building2, FileBarChart2, Network, ShieldCheck, Workflow } from 'lucide-react'
import { useI18n } from '@/components/providers/i18n-provider'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import { nominaHref } from '@/lib/nomina-routes'
import type { PayrollPeopleOverview } from '@/lib/payroll-people'

function formatDate(value: string | null, locale: string) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

function statusClass(status: string) {
  const normalized = status.toUpperCase()
  if (normalized === 'ACTIVE' || normalized === 'PUBLISHED' || normalized === 'READY') {
    return 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800'
  }
  return 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'
}

export default function NominaGestionPersonasPage() {
  const [overview, setOverview] = useState<PayrollPeopleOverview | null>(null)
  const { mode, setMode } = useDataViewMode('nomina.gestion-personas', 'grid')
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'People admin',
        title: 'People Management',
        description: 'Administrative people layer aligned with Buk references: organization, profiles, workflows and reporting, while the collaborator portal stays as a separate employee-facing surface.',
        stats: [
          { label: 'Org units', hint: 'Stored demo structure', tone: 'sky' as const },
          { label: 'Portal cards', hint: 'Self-service content', tone: 'teal' as const },
          { label: 'Reports', hint: 'People analytics outputs', tone: 'neutral' as const },
        ],
        architectureTitle: 'People backoffice map',
        architectureDescription: 'This page is the administrative layer. It extends payroll with real entities and keeps the collaborator portal as a separate consumption surface.',
        modulesTitle: 'Reference modules',
        modulesDescription: 'These references anchor the Buk-like scope while preserving the current visual language.',
        openEmployees: 'Open employees',
        openPeriods: 'Open periods',
        sections: {
          org: ['Organizational Structure', 'Units, hierarchy, manager and headcount fields stored in database.'],
          portal: ['Employee Portal', 'Visible cards to show what the employee-facing surface can publish today.'],
          access: ['Users and Profiles', 'Profiles linked to users or employees with scope and permissions.'],
          workflows: ['Workflows', 'Operational templates with trigger, owner, SLA and step count.'],
          reports: ['Reporting', 'People reporting outputs and their operating audience.'],
        },
        labels: {
          parent: 'Parent',
          manager: 'Manager',
          site: 'Site',
          audience: 'Audience',
          action: 'Action',
          user: 'User',
          employee: 'Employee',
          permissions: 'Permissions',
          owner: 'Owner',
          trigger: 'Trigger',
          cadence: 'Cadence',
          filters: 'Filters',
          reviewed: 'Reviewed',
          accessed: 'Last access',
          generated: 'Generated',
          executed: 'Executed',
        },
        referenceModules: [
          { icon: Network, title: 'Organizational structure', description: 'New database-backed layer to visualize areas, hierarchy and leadership.' },
          { icon: Building2, title: 'Employee portal', description: 'Portal cards show current self-service and communication entry points.' },
          { icon: ShieldCheck, title: 'Users and profiles', description: 'Linked to current users, company scope and payroll employee records.' },
          { icon: Workflow, title: 'Workflows', description: 'Templates for onboarding, vacation approvals and compensation changes.' },
          { icon: FileBarChart2, title: 'Reporting', description: 'People analytics outputs connected to active payroll records.' },
        ],
      }
    : {
        eyebrow: 'People admin',
        title: 'Gestión de Personas',
        description: 'Capa administrativa de people alineada con referencias de Buk: estructura organizacional, usuarios, perfiles, workflows y reportería, dejando el portal del colaborador como superficie separada.',
        stats: [
          { label: 'Unidades', hint: 'Estructura demo persistida', tone: 'sky' as const },
          { label: 'Tarjetas portal', hint: 'Autoservicio visible', tone: 'teal' as const },
          { label: 'Reportes', hint: 'Salidas de people analytics', tone: 'neutral' as const },
        ],
        architectureTitle: 'Mapa del backoffice people',
        architectureDescription: 'Esta página es la capa administrativa. Extiende Nómina con entidades reales y deja el portal del colaborador como superficie separada de consumo.',
        modulesTitle: 'Módulos de referencia',
        modulesDescription: 'Estas referencias amarran el alcance estilo Buk sin romper la línea visual actual.',
        openEmployees: 'Abrir empleados',
        openPeriods: 'Abrir períodos',
        sections: {
          org: ['Estructura Organizacional', 'Unidades, jerarquía, líder y headcount almacenados en base de datos.'],
          portal: ['Portal del Colaborador', 'Tarjetas visibles para mostrar qué publica hoy la superficie de autoservicio.'],
          access: ['Usuarios y Perfiles', 'Perfiles ligados a usuarios o empleados con alcance y permisos.'],
          workflows: ['Workflows', 'Plantillas operativas con disparador, responsable, SLA y número de pasos.'],
          reports: ['Reportería', 'Salidas de people reporting y su audiencia operativa.'],
        },
        labels: {
          parent: 'Padre',
          manager: 'Responsable',
          site: 'Sede',
          audience: 'Audiencia',
          action: 'Acción',
          user: 'Usuario',
          employee: 'Empleado',
          permissions: 'Permisos',
          owner: 'Responsable',
          trigger: 'Disparador',
          cadence: 'Frecuencia',
          filters: 'Filtros',
          reviewed: 'Revisado',
          accessed: 'Último acceso',
          generated: 'Generado',
          executed: 'Ejecutado',
        },
        referenceModules: [
          { icon: Network, title: 'Estructura organizacional', description: 'Nueva capa persistida para visualizar áreas, jerarquía y liderazgo.' },
          { icon: Building2, title: 'Portal del colaborador', description: 'Las tarjetas del portal muestran los puntos actuales de autoservicio y comunicación.' },
          { icon: ShieldCheck, title: 'Usuarios y perfiles', description: 'Se conecta con usuarios actuales, alcance de empresa y ficha del empleado.' },
          { icon: Workflow, title: 'Workflows', description: 'Plantillas para onboarding, aprobación de vacaciones y cambios de compensación.' },
          { icon: FileBarChart2, title: 'Reportería', description: 'Salidas de people analytics conectadas a registros activos de nómina.' },
        ],
      }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const response = await fetch('/api/nomina/gestion-personas/overview', { cache: 'no-store' })
      const json = (await response.json().catch(() => null)) as { data?: PayrollPeopleOverview } | null
      if (!cancelled) {
        setOverview(json?.data ?? null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <Button asChild className="rounded-2xl">
              <Link href={nominaHref('empleados')}>{copy.openEmployees}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('portal-empleado')}>{language === 'en' ? 'View collaborator portal' : 'Ver portal del colaborador'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: copy.stats[0].label, value: overview?.orgUnits.length ?? 0, hint: copy.stats[0].hint, tone: copy.stats[0].tone },
          { label: copy.stats[1].label, value: overview?.portalHighlights.length ?? 0, hint: copy.stats[1].hint, tone: copy.stats[1].tone },
          { label: copy.stats[2].label, value: overview?.reports.length ?? 0, hint: copy.stats[2].hint, tone: copy.stats[2].tone },
        ]}
      />

      <NominaSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card className="flex-1 rounded-[24px] border-sky-200 bg-sky-50/70 shadow-[0_20px_40px_-32px_rgba(14,116,144,0.35)]">
          <CardHeader>
            <CardTitle>{copy.architectureTitle}</CardTitle>
            <CardDescription>{copy.architectureDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild className="rounded-xl">
              <Link href={nominaHref('empleados')}>{copy.openEmployees}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl bg-white/80">
              <Link href={nominaHref('onboarding')}>{language === 'en' ? 'Open onboarding' : 'Abrir onboarding'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl bg-white/80">
              <Link href={nominaHref('servicio-colaborador')}>{language === 'en' ? 'Open service center' : 'Abrir servicio'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl bg-white/80">
              <Link href={nominaHref('canal-denuncias')}>{language === 'en' ? 'Open ethics channel' : 'Abrir canal de denuncias'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl bg-white/80">
              <Link href={nominaHref('seleccion')}>{language === 'en' ? 'Open recruiting' : 'Abrir selección'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl bg-white/80">
              <Link href={nominaHref('encuestas')}>{language === 'en' ? 'Open surveys' : 'Abrir encuestas'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl bg-white/80">
              <Link href={nominaHref('desempeno')}>{language === 'en' ? 'Open performance' : 'Abrir desempeño'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl bg-white/80">
              <Link href={nominaHref('capacitaciones')}>{language === 'en' ? 'Open learning' : 'Abrir capacitaciones'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl bg-white/80">
              <Link href={nominaHref('periodos')}>{copy.openPeriods}</Link>
            </Button>
          </CardContent>
        </Card>
        <DataViewToggle mode={mode} onChange={setMode} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {copy.referenceModules.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.title} className="rounded-[24px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.28)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4.5 w-4.5 text-sky-700" /> {item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>{copy.sections.org[0]}</CardTitle>
            <CardDescription>{copy.sections.org[1]}</CardDescription>
          </CardHeader>
          <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
            {overview?.orgUnits.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{item.name}</div>
                    <div className="text-sm text-slate-500">{item.code} · {item.level}</div>
                  </div>
                  <span className={statusClass(item.status)}>{item.status}</span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <div>{copy.labels.parent}: {item.parentName ?? '—'}</div>
                  <div>{copy.labels.manager}: {item.managerName ?? '—'}</div>
                  <div>{copy.labels.site}: {item.sede ?? '—'}</div>
                  <div>Headcount: {item.headcount}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>{copy.sections.portal[0]}</CardTitle>
            <CardDescription>{copy.sections.portal[1]}</CardDescription>
          </CardHeader>
          <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
            {overview?.portalHighlights.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{item.title}</div>
                    <div className="text-sm text-slate-500">{item.category}</div>
                  </div>
                  <span className={statusClass(item.status)}>{item.status}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{item.summary}</p>
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <div>{copy.labels.audience}: {item.audience}</div>
                  <div>{item.metricLabel ?? 'KPI'}: {item.metricValue ?? '—'}</div>
                  <div>{copy.labels.employee}: {item.employeeName ?? '—'}</div>
                  <div>{copy.labels.generated}: {formatDate(item.publishedAt, locale)}</div>
                </div>
                {item.actionUrl ? (
                  <div className="mt-3">
                    <Button asChild variant="outline" className="rounded-xl bg-slate-50">
                      <Link href={item.actionUrl}>{item.actionLabel ?? copy.labels.action}</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>{copy.sections.access[0]}</CardTitle>
            <CardDescription>{copy.sections.access[1]}</CardDescription>
          </CardHeader>
          <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
            {overview?.accessProfiles.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{item.profileName}</div>
                    <div className="text-sm text-slate-500">{item.roleLabel} · {item.scopeLabel}</div>
                  </div>
                  <span className={statusClass(item.status)}>{item.status}</span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <div>{copy.labels.user}: {item.userName ?? item.userEmail ?? '—'}</div>
                  <div>{copy.labels.employee}: {item.employeeName ?? '—'}</div>
                  <div>{copy.labels.permissions}: {item.permissions.join(', ') || '—'}</div>
                  <div>{copy.labels.reviewed}: {formatDate(item.lastReviewedAt, locale)}</div>
                  <div>{copy.labels.accessed}: {formatDate(item.lastAccessAt, locale)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>{copy.sections.workflows[0]}</CardTitle>
            <CardDescription>{copy.sections.workflows[1]}</CardDescription>
          </CardHeader>
          <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
            {overview?.workflowTemplates.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{item.name}</div>
                    <div className="text-sm text-slate-500">{item.category}</div>
                  </div>
                  <span className={statusClass(item.status)}>{item.status}</span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <div>{copy.labels.owner}: {item.ownerName ?? '—'}</div>
                  <div>{copy.labels.trigger}: {item.triggerType}</div>
                  <div>SLA: {item.slaHours}h</div>
                  <div>{language === 'en' ? 'Automation' : 'Automatización'}: {item.automationLevel}</div>
                  <div>{language === 'en' ? 'Steps' : 'Pasos'}: {item.stepCount}</div>
                  <div>{copy.labels.executed}: {formatDate(item.lastExecutedAt, locale)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200 xl:col-span-2">
          <CardHeader>
            <CardTitle>{copy.sections.reports[0]}</CardTitle>
            <CardDescription>{copy.sections.reports[1]}</CardDescription>
          </CardHeader>
          <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
            {overview?.reports.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">{item.name}</div>
                    <div className="text-sm text-slate-500">{item.category}</div>
                  </div>
                  <span className={statusClass(item.status)}>{item.status}</span>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <div>{copy.labels.cadence}: {item.cadence}</div>
                  <div>{copy.labels.audience}: {item.audience}</div>
                  <div>{language === 'en' ? 'Metric' : 'Métrica'}: {item.metricValue}</div>
                  <div>{language === 'en' ? 'Trend' : 'Tendencia'}: {item.metricTrend ?? '—'}</div>
                  <div>{copy.labels.filters}: {item.filtersSummary ?? '—'}</div>
                  <div>{copy.labels.owner}: {item.ownerName ?? '—'}</div>
                  <div>{copy.labels.generated}: {formatDate(item.lastGeneratedAt, locale)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}