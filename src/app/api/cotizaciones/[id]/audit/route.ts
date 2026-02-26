import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'READ')
    if (!access.ok) return access.response

    const { id } = await ctx.params

    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, sedeId: true },
    })

    if (!cot) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (cot.sedeId && cot.sedeId !== access.sedeId) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    const events = await prisma.cotizacionAuditEvent.findMany({
      where: { cotizacionId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        action: true,
        effect: true,
        note: true,
        createdAt: true,
        performedBy: { select: { id: true, name: true, email: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ success: true, data: { events } })
  } catch (error) {
    console.error('Error al obtener auditoría de cotización:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener auditoría de cotización' },
      { status: 500 }
    )
  }
}
