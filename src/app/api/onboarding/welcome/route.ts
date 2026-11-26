import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TRIAL_MILESTONE_SEEN_KEYS, type TrialMilestone } from '@/lib/free-trial-setting'

export const runtime = 'nodejs'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function resolveMilestoneKey(milestone: unknown): string {
  if (typeof milestone === 'string' && milestone in TRIAL_MILESTONE_SEEN_KEYS) {
    return TRIAL_MILESTONE_SEEN_KEYS[milestone as TrialMilestone]
  }
  // Compatibilidad: marcar sin `milestone` equivale a la bienvenida.
  return TRIAL_MILESTONE_SEEN_KEYS.welcome
}

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

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Sesión inválida' }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)
  const seen = isPlainObject(body) ? body.seen !== false : true
  const key = resolveMilestoneKey(isPlainObject(body) ? body.milestone : undefined)

  const current = await prisma.uiPreference.findUnique({
    where: { userId },
    select: { tutorial: true },
  })

  const currentTutorial = isPlainObject(current?.tutorial) ? current.tutorial : {}
  const currentSeen = isPlainObject(currentTutorial.seen) ? currentTutorial.seen : {}
  const nextTutorial = {
    ...currentTutorial,
    seen: {
      ...currentSeen,
      [key]: seen,
    },
  }

  await prisma.uiPreference.upsert({
    where: { userId },
    create: {
      userId,
      tutorial: nextTutorial as never,
    },
    update: {
      tutorial: nextTutorial as never,
    },
    select: { userId: true },
  })

  return NextResponse.json({ ok: true })
}