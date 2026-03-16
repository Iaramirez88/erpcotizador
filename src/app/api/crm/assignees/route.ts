import { NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const rows = await prisma.user.findMany({
      where: { empresaId: access.empresaId },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sedeDefaultId: true,
      },
      take: 200,
    })

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('Error listando usuarios asignables CRM:', error)
    return NextResponse.json({ error: 'Error listando usuarios asignables CRM' }, { status: 500 })
  }
}