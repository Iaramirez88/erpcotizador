import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { decryptWebsiteServicePassword, getWebsiteServicesAccessForUser } from '@/lib/website-services'

export const runtime = 'nodejs'

async function requireWebsiteServicesAccess() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 }) }
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Sesión inválida' }, { status: 401 }) }
  }

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess || !access.empresaId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Prohibido' }, { status: 403 }) }
  }

  return { ok: true as const, userId, access }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireWebsiteServicesAccess()
  if (!guard.ok) return guard.response

  const body: unknown = await req.json().catch(() => null)
  const userPassword =
    body && typeof body === 'object' && 'userPassword' in body && typeof body.userPassword === 'string'
      ? body.userPassword.trim()
      : ''

  if (!userPassword) {
    return NextResponse.json({ ok: false, error: 'Debes confirmar tu contraseña de acceso.' }, { status: 400 }) }

  const [user, params] = await Promise.all([
    prisma.user.findUnique({
      where: { id: guard.userId },
      select: { id: true, password: true },
    }),
    context.params,
  ])

  if (!user?.password) {
    return NextResponse.json({ ok: false, error: 'No fue posible validar tu contraseña.' }, { status: 400 })
  }

  const passwordIsValid = await bcrypt.compare(userPassword, user.password)
  if (!passwordIsValid) {
    return NextResponse.json({ ok: false, error: 'La contraseña del usuario es incorrecta.' }, { status: 401 })
  }

  const service = await prisma.websiteService.findFirst({
    where: { id: params.id, empresaId: guard.access.empresaId },
    select: { id: true, loginPasswordEncrypted: true },
  })

  if (!service?.id) {
    return NextResponse.json({ ok: false, error: 'Servicio web no encontrado.' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    password: decryptWebsiteServicePassword(service.loginPasswordEncrypted),
  })
}