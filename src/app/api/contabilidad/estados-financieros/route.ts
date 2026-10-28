import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, type AccountingAccountType } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type Totals = { debit: number; credit: number }

type ReportRow = {
  accountId: string
  code: string
  name: string
  type: AccountingAccountType
  amount: number
}

type TrialBalanceRow = {
  accountId: string
  code: string
  name: string
  type: AccountingAccountType
  debit: number
  credit: number
  balance: number
}

function startOfDayUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function endOfDayUtc(value: string) {
  return new Date(`${value}T23:59:59.999Z`)
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(startOfDayUtc(value).getTime())
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const searchParams = request.nextUrl.searchParams
  const now = new Date()
  const fromParam = (searchParams.get('from') ?? '').trim()
  const toParam = (searchParams.get('to') ?? '').trim()

  if ((fromParam && !isValidIsoDate(fromParam)) || (toParam && !isValidIsoDate(toParam))) {
    return NextResponse.json({ ok: false, error: 'from y to deben tener formato YYYY-MM-DD' }, { status: 400 })
  }

  const fromIso = fromParam || `${now.getUTCFullYear()}-01-01`
  const toIso = toParam || toIsoDate(now)

  if (fromIso > toIso) {
    return NextResponse.json({ ok: false, error: 'from no puede ser posterior a to' }, { status: 400 })
  }

  const fromDate = startOfDayUtc(fromIso)
  const toDate = endOfDayUtc(toIso)

  const [accounts, journalLines, voucherLines] = await Promise.all([
    prisma.accountingAccount.findMany({
      where: { empresaId: access.empresaId },
      orderBy: [{ code: 'asc' }],
      select: { id: true, code: true, name: true, type: true },
    }),
    prisma.accountingJournalLine.findMany({
      where: {
        entry: { empresaId: access.empresaId, status: 'POSTED', date: { lte: toDate } },
      },
      select: { accountId: true, debit: true, credit: true, entry: { select: { date: true } } },
    }),
    prisma.accountingVoucherLine.findMany({
      where: {
        voucher: {
          empresaId: access.empresaId,
          status: { in: ['APPROVED', 'POSTED'] },
          journalEntryId: null,
          date: { lte: toDate },
        },
      },
      select: { accountId: true, debit: true, credit: true, voucher: { select: { date: true } } },
    }),
  ])

  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const balanceTotals = new Map<string, Totals>()
  const periodTotals = new Map<string, Totals>()

  function accumulate(target: Map<string, Totals>, accountId: string, debit: number, credit: number) {
    const current = target.get(accountId) ?? { debit: 0, credit: 0 }
    current.debit += debit ?? 0
    current.credit += credit ?? 0
    target.set(accountId, current)
  }

  for (const line of journalLines) {
    accumulate(balanceTotals, line.accountId, line.debit, line.credit)
    if (line.entry.date >= fromDate) accumulate(periodTotals, line.accountId, line.debit, line.credit)
  }

  for (const line of voucherLines) {
    accumulate(balanceTotals, line.accountId, line.debit, line.credit)
    if (line.voucher.date >= fromDate) accumulate(periodTotals, line.accountId, line.debit, line.credit)
  }

  function buildRows(types: AccountingAccountType[], source: Map<string, Totals>, naturalSide: 'DEBIT' | 'CREDIT') {
    return Array.from(source.entries())
      .map(([accountId, totals]): ReportRow | null => {
        const account = accountsById.get(accountId)
        if (!account || !types.includes(account.type)) return null

        const netDebit = totals.debit - totals.credit
        const amount = naturalSide === 'DEBIT' ? netDebit : -netDebit
        return {
          accountId,
          code: account.code,
          name: account.name,
          type: account.type,
          amount: round(amount),
        }
      })
      .filter((row): row is ReportRow => row !== null && Math.abs(row.amount) >= 0.005)
      .sort((left, right) => left.code.localeCompare(right.code))
  }

  function totalOf(rows: ReportRow[]) {
    return round(rows.reduce((sum, row) => sum + row.amount, 0))
  }

  const trialBalance = Array.from(periodTotals.entries())
    .map(([accountId, totals]): TrialBalanceRow | null => {
      const account = accountsById.get(accountId)
      if (!account) return null

      const debit = round(totals.debit)
      const credit = round(totals.credit)
      if (Math.abs(debit) < 0.005 && Math.abs(credit) < 0.005) return null

      return {
        accountId,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
        balance: round(debit - credit),
      }
    })
    .filter((row): row is TrialBalanceRow => row !== null)
    .sort((left, right) => left.code.localeCompare(right.code))

  const assetRows = buildRows(['ASSET'], balanceTotals, 'DEBIT')
  const liabilityRows = buildRows(['LIABILITY'], balanceTotals, 'CREDIT')
  const equityRows = buildRows(['EQUITY'], balanceTotals, 'CREDIT')
  const accumulatedIncomeRows = buildRows(['INCOME'], balanceTotals, 'CREDIT')
  const accumulatedExpenseRows = buildRows(['EXPENSE'], balanceTotals, 'DEBIT')

  const totalAssets = totalOf(assetRows)
  const totalLiabilities = totalOf(liabilityRows)
  const totalEquity = totalOf(equityRows)
  const accumulatedResult = round(totalOf(accumulatedIncomeRows) - totalOf(accumulatedExpenseRows))
  const totalLiabilitiesAndEquity = round(totalLiabilities + totalEquity + accumulatedResult)
  const difference = round(totalAssets - totalLiabilitiesAndEquity)

  const incomeRows = buildRows(['INCOME'], periodTotals, 'CREDIT')
  const expenseRows = buildRows(['EXPENSE'], periodTotals, 'DEBIT')
  const totalIncome = totalOf(incomeRows)
  const totalExpense = totalOf(expenseRows)
  const periodResult = round(totalIncome - totalExpense)

  const totalDebit = round(Array.from(periodTotals.values()).reduce((sum, totals) => sum + totals.debit, 0))
  const totalCredit = round(Array.from(periodTotals.values()).reduce((sum, totals) => sum + totals.credit, 0))

  return NextResponse.json({
    ok: true,
    data: {
      range: { from: fromIso, to: toIso },
      sources: { journalLines: journalLines.length, voucherLines: voucherLines.length },
      trialBalance,
      trialBalanceTotals: {
        debit: totalDebit,
        credit: totalCredit,
        difference: round(totalDebit - totalCredit),
      },
      balanceSheet: {
        assets: assetRows,
        totalAssets,
        liabilities: liabilityRows,
        totalLiabilities,
        equity: equityRows,
        totalEquity,
        accumulatedResult,
        totalLiabilitiesAndEquity,
        difference,
        balanced: Math.abs(difference) < 0.01,
      },
      incomeStatement: {
        income: incomeRows,
        totalIncome,
        expenses: expenseRows,
        totalExpense,
        result: periodResult,
      },
    },
  })
}
