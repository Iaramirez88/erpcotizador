import { prisma } from '@/lib/prisma'
import type {
  AccountingAmountKey,
  AccountingEventType,
  AccountingPostingSide,
  Prisma,
} from '@prisma/client'

export type AccountingAmounts = Partial<Record<AccountingAmountKey, number>>

export type GenerateEntryArgs = {
  empresaId: string
  userId?: string | null
  eventType: AccountingEventType
  referenceType: string
  referenceId: string
  date: Date
  description: string
  amounts: AccountingAmounts
  currency?: string
  referenceExtra?: Record<string, unknown> | null
}

type ConditionContext = {
  eventType: AccountingEventType
  referenceType: string
  referenceId: string
  description: string
  currency: string
  amounts: AccountingAmounts
  referenceExtra: Record<string, unknown>
}

function roundCOP(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value)
}

function sumMoney(values: number[]): number {
  return roundCOP(values.reduce((a, b) => a + b, 0))
}

function getAmount(amounts: AccountingAmounts, key: AccountingAmountKey): number {
  return roundCOP(amounts[key] ?? 0)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readValueByPath(source: unknown, path: string) {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean)
  let current: unknown = source
  for (const segment of segments) {
    if (!isPlainObject(current)) return undefined
    current = current[segment]
  }
  return current
}

function valuesEqual(left: unknown, right: unknown) {
  if (typeof left === 'number' || typeof right === 'number') {
    const leftNumber = Number(left)
    const rightNumber = Number(right)
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber
  }
  return String(left ?? '') === String(right ?? '')
}

function matchesScalarCondition(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    return expected.some((item) => valuesEqual(actual, item))
  }

  if (isPlainObject(expected)) {
    if ('equals' in expected && !valuesEqual(actual, expected.equals)) return false
    if ('notEquals' in expected && valuesEqual(actual, expected.notEquals)) return false
    if ('in' in expected) {
      const options = Array.isArray(expected.in) ? expected.in : [expected.in]
      if (!options.some((item) => valuesEqual(actual, item))) return false
    }
    if ('startsWith' in expected && !String(actual ?? '').startsWith(String(expected.startsWith ?? ''))) return false
    if ('includes' in expected && !String(actual ?? '').includes(String(expected.includes ?? ''))) return false
    if ('exists' in expected) {
      const exists = actual !== undefined && actual !== null && actual !== ''
      if (Boolean(expected.exists) !== exists) return false
    }

    const actualNumber = Number(actual)
    if ('gt' in expected && !(Number.isFinite(actualNumber) && actualNumber > Number(expected.gt))) return false
    if ('gte' in expected && !(Number.isFinite(actualNumber) && actualNumber >= Number(expected.gte))) return false
    if ('lt' in expected && !(Number.isFinite(actualNumber) && actualNumber < Number(expected.lt))) return false
    if ('lte' in expected && !(Number.isFinite(actualNumber) && actualNumber <= Number(expected.lte))) return false
    return true
  }

  return valuesEqual(actual, expected)
}

function matchesRuleConditions(conditions: unknown, context: ConditionContext): boolean {
  if (!isPlainObject(conditions) || Object.keys(conditions).length === 0) return true

  for (const [key, expected] of Object.entries(conditions)) {
    if (key === 'sampleTag') continue
    const actual = readValueByPath(context, key)
    if (!matchesScalarCondition(actual, expected)) {
      return false
    }
  }

  return true
}

export class AccountingError extends Error {
  code:
    | 'RULE_NOT_FOUND'
    | 'RULE_INACTIVE'
    | 'RULE_HAS_NO_LINES'
    | 'IMBALANCED_ENTRY'
    | 'INVALID_AMOUNT'
    | 'ENTRY_ALREADY_EXISTS'

  constructor(code: AccountingError['code'], message: string) {
    super(message)
    this.code = code
  }
}

export async function generateJournalEntryFromRule(args: GenerateEntryArgs) {
  const currency = args.currency ?? 'COP'

  const rules = await prisma.accountingRule.findMany({
    where: {
      empresaId: args.empresaId,
      eventType: args.eventType,
      isActive: true,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    include: {
      lines: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        include: { account: { select: { id: true, isActive: true, isPosting: true } } },
      },
    },
  })

  const context: ConditionContext = {
    eventType: args.eventType,
    referenceType: args.referenceType,
    referenceId: args.referenceId,
    description: args.description,
    currency,
    amounts: args.amounts,
    referenceExtra: isPlainObject(args.referenceExtra) ? args.referenceExtra : {},
  }

  const rule = rules.find((candidate) => matchesRuleConditions(candidate.conditions, context)) ?? null

  if (!rule) {
    throw new AccountingError('RULE_NOT_FOUND', 'No existe una regla contable activa para este evento')
  }

  if (!rule.isActive) {
    throw new AccountingError('RULE_INACTIVE', 'La regla contable está inactiva')
  }

  if (!rule.lines?.length) {
    throw new AccountingError('RULE_HAS_NO_LINES', 'La regla contable no tiene líneas configuradas')
  }

  const lineCreates: Prisma.AccountingJournalLineCreateManyEntryInput[] = rule.lines.map((line) => {
    const amount = getAmount(args.amounts, line.amountKey)
    if (amount < 0) {
      throw new AccountingError('INVALID_AMOUNT', 'Los montos no pueden ser negativos')
    }

    const multiplied = roundCOP(amount * (line.multiplier ?? 1))

    const side: AccountingPostingSide = line.side

    return {
      accountId: line.accountId,
      costCenterId: line.costCenterId ?? null,
      debit: side === 'DEBIT' ? multiplied : 0,
      credit: side === 'CREDIT' ? multiplied : 0,
      memo: line.memoTemplate ?? null,
      createdAt: new Date(),
    }
  })

  const totalDebit = sumMoney(lineCreates.map((l) => l.debit ?? 0))
  const totalCredit = sumMoney(lineCreates.map((l) => l.credit ?? 0))

  if (totalDebit !== totalCredit) {
    throw new AccountingError(
      'IMBALANCED_ENTRY',
      `Asiento desbalanceado (debitos=${totalDebit}, creditos=${totalCredit})`
    )
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.accountingJournalEntry.findUnique({
      where: {
        empresaId_referenceType_referenceId: {
          empresaId: args.empresaId,
          referenceType: args.referenceType,
          referenceId: args.referenceId,
        },
      },
      select: { id: true },
    })

    if (existing?.id) {
      throw new AccountingError('ENTRY_ALREADY_EXISTS', 'Ya existe un asiento para esta referencia')
    }

    const entry = await tx.accountingJournalEntry.create({
      data: {
        empresaId: args.empresaId,
        eventType: args.eventType,
        referenceType: args.referenceType,
        referenceId: args.referenceId,
        date: args.date,
        description: args.description,
        currency,
        totalDebit,
        totalCredit,
        createdById: args.userId ?? null,
        lines: {
          create: lineCreates.map((l) => ({
            accountId: l.accountId,
            costCenterId: l.costCenterId ?? null,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
            memo: l.memo ?? null,
          })),
        },
      },
      select: { id: true },
    })

    return entry
  })
}
