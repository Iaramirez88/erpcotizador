import { prisma } from '@/lib/prisma'
import type {
  AccountingAccountType,
  AccountingAmountKey,
  AccountingEventType,
  AccountingNormalBalance,
  AccountingPostingSide,
} from '@prisma/client'

export type BaseAccount = {
  code: string
  name: string
  type: AccountingAccountType
  normalBalance: AccountingNormalBalance
  isPosting?: boolean
  parentCode?: string | null
}

export type BaseRuleLine = {
  side: AccountingPostingSide
  amountKey: AccountingAmountKey
  accountCode: string
  memoTemplate: string
  multiplier?: number
}

export type BaseRule = {
  name: string
  eventType: AccountingEventType
  description: string
  priority: number
  lines: BaseRuleLine[]
}

/** Plan de cuentas base (PUC Colombia, auxiliares mínimos para operar). */
export const BASE_ACCOUNTS: BaseAccount[] = [
  { code: '110505', name: 'Caja general', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '111005', name: 'Bancos - moneda nacional', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '130505', name: 'Clientes nacionales', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '135515', name: 'Retención en la fuente (saldo a favor)', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '143505', name: 'Mercancías no fabricadas por la empresa', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '220505', name: 'Proveedores nacionales', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '236505', name: 'Retención en la fuente practicada', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '240805', name: 'IVA generado', type: 'LIABILITY', normalBalance: 'CREDIT' },
  { code: '240810', name: 'IVA descontable', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: '310505', name: 'Capital suscrito y pagado', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '360505', name: 'Utilidad del ejercicio', type: 'EQUITY', normalBalance: 'CREDIT' },
  { code: '413505', name: 'Ingresos operacionales - ventas', type: 'INCOME', normalBalance: 'CREDIT' },
  { code: '417505', name: 'Devoluciones, rebajas y descuentos en ventas', type: 'INCOME', normalBalance: 'DEBIT' },
  { code: '513505', name: 'Gastos operacionales de administración', type: 'EXPENSE', normalBalance: 'DEBIT' },
  { code: '613505', name: 'Costo de ventas', type: 'EXPENSE', normalBalance: 'DEBIT' },
]

/**
 * Reglas base por evento. Cada regla debe cuadrar por construcción:
 * los montos que se envían al motor cumplen TOTAL = SUBTOTAL + IVA neto de descuento.
 */
export const BASE_RULES: BaseRule[] = [
  {
    name: 'Base - Venta POS',
    eventType: 'POS_INVOICE',
    description: 'Venta de contado registrada en POS (caja general).',
    priority: 100,
    lines: [
      { side: 'DEBIT', amountKey: 'TOTAL', accountCode: '110505', memoTemplate: 'Recaudo venta {referenceId}' },
      { side: 'CREDIT', amountKey: 'SUBTOTAL', accountCode: '413505', memoTemplate: 'Ingreso operacional {referenceId}' },
      { side: 'CREDIT', amountKey: 'IVA', accountCode: '240805', memoTemplate: 'IVA generado {referenceId}' },
    ],
  },
  {
    name: 'Base - Devolución POS',
    eventType: 'POS_RETURN',
    description: 'Devolución de venta POS (contra-ingreso y salida de caja).',
    priority: 100,
    lines: [
      { side: 'DEBIT', amountKey: 'SUBTOTAL', accountCode: '417505', memoTemplate: 'Devolución en ventas {referenceId}' },
      { side: 'DEBIT', amountKey: 'IVA', accountCode: '240805', memoTemplate: 'IVA devuelto {referenceId}' },
      { side: 'CREDIT', amountKey: 'TOTAL', accountCode: '110505', memoTemplate: 'Reembolso devolución {referenceId}' },
    ],
  },
  {
    name: 'Base - Compra autorizada',
    eventType: 'COMPRA',
    description: 'Compra de inventario a crédito con IVA descontable.',
    priority: 100,
    lines: [
      { side: 'DEBIT', amountKey: 'SUBTOTAL', accountCode: '143505', memoTemplate: 'Compra inventario {referenceId}' },
      { side: 'DEBIT', amountKey: 'IVA', accountCode: '240810', memoTemplate: 'IVA descontable {referenceId}' },
      { side: 'CREDIT', amountKey: 'TOTAL', accountCode: '220505', memoTemplate: 'Cuenta por pagar proveedor {referenceId}' },
    ],
  },
  {
    name: 'Base - Pago a proveedor',
    eventType: 'COMPRA_PAGO',
    description: 'Pago de compra: baja la cuenta por pagar contra bancos.',
    priority: 100,
    lines: [
      { side: 'DEBIT', amountKey: 'TOTAL', accountCode: '220505', memoTemplate: 'Pago proveedor {referenceId}' },
      { side: 'CREDIT', amountKey: 'TOTAL', accountCode: '111005', memoTemplate: 'Salida bancos {referenceId}' },
    ],
  },
  {
    name: 'Base - Documento DIAN recibido',
    eventType: 'DIAN_DOCUMENT',
    description: 'Factura electrónica recibida (compra) sin registro previo en Compras.',
    priority: 100,
    lines: [
      { side: 'DEBIT', amountKey: 'SUBTOTAL', accountCode: '143505', memoTemplate: 'Compra electrónica {referenceId}' },
      { side: 'DEBIT', amountKey: 'IVA', accountCode: '240810', memoTemplate: 'IVA descontable electrónico {referenceId}' },
      { side: 'CREDIT', amountKey: 'TOTAL', accountCode: '220505', memoTemplate: 'Cuenta por pagar electrónica {referenceId}' },
    ],
  },
]


export type InstallBasePlanResult = {
  accountsCreated: number
  accountsLinked: number
  rulesCreated: number
  rulesSkipped: number
}

/**
 * Instala (idempotente) el plan de cuentas y las reglas base para la empresa.
 * No sobreescribe reglas existentes con el mismo nombre/evento.
 */
export async function installBaseAccountingPlan(empresaId: string): Promise<InstallBasePlanResult> {
  const existingAccounts = await prisma.accountingAccount.findMany({
    where: { empresaId },
    select: { id: true, code: true, isPosting: true },
  })

  const accountByCode = new Map(existingAccounts.map((account) => [account.code, account]))

  let accountsCreated = 0
  for (const account of BASE_ACCOUNTS) {
    if (accountByCode.has(account.code)) continue
    const created = await prisma.accountingAccount.create({
      data: {
        empresaId,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
        isPosting: account.isPosting ?? true,
      },
      select: { id: true, code: true, isPosting: true },
    })
    accountByCode.set(created.code, created)
    accountsCreated += 1
  }

  let accountsLinked = 0
  for (const account of BASE_ACCOUNTS) {
    if (!account.parentCode) continue
    const child = accountByCode.get(account.code)
    const parent = accountByCode.get(account.parentCode)
    if (!child || !parent) continue
    await prisma.accountingAccount.update({ where: { id: child.id }, data: { parentId: parent.id }, select: { id: true } })
    accountsLinked += 1
  }

  let rulesCreated = 0
  let rulesSkipped = 0

  for (const rule of BASE_RULES) {
    const existing = await prisma.accountingRule.findFirst({
      where: { empresaId, eventType: rule.eventType, name: rule.name },
      select: { id: true },
    })

    if (existing) {
      rulesSkipped += 1
      continue
    }

    const lines = rule.lines.map((line, index) => {
      const account = accountByCode.get(line.accountCode)
      if (!account) throw new Error(`Cuenta base faltante: ${line.accountCode}`)
      return {
        order: index + 1,
        side: line.side,
        amountKey: line.amountKey,
        multiplier: line.multiplier ?? 1,
        accountId: account.id,
        memoTemplate: line.memoTemplate,
      }
    })

    await prisma.accountingRule.create({
      data: {
        empresaId,
        eventType: rule.eventType,
        name: rule.name,
        description: rule.description,
        priority: rule.priority,
        conditions: {},
        lines: { create: lines },
      },
      select: { id: true },
    })

    rulesCreated += 1
  }

  return { accountsCreated, accountsLinked, rulesCreated, rulesSkipped }
}

/** Eventos que el ERP puede contabilizar automáticamente hoy. */
export const AUTOMATION_EVENTS: AccountingEventType[] = [
  'POS_INVOICE',
  'POS_RETURN',
  'COMPRA',
  'COMPRA_PAGO',
  'DIAN_DOCUMENT',
]

export type AccountingBaseStatus = {
  installed: boolean
  accounts: number
  postingAccounts: number
  costCenters: number
  rules: number
  activeRules: number
  journalEntries: number
  vouchers: number
  eventsWithRules: AccountingEventType[]
  missingEvents: AccountingEventType[]
}

export async function getAccountingBaseStatus(empresaId: string): Promise<AccountingBaseStatus> {
  const [accounts, postingAccounts, costCenters, rules, activeRules, journalEntries, vouchers, ruleEvents] =
    await Promise.all([
      prisma.accountingAccount.count({ where: { empresaId } }),
      prisma.accountingAccount.count({ where: { empresaId, isPosting: true, isActive: true } }),
      prisma.accountingCostCenter.count({ where: { empresaId } }),
      prisma.accountingRule.count({ where: { empresaId } }),
      prisma.accountingRule.count({ where: { empresaId, isActive: true } }),
      prisma.accountingJournalEntry.count({ where: { empresaId, status: 'POSTED' } }),
      prisma.accountingVoucher.count({ where: { empresaId } }),
      prisma.accountingRule.findMany({
        where: { empresaId, isActive: true },
        select: { eventType: true },
        distinct: ['eventType'],
      }),
    ])

  const eventsWithRules = Array.from(new Set(ruleEvents.map((row) => row.eventType)))

  return {
    installed: postingAccounts > 0 && activeRules > 0,
    accounts,
    postingAccounts,
    costCenters,
    rules,
    activeRules,
    journalEntries,
    vouchers,
    eventsWithRules,
    missingEvents: AUTOMATION_EVENTS.filter((event) => !eventsWithRules.includes(event)),
  }
}

