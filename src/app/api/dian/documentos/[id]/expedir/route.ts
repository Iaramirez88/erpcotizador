import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { DianDocumentStatus, DianEventType, ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const { id } = await ctx.params

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.dianElectronicDocument.findUnique({ where: { id }, select: { id: true, empresaId: true, sedeId: true } })
      if (!doc || doc.empresaId !== empresaId || doc.sedeId !== access.sedeId) throw new Error('NOT_FOUND')

      const next = await tx.dianElectronicDocument.update({
        where: { id: doc.id },
        data: { status: DianDocumentStatus.EXPEDITED, expeditedAt: new Date(), lastError: null },
        select: { id: true, status: true, expeditedAt: true },
      })

      await tx.dianElectronicEvent.create({
        data: { documentId: doc.id, type: DianEventType.EXPEDITION, message: 'Expedición registrada.' },
      })

      return next
    })

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 })
    }
    console.error('Error al expedir documento DIAN:', error)
    return NextResponse.json({ ok: false, error: 'Error al expedir documento DIAN' }, { status: 500 })
  }
}
