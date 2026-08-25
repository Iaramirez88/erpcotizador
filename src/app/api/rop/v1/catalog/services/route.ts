import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
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
      orderBy: [{ subcategory: { category: { name: 'asc' } } }, { subcategory: { name: 'asc' } }, { name: 'asc' }],
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