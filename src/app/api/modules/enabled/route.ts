import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ALL_MODULE_KEYS, getEnabledModulesForPlan } from '@/lib/plan-modules'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  // Super admin: ve todo.
  if (session.user.role === 'ADMIN') {
    return NextResponse.json({ ok: true, enabled: ALL_MODULE_KEYS, planTier: 'FULL' })
  }

  const userId = session.user.id
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true } })

  const empresa = user?.empresaId
    ? await prisma.empresa.findUnique({ where: { id: user.empresaId }, select: { planTier: true } })
    : null

  const planTier = empresa?.planTier ?? 'FULL'
  const enabled = await getEnabledModulesForPlan(planTier)

  return NextResponse.json({ ok: true, enabled, planTier })
}
