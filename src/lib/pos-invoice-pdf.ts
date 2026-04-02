import { createElement } from 'react'
import { prisma } from '@/lib/prisma'
import { getReactPdfRenderer, pdfToBuffer } from '@/lib/react-pdf-node'
import { PosInvoicePDFCore } from '@/lib/pos-invoice-pdf-template'
import {
  buildAbsoluteVerificationUrl,
  buildPosInvoiceVerificationPath,
  createVerificationQrDataUrl,
} from '@/lib/document-verification'

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

export async function loadPosInvoicePdfSource(invoiceId: string) {
  return prisma.posInvoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      numero: true,
      status: true,
      empresaId: true,
      sedeId: true,
      createdById: true,
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
      empresa: {
        select: { nombre: true, nit: true, direccion: true, telefono: true, logo: true },
      },
    },
  })
}

export async function renderPosInvoicePdf(args: {
  invoiceId: string
  origin: string
  templateSettings?: unknown
}) {
  const invoice = await loadPosInvoicePdfSource(args.invoiceId)
  if (!invoice) return null

  const renderer = await getReactPdfRenderer()
  const verificationUrl = buildAbsoluteVerificationUrl(args.origin, buildPosInvoiceVerificationPath(invoice.id))
  const verificationQrDataUrl = await createVerificationQrDataUrl(verificationUrl)

  const invoicePdfData = {
    numero: invoice.numero,
    createdAt: invoice.createdAt,
    status: invoice.status,
    clienteNombre: invoice.clienteNombre,
    clienteDocumento: invoice.clienteDocumento,
    warehouse: invoice.warehouse,
    subtotal: invoice.subtotal,
    iva: invoice.iva,
    total: invoice.total,
    note: invoice.note,
    items: invoice.items,
    payments: invoice.payments,
  }

  const empresaData = invoice.empresa
    ? {
        nombre: invoice.empresa.nombre,
        nit: invoice.empresa.nit || undefined,
        direccion: invoice.empresa.direccion || undefined,
        telefono: invoice.empresa.telefono || undefined,
        logo: normalizeAssetUrl(invoice.empresa.logo, args.origin),
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
      verification: {
        url: verificationUrl,
        qrDataUrl: verificationQrDataUrl,
      },
    })

    return pdfToBuffer(pdfDoc)
  }

  async function renderMinimalPdf() {
    const minimalDoc = createElement(
      renderer.Document,
      null,
      createElement(
        renderer.Page,
        { size: 'A4', style: { padding: 40, fontSize: 11, fontFamily: 'Helvetica' } },
        createElement(renderer.Text, { style: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 } }, 'FACTURA DE VENTA'),
        createElement(renderer.Text, null, `Número: ${invoicePdfData.numero}`),
        createElement(renderer.Text, null, `Cliente: ${invoicePdfData.clienteNombre}`),
        createElement(renderer.Text, null, `Total: ${invoicePdfData.total}`),
        createElement(renderer.Text, { style: { marginTop: 12 } }, `Verificación: ${verificationUrl}`),
        createElement(renderer.Image, { src: verificationQrDataUrl, style: { width: 180, height: 180, marginTop: 16 } }),
        createElement(renderer.Text, { style: { marginTop: 12 } }, 'Se generó una versión mínima porque la plantilla completa no pudo renderizarse.'),
      ),
    )
    return pdfToBuffer(minimalDoc)
  }

  const attempts: Array<{ kind: 'template'; template: unknown } | { kind: 'minimal' }> = [
    { kind: 'template', template: normalizeTemplateAssetUrls(args.templateSettings, args.origin) },
    { kind: 'template', template: undefined },
    { kind: 'minimal' },
  ]

  let buffer: Buffer | null = null
  let lastError: unknown = null

  for (const attempt of attempts) {
    try {
      buffer = attempt.kind === 'template'
        ? await renderInvoicePdf(attempt.template)
        : await renderMinimalPdf()
      break
    } catch (error) {
      lastError = error
      console.warn('PDF POS: intento fallido', error)
    }
  }

  if (!buffer) {
    throw new Error(lastError instanceof Error ? lastError.message : 'Error desconocido')
  }

  return {
    invoice,
    verificationUrl,
    arrayBuffer: bufferToArrayBuffer(buffer),
    buffer,
  }
}