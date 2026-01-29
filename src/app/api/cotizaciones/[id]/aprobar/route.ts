import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, EstadoCotizacion } from '@prisma/client'

export const runtime = 'nodejs'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await ctx.params

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, sedeId: true, estado: true },
    })

    if (!cotizacion) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (cotizacion.sedeId && cotizacion.sedeId !== access.sedeId) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    const updated = await prisma.cotizacion.update({
      where: { id },
      data: {
        estado: EstadoCotizacion.APROBADA,
        sedeId: cotizacion.sedeId ?? access.sedeId,
      },
      select: { id: true, estado: true },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error al aprobar cotización:', error)
    return NextResponse.json({ success: false, error: 'Error al aprobar cotización' }, { status: 500 })
  }
}
