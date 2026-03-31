import { NextResponse } from 'next/server'
import { PosPaymentStatus, type Prisma } from '@prisma/client'
import { verifyBoldWebhookSignature } from '@/lib/bold'
import { prisma } from '@/lib/prisma'
import { finalizeInvoice, StockInsufficientError } from '@/lib/pos-finalization'

export const runtime = 'nodejs'

type BoldWebhookEvent = {
  id?: string
  type?: string
  data?: {
    payment_id?: string
    metadata?: {
      reference?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

async function markPaymentStatus(tx: Prisma.TransactionClient, paymentId: string, data: Partial<{ status: PosPaymentStatus; boldPaymentId: string | null; boldEventId: string | null; boldType: string | null; paidAt: Date | null }>) {
  return tx.posPayment.update({
    where: { id: paymentId },
    data,
    select: { id: true },
  })
}

export async function POST(request: Request) {
  const signature = request.headers.get('x-bold-signature') ?? ''
  const secret = process.env.BOLD_WEBHOOK_SECRET ?? process.env.BOLD_SECRET_KEY ?? ''

  const rawBuffer = Buffer.from(await request.arrayBuffer())
  const rawBodyText = rawBuffer.toString('utf8')

  const shouldVerify = (process.env.BOLD_VERIFY_WEBHOOK ?? 'true') !== 'false'
  if (shouldVerify) {
    const ok = verifyBoldWebhookSignature({ rawBody: rawBuffer, signatureHex: signature, secret })
    if (!ok) return NextResponse.json({ ok: false, error: 'Firma inválida' }, { status: 401 })
  }

  let event: BoldWebhookEvent
  try {
    event = JSON.parse(rawBodyText) as BoldWebhookEvent
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const type = event.type ?? ''
  const eventId = event.id ?? null
  const paymentId = event.data?.payment_id ?? null
  const reference = event.data?.metadata?.reference ?? null

  if (!reference) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'Sin metadata.reference' })
  }

  const payment = await prisma.posPayment.findFirst({
    where: { externalReference: reference },
    orderBy: { receivedAt: 'desc' },
    include: {
      invoice: {
        select: {
          id: true,
          empresaId: true,
          sedeId: true,
          status: true,
        },
      },
    },
  })

  if (!payment) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'Pago POS no encontrado' })
  }

  if (!payment.invoice) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'Factura POS no encontrada' })
  }

  if (type === 'SALE_APPROVED') {
    if (payment.status === PosPaymentStatus.PAID && payment.invoice.status === 'PAID') {
      return NextResponse.json({ ok: true, alreadyProcessed: true })
    }

    try {
      await prisma.$transaction(async (tx) => {
        await markPaymentStatus(tx, payment.id, {
          status: PosPaymentStatus.PAID,
          boldPaymentId: paymentId,
          boldEventId: eventId,
          boldType: type,
          paidAt: new Date(),
        })

        await finalizeInvoice(tx, {
          empresaId: payment.invoice.empresaId,
          sedeId: payment.invoice.sedeId,
          invoiceId: payment.invoiceId,
          body: { payments: [] },
        })
      })

      return NextResponse.json({ ok: true })
    } catch (error) {
      if (error instanceof StockInsufficientError) {
        return NextResponse.json({ ok: false, error: 'Stock insuficiente al finalizar la venta POS', details: error.details }, { status: 409 })
      }
      throw error
    }
  }

  if (type === 'SALE_REJECTED') {
    await prisma.posPayment.update({
      where: { id: payment.id },
      data: {
        status: PosPaymentStatus.FAILED,
        boldPaymentId: paymentId,
        boldEventId: eventId,
        boldType: type,
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true })
  }

  if (type === 'VOID_APPROVED') {
    await prisma.posPayment.update({
      where: { id: payment.id },
      data: {
        status: PosPaymentStatus.CANCELED,
        boldPaymentId: paymentId,
        boldEventId: eventId,
        boldType: type,
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true, ignored: true, type })
}
