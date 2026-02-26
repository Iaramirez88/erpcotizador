import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import CotizacionPDF from '@/lib/pdf-template'
import type { CotizacionPdfData } from '@/lib/pdf-template'
import { mergeCotizacionTemplateSettings, DEFAULT_COTIZACION_TEMPLATE } from '@/lib/cotizacion-template'
import { Document, Page, Text } from '@react-pdf/primitives'
import { createElement } from 'react'
import { getReactPdfRenderer, pdfToBuffer } from '@/lib/react-pdf-node'

export const runtime = 'nodejs'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function stripCotizacionImages(data: CotizacionPdfData): CotizacionPdfData {
  return {
    ...data,
    items: (data.items ?? []).map((it) => ({
      ...it,
      imagenUrl: null,
      material: it.material ? { ...it.material, imagenUrl: null } : null,
    })),
  }
}

function stripTemplateImages(template: unknown) {
  if (!isPlainObject(template)) return template
  const input = template as Record<string, unknown>
  const page = isPlainObject(input.page) ? (input.page as Record<string, unknown>) : null
  const header = isPlainObject(input.header) ? (input.header as Record<string, unknown>) : null
  const headerRight = header && isPlainObject(header.right) ? (header.right as Record<string, unknown>) : null
  const watermark = isPlainObject(input.watermark) ? (input.watermark as Record<string, unknown>) : null

  return {
    ...input,
    ...(page
      ? {
          page: {
            ...page,
            backgroundImageUrl: undefined,
          },
        }
      : {}),
    ...(header
      ? {
          header: {
            ...header,
            logoUrl: undefined,
            ...(headerRight
              ? {
                  right: {
                    ...headerRight,
                    logoUrl: undefined,
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(watermark
      ? {
          watermark: {
            ...watermark,
            imageUrl: undefined,
          },
        }
      : {}),
  }
}

async function renderCotizacionPdf(params: { cotizacion: CotizacionPdfData; template?: unknown }) {
  const renderer = await getReactPdfRenderer()
  const doc = CotizacionPDF({
    pdf: {
      Document: renderer.Document,
      Page: renderer.Page,
      Text: renderer.Text,
      View: renderer.View,
      Image: renderer.Image,
      StyleSheet: renderer.StyleSheet,
    },
    cotizacion: params.cotizacion,
    template: params.template,
  })
  return await pdfToBuffer(doc)
}

async function renderMinimalPdf(note: string) {
  const minimalDoc = createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'A4', style: { padding: 40, fontSize: 12, fontFamily: 'Helvetica' } },
      createElement(Text, { style: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 } }, 'COTIZACIÓN'),
      createElement(Text, null, 'Vista previa mínima'),
      createElement(Text, { style: { marginTop: 10 } }, note)
    )
  )

  return await pdfToBuffer(minimalDoc)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const incomingSettings = isPlainObject(body.settings) ? body.settings : undefined
  const incomingCotizacion = isPlainObject(body.cotizacion) ? body.cotizacion : undefined

  if (!incomingCotizacion) {
    return NextResponse.json({ success: false, error: 'Cotización inválida' }, { status: 400 })
  }

  const settings = mergeCotizacionTemplateSettings(incomingSettings ?? DEFAULT_COTIZACION_TEMPLATE)

  try {
    const cotizacion = incomingCotizacion as unknown as CotizacionPdfData
    const attempts: Array<{ stage: string; cotizacion: CotizacionPdfData; template?: unknown }> = [
      { stage: 'custom', cotizacion, template: settings },
      {
        stage: 'custom-no-images',
        cotizacion: stripCotizacionImages(cotizacion),
        template: stripTemplateImages(settings),
      },
      { stage: 'default', cotizacion, template: undefined },
      { stage: 'default-no-images', cotizacion: stripCotizacionImages(cotizacion), template: undefined },
    ]

    let buffer: Buffer | null = null
    let lastError: unknown = null
    let lastStage: string | null = null

    for (const a of attempts) {
      lastStage = a.stage
      try {
        buffer = await renderCotizacionPdf({ cotizacion: a.cotizacion, template: a.template })
        break
      } catch (e) {
        lastError = e
        console.warn(`[preview] PDF falló stage=${a.stage}`, e)
      }
    }

    if (!buffer) {
      const msg = lastError instanceof Error ? lastError.message : String(lastError)
      buffer = await renderMinimalPdf(`No se pudo renderizar la plantilla. (${lastStage ?? 'unknown'}: ${msg})`)
      lastStage = 'minimal'
    }

    const bytes = new Uint8Array(buffer)
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="cotizacion-preview.pdf"',
        'Cache-Control': 'no-store',
        'X-Preview-Stage': lastStage ?? 'unknown',
      },
    })
  } catch (err) {
    console.error('[preview] Error fatal generando PDF', err)

    const message = err instanceof Error ? err.message : 'Error al generar PDF'
    const stack = err instanceof Error ? err.stack : undefined

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ success: false, error: message, stack }, { status: 500 })
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
