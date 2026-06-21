import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollWhistleblowerCaseRow } from '@/lib/payroll'
import { ensurePayrollDemoEmployees } from '@/lib/payroll-operations'
import { ensurePayrollPeopleDemoData } from '@/lib/payroll-people'

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export async function ensurePayrollWhistleblowerDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollWhistleblowerCase.count({ where: { empresaId } })
  if (count) return

  await ensurePayrollPeopleDemoData(empresaId)

  const [employees, firstUser] = await Promise.all([
    ensurePayrollDemoEmployees(empresaId),
    prisma.user.findFirst({ where: { empresaId }, orderBy: [{ createdAt: 'asc' }], select: { id: true } }),
  ])

  const assigneeId = userId ?? firstUser?.id ?? null
  const refs = employees.slice(0, 3)

  await prisma.payrollWhistleblowerCase.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[0]?.id ?? null,
        assignedToUserId: assigneeId,
        title: 'Reporte de acoso laboral en coordinación operativa',
        category: 'ACOSO',
        severity: 'ALTA',
        status: 'RECIBIDA',
        anonymousReport: false,
        confidentialityLevel: 'ALTA',
        reportedChannel: 'PORTAL',
        reporterName: refs[0] ? buildPayrollEmployeeFullName(refs[0]) : 'Colaborador',
        reporterRole: refs[0]?.jobTitle ?? null,
        accusedArea: 'Operaciones de nómina',
        occurredAt: daysAgo(3),
        summary: 'Se reportan conductas reiteradas de hostigamiento verbal durante seguimiento de cierres de nómina.',
        evidenceSummary: 'Capturas de mensajes y fechas de reuniones afectadas.',
        followUpRequired: true,
        notes: 'Escalar a RRHH y comité de convivencia.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: null,
        assignedToUserId: assigneeId,
        title: 'Posible conflicto de interés en aprobación de beneficios',
        category: 'ETICA',
        severity: 'MEDIA',
        status: 'INVESTIGACION',
        anonymousReport: true,
        confidentialityLevel: 'CRITICA',
        reportedChannel: 'FORMULARIO',
        reporterName: null,
        reporterEmail: null,
        reporterRole: 'Anónimo',
        accusedArea: 'Beneficios y compensación',
        occurredAt: daysAgo(6),
        summary: 'Se alerta sobre decisiones de aprobación favoreciendo solicitudes vinculadas a un mismo líder.',
        evidenceSummary: 'Señalamiento de patrones en aprobaciones del último ciclo.',
        firstResponseAt: daysAgo(5),
        followUpRequired: true,
        notes: 'Restringir visibilidad solo al equipo investigador.',
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[2]?.id ?? null,
        assignedToUserId: assigneeId,
        resolvedByUserId: assigneeId,
        title: 'Uso indebido de datos personales en desprendibles',
        category: 'DATOS',
        severity: 'ALTA',
        status: 'RESUELTA',
        anonymousReport: false,
        confidentialityLevel: 'ALTA',
        reportedChannel: 'EMAIL',
        reporterName: refs[2] ? buildPayrollEmployeeFullName(refs[2]) : 'Colaborador',
        reporterEmail: null,
        reporterRole: refs[2]?.jobTitle ?? null,
        accusedArea: 'Portal del colaborador',
        occurredAt: daysAgo(10),
        summary: 'Se evidenció exposición accidental de archivos PDF a un destinatario equivocado.',
        evidenceSummary: 'Captura del correo recibido y hora del evento.',
        resolution: 'Se revocó acceso, se notificó incidente y se ajustó la validación del destinatario en el flujo.',
        firstResponseAt: daysAgo(9),
        resolvedAt: daysAgo(7),
        followUpRequired: false,
        notes: 'Caso cerrado con plan de mejora aplicado.',
      },
    ],
  })
}

export async function serializePayrollWhistleblowerCases(empresaId: string): Promise<PayrollWhistleblowerCaseRow[]> {
  const rows = await prisma.payrollWhistleblowerCase.findMany({
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
      assignedToUser: { select: { name: true, email: true } },
      resolvedByUser: { select: { name: true, email: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    employeeName: item.employee ? buildPayrollEmployeeFullName(item.employee) : null,
    assignedToName: item.assignedToUser?.name ?? item.assignedToUser?.email ?? null,
    resolvedByName: item.resolvedByUser?.name ?? item.resolvedByUser?.email ?? null,
    title: item.title,
    category: item.category,
    severity: item.severity,
    status: item.status,
    anonymousReport: item.anonymousReport,
    confidentialityLevel: item.confidentialityLevel,
    reportedChannel: item.reportedChannel,
    reporterName: item.reporterName,
    reporterEmail: item.reporterEmail,
    reporterRole: item.reporterRole,
    accusedArea: item.accusedArea,
    occurredAt: iso(item.occurredAt),
    summary: item.summary,
    evidenceSummary: item.evidenceSummary,
    resolution: item.resolution,
    followUpRequired: item.followUpRequired,
    firstResponseAt: iso(item.firstResponseAt),
    resolvedAt: iso(item.resolvedAt),
    notes: item.notes,
  }))
}
