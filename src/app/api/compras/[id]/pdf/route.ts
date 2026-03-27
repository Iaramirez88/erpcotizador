import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { OrdenCompraPDFCore } from '@/lib/orden-compra-pdf-template'
import { getReactPdfRenderer, pdfToBuffer } from '@/lib/react-pdf-node'

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

function purchasePdfFilename(compra: {
  id: string
  numeroOrden: string | null
  numeroFactura: string | null
  numeroPedido: string | null
}) {
  const raw = compra.numeroOrden || compra.numeroFactura || compra.numeroPedido || compra.id
  const safe = String(raw).replace(/[^a-zA-Z0-9_-]+/g, '-')
  return `Compra-${safe}.pdf`
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COMPRAS, 'READ')
    if (!access.ok) return access.response

    const { id } = await context.params
    const origin = new URL(request.url).origin

    const compra = await prisma.compra.findFirst({
      where: {
        id,
        empresaId: access.empresaId,
      },
      select: {
        id: true,
        fechaCompra: true,
        estado: true,
        proveedorNombre: true,
        proveedorTelefono: true,
        proveedorDireccion: true,
        recibidoPorNombre: true,
        numeroPedido: true,
        numeroOrden: true,
        numeroFactura: true,
        sede: true,
        observaciones: true,
        autorizado: true,
        empresaId: true,
        items: {
          orderBy: { orden: 'asc' },
          select: {
            descripcion: true,
            cantidad: true,
            precioUnitario: true,
            descuento: true,
            iva: true,
          },
        },
      },
    })

    if (!compra) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    const compraData = compra

    const [template, empresa] = await Promise.all([
      prisma.ordenCompraTemplate.findUnique({
        where: { userId: access.userId },
        select: { settings: true },
      }),
      prisma.empresa.findUnique({
        where: { id: compraData.empresaId },
        select: {
          nombre: true,
          nit: true,
          direccion: true,
          telefono: true,
          logo: true,
        },
      }),
    ])

    const renderer = await getReactPdfRenderer()

    const orden = {
      numeroOrden: compraData.numeroOrden,
      numeroPedido: compraData.numeroPedido,
      fechaCompra: compraData.fechaCompra,
      proveedorNombre: compraData.proveedorNombre,
      proveedorTelefono: compraData.proveedorTelefono,
      proveedorDireccion: compraData.proveedorDireccion,
      sede: compraData.sede,
      observaciones: compraData.observaciones,
      recibidoPorNombre: compraData.recibidoPorNombre,
      autorizado: compraData.autorizado,
      items: compraData.items.map((item) => ({
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        descuento: item.descuento,
        iva: item.iva,
      })),
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

    async function renderOrdenCompraPdf(templateSettings: unknown) {
      const pdfDoc = OrdenCompraPDFCore({
        pdf: {
          Document: renderer.Document,
          Page: renderer.Page,
          Text: renderer.Text,
          View: renderer.View,
          Image: renderer.Image,
          StyleSheet: renderer.StyleSheet,
        },
        orden,
        empresa: empresaData,
        template: templateSettings,
      })

      const buffer = await pdfToBuffer(pdfDoc)
      return bufferToArrayBuffer(buffer)
    }

    async function renderMinimalPdf(note: string) {
      const minimalDoc = createElement(
        renderer.Document,
        null,
        createElement(
          renderer.Page,
          { size: 'A4', style: { padding: 40, fontSize: 11, fontFamily: 'Helvetica' } },
          createElement(renderer.Text, { style: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 } }, 'ORDEN DE COMPRA'),
          createElement(renderer.Text, null, `Proveedor: ${compraData.proveedorNombre}`),
          createElement(renderer.Text, null, `Documento: ${compraData.numeroOrden || compraData.numeroFactura || compraData.numeroPedido || compraData.id}`),
          createElement(renderer.Text, { style: { marginTop: 12 } }, note)
        )
      )

      const buffer = await pdfToBuffer(minimalDoc)
      return bufferToArrayBuffer(buffer)
    }

    const attempts: Array<
      | { kind: 'template'; template: unknown }
      | { kind: 'minimal'; note: string }
    > = [
      { kind: 'template', template: normalizeTemplateAssetUrls(template?.settings, origin) },
      { kind: 'template', template: undefined },
      { kind: 'minimal', note: 'Se generó una versión mínima porque la plantilla completa no pudo renderizarse.' },
    ]

    let arrayBuffer: ArrayBuffer | null = null
    let lastError: unknown = null

    for (const attempt of attempts) {
      try {
        arrayBuffer = attempt.kind === 'template'
          ? await renderOrdenCompraPdf(attempt.template)
          : await renderMinimalPdf(attempt.note)
        break
      } catch (error) {
        lastError = error
        console.warn('PDF compra: intento fallido', error)
      }
    }

    if (!arrayBuffer) {
      const message = lastError instanceof Error ? lastError.message : 'Error desconocido'
      throw new Error(message)
    }

    const wantsDownload = new URL(request.url).searchParams.get('download') === '1'
    const disposition = wantsDownload ? 'attachment' : 'inline'

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${purchasePdfFilename(compraData)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error generando PDF de compra:', error)
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 })
  }
}