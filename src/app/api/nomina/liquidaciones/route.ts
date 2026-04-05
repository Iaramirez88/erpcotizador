import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollSettlementRow } from '@/lib/payroll'

export const runtime = 'nodejs'

async function serializeSettlements(empresaId: string): Promise<PayrollSettlementRow[]> {
  const rows = await prisma.payrollSettlement.findMany({
    where: { empresaId },
    orderBy: [{ retirementDate: 'desc' }],
    include: {
      employee: { select: { firstName: true, middleName: true, lastName: true, secondLastName: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    employeeName: buildPayrollEmployeeFullName(item.employee),
    reason: item.reason,
    retirementDate: item.retirementDate.toISOString(),
    workedDays: item.workedDays,
    total: item.total,
    status: item.status,
    accountingStatus: item.accountingStatus,
  }))
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response
  const data = await serializeSettlements(access.empresaId)
  return NextResponse.json({ ok: true, data })
}