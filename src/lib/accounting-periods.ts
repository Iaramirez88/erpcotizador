import { buildAccountingRange, type AccountingPeriodRow } from '@/lib/accounting-core'
import { prisma } from '@/lib/prisma'

export async function serializeAccountingPeriods(empresaId: string): Promise<AccountingPeriodRow[]> {
  const rows = await prisma.accountingPeriod.findMany({
    where: { empresaId },
    orderBy: [{ startsAt: 'desc' }],
    include: {
      _count: { select: { vouchers: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    code: item.code,
    label: item.label,
    status: item.status,
    range: buildAccountingRange(item.startsAt, item.endsAt),
    closedAt: item.closedAt?.toISOString() ?? null,
    lockedAt: item.lockedAt?.toISOString() ?? null,
    vouchersCount: item._count.vouchers,
  }))
}
