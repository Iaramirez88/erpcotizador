import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { syncInternalTaskForWorkOrder } from '@/lib/work-order-task-sync'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.ORDENES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = (await request.json().catch(() => null)) as { userId?: unknown } | null
    const userId = typeof body?.userId === 'string' ? body.userId : ''

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 })
    }

    const orden = await prisma.ordenTrabajo.findFirst({
      where: { id, sedeId: access.sedeId },
      select: { id: true, numero: true, assignedToUserId: true },
    })

    if (!orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const membership = await prisma.sedeMembership.findUnique({
      where: { sedeId_userId: { sedeId: access.sedeId, userId } },
      select: { id: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'El usuario no pertenece a esta sede' }, { status: 400 })
    }

    const updated = await prisma.ordenTrabajo.update({
      where: { id: orden.id },
      data: {
        assignedToUserId: userId,
        assignedAt: new Date(),
      },
      select: {
        id: true,
        numero: true,
        assignedAt: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    })

    await syncInternalTaskForWorkOrder(prisma, {
      ordenId: orden.id,
      empresaId: access.empresaId,
      actorUserId: access.userId,
    })

    if (orden.assignedToUserId !== userId && userId !== access.userId) {
      await prisma.notification.create({
        data: {
          userId,
          type: 'INFO',
          title: `Te asignaron la orden ${orden.numero}`,
          body: 'Tienes una nueva orden asignada.',
          actionUrl: '/dashboard/ordenes',
          actionLabel: 'Ver órdenes',
        },
      })
    }

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    console.error('Error asignando orden:', error)
    return NextResponse.json({ error: 'Error al asignar orden' }, { status: 500 })
  }
}
