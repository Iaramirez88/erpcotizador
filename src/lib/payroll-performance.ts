import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollPerformanceReviewRow } from '@/lib/payroll'
import { ensurePayrollDemoEmployees } from '@/lib/payroll-operations'

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

export async function ensurePayrollPerformanceDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollPerformanceReview.count({ where: { empresaId } })
  if (count) return

  const [employees, firstUser] = await Promise.all([
    ensurePayrollDemoEmployees(empresaId),
    prisma.user.findFirst({ where: { empresaId }, orderBy: [{ createdAt: 'asc' }], select: { id: true } }),
  ])

  const ownerUserId = userId ?? firstUser?.id ?? null
  const refs = employees.slice(0, 3)

  await prisma.payrollPerformanceReview.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[0]?.id ?? null,
        ownerUserId,
        cycleTitle: 'Cierre semestral 2025',
        reviewType: 'OBJETIVOS',
        status: 'EN_CALIBRACION',
        managerName: 'Liderazgo de nómina',
        competencyFocus: 'Precisión operativa y priorización',
        score: 4.5,
        targetScore: 4.3,
        dueDate: daysFromNow(4),
        summary: 'Supera el objetivo del ciclo y sostiene consistencia en cierres quincenales.',
        developmentPlan: 'Profundizar automatización de novedades y revisión cruzada.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[1]?.id ?? null,
        ownerUserId,
        cycleTitle: 'Pulso líderes Q3',
        reviewType: '360',
        status: 'ABIERTA',
        managerName: 'Gerencia de talento',
        competencyFocus: 'Liderazgo, feedback y coordinación interáreas',
        targetScore: 4.4,
        dueDate: daysFromNow(10),
        summary: 'Ciclo abierto con enfoque en liderazgo de equipo y servicio interno.',
        developmentPlan: 'Consolidar rituales 1:1 y seguimiento mensual de compromisos.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[2]?.id ?? null,
        ownerUserId,
        cycleTitle: 'Revisión periodo de prueba',
        reviewType: '90_DIAS',
        status: 'CERRADA',
        managerName: 'HR Business Partner',
        competencyFocus: 'Apropiación del rol y acompañamiento a líderes',
        score: 4.7,
        targetScore: 4.0,
        dueDate: daysAgo(20),
        completedAt: daysAgo(18),
        summary: 'Evaluación cerrada con resultado sobresaliente y plan de crecimiento validado.',
        developmentPlan: 'Tomar ownership del frente de indicadores de people analytics.',
      },
    ],
  })
}

export async function serializePayrollPerformanceReviews(empresaId: string): Promise<PayrollPerformanceReviewRow[]> {
  const rows = await prisma.payrollPerformanceReview.findMany({
    where: { empresaId },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      employee: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          secondLastName: true,
        },
      },
      ownerUser: { select: { name: true, email: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    employeeName: item.employee ? buildPayrollEmployeeFullName(item.employee) : null,
    ownerName: item.ownerUser?.name ?? item.ownerUser?.email ?? null,
    cycleTitle: item.cycleTitle,
    reviewType: item.reviewType,
    status: item.status,
    managerName: item.managerName,
    competencyFocus: item.competencyFocus,
    score: item.score,
    targetScore: item.targetScore,
    dueDate: iso(item.dueDate),
    completedAt: iso(item.completedAt),
    developmentPlan: item.developmentPlan,
    summary: item.summary,
  }))
}
