import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  DianDocumentDirection,
  DianDocumentStatus,
  DianDocumentType,
  DianEventType,
  ModuleKey,
} from '@prisma/client'

export const runtime = 'nodejs'

function s(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

type PostBody = {
  type?: DianDocumentType
  numero?: string
  uuid?: string
  cufe?: string
  note?: string
  payload?: unknown
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const body = (await request.json().catch(() => null)) as Partial<PostBody> | null

    const type = body?.type
    if (!type) {
      return NextResponse.json({ ok: false, error: 'type es requerido' }, { status: 400 })
    }

    const numero = s(body?.numero) || null
    const uuid = s(body?.uuid) || null
    const cufe = s(body?.cufe) || null
    const note = s(body?.note) || null

    const payload = body?.payload ?? {}

    const created = await prisma.$transaction(async (tx) => {
      const doc = await tx.dianElectronicDocument.create({
        data: {
          empresaId,
          sedeId: access.sedeId,
          direction: DianDocumentDirection.INBOUND,
          type,
          status: DianDocumentStatus.RECEIVED,
          numero,
          uuid,
          cufe,
          payload: typeof payload === 'object' && payload !== null ? (payload as object) : {},
          createdById: access.userId,
          receivedAt: new Date(),
        },
        select: { id: true, direction: true, type: true, status: true, numero: true, uuid: true, cufe: true, receivedAt: true, createdAt: true },
      })

      await tx.dianElectronicEvent.create({
        data: {
          documentId: doc.id,
          type: DianEventType.RECEPTION,
          message: note || 'Recepción registrada (manual).',
          meta: { source: 'manual' },
        },
      })

      return doc
    })

    return NextResponse.json({ ok: true, data: created })
  } catch (error) {
    console.error('Error al registrar recepción DIAN:', error)
    return NextResponse.json({ ok: false, error: 'Error al registrar recepción DIAN' }, { status: 500 })
  }
}
