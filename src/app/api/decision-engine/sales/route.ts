import { ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { parseDateOnlyUtc } from '@/lib/decision-engine/dates'
import { createDecisionEngine } from '@/lib/decision-engine/engine'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.REPORTES, 'READ')
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const from = parseDateOnlyUtc(searchParams.get('from') || '', false) ?? undefined
  const to = parseDateOnlyUtc(searchParams.get('to') || '', true) ?? undefined
  const locale = searchParams.get('locale')?.trim() || 'es-CO'

  const engine = createDecisionEngine()
  const result = await engine.analyzeSales({
    empresaId: access.empresaId,
    sedeId: access.sedeId,
    actorUserId: access.userId,
    from,
    to,
    locale,
  })

  return NextResponse.json({ success: true, data: result })
}