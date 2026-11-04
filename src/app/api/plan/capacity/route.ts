import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { PLAN_CAPACITY_RESOURCES, getPlanCapacitySnapshot } from '@/lib/plan-capacity'

export const runtime = 'nodejs'

/**
 * Consumo de capacidad de una empresa.
 *
 * - Empresa: devuelve su propio snapshot (`/api/plan/capacity`).
 * - Super admin: puede consultar cualquier empresa con `?empresaId=...`.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { empresaId: true, email: true },
    })

    const isSuperAdmin = isSuperAdminEmail(user?.email ?? session.user.email ?? null)
    const params = req.nextUrl.searchParams
    const requestedEmpresaId = params.get('empresaId')
    const notify = params.get('notify') === '1'
    const fresh = params.get('fresh') === '1'

    if (requestedEmpresaId && !isSuperAdmin) {
      return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 })
    }

    const empresaId = (isSuperAdmin && requestedEmpresaId) || user?.empresaId || null

    if (!empresaId) {
      return NextResponse.json({
        ok: true,
        isSuperAdmin,
        companyId: null,
        companyName: null,
        planTier: null,
        generatedAt: new Date().toISOString(),
        meters: [],
        summary: null,
        resources: PLAN_CAPACITY_RESOURCES,
      })
    }

    const snapshot = await getPlanCapacitySnapshot({ companyId: empresaId, fresh, notify })

    if (!snapshot) {
      return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      isSuperAdmin,
      ...snapshot,
      resources: PLAN_CAPACITY_RESOURCES,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'No se pudo calcular el consumo del plan' }, { status: 500 })
  }
}
