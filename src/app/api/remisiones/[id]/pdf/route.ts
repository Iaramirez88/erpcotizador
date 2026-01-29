/**
 * GET /api/remisiones/:id/pdf
 * Genera y descarga el PDF de una remisión
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { pdf } from '@react-pdf/renderer'
import { RemisionPDF } from '@/lib/remision-pdf-template'

export const runtime = 'nodejs'

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

    const pdfDoc = RemisionPDF({
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

    const pdfBlob = await pdf(pdfDoc).toBlob()
    const arrayBuffer = await pdfBlob.arrayBuffer()

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
