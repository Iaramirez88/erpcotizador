import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { generateJournalEntryFromRule } from '@/lib/accounting/engine'
import { buildPayrollSettlementAccountingAmounts } from '@/lib/payroll-accounting'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string }> }

export async function POST(_: Request, context: Context) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { id } = await context.params
  const result = await buildPayrollSettlementAccountingAmounts(id)
  if (!result || result.settlement.empresaId !== access.empresaId) {
    return NextResponse.json({ ok: false, error: 'Liquidación no encontrada' }, { status: 404 })
  }

  try {
    const entry = await generateJournalEntryFromRule({
      empresaId: access.empresaId,
      userId: access.userId,
      eventType: 'PAYROLL_SETTLEMENT',
      referenceType: 'PAYROLL_SETTLEMENT',
      referenceId: result.settlement.id,
      date: result.settlement.paymentDate ?? result.settlement.retirementDate,
      description: `Liquidación nómina ${result.settlement.id}`,
      amounts: result.amounts,
    })

    await prisma.payrollSettlement.update({
      where: { id: result.settlement.id },
      data: { accountingStatus: 'CONTABILIZADA' },
    })

    return NextResponse.json({ ok: true, data: { entryId: entry.id } })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'No se pudo contabilizar la liquidación' }, { status: 500 })
  }
}