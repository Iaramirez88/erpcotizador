import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { InventoryMovementType, ModuleKey } from '@prisma/client'
import { buildXlsxBuffer, formatDateForFilename } from '@/lib/excel-export'

export const runtime = 'nodejs'

function isMovementType(value: unknown): value is InventoryMovementType {
  return value === 'IN' || value === 'OUT' || value === 'ADJUST'
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess('INVENTARIO' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { searchParams } = new URL(request.url)
    const materialId = (searchParams.get('materialId') || '').trim() || undefined
    const typeRaw = (searchParams.get('type') || '').trim() || undefined
    const warehouseId = (searchParams.get('warehouseId') || '').trim() || undefined
    const limit = Math.min(5000, Math.max(1, Number(searchParams.get('limit') || 5000)))

    const where: {
      empresaId: string
      materialId?: string
      type?: InventoryMovementType
      warehouseId?: string
    } = { empresaId }

    if (materialId) where.materialId = materialId
    if (typeRaw && isMovementType(typeRaw)) where.type = typeRaw
    if (warehouseId) where.warehouseId = warehouseId

    const movements = await prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        quantity: true,
        stockBefore: true,
        stockAfter: true,
        note: true,
        createdAt: true,
        material: { select: { id: true, externalId: true, nombre: true, unidadMedida: true } },
        warehouse: { select: { id: true, nombre: true } },
        createdBy: { select: { name: true, email: true } },
      },
    })

    const rows = movements.map((m) => ({
      ID: m.id,
      Fecha: m.createdAt,
      Tipo: m.type,
      Material: m.material?.nombre ?? '',
      Unidad: m.material?.unidadMedida ?? '',
      Bodega: m.warehouse?.nombre ?? '',
      Cantidad: m.quantity ?? 0,
      StockAntes: m.stockBefore ?? 0,
      StockDespues: m.stockAfter ?? 0,
      Nota: m.note ?? '',
      Usuario: m.createdBy?.name ?? m.createdBy?.email ?? '',
    }))

    const buffer = buildXlsxBuffer([{ name: 'Movimientos', rows }])
    const filename = `inventario-movimientos-${formatDateForFilename()}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando inventario:', error)
    return NextResponse.json({ success: false, error: 'Error exportando inventario' }, { status: 500 })
  }
}
