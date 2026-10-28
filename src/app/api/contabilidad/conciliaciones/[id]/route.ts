import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { reopenBankReconciliation } from '@/lib/treasury-reconciliation'

export const runtime = 'nodejs'

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { id } = await context.params
  const result = await reopenBankReconciliation({ empresaId: access.empresaId, reconciliationId: id })

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.message }, { status: 404 })
  }

  return NextResponse.json({ ok: true, data: { bankAccountId: result.bankAccountId } })
}
