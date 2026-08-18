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

function parseMetadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function parseChartSeries(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ label: string; target: number; actual: number }>
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const point = item as Record<string, unknown>
    const label = typeof point.label === 'string' ? point.label : ''
    const target = Number(point.target)
    const actual = Number(point.actual)
    if (!label || !Number.isFinite(target) || !Number.isFinite(actual)) return []
    return [{ label, target, actual }]
  })
}

function calculateGoalProgress(args: { salesTargetAmount: number | null; salesAchievedAmount: number | null; salesTargetDeals: number | null; salesAchievedDeals: number | null }) {
  const percentages = [
    args.salesTargetAmount && args.salesTargetAmount > 0 && args.salesAchievedAmount != null
      ? (args.salesAchievedAmount / args.salesTargetAmount) * 100
      : null,
    args.salesTargetDeals && args.salesTargetDeals > 0 && args.salesAchievedDeals != null
      ? (args.salesAchievedDeals / args.salesTargetDeals) * 100
      : null,
  ].filter((value): value is number => value != null && Number.isFinite(value))

  if (!percentages.length) return null
  return Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 10) / 10
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
        metadata: {
          salesTargetAmount: 85000000,
          salesAchievedAmount: 91200000,
          salesTargetDeals: 28,
          salesAchievedDeals: 31,
          chartSeries: [
            { label: 'Semana 1', target: 20000000, actual: 21800000 },
            { label: 'Semana 2', target: 21000000, actual: 22700000 },
            { label: 'Semana 3', target: 22000000, actual: 23600000 },
            { label: 'Semana 4', target: 22000000, actual: 23100000 },
          ],
        },
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
        metadata: {
          salesTargetAmount: 73000000,
          salesAchievedAmount: 48100000,
          salesTargetDeals: 22,
          salesAchievedDeals: 14,
          chartSeries: [
            { label: 'Semana 1', target: 18000000, actual: 9500000 },
            { label: 'Semana 2', target: 18000000, actual: 11000000 },
            { label: 'Semana 3', target: 19000000, actual: 12600000 },
            { label: 'Semana 4', target: 18000000, actual: 15000000 },
          ],
        },
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
        metadata: {
          salesTargetAmount: 48000000,
          salesAchievedAmount: 52000000,
          salesTargetDeals: 18,
          salesAchievedDeals: 21,
          chartSeries: [
            { label: 'Mes 1', target: 24000000, actual: 25500000 },
            { label: 'Mes 2', target: 24000000, actual: 26500000 },
          ],
        },
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
    ...(() => {
      const metadata = parseMetadata(item.metadata)
      const salesTargetAmount = Number(metadata.salesTargetAmount)
      const salesAchievedAmount = Number(metadata.salesAchievedAmount)
      const salesTargetDeals = Number(metadata.salesTargetDeals)
      const salesAchievedDeals = Number(metadata.salesAchievedDeals)
      return {
        salesTargetAmount: Number.isFinite(salesTargetAmount) ? salesTargetAmount : null,
        salesAchievedAmount: Number.isFinite(salesAchievedAmount) ? salesAchievedAmount : null,
        salesTargetDeals: Number.isFinite(salesTargetDeals) ? salesTargetDeals : null,
        salesAchievedDeals: Number.isFinite(salesAchievedDeals) ? salesAchievedDeals : null,
        goalProgressPercent: calculateGoalProgress({
          salesTargetAmount: Number.isFinite(salesTargetAmount) ? salesTargetAmount : null,
          salesAchievedAmount: Number.isFinite(salesAchievedAmount) ? salesAchievedAmount : null,
          salesTargetDeals: Number.isFinite(salesTargetDeals) ? salesTargetDeals : null,
          salesAchievedDeals: Number.isFinite(salesAchievedDeals) ? salesAchievedDeals : null,
        }),
        chartSeries: parseChartSeries(metadata.chartSeries),
      }
    })(),
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
