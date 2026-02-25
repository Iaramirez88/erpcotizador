import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ALL_MODULE_KEYS } from '@/lib/plan-modules'
import { resolveEffectivePlanTier } from '@/lib/plan-access'
import { requireEmpresaIdForUser } from '@/lib/rbac'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

    // Super admin: ve todo.
    if (session.user.role === 'ADMIN') {
      return NextResponse.json({ ok: true, enabled: ALL_MODULE_KEYS, planTier: 'FULL' })
    }

    const userId = session.user.id
    const empresaId = await requireEmpresaIdForUser(userId)

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: {
        nit: true,
        registrationCodeHash: true,
        planTier: true,
        planValidUntil: true,
        trialTier: true,
        trialStartedAt: true,
        trialValidUntil: true,
      },
    })

    const planTier = empresa ? resolveEffectivePlanTier(empresa, new Date()) : 'FULL'

    // Todos los módulos disponibles: el control se hace por límites de uso (transacciones), no por módulos.
    return NextResponse.json({ ok: true, enabled: ALL_MODULE_KEYS, planTier })
  } catch (error: unknown) {
    console.error('GET /api/modules/enabled error:', error)
    return NextResponse.json({ ok: true, enabled: ALL_MODULE_KEYS, planTier: 'FULL', degraded: true })
  }
}
