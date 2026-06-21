import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollTrainingAssignmentRow } from '@/lib/payroll'
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

export async function ensurePayrollTrainingDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollTrainingAssignment.count({ where: { empresaId } })
  if (count) return

  const [employees, firstUser] = await Promise.all([
    ensurePayrollDemoEmployees(empresaId),
    prisma.user.findFirst({ where: { empresaId }, orderBy: [{ createdAt: 'asc' }], select: { id: true } }),
  ])

  const ownerUserId = userId ?? firstUser?.id ?? null
  const refs = employees.slice(0, 3)

  await prisma.payrollTrainingAssignment.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[0]?.id ?? null,
        ownerUserId,
        title: 'Actualización tributaria aplicada a nómina 2025',
        category: 'NOMINA',
        status: 'EN_CURSO',
        modality: 'VIRTUAL',
        provider: 'SGDigital Academy',
        durationHours: 6,
        dueDate: daysFromNow(5),
        summary: 'Refuerzo sobre cambios normativos y su impacto en el cálculo del cierre.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[1]?.id ?? null,
        ownerUserId,
        title: 'Escuela de liderazgo para servicio interno',
        category: 'LIDERAZGO',
        status: 'PLANIFICADA',
        modality: 'PRESENCIAL',
        provider: 'Talento y Cultura',
        durationHours: 8,
        dueDate: daysFromNow(12),
        summary: 'Sesión orientada a feedback, rituales de seguimiento y acuerdos de servicio.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[2]?.id ?? null,
        ownerUserId,
        title: 'People analytics para business partners',
        category: 'ANALITICA',
        status: 'COMPLETADA',
        modality: 'VIRTUAL',
        provider: 'Buk reference lab',
        durationHours: 10,
        dueDate: daysAgo(15),
        completedAt: daysAgo(10),
        score: 4.8,
        certificateUrl: 'https://example.com/certificados/people-analytics',
        summary: 'Curso cerrado con aplicación a dashboards de clima, desempeño y rotación.',
      },
    ],
  })
}

export async function serializePayrollTrainingAssignments(empresaId: string): Promise<PayrollTrainingAssignmentRow[]> {
  const rows = await prisma.payrollTrainingAssignment.findMany({
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
    title: item.title,
    category: item.category,
    status: item.status,
    modality: item.modality,
    provider: item.provider,
    durationHours: item.durationHours,
    dueDate: iso(item.dueDate),
    completedAt: iso(item.completedAt),
    score: item.score,
    certificateUrl: item.certificateUrl,
    summary: item.summary,
  }))
}
