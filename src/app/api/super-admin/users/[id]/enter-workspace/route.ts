import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { createImpersonationToken } from '@/lib/impersonation-token'
import { getRequestBaseUrl } from '@/lib/app-url'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { email?: string | null; id?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user?.id || !isSuperAdminEmail(email)) return null
  return session
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  const sessionUserId = session.user!.id!

  const { id } = await ctx.params
  const targetUserId = (id ?? '').trim()
  if (!targetUserId) return NextResponse.json({ ok: false, error: 'Usuario inválido' }, { status: 400 })

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      empresaId: true,
      empresa: { select: { id: true, nombre: true } },
    },
  })

  if (!target?.id) return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 })
  if (!target.empresaId || !target.empresa?.id) {
    return NextResponse.json({ ok: false, error: 'El usuario no tiene espacio de trabajo asignado.' }, { status: 409 })
  }

  const token = await createImpersonationToken({
    issuedByUserId: sessionUserId,
    targetUserId: target.id,
  })
  const baseUrl = getRequestBaseUrl(_req)
  const accessPath = `/auth/impersonate?token=${encodeURIComponent(token.token)}`

  return NextResponse.json({
    ok: true,
    accessUrl: baseUrl ? `${baseUrl}${accessPath}` : accessPath,
    expiresAt: token.expiresAt.toISOString(),
  })
}