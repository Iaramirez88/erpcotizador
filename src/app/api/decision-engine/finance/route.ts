import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { isCompanyIntelligenceEnabledForEmpresa } from '@/lib/company-intelligence'
import { parseDateOnlyUtc } from '@/lib/decision-engine/dates'
import { createDecisionEngine } from '@/lib/decision-engine/engine'
import { requireSedeAccess } from '@/lib/rbac'

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
  const requestedSedeId = searchParams.get('sedeId')?.trim() || ''
  const sedeId = requestedSedeId || access.sedeId

  if (requestedSedeId && requestedSedeId !== access.sedeId) {
    try {
      await requireSedeAccess({ userId: access.userId, sedeId: requestedSedeId, module: ModuleKey.REPORTES, minLevel: AccessLevel.READ })
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN') {
        return NextResponse.json({ success: false, error: 'No tienes acceso a la sede solicitada.' }, { status: 403 })
      }
      throw error
    }
  }

  const engine = createDecisionEngine()
  const result = await engine.analyze('finance', {
    empresaId: access.empresaId,
    sedeId,
    actorUserId: access.userId,
    from,
    to,
    locale,
  })

  return NextResponse.json({ success: true, data: result })
}