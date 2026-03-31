import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { DianDocumentDirection, DianDocumentType, ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const { id } = await ctx.params

    const invoice = await prisma.posInvoice.findUnique({
      where: { id },
      select: { id: true, empresaId: true, sedeId: true },
    })

    if (!invoice || invoice.empresaId !== empresaId || invoice.sedeId !== access.sedeId) {
      return NextResponse.json({ ok: false, error: 'Factura no encontrada' }, { status: 404 })
    }

    const doc = await prisma.$transaction(async (tx) => {
      const existing = await tx.dianElectronicDocument.findFirst({
        where: {
          empresaId,
          sedeId: access.sedeId,
          direction: DianDocumentDirection.OUTBOUND,
          type: DianDocumentType.INVOICE,
          posInvoiceId: id,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, numero: true, createdAt: true },
      })

      if (existing) return { ...existing, reused: true }

      return tx.dianElectronicDocument.create({
        data: {
          empresaId,
          sedeId: access.sedeId,
          direction: DianDocumentDirection.OUTBOUND,
          type: DianDocumentType.INVOICE,
          posInvoiceId: id,
          createdById: access.userId,
        },
        select: { id: true, status: true, numero: true, createdAt: true },
      })
    })

    return NextResponse.json({ ok: true, data: doc })
  } catch (error) {
    console.error('Error al generar factura electrónica POS:', error)
    return NextResponse.json({ ok: false, error: 'Error al generar factura electrónica POS' }, { status: 500 })
  }
}
