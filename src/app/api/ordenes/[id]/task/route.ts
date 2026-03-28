import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { createInternalTaskForWorkOrder } from '@/lib/work-order-task-sync'

export const runtime = 'nodejs'

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.ORDENES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const orden = await prisma.ordenTrabajo.findFirst({
      where: { id, sedeId: access.sedeId },
      select: { id: true, assignedToUserId: true, tareaSeguimiento: { select: { id: true } } },
    })

    if (!orden) {
      return NextResponse.json({ success: false, error: 'Orden no encontrada' }, { status: 404 })
    }

    if (!orden.assignedToUserId) {
      return NextResponse.json({ success: false, error: 'Asigna primero un responsable antes de crear la tarea' }, { status: 400 })
    }

    if (orden.tareaSeguimiento) {
      return NextResponse.json({ success: true, data: orden.tareaSeguimiento })
    }

    const task = await prisma.$transaction((tx) => createInternalTaskForWorkOrder(tx, {
      ordenId: orden.id,
      empresaId: access.empresaId,
      actorUserId: access.userId,
    }))

    return NextResponse.json({ success: true, data: task }, { status: 201 })
  } catch (error) {
    console.error('Error creando tarea desde orden:', error)
    const message = error instanceof Error && error.message === 'WORK_ORDER_TASK_ASSIGNEE_REQUIRED'
      ? 'Asigna primero un responsable antes de crear la tarea'
      : 'Error creando tarea desde la orden'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}