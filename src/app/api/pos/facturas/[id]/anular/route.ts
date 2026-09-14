import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, PosInvoiceStatus } from '@prisma/client'
import { reversePosInvoiceStock } from '@/lib/pos-finalization'

export const runtime = 'nodejs'

type PostBody = {
  note?: string
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const { id } = await ctx.params

    // Reservado para futura auditoría / nota de anulación
    void ((await request.json().catch(() => null)) as Partial<PostBody> | null)

    const result = await prisma.$transaction(async (tx) => {
      const reversed = await reversePosInvoiceStock(tx, {
        empresaId,
        sedeId: access.sedeId,
        userId: access.userId,
        invoiceId: id,
      })
      if (reversed.status !== PosInvoiceStatus.VOID) {
        await tx.posInvoice.update({ where: { id }, data: { status: PosInvoiceStatus.VOID }, select: { id: true } })
      }
      return { ...reversed, status: PosInvoiceStatus.VOID }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVOICE_NOT_FOUND') {
        return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
      }
      if (error.message === 'INVOICE_HAS_RETURNS') {
        return NextResponse.json({ error: 'No se puede anular: la factura tiene devoluciones' }, { status: 400 })
      }
      if (error.message === 'INVOICE_STATUS_NOT_ALLOWED') {
        return NextResponse.json({ error: 'Estado de factura no permite anulación' }, { status: 400 })
      }
    }

    console.error('Error al anular factura POS:', error)
    return NextResponse.json({ error: 'Error al anular factura POS' }, { status: 500 })
  }
}
