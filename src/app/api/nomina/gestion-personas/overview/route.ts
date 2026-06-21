import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { getPayrollPeopleOverview } from '@/lib/payroll-people'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
    if (!access.ok) return access.response

    const data = await getPayrollPeopleOverview(access.empresaId)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error('GET /api/nomina/gestion-personas/overview error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo cargar la estación de gestión de personas' }, { status: 500 })
  }
}