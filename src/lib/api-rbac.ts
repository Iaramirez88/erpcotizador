import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveSedeForUser, requireSedeAccess } from '@/lib/rbac'
import type { Session } from 'next-auth'
import { AccessLevel, ModuleKey } from '@prisma/client'

export type ApiAccessOk = {
  ok: true
  session: Session
  userId: string
  sedeId: string
}

export type ApiAccessFail = {
  ok: false
  response: NextResponse
}

async function resolveUserIdFromSession(session: Session): Promise<string | null> {
  const id = session.user?.id
  if (id) {
    const userById = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (userById?.id) return userById.id
  }

  const email = session.user?.email
  if (!email) return null

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

export async function requireApiAccess(
  moduleKey: ModuleKey,
  minLevel: AccessLevel
): Promise<ApiAccessOk | ApiAccessFail> {
  const session = await auth()
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sesión inválida. Vuelve a iniciar sesión.' }, { status: 401 }),
    }
  }

  const sede = await getActiveSedeForUser(userId)

  try {
    await requireSedeAccess({ userId, sedeId: sede.id, module: moduleKey, minLevel })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return { ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) }
    }
    throw error
  }

  return { ok: true, session, userId, sedeId: sede.id }
}
