import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey, PosInvoiceStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { resolveClienteIdForPosInvoice } from '@/lib/work-orders'

export const runtime = 'nodejs'

type PatchBody = {
  clienteNombre?: unknown
  clienteDocumento?: unknown
  ivaPct?: unknown
  discountAmount?: unknown
  otherTaxesAmount?: unknown
  note?: unknown
  warehouseId?: unknown
  items?: unknown
}

type InvoiceAuditEventRow = {
  id: string
  action: 'CREATED' | 'UPDATED' | 'SHARED_EMAIL' | 'SHARED_WHATSAPP' | 'PDF_DOWNLOADED'
  note: string | null
  before: unknown
  after: unknown
  createdAt: Date
  performedById: string | null
  performedByName: string | null
  performedByEmail: string | null
}

function n(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeInvoiceItems(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : null
      if (!row) return null
      return {
        materialId: typeof row.materialId === 'string' && row.materialId.trim() ? row.materialId.trim() : null,
        descripcion: typeof row.descripcion === 'string' ? row.descripcion.trim() : '',
        quantity: Math.max(0, n(row.quantity, 0)),
        unitPrice: Math.max(0, n(row.unitPrice, 0)),
      }
    })
    .filter((item): item is { materialId: string | null; descripcion: string; quantity: number; unitPrice: number } => Boolean(item && item.quantity > 0))
}

async function loadInvoiceAuditEvents(invoiceId: string): Promise<InvoiceAuditEventRow[]> {
  return prisma.$queryRaw<InvoiceAuditEventRow[]>`
    SELECT
      e.id,
      e.action,
      e.note,
      e.before,
      e.after,
      e."createdAt",
      u.id as "performedById",
      u.name as "performedByName",
      u.email as "performedByEmail"
    FROM pos_invoice_audit_events e
    LEFT JOIN users u ON u.id = e."performedById"
    WHERE e."invoiceId" = ${invoiceId}
    ORDER BY e."createdAt" DESC
    LIMIT 60
  `
}

async function insertInvoiceAuditEvent(
  client: { $executeRaw: typeof prisma.$executeRaw },
  args: {
    invoiceId: string
    action: InvoiceAuditEventRow['action']
    note?: string | null
    before?: unknown
    after?: unknown
    performedById?: string | null
  },
) {
  await client.$executeRaw`
    INSERT INTO pos_invoice_audit_events (
      id,
      "invoiceId",
      action,
      note,
      before,
      after,
      "performedById"
    )
    VALUES (
      ${randomUUID()},
      ${args.invoiceId},
      ${args.action},
      ${args.note ?? null},
      ${JSON.stringify(args.before ?? null)}::jsonb,
      ${JSON.stringify(args.after ?? null)}::jsonb,
      ${args.performedById ?? null}
    )
  `
}

async function buildInvoiceDetail(id: string, empresaId: string, sedeId: string) {
  const invoice = await prisma.posInvoice.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      status: true,
      empresaId: true,
      sedeId: true,
      clienteNombre: true,
      clienteDocumento: true,
      ivaPct: true,
      subtotal: true,
      discountAmount: true,
      otherTaxesAmount: true,
      iva: true,
      total: true,
      note: true,
      createdAt: true,
      updatedAt: true,
      cliente: { select: { id: true, email: true, telefono: true, celular: true } },
      warehouse: { select: { id: true, nombre: true, codigo: true } },
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          descripcion: true,
          quantity: true,
          unitPrice: true,
          total: true,
          material: { select: { id: true, externalId: true, nombre: true, unidadMedida: true } },
        },
      },
      payments: {
        orderBy: { receivedAt: 'asc' },
        select: {
          id: true,
          method: true,
          amount: true,
          note: true,
          status: true,
          provider: true,
          flow: true,
          source: true,
          externalReference: true,
          boldPaymentLinkId: true,
          boldPaymentId: true,
          boldType: true,
          paidAt: true,
          receivedAt: true,
        },
      },
      returns: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, numero: true, total: true, createdAt: true },
      },
      dianDocuments: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, numero: true, status: true, createdAt: true },
      },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  })

  if (!invoice || invoice.empresaId !== empresaId || invoice.sedeId !== sedeId) return null

  const auditEvents = await loadInvoiceAuditEvents(invoice.id)

  const emailEvents = auditEvents.filter((event) => event.action === 'SHARED_EMAIL')
  const whatsappEvents = auditEvents.filter((event) => event.action === 'SHARED_WHATSAPP')
  const downloadEvents = auditEvents.filter((event) => event.action === 'PDF_DOWNLOADED')

  return {
    ...invoice,
    auditEvents: auditEvents.map((event) => ({
      id: event.id,
      action: event.action,
      note: event.note,
      before: event.before,
      after: event.after,
      createdAt: event.createdAt,
      performedBy: event.performedById
        ? {
            id: event.performedById,
            name: event.performedByName,
            email: event.performedByEmail,
          }
        : null,
    })),
    shareStats: {
      emailCount: emailEvents.length,
      whatsappCount: whatsappEvents.length,
      downloadCount: downloadEvents.length,
      lastEmailAt: emailEvents[0]?.createdAt ?? null,
      lastWhatsappAt: whatsappEvents[0]?.createdAt ?? null,
      lastDownloadAt: downloadEvents[0]?.createdAt ?? null,
    },
  }
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const { id } = await ctx.params
    const invoice = await buildInvoiceDetail(id, access.empresaId, access.sedeId)

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: invoice })
  } catch (error) {
    console.error('Error al obtener factura POS:', error)
    return NextResponse.json({ error: 'Error al obtener factura POS' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.POS, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await ctx.params
    const body = (await request.json().catch(() => ({}))) as PatchBody

    const invoice = await prisma.posInvoice.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        empresaId: true,
        sedeId: true,
        status: true,
        clienteNombre: true,
        clienteDocumento: true,
        ivaPct: true,
        subtotal: true,
        discountAmount: true,
        otherTaxesAmount: true,
        iva: true,
        total: true,
        note: true,
        warehouseId: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: { materialId: true, descripcion: true, quantity: true, unitPrice: true, total: true },
        },
        payments: { select: { id: true } },
        returns: { select: { id: true } },
        dianDocuments: { select: { id: true } },
      },
    })

    if (!invoice || invoice.empresaId !== access.empresaId || invoice.sedeId !== access.sedeId) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (invoice.status !== PosInvoiceStatus.DRAFT) {
      return NextResponse.json({ error: 'Solo se pueden editar facturas en borrador.' }, { status: 400 })
    }

    if (invoice.payments.length || invoice.returns.length || invoice.dianDocuments.length) {
      return NextResponse.json({ error: 'Este borrador ya tiene movimientos relacionados y no se puede editar.' }, { status: 400 })
    }

    const clienteNombre = typeof body.clienteNombre === 'string' ? body.clienteNombre.trim() : ''
    if (!clienteNombre) {
      return NextResponse.json({ error: 'clienteNombre es requerido' }, { status: 400 })
    }

    const items = normalizeInvoiceItems(body.items)
    if (!items.length) {
      return NextResponse.json({ error: 'items es requerido' }, { status: 400 })
    }

    const clienteDocumento = typeof body.clienteDocumento === 'string' ? body.clienteDocumento.trim() || null : null
    const ivaPct = Math.max(0, n(body.ivaPct, 0))
    const discountAmount = Math.max(0, n(body.discountAmount, 0))
    const otherTaxesAmount = Math.max(0, n(body.otherTaxesAmount, 0))
    const note = typeof body.note === 'string' ? body.note.trim() || null : null
    const warehouseId = typeof body.warehouseId === 'string' && body.warehouseId.trim() ? body.warehouseId.trim() : null

    if (warehouseId) {
      const warehouse = await prisma.inventoryWarehouse.findUnique({ where: { id: warehouseId }, select: { id: true, empresaId: true, sedeId: true } })
      if (!warehouse || warehouse.empresaId !== access.empresaId || warehouse.sedeId !== access.sedeId) {
        return NextResponse.json({ error: 'La bodega seleccionada no pertenece a esta sede.' }, { status: 400 })
      }
    }

    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        if (!item.materialId) {
          return { ...item, descripcion: item.descripcion || 'Ítem' }
        }

        const material = await prisma.material.findUnique({
          where: { id: item.materialId },
          select: { id: true, empresaId: true, nombre: true },
        })

        if (!material || material.empresaId !== access.empresaId) {
          throw new Error('MATERIAL_NOT_FOUND')
        }

        return {
          ...item,
          descripcion: item.descripcion || material.nombre,
        }
      }),
    )

    const subtotal = resolvedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const discountFinal = Math.min(subtotal, discountAmount)
    const taxableBase = Math.max(0, subtotal - discountFinal)
    const iva = taxableBase * (ivaPct / 100)
    const total = taxableBase + iva + otherTaxesAmount

    const clienteId = await resolveClienteIdForPosInvoice(prisma, {
      empresaId: access.empresaId,
      clienteDocumento,
      clienteNombre,
    })

    await prisma.$transaction(async (tx) => {
      await tx.posInvoice.update({
        where: { id: invoice.id },
        data: {
          clienteId,
          clienteNombre,
          clienteDocumento,
          warehouseId,
          ivaPct,
          subtotal,
          discountAmount: discountFinal,
          otherTaxesAmount,
          iva,
          total,
          note,
          items: {
            deleteMany: {},
            create: resolvedItems.map((item) => ({
              materialId: item.materialId,
              descripcion: item.descripcion,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          },
        },
      })

      await insertInvoiceAuditEvent(tx, {
        invoiceId: invoice.id,
        action: 'UPDATED',
        performedById: access.userId,
        note: 'Factura borrador editada desde POS.',
        before: {
          clienteNombre: invoice.clienteNombre,
          clienteDocumento: invoice.clienteDocumento,
          ivaPct: invoice.ivaPct,
          subtotal: invoice.subtotal,
          discountAmount: invoice.discountAmount,
          otherTaxesAmount: invoice.otherTaxesAmount,
          iva: invoice.iva,
          total: invoice.total,
          note: invoice.note,
          warehouseId: invoice.warehouseId,
          items: invoice.items,
        },
        after: {
          clienteNombre,
          clienteDocumento,
          ivaPct,
          subtotal,
          discountAmount: discountFinal,
          otherTaxesAmount,
          iva,
          total,
          note,
          warehouseId,
          items: resolvedItems.map((item) => ({
            materialId: item.materialId,
            descripcion: item.descripcion,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
      })
    })

    const detail = await buildInvoiceDetail(invoice.id, access.empresaId, access.sedeId)
    return NextResponse.json({ success: true, data: detail })
  } catch (error) {
    if (error instanceof Error && error.message === 'MATERIAL_NOT_FOUND') {
      return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 })
    }

    console.error('Error al actualizar factura POS:', error)
    return NextResponse.json({ error: 'Error al actualizar factura POS' }, { status: 500 })
  }
}
