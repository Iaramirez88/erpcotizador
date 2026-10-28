import type {
  AccountingAmountKey,
  AccountingEventType,
  AccountingPostingSide,
  AccountingVoucherStatus,
  AccountingVoucherType,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BASE_ACCOUNTS } from './base-plan'

/**
 * Marca que identifica los registros de ejemplo. Todo lo que se crea desde
 * "Datos de ejemplo" lleva esta etiqueta en su metadata, de modo que se puede
 * borrar sin tocar la información real de la empresa.
 */
export const ACCOUNTING_SAMPLE_TAG = 'DEMO_CONTABLE'

/** Marcas de semillas anteriores (script) que también se limpian al quitar el ejemplo. */
export const ACCOUNTING_SAMPLE_LEGACY_TAGS = ['BASE_CONTABLE_DEMO_2026'] as const

const SAMPLE_TAGS = new Set<string>([ACCOUNTING_SAMPLE_TAG, ...ACCOUNTING_SAMPLE_LEGACY_TAGS])

/** True cuando el JSON (metadata/conditions) trae la marca de dato de ejemplo. */
export function isAccountingSampleMetadata(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const tag = (value as Record<string, unknown>).sampleTag
  return typeof tag === 'string' && SAMPLE_TAGS.has(tag)
}

function sampleMetadata(extra: Record<string, unknown> = {}): Prisma.InputJsonValue {
  return { ...extra, sampleTag: ACCOUNTING_SAMPLE_TAG } as Prisma.InputJsonValue
}

export type AccountingSampleVoucherLine = {
  accountCode: string
  debit: number
  credit: number
  memo: string
}

export type AccountingSampleVoucher = {
  code: string
  voucherType: AccountingVoucherType
  status: AccountingVoucherStatus
  /** Días hacia atrás desde hoy; se acota al inicio del mes en curso. */
  daysAgo: number
  description: string
  externalReference: string
  thirdPartyName: string
  thirdPartyDocument: string
  notes: string
  lines: AccountingSampleVoucherLine[]
}

/**
 * Los tres registros de ejemplo que recibe un usuario nuevo para entender el
 * módulo: un ingreso aprobado, un egreso en borrador y un ajuste contabilizado.
 */
export const ACCOUNTING_SAMPLE_VOUCHERS: AccountingSampleVoucher[] = [
  {
    code: 'DEMO-ING-001',
    voucherType: 'INGRESO',
    status: 'APPROVED',
    daysAgo: 18,
    description: 'Venta de ejemplo con IVA recaudada en caja.',
    externalReference: 'FV-DEMO-001',
    thirdPartyName: 'Cliente de ejemplo SAS',
    thirdPartyDocument: '900100100-1',
    notes: 'Registro de ejemplo (aprobado). Se puede eliminar desde Datos de ejemplo.',
    lines: [
      { accountCode: '110505', debit: 1190000, credit: 0, memo: 'Caja recibida venta de ejemplo' },
      { accountCode: '413505', debit: 0, credit: 1000000, memo: 'Ingreso operacional de ejemplo' },
      { accountCode: '240805', debit: 0, credit: 190000, memo: 'IVA generado de ejemplo' },
    ],
  },
  {
    code: 'DEMO-EGR-001',
    voucherType: 'EGRESO',
    status: 'DRAFT',
    daysAgo: 10,
    description: 'Compra de ejemplo pendiente de aprobación.',
    externalReference: 'FC-DEMO-221',
    thirdPartyName: 'Proveedor de ejemplo Ltda',
    thirdPartyDocument: '800200300-4',
    notes: 'Registro de ejemplo (borrador) para revisar el flujo de aprobación.',
    lines: [
      { accountCode: '513505', debit: 500000, credit: 0, memo: 'Gasto de ejemplo' },
      { accountCode: '240810', debit: 95000, credit: 0, memo: 'IVA descontable de ejemplo' },
      { accountCode: '220505', debit: 0, credit: 595000, memo: 'Cuenta por pagar de ejemplo' },
    ],
  },
  {
    code: 'DEMO-AJU-001',
    voucherType: 'AJUSTE',
    status: 'POSTED',
    daysAgo: 3,
    description: 'Ajuste de ejemplo con cartera e IVA.',
    externalReference: 'AJ-DEMO-310',
    thirdPartyName: 'Cliente de ejemplo Dos SAS',
    thirdPartyDocument: '901300400-7',
    notes: 'Registro de ejemplo (contabilizado) para ver libros y estados con datos.',
    lines: [
      { accountCode: '130505', debit: 2380000, credit: 0, memo: 'Cartera de ejemplo' },
      { accountCode: '413505', debit: 0, credit: 2000000, memo: 'Ingreso de ejemplo' },
      { accountCode: '240805', debit: 0, credit: 380000, memo: 'IVA generado de ejemplo' },
    ],
  },
]

/** Códigos de comprobantes de ejemplo actuales y de la semilla anterior. */
export const ACCOUNTING_SAMPLE_VOUCHER_CODES: string[] = [
  ...ACCOUNTING_SAMPLE_VOUCHERS.map((voucher) => voucher.code),
  'ING-BASE-001',
  'EGR-BASE-001',
  'AJU-BASE-001',
]

/**
 * Regla de ejemplo (evento manual) para que la pantalla de reglas también tenga
 * datos con los que probar el simulador. Reutiliza cuentas del ejemplo.
 */
export const ACCOUNTING_SAMPLE_RULE: {
  name: string
  description: string
  eventType: AccountingEventType
  priority: number
  lines: Array<{
    side: AccountingPostingSide
    accountCode: string
    amountKey: AccountingAmountKey
    multiplier: number
    memoTemplate: string
  }>
} = {
  name: 'Regla de ejemplo — Venta gravada 19%',
  description: 'Regla creada junto con los datos de ejemplo: venta con IVA del 19% sobre el subtotal.',
  eventType: 'MANUAL',
  priority: 900,
  lines: [
    {
      side: 'DEBIT',
      accountCode: '110505',
      amountKey: 'TOTAL',
      multiplier: 1,
      memoTemplate: 'Caja por venta de ejemplo',
    },
    {
      side: 'CREDIT',
      accountCode: '413505',
      amountKey: 'SUBTOTAL',
      multiplier: 1,
      memoTemplate: 'Ingreso de ejemplo',
    },
    {
      side: 'CREDIT',
      accountCode: '240805',
      amountKey: 'IVA',
      multiplier: 1,
      memoTemplate: 'IVA generado de ejemplo',
    },
  ],
}

const MONTH_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function currentMonthPeriod(now: Date) {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  return {
    code: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: `${MONTH_LABELS[month]} ${year}`,
    startsAt: new Date(Date.UTC(year, month, 1, 0, 0, 0)),
    endsAt: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  }
}

/** Fecha del comprobante de ejemplo, siempre dentro del mes en curso. */
function sampleVoucherDate(daysAgo: number, now: Date) {
  const candidate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
  const monthStart = currentMonthPeriod(now).startsAt
  return candidate.getTime() < monthStart.getTime() ? monthStart : candidate
}

type SamplePeriodResolution = {
  id: string | null
  code: string
  created: boolean
}

async function resolveSamplePeriod(
  empresaId: string,
  actorUserId: string | null,
  now: Date,
): Promise<SamplePeriodResolution> {
  const covering = await prisma.accountingPeriod.findFirst({
    where: { empresaId, status: 'OPEN', startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { startsAt: 'desc' },
    select: { id: true, code: true },
  })

  if (covering) return { id: covering.id, code: covering.code, created: false }

  const current = currentMonthPeriod(now)
  const existing = await prisma.accountingPeriod.findFirst({
    where: { empresaId, code: current.code },
    select: { id: true, status: true },
  })

  if (existing) {
    // Si el período del mes ya existe pero está bloqueado/cerrado no se le
    // cuelgan comprobantes de ejemplo: quedan sin período.
    return { id: existing.status === 'OPEN' ? existing.id : null, code: current.code, created: false }
  }

  const created = await prisma.accountingPeriod.create({
    data: {
      empresaId,
      code: current.code,
      label: current.label,
      status: 'OPEN',
      startsAt: current.startsAt,
      endsAt: current.endsAt,
      notes: 'Período creado automáticamente junto con los datos de ejemplo.',
      metadata: sampleMetadata({ label: current.label }),
      createdById: actorUserId,
    },
    select: { id: true, code: true },
  })

  return { id: created.id, code: created.code, created: true }
}

async function ensureSampleAccounts(empresaId: string, accountCodes: string[]) {
  const existing = await prisma.accountingAccount.findMany({
    where: { empresaId, code: { in: accountCodes } },
    select: { id: true, code: true },
  })
  const byCode = new Map(existing.map((row) => [row.code, row.id]))
  const createdCodes: string[] = []

  for (const code of accountCodes) {
    if (byCode.has(code)) continue

    const base = BASE_ACCOUNTS.find((account) => account.code === code)
    if (!base) throw new Error(`Cuenta base no definida para el ejemplo: ${code}`)

    const created = await prisma.accountingAccount.create({
      data: {
        empresaId,
        code,
        name: base.name,
        type: base.type,
        normalBalance: base.normalBalance,
        isPosting: true,
        isActive: true,
        metadata: sampleMetadata(),
      },
      select: { id: true, code: true },
    })

    byCode.set(created.code, created.id)
    createdCodes.push(created.code)
  }

  return { byCode, createdCodes }
}

/** Cuentas de la regla de ejemplo (todas existen por los comprobantes de ejemplo). */
const SAMPLE_RULE_ACCOUNT_CODES = ACCOUNTING_SAMPLE_RULE.lines.map((line) => line.accountCode)

/**
 * Crea o actualiza la regla de ejemplo. Idempotente por nombre: si ya existe se
 * reemplazan solo sus líneas, de modo que el ejemplo se puede recargar.
 */
async function seedSampleRule(empresaId: string, byCode: Map<string, string>): Promise<{ created: boolean }> {
  const missing = SAMPLE_RULE_ACCOUNT_CODES.filter((code) => !byCode.has(code))
  if (missing.length > 0) {
    throw new Error(`Cuentas no disponibles para la regla de ejemplo: ${missing.join(', ')}`)
  }

  const lines = ACCOUNTING_SAMPLE_RULE.lines.map((line, index) => ({
    order: index + 1,
    side: line.side,
    accountId: byCode.get(line.accountCode) as string,
    amountKey: line.amountKey,
    multiplier: line.multiplier,
    memoTemplate: line.memoTemplate,
  }))

  const data = {
    eventType: ACCOUNTING_SAMPLE_RULE.eventType,
    documentType: null,
    name: ACCOUNTING_SAMPLE_RULE.name,
    description: ACCOUNTING_SAMPLE_RULE.description,
    priority: ACCOUNTING_SAMPLE_RULE.priority,
    isActive: true,
    conditions: sampleMetadata(),
  }

  const existing = await prisma.accountingRule.findFirst({
    where: { empresaId, name: ACCOUNTING_SAMPLE_RULE.name },
    select: { id: true },
  })

  if (existing) {
    await prisma.accountingRule.update({
      where: { id: existing.id },
      data: { ...data, lines: { deleteMany: {}, create: lines } },
    })
    return { created: false }
  }

  await prisma.accountingRule.create({
    data: { ...data, empresaId, lines: { create: lines } },
  })
  return { created: true }
}

export type AccountingSampleSeedResult = {
  vouchers: number
  accountsCreated: number
  periodCreated: boolean
  periodCode: string | null
  rules: number
  ruleCreated: boolean
}

/**
 * Crea (o actualiza) los tres registros de ejemplo. Es idempotente: se puede
 * ejecutar varias veces sin duplicar comprobantes.
 */
export async function seedAccountingSampleData(args: {
  empresaId: string
  actorUserId: string | null
  now?: Date
}): Promise<AccountingSampleSeedResult> {
  const now = args.now ?? new Date()
  const accountCodes = Array.from(
    new Set(ACCOUNTING_SAMPLE_VOUCHERS.flatMap((voucher) => voucher.lines.map((line) => line.accountCode))),
  )

  const { byCode, createdCodes } = await ensureSampleAccounts(args.empresaId, accountCodes)
  const period = await resolveSamplePeriod(args.empresaId, args.actorUserId, now)

  for (const voucher of ACCOUNTING_SAMPLE_VOUCHERS) {
    const lines = voucher.lines.map((line, index) => {
      const accountId = byCode.get(line.accountCode)
      if (!accountId) throw new Error(`Cuenta ${line.accountCode} no disponible para el ejemplo ${voucher.code}.`)
      return {
        order: index + 1,
        accountId,
        debit: line.debit,
        credit: line.credit,
        memo: line.memo,
      }
    })

    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0)

    if (Math.round(totalDebit) !== Math.round(totalCredit)) {
      throw new Error(`El comprobante de ejemplo ${voucher.code} no cuadra en débito y crédito.`)
    }

    const isApproved = voucher.status === 'APPROVED' || voucher.status === 'POSTED'
    const shared = {
      periodId: period.id,
      voucherType: voucher.voucherType,
      status: voucher.status,
      date: sampleVoucherDate(voucher.daysAgo, now),
      description: voucher.description,
      externalReference: voucher.externalReference,
      thirdPartyName: voucher.thirdPartyName,
      thirdPartyDocument: voucher.thirdPartyDocument,
      currency: 'COP',
      notes: voucher.notes,
      metadata: sampleMetadata(),
      totalDebit,
      totalCredit,
      approvedById: isApproved ? args.actorUserId : null,
      approvedAt: isApproved ? now : null,
    }

    await prisma.accountingVoucher.upsert({
      where: { empresaId_code: { empresaId: args.empresaId, code: voucher.code } },
      update: {
        ...shared,
        lines: { deleteMany: {}, create: lines },
      },
      create: {
        ...shared,
        empresaId: args.empresaId,
        code: voucher.code,
        createdById: args.actorUserId,
        lines: { create: lines },
      },
      select: { id: true },
    })
  }

  const rule = await seedSampleRule(args.empresaId, byCode)

  return {
    vouchers: ACCOUNTING_SAMPLE_VOUCHERS.length,
    accountsCreated: createdCodes.length,
    periodCreated: period.created,
    periodCode: period.id ? period.code : null,
    rules: rule.created ? 1 : 0,
    ruleCreated: rule.created,
  }
}

export type AccountingSampleVoucherSummary = {
  id: string
  code: string
  voucherType: AccountingVoucherType
  status: AccountingVoucherStatus
  date: string
  description: string
  totalDebit: number
}

export type AccountingSampleDataStatus = {
  tag: string
  hasSampleData: boolean
  vouchers: AccountingSampleVoucherSummary[]
  voucherCount: number
  ruleCount: number
  accountCount: number
  periodCount: number
  totalDebit: number
}

/** Estado de los datos de ejemplo de la empresa (para pintar el panel). */
export async function getAccountingSampleDataStatus(empresaId: string): Promise<AccountingSampleDataStatus> {
  const [voucherRows, ruleRows, accountRows, periodRows] = await Promise.all([
    prisma.accountingVoucher.findMany({
      where: { empresaId, code: { in: ACCOUNTING_SAMPLE_VOUCHER_CODES } },
      orderBy: [{ date: 'desc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        voucherType: true,
        status: true,
        date: true,
        description: true,
        totalDebit: true,
        metadata: true,
      },
    }),
    prisma.accountingRule.findMany({ where: { empresaId }, select: { conditions: true } }),
    prisma.accountingAccount.findMany({ where: { empresaId }, select: { metadata: true } }),
    prisma.accountingPeriod.findMany({ where: { empresaId }, select: { metadata: true } }),
  ])

  const vouchers: AccountingSampleVoucherSummary[] = voucherRows
    .filter((row) => isAccountingSampleMetadata(row.metadata))
    .map((row) => ({
      id: row.id,
      code: row.code,
      voucherType: row.voucherType,
      status: row.status,
      date: row.date.toISOString(),
      description: row.description,
      totalDebit: row.totalDebit,
    }))

  const ruleCount = ruleRows.filter((row) => isAccountingSampleMetadata(row.conditions)).length
  const accountCount = accountRows.filter((row) => isAccountingSampleMetadata(row.metadata)).length
  const periodCount = periodRows.filter((row) => isAccountingSampleMetadata(row.metadata)).length

  return {
    tag: ACCOUNTING_SAMPLE_TAG,
    hasSampleData: vouchers.length > 0 || ruleCount > 0 || accountCount > 0 || periodCount > 0,
    vouchers,
    voucherCount: vouchers.length,
    ruleCount,
    accountCount,
    periodCount,
    totalDebit: vouchers.reduce((sum, voucher) => sum + voucher.totalDebit, 0),
  }
}

export type AccountingSampleRemovalResult = {
  vouchers: number
  journalEntries: number
  rules: number
  accounts: number
  periods: number
}

const EMPTY_BATCH = { count: 0 }

/**
 * Elimina únicamente los registros marcados como datos de ejemplo: comprobantes
 * (con sus asientos), reglas, cuentas y períodos. Nunca toca información real:
 * las cuentas/períodos se borran solo si ya no tienen referencias.
 */
export async function removeAccountingSampleData(empresaId: string): Promise<AccountingSampleRemovalResult> {
  return prisma.$transaction(async (tx) => {
    const voucherRows = await tx.accountingVoucher.findMany({
      where: { empresaId, code: { in: ACCOUNTING_SAMPLE_VOUCHER_CODES } },
      select: { id: true, journalEntryId: true, metadata: true },
    })

    const sampleVouchers = voucherRows.filter((row) => isAccountingSampleMetadata(row.metadata))
    const voucherIds = sampleVouchers.map((row) => row.id)
    const journalEntryIds = sampleVouchers
      .map((row) => row.journalEntryId)
      .filter((entryId): entryId is string => typeof entryId === 'string' && entryId.length > 0)

    const journalEntries = journalEntryIds.length
      ? await tx.accountingJournalEntry.deleteMany({ where: { empresaId, id: { in: journalEntryIds } } })
      : EMPTY_BATCH

    const vouchers = voucherIds.length
      ? await tx.accountingVoucher.deleteMany({ where: { empresaId, id: { in: voucherIds } } })
      : EMPTY_BATCH

    const ruleRows = await tx.accountingRule.findMany({
      where: { empresaId },
      select: { id: true, conditions: true },
    })
    const ruleIds = ruleRows.filter((row) => isAccountingSampleMetadata(row.conditions)).map((row) => row.id)
    const rules = ruleIds.length
      ? await tx.accountingRule.deleteMany({ where: { empresaId, id: { in: ruleIds } } })
      : EMPTY_BATCH

    const periodRows = await tx.accountingPeriod.findMany({
      where: { empresaId },
      select: { id: true, metadata: true, _count: { select: { vouchers: true } } },
    })
    const periodIds = periodRows
      .filter((row) => isAccountingSampleMetadata(row.metadata) && row._count.vouchers === 0)
      .map((row) => row.id)
    const periods = periodIds.length
      ? await tx.accountingPeriod.deleteMany({ where: { empresaId, id: { in: periodIds } } })
      : EMPTY_BATCH

    const accountRows = await tx.accountingAccount.findMany({
      where: { empresaId },
      select: {
        id: true,
        metadata: true,
        _count: {
          select: { ruleLines: true, journalLines: true, voucherLines: true, bankAccounts: true, children: true },
        },
      },
    })
    const accountIds = accountRows
      .filter((row) => isAccountingSampleMetadata(row.metadata))
      .filter(
        (row) =>
          row._count.ruleLines === 0 &&
          row._count.journalLines === 0 &&
          row._count.voucherLines === 0 &&
          row._count.bankAccounts === 0 &&
          row._count.children === 0,
      )
      .map((row) => row.id)
    const accounts = accountIds.length
      ? await tx.accountingAccount.deleteMany({ where: { empresaId, id: { in: accountIds } } })
      : EMPTY_BATCH

    return {
      vouchers: vouchers.count,
      journalEntries: journalEntries.count,
      rules: rules.count,
      accounts: accounts.count,
      periods: periods.count,
    }
  })
}
