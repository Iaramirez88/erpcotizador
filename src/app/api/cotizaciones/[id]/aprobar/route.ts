import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, EstadoCotizacion } from '@prisma/client'
import { applyOpportunityStageAutomation } from '@/lib/crm'
import { ensureInvoiceFromQuote, QuoteInvoiceError } from '@/lib/quote-invoicing'
import { ensureWorkOrderFromQuote } from '@/lib/work-orders'

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

      const invoice = await ensureInvoiceFromQuote(tx, {
        cotizacionId: upd.id,
        empresaId: access.empresaId,
        sedeId: access.sedeId,
        createdById: access.userId,
      })

      const workOrder = await ensureWorkOrderFromQuote(tx, {
        cotizacionId: upd.id,
        empresaId: access.empresaId,
        sedeId: access.sedeId,
        createdById: access.userId,
        posInvoiceId: invoice.id,
      })

      return {
        id: upd.id,
        estado: upd.estado,
        facturaId: invoice.id,
        facturaNumero: invoice.numero,
        ordenTrabajoId: workOrder?.id ?? null,
        ordenTrabajoNumero: workOrder?.numero ?? null,
      }
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof QuoteInvoiceError) {
      if (error.message === 'SEDE_NOT_FOUND') {
        return NextResponse.json({ success: false, error: 'Sede no encontrada' }, { status: 404 })
      }
      if (error.message === 'NO_ITEMS') {
        return NextResponse.json({ success: false, error: 'La cotización no tiene ítems válidos para facturar' }, { status: 400 })
      }
    }

    console.error('Error al aprobar cotización:', error)
    return NextResponse.json({ success: false, error: 'Error al aprobar cotización' }, { status: 500 })
  }
}
