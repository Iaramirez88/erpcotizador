import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { ensureInvoiceFromQuote, QuoteInvoiceError } from '@/lib/quote-invoicing'
import { ensureWorkOrderFromQuote } from '@/lib/work-orders'

export const runtime = 'nodejs'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const accessCot = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE')
    if (!accessCot.ok) return accessCot.response

    const accessPos = await requireApiAccess(ModuleKey.POS, 'WRITE')
    if (!accessPos.ok) return accessPos.response

    if (accessCot.empresaId !== accessPos.empresaId) {
      return NextResponse.json({ error: 'Acceso inválido para la empresa actual' }, { status: 403 })
    }

    const { id } = await ctx.params
    const empresaId = accessPos.empresaId

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await ensureInvoiceFromQuote(tx, {
        cotizacionId: id,
        empresaId,
        sedeId: accessPos.sedeId,
        createdById: accessPos.userId,
      })

      await ensureWorkOrderFromQuote(tx, {
        cotizacionId: id,
        empresaId,
        sedeId: accessPos.sedeId,
        createdById: accessPos.userId,
        posInvoiceId: invoice.id,
      })

      return invoice
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    if (error instanceof QuoteInvoiceError) {
      if (error.message === 'COTIZACION_NOT_FOUND') {
        return NextResponse.json({ ok: false, error: 'Cotización no encontrada' }, { status: 404 })
      }
      if (error.message === 'COTIZACION_NOT_APPROVED') {
        return NextResponse.json({ ok: false, error: 'Primero aprueba la cotización para facturar' }, { status: 400 })
      }
      if (error.message === 'SEDE_NOT_FOUND') {
        return NextResponse.json({ ok: false, error: 'Sede no encontrada' }, { status: 404 })
      }
      if (error.message === 'NO_ITEMS') {
        return NextResponse.json({ ok: false, error: 'La cotización no tiene ítems válidos para facturar' }, { status: 400 })
      }
    }

    console.error('Error al facturar desde cotización:', error)
    return NextResponse.json({ ok: false, error: 'Error al facturar desde cotización' }, { status: 500 })
  }
}
