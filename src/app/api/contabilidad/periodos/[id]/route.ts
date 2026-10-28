import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, AccountingPeriodStatus, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { serializeAccountingPeriods } from '@/lib/accounting-periods'

export const runtime = 'nodejs'

type Context = { params: Promise<{ id: string }> }

function isStatus(value: string): value is AccountingPeriodStatus {
  return ['OPEN', 'CLOSED', 'LOCKED'].includes(value)
}

export async function PATCH(request: NextRequest, context: Context) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { id } = await context.params

  const period = await prisma.accountingPeriod.findFirst({
    where: { id, empresaId: access.empresaId },
    select: { id: true, status: true },
  })

  if (!period) {
    return NextResponse.json({ ok: false, error: 'Período contable no encontrado' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const status = typeof body.status === 'string' ? body.status.trim().toUpperCase() : ''

  if (!isStatus(status)) {
    return NextResponse.json({ ok: false, error: 'status debe ser OPEN, CLOSED o LOCKED' }, { status: 400 })
  }

  if (period.status === 'LOCKED' && status !== 'LOCKED') {
    return NextResponse.json(
      { ok: false, error: 'Un período bloqueado no se puede reabrir. Registra un período de ajuste.' },
      { status: 400 }
    )
  }

  if (period.status === status) {
    const unchanged = await serializeAccountingPeriods(access.empresaId)
    return NextResponse.json({ ok: true, data: unchanged })
  }

  const now = new Date()
  const updateData =
    status === 'OPEN'
      ? { status, closedAt: null, lockedAt: null }
      : status === 'CLOSED'
        ? { status, closedAt: now, lockedAt: null }
        : { status, closedAt: now, lockedAt: now }

  await prisma.accountingPeriod.update({ where: { id: period.id }, data: updateData })

  const data = await serializeAccountingPeriods(access.empresaId)
  return NextResponse.json({ ok: true, data })
}
