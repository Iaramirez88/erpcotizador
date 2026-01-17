import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'READ')
    if (!access.ok) return access.response

    const { id } = await params

    const cotizacion = await prisma.cotizacion.findFirst({
      where: { id },
      include: {
        cliente: true,
        items: { include: { material: true }, orderBy: { createdAt: 'asc' } },
        vendedor: true
      }
    })

    if (!cotizacion) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: cotizacion })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener cotización' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await params

    const cotizacion = await prisma.cotizacion.findFirst({ 
      where: { id },
      include: { orden: true }
    })

    if (!cotizacion) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (cotizacion.orden) {
      return NextResponse.json({ success: false, error: 'No se puede eliminar: tiene una orden asociada' }, { status: 400 })
    }

    await prisma.itemCotizacion.deleteMany({ where: { cotizacionId: id } })
    await prisma.cotizacion.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Cotización eliminada' })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ success: false, error: 'Error al eliminar' }, { status: 500 })
  }
}
