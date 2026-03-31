import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { finalizeInvoice, StockInsufficientError } from '@/lib/pos-finalization'
import { type PosFinalizePaymentInput } from '@/lib/pos-payments'
import {
  ModuleKey,
} from '@prisma/client'

export const runtime = 'nodejs'

type PostBody = {
  warehouseId?: string | null
  payments?: PosFinalizePaymentInput[]
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const { id } = await ctx.params

    const body = (await request.json().catch(() => null)) as Partial<PostBody> | null

    const result = await prisma.$transaction((tx) =>
      finalizeInvoice(tx, {
        empresaId,
        sedeId: access.sedeId,
        userId: access.userId,
        invoiceId: id,
        body: {
          warehouseId: typeof body?.warehouseId === 'string' ? body.warehouseId : null,
          payments: Array.isArray(body?.payments) ? (body?.payments as PosFinalizePaymentInput[]) : undefined,
        },
      })
    )

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVOICE_NOT_FOUND') {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
      }
      if (error.message === 'INVOICE_STATUS_NOT_ALLOWED') {
        return NextResponse.json({ error: 'Estado de factura no permite finalizar' }, { status: 400 })
      }
      if (error.message === 'PAYMENTS_TOTAL_MISMATCH') {
        return NextResponse.json({ error: 'La suma de pagos debe ser igual al total' }, { status: 400 })
      }
      if (error.message === 'PAYMENT_INSUFFICIENT') {
        return NextResponse.json({ error: 'Pago insuficiente' }, { status: 400 })
      }
      if (error.message === 'STOCK_INSUFFICIENT') {
        const details = error instanceof StockInsufficientError ? error.details : undefined
        return NextResponse.json({ error: 'Stock insuficiente', details }, { status: 400 })
      }
    }

    console.error('Error al finalizar factura:', error)
    return NextResponse.json({ error: 'Error al finalizar factura' }, { status: 500 })
  }
}
