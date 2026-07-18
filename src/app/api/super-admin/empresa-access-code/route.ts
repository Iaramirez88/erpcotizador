import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'
import type { BillingCycle, PlanTier } from '@prisma/client'
import { ensureWorkspaceCodeForEmpresa } from '@/lib/workspace-code'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

type PostBody = {
  empresaId?: unknown
  nit?: unknown
  planTier?: unknown
  billingCycle?: unknown
}

export async function POST(req: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as PostBody
  const empresaId = typeof body.empresaId === 'string' ? body.empresaId.trim() : ''
  const nit = typeof body.nit === 'string' ? body.nit.trim() : ''

  const planTier = typeof body.planTier === 'string' ? (body.planTier as PlanTier) : null
  const billingCycle = typeof body.billingCycle === 'string' ? (body.billingCycle as BillingCycle) : null

  if (!empresaId && !nit) {
    return NextResponse.json({ ok: false, error: 'Debes enviar empresaId o NIT' }, { status: 400 })
  }

  const empresa = await prisma.empresa.findFirst({
    where: empresaId ? { id: empresaId } : { nit },
    select: { id: true, nit: true },
  })

  if (!empresa) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })
  const codePlain = await ensureWorkspaceCodeForEmpresa(empresa.id)

  await prisma.empresa.update({
    where: { id: empresa.id },
    data: {
      ...(planTier ? { planTier } : {}),
      ...(billingCycle ? { billingCycle } : {}),
    },
    select: { id: true },
  })

  return NextResponse.json({ ok: true, empresaId: empresa.id, nit: empresa.nit, code: codePlain })
}
