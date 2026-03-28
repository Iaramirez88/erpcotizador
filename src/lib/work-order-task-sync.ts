import { CrmTaskPriority, CrmTaskStatus, Prisma, Prioridad } from '@prisma/client'
import { appendTaskHistory } from '@/lib/crm-task-workspaces'

type DbClient = Prisma.TransactionClient

function isSnapshotItem(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function mapOrderPriorityToTaskPriority(priority?: Prioridad | null) {
  if (priority === 'ALTA') return CrmTaskPriority.HIGH
  if (priority === 'BAJA') return CrmTaskPriority.LOW
  return CrmTaskPriority.NORMAL
}

function buildTaskTitle(numero: string, clienteNombre?: string | null) {
  return clienteNombre ? `OT ${numero} · ${clienteNombre}` : `OT ${numero}`
}

function buildTaskDescription(args: { areaResponsable?: string | null; observaciones?: string | null; itemsSnapshot?: Prisma.JsonValue | null }) {
  const parts: string[] = []

  if (args.areaResponsable) {
    parts.push(`Area responsable: ${args.areaResponsable}`)
  }

  if (typeof args.observaciones === 'string' && args.observaciones.trim()) {
    parts.push(args.observaciones.trim())
  }

  if (Array.isArray(args.itemsSnapshot) && args.itemsSnapshot.length) {
    const items = args.itemsSnapshot
      .map((item) => {
        if (!isSnapshotItem(item)) return null
        const descripcion = typeof item.descripcion === 'string' ? item.descripcion.trim() : ''
        const cantidad = typeof item.cantidad === 'number' ? item.cantidad : Number(item.cantidad || 0)
        if (!descripcion) return null
        return cantidad > 0 ? `${cantidad} x ${descripcion}` : descripcion
      })
      .filter((item): item is string => Boolean(item))
    if (items.length) {
      parts.push(`Items: ${items.slice(0, 5).join(', ')}`)
    }
  }

  return parts.join('\n\n') || null
}

async function syncTaskAssignments(client: DbClient, args: { empresaId: string; taskId: string; assignedToUserId?: string | null }) {
  await client.crmTaskAssignment.deleteMany({ where: { taskId: args.taskId } })
  if (!args.assignedToUserId) return

  await client.crmTaskAssignment.create({
    data: {
      empresaId: args.empresaId,
      taskId: args.taskId,
      userId: args.assignedToUserId,
    },
  })
}

export async function syncInternalTaskForWorkOrder(
  client: DbClient,
  args: {
    ordenId: string
    empresaId: string
    actorUserId: string
  },
) {
  const orden = await client.ordenTrabajo.findUnique({
    where: { id: args.ordenId },
    select: {
      id: true,
      numero: true,
      sedeId: true,
      clienteId: true,
      prioridad: true,
      estado: true,
      areaResponsable: true,
      observaciones: true,
      itemsSnapshot: true,
      fechaEntrega: true,
      assignedToUserId: true,
      cliente: { select: { nombre: true } },
      tareaSeguimiento: { select: { id: true } },
    },
  })

  if (!orden) return null
  if (!orden.tareaSeguimiento) return null

  const title = buildTaskTitle(orden.numero, orden.cliente?.nombre)
  const description = buildTaskDescription({
    areaResponsable: orden.areaResponsable,
    observaciones: orden.observaciones,
    itemsSnapshot: orden.itemsSnapshot,
  })
  const taskPriority = mapOrderPriorityToTaskPriority(orden.prioridad)

  const updated = await client.crmTask.update({
    where: { id: orden.tareaSeguimiento.id },
    data: {
      sedeId: orden.sedeId ?? null,
      clienteId: orden.clienteId,
      title,
      description,
      dueAt: orden.fechaEntrega ?? null,
      priority: taskPriority,
      assignedToUserId: orden.assignedToUserId ?? null,
    },
    select: { id: true },
  })

  await syncTaskAssignments(client, {
    empresaId: args.empresaId,
    taskId: updated.id,
    assignedToUserId: orden.assignedToUserId,
  })

  await appendTaskHistory(client, {
    empresaId: args.empresaId,
    taskId: updated.id,
    actorUserId: args.actorUserId,
    type: 'UPDATED',
    message: `Datos sincronizados desde la orden ${orden.numero}.`,
    metadata: {
      ordenTrabajoId: orden.id,
      assignedToUserId: orden.assignedToUserId,
    },
  })

  return updated
}

export async function createInternalTaskForWorkOrder(
  client: DbClient,
  args: {
    ordenId: string
    empresaId: string
    actorUserId: string
  },
) {
  const orden = await client.ordenTrabajo.findUnique({
    where: { id: args.ordenId },
    select: {
      id: true,
      numero: true,
      sedeId: true,
      clienteId: true,
      prioridad: true,
      areaResponsable: true,
      observaciones: true,
      itemsSnapshot: true,
      fechaEntrega: true,
      assignedToUserId: true,
      cliente: { select: { nombre: true } },
      tareaSeguimiento: { select: { id: true } },
    },
  })

  if (!orden) return null
  if (orden.tareaSeguimiento) return orden.tareaSeguimiento
  if (!orden.assignedToUserId) {
    throw new Error('WORK_ORDER_TASK_ASSIGNEE_REQUIRED')
  }

  const title = buildTaskTitle(orden.numero, orden.cliente?.nombre)
  const description = buildTaskDescription({
    areaResponsable: orden.areaResponsable,
    observaciones: orden.observaciones,
    itemsSnapshot: orden.itemsSnapshot,
  })
  const taskPriority = mapOrderPriorityToTaskPriority(orden.prioridad)

  const created = await client.crmTask.create({
    data: {
      empresaId: args.empresaId,
      sedeId: orden.sedeId ?? null,
      clienteId: orden.clienteId,
      ordenTrabajoId: orden.id,
      title,
      description,
      dueAt: orden.fechaEntrega ?? null,
      status: CrmTaskStatus.OPEN,
      priority: taskPriority,
      assignedToUserId: orden.assignedToUserId ?? null,
      createdById: args.actorUserId,
      colorHex: '#0F766E',
    },
    select: { id: true },
  })

  await syncTaskAssignments(client, {
    empresaId: args.empresaId,
    taskId: created.id,
    assignedToUserId: orden.assignedToUserId,
  })

  await appendTaskHistory(client, {
    empresaId: args.empresaId,
    taskId: created.id,
    actorUserId: args.actorUserId,
    type: 'CREATED',
    message: `Tarea creada desde la orden ${orden.numero}.`,
    metadata: {
      ordenTrabajoId: orden.id,
      assignedToUserId: orden.assignedToUserId,
    },
  })

  return created
}