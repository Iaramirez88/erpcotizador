import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { getReactPdfRenderer, pdfToBuffer } from '@/lib/react-pdf-node'
import { PosInvoicePDFCore } from '@/lib/pos-invoice-pdf-template'

export const runtime = 'nodejs'

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

function normalizeAssetUrl(value: unknown, origin: string): string | undefined {
  if (typeof value !== 'string') return undefined
  const raw = value.trim()
  if (!raw) return undefined
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`
  return undefined
}

function normalizeTemplateAssetUrls(settings: unknown, origin: string): unknown {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return settings
  const input = settings as Record<string, unknown>
  const header = input.header && typeof input.header === 'object' && !Array.isArray(input.header)
    ? (input.header as Record<string, unknown>)
    : null

  if (!header) return settings

  return {
    ...input,
    header: {
      ...header,
      logo: normalizeAssetUrl(header.logo, origin) ?? header.logo,
      logoUrl: normalizeAssetUrl(header.logoUrl, origin) ?? header.logoUrl,
    },
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.POS, 'READ')
    if (!access.ok) return access.response

    const { id } = await ctx.params
    const origin = new URL(request.url).origin

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
        subtotal: true,
        iva: true,
        total: true,
        note: true,
        createdAt: true,
        warehouse: { select: { nombre: true, codigo: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          select: { descripcion: true, quantity: true, unitPrice: true, total: true },
        },
        payments: {
          orderBy: { receivedAt: 'asc' },
          select: { method: true, amount: true, note: true, receivedAt: true },
        },
      },
    })

    if (!invoice || invoice.empresaId !== access.empresaId || invoice.sedeId !== access.sedeId) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    const invoiceData = invoice

    const [template, empresa] = await Promise.all([
      prisma.posInvoiceTemplate.findUnique({ where: { userId: access.userId }, select: { settings: true } }),
      prisma.empresa.findUnique({
        where: { id: invoiceData.empresaId },
        select: { nombre: true, nit: true, direccion: true, telefono: true, logo: true },
      }),
    ])

    const renderer = await getReactPdfRenderer()

    const invoicePdfData = {
      numero: invoiceData.numero,
      createdAt: invoiceData.createdAt,
      status: invoiceData.status,
      clienteNombre: invoiceData.clienteNombre,
      clienteDocumento: invoiceData.clienteDocumento,
      warehouse: invoiceData.warehouse,
      subtotal: invoiceData.subtotal,
      iva: invoiceData.iva,
      total: invoiceData.total,
      note: invoiceData.note,
      items: invoiceData.items,
      payments: invoiceData.payments,
    }

    const empresaData = empresa
      ? {
          nombre: empresa.nombre,
          nit: empresa.nit || undefined,
          direccion: empresa.direccion || undefined,
          telefono: empresa.telefono || undefined,
          logo: normalizeAssetUrl(empresa.logo, origin),
        }
      : undefined

    async function renderInvoicePdf(templateSettings: unknown) {
      const pdfDoc = PosInvoicePDFCore({
        pdf: {
          Document: renderer.Document,
          Page: renderer.Page,
          Text: renderer.Text,
          View: renderer.View,
          Image: renderer.Image,
          StyleSheet: renderer.StyleSheet,
        },
        invoice: invoicePdfData,
        empresa: empresaData,
        template: templateSettings,
      })

      const buffer = await pdfToBuffer(pdfDoc)
      return bufferToArrayBuffer(buffer)
    }

    async function renderMinimalPdf() {
      const minimalDoc = createElement(
        renderer.Document,
        null,
        createElement(
          renderer.Page,
          { size: 'A4', style: { padding: 40, fontSize: 11, fontFamily: 'Helvetica' } },
          createElement(renderer.Text, { style: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 } }, 'FACTURA DE VENTA'),
          createElement(renderer.Text, null, `Número: ${invoiceData.numero}`),
          createElement(renderer.Text, null, `Cliente: ${invoiceData.clienteNombre}`),
          createElement(renderer.Text, null, `Total: ${invoiceData.total}`),
          createElement(renderer.Text, { style: { marginTop: 12 } }, 'Se generó una versión mínima porque la plantilla completa no pudo renderizarse.'),
        )
      )
      const buffer = await pdfToBuffer(minimalDoc)
      return bufferToArrayBuffer(buffer)
    }

    const attempts: Array<{ kind: 'template'; template: unknown } | { kind: 'minimal' }> = [
      { kind: 'template', template: normalizeTemplateAssetUrls(template?.settings, origin) },
      { kind: 'template', template: undefined },
      { kind: 'minimal' },
    ]

    let arrayBuffer: ArrayBuffer | null = null
    let lastError: unknown = null

    for (const attempt of attempts) {
      try {
        arrayBuffer = attempt.kind === 'template' ? await renderInvoicePdf(attempt.template) : await renderMinimalPdf()
        break
      } catch (error) {
        lastError = error
        console.warn('PDF POS: intento fallido', error)
      }
    }

    if (!arrayBuffer) {
      throw new Error(lastError instanceof Error ? lastError.message : 'Error desconocido')
    }

    const wantsDownload = new URL(request.url).searchParams.get('download') === '1'
    const disposition = wantsDownload ? 'attachment' : 'inline'

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="Factura-${invoiceData.numero}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generando PDF POS:', error)
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 })
  }
}