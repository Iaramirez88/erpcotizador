import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, AccountingPeriodStatus, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { buildAccountingRange, nextAccountingPeriodCode, type AccountingPeriodRow } from '@/lib/accounting-core'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asDate(value: unknown) {
  const raw = asString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isStatus(value: string): value is AccountingPeriodStatus {
  return ['OPEN', 'CLOSED', 'LOCKED'].includes(value)
}

async function serializePeriods(empresaId: string): Promise<AccountingPeriodRow[]> {
  const rows = await prisma.accountingPeriod.findMany({
    where: { empresaId },
    orderBy: [{ startsAt: 'desc' }],
    include: {
      _count: { select: { vouchers: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    code: item.code,
    label: item.label,
    status: item.status,
    range: buildAccountingRange(item.startsAt, item.endsAt),
    closedAt: item.closedAt?.toISOString() ?? null,
    lockedAt: item.lockedAt?.toISOString() ?? null,
    vouchersCount: item._count.vouchers,
  }))
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const data = await serializePeriods(access.empresaId)
  return NextResponse.json({ ok: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const label = asString(body.label)
  const startsAt = asDate(body.startsAt)
  const endsAt = asDate(body.endsAt)
  const status = asString(body.status) || 'OPEN'

  if (!label || !startsAt || !endsAt || !isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'label, startsAt y endsAt son requeridos' }, { status: 400 })
  }

  const count = await prisma.accountingPeriod.count({ where: { empresaId: access.empresaId } })

  await prisma.accountingPeriod.create({
    data: {
      empresaId: access.empresaId,
      code: asString(body.code) || nextAccountingPeriodCode(count + 1, startsAt.getFullYear()),
      label,
      status,
      startsAt,
      endsAt,
      notes: asString(body.notes) || null,
      createdById: access.userId,
      closedAt: status === 'CLOSED' ? new Date() : null,
      lockedAt: status === 'LOCKED' ? new Date() : null,
    },
  })

  const data = await serializePeriods(access.empresaId)
  return NextResponse.json({ ok: true, data })
}