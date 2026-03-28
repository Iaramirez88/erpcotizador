import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, Prisma } from '@prisma/client'
import { buildXlsxBuffer, formatDateForFilename } from '@/lib/excel-export'

export const runtime = 'nodejs'

function parseDateStart(value: string | null) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseDateEndExclusive(value: string | null) {
  if (!value) return null
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + 1)
  return d
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess('REMISIONES' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { searchParams } = new URL(request.url)
    const from = parseDateStart(searchParams.get('from'))
    const to = parseDateEndExclusive(searchParams.get('to'))
    const search = (searchParams.get('search') || '').trim()

    const where: Prisma.RemisionWhereInput = { empresaId, sedeId: access.sedeId }

    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lt = to
    }

    if (search) {
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' as const } },
        { clienteNombre: { contains: search, mode: 'insensitive' as const } },
        { warehouse: { is: { nombre: { contains: search, mode: 'insensitive' as const } } } },
      ]
    }

    const remisiones = await prisma.remision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        id: true,
        numero: true,
        status: true,
        clienteNombre: true,
        note: true,
        createdAt: true,
        warehouse: { select: { nombre: true } },
        createdBy: { select: { name: true, email: true } },
        items: {
          select: {
            quantity: true,
            material: { select: { externalId: true, nombre: true, unidadMedida: true } },
          },
        },
      },
    })

    const rows = remisiones.map((r) => {
      const itemsCount = r.items?.length ?? 0
      const totalQty = Array.isArray(r.items) ? r.items.reduce((acc, it) => acc + (it.quantity ?? 0), 0) : 0
      return {
        ID: r.id,
        Numero: r.numero,
        Estado: r.status,
        Cliente: r.clienteNombre ?? '',
        Sede: r.warehouse?.nombre ?? '',
        ItemsCount: itemsCount,
        CantidadTotal: totalQty,
        Nota: r.note ?? '',
        Creado: r.createdAt,
        CreadoPor: r.createdBy?.name ?? r.createdBy?.email ?? '',
      }
    })

    const buffer = await buildXlsxBuffer([{ name: 'Remisiones', rows }])
    const filename = `remisiones-${formatDateForFilename()}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando remisiones:', error)
    return NextResponse.json({ success: false, error: 'Error exportando remisiones' }, { status: 500 })
  }
}
