/**
 * Smoke test: contabilidad (Evento → Regla → Asiento)
 * Ejecutar con: npx tsx scripts/test-accounting-event.ts
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { generateJournalEntryFromRule } from '../src/lib/accounting/engine'

async function main() {
  const adminEmail = 'admin@sgdigital.com'

  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, empresaId: true, email: true },
  })

  const empresaId = admin?.empresaId
    ? admin.empresaId
    : (
        await prisma.user.findFirst({
          where: { empresaId: { not: null } },
          select: { empresaId: true },
          orderBy: { createdAt: 'asc' },
        })
      )?.empresaId ?? null

  if (!empresaId) {
    throw new Error(
      `No hay usuario con empresaId. Crea uno (ej: ${adminEmail}) o asigna empresaId a un usuario existente.`
    )
  }

  // 1) Plan de cuentas mínimo
  const cashAccount = await prisma.accountingAccount.upsert({
    where: { empresaId_code: { empresaId, code: '110505' } },
    update: {
      name: 'Caja (Smoke)',
      type: 'ASSET',
      normalBalance: 'DEBIT',
      isPosting: true,
      isActive: true,
    },
    create: {
      empresaId,
      code: '110505',
      name: 'Caja (Smoke)',
      type: 'ASSET',
      normalBalance: 'DEBIT',
      isPosting: true,
      isActive: true,
    },
    select: { id: true, code: true },
  })

  const incomeAccount = await prisma.accountingAccount.upsert({
    where: { empresaId_code: { empresaId, code: '413505' } },
    update: {
      name: 'Ingresos (Smoke)',
      type: 'INCOME',
      normalBalance: 'CREDIT',
      isPosting: true,
      isActive: true,
    },
    create: {
      empresaId,
      code: '413505',
      name: 'Ingresos (Smoke)',
      type: 'INCOME',
      normalBalance: 'CREDIT',
      isPosting: true,
      isActive: true,
    },
    select: { id: true, code: true },
  })

  // 2) Regla mínima: TOTAL al débito y TOTAL al crédito
  const ruleName = 'SMOKE · POS_INVOICE · TOTAL vs TOTAL'

  const rule = await prisma.$transaction(async (tx) => {
    const existing = await tx.accountingRule.findFirst({
      where: { empresaId, eventType: 'POS_INVOICE', name: ruleName },
      select: { id: true },
    })

    const base = existing
      ? await tx.accountingRule.update({
          where: { id: existing.id },
          data: { isActive: true, priority: 1, conditions: {} },
          select: { id: true },
        })
      : await tx.accountingRule.create({
          data: {
            empresaId,
            eventType: 'POS_INVOICE',
            name: ruleName,
            description: 'Regla mínima para smoke test',
            isActive: true,
            priority: 1,
            conditions: {},
          },
          select: { id: true },
        })

    await tx.accountingRuleLine.deleteMany({ where: { ruleId: base.id } })

    await tx.accountingRuleLine.createMany({
      data: [
        {
          ruleId: base.id,
          order: 1,
          side: 'DEBIT',
          accountId: cashAccount.id,
          amountKey: 'TOTAL',
          multiplier: 1,
          memoTemplate: 'Caja (smoke)',
        },
        {
          ruleId: base.id,
          order: 2,
          side: 'CREDIT',
          accountId: incomeAccount.id,
          amountKey: 'TOTAL',
          multiplier: 1,
          memoTemplate: 'Ingresos (smoke)',
        },
      ],
    })

    return base
  })

  console.log('OK regla lista:', rule.id)
  console.log('OK cuentas:', cashAccount.code, incomeAccount.code)

  // 3) Generar asiento desde el engine
  const referenceType = 'SMOKE'
  const referenceId = `POS-${Date.now()}`

  const entry = await generateJournalEntryFromRule({
    empresaId,
    userId: admin?.id ?? null,
    eventType: 'POS_INVOICE',
    referenceType,
    referenceId,
    date: new Date(),
    description: 'Smoke POS invoice (contabilidad)',
    amounts: {
      SUBTOTAL: 100000,
      IVA: 19000,
      TOTAL: 119000,
    },
    currency: 'COP',
  })

  console.log('OK asiento creado:', entry.id)

  // 4) Deduplicación (mismo referenceType+referenceId)
  try {
    await generateJournalEntryFromRule({
      empresaId,
      userId: admin?.id ?? null,
      eventType: 'POS_INVOICE',
      referenceType,
      referenceId,
      date: new Date(),
      description: 'Smoke POS invoice (dup)',
      amounts: { TOTAL: 119000 },
      currency: 'COP',
    })

    throw new Error('Se esperaba error de deduplicación pero se generó un asiento duplicado')
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (!msg.toLowerCase().includes('ya existe un asiento')) {
      throw e
    }
    console.log('OK deduplicación:', msg)
  }
}

main()
  .catch((e) => {
    console.error('FAIL', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
