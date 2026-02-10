import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

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

export async function GET() {
  try {
    const access = await requireApiAccess('INVENTARIO' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    await ensureDefaultWarehouse({ empresaId, sedeId: access.sedeId })

    const bodegas = await prisma.inventoryWarehouse.findMany({
      where: {
        empresaId,
        OR: [{ sedeId: access.sedeId }, { sedeId: null }],
      },
      orderBy: [{ isDefault: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        codigo: true,
        isDefault: true,
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
