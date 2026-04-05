import { PayrollConceptCategory } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function buildPayrollPeriodAccountingAmounts(periodId: string) {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: {
      items: {
        select: {
          employeeSocialSecurityTotal: true,
          employerSocialSecurityTotal: true,
          parafiscalesTotal: true,
          provisionsTotal: true,
        },
      },
    },
  })

  if (!period) return null

  const employeeSecurity = period.items.reduce((sum, item) => sum + item.employeeSocialSecurityTotal, 0)
  const employerSecurity = period.items.reduce((sum, item) => sum + item.employerSocialSecurityTotal, 0)
  const parafiscales = period.items.reduce((sum, item) => sum + item.parafiscalesTotal, 0)
  const provisions = period.items.reduce((sum, item) => sum + item.provisionsTotal, 0)

  const amounts = {
    DEVENGADO: period.grossTotal,
    DEDUCCIONES: period.deductionsTotal,
    NETO_PAGAR: period.netTotal,
    SEGURIDAD_SOCIAL_EMPLEADO: employeeSecurity,
    SEGURIDAD_SOCIAL_EMPRESA: employerSecurity,
    PARAFISCALES: parafiscales || period.parafiscalesTotal,
    PROVISIONES: provisions || period.provisionsTotal,
    TOTAL: period.netTotal,
  }

  return { period, amounts }
}

export async function buildPayrollSettlementAccountingAmounts(settlementId: string) {
  const settlement = await prisma.payrollSettlement.findUnique({
    where: { id: settlementId },
    include: {
      employee: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          secondLastName: true,
        },
      },
      lines: {
        select: { category: true, amount: true },
      },
    },
  })

  if (!settlement) return null

  const devengado = settlement.lines
    .filter((item) => item.category === PayrollConceptCategory.DEVENGO)
    .reduce((sum, item) => sum + item.amount, 0)
  const deducciones = settlement.lines
    .filter((item) => item.category === PayrollConceptCategory.DEDUCCION)
    .reduce((sum, item) => sum + item.amount, 0)
  const provisions = settlement.lines
    .filter((item) => item.category === PayrollConceptCategory.PROVISION)
    .reduce((sum, item) => sum + item.amount, 0)

  const amounts = {
    DEVENGADO: devengado || settlement.total,
    DEDUCCIONES: deducciones,
    NETO_PAGAR: settlement.total,
    PROVISIONES: provisions,
    TOTAL: settlement.total,
  }

  return { settlement, amounts }
}