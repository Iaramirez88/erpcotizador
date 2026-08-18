import { PayrollConceptCategory, type Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function daysBetweenInclusive(start: Date, end: Date) {
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate())
  return Math.max(0, Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1)
}

function resolveRange(args: { occurredOn?: Date | null; startsAt?: Date | null; endsAt?: Date | null }) {
  const from = args.startsAt ?? args.occurredOn ?? null
  const to = args.endsAt ?? args.startsAt ?? args.occurredOn ?? null
  return { from, to }
}

async function getEmployeeActiveContract(args: { empresaId: string; employeeId: string; contractId?: string | null }) {
  return prisma.payrollContract.findFirst({
    where: {
      empresaId: args.empresaId,
      employeeId: args.employeeId,
      ...(args.contractId ? { id: args.contractId } : { status: 'ACTIVE' }),
    },
    orderBy: [{ startDate: 'desc' }],
    select: {
      id: true,
      baseSalary: true,
    },
  })
}

export async function resolvePayrollNoveltyAmounts(args: {
  empresaId: string
  employeeId: string
  contractId?: string | null
  type: string
  amount?: number | null
  quantity?: number | null
  days?: number | null
  occurredOn?: Date | null
  startsAt?: Date | null
  endsAt?: Date | null
}) {
  const contract = await getEmployeeActiveContract(args)
  if (!contract) {
    return {
      contractId: args.contractId ?? null,
      amount: args.amount ?? null,
      quantity: args.quantity ?? null,
      days: args.days ?? null,
      metadata: {} satisfies Prisma.InputJsonObject,
    }
  }

  const baseSalary = contract.baseSalary
  const hourlyRate = roundMoney(baseSalary / 240)
  const dailyRate = roundMoney(baseSalary / 30)

  if (args.type === 'HORA_EXTRA') {
    let resolvedQuantity = args.quantity ?? null
    if (resolvedQuantity == null) {
      const range = resolveRange(args)
      if (range.from && range.to) {
        const attendance = await prisma.payrollAttendanceEntry.findMany({
          where: {
            empresaId: args.empresaId,
            employeeId: args.employeeId,
            entryDate: { gte: range.from, lte: range.to },
          },
          select: { overtimeMinutes: true },
        })
        const overtimeMinutes = attendance.reduce((sum, item) => sum + Math.max(0, item.overtimeMinutes), 0)
        resolvedQuantity = Math.round((overtimeMinutes / 60) * 100) / 100
      }
    }

    const appliedHours = resolvedQuantity ?? 0
    const overtimeMultiplier = 1.25
    const computedAmount = args.amount ?? (appliedHours > 0 ? roundMoney(appliedHours * hourlyRate * overtimeMultiplier) : null)

    return {
      contractId: contract.id,
      amount: computedAmount,
      quantity: resolvedQuantity,
      days: args.days ?? null,
      metadata: {
        formula: 'HORA_EXTRA_DIURNA',
        hourlyRate,
        overtimeMultiplier,
        baseSalary,
        computedAt: new Date().toISOString(),
      } satisfies Prisma.InputJsonObject,
    }
  }

  if (args.type === 'VACACIONES') {
    const resolvedDays = args.days ?? ((args.startsAt && args.endsAt) ? daysBetweenInclusive(args.startsAt, args.endsAt) : null)
    const computedAmount = args.amount ?? (resolvedDays && resolvedDays > 0 ? roundMoney(resolvedDays * dailyRate) : null)

    return {
      contractId: contract.id,
      amount: computedAmount,
      quantity: args.quantity ?? null,
      days: resolvedDays,
      metadata: {
        formula: 'VACACIONES_DISFRUTADAS',
        dailyRate,
        baseSalary,
        computedAt: new Date().toISOString(),
      } satisfies Prisma.InputJsonObject,
    }
  }

  return {
    contractId: contract.id,
    amount: args.amount ?? null,
    quantity: args.quantity ?? null,
    days: args.days ?? null,
    metadata: {} satisfies Prisma.InputJsonObject,
  }
}

export async function buildPayrollSettlementComputation(args: {
  empresaId: string
  employeeId: string
  contractId?: string | null
  retirementDate: Date
  manualBaseTotal: number
}) {
  const novelties = await prisma.payrollNovelty.findMany({
    where: {
      empresaId: args.empresaId,
      employeeId: args.employeeId,
      type: { in: ['HORA_EXTRA', 'VACACIONES'] },
      status: { in: ['VALIDADA', 'APLICADA'] },
      OR: [
        { occurredOn: { lte: args.retirementDate } },
        { occurredOn: null, startsAt: { lte: args.retirementDate } },
      ],
      ...(args.contractId ? { contractId: args.contractId } : {}),
    },
    orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      type: true,
      detail: true,
      amount: true,
      quantity: true,
      days: true,
    },
  })

  const noveltyLines = novelties
    .filter((item) => Number.isFinite(item.amount ?? NaN) && (item.amount ?? 0) > 0)
    .map((item, index) => ({
      order: args.manualBaseTotal > 0 ? index + 1 : index,
      category: PayrollConceptCategory.DEVENGO,
      code: item.type,
      name: item.type === 'HORA_EXTRA' ? 'Horas extra liquidadas' : 'Vacaciones liquidadas',
      amount: roundMoney(item.amount ?? 0),
      notes: item.detail,
    }))

  const baseLine = args.manualBaseTotal > 0
    ? [{
        order: 0,
        category: PayrollConceptCategory.DEVENGO,
        code: 'BASE',
        name: 'Base liquidación manual',
        amount: roundMoney(args.manualBaseTotal),
        notes: 'Valor base ingresado por RRHH antes de sumar novedades liquidadas.',
      }]
    : []

  const total = roundMoney([...baseLine, ...noveltyLines].reduce((sum, item) => sum + item.amount, 0))

  return {
    total,
    lines: [...baseLine, ...noveltyLines],
  }
}