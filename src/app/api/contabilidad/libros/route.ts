import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type BalanceAccumulator = {
  accountId: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const [journalEntries, vouchers] = await Promise.all([
    prisma.accountingJournalEntry.findMany({
      where: { empresaId: access.empresaId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        date: true,
        description: true,
        eventType: true,
        referenceType: true,
        referenceId: true,
        totalDebit: true,
        totalCredit: true,
        lines: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            debit: true,
            credit: true,
            memo: true,
            account: { select: { id: true, code: true, name: true } },
            costCenter: { select: { id: true, code: true, name: true } },
          },
        },
      },
    }),
    prisma.accountingVoucher.findMany({
      where: {
        empresaId: access.empresaId,
        status: { in: ['APPROVED', 'POSTED'] },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      select: {
        id: true,
        code: true,
        date: true,
        description: true,
        voucherType: true,
        status: true,
        totalDebit: true,
        totalCredit: true,
        journalEntryId: true,
        period: { select: { label: true } },
        lines: {
          orderBy: [{ order: 'asc' }],
          select: {
            id: true,
            debit: true,
            credit: true,
            memo: true,
            thirdPartyName: true,
            thirdPartyDocument: true,
            account: { select: { id: true, code: true, name: true } },
            costCenter: { select: { id: true, code: true, name: true } },
          },
        },
      },
    }),
  ])

  const balanceMap = new Map<string, BalanceAccumulator>()

  const appendBalance = (args: { accountId: string; accountCode: string; accountName: string; debit: number; credit: number }) => {
    const current = balanceMap.get(args.accountId) ?? {
      accountId: args.accountId,
      accountCode: args.accountCode,
      accountName: args.accountName,
      debit: 0,
      credit: 0,
    }
    current.debit += args.debit
    current.credit += args.credit
    balanceMap.set(args.accountId, current)
  }

  for (const entry of journalEntries) {
    for (const line of entry.lines) {
      appendBalance({
        accountId: line.account.id,
        accountCode: line.account.code,
        accountName: line.account.name,
        debit: line.debit,
        credit: line.credit,
      })
    }
  }

  for (const voucher of vouchers) {
    if (voucher.journalEntryId) continue
    for (const line of voucher.lines) {
      appendBalance({
        accountId: line.account.id,
        accountCode: line.account.code,
        accountName: line.account.name,
        debit: line.debit,
        credit: line.credit,
      })
    }
  }

  const balances = Array.from(balanceMap.values())
    .map((item) => ({
      ...item,
      balance: Math.round(item.debit - item.credit),
    }))
    .sort((left, right) => left.accountCode.localeCompare(right.accountCode))

  return NextResponse.json({
    ok: true,
    data: {
      journalEntries: journalEntries.map((entry) => ({
        id: entry.id,
        date: entry.date.toISOString(),
        description: entry.description,
        eventType: entry.eventType,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        totalDebit: entry.totalDebit,
        totalCredit: entry.totalCredit,
        lines: entry.lines.map((line) => ({
          id: line.id,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo,
          accountCode: line.account.code,
          accountName: line.account.name,
          costCenterCode: line.costCenter?.code ?? null,
          costCenterName: line.costCenter?.name ?? null,
        })),
      })),
      vouchers: vouchers.map((voucher) => ({
        id: voucher.id,
        code: voucher.code,
        date: voucher.date.toISOString(),
        description: voucher.description,
        voucherType: voucher.voucherType,
        status: voucher.status,
        periodLabel: voucher.period?.label ?? 'Sin período',
        totalDebit: voucher.totalDebit,
        totalCredit: voucher.totalCredit,
        lines: voucher.lines.map((line) => ({
          id: line.id,
          debit: line.debit,
          credit: line.credit,
          memo: line.memo,
          thirdPartyName: line.thirdPartyName,
          thirdPartyDocument: line.thirdPartyDocument,
          accountCode: line.account.code,
          accountName: line.account.name,
          costCenterCode: line.costCenter?.code ?? null,
          costCenterName: line.costCenter?.name ?? null,
        })),
      })),
      balances,
    },
  })
}
