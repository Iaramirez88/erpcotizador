import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { getResendClient } from '@/lib/email'
import { getRequestBaseUrl } from '@/lib/app-url'
import { renderPosInvoicePdf } from '@/lib/pos-invoice-pdf'

export const runtime = 'nodejs'

type Body = {
  destinatarios?: unknown
  mensaje?: unknown
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.POS, 'WRITE')
  if (!access.ok) return access.response

  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as Body
  const destinatarios = Array.isArray(body.destinatarios)
    ? body.destinatarios.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : []

  if (!destinatarios.length) {
    return NextResponse.json({ error: 'Debes indicar al menos un destinatario.' }, { status: 400 })
  }

  const origin = getRequestBaseUrl(req) || new URL(req.url).origin
  const template = await prisma.posInvoiceTemplate.findUnique({ where: { userId: access.userId }, select: { settings: true } })
  const rendered = await renderPosInvoicePdf({ invoiceId: id, origin, templateSettings: template?.settings })

  if (!rendered || rendered.invoice.empresaId !== access.empresaId || rendered.invoice.sedeId !== access.sedeId) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  const resend = getResendClient()
  if (!resend) {
    return NextResponse.json({ error: 'Email no configurado (falta RESEND_API_KEY).' }, { status: 500 })
  }

  const customMessage = typeof body.mensaje === 'string' ? body.mensaje.trim() : ''
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:640px;margin:0 auto;padding:24px">
      <h1 style="font-size:22px;margin:0 0 12px">Factura ${rendered.invoice.numero}</h1>
      <p>Hola,</p>
      <p>${customMessage || `Adjuntamos la factura ${rendered.invoice.numero} emitida a nombre de ${rendered.invoice.clienteNombre}.`}</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:16px 0">
        <p style="margin:0 0 6px"><strong>Cliente:</strong> ${rendered.invoice.clienteNombre}</p>
        <p style="margin:0 0 6px"><strong>Fecha:</strong> ${new Date(rendered.invoice.createdAt).toLocaleDateString('es-CO')}</p>
        <p style="margin:0"><strong>Total:</strong> ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(rendered.invoice.total)}</p>
      </div>
      <p>La factura va adjunta en PDF.</p>
    </div>
  `

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'SGDigital <onboarding@resend.dev>',
    to: destinatarios,
    subject: `Factura ${rendered.invoice.numero}`,
    html,
    attachments: [
      {
        filename: `Factura-${rendered.invoice.numero}.pdf`,
        content: rendered.buffer,
      },
    ],
  })

  if (error) {
    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : 500
    const message = typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : 'Error al enviar el correo'

    return NextResponse.json({ error: message }, { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 })
  }

  await prisma.posInvoiceAuditEvent.create({
    data: {
      invoiceId: rendered.invoice.id,
      action: 'SHARED_EMAIL',
      performedById: access.userId,
      note: customMessage || null,
      after: {
        to: destinatarios,
        toCount: destinatarios.length,
        emailId: data?.id ?? null,
      },
    },
  }).catch(() => null)

  return NextResponse.json({ success: true, emailId: data?.id ?? null })
}