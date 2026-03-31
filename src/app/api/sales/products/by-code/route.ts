import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

function resolveUnitPrice(material: {
  unidadMedida: string
  precioUnidad: number | null
  precioMetro: number | null
  precioM2: number | null
}) {
  if (material.unidadMedida === 'unidad') return material.precioUnidad ?? material.precioMetro ?? material.precioM2 ?? 0
  if (material.unidadMedida === 'ml') return material.precioMetro ?? material.precioUnidad ?? material.precioM2 ?? 0
  return material.precioM2 ?? material.precioMetro ?? material.precioUnidad ?? 0
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.POS, 'READ')
    if (!access.ok) return access.response

    const code = (request.nextUrl.searchParams.get('code') || request.nextUrl.searchParams.get('barcode') || '').trim()
    if (!code) {
      return NextResponse.json({ error: 'code es requerido' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: access.userId }, select: { role: true } })
    const isAdmin = user?.role === 'ADMIN'

    const defaultWarehouse = await prisma.inventoryWarehouse.findFirst({
      where: { empresaId: access.empresaId, sedeId: access.sedeId, isDefault: true },
      select: { id: true, nombre: true },
    })

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
        precioUnidad: true,
        precioMetro: true,
        precioM2: true,
        stockActual: true,
        stocks: {
          where: defaultWarehouse ? { warehouseId: defaultWarehouse.id } : { warehouseId: '__missing__' },
          select: { quantity: true },
          take: 1,
        },
      },
    })

    if (!material) {
      return NextResponse.json({ error: 'Producto no encontrado para ese código' }, { status: 404 })
    }

    const stock = defaultWarehouse ? material.stocks[0]?.quantity ?? 0 : material.stockActual ?? 0
    const unitPrice = resolveUnitPrice(material)

    return NextResponse.json({
      success: true,
      data: {
        id: material.id,
        code: material.externalId ?? code,
        name: material.nombre,
        unit: material.unidadMedida,
        unitPrice,
        stock,
        warehouse: defaultWarehouse,
      },
    })
  } catch (error) {
    console.error('Error buscando producto POS por código:', error)
    return NextResponse.json({ error: 'Error buscando producto por código' }, { status: 500 })
  }
}