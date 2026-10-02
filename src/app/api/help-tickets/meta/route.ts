import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { isHelpTicketManager } from '@/lib/help-tickets'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({ domain: 'OPERACIONES', subdomain: 'HELP_TICKETS', action: 'READ', scope: 'SEDE' })
    if (!access.ok) return access.response

    const manager = isHelpTicketManager(access)
    const [users, clients] = manager
      ? await Promise.all([
          prisma.user.findMany({ where: { empresaId: access.empresaId, sedeMemberships: { some: { sedeId: access.sedeId } } }, select: { id: true, name: true, email: true, image: true }, orderBy: { name: 'asc' } }),
          prisma.cliente.findMany({ where: { empresaId: access.empresaId, OR: [{ sedeId: access.sedeId }, { sedeId: null }] }, select: { id: true, nombre: true, documento: true }, orderBy: { nombre: 'asc' }, take: 300 }),
        ])
      : [[], []]

    return NextResponse.json({ success: true, data: { users, clients }, meta: { canManageAll: manager, currentUserId: access.userId } })
  } catch (error) {
    console.error('Error cargando metadatos de soporte:', error)
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los datos auxiliares.' }, { status: 500 })
  }
}
