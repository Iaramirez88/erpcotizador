import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollEmployeeDocumentRow } from '@/lib/payroll'
import { ensurePayrollDemoEmployees } from '@/lib/payroll-operations'

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function parseMetadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export async function ensurePayrollDocumentDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollEmployeeDocument.count({ where: { empresaId } })
  if (count) return

  const [employees, firstPeriod] = await Promise.all([
    ensurePayrollDemoEmployees(empresaId),
    prisma.payrollPeriod.findFirst({ where: { empresaId }, orderBy: [{ createdAt: 'asc' }], select: { id: true } }),
  ])

  if (!employees.length) return

  const refs = employees.slice(0, 3)

  await prisma.payrollEmployeeDocument.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[0].id,
        periodId: firstPeriod?.id ?? null,
        title: 'Desprendible de nómina junio',
        category: 'PAGO',
        documentType: 'DESPRENDIBLE',
        status: 'ENTREGADO',
        signatureRequired: true,
        signatureStatus: 'FIRMADA',
        visibleInPortal: true,
        deliveryChannel: 'PORTAL',
        fileFormat: 'PDF',
        requestedAt: daysAgo(12),
        deliveredAt: daysAgo(11),
        signedAt: daysAgo(10),
        signedById: userId ?? null,
        notes: 'Documento firmado desde portal del colaborador.',
        metadata: {
          legalFormName: 'Desprendible legal de nómina',
          signatureMode: 'PLATAFORMA',
          signableInPlatform: true,
          hrApprovalStatus: 'APROBADA',
          hrApproverName: 'Coordinación RRHH',
          hrApprovedAt: daysAgo(11).toISOString(),
          directorApprovalStatus: 'APROBADA',
          directorApproverName: 'Dirección administrativa',
          directorApprovedAt: daysAgo(11).toISOString(),
          approvalStatus: 'COMPLETA',
          formSummary: 'Aceptación de desprendible con conformidad digital del colaborador.',
        },
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[1]?.id ?? refs[0].id,
        periodId: firstPeriod?.id ?? null,
        title: 'Otrosí de actualización salarial',
        category: 'CONTRATO',
        documentType: 'OTROSI',
        status: 'ENVIADO',
        signatureRequired: true,
        signatureStatus: 'ENVIADA',
        visibleInPortal: true,
        deliveryChannel: 'EMAIL',
        fileFormat: 'PDF',
        requestedAt: daysAgo(6),
        deliveredAt: daysAgo(5),
        expiresAt: daysAgo(-2),
        notes: 'Pendiente de firma electrónica por parte del colaborador.',
        metadata: {
          legalFormName: 'Otrosí contractual',
          signatureMode: 'PLATAFORMA',
          signableInPlatform: true,
          hrApprovalStatus: 'APROBADA',
          hrApproverName: 'Business Partner RRHH',
          hrApprovedAt: daysAgo(5).toISOString(),
          directorApprovalStatus: 'PENDIENTE',
          directorApproverName: 'Dirección general',
          approvalStatus: 'EN_APROBACION',
          formSummary: 'Ajuste salarial con aprobación previa de RRHH y visto bueno de dirección.',
        },
      },
      {
        id: randomUUID(),
        empresaId,
        employeeId: refs[2]?.id ?? refs[0].id,
        periodId: null,
        title: 'Política interna de tratamiento de datos',
        category: 'POLITICA',
        documentType: 'POLITICA',
        status: 'BORRADOR',
        signatureRequired: false,
        signatureStatus: 'NO_REQUIERE',
        visibleInPortal: true,
        deliveryChannel: 'PORTAL',
        fileFormat: 'PDF',
        requestedAt: daysAgo(1),
        notes: 'Pendiente de publicación al portal del colaborador.',
        metadata: {
          legalFormName: 'Política de tratamiento de datos',
          signatureMode: 'CHECKBOX',
          signableInPlatform: true,
          hrApprovalStatus: 'BORRADOR',
          directorApprovalStatus: 'BORRADOR',
          approvalStatus: 'BORRADOR',
          formSummary: 'Lectura obligatoria y aceptación digital para publicación interna.',
        },
      },
    ],
  })
}

export async function serializePayrollDocuments(empresaId: string): Promise<PayrollEmployeeDocumentRow[]> {
  const rows = await prisma.payrollEmployeeDocument.findMany({
    where: { empresaId },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      employee: { select: { firstName: true, middleName: true, lastName: true, secondLastName: true } },
      period: { select: { label: true } },
    },
  })

  return rows.map((item) => ({
    ...(() => {
      const metadata = parseMetadata(item.metadata)
      return {
        legalFormName: typeof metadata.legalFormName === 'string' ? metadata.legalFormName : null,
        signatureMode: typeof metadata.signatureMode === 'string' ? metadata.signatureMode : 'PLATAFORMA',
        signableInPlatform: typeof metadata.signableInPlatform === 'boolean' ? metadata.signableInPlatform : true,
        hrApprovalStatus: typeof metadata.hrApprovalStatus === 'string' ? metadata.hrApprovalStatus : 'PENDIENTE',
        hrApproverName: typeof metadata.hrApproverName === 'string' ? metadata.hrApproverName : null,
        hrApprovedAt: typeof metadata.hrApprovedAt === 'string' ? metadata.hrApprovedAt : null,
        directorApprovalStatus: typeof metadata.directorApprovalStatus === 'string' ? metadata.directorApprovalStatus : 'PENDIENTE',
        directorApproverName: typeof metadata.directorApproverName === 'string' ? metadata.directorApproverName : null,
        directorApprovedAt: typeof metadata.directorApprovedAt === 'string' ? metadata.directorApprovedAt : null,
        approvalStatus: typeof metadata.approvalStatus === 'string' ? metadata.approvalStatus : 'PENDIENTE',
        formSummary: typeof metadata.formSummary === 'string' ? metadata.formSummary : null,
      }
    })(),
    id: item.id,
    employeeId: item.employeeId,
    periodId: item.periodId ?? null,
    employeeName: buildPayrollEmployeeFullName(item.employee),
    periodLabel: item.period?.label ?? 'Sin período',
    title: item.title,
    category: item.category,
    documentType: item.documentType,
    status: item.status,
    signatureRequired: item.signatureRequired,
    signatureStatus: item.signatureStatus,
    visibleInPortal: item.visibleInPortal,
    deliveryChannel: item.deliveryChannel,
    fileFormat: item.fileFormat,
    requestedAt: iso(item.requestedAt),
    deliveredAt: iso(item.deliveredAt),
    signedAt: iso(item.signedAt),
    expiresAt: iso(item.expiresAt),
    notes: item.notes ?? null,
  }))
}