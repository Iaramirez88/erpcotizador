import { NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { isCompanyIntelligenceEnabledForEmpresa } from '@/lib/company-intelligence'
import { listOfficialBICatalog } from '@/lib/decision-engine/bi-catalog'

export const runtime = 'nodejs'

export async function GET() {
  const access = await requireApiAccess(ModuleKey.REPORTES, 'READ')
  if (!access.ok) return access.response
  if (!(await isCompanyIntelligenceEnabledForEmpresa(access.empresaId))) {
    return NextResponse.json({ success: false, error: 'El motor de inteligencia empresarial está apagado para esta empresa.' }, { status: 403 })
  }

  return NextResponse.json({ success: true, data: listOfficialBICatalog() })
}