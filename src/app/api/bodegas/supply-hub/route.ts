import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.INVENTARIO, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as { warehouseId?: unknown } | null
    const warehouseId = typeof body?.warehouseId === 'string' ? body.warehouseId.trim() : ''

    if (!warehouseId) {
      return NextResponse.json({ error: 'warehouseId es requerido' }, { status: 400 })
    }

    const warehouse = await prisma.inventoryWarehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true, empresaId: true },
    })

    if (!warehouse || warehouse.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Bodega no encontrada' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.inventoryWarehouse.updateMany({
        where: { empresaId: access.empresaId, isSupplyHub: true },
        data: { isSupplyHub: false },
      })

      await tx.inventoryWarehouse.update({
        where: { id: warehouse.id },
        data: { isSupplyHub: true },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al definir la bodega abastecedora:', error)
    return NextResponse.json({ error: 'Error al definir la bodega abastecedora' }, { status: 500 })
  }
}