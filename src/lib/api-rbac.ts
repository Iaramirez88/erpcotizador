import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveSedeForUser, requireSedeAccess } from '@/lib/rbac'
import type { Session } from 'next-auth'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { resolveUserIdFromSession } from '@/lib/session-user'

export type ApiAccessOk = {
  ok: true
  session: Session
  userId: string
  sedeId: string
  empresaId: string
}

export type ApiAccessFail = {
  ok: false
  response: NextResponse
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

  const empresaId = sede.empresaId
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      nit: true,
      registrationCodeHash: true,
      planValidUntil: true,
      planTier: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
    },
  })

  try {
    await requireSedeAccess({ userId, sedeId: sede.id, module: moduleKey, minLevel })
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return { ok: false, response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) }
    }
    throw error
  }

  return { ok: true, session, userId, sedeId: sede.id, empresaId }
}

export async function canAccessCompanyWideAiHistory(args: {
  userId: string
  sedeId: string
  sessionRole?: string | null
}) {
  if (args.sessionRole === 'ADMIN') return true

  const membership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId: args.sedeId, userId: args.userId } },
    select: { role: true },
  })

  return membership?.role === 'ADMIN' || membership?.role === 'MANAGER'
}
