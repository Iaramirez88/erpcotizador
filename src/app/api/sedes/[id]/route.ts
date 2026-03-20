import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

async function ensureSedeManageAccess(args: {
  empresaId: string
  userId: string
  isSystemAdmin: boolean
}) {
  if (args.isSystemAdmin) return true

  const anyAdmin = await prisma.sedeMembership.findFirst({
    where: {
      userId: args.userId,
      sede: { empresaId: args.empresaId },
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { id: true },
  })

  return Boolean(anyAdmin?.id)
}

async function findDuplicateSede(args: {
  empresaId: string
  nombre: string
  codigo?: string | null
  excludeId?: string
}) {
  const nombre = args.nombre.trim()
  const codigo = args.codigo?.trim() || null

  return prisma.sede.findFirst({
    where: {
      empresaId: args.empresaId,
      ...(args.excludeId ? { NOT: { id: args.excludeId } } : {}),
      OR: [
        { nombre: { equals: nombre, mode: 'insensitive' } },
        ...(codigo ? [{ codigo: { equals: codigo, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: { id: true },
  })
}

async function getDeleteBlockers(sedeId: string) {
  const counts = await prisma.sede.findUnique({
    where: { id: sedeId },
    select: {
      _count: {
        select: {
          cotizaciones: true,
          ordenes: true,
          clientes: true,
          crmLeads: true,
          crmOpportunities: true,
          crmContacts: true,
          crmActivities: true,
          crmTasks: true,
          crmChannelConnections: true,
          crmConversations: true,
          crmMessages: true,
          crmLeadCaptures: true,
          compras: true,
          compraPagos: true,
          documentScans: true,
          scanFieldFeedback: true,
          inventoryMovements: true,
          posInvoices: true,
          posReturns: true,
          dianDocuments: true,
          remisiones: true,
          notifications: true,
          desperdiciosMateriales: true,
        },
      },
    },
  })

  const hasWarehouseUsage = await prisma.inventoryWarehouse.findFirst({
    where: {
      sedeId,
      OR: [
        { stocks: { some: { quantity: { gt: 0 } } } },
        { movements: { some: {} } },
        { remisiones: { some: {} } },
        { posInvoices: { some: {} } },
        { posReturns: { some: {} } },
        { transfersFrom: { some: {} } },
        { transfersTo: { some: {} } },
      ],
    },
    select: { id: true },
  })

  const hasCustomMaterials = await prisma.material.findFirst({
    where: { customSedeId: sedeId },
    select: { id: true },
  })

  return {
    counts: counts?._count ?? null,
    hasWarehouseUsage: Boolean(hasWarehouseUsage?.id),
    hasCustomMaterials: Boolean(hasCustomMaterials?.id),
  }
}

function hasAssociatedInformation(blockers: Awaited<ReturnType<typeof getDeleteBlockers>>) {
  if (!blockers.counts) return false

  const total = Object.values(blockers.counts).reduce((sum, value) => sum + Number(value ?? 0), 0)
  return total > 0 || blockers.hasWarehouseUsage || blockers.hasCustomMaterials
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const { id } = await context.params
  const isSystemAdmin = access.session.user.role === 'ADMIN'

  const canManage = await ensureSedeManageAccess({
    empresaId: access.empresaId,
    userId: access.userId,
    isSystemAdmin,
  })

  if (!canManage) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const sede = await prisma.sede.findFirst({
    where: { id, empresaId: access.empresaId },
    select: { id: true },
  })

  if (!sede?.id) {
    return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
  }

  const body = (await request.json().catch(() => null)) as { nombre?: unknown; codigo?: unknown } | null
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  const codigo = typeof body?.codigo === 'string' ? body.codigo.trim() : undefined

  if (!nombre) {
    return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
  }

  const duplicate = await findDuplicateSede({
    empresaId: access.empresaId,
    nombre,
    codigo,
    excludeId: id,
  })

  if (duplicate?.id) {
    return NextResponse.json({ error: 'Ya existe una sede con ese nombre o código.' }, { status: 409 })
  }

  const updated = await prisma.sede.update({
    where: { id },
    data: {
      nombre,
      codigo: codigo || null,
    },
    select: {
      id: true,
      nombre: true,
      codigo: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const { id } = await context.params
  const isSystemAdmin = access.session.user.role === 'ADMIN'

  const canManage = await ensureSedeManageAccess({
    empresaId: access.empresaId,
    userId: access.userId,
    isSystemAdmin,
  })

  if (!canManage) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const sede = await prisma.sede.findFirst({
    where: { id, empresaId: access.empresaId },
    select: { id: true, nombre: true },
  })

  if (!sede?.id) {
    return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
  }

  const blockers = await getDeleteBlockers(sede.id)
  if (hasAssociatedInformation(blockers)) {
    return NextResponse.json(
      {
        error: 'No se puede eliminar la sede porque tiene información asociada.',
        data: blockers,
      },
      { status: 400 }
    )
  }

  await prisma.sede.delete({ where: { id: sede.id } })

  return NextResponse.json({ success: true, data: { id: sede.id, nombre: sede.nombre } })
}