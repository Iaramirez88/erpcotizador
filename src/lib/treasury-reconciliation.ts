import { prisma } from '@/lib/prisma'

export const MAX_PENDING_ITEMS = 50
export const MAX_HISTORY_ITEMS = 5

export type ReconciliationAccountStatus = 'SIN_CUENTA_CONTABLE' | 'CONCILIADA' | 'CON_DIFERENCIAS'

export type LedgerItem = {
  id: string
  date: string
  description: string
  amount: number
  source: 'ASIENTO' | 'COMPROBANTE'
  code: string | null
}

export type PendingMovement = {
  id: string
  date: string
  description: string
  amount: number
}

export type ReconciliationHistoryItem = {
  id: string
  asOf: string
  status: string
  bankBalance: number
  ledgerBalance: number
  difference: number
  movementsCount: number
  pendingMovements: number
  pendingEntries: number
  notes: string | null
  closedByName: string | null
  createdAt: string
}

export type ReconciliationAccountReport = {
  id: string
  name: string
  bankName: string | null
  accountNumber: string | null
  currency: string
  isActive: boolean
  accountingAccountId: string | null
  bankBalance: number
  ledgerBalance: number
  difference: number
  movementsCount: number
  reconciledMovementsCount: number
  movementsWithoutEntryTotal: number
  pendingMovements: PendingMovement[]
  pendingEntriesTotal: number
  pendingEntries: LedgerItem[]
  status: ReconciliationAccountStatus
  reconciliations: ReconciliationHistoryItem[]
}

export type ReconciliationTotals = {
  bankBalance: number
  ledgerBalance: number
  difference: number
  pendingMovements: number
  pendingEntries: number
  reconciledAccounts: number
}

export type ReconciliationReport = {
  asOf: string
  accounts: ReconciliationAccountReport[]
  totals: ReconciliationTotals
}

export type ReconciliationHistoryRow = {
  id: string
  asOf: Date
  status: string
  bankBalance: number
  ledgerBalance: number
  difference: number
  movementsCount: number
  pendingMovements: number
  pendingEntries: number
  notes: string | null
  createdAt: Date
  closedBy: { name: string | null; email: string | null } | null
}

/** Campos del cierre de conciliación que consume el reporte y la API. */
export const RECONCILIATION_HISTORY_SELECT = {
  id: true,
  asOf: true,
  status: true,
  bankBalance: true,
  ledgerBalance: true,
  difference: true,
  movementsCount: true,
  pendingMovements: true,
  pendingEntries: true,
  notes: true,
  createdAt: true,
  closedBy: { select: { name: true, email: true } },
} as const


export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
}

export function endOfDayUtc(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999Z`)
}

export function startOfDayUtc(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`)
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function mapHistoryItem(row: ReconciliationHistoryRow): ReconciliationHistoryItem {
  return {
    id: row.id,
    asOf: row.asOf.toISOString(),
    status: row.status,
    bankBalance: roundMoney(row.bankBalance),
    ledgerBalance: roundMoney(row.ledgerBalance),
    difference: roundMoney(row.difference),
    movementsCount: row.movementsCount,
    pendingMovements: row.pendingMovements,
    pendingEntries: row.pendingEntries,
    notes: row.notes,
    closedByName: row.closedBy?.name || row.closedBy?.email || null,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * Normaliza el historial de cierres de una cuenta.
 *
 * Recibe la firma estructural (`ReconciliationHistoryRow[]`) en vez del payload
 * de Prisma: si el generador del cliente degrada el tipo del `select` anidado,
 * en lugar de fallar con `Property 'map' does not exist on type 'never'` el
 * arreglo se sigue pudiendo mapear.
 */
function mapHistoryItems(rows: ReconciliationHistoryRow[]): ReconciliationHistoryItem[] {
  return rows.map((row) => mapHistoryItem(row))
}

export async function buildReconciliationReport(args: {
  empresaId: string
  asOfIso: string
  bankAccountId?: string | null
}): Promise<ReconciliationReport> {
  const { empresaId, asOfIso } = args
  const asOf = endOfDayUtc(asOfIso)

  const accounts = await prisma.treasuryBankAccount.findMany({
    where: { empresaId, ...(args.bankAccountId ? { id: args.bankAccountId } : {}) },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      bankName: true,
      accountNumber: true,
      currency: true,
      isActive: true,
      accountingAccountId: true,
      reconciliations: {
        orderBy: [{ asOf: 'desc' }, { createdAt: 'desc' }],
        take: MAX_HISTORY_ITEMS,
        select: RECONCILIATION_HISTORY_SELECT,
      },
    },
  })

  const linkedAccountIds = accounts
    .map((account) => account.accountingAccountId)
    .filter((value): value is string => Boolean(value))

  const [movements, journalEntries, vouchers] = await Promise.all([
    prisma.treasuryBankMovement.findMany({
      where: {
        empresaId,
        date: { lte: asOf },
        ...(args.bankAccountId ? { bankAccountId: args.bankAccountId } : {}),
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        bankAccountId: true,
        date: true,
        description: true,
        amount: true,
        journalEntryId: true,
        reconciliationId: true,
      },
    }),
    linkedAccountIds.length
      ? prisma.accountingJournalEntry.findMany({
          where: {
            empresaId,
            status: 'POSTED',
            date: { lte: asOf },
            lines: { some: { accountId: { in: linkedAccountIds } } },
          },
          orderBy: [{ date: 'asc' }],
          select: {
            id: true,
            date: true,
            description: true,
            lines: { select: { accountId: true, debit: true, credit: true } },
          },
        })
      : Promise.resolve([]),
    linkedAccountIds.length
      ? prisma.accountingVoucher.findMany({
          where: {
            empresaId,
            status: { in: ['APPROVED', 'POSTED'] },
            journalEntryId: null,
            date: { lte: asOf },
            lines: { some: { accountId: { in: linkedAccountIds } } },
          },
          orderBy: [{ date: 'asc' }],
          select: {
            id: true,
            code: true,
            date: true,
            description: true,
            lines: { select: { accountId: true, debit: true, credit: true } },
          },
        })
      : Promise.resolve([]),
  ])


  const report: ReconciliationAccountReport[] = accounts.map((account) => {
    const accountMovements = movements.filter((movement) => movement.bankAccountId === account.id)
    const bankBalance = roundMoney(accountMovements.reduce((sum, movement) => sum + movement.amount, 0))
    const ledgerAccountId = account.accountingAccountId

    const ledgerItems: LedgerItem[] = []

    if (ledgerAccountId) {
      for (const entry of journalEntries) {
        const lines = entry.lines.filter((line) => line.accountId === ledgerAccountId)
        if (lines.length === 0) continue

        const amount = roundMoney(lines.reduce((sum, line) => sum + line.debit - line.credit, 0))
        if (Math.abs(amount) < 0.005) continue

        ledgerItems.push({
          id: entry.id,
          date: entry.date.toISOString(),
          description: entry.description,
          amount,
          source: 'ASIENTO',
          code: null,
        })
      }

      for (const voucher of vouchers) {
        const lines = voucher.lines.filter((line) => line.accountId === ledgerAccountId)
        if (lines.length === 0) continue

        const amount = roundMoney(lines.reduce((sum, line) => sum + line.debit - line.credit, 0))
        if (Math.abs(amount) < 0.005) continue

        ledgerItems.push({
          id: voucher.id,
          date: voucher.date.toISOString(),
          description: voucher.description,
          amount,
          source: 'COMPROBANTE',
          code: voucher.code,
        })
      }
    }

    ledgerItems.sort((left, right) => left.date.localeCompare(right.date))

    const ledgerBalance = roundMoney(ledgerItems.reduce((sum, item) => sum + item.amount, 0))
    const difference = roundMoney(bankBalance - ledgerBalance)

    const linkedEntryIds = new Set(
      accountMovements.map((movement) => movement.journalEntryId).filter((value): value is string => Boolean(value))
    )

    const unreconciledMovements = accountMovements.filter((movement) => !movement.reconciliationId)
    const movementsWithoutEntry = unreconciledMovements.filter((movement) => !movement.journalEntryId)
    const pendingMovements: PendingMovement[] = movementsWithoutEntry
      .map((movement) => ({
        id: movement.id,
        date: movement.date.toISOString(),
        description: movement.description,
        amount: roundMoney(movement.amount),
      }))
      .reverse()
      .slice(0, MAX_PENDING_ITEMS)

    const pendingEntries = ledgerItems.filter((item) => !linkedEntryIds.has(item.id))

    const status: ReconciliationAccountStatus = !ledgerAccountId
      ? 'SIN_CUENTA_CONTABLE'
      : movementsWithoutEntry.length === 0 && pendingEntries.length === 0 && Math.abs(difference) < 0.01
        ? 'CONCILIADA'
        : 'CON_DIFERENCIAS'

    return {
      id: account.id,
      name: account.name,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      currency: account.currency,
      isActive: account.isActive,
      accountingAccountId: ledgerAccountId,
      bankBalance,
      ledgerBalance,
      difference,
      movementsCount: accountMovements.length,
      reconciledMovementsCount: accountMovements.filter((movement) => Boolean(movement.reconciliationId)).length,
      movementsWithoutEntryTotal: movementsWithoutEntry.length,
      pendingMovements,
      pendingEntriesTotal: pendingEntries.length,
      pendingEntries: pendingEntries.slice(0, MAX_PENDING_ITEMS),
      status,
      reconciliations: mapHistoryItems(account.reconciliations),
    }
  })


  const totals = report.reduce<ReconciliationTotals>(
    (acc, item) => ({
      bankBalance: roundMoney(acc.bankBalance + item.bankBalance),
      ledgerBalance: roundMoney(acc.ledgerBalance + item.ledgerBalance),
      difference: roundMoney(acc.difference + item.difference),
      pendingMovements: acc.pendingMovements + item.movementsWithoutEntryTotal,
      pendingEntries: acc.pendingEntries + item.pendingEntriesTotal,
      reconciledAccounts: acc.reconciledAccounts + (item.status === 'CONCILIADA' ? 1 : 0),
    }),
    { bankBalance: 0, ledgerBalance: 0, difference: 0, pendingMovements: 0, pendingEntries: 0, reconciledAccounts: 0 }
  )

  return { asOf: asOfIso, accounts: report, totals }
}


export type CloseReconciliationErrorCode =
  | 'INVALID_DATE'
  | 'BANK_ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_NOT_LINKED'
  | 'INVALID_MOVEMENTS'

export type CloseReconciliationResult =
  | { ok: true; data: ReconciliationHistoryItem; markedMovements: number; report: ReconciliationAccountReport }
  | { ok: false; code: CloseReconciliationErrorCode; message: string; report?: ReconciliationAccountReport }

/**
 * Persiste el cierre de conciliación de una cuenta bancaria a un corte (fin del día).
 * Guarda el snapshot de saldos, marca los movimientos incluidos con `reconciliationId`
 * y reutiliza el cierre del mismo día si ya existe (idempotente).
 */
export async function closeBankReconciliation(args: {
  empresaId: string
  userId?: string | null
  bankAccountId: string
  asOfIso: string
  notes?: string | null
  movementIds?: string[]
}): Promise<CloseReconciliationResult> {
  if (!isValidIsoDate(args.asOfIso)) {
    return { ok: false, code: 'INVALID_DATE', message: 'asOf debe tener formato YYYY-MM-DD' }
  }

  const account = await prisma.treasuryBankAccount.findFirst({
    where: { id: args.bankAccountId, empresaId: args.empresaId },
    select: { id: true },
  })

  if (!account) {
    return { ok: false, code: 'BANK_ACCOUNT_NOT_FOUND', message: 'Cuenta bancaria no encontrada' }
  }

  const report = await buildReconciliationReport({
    empresaId: args.empresaId,
    asOfIso: args.asOfIso,
    bankAccountId: account.id,
  })

  const accountReport = report.accounts[0]
  if (!accountReport) {
    return { ok: false, code: 'BANK_ACCOUNT_NOT_FOUND', message: 'Cuenta bancaria no encontrada' }
  }

  if (!accountReport.accountingAccountId) {
    return {
      ok: false,
      code: 'ACCOUNT_NOT_LINKED',
      message: 'La cuenta de tesorería no tiene cuenta contable asociada',
      report: accountReport,
    }
  }

  const asOf = endOfDayUtc(args.asOfIso)

  const candidates = await prisma.treasuryBankMovement.findMany({
    where: {
      empresaId: args.empresaId,
      bankAccountId: account.id,
      date: { lte: asOf },
      reconciliationId: null,
    },
    select: { id: true },
  })

  const candidateIds = new Set(candidates.map((row) => row.id))
  let targetIds = Array.from(candidateIds)

  if (args.movementIds?.length) {
    const requested = Array.from(new Set(args.movementIds.map((id) => id.trim()).filter(Boolean)))
    const invalid = requested.filter((id) => !candidateIds.has(id))
    if (invalid.length > 0) {
      return {
        ok: false,
        code: 'INVALID_MOVEMENTS',
        message: `Movimientos inválidos o ya conciliados: ${invalid.slice(0, 5).join(', ')}`,
        report: accountReport,
      }
    }
    targetIds = requested
  }

  const status =
    Math.abs(accountReport.difference) < 0.01 &&
    accountReport.movementsWithoutEntryTotal === 0 &&
    accountReport.pendingEntriesTotal === 0
      ? 'CONCILIADA'
      : 'CON_DIFERENCIAS'

  const notes = args.notes?.trim() ? args.notes.trim() : null

  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.treasuryBankReconciliation.findFirst({
      where: {
        empresaId: args.empresaId,
        bankAccountId: account.id,
        asOf: { gte: startOfDayUtc(args.asOfIso), lte: asOf },
      },
      select: { id: true },
    })

    const payload = {
      asOf,
      status,
      bankBalance: accountReport.bankBalance,
      ledgerBalance: accountReport.ledgerBalance,
      difference: accountReport.difference,
      movementsCount: targetIds.length,
      pendingMovements: accountReport.movementsWithoutEntryTotal,
      pendingEntries: accountReport.pendingEntriesTotal,
      notes,
      closedById: args.userId ?? null,
      metadata: { source: 'CONCILIACION', generatedAt: new Date().toISOString() },
    }

    const record = existing
      ? await tx.treasuryBankReconciliation.update({
          where: { id: existing.id },
          data: payload,
          select: RECONCILIATION_HISTORY_SELECT,
        })
      : await tx.treasuryBankReconciliation.create({
          data: { empresaId: args.empresaId, bankAccountId: account.id, ...payload },
          select: RECONCILIATION_HISTORY_SELECT,
        })

    if (targetIds.length > 0) {
      await tx.treasuryBankMovement.updateMany({
        where: { empresaId: args.empresaId, id: { in: targetIds } },
        data: { reconciliationId: record.id },
      })
    }

    return record
  })

  return {
    ok: true,
    data: mapHistoryItem(saved),
    markedMovements: targetIds.length,
    report: accountReport,
  }
}


/** Reabre (elimina) un cierre de conciliación y libera los movimientos marcados. */
export async function reopenBankReconciliation(args: {
  empresaId: string
  reconciliationId: string
}): Promise<{ ok: true; bankAccountId: string } | { ok: false; message: string }> {
  const existing = await prisma.treasuryBankReconciliation.findFirst({
    where: { id: args.reconciliationId, empresaId: args.empresaId },
    select: { id: true, bankAccountId: true },
  })

  if (!existing) {
    return { ok: false, message: 'Cierre de conciliación no encontrado' }
  }

  await prisma.$transaction(async (tx) => {
    await tx.treasuryBankMovement.updateMany({
      where: { reconciliationId: existing.id },
      data: { reconciliationId: null },
    })
    await tx.treasuryBankReconciliation.delete({ where: { id: existing.id } })
  })

  return { ok: true, bankAccountId: existing.bankAccountId }
}

