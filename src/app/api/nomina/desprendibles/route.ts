import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName, type PayrollPayslipRow } from '@/lib/payroll'

export const runtime = 'nodejs'

async function serializePayslips(empresaId: string): Promise<PayrollPayslipRow[]> {
  const rows = await prisma.payrollPayslip.findMany({
    where: { empresaId },
    orderBy: [{ generatedAt: 'desc' }],
    include: {
      employee: { select: { firstName: true, middleName: true, lastName: true, secondLastName: true } },
      period: { select: { label: true, paymentDate: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    employeeName: buildPayrollEmployeeFullName(item.employee),
    periodLabel: item.period.label,
    paymentDate: item.period.paymentDate.toISOString(),
    netPay: item.netTotal,
    signed: Boolean(item.signedAt),
    deliveredBy: item.deliveryChannel,
  }))
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response
  const data = await serializePayslips(access.empresaId)
  return NextResponse.json({ ok: true, data })
}