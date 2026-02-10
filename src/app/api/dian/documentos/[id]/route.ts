import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const { id } = await ctx.params

    const doc = await prisma.dianElectronicDocument.findUnique({
      where: { id },
      select: {
        id: true,
        empresaId: true,
        sedeId: true,
        direction: true,
        type: true,
        status: true,
        numero: true,
        uuid: true,
        cufe: true,
        provider: true,
        providerRef: true,
        payload: true,
        xml: true,
        lastError: true,
        transmittedAt: true,
        expeditedAt: true,
        deliveredAt: true,
        receivedAt: true,
        createdAt: true,
        updatedAt: true,
        posInvoice: { select: { id: true, numero: true } },
        posReturn: { select: { id: true, numero: true } },
        events: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, type: true, message: true, meta: true, createdAt: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!doc || doc.empresaId !== empresaId || doc.sedeId !== access.sedeId) {
      return NextResponse.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, data: doc })
  } catch (error) {
    console.error('Error al obtener documento DIAN:', error)
    return NextResponse.json({ ok: false, error: 'Error al obtener documento DIAN' }, { status: 500 })
  }
}
