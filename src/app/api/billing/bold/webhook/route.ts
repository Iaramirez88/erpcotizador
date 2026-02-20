import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyBoldWebhookSignature } from '@/lib/bold'
import { PlanTier, BillingCycle } from '@prisma/client'

export const runtime = 'nodejs'

function addMonths(date: Date, months: number) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function addYears(date: Date, years: number) {
  const copy = new Date(date)
  copy.setFullYear(copy.getFullYear() + years)
  return copy
}

type BoldWebhookEvent = {
  id?: string
  type?: string
  data?: {
    payment_id?: string
    metadata?: {
      reference?: string
      [k: string]: unknown
    }
    [k: string]: unknown
  }
  [k: string]: unknown
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

  const invoice = await prisma.billingInvoice.findUnique({ where: { externalReference: reference } })
  if (!invoice) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'Factura no encontrada' })
  }

  const now = new Date()

  if (type === 'SALE_APPROVED') {
    if (invoice.status === 'PAID') {
      return NextResponse.json({ ok: true, alreadyProcessed: true })
    }

    const updated = await prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        paidAt: now,
        boldPaymentId: paymentId,
        boldEventId: eventId,
        boldType: type,
      },
    })

    const empresa = await prisma.empresa.findUnique({ where: { id: updated.empresaId }, select: { planValidUntil: true } })
    const baseDate = empresa?.planValidUntil && empresa.planValidUntil > now ? empresa.planValidUntil : now

    const planTier = updated.planTier as PlanTier
    const billingCycle = updated.billingCycle as BillingCycle

    const planValidUntil = billingCycle === 'YEARLY' ? addYears(baseDate, 1) : addMonths(baseDate, 1)

    await prisma.empresa.update({
      where: { id: updated.empresaId },
      data: {
        planTier,
        billingCycle,
        planValidUntil,
        trialTier: null,
        trialStartedAt: null,
        trialValidUntil: null,
      },
    })

    return NextResponse.json({ ok: true })
  }

  if (type === 'SALE_REJECTED') {
    await prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'REJECTED',
        boldPaymentId: paymentId,
        boldEventId: eventId,
        boldType: type,
      },
    })

    return NextResponse.json({ ok: true })
  }

  if (type === 'VOID_APPROVED') {
    await prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'VOID',
        boldPaymentId: paymentId,
        boldEventId: eventId,
        boldType: type,
      },
    })

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true, ignored: true, type })
}
