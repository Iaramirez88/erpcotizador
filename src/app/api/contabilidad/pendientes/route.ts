import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  ACCOUNTING_REFERENCE_TYPES,
  listPendingAccounting,
  postReferenceToAccounting,
  type AccountingReferenceType,
  type AutoPostOutcome,
} from '@/lib/accounting/auto-post'

export const runtime = 'nodejs'

function isReferenceType(value: string): value is AccountingReferenceType {
  return (ACCOUNTING_REFERENCE_TYPES as readonly string[]).includes(value)
}

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const daysParam = Number(request.nextUrl.searchParams.get('days') ?? '')
  const pending = await listPendingAccounting({
    empresaId: access.empresaId,
    days: Number.isFinite(daysParam) && daysParam > 0 ? daysParam : undefined,
  })

  return NextResponse.json({ ok: true, data: pending })
}

type PostBody = {
  all?: boolean
  days?: number
  referenceType?: string
  referenceId?: string
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as PostBody

  if (body.all === true) {
    const pending = await listPendingAccounting({
      empresaId: access.empresaId,
      days: typeof body.days === 'number' && body.days > 0 ? body.days : undefined,
    })

    const results: AutoPostOutcome[] = []
    for (const group of pending.groups) {
      for (const item of group.items) {
        results.push(
          await postReferenceToAccounting({
            empresaId: access.empresaId,
            userId: access.userId,
            referenceType: item.referenceType,
            referenceId: item.referenceId,
          })
        )
      }
    }

    const posted = results.filter((result) => result.entryId).length
    const skipped = results.filter((result) => !result.entryId && result.ok).length
    const failed = results.filter((result) => !result.ok).length

    return NextResponse.json({
      ok: true,
      data: {
        processed: results.length,
        posted,
        skipped,
        failed,
        failures: results.filter((result) => !result.ok).slice(0, 10),
        pending: await listPendingAccounting({
          empresaId: access.empresaId,
          days: typeof body.days === 'number' && body.days > 0 ? body.days : undefined,
        }),
      },
    })
  }

  const referenceTypeRaw = (body.referenceType ?? '').trim()
  const referenceId = (body.referenceId ?? '').trim()

  if (!isReferenceType(referenceTypeRaw) || !referenceId) {
    return NextResponse.json({ ok: false, error: 'referenceType y referenceId son requeridos' }, { status: 400 })
  }

  const outcome = await postReferenceToAccounting({
    empresaId: access.empresaId,
    userId: access.userId,
    referenceType: referenceTypeRaw,
    referenceId,
  })

  return NextResponse.json({ ok: outcome.ok, data: outcome })
}
