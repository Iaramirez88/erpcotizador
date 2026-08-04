import { NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { listOfficialBICatalog } from '@/lib/decision-engine/bi-catalog'

export const runtime = 'nodejs'

export async function GET() {
  const access = await requireApiAccess(ModuleKey.REPORTES, 'READ')
  if (!access.ok) return access.response

  return NextResponse.json({ success: true, data: listOfficialBICatalog() })
}