import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Document, Page, Text } from '@react-pdf/primitives'
import CotizacionPDF from '@/lib/pdf-template'
import { verifyCotizacionShareToken } from '@/lib/share-token'
import { createElement } from 'react'
import { getReactPdfRenderer, pdfToBuffer } from '@/lib/react-pdf-node'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { parseQuoteItemObservaciones } from '@/lib/quote-item-metadata'

export const runtime = 'nodejs'

function normalizePublicUrl(value: unknown, origin: string): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`
  return null
}

function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) ? n : fallback
}

function sanitizeText(value: unknown, fallback = ''): string {
  const raw = typeof value === 'string' ? value : value == null ? '' : String(value)
  const cleaned = raw.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
  return cleaned || fallback
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

type ItemRecord = Record<string, unknown> & { material?: unknown; imagenUrl?: unknown }

function stripItemImages<T extends { items: ItemRecord[] }>(data: T): T {
  return {
    ...data,
    items: data.items.map((item) => {
      const material = item.material
      const materialObject =
        material && typeof material === 'object' && !Array.isArray(material)
          ? (material as Record<string, unknown>)
          : null

      return {
        ...item,
        imagenUrl: null,
        material: materialObject
          ? {
              ...materialObject,
              imagenUrl: null,
            }
          : null,
      }
    }),
  }
}

function normalizeTemplateUrls(settings: unknown, origin: string): unknown {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return settings

  const input = settings as Record<string, unknown>
  const page =
    input.page && typeof input.page === 'object' && !Array.isArray(input.page)
      ? (input.page as Record<string, unknown>)
      : null
  const header =
    input.header && typeof input.header === 'object' && !Array.isArray(input.header)
      ? (input.header as Record<string, unknown>)
      : null
  const headerRight =
    header?.right && typeof header.right === 'object' && !Array.isArray(header.right)
      ? (header.right as Record<string, unknown>)
      : null
  const watermark =
    input.watermark && typeof input.watermark === 'object' && !Array.isArray(input.watermark)
      ? (input.watermark as Record<string, unknown>)
      : null

  const out: Record<string, unknown> = { ...input }
  if (page) {
    out.page = {
      ...page,
      backgroundImageUrl: normalizePublicUrl(page.backgroundImageUrl, origin) ?? undefined,
    }
  }
  if (header) {
    out.header = {
      ...header,
      logoUrl: normalizePublicUrl(header.logoUrl, origin) ?? undefined,
      right: headerRight
        ? {
            ...headerRight,
            logoUrl: normalizePublicUrl(headerRight.logoUrl, origin) ?? undefined,
          }
        : header.right,
    }
  }
  if (watermark) {
    out.watermark = {
      ...watermark,
      imageUrl: normalizePublicUrl(watermark.imageUrl, origin) ?? undefined,
    }
  }

  return out
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ success: false, error: 'Falta token' }, { status: 400 })
    }

    const secret = process.env.SHARE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET
    if (!secret) {
      return NextResponse.json(
        { success: false, error: 'Falta configurar SHARE_TOKEN_SECRET (o NEXTAUTH_SECRET).' },
        { status: 500 }
      )
    }

    const verified = verifyCotizacionShareToken(token, secret)
    if (!verified) {
      return NextResponse.json({ success: false, error: 'Token inválido o expirado' }, { status: 401 })
    }

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id: verified.cotizacionId },
      include: {
        cliente: true,
        vendedor: { select: { id: true, empresaId: true, name: true, email: true, role: true, telefono: true, cargo: true, sedeDefault: { select: { nombre: true } } } },
        items: { include: { material: true } },
      },
    })

    if (!cotizacion) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    const vendedorEmpresaId = cotizacion.vendedor.empresaId ?? (await requireEmpresaIdForUser(cotizacion.vendedor.id))
    const empresaTemplate = await prisma.empresaCotizacionTemplate.findUnique({
      where: { empresaId: vendedorEmpresaId },
      select: { settings: true },
    })
    const template = await prisma.cotizacionTemplate.findUnique({
      where: { userId: cotizacion.vendedor.id },
      select: { settings: true },
    })

    const effectiveTemplateSettings = empresaTemplate?.settings ?? template?.settings

    const origin = new URL(request.url).origin

    const cotizacionPdfData = {
      numero: sanitizeText(cotizacion.numero, 'COTIZACIÓN'),
      createdAt: cotizacion.createdAt,
      validezDias: Math.max(0, Math.trunc(safeNumber(cotizacion.validezDias, 15))),
      estado: sanitizeText(cotizacion.estado, ''),
      observaciones: sanitizeText(cotizacion.observaciones, '') || null,
      garantia: sanitizeText(cotizacion.garantia, '') || null,
      paymentMethods: Array.isArray(cotizacion.paymentMethods)
        ? cotizacion.paymentMethods.map((x) => sanitizeText(x, '')).filter(Boolean)
        : [],
      boldCheckoutUrl: sanitizeText(cotizacion.boldCheckoutUrl, '') || null,
      cliente: {
        nombre: sanitizeText(cotizacion.cliente.nombre, '-'),
        email: sanitizeText(cotizacion.cliente.email, '') || null,
        telefono: sanitizeText(cotizacion.cliente.telefono, '') || null,
      },
      vendedor: {
        name: sanitizeText(cotizacion.vendedor?.name, '') || null,
        email: sanitizeText(cotizacion.vendedor?.email, '') || null,
        role: sanitizeText(cotizacion.vendedor?.role, '') || null,
        telefono: sanitizeText(cotizacion.vendedor?.telefono, '') || null,
        cargo: sanitizeText(cotizacion.vendedor?.cargo, '') || null,
        sedeNombre: sanitizeText(cotizacion.vendedor?.sedeDefault?.nombre, '') || null,
      },
      items: cotizacion.items.map((item) => {
        const parsedObservaciones = parseQuoteItemObservaciones(item.observaciones)
        const materialImage = item.material
          ? normalizePublicUrl((item.material as { imagenUrl?: unknown }).imagenUrl, origin)
          : null

        return {
          descripcion: sanitizeText(item.descripcion, 'Ítem'),
          unidad: sanitizeText(item.unidad, 'unidad'),
          cantidad: safeNumber(item.cantidad, 0),
          ancho: typeof item.ancho === 'number' ? item.ancho / 100 : null,
          alto: typeof item.alto === 'number' ? item.alto / 100 : null,
          metrosCuadrados: (() => {
            const unidad = String(item.unidad || '').trim().toLowerCase()
            const anchoM = typeof item.ancho === 'number' ? item.ancho / 100 : null
            const altoM = typeof item.alto === 'number' ? item.alto / 100 : null
            return unidad === 'ml'
              ? (anchoM ?? 0)
              : unidad === 'm2'
                ? (typeof item.area === 'number' ? item.area : (anchoM ?? 0) * (altoM ?? 0))
                : 0
          })(),
          precioUnitario: safeNumber(item.precioUnitario, 0),
          subtotal: safeNumber(item.subtotal, 0),
          laminado: item.laminado,
          troquelado: item.troquelado,
          instalacion: item.instalacion,
          costoInstalacion: safeNumber(item.costoInstalacion, 0),
          imagenUrl: materialImage,
          additionalFieldTitle: parsedObservaciones.extraMeta?.additionalFieldTitle || null,
          additionalFieldDescription: parsedObservaciones.extraMeta?.additionalFieldDescription || null,
          additionalQuantity: safeNumber(parsedObservaciones.extraMeta?.additionalQuantity, 0),
          additionalValue: safeNumber(parsedObservaciones.extraMeta?.additionalValue, 0),
          referenceImage: parsedObservaciones.extraMeta?.referenceImage?.url
            ? {
                name: sanitizeText(parsedObservaciones.extraMeta.referenceImage.name, 'Referencia') || 'Referencia',
                url: parsedObservaciones.extraMeta.referenceImage.url,
                scalePct: parsedObservaciones.extraMeta.referenceImage.scalePct,
              }
            : null,
          material: item.material
            ? {
                nombre: sanitizeText(item.material.nombre, ''),
                tipo: sanitizeText(item.material.tipo, ''),
                imagenUrl: materialImage,
              }
            : null,
        }
      }),
      subtotal: safeNumber(cotizacion.subtotal, 0),
      iva: safeNumber(cotizacion.iva, 0),
      total: safeNumber(cotizacion.total, 0),
    }

    async function renderPdfWithTemplate(templateSettings: unknown, dataOverride?: typeof cotizacionPdfData) {
      const renderer = await getReactPdfRenderer()
      const pdfDoc = CotizacionPDF({
        pdf: {
          Document: renderer.Document,
          Page: renderer.Page,
          Text: renderer.Text,
          View: renderer.View,
          Image: renderer.Image,
          StyleSheet: renderer.StyleSheet,
        },
        cotizacion: dataOverride ?? cotizacionPdfData,
        template: templateSettings,
      })

      const buffer = await pdfToBuffer(pdfDoc)
      return bufferToArrayBuffer(buffer)
    }

    async function renderMinimalPdf() {
      const minimalDoc = createElement(
        Document,
        null,
        createElement(
          Page,
          { size: 'A4', style: { padding: 40, fontSize: 12, fontFamily: 'Helvetica' } },
          createElement(
            Text,
            { style: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 } },
            'COTIZACIÓN'
          ),
          createElement(Text, null, `Número: ${cotizacionPdfData.numero}`),
          createElement(Text, null, `Cliente: ${cotizacionPdfData.cliente.nombre}`),
          createElement(
            Text,
            { style: { marginTop: 10 } },
            'Nota: No se pudo renderizar el template completo.'
          )
        )
      )

      const buffer = await pdfToBuffer(minimalDoc)
      return bufferToArrayBuffer(buffer)
    }

    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await renderPdfWithTemplate(normalizeTemplateUrls(effectiveTemplateSettings, origin))
    } catch (e1) {
      console.warn('PDF público: falló template personalizado, reintentando con default.', e1)
      try {
        arrayBuffer = await renderPdfWithTemplate(undefined)
      } catch (e2) {
        console.warn('PDF público: falló template default, reintentando sin imágenes.', e2)
        try {
          arrayBuffer = await renderPdfWithTemplate(undefined, stripItemImages(cotizacionPdfData))
        } catch (e3) {
          console.warn('PDF público: falló sin imágenes, usando PDF mínimo.', e3)
          arrayBuffer = await renderMinimalPdf()
        }
      }
    }

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Cotizacion-${cotizacion.numero}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generando PDF público:', error)

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        {
          success: false,
          error: 'Error al generar PDF',
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: false, error: 'Error al generar PDF' }, { status: 500 })
  }
}
