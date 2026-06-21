import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollEmployeeServiceCaseRow } from '@/lib/payroll'
import { ensurePayrollDemoEmployees } from '@/lib/payroll-operations'
import { ensurePayrollPeopleDemoData } from '@/lib/payroll-people'

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export async function ensurePayrollServiceCaseDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollEmployeeServiceCase.count({ where: { empresaId } })
  if (count) return

  await ensurePayrollPeopleDemoData(empresaId)

  const [employees, firstPeriod, firstUser] = await Promise.all([
    ensurePayrollDemoEmployees(empresaId),
    prisma.payrollPeriod.findFirst({ where: { empresaId }, orderBy: [{ startsAt: 'desc' }], select: { id: true } }),
    prisma.user.findFirst({ where: { empresaId }, orderBy: [{ createdAt: 'asc' }], select: { id: true } }),
  ])

  if (!employees.length) return

  const assigneeId = userId ?? firstUser?.id ?? null
  const refs = employees.slice(0, 3)

  await prisma.payrollEmployeeServiceCase.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[0].id,
        periodId: firstPeriod?.id ?? null,
        assignedToUserId: assigneeId,
        title: 'Certificado laboral con salario',
        category: 'CERTIFICADOS',
        channel: 'PORTAL',
        priority: 'MEDIA',
        status: 'ABIERTO',
        portalVisibility: true,
        employeeRole: refs[0].jobTitle,
        summary: 'El colaborador necesita certificado laboral dirigido a entidad financiera con salario actual.',
        slaHours: 8,
        requestedAt: daysAgo(1),
        notes: 'Adjuntar fecha de expedición y firma digital.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[1]?.id ?? refs[0].id,
        periodId: firstPeriod?.id ?? null,
        assignedToUserId: assigneeId,
        title: 'Actualización de datos bancarios',
        category: 'DATOS',
        channel: 'EMAIL',
        priority: 'ALTA',
        status: 'EN_GESTION',
        portalVisibility: true,
        employeeRole: refs[1]?.jobTitle ?? refs[0].jobTitle,
        summary: 'Solicita cambiar cuenta de nómina antes del siguiente pago y validar soportes adjuntos.',
        slaHours: 4,
        requestedAt: daysAgo(2),
        firstResponseAt: daysAgo(1),
        notes: 'Pendiente confirmación de certificación bancaria.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[2]?.id ?? refs[0].id,
        periodId: firstPeriod?.id ?? null,
        assignedToUserId: assigneeId,
        resolvedByUserId: assigneeId,
        title: 'Acceso al portal del colaborador',
        category: 'ACCESOS',
        channel: 'WHATSAPP',
        priority: 'MEDIA',
        status: 'RESUELTO',
        portalVisibility: true,
        employeeRole: refs[2]?.jobTitle ?? refs[0].jobTitle,
        summary: 'El colaborador no podía descargar desprendibles desde el portal y reportó error de acceso.',
        resolution: 'Se reinició acceso, se validó MFA y quedó confirmada la descarga desde el portal.',
        slaHours: 12,
        requestedAt: daysAgo(5),
        firstResponseAt: daysAgo(4),
        resolvedAt: daysAgo(3),
        notes: 'Cierre confirmado por el colaborador.',
      },
    ],
  })
}

export async function serializePayrollServiceCases(empresaId: string): Promise<PayrollEmployeeServiceCaseRow[]> {
  const rows = await prisma.payrollEmployeeServiceCase.findMany({
    where: { empresaId },
    orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      employee: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          secondLastName: true,
        },
      },
      period: { select: { label: true } },
      assignedToUser: { select: { name: true, email: true } },
      resolvedByUser: { select: { name: true, email: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    employeeName: buildPayrollEmployeeFullName(item.employee),
    periodId: item.periodId,
    periodLabel: item.period?.label ?? 'Sin período',
    assignedToName: item.assignedToUser?.name ?? item.assignedToUser?.email ?? null,
    resolvedByName: item.resolvedByUser?.name ?? item.resolvedByUser?.email ?? null,
    title: item.title,
    category: item.category,
    channel: item.channel,
    priority: item.priority,
    status: item.status,
    portalVisibility: item.portalVisibility,
    employeeRole: item.employeeRole,
    summary: item.summary,
    resolution: item.resolution,
    slaHours: item.slaHours,
    requestedAt: item.requestedAt.toISOString(),
    firstResponseAt: iso(item.firstResponseAt),
    resolvedAt: iso(item.resolvedAt),
    notes: item.notes,
  }))
}
