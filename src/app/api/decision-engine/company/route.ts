import { NextRequest, NextResponse } from 'next/server'
import { createDecisionEngine } from '@/lib/decision-engine/engine'
import { parseDateOnlyUtc } from '@/lib/decision-engine/dates'
import { requireApiAccess } from '@/lib/api-rbac'
import { isCompanyIntelligenceEnabledForEmpresa } from '@/lib/company-intelligence'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.REPORTES, 'READ')
  if (!access.ok) return access.response
  if (!(await isCompanyIntelligenceEnabledForEmpresa(access.empresaId))) {
    return NextResponse.json({ success: false, error: 'El motor de inteligencia empresarial está apagado para esta empresa.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = parseDateOnlyUtc(searchParams.get('from') || '', false) ?? undefined
  const to = parseDateOnlyUtc(searchParams.get('to') || '', true) ?? undefined
  const locale = searchParams.get('locale')?.trim() || 'es-CO'

  const engine = createDecisionEngine()
  const result = await engine.analyzeCompany({
    empresaId: access.empresaId,
    sedeId: access.sedeId,
    actorUserId: access.userId,
    from,
    to,
    locale,
  })

  return NextResponse.json({
    success: true,
    data: result,
  })
}