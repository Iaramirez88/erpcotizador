import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollOnboardingJourneyRow } from '@/lib/payroll'
import { ensurePayrollDemoEmployees } from '@/lib/payroll-operations'
import { ensurePayrollPeopleDemoData } from '@/lib/payroll-people'

type ChecklistItem = PayrollOnboardingJourneyRow['checklist'][number]

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return []
  const rows: Array<ChecklistItem | null> = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const source = item as Record<string, unknown>
      const title = typeof source.title === 'string' ? source.title.trim() : ''
      const owner = typeof source.owner === 'string' ? source.owner.trim() : ''
      const status = typeof source.status === 'string' ? source.status.trim() : ''
      const dueLabel = typeof source.dueLabel === 'string' ? source.dueLabel.trim() : ''
      if (!title || !owner || !status) return null
      return {
        id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `step-${index + 1}`,
        title,
        owner,
        status,
        dueLabel: dueLabel || null,
      }
    })
  return rows.filter((item): item is ChecklistItem => item !== null)
}

function buildProgress(checklist: ChecklistItem[]) {
  if (!checklist.length) return 0
  const done = checklist.filter((item) => item.status === 'COMPLETADA').length
  return Math.round((done / checklist.length) * 100)
}

export function defaultChecklist(phase: string): ChecklistItem[] {
  if (phase === 'HABILITACION') {
    return [
      { id: 'step-1', title: 'Activar usuario y MFA', owner: 'TI', status: 'EN_CURSO', dueLabel: 'Hoy' },
      { id: 'step-2', title: 'Asignar portal y accesos base', owner: 'RRHH', status: 'PENDIENTE', dueLabel: 'Hoy' },
      { id: 'step-3', title: 'Validar firma de documentos', owner: 'Líder', status: 'PENDIENTE', dueLabel: 'Hoy' },
    ]
  }

  if (phase === 'DIA_1') {
    return [
      { id: 'step-1', title: 'Entregar kit de ingreso', owner: 'RRHH', status: 'COMPLETADA', dueLabel: '08:00' },
      { id: 'step-2', title: 'Inducción operativa', owner: 'Líder', status: 'EN_CURSO', dueLabel: '11:00' },
      { id: 'step-3', title: 'Recorrido de políticas y seguridad', owner: 'SST', status: 'PENDIENTE', dueLabel: '15:00' },
    ]
  }

  return [
    { id: 'step-1', title: 'Crear usuario corporativo', owner: 'TI', status: 'COMPLETADA', dueLabel: 'Día -3' },
    { id: 'step-2', title: 'Asignar documentos para firma', owner: 'RRHH', status: 'EN_CURSO', dueLabel: 'Día -2' },
    { id: 'step-3', title: 'Enviar bienvenida y agenda', owner: 'Líder', status: 'PENDIENTE', dueLabel: 'Día -1' },
  ]
}

export async function ensurePayrollOnboardingDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollOnboardingJourney.count({ where: { empresaId } })
  if (count) return

  await ensurePayrollPeopleDemoData(empresaId)

  const [employees, firstPeriod, onboardingWorkflow, firstUser] = await Promise.all([
    ensurePayrollDemoEmployees(empresaId),
    prisma.payrollPeriod.findFirst({ where: { empresaId }, orderBy: [{ startsAt: 'desc' }], select: { id: true } }),
    prisma.payrollWorkflowTemplate.findFirst({
      where: { empresaId, category: 'Onboarding' },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.user.findFirst({ where: { empresaId }, orderBy: [{ createdAt: 'asc' }], select: { id: true } }),
  ])

  if (!employees.length) return

  const ownerUserId = userId ?? firstUser?.id ?? null
  const refs = employees.slice(0, 3)

  await prisma.payrollOnboardingJourney.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[0].id,
        periodId: firstPeriod?.id ?? null,
        workflowTemplateId: onboardingWorkflow?.id ?? null,
        ownerUserId,
        title: 'Ingreso analista de nómina',
        status: 'EN_CURSO',
        phase: 'PRE_INGRESO',
        progress: buildProgress(defaultChecklist('PRE_INGRESO')),
        employeeRole: refs[0].jobTitle,
        locationLabel: 'Corporativo',
        welcomeMessage: 'Preparar acceso, documentos y agenda para el primer día.',
        checklist: defaultChecklist('PRE_INGRESO'),
        startDate: daysAgo(2),
        targetDate: daysFromNow(1),
        notes: 'Depende de firma de política de tratamiento de datos.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[1]?.id ?? refs[0].id,
        periodId: firstPeriod?.id ?? null,
        workflowTemplateId: onboardingWorkflow?.id ?? null,
        ownerUserId,
        title: 'Primer día coordinación de talento',
        status: 'PLANIFICADO',
        phase: 'DIA_1',
        progress: buildProgress(defaultChecklist('DIA_1')),
        employeeRole: refs[1]?.jobTitle ?? refs[0].jobTitle,
        locationLabel: 'Híbrido',
        welcomeMessage: 'Confirmar inducción, jefe directo y activos entregados.',
        checklist: defaultChecklist('DIA_1'),
        startDate: new Date(),
        targetDate: daysFromNow(2),
        notes: 'Pendiente confirmación de portátil de dotaciones.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[2]?.id ?? refs[0].id,
        periodId: firstPeriod?.id ?? null,
        workflowTemplateId: onboardingWorkflow?.id ?? null,
        ownerUserId,
        title: 'Habilitación portal business partner',
        status: 'COMPLETADO',
        phase: 'HABILITACION',
        progress: 100,
        employeeRole: refs[2]?.jobTitle ?? refs[0].jobTitle,
        locationLabel: 'Remoto',
        welcomeMessage: 'Journey cerrado con portal activo y documentos firmados.',
        checklist: [
          { id: 'step-1', title: 'Activar usuario y MFA', owner: 'TI', status: 'COMPLETADA', dueLabel: 'Ok' },
          { id: 'step-2', title: 'Asignar portal y accesos base', owner: 'RRHH', status: 'COMPLETADA', dueLabel: 'Ok' },
          { id: 'step-3', title: 'Validar firma de documentos', owner: 'Líder', status: 'COMPLETADA', dueLabel: 'Ok' },
        ],
        startDate: daysAgo(8),
        targetDate: daysAgo(4),
        completedAt: daysAgo(3),
        notes: 'Quedó listo para autoservicio y reportería.',
      },
    ],
  })
}

export async function serializePayrollOnboardingJourneys(empresaId: string): Promise<PayrollOnboardingJourneyRow[]> {
  const rows = await prisma.payrollOnboardingJourney.findMany({
    where: { empresaId },
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          secondLastName: true,
        },
      },
      period: { select: { id: true, label: true } },
      workflowTemplate: {
        select: {
          id: true,
          name: true,
          ownerUser: { select: { name: true, email: true } },
          ownerEmployee: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
              secondLastName: true,
            },
          },
        },
      },
      ownerUser: { select: { name: true, email: true } },
    },
  })

  return rows.map((item) => {
    const checklist = parseChecklist(item.checklist)
    const workflowOwner = item.workflowTemplate?.ownerEmployee
      ? buildPayrollEmployeeFullName(item.workflowTemplate.ownerEmployee)
      : item.workflowTemplate?.ownerUser?.name ?? item.workflowTemplate?.ownerUser?.email ?? null

    return {
      id: item.id,
      employeeId: item.employeeId,
      employeeName: buildPayrollEmployeeFullName(item.employee),
      periodId: item.periodId,
      workflowTemplateId: item.workflowTemplateId,
      workflowTemplateName: item.workflowTemplate?.name ?? null,
      ownerName: item.ownerUser?.name ?? item.ownerUser?.email ?? workflowOwner,
      title: item.title,
      status: item.status,
      phase: item.phase,
      progress: checklist.length ? buildProgress(checklist) : item.progress,
      employeeRole: item.employeeRole,
      locationLabel: item.locationLabel,
      welcomeMessage: item.welcomeMessage,
      checklist,
      startDate: item.startDate.toISOString(),
      targetDate: iso(item.targetDate),
      completedAt: iso(item.completedAt),
      notes: item.notes,
    }
  })
}
