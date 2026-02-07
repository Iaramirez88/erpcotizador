import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { buildXlsxBuffer, formatDateForFilename } from '@/lib/excel-export'

export const runtime = 'nodejs'

function normalizeUnidadMedidaFilter(value: string | null): 'm2' | 'ml' | 'unidad' | null {
  if (!value) return null
  const u = value.trim().toLowerCase()
  if (u === 'm2' || u === 'm²') return 'm2'
  if (u === 'ml' || u === 'm' || u === 'metro') return 'ml'
  if (u === 'unidad' || u === 'und' || u === 'u') return 'unidad'
  return null
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const tipo = searchParams.get('tipo')
    const activo = searchParams.get('activo')
    const unidadMedida = searchParams.get('unidadMedida')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' as const } },
        { categoria: { contains: search, mode: 'insensitive' as const } },
        { proveedor: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    if (tipo) where.tipo = tipo

    const unidadFilter = normalizeUnidadMedidaFilter(unidadMedida)
    if (unidadFilter) where.unidadMedida = unidadFilter

    if (activo !== null && activo !== undefined && activo !== '') {
      where.activo = activo === 'true'
    }

    const materiales = await prisma.material.findMany({
      where,
      include: { quantityDiscounts: { orderBy: { minQty: 'asc' } } },
      orderBy: { nombre: 'asc' },
      take: 5000,
    })

    const rows = materiales.map((m) => ({
      ID: m.id,
      Nombre: m.nombre,
      Tipo: m.tipo,
      Categoria: m.categoria ?? '',
      UnidadMedida: m.unidadMedida,
      PrecioM2: m.precioM2 ?? '',
      PrecioMetro: m.precioMetro ?? '',
      PrecioUnidad: m.precioUnidad ?? '',
      PrecioCompra: m.precioCompra ?? '',
      StockActual: m.stockActual ?? 0,
      StockMinimo: m.stockMinimo ?? 0,
      Proveedor: m.proveedor ?? '',
      Activo: m.activo ? 'SI' : 'NO',
      Creado: m.createdAt,
    }))

    const buffer = buildXlsxBuffer([{ name: 'Materiales', rows }])
    const filename = `productos-materiales-${formatDateForFilename()}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando materiales:', error)
    return NextResponse.json({ success: false, error: 'Error exportando materiales' }, { status: 500 })
  }
}
