import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  AccessLevel,
  AccountingAmountKey,
  AccountingEventType,
  AccountingPostingSide,
  ModuleKey,
} from '@prisma/client'
import type { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const num = Number(value)
    if (Number.isFinite(num)) return num
  }
  return null
}

type RuleLineInput = {
  side: AccountingPostingSide
  amountKey: AccountingAmountKey
  multiplier?: number
  accountId?: string
  accountCode?: string
  costCenterId?: string | null
  memo?: string | null
}

function isPostingSide(value: string): value is AccountingPostingSide {
  return value === 'DEBIT' || value === 'CREDIT'
}
function isAmountKey(value: string): value is AccountingAmountKey {
  return (
    value === 'SUBTOTAL' ||
    value === 'IVA' ||
    value === 'DESCUENTO' ||
    value === 'RETENCION' ||
    value === 'RETEICA' ||
    value === 'AUTORETENCION' ||
    value === 'TOTAL'
  )
}
function isEventType(value: string): value is AccountingEventType {
  return (
    value === 'POS_INVOICE' ||
    value === 'POS_RETURN' ||
    value === 'COMPRA' ||
    value === 'COMPRA_PAGO' ||
    value === 'DIAN_DOCUMENT' ||
    value === 'MANUAL'
  )
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const rows = await prisma.accountingRule.findMany({
    where: { empresaId: access.empresaId },
    orderBy: [{ eventType: 'asc' }, { priority: 'asc' }],
    select: {
      id: true,
      name: true,
      eventType: true,
      isActive: true,
      priority: true,
      conditions: true,
      createdAt: true,
      lines: {
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          order: true,
          side: true,
          amountKey: true,
          multiplier: true,
          accountId: true,
          costCenterId: true,
          memoTemplate: true,
        },
      },
    },
  })

  return NextResponse.json({ ok: true, data: rows })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const name = asString(body.name).trim()
  const eventTypeRaw = asString(body.eventType).trim()
  const priority = asNumber(body.priority) ?? 100
  const isActive = body.isActive === false ? false : true
  const conditions = (body.conditionsJson ?? body.conditions ?? {}) as Prisma.InputJsonValue
  const lines = (Array.isArray(body.lines) ? body.lines : []) as RuleLineInput[]

  if (!name) {
    return NextResponse.json({ ok: false, error: 'name es requerido' }, { status: 400 })
  }

  if (!isEventType(eventTypeRaw)) {
    return NextResponse.json({ ok: false, error: 'eventType inválido' }, { status: 400 })
  }

  if (!lines.length) {
    return NextResponse.json({ ok: false, error: 'lines es requerido' }, { status: 400 })
  }

  // Resolve account references by id or by code
  const normalizedLines = await Promise.all(
    lines.map(async (line, idx) => {
      const sideRaw = asString(line.side)
      const amountKeyRaw = asString(line.amountKey)

      if (!isPostingSide(sideRaw)) {
        throw new Error(`Línea ${idx + 1}: side inválido`)
      }
      if (!isAmountKey(amountKeyRaw)) {
        throw new Error(`Línea ${idx + 1}: amountKey inválido`)
      }

      let accountId = asString(line.accountId).trim()
      const accountCode = asString(line.accountCode).trim()

      if (!accountId && accountCode) {
        const acc = await prisma.accountingAccount.findFirst({
          where: { empresaId: access.empresaId, code: accountCode, isActive: true },
          select: { id: true },
        })
        if (!acc) {
          throw new Error(`Línea ${idx + 1}: accountCode no existe (${accountCode})`)
        }
        accountId = acc.id
      }

      if (!accountId) {
        throw new Error(`Línea ${idx + 1}: accountId o accountCode es requerido`)
      }

      const multiplier = typeof line.multiplier === 'number' && Number.isFinite(line.multiplier) ? line.multiplier : 1

      return {
        order: idx + 1,
        side: sideRaw,
        amountKey: amountKeyRaw,
        multiplier,
        accountId,
        costCenterId: line.costCenterId ?? null,
        memoTemplate: line.memo ?? null,
      }
    }),
  )

  try {
    const created = await prisma.$transaction(async (tx) => {
      const rule = await tx.accountingRule.create({
        data: {
          empresaId: access.empresaId,
          name,
          eventType: eventTypeRaw,
          isActive,
          priority,
          conditions,
        },
        select: { id: true, name: true, eventType: true, isActive: true, priority: true, conditions: true, createdAt: true },
      })

      await tx.accountingRuleLine.createMany({
        data: normalizedLines.map((l) => ({ ...l, ruleId: rule.id })),
      })

      const withLines = await tx.accountingRule.findUnique({
        where: { id: rule.id },
        select: {
          id: true,
          name: true,
          eventType: true,
          isActive: true,
          priority: true,
          conditions: true,
          createdAt: true,
          lines: {
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              order: true,
              side: true,
              amountKey: true,
              multiplier: true,
              accountId: true,
              costCenterId: true,
              memoTemplate: true,
            },
          },
        },
      })

      return withLines
    })

    return NextResponse.json({ ok: true, data: created })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error creando regla' },
      { status: 400 },
    )
  }
}
