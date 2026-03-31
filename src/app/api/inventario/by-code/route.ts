import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { requireSedeAccess } from '@/lib/rbac'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.INVENTARIO, 'READ')
    if (!access.ok) return access.response

    const code = (request.nextUrl.searchParams.get('code') || request.nextUrl.searchParams.get('barcode') || '').trim()
    const warehouseId = (request.nextUrl.searchParams.get('warehouseId') || '').trim() || null

    if (!code) {
      return NextResponse.json({ error: 'code es requerido' }, { status: 400 })
    }

    let resolvedWarehouseId: string | null = null

    if (warehouseId) {
      const warehouse = await prisma.inventoryWarehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, empresaId: true, sedeId: true },
      })

      if (!warehouse || warehouse.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'Bodega invalida' }, { status: 404 })
      }

      if (warehouse.sedeId && access.session.user.role !== 'ADMIN') {
        try {
          await requireSedeAccess({
            userId: access.userId,
            sedeId: warehouse.sedeId,
            module: ModuleKey.INVENTARIO,
            minLevel: AccessLevel.READ,
          })
        } catch (error) {
          if (error instanceof Error && error.message === 'FORBIDDEN') {
            return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
          }
          throw error
        }
      }

      resolvedWarehouseId = warehouse.id
    }

    const isAdmin = access.session.user.role === 'ADMIN'

    const material = await prisma.material.findFirst({
      where: {
        empresaId: access.empresaId,
        activo: true,
        externalId: { equals: code, mode: 'insensitive' },
        ...(isAdmin
          ? {}
          : {
              OR: [
                { isCustom: false },
                { isCustom: true, customOwnerUserId: access.userId, customSedeId: access.sedeId },
              ],
            }),
      },
      select: {
        id: true,
        nombre: true,
        externalId: true,
        unidadMedida: true,
        stockActual: true,
        stocks: resolvedWarehouseId
          ? {
              where: { warehouseId: resolvedWarehouseId },
              select: { quantity: true },
              take: 1,
            }
          : false,
      },
    })

    if (!material) {
      return NextResponse.json({ error: 'Producto no encontrado para ese codigo exacto' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: material.id,
        nombre: material.nombre,
        externalId: material.externalId ?? code,
        unidadMedida: material.unidadMedida,
        stockActual: material.stockActual,
        warehouseQuantity: Array.isArray(material.stocks) ? (material.stocks[0]?.quantity ?? 0) : null,
      },
    })
  } catch (error) {
    console.error('Error buscando producto de inventario por codigo:', error)
    return NextResponse.json({ error: 'Error buscando producto por codigo' }, { status: 500 })
  }
}