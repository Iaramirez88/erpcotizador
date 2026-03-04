import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await ctx.params

    const body = asRecord(await request.json().catch(() => ({})))
    const value = typeof body.value === 'boolean' ? body.value : null

    const existing = await prisma.cotizacion.findUnique({
      where: { id },
      select: {
        id: true,
        sedeId: true,
        estado: true,
        ventaRealizadaAt: true,
        subtotal: true,
        iva: true,
        total: true,
        descuento: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (existing.sedeId && existing.sedeId !== access.sedeId) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    // Regla mínima: solo tiene sentido marcar venta realizada si ya está aprobada.
    if (String(existing.estado) !== 'APROBADA') {
      return NextResponse.json(
        { success: false, error: 'Solo se puede marcar venta realizada en cotizaciones APROBADAS' },
        { status: 400 }
      )
    }

    const nextValue = value ?? !Boolean(existing.ventaRealizadaAt)
    const action = nextValue ? 'SALE_REALIZED_SET' : 'SALE_REALIZED_UNSET'

    const updated = await prisma.$transaction(async (tx) => {
      const upd = await tx.cotizacion.update({
        where: { id },
        data: { ventaRealizadaAt: nextValue ? new Date() : null },
        select: {
          id: true,
          sedeId: true,
          estado: true,
          ventaRealizadaAt: true,
          subtotal: true,
          iva: true,
          total: true,
          descuento: true,
        },
      })

      await tx.cotizacionAuditEvent.create({
        data: {
          cotizacionId: upd.id,
          action,
          effect: 'NONE',
          performedById: access.userId,
          requestedById: access.userId,
          before: {
            ventaRealizadaAt: existing.ventaRealizadaAt,
            estado: existing.estado,
            subtotal: existing.subtotal,
            iva: existing.iva,
            total: existing.total,
            descuento: existing.descuento,
          },
          after: {
            ventaRealizadaAt: upd.ventaRealizadaAt,
            estado: upd.estado,
            subtotal: upd.subtotal,
            iva: upd.iva,
            total: upd.total,
            descuento: upd.descuento,
          },
        },
      })

      return upd
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error al actualizar venta realizada:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar venta realizada' },
      { status: 500 }
    )
  }
}
