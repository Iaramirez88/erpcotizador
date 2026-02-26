import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'

export const runtime = 'nodejs'

async function resolveUserIdFromSession(session: { user?: { id?: string; email?: string | null } }) {
  if (session.user?.id) {
    const userById = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } })
    if (userById?.id) return userById.id
  }
  const email = session.user?.email
  if (!email) return null
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const empresaId = await requireEmpresaIdForUser(userId)

  const { searchParams } = new URL(req.url)
  const limitRaw = Number(searchParams.get('limit') ?? 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.trunc(limitRaw))) : 10

  const versions = await prisma.empresaCotizacionTemplateVersion.findMany({
    where: { empresaId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, createdAt: true },
  })

  return NextResponse.json({ success: true, data: { versions } })
}
