import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Document, Page, Text } from '@react-pdf/primitives';
import CotizacionPDF from '@/lib/pdf-template';
import { requireApiAccess } from '@/lib/api-rbac';
import type { Prisma } from '@prisma/client';
import { ModuleKey } from '@prisma/client';
import { createElement } from 'react';
import { getReactPdfRenderer, pdfToBuffer } from '@/lib/react-pdf-node';
export const runtime = 'nodejs';

type CotizacionPayload = Prisma.CotizacionGetPayload<{
  include: {
    cliente: true
    vendedor: {
      select: {
        name: true
        email: true
        role: true
        telefono: true
        cargo: true
        sedeDefault: { select: { nombre: true } }
      }
    }
    items: { include: { material: true } }
  }
}>;

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
  // Remove control chars that can break PDF layout engines; keep \t, \n, \r.
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
  const page = input.page && typeof input.page === 'object' && !Array.isArray(input.page) ? (input.page as Record<string, unknown>) : null
  const header = input.header && typeof input.header === 'object' && !Array.isArray(input.header) ? (input.header as Record<string, unknown>) : null
  const headerRight = header?.right && typeof header.right === 'object' && !Array.isArray(header.right) ? (header.right as Record<string, unknown>) : null
  const watermark = input.watermark && typeof input.watermark === 'object' && !Array.isArray(input.watermark) ? (input.watermark as Record<string, unknown>) : null

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'READ');
    if (!access.ok) return access.response;

    const { id } = await context.params;

    const origin = new URL(request.url).origin

    const cotizacion = (await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        vendedor: {
          select: {
            name: true,
            email: true,
            role: true,
            telefono: true,
            cargo: true,
            sedeDefault: { select: { nombre: true } },
          },
        },
        items: {
          include: {
            material: true,
          },
        },
      },
    })) as CotizacionPayload | null;

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    const userId = access.userId;
    const userTemplate = await prisma.cotizacionTemplate.findUnique({
      where: { userId },
      select: { settings: true },
    });

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
          const unidadRaw = sanitizeText(item.unidad, 'unidad').trim()
          const unidad = unidadRaw.toLowerCase()
          const anchoM = typeof item.ancho === 'number' ? item.ancho / 100 : null
          const altoM = typeof item.alto === 'number' ? item.alto / 100 : null

          const medida =
            unidad === 'ml'
              ? (anchoM ?? 0)
              : unidad === 'm2'
                ? (typeof item.area === 'number' ? item.area : (anchoM ?? 0) * (altoM ?? 0))
                : 0

          const materialImage = item.material
            ? normalizePublicUrl((item.material as { imagenUrl?: unknown }).imagenUrl, origin)
            : null

          return {
            descripcion: sanitizeText(item.descripcion, 'Ítem'),
            unidad: unidadRaw,
            cantidad: safeNumber(item.cantidad, 0),
            ancho: anchoM,
            alto: altoM,
            metrosCuadrados: medida,
            precioUnitario: safeNumber(item.precioUnitario, 0),
            subtotal: safeNumber(item.subtotal, 0),
            laminado: item.laminado,
            troquelado: item.troquelado,
            instalacion: item.instalacion,
            costoInstalacion: safeNumber(item.costoInstalacion, 0),
            imagenUrl: materialImage,
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

    const attempts: Array<
      | { kind: 'template'; stage: string; template: unknown; data?: typeof cotizacionPdfData }
      | { kind: 'minimal'; stage: string }
    > = [
      { kind: 'template', stage: 'custom-template', template: normalizeTemplateUrls(userTemplate?.settings, origin) },
      { kind: 'template', stage: 'default-template', template: undefined },
      {
        kind: 'template',
        stage: 'default-no-item-images',
        template: undefined,
        data: stripItemImages(cotizacionPdfData),
      },
      { kind: 'minimal', stage: 'minimal' },
    ]

    let arrayBuffer: ArrayBuffer | null = null
    let lastError: unknown = null
    let lastStage: string | null = null

    for (const attempt of attempts) {
      lastStage = attempt.stage
      try {
        if (attempt.kind === 'minimal') {
          arrayBuffer = await renderMinimalPdf()
        } else {
          arrayBuffer = await renderPdfWithTemplate(attempt.template, attempt.data)
        }
        break
      } catch (e) {
        lastError = e
        console.warn(`PDF: falló ${attempt.stage}`, e)
      }
    }

    if (!arrayBuffer) {
      const message = lastError instanceof Error ? lastError.message : String(lastError)
      throw new Error(`PDF render falló (${lastStage ?? 'unknown'}): ${message}`)
    }

    const { searchParams } = new URL(request.url)
    const wantsDownload = searchParams.get('download') === '1'
    const disposition = wantsDownload ? 'attachment' : 'inline'

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="Cotizacion-${cotizacion.numero}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error generando PDF:', error);

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        {
          error: 'Error al generar PDF',
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Error al generar PDF' },
      { status: 500 }
    );
  }
}
