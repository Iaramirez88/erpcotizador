import { randomUUID } from 'node:crypto'
import { PayrollEmployeeStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName } from '@/lib/payroll'

export type PayrollOrgUnitRow = {
  id: string
  code: string
  name: string
  level: string
  status: string
  headcount: number
  location: string | null
  parentName: string | null
  managerName: string | null
  sede: string | null
}

export type PayrollPortalHighlightRow = {
  id: string
  title: string
  category: string
  summary: string
  status: string
  audience: string
  actionLabel: string | null
  actionUrl: string | null
  metricLabel: string | null
  metricValue: string | null
  employeeName: string | null
  publishedAt: string | null
}

export type PayrollAccessProfileRow = {
  id: string
  profileName: string
  roleLabel: string
  scopeLabel: string
  status: string
  permissions: string[]
  userName: string | null
  userEmail: string | null
  employeeName: string | null
  lastReviewedAt: string | null
  lastAccessAt: string | null
}

export type PayrollWorkflowTemplateRow = {
  id: string
  name: string
  category: string
  status: string
  triggerType: string
  slaHours: number
  automationLevel: string
  stepCount: number
  ownerName: string | null
  lastExecutedAt: string | null
}

export type PayrollPeopleReportRow = {
  id: string
  name: string
  category: string
  cadence: string
  audience: string
  status: string
  metricValue: string
  metricTrend: string | null
  filtersSummary: string | null
  ownerName: string | null
  lastGeneratedAt: string | null
}

export type PayrollPeopleOverview = {
  summary: {
    activeEmployees: number
    linkedUsers: number
    publishedPortalHighlights: number
    activeWorkflows: number
    readyReports: number
  }
  orgUnits: PayrollOrgUnitRow[]
  portalHighlights: PayrollPortalHighlightRow[]
  accessProfiles: PayrollAccessProfileRow[]
  workflowTemplates: PayrollWorkflowTemplateRow[]
  reports: PayrollPeopleReportRow[]
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

type EmployeeSeedRef = {
  id: string
  fullName: string
  jobTitle: string
  sedeId: string
}

type UserSeedRef = {
  id: string
  name: string | null
  email: string
}

async function loadSeedRefs(empresaId: string) {
  const [employees, users] = await Promise.all([
    prisma.payrollEmployee.findMany({
      where: { empresaId },
      orderBy: [{ createdAt: 'asc' }],
      take: 3,
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        secondLastName: true,
        jobTitle: true,
        sedeId: true,
      },
    }),
    prisma.user.findMany({
      where: { empresaId },
      orderBy: [{ createdAt: 'asc' }],
      take: 3,
      select: { id: true, name: true, email: true },
    }),
  ])

  return {
    employees: employees.map<EmployeeSeedRef>((item) => ({
      id: item.id,
      fullName: buildPayrollEmployeeFullName(item),
      jobTitle: item.jobTitle,
      sedeId: item.sedeId,
    })),
    users: users.map<UserSeedRef>((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
    })),
  }
}

export async function ensurePayrollPeopleDemoData(empresaId: string) {
  const [orgUnitCount, portalCount, accessCount, workflowCount, reportCount] = await prisma.$transaction([
    prisma.payrollOrgUnit.count({ where: { empresaId } }),
    prisma.payrollPortalHighlight.count({ where: { empresaId } }),
    prisma.payrollAccessProfile.count({ where: { empresaId } }),
    prisma.payrollWorkflowTemplate.count({ where: { empresaId } }),
    prisma.payrollPeopleReport.count({ where: { empresaId } }),
  ])

  if (orgUnitCount && portalCount && accessCount && workflowCount && reportCount) {
    return
  }

  const { employees, users } = await loadSeedRefs(empresaId)
  const primaryEmployee = employees[0] ?? null
  const secondaryEmployee = employees[1] ?? primaryEmployee
  const tertiaryEmployee = employees[2] ?? secondaryEmployee ?? primaryEmployee
  const primaryUser = users[0] ?? null
  const secondaryUser = users[1] ?? primaryUser
  const tertiaryUser = users[2] ?? secondaryUser ?? primaryUser

  if (!orgUnitCount) {
    const rootId = randomUUID()
    const operationsId = randomUUID()
    const analyticsId = randomUUID()

    await prisma.payrollOrgUnit.createMany({
      data: [
        {
          id: rootId,
          empresaId,
          sedeId: primaryEmployee?.sedeId ?? null,
          managerEmployeeId: primaryEmployee?.id ?? null,
          code: 'ORG-DIR',
          name: 'Dirección de Personas',
          level: 'Dirección',
          headcount: 18,
          location: 'Corporativo',
          notes: 'Unidad rectora para talento, compensación y cultura.',
        },
        {
          id: operationsId,
          empresaId,
          sedeId: secondaryEmployee?.sedeId ?? primaryEmployee?.sedeId ?? null,
          parentId: rootId,
          managerEmployeeId: secondaryEmployee?.id ?? null,
          code: 'ORG-NOM',
          name: 'Operaciones de Nómina',
          level: 'Coordinación',
          headcount: 6,
          location: 'Backoffice',
          notes: 'Controla cierres, novedades y consistencia contable.',
        },
        {
          id: analyticsId,
          empresaId,
          sedeId: tertiaryEmployee?.sedeId ?? primaryEmployee?.sedeId ?? null,
          parentId: rootId,
          managerEmployeeId: tertiaryEmployee?.id ?? null,
          code: 'ORG-ANA',
          name: 'People Analytics',
          level: 'Célula',
          headcount: 3,
          location: 'Híbrido',
          notes: 'Consolida tableros de headcount, rotación y ausentismo.',
        },
      ],
    })
  }

  if (!portalCount) {
    await prisma.payrollPortalHighlight.createMany({
      data: [
        {
          empresaId,
          employeeId: primaryEmployee?.id ?? null,
          title: 'Desprendibles listos para firma',
          category: 'Portal del colaborador',
          summary: 'Muestra pagos recientes pendientes de aceptación digital en el portal.',
          audience: 'Toda la empresa',
          actionLabel: 'Ver desprendibles',
          actionUrl: '/dashboard/contabilidad/nomina/reportes',
          metricLabel: 'Pendientes hoy',
          metricValue: '12',
          publishedAt: daysAgo(1),
        },
        {
          empresaId,
          employeeId: secondaryEmployee?.id ?? null,
          title: 'Solicitudes de vacaciones',
          category: 'Autoservicio',
          summary: 'Centraliza solicitudes, aprobaciones y trazabilidad de ausencias.',
          audience: 'Líderes y colaboradores',
          actionLabel: 'Revisar solicitudes',
          actionUrl: '/dashboard/contabilidad/nomina/novedades',
          metricLabel: 'En aprobación',
          metricValue: '4',
          publishedAt: daysAgo(3),
        },
        {
          empresaId,
          employeeId: tertiaryEmployee?.id ?? null,
          title: 'Documentos por firmar',
          category: 'Firma y documentos',
          summary: 'Entrega contratos, anexos y políticas con firma electrónica trazable.',
          audience: 'Nuevos ingresos',
          actionLabel: 'Abrir bandeja',
          actionUrl: '/dashboard/contabilidad/nomina/reportes',
          metricLabel: 'Pendientes',
          metricValue: '7',
          publishedAt: daysAgo(2),
          expiresAt: daysFromNow(10),
        },
      ],
    })
  }

  if (!accessCount) {
    await prisma.payrollAccessProfile.createMany({
      data: [
        {
          empresaId,
          userId: primaryUser?.id ?? null,
          employeeId: primaryEmployee?.id ?? null,
          profileName: 'Administrador RR. HH.',
          roleLabel: 'Admin',
          scopeLabel: 'Empresa completa',
          permissions: ['nomina.aprobar', 'people.reportes', 'portal.publicar'],
          lastReviewedAt: daysAgo(5),
          lastAccessAt: daysAgo(1),
        },
        {
          empresaId,
          userId: secondaryUser?.id ?? null,
          employeeId: secondaryEmployee?.id ?? null,
          profileName: 'Líder de área',
          roleLabel: 'Manager',
          scopeLabel: 'Unidad organizacional',
          permissions: ['workflow.aprobar', 'portal.ver', 'reportes.area'],
          lastReviewedAt: daysAgo(7),
          lastAccessAt: daysAgo(2),
        },
        {
          empresaId,
          userId: tertiaryUser?.id ?? null,
          employeeId: tertiaryEmployee?.id ?? null,
          profileName: 'Colaborador autoservicio',
          roleLabel: 'Employee',
          scopeLabel: 'Perfil propio',
          permissions: ['portal.solicitar', 'desprendibles.ver', 'datos.actualizar'],
          lastReviewedAt: daysAgo(9),
          lastAccessAt: daysAgo(1),
        },
      ],
    })
  }

  if (!workflowCount) {
    await prisma.payrollWorkflowTemplate.createMany({
      data: [
        {
          empresaId,
          ownerUserId: primaryUser?.id ?? null,
          ownerEmployeeId: primaryEmployee?.id ?? null,
          name: 'Onboarding 7 días',
          category: 'Onboarding',
          triggerType: 'Nuevo ingreso',
          slaHours: 72,
          automationLevel: 'AUTOMATIC',
          steps: [
            { name: 'Crear usuario', owner: 'TI' },
            { name: 'Asignar documentos', owner: 'RRHH' },
            { name: 'Activar portal', owner: 'Líder' },
          ],
          notes: 'Coordina acceso, firma y primera inducción.',
          lastExecutedAt: daysAgo(2),
        },
        {
          empresaId,
          ownerUserId: secondaryUser?.id ?? null,
          ownerEmployeeId: secondaryEmployee?.id ?? null,
          name: 'Aprobación de vacaciones',
          category: 'Ausencias',
          triggerType: 'Solicitud del colaborador',
          slaHours: 24,
          automationLevel: 'SEMI_AUTOMATIC',
          steps: [
            { name: 'Radicar solicitud', owner: 'Colaborador' },
            { name: 'Aprobar líder', owner: 'Líder' },
            { name: 'Aplicar en nómina', owner: 'Nómina' },
          ],
          notes: 'Descuenta cupo y deja evidencia para cálculo.',
          lastExecutedAt: daysAgo(1),
        },
        {
          empresaId,
          ownerUserId: tertiaryUser?.id ?? null,
          ownerEmployeeId: tertiaryEmployee?.id ?? null,
          name: 'Cambio salarial',
          category: 'Compensación',
          triggerType: 'Aprobación gerencial',
          slaHours: 48,
          automationLevel: 'MANUAL',
          steps: [
            { name: 'Solicitar ajuste', owner: 'Líder' },
            { name: 'Validar presupuesto', owner: 'Finanzas' },
            { name: 'Publicar adenda', owner: 'RRHH' },
          ],
          notes: 'Conecta compensación, firma documental y trazabilidad.',
          lastExecutedAt: daysAgo(8),
        },
      ],
    })
  }

  if (!reportCount) {
    await prisma.payrollPeopleReport.createMany({
      data: [
        {
          empresaId,
          ownerUserId: primaryUser?.id ?? null,
          name: 'Headcount por estructura',
          category: 'Estructura organizacional',
          cadence: 'Semanal',
          audience: 'Dirección',
          metricValue: '18 colaboradores',
          metricTrend: '+2 vs mes anterior',
          filtersSummary: 'Sede, unidad y estado laboral',
          lastGeneratedAt: daysAgo(1),
        },
        {
          empresaId,
          ownerUserId: secondaryUser?.id ?? null,
          name: 'Ausentismo y permisos',
          category: 'Control de asistencia',
          cadence: 'Diario',
          audience: 'Operaciones',
          metricValue: '3.4%',
          metricTrend: '-0.8 pp',
          filtersSummary: 'Vacaciones, licencias e incapacidades',
          lastGeneratedAt: daysAgo(1),
        },
        {
          empresaId,
          ownerUserId: tertiaryUser?.id ?? null,
          name: 'Rotación y permanencia',
          category: 'Desarrollo organizacional',
          cadence: 'Mensual',
          audience: 'People analytics',
          metricValue: '1 retiro / 30 días',
          metricTrend: 'Estable',
          filtersSummary: 'Antigüedad, líder y motivo de salida',
          lastGeneratedAt: daysAgo(6),
        },
      ],
    })
  }
}

export async function getPayrollPeopleOverview(empresaId: string): Promise<PayrollPeopleOverview> {
  await ensurePayrollPeopleDemoData(empresaId)

  const [orgUnits, portalHighlights, accessProfiles, workflowTemplates, reports, activeEmployees, linkedUsers] = await prisma.$transaction([
    prisma.payrollOrgUnit.findMany({
      where: { empresaId },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        parent: { select: { name: true } },
        sede: { select: { nombre: true } },
        managerEmployee: {
          select: { firstName: true, middleName: true, lastName: true, secondLastName: true },
        },
      },
    }),
    prisma.payrollPortalHighlight.findMany({
      where: { empresaId },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        employee: {
          select: { firstName: true, middleName: true, lastName: true, secondLastName: true },
        },
      },
    }),
    prisma.payrollAccessProfile.findMany({
      where: { empresaId },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        user: { select: { name: true, email: true } },
        employee: {
          select: { firstName: true, middleName: true, lastName: true, secondLastName: true },
        },
      },
    }),
    prisma.payrollWorkflowTemplate.findMany({
      where: { empresaId },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        ownerUser: { select: { name: true, email: true } },
        ownerEmployee: {
          select: { firstName: true, middleName: true, lastName: true, secondLastName: true },
        },
      },
    }),
    prisma.payrollPeopleReport.findMany({
      where: { empresaId },
      orderBy: [{ lastGeneratedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        ownerUser: { select: { name: true, email: true } },
      },
    }),
    prisma.payrollEmployee.count({ where: { empresaId, status: PayrollEmployeeStatus.ACTIVE } }),
    prisma.user.count({ where: { empresaId } }),
  ])

  const publishedPortalHighlights = portalHighlights.filter((item) => item.status === 'PUBLISHED').length
  const activeWorkflows = workflowTemplates.filter((item) => item.status === 'ACTIVE').length
  const readyReports = reports.filter((item) => item.status === 'READY').length

  return {
    summary: {
      activeEmployees,
      linkedUsers,
      publishedPortalHighlights,
      activeWorkflows,
      readyReports,
    },
    orgUnits: orgUnits.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      level: item.level,
      status: item.status,
      headcount: item.headcount,
      location: item.location,
      parentName: item.parent?.name ?? null,
      managerName: item.managerEmployee ? buildPayrollEmployeeFullName(item.managerEmployee) : null,
      sede: item.sede?.nombre ?? null,
    })),
    portalHighlights: portalHighlights.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      summary: item.summary,
      status: item.status,
      audience: item.audience,
      actionLabel: item.actionLabel,
      actionUrl: item.actionUrl,
      metricLabel: item.metricLabel,
      metricValue: item.metricValue,
      employeeName: item.employee ? buildPayrollEmployeeFullName(item.employee) : null,
      publishedAt: iso(item.publishedAt),
    })),
    accessProfiles: accessProfiles.map((item) => ({
      id: item.id,
      profileName: item.profileName,
      roleLabel: item.roleLabel,
      scopeLabel: item.scopeLabel,
      status: item.status,
      permissions: Array.isArray(item.permissions) ? item.permissions.filter((permission): permission is string => typeof permission === 'string') : [],
      userName: item.user?.name ?? null,
      userEmail: item.user?.email ?? null,
      employeeName: item.employee ? buildPayrollEmployeeFullName(item.employee) : null,
      lastReviewedAt: iso(item.lastReviewedAt),
      lastAccessAt: iso(item.lastAccessAt),
    })),
    workflowTemplates: workflowTemplates.map((item) => {
      const ownerName = item.ownerEmployee
        ? buildPayrollEmployeeFullName(item.ownerEmployee)
        : item.ownerUser?.name ?? item.ownerUser?.email ?? null
      const stepCount = Array.isArray(item.steps) ? item.steps.length : 0
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        status: item.status,
        triggerType: item.triggerType,
        slaHours: item.slaHours,
        automationLevel: item.automationLevel,
        stepCount,
        ownerName,
        lastExecutedAt: iso(item.lastExecutedAt),
      }
    }),
    reports: reports.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      cadence: item.cadence,
      audience: item.audience,
      status: item.status,
      metricValue: item.metricValue,
      metricTrend: item.metricTrend,
      filtersSummary: item.filtersSummary,
      ownerName: item.ownerUser?.name ?? item.ownerUser?.email ?? null,
      lastGeneratedAt: iso(item.lastGeneratedAt),
    })),
  }
}