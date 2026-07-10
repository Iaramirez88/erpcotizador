import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import type { Prisma } from '@prisma/client'
import {
  AccountingAmountKey,
  AccountingEventType,
  AccountingPostingSide,
  AccountingVoucherStatus,
  AccountingVoucherType,
} from '@prisma/client'

const DEFAULT_ADMIN_EMAIL = 'admin@sgdigital.com'
const SAMPLE_TAG = 'BASE_CONTABLE_DEMO_2026'

type SeedAccount = {
  code: string
  name: string
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'
  normalBalance: 'DEBIT' | 'CREDIT'
  isPosting?: boolean
}

type SeedCostCenter = {
  code: string
  name: string
}

type SeedRule = {
  name: string
  eventType: AccountingEventType
  description: string
  priority: number
  lines: Array<{
    side: AccountingPostingSide
    amountKey: AccountingAmountKey
    accountCode: string
    costCenterCode?: string
    multiplier?: number
    memoTemplate: string
  }>
}

type SeedVoucher = {
  code: string
  voucherType: AccountingVoucherType
  status: AccountingVoucherStatus
  periodCode: string
  date: Date
  description: string
  externalReference: string
  thirdPartyName: string
  thirdPartyDocument: string
  notes: string
  lines: Array<{
    accountCode: string
    costCenterCode?: string
    thirdPartyName?: string
    thirdPartyDocument?: string
    debit: number
    credit: number
    memo: string
  }>
}

function parseArg(name: string) {
  const prefix = `--${name}=`
  const match = process.argv.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length).trim() : ''
}

async function resolveTargetEmpresa() {
  const emailArg = parseArg('email')
  const empresaIdArg = parseArg('empresaId')

  if (empresaIdArg) {
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaIdArg },
      select: { id: true, nombre: true },
    })

    if (!empresa) {
      throw new Error(`No existe la empresa ${empresaIdArg}.`)
    }

    const actor = await prisma.user.findFirst({
      where: { empresaId: empresa.id },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, email: true, name: true },
    })

    return {
      empresaId: empresa.id,
      empresaNombre: empresa.nombre,
      actorUserId: actor?.id ?? null,
      actorLabel: actor?.name || actor?.email || 'usuario base',
    }
  }

  const preferredEmail = emailArg || DEFAULT_ADMIN_EMAIL
  const preferredUser = await prisma.user.findUnique({
    where: { email: preferredEmail },
    select: { id: true, email: true, name: true, empresaId: true, empresa: { select: { nombre: true } } },
  })

  if (preferredUser?.empresaId) {
    return {
      empresaId: preferredUser.empresaId,
      empresaNombre: preferredUser.empresa?.nombre || preferredUser.empresaId,
      actorUserId: preferredUser.id,
      actorLabel: preferredUser.name || preferredUser.email || 'usuario base',
    }
  }

  const fallbackUser = await prisma.user.findFirst({
    where: { empresaId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, name: true, empresaId: true, empresa: { select: { nombre: true } } },
  })

  if (!fallbackUser?.empresaId) {
    throw new Error('No se encontró una empresa con usuarios asociados para sembrar la base contable.')
  }

  return {
    empresaId: fallbackUser.empresaId,
    empresaNombre: fallbackUser.empresa?.nombre || fallbackUser.empresaId,
    actorUserId: fallbackUser.id,
    actorLabel: fallbackUser.name || fallbackUser.email || 'usuario base',
  }
}

async function upsertAccount(empresaId: string, account: SeedAccount) {
  return prisma.accountingAccount.upsert({
    where: { empresaId_code: { empresaId, code: account.code } },
    update: {
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      isPosting: account.isPosting ?? true,
      isActive: true,
      metadata: { sampleTag: SAMPLE_TAG },
    },
    create: {
      empresaId,
      code: account.code,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
      isPosting: account.isPosting ?? true,
      isActive: true,
      metadata: { sampleTag: SAMPLE_TAG },
    },
    select: { id: true, code: true, name: true },
  })
}

async function upsertCostCenter(empresaId: string, costCenter: SeedCostCenter) {
  return prisma.accountingCostCenter.upsert({
    where: { empresaId_code: { empresaId, code: costCenter.code } },
    update: {
      name: costCenter.name,
      isActive: true,
    },
    create: {
      empresaId,
      code: costCenter.code,
      name: costCenter.name,
      isActive: true,
    },
    select: { id: true, code: true, name: true },
  })
}

async function upsertPeriod(args: {
  empresaId: string
  actorUserId: string | null
  code: string
  label: string
  startsAt: Date
  endsAt: Date
  status: 'OPEN' | 'LOCKED' | 'CLOSED'
  notes: string
}) {
  return prisma.accountingPeriod.upsert({
    where: { empresaId_code: { empresaId: args.empresaId, code: args.code } },
    update: {
      label: args.label,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      status: args.status,
      notes: args.notes,
      metadata: { sampleTag: SAMPLE_TAG },
      createdById: args.actorUserId,
      lockedAt: args.status === 'LOCKED' ? args.endsAt : null,
      closedAt: args.status === 'CLOSED' ? args.endsAt : null,
    },
    create: {
      empresaId: args.empresaId,
      code: args.code,
      label: args.label,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      status: args.status,
      notes: args.notes,
      metadata: { sampleTag: SAMPLE_TAG },
      createdById: args.actorUserId,
      lockedAt: args.status === 'LOCKED' ? args.endsAt : null,
      closedAt: args.status === 'CLOSED' ? args.endsAt : null,
    },
    select: { id: true, code: true, label: true, status: true },
  })
}

async function upsertRule(args: {
  empresaId: string
  rule: SeedRule
  accountByCode: Map<string, string>
  costCenterByCode: Map<string, string>
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.accountingRule.findFirst({
      where: {
        empresaId: args.empresaId,
        eventType: args.rule.eventType,
        name: args.rule.name,
      },
      select: { id: true },
    })

    const base = existing
      ? await tx.accountingRule.update({
          where: { id: existing.id },
          data: {
            description: args.rule.description,
            priority: args.rule.priority,
            isActive: true,
            conditions: { sampleTag: SAMPLE_TAG } as Prisma.InputJsonValue,
          },
          select: { id: true, name: true },
        })
      : await tx.accountingRule.create({
          data: {
            empresaId: args.empresaId,
            eventType: args.rule.eventType,
            name: args.rule.name,
            description: args.rule.description,
            priority: args.rule.priority,
            isActive: true,
            conditions: { sampleTag: SAMPLE_TAG } as Prisma.InputJsonValue,
          },
          select: { id: true, name: true },
        })

    await tx.accountingRuleLine.deleteMany({ where: { ruleId: base.id } })

    await tx.accountingRuleLine.createMany({
      data: args.rule.lines.map((line, index) => {
        const accountId = args.accountByCode.get(line.accountCode)
        if (!accountId) {
          throw new Error(`No se encontró la cuenta ${line.accountCode} para la regla ${args.rule.name}.`)
        }
        const costCenterId = line.costCenterCode ? args.costCenterByCode.get(line.costCenterCode) ?? null : null
        return {
          ruleId: base.id,
          order: index + 1,
          side: line.side,
          amountKey: line.amountKey,
          multiplier: line.multiplier ?? 1,
          accountId,
          costCenterId,
          memoTemplate: line.memoTemplate,
        }
      }),
    })

    return base
  })
}

async function upsertVoucher(args: {
  empresaId: string
  actorUserId: string | null
  voucher: SeedVoucher
  accountByCode: Map<string, string>
  costCenterByCode: Map<string, string>
  periodByCode: Map<string, string>
}) {
  const totalDebit = args.voucher.lines.reduce((sum, line) => sum + line.debit, 0)
  const totalCredit = args.voucher.lines.reduce((sum, line) => sum + line.credit, 0)

  if (Math.round(totalDebit) !== Math.round(totalCredit)) {
    throw new Error(`El comprobante ${args.voucher.code} no cuadra en débito y crédito.`)
  }

  const periodId = args.periodByCode.get(args.voucher.periodCode)
  if (!periodId) {
    throw new Error(`No se encontró el período ${args.voucher.periodCode} para el comprobante ${args.voucher.code}.`)
  }

  return prisma.accountingVoucher.upsert({
    where: { empresaId_code: { empresaId: args.empresaId, code: args.voucher.code } },
    update: {
      periodId,
      voucherType: args.voucher.voucherType,
      status: args.voucher.status,
      date: args.voucher.date,
      description: args.voucher.description,
      externalReference: args.voucher.externalReference,
      thirdPartyName: args.voucher.thirdPartyName,
      thirdPartyDocument: args.voucher.thirdPartyDocument,
      currency: 'COP',
      notes: args.voucher.notes,
      metadata: { sampleTag: SAMPLE_TAG },
      totalDebit,
      totalCredit,
      approvedById: args.voucher.status === 'APPROVED' || args.voucher.status === 'POSTED' ? args.actorUserId : null,
      approvedAt: args.voucher.status === 'APPROVED' || args.voucher.status === 'POSTED' ? new Date() : null,
      lines: {
        deleteMany: {},
        create: args.voucher.lines.map((line, index) => {
          const accountId = args.accountByCode.get(line.accountCode)
          if (!accountId) {
            throw new Error(`No se encontró la cuenta ${line.accountCode} para el comprobante ${args.voucher.code}.`)
          }
          return {
            order: index + 1,
            accountId,
            costCenterId: line.costCenterCode ? args.costCenterByCode.get(line.costCenterCode) ?? null : null,
            thirdPartyName: line.thirdPartyName ?? args.voucher.thirdPartyName,
            thirdPartyDocument: line.thirdPartyDocument ?? args.voucher.thirdPartyDocument,
            debit: line.debit,
            credit: line.credit,
            memo: line.memo,
          }
        }),
      },
    },
    create: {
      empresaId: args.empresaId,
      periodId,
      voucherType: args.voucher.voucherType,
      status: args.voucher.status,
      code: args.voucher.code,
      date: args.voucher.date,
      description: args.voucher.description,
      externalReference: args.voucher.externalReference,
      thirdPartyName: args.voucher.thirdPartyName,
      thirdPartyDocument: args.voucher.thirdPartyDocument,
      currency: 'COP',
      notes: args.voucher.notes,
      metadata: { sampleTag: SAMPLE_TAG },
      totalDebit,
      totalCredit,
      createdById: args.actorUserId,
      approvedById: args.voucher.status === 'APPROVED' || args.voucher.status === 'POSTED' ? args.actorUserId : null,
      approvedAt: args.voucher.status === 'APPROVED' || args.voucher.status === 'POSTED' ? new Date() : null,
      lines: {
        create: args.voucher.lines.map((line, index) => {
          const accountId = args.accountByCode.get(line.accountCode)
          if (!accountId) {
            throw new Error(`No se encontró la cuenta ${line.accountCode} para el comprobante ${args.voucher.code}.`)
          }
          return {
            order: index + 1,
            accountId,
            costCenterId: line.costCenterCode ? args.costCenterByCode.get(line.costCenterCode) ?? null : null,
            thirdPartyName: line.thirdPartyName ?? args.voucher.thirdPartyName,
            thirdPartyDocument: line.thirdPartyDocument ?? args.voucher.thirdPartyDocument,
            debit: line.debit,
            credit: line.credit,
            memo: line.memo,
          }
        }),
      },
    },
    select: { id: true, code: true, status: true },
  })
}

async function main() {
  const target = await resolveTargetEmpresa()

  const accounts: SeedAccount[] = [
    { code: '110505', name: 'Caja general demo', type: 'ASSET', normalBalance: 'DEBIT' },
    { code: '130505', name: 'Clientes nacionales demo', type: 'ASSET', normalBalance: 'DEBIT' },
    { code: '220505', name: 'Proveedores nacionales demo', type: 'LIABILITY', normalBalance: 'CREDIT' },
    { code: '240805', name: 'IVA generado demo', type: 'LIABILITY', normalBalance: 'CREDIT' },
    { code: '240810', name: 'IVA descontable demo', type: 'ASSET', normalBalance: 'DEBIT' },
    { code: '413505', name: 'Ingresos operacionales demo', type: 'INCOME', normalBalance: 'CREDIT' },
    { code: '513505', name: 'Gastos operacionales demo', type: 'EXPENSE', normalBalance: 'DEBIT' },
  ]

  const costCenters: SeedCostCenter[] = [
    { code: 'ADM001', name: 'Administración general demo' },
    { code: 'VEN001', name: 'Comercial y ventas demo' },
    { code: 'OPE001', name: 'Operación y producción demo' },
  ]

  const periods = [
    {
      code: '2026-01',
      label: 'Enero 2026 demo',
      status: 'OPEN' as const,
      startsAt: new Date('2026-01-01T00:00:00.000Z'),
      endsAt: new Date('2026-01-31T23:59:59.000Z'),
      notes: 'Período abierto para pruebas base de contabilidad.',
    },
    {
      code: '2026-02',
      label: 'Febrero 2026 demo',
      status: 'LOCKED' as const,
      startsAt: new Date('2026-02-01T00:00:00.000Z'),
      endsAt: new Date('2026-02-28T23:59:59.000Z'),
      notes: 'Período bloqueado para validar estados intermedios.',
    },
    {
      code: '2026-03',
      label: 'Marzo 2026 demo',
      status: 'CLOSED' as const,
      startsAt: new Date('2026-03-01T00:00:00.000Z'),
      endsAt: new Date('2026-03-31T23:59:59.000Z'),
      notes: 'Período cerrado como referencia para flujo completo.',
    },
  ]

  const rules: SeedRule[] = [
    {
      name: 'Demo venta POS con IVA',
      eventType: 'POS_INVOICE',
      description: 'Reconoce caja, ingreso e IVA generado para una venta de mostrador.',
      priority: 10,
      lines: [
        { side: 'DEBIT', amountKey: 'TOTAL', accountCode: '110505', costCenterCode: 'VEN001', memoTemplate: 'Ingreso de caja por venta POS' },
        { side: 'CREDIT', amountKey: 'SUBTOTAL', accountCode: '413505', costCenterCode: 'VEN001', memoTemplate: 'Ingreso operacional por venta POS' },
        { side: 'CREDIT', amountKey: 'IVA', accountCode: '240805', costCenterCode: 'VEN001', memoTemplate: 'IVA generado por venta POS' },
      ],
    },
    {
      name: 'Demo compra operativa con IVA',
      eventType: 'COMPRA',
      description: 'Registra gasto operativo, IVA descontable y cuenta por pagar a proveedor.',
      priority: 20,
      lines: [
        { side: 'DEBIT', amountKey: 'SUBTOTAL', accountCode: '513505', costCenterCode: 'OPE001', memoTemplate: 'Gasto de compra operativa' },
        { side: 'DEBIT', amountKey: 'IVA', accountCode: '240810', costCenterCode: 'OPE001', memoTemplate: 'IVA descontable de compra' },
        { side: 'CREDIT', amountKey: 'TOTAL', accountCode: '220505', costCenterCode: 'OPE001', memoTemplate: 'Cuenta por pagar a proveedor' },
      ],
    },
    {
      name: 'Demo asiento manual de facturación',
      eventType: 'MANUAL',
      description: 'Base de asiento manual con cartera, ingreso e IVA.',
      priority: 30,
      lines: [
        { side: 'DEBIT', amountKey: 'TOTAL', accountCode: '130505', costCenterCode: 'ADM001', memoTemplate: 'Registro de cartera manual' },
        { side: 'CREDIT', amountKey: 'SUBTOTAL', accountCode: '413505', costCenterCode: 'ADM001', memoTemplate: 'Ingreso manual' },
        { side: 'CREDIT', amountKey: 'IVA', accountCode: '240805', costCenterCode: 'ADM001', memoTemplate: 'IVA generado manual' },
      ],
    },
  ]

  const vouchers: SeedVoucher[] = [
    {
      code: 'ING-BASE-001',
      voucherType: 'INGRESO',
      status: 'APPROVED',
      periodCode: '2026-01',
      date: new Date('2026-01-15T10:00:00.000Z'),
      description: 'Venta base aprobada con recaudo inmediato en caja.',
      externalReference: 'FV-DEMO-001',
      thirdPartyName: 'Cliente Demo Uno SAS',
      thirdPartyDocument: '900100100-1',
      notes: 'Comprobante de ejemplo para validar ingreso con IVA.',
      lines: [
        { accountCode: '110505', costCenterCode: 'VEN001', debit: 1190000, credit: 0, memo: 'Caja recibida venta demo' },
        { accountCode: '413505', costCenterCode: 'VEN001', debit: 0, credit: 1000000, memo: 'Ingreso base venta demo' },
        { accountCode: '240805', costCenterCode: 'VEN001', debit: 0, credit: 190000, memo: 'IVA generado venta demo' },
      ],
    },
    {
      code: 'EGR-BASE-001',
      voucherType: 'EGRESO',
      status: 'DRAFT',
      periodCode: '2026-02',
      date: new Date('2026-02-08T09:30:00.000Z'),
      description: 'Compra operativa pendiente de aprobación.',
      externalReference: 'FC-DEMO-221',
      thirdPartyName: 'Proveedor Demo Papel Ltda',
      thirdPartyDocument: '800200300-4',
      notes: 'Comprobante borrador para revisar flujo de egreso.',
      lines: [
        { accountCode: '513505', costCenterCode: 'OPE001', debit: 500000, credit: 0, memo: 'Gasto compra operativa demo' },
        { accountCode: '240810', costCenterCode: 'OPE001', debit: 95000, credit: 0, memo: 'IVA descontable compra demo' },
        { accountCode: '220505', costCenterCode: 'OPE001', debit: 0, credit: 595000, memo: 'Cuenta por pagar proveedor demo' },
      ],
    },
    {
      code: 'AJU-BASE-001',
      voucherType: 'AJUSTE',
      status: 'POSTED',
      periodCode: '2026-03',
      date: new Date('2026-03-20T16:45:00.000Z'),
      description: 'Asiento manual de cartera facturada y contabilizada.',
      externalReference: 'AJ-DEMO-310',
      thirdPartyName: 'Cliente Demo Dos SAS',
      thirdPartyDocument: '901300400-7',
      notes: 'Comprobante contabilizado para validar estado final.',
      lines: [
        { accountCode: '130505', costCenterCode: 'ADM001', debit: 2380000, credit: 0, memo: 'Registro de cartera demo' },
        { accountCode: '413505', costCenterCode: 'ADM001', debit: 0, credit: 2000000, memo: 'Ingreso manual demo' },
        { accountCode: '240805', costCenterCode: 'ADM001', debit: 0, credit: 380000, memo: 'IVA generado manual demo' },
      ],
    },
  ]

  const accountRows = await Promise.all(accounts.map((account) => upsertAccount(target.empresaId, account)))
  const costCenterRows = await Promise.all(costCenters.map((costCenter) => upsertCostCenter(target.empresaId, costCenter)))
  const periodRows = await Promise.all(periods.map((period) => upsertPeriod({ ...period, empresaId: target.empresaId, actorUserId: target.actorUserId })))

  const accountByCode = new Map(accountRows.map((row) => [row.code, row.id]))
  const costCenterByCode = new Map(costCenterRows.map((row) => [row.code, row.id]))
  const periodByCode = new Map(periodRows.map((row) => [row.code, row.id]))

  const ruleRows = await Promise.all(rules.map((rule) => upsertRule({ empresaId: target.empresaId, rule, accountByCode, costCenterByCode })))
  const voucherRows = await Promise.all(vouchers.map((voucher) => upsertVoucher({ empresaId: target.empresaId, actorUserId: target.actorUserId, voucher, accountByCode, costCenterByCode, periodByCode })))

  console.log(JSON.stringify({
    ok: true,
    sampleTag: SAMPLE_TAG,
    empresaId: target.empresaId,
    empresaNombre: target.empresaNombre,
    actor: target.actorLabel,
    seeded: {
      accounts: accountRows.length,
      costCenters: costCenterRows.length,
      periods: periodRows.length,
      rules: ruleRows.length,
      vouchers: voucherRows.length,
    },
    note: 'Libros, conciliaciones e impuestos siguen siendo vistas base sin persistencia propia; la semilla cubre las entidades reales del módulo.',
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('FAIL seed-accounting-sample', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
