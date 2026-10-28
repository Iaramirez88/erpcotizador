import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { getAccountingBaseStatus, installBaseAccountingPlan } from '@/lib/accounting/base-plan'

export const runtime = 'nodejs'

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const status = await getAccountingBaseStatus(access.empresaId)
  return NextResponse.json({ ok: true, data: status })
}

export async function POST() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  try {
    const installed = await installBaseAccountingPlan(access.empresaId)
    const status = await getAccountingBaseStatus(access.empresaId)
    return NextResponse.json({ ok: true, data: { ...installed, status } })
  } catch (error) {
    console.error('Error instalando la base contable:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error instalando la base contable' },
      { status: 500 }
    )
  }
}
