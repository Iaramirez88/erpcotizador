/**
 * POST /api/remisiones/:id/enviar
 * Envía la remisión por email con PDF adjunto
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { Resend } from 'resend'
import { pdf } from '@react-pdf/renderer'
import { RemisionPDF } from '@/lib/remision-pdf-template'

export const runtime = 'nodejs'

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  return apiKey ? new Resend(apiKey) : null
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess('REMISIONES' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params

    const body = (await request.json().catch(() => ({}))) as {
      destinatarios?: string | string[]
      mensaje?: string
    }

    const destinatariosRaw = body.destinatarios || []
    const destinatarios = Array.isArray(destinatariosRaw)
      ? destinatariosRaw.filter((e) => typeof e === 'string' && e.includes('@'))
      : typeof destinatariosRaw === 'string' && destinatariosRaw.includes('@')
      ? [destinatariosRaw]
      : []

    if (destinatarios.length === 0) {
      return NextResponse.json({ error: 'Proporciona al menos un destinatario válido' }, { status: 400 })
    }

    const mensajePersonalizado = typeof body.mensaje === 'string' ? body.mensaje.trim() : ''

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

    // Generar PDF
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
    const pdfBuffer = await pdfBlob.arrayBuffer()

    // Plantilla de email
    const htmlEmail = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 20px; }
            .footer { background-color: #1e293b; color: #94a3b8; padding: 15px; text-align: center; font-size: 12px; }
            .button { background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0; }
            .info-box { background-color: white; border-left: 4px solid #2563eb; padding: 15px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Remisión ${remision.numero}</h1>
              <p>${empresa?.nombre || 'SGDigital Softwares'}</p>
            </div>
            
            <div class="content">
              ${
                mensajePersonalizado
                  ? `<div class="info-box">
                  <p><strong>Mensaje:</strong></p>
                  <p>${mensajePersonalizado}</p>
                </div>`
                  : ''
              }
              
              <p>Se adjunta la remisión <strong>${remision.numero}</strong> en formato PDF.</p>
              
              <div class="info-box">
                <p><strong>Detalles de la remisión:</strong></p>
                <ul>
                  <li>Número: ${remision.numero}</li>
                  <li>Fecha: ${new Date(remision.createdAt).toLocaleDateString('es-CO')}</li>
                  <li>Estado: ${remision.status}</li>
                  ${remision.clienteNombre ? `<li>Cliente: ${remision.clienteNombre}</li>` : ''}
                  ${remision.warehouse?.nombre ? `<li>Sede: ${remision.warehouse.nombre}</li>` : ''}
                  <li>Items: ${remision.items.length}</li>
                </ul>
              </div>
              
              <p>Si tiene alguna pregunta, no dude en contactarnos.</p>
            </div>
            
            <div class="footer">
              <p>${empresa?.nombre || 'SGDigital Softwares'}</p>
              ${empresa?.direccion ? `<p>${empresa.direccion}</p>` : ''}
              ${empresa?.telefono ? `<p>Tel: ${empresa.telefono}</p>` : ''}
              <p style="margin-top: 10px;">Este es un correo automático, por favor no responder.</p>
            </div>
          </div>
        </body>
      </html>
    `

    const resend = getResendClient()
    if (!resend) {
      return NextResponse.json(
        {
          error: 'Email no configurado (falta RESEND_API_KEY).',
        },
        { status: 500 }
      )
    }

    // Enviar email
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'SGDigital <onboarding@resend.dev>',
      to: destinatarios,
      subject: `Remisión ${remision.numero} - ${empresa?.nombre || 'SGDigital Softwares'}`,
      html: htmlEmail,
      attachments: [
        {
          filename: `Remision-${remision.numero}.pdf`,
          content: Buffer.from(pdfBuffer),
        },
      ],
    })

    if (error) {
      console.error('Error enviando email:', error)
      return NextResponse.json({ error: `Error al enviar email: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        emailId: data?.id,
        destinatarios,
      },
    })
  } catch (error) {
    console.error('Error enviando remisión por email:', error)
    return NextResponse.json({ error: 'Error al enviar email' }, { status: 500 })
  }
}
