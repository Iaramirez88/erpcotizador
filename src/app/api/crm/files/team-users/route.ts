import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'FILES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const users = await prisma.user.findMany({
      where: { empresaId: access.empresaId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
      orderBy: [
        { name: 'asc' },
        { email: 'asc' },
      ],
    })

    return NextResponse.json({ success: true, data: users })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: detail }, { status: 400 })
  }
}