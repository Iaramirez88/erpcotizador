import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || session.user.role !== 'ADMIN' || !isSuperAdminEmail(email)) return null
  return session
}

function asInt(value: string | null, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

export async function GET(req: NextRequest) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, asInt(searchParams.get('page'), 1))
  const limit = Math.min(50, Math.max(1, asInt(searchParams.get('limit'), 10)))
  const search = (searchParams.get('search') ?? '').trim()

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        empresa: {
          select: {
            id: true,
            nombre: true,
            planTier: true,
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    page,
    limit,
    total,
    items: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      empresa: u.empresa
        ? {
            id: u.empresa.id,
            nombre: u.empresa.nombre,
            planTier: u.empresa.planTier,
          }
        : null,
    })),
  })
}
