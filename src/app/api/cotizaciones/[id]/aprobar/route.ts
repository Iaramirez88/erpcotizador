import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, EstadoCotizacion } from '@prisma/client'
import { applyOpportunityStageAutomation } from '@/lib/crm'

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

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.cotizacion.findUnique({
        where: { id },
        select: { id: true, estado: true, total: true, subtotal: true, iva: true, descuento: true },
      })

      const upd = await tx.cotizacion.update({
        where: { id },
        data: {
          estado: EstadoCotizacion.APROBADA,
          sedeId: cotizacion.sedeId ?? access.sedeId,
        },
        select: { id: true, estado: true, total: true, subtotal: true, iva: true, descuento: true },
      })

      await tx.cotizacionAuditEvent.create({
        data: {
          cotizacionId: upd.id,
          action: 'APPROVED',
          effect: 'NONE',
          performedById: access.userId,
          requestedById: access.userId,
          before: before
            ? {
                estado: before.estado,
                total: before.total,
                subtotal: before.subtotal,
                iva: before.iva,
                descuento: before.descuento,
              }
            : undefined,
          after: {
            estado: upd.estado,
            total: upd.total,
            subtotal: upd.subtotal,
            iva: upd.iva,
            descuento: upd.descuento,
          },
        },
      })

      await applyOpportunityStageAutomation({
        client: tx,
        empresaId: access.empresaId,
        userId: access.userId,
        cotizacionId: upd.id,
        trigger: 'QUOTE_APPROVED',
        details: 'Aprobacion de cotizacion desde ERP',
      })

      return { id: upd.id, estado: upd.estado }
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error al aprobar cotización:', error)
    return NextResponse.json({ success: false, error: 'Error al aprobar cotización' }, { status: 500 })
  }
}
