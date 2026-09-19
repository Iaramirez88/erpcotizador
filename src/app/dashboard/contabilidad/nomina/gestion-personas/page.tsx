'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/components/providers/i18n-provider'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaCompactTable, NominaStatusBadge } from '@/components/dashboard/nomina-compact-table'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

export default function NominaGestionPersonasPage() {
  const [overview, setOverview] = useState<PayrollPeopleOverview | null>(null)
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

      <div className="flex flex-wrap items-center gap-3">
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
      </div>

      <div className="space-y-4">
        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>{copy.sections.org[0]}</CardTitle>
            <CardDescription>{copy.sections.org[1]}</CardDescription>
          </CardHeader>
          <CardContent>
            <NominaCompactTable rows={overview?.orgUnits ?? []} minWidth="820px" emptyMessage={language === 'en' ? 'No organizational units.' : 'No hay unidades organizacionales.'} columns={[
              { key: 'unit', label: language === 'en' ? 'Unit / code' : 'Unidad / código', render: (item) => <><div className="font-medium text-slate-950">{item.name}</div><div className="text-xs text-slate-500">{item.code} · {item.level}</div></> },
              { key: 'parent', label: copy.labels.parent, render: (item) => item.parentName ?? '—' },
              { key: 'manager', label: copy.labels.manager, render: (item) => item.managerName ?? '—' },
              { key: 'site', label: copy.labels.site, render: (item) => item.sede ?? '—' },
              { key: 'headcount', label: 'Headcount', className: 'text-center font-semibold tabular-nums', headerClassName: 'text-center', render: (item) => item.headcount },
              { key: 'status', label: language === 'en' ? 'Status' : 'Estado', render: (item) => <NominaStatusBadge status={item.status} /> },
            ]} />
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>{copy.sections.portal[0]}</CardTitle>
            <CardDescription>{copy.sections.portal[1]}</CardDescription>
          </CardHeader>
          <CardContent>
            <NominaCompactTable rows={overview?.portalHighlights ?? []} minWidth="1020px" emptyMessage={language === 'en' ? 'No portal publications.' : 'No hay publicaciones del portal.'} columns={[
              { key: 'content', label: language === 'en' ? 'Content / category' : 'Contenido / categoría', className: 'max-w-[300px]', render: (item) => <><div className="truncate font-medium text-slate-950">{item.title}</div><div className="text-xs text-slate-500">{item.category}</div><div className="truncate text-xs text-slate-400" title={item.summary}>{item.summary}</div></> },
              { key: 'audience', label: copy.labels.audience, render: (item) => item.audience },
              { key: 'employee', label: copy.labels.employee, render: (item) => item.employeeName ?? '—' },
              { key: 'metric', label: language === 'en' ? 'Metric' : 'Métrica', className: 'text-center tabular-nums', headerClassName: 'text-center', render: (item) => <><div className="font-semibold">{item.metricValue ?? '—'}</div><div className="text-xs text-slate-500">{item.metricLabel ?? 'KPI'}</div></> },
              { key: 'date', label: copy.labels.generated, className: 'whitespace-nowrap', render: (item) => formatDate(item.publishedAt, locale) },
              { key: 'status', label: language === 'en' ? 'Status' : 'Estado', render: (item) => <NominaStatusBadge status={item.status} /> },
              { key: 'action', label: copy.labels.action, headerClassName: 'text-right', render: (item) => item.actionUrl ? <div className="flex justify-end"><Button asChild size="sm" variant="outline" className="h-8 rounded-lg px-2.5"><Link href={item.actionUrl}>{item.actionLabel ?? copy.labels.action}</Link></Button></div> : '—' },
            ]} />
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>{copy.sections.access[0]}</CardTitle>
            <CardDescription>{copy.sections.access[1]}</CardDescription>
          </CardHeader>
          <CardContent>
            <NominaCompactTable rows={overview?.accessProfiles ?? []} minWidth="1120px" emptyMessage={language === 'en' ? 'No access profiles.' : 'No hay perfiles de acceso.'} columns={[
              { key: 'profile', label: language === 'en' ? 'Profile / scope' : 'Perfil / alcance', render: (item) => <><div className="font-medium text-slate-950">{item.profileName}</div><div className="text-xs text-slate-500">{item.roleLabel} · {item.scopeLabel}</div></> },
              { key: 'user', label: copy.labels.user, render: (item) => item.userName ?? item.userEmail ?? '—' },
              { key: 'employee', label: copy.labels.employee, render: (item) => item.employeeName ?? '—' },
              { key: 'permissions', label: copy.labels.permissions, className: 'max-w-[300px]', render: (item) => <div className="truncate" title={item.permissions.join(', ')}>{item.permissions.join(', ') || '—'}</div> },
              { key: 'dates', label: language === 'en' ? 'Reviewed / accessed' : 'Revisado / acceso', className: 'whitespace-nowrap', render: (item) => <><div>{formatDate(item.lastReviewedAt, locale)}</div><div className="text-xs text-slate-500">{formatDate(item.lastAccessAt, locale)}</div></> },
              { key: 'status', label: language === 'en' ? 'Status' : 'Estado', render: (item) => <NominaStatusBadge status={item.status} /> },
            ]} />
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>{copy.sections.workflows[0]}</CardTitle>
            <CardDescription>{copy.sections.workflows[1]}</CardDescription>
          </CardHeader>
          <CardContent>
            <NominaCompactTable rows={overview?.workflowTemplates ?? []} minWidth="1000px" emptyMessage={language === 'en' ? 'No workflow templates.' : 'No hay plantillas de workflow.'} columns={[
              { key: 'workflow', label: language === 'en' ? 'Workflow / category' : 'Workflow / categoría', render: (item) => <><div className="font-medium text-slate-950">{item.name}</div><div className="text-xs text-slate-500">{item.category}</div></> },
              { key: 'owner', label: copy.labels.owner, render: (item) => item.ownerName ?? '—' },
              { key: 'trigger', label: copy.labels.trigger, render: (item) => item.triggerType },
              { key: 'operation', label: language === 'en' ? 'SLA / automation' : 'SLA / automatización', render: (item) => <><div>{item.slaHours} h</div><div className="text-xs text-slate-500">{item.automationLevel} · {item.stepCount} {language === 'en' ? 'steps' : 'pasos'}</div></> },
              { key: 'executed', label: copy.labels.executed, className: 'whitespace-nowrap', render: (item) => formatDate(item.lastExecutedAt, locale) },
              { key: 'status', label: language === 'en' ? 'Status' : 'Estado', render: (item) => <NominaStatusBadge status={item.status} /> },
            ]} />
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>{copy.sections.reports[0]}</CardTitle>
            <CardDescription>{copy.sections.reports[1]}</CardDescription>
          </CardHeader>
          <CardContent>
            <NominaCompactTable rows={overview?.reports ?? []} minWidth="1120px" emptyMessage={language === 'en' ? 'No people reports.' : 'No hay reportes de personas.'} columns={[
              { key: 'report', label: language === 'en' ? 'Report / category' : 'Reporte / categoría', render: (item) => <><div className="font-medium text-slate-950">{item.name}</div><div className="text-xs text-slate-500">{item.category}</div></> },
              { key: 'cadence', label: copy.labels.cadence, render: (item) => item.cadence },
              { key: 'audience', label: copy.labels.audience, render: (item) => item.audience },
              { key: 'metric', label: language === 'en' ? 'Metric / trend' : 'Métrica / tendencia', className: 'text-right tabular-nums', headerClassName: 'text-right', render: (item) => <><div className="font-semibold">{item.metricValue}</div><div className="text-xs text-slate-500">{item.metricTrend ?? '—'}</div></> },
              { key: 'filters', label: copy.labels.filters, className: 'max-w-[230px]', render: (item) => <div className="truncate" title={item.filtersSummary ?? ''}>{item.filtersSummary ?? '—'}</div> },
              { key: 'owner', label: copy.labels.owner, render: (item) => item.ownerName ?? '—' },
              { key: 'generated', label: copy.labels.generated, className: 'whitespace-nowrap', render: (item) => formatDate(item.lastGeneratedAt, locale) },
              { key: 'status', label: language === 'en' ? 'Status' : 'Estado', render: (item) => <NominaStatusBadge status={item.status} /> },
            ]} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}