import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { getOrCreateDefaultEmpresa } from '@/lib/rbac'
import { DianDocumentDirection, DianDocumentType, DianEventType, ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function getOrCreateEmpresaIdForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true } })
  if (user?.empresaId) return user.empresaId

  const empresa = await getOrCreateDefaultEmpresa()
  await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } }).catch(() => null)
  return empresa.id
}

type PostBody = {
  direction?: DianDocumentDirection
  type?: DianDocumentType
  numero?: string
  posInvoiceId?: string
  posReturnId?: string
  payload?: unknown
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = await getOrCreateEmpresaIdForUser(access.userId)
    const { searchParams } = new URL(request.url)
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)))
    const direction = asString(searchParams.get('direction'))

    const where: {
      empresaId: string
      sedeId: string
      direction?: DianDocumentDirection
    } = { empresaId, sedeId: access.sedeId }

    if (direction === 'OUTBOUND' || direction === 'INBOUND') {
      where.direction = direction as DianDocumentDirection
    }

    const docs = await prisma.dianElectronicDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        direction: true,
        type: true,
        status: true,
        numero: true,
        uuid: true,
        cufe: true,
        provider: true,
        providerRef: true,
        transmittedAt: true,
        expeditedAt: true,
        deliveredAt: true,
        receivedAt: true,
        lastError: true,
        createdAt: true,
        posInvoice: { select: { id: true, numero: true } },
        posReturn: { select: { id: true, numero: true } },
      },
    })

    return NextResponse.json({ ok: true, data: docs })
  } catch (error) {
    console.error('Error al listar documentos DIAN:', error)
    return NextResponse.json({ ok: false, error: 'Error al listar documentos DIAN' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = await getOrCreateEmpresaIdForUser(access.userId)
    const body = (await request.json().catch(() => null)) as Partial<PostBody> | null

    const direction: DianDocumentDirection = body?.direction ?? DianDocumentDirection.OUTBOUND
    const type = body?.type

    if (!type) {
      return NextResponse.json({ ok: false, error: 'type es requerido' }, { status: 400 })
    }

    const numero = asString(body?.numero) || null
    const posInvoiceId = asString(body?.posInvoiceId) || null
    const posReturnId = asString(body?.posReturnId) || null

    if (direction === DianDocumentDirection.OUTBOUND) {
      if (type === DianDocumentType.INVOICE && !posInvoiceId && !numero) {
        return NextResponse.json({ ok: false, error: 'posInvoiceId o numero es requerido para INVOICE' }, { status: 400 })
      }
      if ((type === DianDocumentType.CREDIT_NOTE || type === DianDocumentType.DEBIT_NOTE) && !posReturnId && !numero) {
        return NextResponse.json({ ok: false, error: 'posReturnId o numero es requerido para notas' }, { status: 400 })
      }
    }

    const payload = body?.payload ?? {}

    const doc = await prisma.$transaction(async (tx) => {
      if (posInvoiceId) {
        const inv = await tx.posInvoice.findUnique({
          where: { id: posInvoiceId },
          select: { id: true, empresaId: true, sedeId: true, numero: true, total: true, ivaPct: true, clienteNombre: true },
        })
        if (!inv || inv.empresaId !== empresaId || inv.sedeId !== access.sedeId) {
          throw new Error('POS_INVOICE_NOT_FOUND')
        }

        // Idempotencia: si ya existe un documento DIAN ligado a esta factura, reutilizarlo.
        const existing = await tx.dianElectronicDocument.findFirst({
          where: {
            empresaId,
            sedeId: access.sedeId,
            direction,
            type,
            posInvoiceId,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            direction: true,
            type: true,
            status: true,
            numero: true,
            createdAt: true,
          },
        })
        if (existing) return existing
      }

      if (posReturnId) {
        const ret = await tx.posReturn.findUnique({
          where: { id: posReturnId },
          select: { id: true, empresaId: true, sedeId: true, numero: true, total: true, ivaPct: true },
        })
        if (!ret || ret.empresaId !== empresaId || ret.sedeId !== access.sedeId) {
          throw new Error('POS_RETURN_NOT_FOUND')
        }
      }

      const created = await tx.dianElectronicDocument.create({
        data: {
          empresaId,
          sedeId: access.sedeId,
          direction,
          type,
          numero,
          posInvoiceId,
          posReturnId,
          payload: typeof payload === 'object' && payload !== null ? (payload as object) : {},
          createdById: access.userId,
        },
        select: {
          id: true,
          direction: true,
          type: true,
          status: true,
          numero: true,
          createdAt: true,
        },
      })

      await tx.dianElectronicEvent.create({
        data: {
          documentId: created.id,
          type: DianEventType.GENERATION,
          message: `Generación del documento (${created.type})`,
          meta: {
            posInvoiceId,
            posReturnId,
            numero: created.numero,
            payloadSize: JSON.stringify(payload).length,
          },
        },
      })

      return created
    })

    return NextResponse.json({ ok: true, data: doc })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'POS_INVOICE_NOT_FOUND') {
        return NextResponse.json({ ok: false, error: 'Factura POS no encontrada' }, { status: 404 })
      }
      if (error.message === 'POS_RETURN_NOT_FOUND') {
        return NextResponse.json({ ok: false, error: 'Devolución POS no encontrada' }, { status: 404 })
      }
    }

    console.error('Error al crear documento DIAN:', error)
    return NextResponse.json({ ok: false, error: 'Error al crear documento DIAN' }, { status: 500 })
  }
}
