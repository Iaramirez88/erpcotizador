import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireSedeAccess } from '@/lib/rbac'

export const runtime = 'nodejs'

async function ensureDefaultWarehouse(args: { empresaId: string; sedeId: string }) {
  const existingDefault = await prisma.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId, isDefault: true },
    select: { id: true },
  })
  if (existingDefault) return

  const existingAny = await prisma.inventoryWarehouse.findFirst({
    where: { empresaId: args.empresaId, sedeId: args.sedeId },
    select: { id: true },
  })
  if (existingAny) return

  await prisma.inventoryWarehouse
    .create({
      data: {
        empresaId: args.empresaId,
        sedeId: args.sedeId,
        nombre: 'Principal',
        codigo: 'PRIN',
        isDefault: true,
      },
      select: { id: true },
    })
    .catch(() => null)
}

async function getAccessibleSedeIds(args: { empresaId: string; userId: string; fallbackSedeId: string; isSystemAdmin: boolean }) {
  if (args.isSystemAdmin) {
    const sedes = await prisma.sede.findMany({
      where: { empresaId: args.empresaId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })

    const sedeIds = sedes.map((sede) => sede.id)
    return sedeIds.length ? sedeIds : [args.fallbackSedeId]
  }

  const memberships = await prisma.sedeMembership.findMany({
    where: {
      userId: args.userId,
      sede: { empresaId: args.empresaId },
    },
    select: { sedeId: true },
    orderBy: { createdAt: 'asc' },
  })

  const sedeIds = Array.from(new Set(memberships.map((membership) => membership.sedeId).filter(Boolean)))
  return sedeIds.length ? sedeIds : [args.fallbackSedeId]
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess('INVENTARIO' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { searchParams } = new URL(request.url)
    const sedeIdParam = String(searchParams.get('sedeId') || '').trim()

    let sedeId = access.sedeId
    let accessibleSedeIds = await getAccessibleSedeIds({
      empresaId,
      userId: access.userId,
      fallbackSedeId: access.sedeId,
      isSystemAdmin: access.session.user.role === 'ADMIN',
    })

    if (sedeIdParam) {
      const sede = await prisma.sede.findFirst({
        where: { id: sedeIdParam, empresaId },
        select: { id: true },
      })

      if (!sede?.id) {
        return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
      }

      if (access.session.user.role !== 'ADMIN') {
        try {
          await requireSedeAccess({
            userId: access.userId,
            sedeId: sede.id,
            module: 'INVENTARIO' as ModuleKey,
            minLevel: AccessLevel.READ,
          })
        } catch (error) {
          if (error instanceof Error && error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
          }
          throw error
        }
      }

      sedeId = sede.id
      accessibleSedeIds = [sede.id]
    }

    for (const accessibleSedeId of accessibleSedeIds) {
      await ensureDefaultWarehouse({ empresaId, sedeId: accessibleSedeId })
    }

    const bodegas = await prisma.inventoryWarehouse.findMany({
      where: {
        empresaId,
        OR: [{ sedeId: { in: accessibleSedeIds } }, { sedeId: null }],
      },
      orderBy: [{ isDefault: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        codigo: true,
        isDefault: true,
        isSupplyHub: true,
        sedeId: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, data: bodegas })
  } catch (error) {
    console.error('Error al listar sedes:', error)
    return NextResponse.json({ error: 'Error al listar sedes' }, { status: 500 })
  }
}

type PostBody = {
  nombre: string
  codigo?: string | null
  isDefault?: boolean
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess('INVENTARIO' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const body = (await request.json().catch(() => null)) as Partial<PostBody> | null
    const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
    const codigo = typeof body?.codigo === 'string' ? body.codigo.trim() : null
    const isDefault = Boolean(body?.isDefault)

    if (!nombre) {
      return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
    }

    const created = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.inventoryWarehouse.updateMany({
          where: { empresaId, sedeId: access.sedeId, isDefault: true },
          data: { isDefault: false },
        })
      }

      return tx.inventoryWarehouse.create({
        data: {
          empresaId,
          sedeId: access.sedeId,
          nombre,
          codigo,
          isDefault,
        },
        select: {
          id: true,
          nombre: true,
          codigo: true,
          isDefault: true,
          isSupplyHub: true,
          sedeId: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    })

    return NextResponse.json({ success: true, data: created })
  } catch (error) {
    console.error('Error al crear sede:', error)
    return NextResponse.json({ error: 'Error al crear sede' }, { status: 500 })
  }
}
