/**
 * GET /api/remisiones/:id/pdf
 * Genera y descarga el PDF de una remisión
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { RemisionPDFCore } from '@/lib/remision-pdf-template'
import { getReactPdfRenderer, pdfToBuffer } from '@/lib/react-pdf-node'

export const runtime = 'nodejs'

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess('REMISIONES' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const { id } = await context.params

    const remision = await prisma.remision.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        status: true,
        clienteNombre: true,
        note: true,
        createdAt: true,
        empresaId: true,
        warehouse: { select: { nombre: true } },
        items: {
          select: {
            quantity: true,
            note: true,
            material: {
              select: {
                nombre: true,
                unidadMedida: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!remision) {
      return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 })
    }

    // Obtener plantilla del usuario
    const userTemplate = await prisma.remisionTemplate.findUnique({
      where: { userId: remision.createdBy?.id || access.userId },
      select: { settings: true },
    })

    // Obtener datos de la empresa
    const empresa = await prisma.empresa.findUnique({
      where: { id: remision.empresaId },
      select: {
        nombre: true,
        nit: true,
        direccion: true,
        telefono: true,
        logo: true,
      },
    })

    const renderer = await getReactPdfRenderer()
    const pdfDoc = RemisionPDFCore({
      pdf: {
        Document: renderer.Document,
        Page: renderer.Page,
        Text: renderer.Text,
        View: renderer.View,
        Image: renderer.Image,
        StyleSheet: renderer.StyleSheet,
      },
      remision: {
        numero: remision.numero,
        createdAt: remision.createdAt,
        status: remision.status,
        clienteNombre: remision.clienteNombre,
        note: remision.note,
        warehouse: remision.warehouse,
        items: remision.items.map((item) => ({
          quantity: item.quantity,
          note: item.note,
          material: {
            nombre: item.material.nombre,
            unidadMedida: item.material.unidadMedida,
          },
        })),
        createdBy: remision.createdBy,
      },
      empresa: empresa
        ? {
            nombre: empresa.nombre,
            nit: empresa.nit || undefined,
            direccion: empresa.direccion || undefined,
            telefono: empresa.telefono || undefined,
            logo: empresa.logo || undefined,
          }
        : undefined,
      template: userTemplate?.settings,
    })

    const buffer = await pdfToBuffer(pdfDoc)
    const arrayBuffer = bufferToArrayBuffer(buffer)

    const { searchParams } = new URL(request.url)
    const wantsDownload = searchParams.get('download') === '1'
    const disposition = wantsDownload ? 'attachment' : 'inline'

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="Remision-${remision.numero}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generando PDF de remisión:', error)
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 })
  }
}
