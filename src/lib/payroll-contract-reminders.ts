import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName } from '@/lib/payroll'

function parseMetadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asPositiveInteger(value: unknown, fallback: number) {
  const next = Number(value)
  return Number.isInteger(next) && next > 0 ? next : fallback
}

function diffDays(from: Date, to: Date) {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function buildReminderMetadata(input: {
  currentMetadata?: Record<string, unknown>
  reminderKey: string
  reminderDate: string
}) {
  const currentMetadata = input.currentMetadata ?? {}
  const reminderLog = Array.isArray(currentMetadata.reminderLog)
    ? currentMetadata.reminderLog.filter((item): item is string => typeof item === 'string').slice(0, 19)
    : []

  return {
    ...currentMetadata,
    lastReminderSentKey: input.reminderKey,
    lastReminderSentAt: input.reminderDate,
    reminderLog: [input.reminderKey, ...reminderLog.filter((item) => item !== input.reminderKey)],
  } satisfies Prisma.InputJsonObject
}

export type PayrollContractReminderRun = {
  scanned: number
  due: number
  notified: number
  skippedAlreadySent: number
}

export async function sendPayrollContractExpirationReminders(args: {
  empresaId?: string
  contractId?: string
} = {}): Promise<PayrollContractReminderRun> {
  const contracts = await prisma.payrollContract.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { not: null },
      ...(args.empresaId ? { empresaId: args.empresaId } : {}),
      ...(args.contractId ? { id: args.contractId } : {}),
    },
    include: {
      employee: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          secondLastName: true,
        },
      },
    },
    orderBy: [{ endDate: 'asc' }],
  })

  let due = 0
  let notified = 0
  let skippedAlreadySent = 0

  for (const contract of contracts) {
    const endDate = contract.endDate
    if (!endDate) continue

    const metadata = parseMetadata(contract.metadata)
    const reminderDays = asPositiveInteger(metadata.renewalReminderDays, 15)
    const daysToExpiration = diffDays(new Date(), endDate)
    if (daysToExpiration < 0 || daysToExpiration > reminderDays) continue

    due += 1
    const reminderKey = `${endDate.toISOString().slice(0, 10)}:${reminderDays}`
    const lastReminderSentKey = typeof metadata.lastReminderSentKey === 'string' ? metadata.lastReminderSentKey : null
    if (lastReminderSentKey === reminderKey) {
      skippedAlreadySent += 1
      continue
    }

    const admins = await prisma.user.findMany({
      where: {
        empresaId: contract.empresaId,
        OR: [
          { role: 'ADMIN' },
          { globalAccess: { is: { level: 'ADMIN' } } },
        ],
      },
      select: { id: true },
      take: 50,
    })

    const recipientUserIds = Array.from(new Set(admins.map((item) => item.id)))
    if (!recipientUserIds.length) continue

    const employeeName = buildPayrollEmployeeFullName(contract.employee)

    await prisma.$transaction([
      prisma.notification.createMany({
        data: recipientUserIds.map((userId) => ({
          empresaId: contract.empresaId,
          sedeId: contract.sedeId,
          userId,
          type: 'WARNING',
          title: `Contrato próximo a vencer: ${employeeName}`,
          body: `El contrato vence el ${endDate.toLocaleDateString('es-CO')} y requiere revisión o prórroga.`,
          actionUrl: '/dashboard/contabilidad/nomina/empleados',
          actionLabel: 'Revisar contrato',
        })),
      }),
      prisma.payrollContract.update({
        where: { id: contract.id },
        data: {
          metadata: buildReminderMetadata({
            currentMetadata: metadata,
            reminderKey,
            reminderDate: new Date().toISOString(),
          }),
        },
      }),
    ])

    notified += recipientUserIds.length
  }

  return {
    scanned: contracts.length,
    due,
    notified,
    skippedAlreadySent,
  }
}