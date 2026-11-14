import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

/**
 * Equipos de la empresa (para reglas de asignación por equipo).
 * Reutiliza `Team`/`TeamMember`; no crea catálogo nuevo.
 */
export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'ASSIGNMENT_RULES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const teams = await prisma.team.findMany({
      where: { sede: { empresaId: access.empresaId } },
      orderBy: [{ nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        sedeId: true,
        _count: { select: { members: true } },
      },
    })

    return NextResponse.json({ success: true, data: teams })
  } catch (error) {
    console.error('Error listando equipos CRM:', error)
    return NextResponse.json({ error: 'Error listando equipos CRM' }, { status: 500 })
  }
}
