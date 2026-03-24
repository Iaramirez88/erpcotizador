import { NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const rows = await prisma.sede.findMany({
      where: { empresaId: access.empresaId },
      orderBy: [{ nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        codigo: true,
      },
    })

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('Error listando sedes CRM:', error)
    return NextResponse.json({ error: 'Error listando sedes CRM' }, { status: 500 })
  }
}