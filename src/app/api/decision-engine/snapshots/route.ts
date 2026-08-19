import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { isCompanyIntelligenceEnabledForEmpresa } from '@/lib/company-intelligence'
import { parseDateOnlyUtc } from '@/lib/decision-engine/dates'
import { listDecisionEngineSnapshots, persistDecisionEngineSnapshot } from '@/lib/decision-engine/snapshots'
import { requireSedeAccess } from '@/lib/rbac'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.REPORTES, 'READ')
  if (!access.ok) return access.response
  if (!(await isCompanyIntelligenceEnabledForEmpresa(access.empresaId))) {
    return NextResponse.json({ success: false, error: 'El motor de inteligencia empresarial está apagado para esta empresa.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') || '12')
  const includeBundle = searchParams.get('includeBundle') === 'true'
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

  const data = await listDecisionEngineSnapshots({
    empresaId: access.empresaId,
    sedeId,
    limit: Number.isFinite(limit) ? limit : 12,
    includeBundle,
  })

  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.REPORTES, 'READ')
  if (!access.ok) return access.response
  if (!(await isCompanyIntelligenceEnabledForEmpresa(access.empresaId))) {
    return NextResponse.json({ success: false, error: 'El motor de inteligencia empresarial está apagado para esta empresa.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    from?: string
    to?: string
    locale?: string
    force?: boolean
  }

  const snapshot = await persistDecisionEngineSnapshot({
    empresaId: access.empresaId,
    sedeId: access.sedeId,
    actorUserId: access.userId,
    from: parseDateOnlyUtc(body.from || '', false) ?? undefined,
    to: parseDateOnlyUtc(body.to || '', true) ?? undefined,
    locale: body.locale?.trim() || 'es-CO',
  }, {
    force: body.force === true,
  })

  return NextResponse.json({ success: true, data: snapshot }, { status: 201 })
}