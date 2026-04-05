import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { generateJournalEntryFromRule } from '@/lib/accounting/engine'
import { buildPayrollPeriodAccountingAmounts } from '@/lib/payroll-accounting'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string }> }

export async function POST(_: Request, context: Context) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { id } = await context.params
  const result = await buildPayrollPeriodAccountingAmounts(id)
  if (!result || result.period.empresaId !== access.empresaId) {
    return NextResponse.json({ ok: false, error: 'Período no encontrado' }, { status: 404 })
  }

  try {
    const entry = await generateJournalEntryFromRule({
      empresaId: access.empresaId,
      userId: access.userId,
      eventType: 'PAYROLL_PERIOD',
      referenceType: 'PAYROLL_PERIOD',
      referenceId: result.period.id,
      date: result.period.paymentDate,
      description: `Causación nómina ${result.period.label}`,
      amounts: result.amounts,
    })

    await prisma.payrollPeriod.update({
      where: { id: result.period.id },
      data: { accountingStatus: 'CONTABILIZADA' },
    })

    return NextResponse.json({ ok: true, data: { entryId: entry.id } })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'No se pudo contabilizar el período' }, { status: 500 })
  }
}