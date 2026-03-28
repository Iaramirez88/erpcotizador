import { NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.ORDENES, 'READ')
    if (!access.ok) return access.response

    const rows = await prisma.sedeMembership.findMany({
      where: { sedeId: access.sedeId },
      orderBy: [{ user: { name: 'asc' } }, { user: { email: 'asc' } }],
      select: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      take: 200,
    })

    return NextResponse.json({ success: true, data: rows.map((row) => row.user) })
  } catch (error) {
    console.error('Error listando responsables de órdenes:', error)
    return NextResponse.json({ error: 'Error listando responsables de órdenes' }, { status: 500 })
  }
}