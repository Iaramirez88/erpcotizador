import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureRopCatalogSeeded } from '@/lib/rop-catalog'
import { requireRopReadAccess } from '@/lib/rop-access'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireRopReadAccess()
    if (!access.ok) return access.response

    // Si la base aún no tiene catálogo, lo aprovisiona con el catálogo base
    // para que los selectores de categoría/subcategoría/servicio nunca queden vacíos.
    await ensureRopCatalogSeeded(prisma)

    const data = await prisma.ropServiceCatalog.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        subcategory: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { subcategory: { category: { sortOrder: 'asc' } } },
        { subcategory: { category: { name: 'asc' } } },
        { subcategory: { name: 'asc' } },
        { name: 'asc' },
      ],
    })

    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'ROP_CATALOG_GET_FAILED',
          message: error instanceof Error ? error.message : 'No se pudo cargar el catálogo de servicios.',
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status: 500 }
    )
  }
}