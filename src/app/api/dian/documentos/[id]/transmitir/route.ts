import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  DianDocumentDirection,
  DianDocumentStatus,
  DianEventType,
  ModuleKey,
} from '@prisma/client'

export const runtime = 'nodejs'

function makeRef() {
  return `MOCK-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const { id } = await ctx.params

    const result = await prisma.$transaction(async (tx) => {
      const doc = await tx.dianElectronicDocument.findUnique({
        where: { id },
        select: { id: true, empresaId: true, sedeId: true, direction: true, status: true, uuid: true, cufe: true, providerRef: true },
      })

      if (!doc || doc.empresaId !== empresaId || doc.sedeId !== access.sedeId) {
        throw new Error('NOT_FOUND')
      }

      if (doc.direction !== DianDocumentDirection.OUTBOUND) {
        throw new Error('INVALID_DIRECTION')
      }

      const next = await tx.dianElectronicDocument.update({
        where: { id: doc.id },
        data: {
          status: DianDocumentStatus.TRANSMITTED,
          transmittedAt: new Date(),
          provider: 'MOCK',
          providerRef: doc.providerRef || makeRef(),
          uuid: doc.uuid || `UUID-${makeRef()}`,
          cufe: doc.cufe || `CUFE-${makeRef()}`,
          lastError: null,
        },
        select: {
          id: true,
          status: true,
          transmittedAt: true,
          provider: true,
          providerRef: true,
          uuid: true,
          cufe: true,
        },
      })

      await tx.dianElectronicEvent.create({
        data: {
          documentId: doc.id,
          type: DianEventType.TRANSMISSION,
          message: 'Transmisión realizada (MVP: mock provider).',
          meta: { provider: 'MOCK', providerRef: next.providerRef },
        },
      })

      return next
    })

    return NextResponse.json({ ok: true, data: result })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') return NextResponse.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 })
      if (error.message === 'INVALID_DIRECTION') return NextResponse.json({ ok: false, error: 'Solo aplica a documentos OUTBOUND' }, { status: 400 })
    }

    console.error('Error al transmitir documento DIAN:', error)
    return NextResponse.json({ ok: false, error: 'Error al transmitir documento DIAN' }, { status: 500 })
  }
}
