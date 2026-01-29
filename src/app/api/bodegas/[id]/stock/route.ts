import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { getOrCreateDefaultEmpresa } from '@/lib/rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

async function getOrCreateEmpresaIdForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true } })
  if (user?.empresaId) return user.empresaId

  const empresa = await getOrCreateDefaultEmpresa()
  await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } }).catch(() => null)
  return empresa.id
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('INVENTARIO' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = await getOrCreateEmpresaIdForUser(access.userId)
    const { id: warehouseId } = await ctx.params

    const warehouse = await prisma.inventoryWarehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true, empresaId: true, sedeId: true },
    })

    if (!warehouse || warehouse.empresaId !== empresaId) {
      return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })
    }

    if (warehouse.sedeId && warehouse.sedeId !== access.sedeId) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const materialId = searchParams.get('materialId') || undefined

    const stocks = await prisma.inventoryStock.findMany({
      where: { warehouseId, ...(materialId ? { materialId } : {}) },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        quantity: true,
        updatedAt: true,
        material: { select: { id: true, nombre: true, unidadMedida: true } },
      },
    })

    return NextResponse.json({ success: true, data: stocks })
  } catch (error) {
    console.error('Error al obtener stock de sede:', error)
    return NextResponse.json({ error: 'Error al obtener stock de sede' }, { status: 500 })
  }
}
