import { NextResponse } from 'next/server'
import { CrmTaskPriority, ModuleKey, type Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { requireSedeAccess } from '@/lib/rbac'
import { appendTaskHistory } from '@/lib/crm-task-workspaces'

export const runtime = 'nodejs'

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizePriority(value: unknown): 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE' {
  const normalized = normalizeString(value).toUpperCase()
  if (normalized === 'BAJA' || normalized === 'ALTA' || normalized === 'URGENTE') return normalized
  return 'MEDIA'
}

function mapTaskPriority(priority: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'): CrmTaskPriority {
  if (priority === 'URGENTE') return CrmTaskPriority.HIGH
  if (priority === 'ALTA') return CrmTaskPriority.HIGH
  if (priority === 'BAJA') return CrmTaskPriority.LOW
  return CrmTaskPriority.NORMAL
}

async function validateWarehouseAccess(args: {
  warehouseId: string
  empresaId: string
  userId: string
  role: string
  module: ModuleKey
  minLevel: 'READ' | 'WRITE'
}) {
  const warehouse = await prisma.inventoryWarehouse.findUnique({
    where: { id: args.warehouseId },
    select: { id: true, empresaId: true, sedeId: true, nombre: true, isSupplyHub: true },
  })

  if (!warehouse || warehouse.empresaId !== args.empresaId) return null

  if (warehouse.sedeId && args.role !== 'ADMIN') {
    await requireSedeAccess({
      userId: args.userId,
      sedeId: warehouse.sedeId,
      module: args.module,
      minLevel: args.minLevel,
    })
  }

  return warehouse
}

async function createSupplyRequestTask(client: Prisma.TransactionClient, args: {
  empresaId: string
  actorUserId: string
  numero: string
  requestingSedeId: string | null
  priority: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE'
  supplyWarehouseName: string
  requestingWarehouseName: string
  items: Array<{ nombre: string; quantity: number; unidadMedida: string }>
  note: string | null
}) {
  const descriptionLines = [
    `Solicitud interna de abastecimiento ${args.numero}.`,
    `Sede solicitante: ${args.requestingWarehouseName}.`,
    `Bodega abastecedora: ${args.supplyWarehouseName}.`,
    '',
    'Items solicitados:',
    ...args.items.map((item) => `- ${item.nombre}: ${item.quantity} ${item.unidadMedida}`),
  ]

  if (args.note) {
    descriptionLines.push('', `Nota: ${args.note}`)
  }

  const task = await client.crmTask.create({
    data: {
      empresaId: args.empresaId,
      sedeId: args.requestingSedeId,
      title: `Abastecimiento ${args.numero}`,
      description: descriptionLines.join('\n'),
      status: 'OPEN',
      priority: mapTaskPriority(args.priority),
      createdById: args.actorUserId,
      colorHex: '#B45309',
    },
    select: { id: true },
  })

  await appendTaskHistory(client, {
    empresaId: args.empresaId,
    taskId: task.id,
    actorUserId: args.actorUserId,
    type: 'CREATED',
    message: `Tarea creada desde la solicitud de abastecimiento ${args.numero}.`,
    metadata: {
      inventorySupplyRequestNumber: args.numero,
      requestKind: 'INTERNAL_SUPPLY',
    },
  })

  return task.id
}

async function resolveSupplyNotificationRecipients(client: Prisma.TransactionClient, args: {
  empresaId: string
  requestingSedeId: string | null
  supplySedeId: string | null
  actorUserId: string
}) {
  const requestedSedeIds = Array.from(new Set([args.requestingSedeId, args.supplySedeId].filter(Boolean))) as string[]
  if (!requestedSedeIds.length) return []

  const memberships = await client.sedeMembership.findMany({
    where: {
      sedeId: { in: requestedSedeIds },
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { userId: true },
  })

  return Array.from(new Set(memberships.map((membership) => membership.userId).filter((userId) => userId && userId !== args.actorUserId)))
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.INVENTARIO, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const status = normalizeString(searchParams.get('status'))
    const requestingWarehouseId = normalizeString(searchParams.get('requestingWarehouseId'))
    const supplyWarehouseId = normalizeString(searchParams.get('supplyWarehouseId'))
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 100)))

    const where: Prisma.InventorySupplyRequestWhereInput = {
      empresaId: access.empresaId,
    }

    if (status === 'PENDIENTE' || status === 'COMPLETADO' || status === 'CANCELADO') {
      where.status = status
    }

    if (requestingWarehouseId) {
      where.requestingWarehouseId = requestingWarehouseId
    }

    if (supplyWarehouseId) {
      where.supplyWarehouseId = supplyWarehouseId
    }

    const requests = await prisma.inventorySupplyRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        numero: true,
        status: true,
        priority: true,
        note: true,
        taskId: true,
        createdAt: true,
        fulfilledAt: true,
        requestingWarehouse: { select: { id: true, nombre: true, sedeId: true } },
        supplyWarehouse: { select: { id: true, nombre: true, sedeId: true, isSupplyHub: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        fulfilledBy: { select: { id: true, name: true, email: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            quantity: true,
            note: true,
            material: { select: { id: true, externalId: true, nombre: true, unidadMedida: true } },
          },
        },
      },
    })

    return NextResponse.json({ success: true, data: requests })
  } catch (error) {
    console.error('Error al listar solicitudes de abastecimiento:', error)
    return NextResponse.json({ error: 'Error al listar solicitudes de abastecimiento' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.INVENTARIO, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as {
      requestingWarehouseId?: unknown
      supplyWarehouseId?: unknown
      priority?: unknown
      note?: unknown
      items?: Array<{ materialId?: unknown; quantity?: unknown; note?: unknown }>
    } | null

    const requestingWarehouseId = normalizeString(body?.requestingWarehouseId)
    const explicitSupplyWarehouseId = normalizeString(body?.supplyWarehouseId)
    const priority = normalizePriority(body?.priority)
    const note = normalizeString(body?.note) || null
    const itemsInput = Array.isArray(body?.items) ? body.items : []
    const items = itemsInput
      .map((item) => ({
        materialId: normalizeString(item?.materialId),
        quantity: normalizeNumber(item?.quantity),
        note: normalizeString(item?.note) || null,
      }))
      .filter((item) => item.materialId && item.quantity !== null && item.quantity > 0)

    if (!requestingWarehouseId) {
      return NextResponse.json({ error: 'Selecciona la sede que está haciendo la solicitud.' }, { status: 400 })
    }

    if (!items.length) {
      return NextResponse.json({ error: 'Agrega al menos un producto con cantidad válida.' }, { status: 400 })
    }

    const requestingWarehouse = await validateWarehouseAccess({
      warehouseId: requestingWarehouseId,
      empresaId: access.empresaId,
      userId: access.userId,
      role: access.session.user.role,
      module: ModuleKey.INVENTARIO,
      minLevel: 'WRITE',
    })

    if (!requestingWarehouse) {
      return NextResponse.json({ error: 'La sede solicitante no es válida.' }, { status: 404 })
    }

    const supplyWarehouseId = explicitSupplyWarehouseId || (await prisma.inventoryWarehouse.findFirst({
      where: { empresaId: access.empresaId, isSupplyHub: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { id: true },
    }))?.id || ''

    if (!supplyWarehouseId) {
      return NextResponse.json({ error: 'Define primero una bodega abastecedora.' }, { status: 400 })
    }

    const supplyWarehouse = await validateWarehouseAccess({
      warehouseId: supplyWarehouseId,
      empresaId: access.empresaId,
      userId: access.userId,
      role: access.session.user.role,
      module: ModuleKey.INVENTARIO,
      minLevel: 'READ',
    })

    if (!supplyWarehouse) {
      return NextResponse.json({ error: 'La bodega abastecedora no es válida.' }, { status: 404 })
    }

    if (supplyWarehouse.id === requestingWarehouse.id) {
      return NextResponse.json({ error: 'La sede solicitante y la bodega abastecedora deben ser distintas.' }, { status: 400 })
    }

    const materialIds = Array.from(new Set(items.map((item) => item.materialId)))
    const materials = await prisma.material.findMany({
      where: { id: { in: materialIds }, empresaId: access.empresaId },
      select: { id: true, nombre: true, unidadMedida: true, externalId: true },
    })

    if (materials.length !== materialIds.length) {
      return NextResponse.json({ error: 'Uno o más productos no son válidos.' }, { status: 400 })
    }

    const materialMap = new Map(materials.map((material) => [material.id, material]))

    const created = await prisma.$transaction(async (tx) => {
      const count = await tx.inventorySupplyRequest.count({ where: { empresaId: access.empresaId } })
      const numero = `ABS-${String(count + 1).padStart(6, '0')}`

      const taskId = await createSupplyRequestTask(tx, {
        empresaId: access.empresaId,
        actorUserId: access.userId,
        numero,
        requestingSedeId: requestingWarehouse.sedeId ?? null,
        priority,
        supplyWarehouseName: supplyWarehouse.nombre,
        requestingWarehouseName: requestingWarehouse.nombre,
        note,
        items: items.map((item) => {
          const material = materialMap.get(item.materialId)!
          return {
            nombre: material.externalId ? `(${material.externalId}) ${material.nombre}` : material.nombre,
            quantity: item.quantity!,
            unidadMedida: material.unidadMedida,
          }
        }),
      })

      const createdRequest = await tx.inventorySupplyRequest.create({
        data: {
          numero,
          empresaId: access.empresaId,
          requestingWarehouseId: requestingWarehouse.id,
          requestingSedeId: requestingWarehouse.sedeId ?? null,
          supplyWarehouseId: supplyWarehouse.id,
          priority,
          note,
          taskId,
          requestedById: access.userId,
          items: {
            create: items.map((item) => ({
              materialId: item.materialId,
              quantity: item.quantity!,
              note: item.note,
            })),
          },
        },
        select: {
          id: true,
          numero: true,
          status: true,
          priority: true,
          note: true,
          taskId: true,
          createdAt: true,
          fulfilledAt: true,
          requestingWarehouse: { select: { id: true, nombre: true, sedeId: true } },
          supplyWarehouse: { select: { id: true, nombre: true, sedeId: true, isSupplyHub: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
          fulfilledBy: { select: { id: true, name: true, email: true } },
          items: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              quantity: true,
              note: true,
              material: { select: { id: true, externalId: true, nombre: true, unidadMedida: true } },
            },
          },
        },
      })


      const notificationRecipients = await resolveSupplyNotificationRecipients(tx, {
        empresaId: access.empresaId,
        requestingSedeId: requestingWarehouse.sedeId ?? null,
        supplySedeId: supplyWarehouse.sedeId ?? null,
        actorUserId: access.userId,
      })

      if (notificationRecipients.length) {
        await tx.notification.createMany({
          data: notificationRecipients.map((userId) => ({
            userId,
            empresaId: access.empresaId,
            sedeId: requestingWarehouse.sedeId ?? supplyWarehouse.sedeId ?? null,
            type: 'WARNING',
            title: `Solicitud de abastecimiento ${numero}`,
            body: `${requestingWarehouse.nombre} solicitó ${items.length} producto(s) a ${supplyWarehouse.nombre} con prioridad ${priority.toLowerCase()}.`,
            actionUrl: '/dashboard/inventario/abastecimiento',
            actionLabel: 'Revisar solicitud',
          })),
        })
      }

      return createdRequest
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Error al crear solicitud de abastecimiento:', error)
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'No tienes acceso a una de las sedes seleccionadas.' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Error al crear solicitud de abastecimiento' }, { status: 500 })
  }
}