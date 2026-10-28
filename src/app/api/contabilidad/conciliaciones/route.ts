import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  buildReconciliationReport,
  closeBankReconciliation,
  isValidIsoDate,
  todayIsoDate,
} from '@/lib/treasury-reconciliation'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const toParam = (request.nextUrl.searchParams.get('to') ?? '').trim()
  if (toParam && !isValidIsoDate(toParam)) {
    return NextResponse.json({ ok: false, error: 'to debe tener formato YYYY-MM-DD' }, { status: 400 })
  }

  const asOfIso = toParam || todayIsoDate()
  const report = await buildReconciliationReport({ empresaId: access.empresaId, asOfIso })

  return NextResponse.json({ ok: true, data: report })
}

type CloseBody = {
  bankAccountId?: string
  asOf?: string
  notes?: string | null
  movementIds?: string[]
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as CloseBody

  const bankAccountId = typeof body.bankAccountId === 'string' ? body.bankAccountId.trim() : ''
  if (!bankAccountId) {
    return NextResponse.json({ ok: false, error: 'bankAccountId es requerido' }, { status: 400 })
  }

  const asOfIso = (typeof body.asOf === 'string' && body.asOf.trim()) || todayIsoDate()
  if (!isValidIsoDate(asOfIso)) {
    return NextResponse.json({ ok: false, error: 'asOf debe tener formato YYYY-MM-DD' }, { status: 400 })
  }

  const result = await closeBankReconciliation({
    empresaId: access.empresaId,
    userId: access.userId,
    bankAccountId,
    asOfIso,
    notes: typeof body.notes === 'string' ? body.notes : null,
    movementIds: Array.isArray(body.movementIds) ? body.movementIds.map((id) => String(id)) : undefined,
  })

  if (!result.ok) {
    const status =
      result.code === 'BANK_ACCOUNT_NOT_FOUND'
        ? 404
        : result.code === 'INVALID_MOVEMENTS' || result.code === 'INVALID_DATE'
          ? 400
          : 409
    return NextResponse.json({ ok: false, error: result.message, code: result.code }, { status })
  }

  const report = await buildReconciliationReport({
    empresaId: access.empresaId,
    asOfIso,
  })

  return NextResponse.json({
    ok: true,
    data: {
      reconciliation: result.data,
      markedMovements: result.markedMovements,
      report,
    },
  })
}
