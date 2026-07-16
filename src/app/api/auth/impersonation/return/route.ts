import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getRequestBaseUrl } from '@/lib/app-url'
import { createImpersonationToken } from '@/lib/impersonation-token'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const session = await auth()
  const targetUserId = session?.user?.impersonatedByUserId?.trim() ?? ''
  const currentUserId = session?.user?.id?.trim() ?? ''

  if (!session?.user || !session.user.isImpersonating || !targetUserId || !currentUserId) {
    return NextResponse.json({ ok: false, error: 'No hay una sesión temporal activa.' }, { status: 400 })
  }

  const issuer = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true },
  })

  if (!issuer?.id || !isSuperAdminEmail(issuer.email)) {
    return NextResponse.json({ ok: false, error: 'El superadmin original ya no está disponible.' }, { status: 409 })
  }

  const token = await createImpersonationToken({
    issuedByUserId: currentUserId,
    targetUserId: issuer.id,
  })

  const baseUrl = getRequestBaseUrl(request)
  const accessPath = `/auth/impersonate?token=${encodeURIComponent(token.token)}`

  return NextResponse.json({
    ok: true,
    accessUrl: baseUrl ? `${baseUrl}${accessPath}` : accessPath,
    expiresAt: token.expiresAt.toISOString(),
  })
}