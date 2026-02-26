import React from 'react'
import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import CotizacionPDF from '@/lib/pdf-template'
import { DEFAULT_COTIZACION_TEMPLATE } from '@/lib/cotizacion-template'

async function main() {
  const now = new Date()

  const mockCotizacion: Parameters<typeof CotizacionPDF>[0]['cotizacion'] = {
    numero: 'COT-DEBUG-0001',
    createdAt: now,
    validezDias: 15,
    estado: 'BORRADOR',
    observaciones: 'Observación de ejemplo: tiempos de entrega sujetos a confirmación.',
    garantia: 'Garantía de 30 días por defectos de fabricación.',
    paymentMethods: ['EFECTIVO', 'TRANSFERENCIA', 'BOLD'],
    boldCheckoutUrl: 'https://checkout.bold.co/xxxxxx',
    cliente: {
      nombre: 'Cliente de Prueba',
      email: 'cliente@correo.com',
      telefono: '300 000 0000',
      empresa: 'Empresa Demo S.A.S',
    },
    vendedor: {
      name: 'Vendedor Demo',
      email: 'vendedor@sgdigital.com',
    },
    items: [
      {
        cantidad: 2,
        ancho: 1.2,
        alto: 0.8,
        metrosCuadrados: 1.92,
        precioUnitario: 150000,
        subtotal: 300000,
        laminado: true,
        troquelado: false,
        instalacion: true,
        material: { nombre: 'Banner 13oz', tipo: 'BANNER' },
      },
      {
        cantidad: 1,
        ancho: null,
        alto: null,
        metrosCuadrados: undefined,
        precioUnitario: 85000,
        subtotal: 85000,
        laminado: false,
        troquelado: true,
        instalacion: false,
        material: { nombre: 'Vinilo adhesivo', tipo: 'VINILO' },
      },
    ],
    subtotal: 385000,
    iva: 73150,
    total: 458150,
    notas: 'Nota de ejemplo: incluye diseño básico.',
  }

  try {
    const instance = pdf(
      <CotizacionPDF
        pdf={{ Document, Page, Text, View, Image, StyleSheet }}
        cotizacion={mockCotizacion}
        template={DEFAULT_COTIZACION_TEMPLATE}
      />
    )
    const docOrBuffer = await instance.toBuffer()
    const ctorName = (docOrBuffer as any)?.constructor?.name
    console.log('OK: PDF generado (raw)')
    console.log('  type:', typeof docOrBuffer)
    console.log('  ctor:', ctorName)

    const maybeStream = docOrBuffer as any
    if (maybeStream && typeof maybeStream.on === 'function') {
      const chunks: Buffer[] = []
      await new Promise<void>((resolve, reject) => {
        maybeStream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
        maybeStream.on('end', () => resolve())
        maybeStream.on('error', (e: unknown) => reject(e))
      })
      const out = Buffer.concat(chunks)
      console.log('OK: PDF recolectado, bytes=', out.length)
    } else if (docOrBuffer && typeof (docOrBuffer as any).byteLength === 'number') {
      console.log('OK: byteLength=', (docOrBuffer as any).byteLength)
    } else if (docOrBuffer && typeof (docOrBuffer as any).length === 'number') {
      console.log('OK: length=', (docOrBuffer as any).length)
    } else {
      console.log('WARN: salida inesperada (no stream/buffer detectable)')
    }
  } catch (err) {
    console.error('ERROR al generar PDF')
    if (err instanceof Error) {
      console.error(err.message)
      console.error(err.stack)
    } else {
      console.error(err)
    }
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('ERROR fatal en debug script')
  if (err instanceof Error) {
    console.error(err.message)
    console.error(err.stack)
  } else {
    console.error(err)
  }
  process.exitCode = 1
})
