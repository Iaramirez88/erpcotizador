import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'

export const runtime = 'nodejs'

async function requireWebsiteServicesAdmin() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 }) }
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Sesión inválida' }, { status: 401 }) }
  }

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canManageAssignments || !access.empresaId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Prohibido' }, { status: 403 }) }
  }

  return { ok: true as const, access }
}

export async function GET() {
  const guard = await requireWebsiteServicesAdmin()
  if (!guard.ok) return guard.response

  const [assignedRows, users] = await Promise.all([
    prisma.websiteServiceModuleAccess.findMany({
      where: { empresaId: guard.access.empresaId },
      select: { userId: true },
    }),
    prisma.user.findMany({
      where: { empresaId: guard.access.empresaId },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: { id: true, name: true, email: true, role: true },
    }),
  ])

  return NextResponse.json({
    ok: true,
    assignedUserIds: assignedRows.map((row) => row.userId),
    users,
  })
}

export async function PUT(req: NextRequest) {
  const guard = await requireWebsiteServicesAdmin()
  if (!guard.ok) return guard.response

  const body: unknown = await req.json().catch(() => null)
  const rawUserIds =
    body && typeof body === 'object' && 'userIds' in body && Array.isArray(body.userIds)
      ? body.userIds
      : []
  const inputUserIds: string[] = rawUserIds
    .map((value: unknown) => String(value).trim())
    .filter((value): value is string => value.length > 0)
  const uniqueUserIds = [...new Set(inputUserIds)]

  const users = await prisma.user.findMany({
    where: { empresaId: guard.access.empresaId, id: { in: uniqueUserIds } },
    select: { id: true },
  })

  if (users.length !== uniqueUserIds.length) {
    return NextResponse.json({ ok: false, error: 'Uno o más usuarios no pertenecen a esta empresa.' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.websiteServiceModuleAccess.deleteMany({ where: { empresaId: guard.access.empresaId } })

    if (uniqueUserIds.length > 0) {
      await tx.websiteServiceModuleAccess.createMany({
        data: uniqueUserIds.map((userId) => ({ empresaId: guard.access.empresaId!, userId })),
      })
    }
  })

  return NextResponse.json({ ok: true, assignedUserIds: uniqueUserIds })
}