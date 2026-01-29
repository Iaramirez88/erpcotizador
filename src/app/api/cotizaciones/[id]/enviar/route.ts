import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiAccess } from '@/lib/api-rbac';
import { ModuleKey } from '@prisma/client';
import { Resend } from 'resend';
import { pdf } from '@react-pdf/renderer';
import CotizacionPDF from '@/lib/pdf-template';

export const runtime = 'nodejs';

function normalizePublicUrl(value: unknown, origin: string): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`
  return raw
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE');
    if (!access.ok) return access.response;

    const { destinatarios, copiarContabilidad, mensaje } = await request.json();

    if (!destinatarios || destinatarios.length === 0) {
      return NextResponse.json(
        { error: 'Debe especificar al menos un destinatario' },
        { status: 400 }
      );
    }

    const { id } = await context.params;

    const origin = new URL(request.url).origin

    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        vendedor: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            material: true,
          },
        },
      },
    });

    if (!cotizacion) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    const userId = access.userId;
    const userTemplate = await prisma.cotizacionTemplate.findUnique({
      where: { userId },
      select: { settings: true },
    });

    // Generar PDF
    const pdfDoc = CotizacionPDF({ 
      cotizacion: {
        numero: cotizacion.numero,
        createdAt: cotizacion.createdAt,
        validezDias: cotizacion.validezDias,
        estado: cotizacion.estado,
        observaciones: cotizacion.observaciones,
        garantia: cotizacion.garantia ?? null,
        paymentMethods: cotizacion.paymentMethods ?? [],
        boldCheckoutUrl: cotizacion.boldCheckoutUrl ?? null,
        cliente: {
          nombre: cotizacion.cliente.nombre,
          email: cotizacion.cliente.email,
          telefono: cotizacion.cliente.telefono,
        },
        vendedor: {
          name: cotizacion.vendedor.name,
          email: cotizacion.vendedor.email,
        },
        items: cotizacion.items.map((item) => {
          const unidad = String(item.unidad || '').trim().toLowerCase()
          const anchoM = typeof item.ancho === 'number' ? item.ancho / 100 : null
          const altoM = typeof item.alto === 'number' ? item.alto / 100 : null

          const medida =
            unidad === 'ml'
              ? (anchoM ?? 0)
              : unidad === 'm2'
                ? (typeof item.area === 'number' ? item.area : (anchoM ?? 0) * (altoM ?? 0))
                : 0

          const placeholder = `${origin}/api/assets/placeholder-product?s=64`
          const materialImage = item.material
            ? normalizePublicUrl((item.material as { imagenUrl?: unknown }).imagenUrl, origin)
            : null

          return {
            descripcion: item.descripcion,
            unidad: item.unidad,
            cantidad: item.cantidad,
            ancho: anchoM,
            alto: altoM,
            metrosCuadrados: medida,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            laminado: item.laminado,
            troquelado: item.troquelado,
            instalacion: item.instalacion,
            costoInstalacion: item.costoInstalacion,
            imagenUrl: materialImage || placeholder,
            material: item.material
              ? {
                  nombre: item.material.nombre,
                  tipo: item.material.tipo,
                  imagenUrl: materialImage,
                }
              : null,
          }
        }),
        subtotal: cotizacion.subtotal,
        iva: cotizacion.iva,
        total: cotizacion.total,
      },
      template: userTemplate?.settings,
    });
    const pdfBlob = await pdf(pdfDoc).toBlob();
    const pdfBuffer = await pdfBlob.arrayBuffer();

    // Preparar destinatarios
    const to = destinatarios;
    const cc = [];
    
    if (copiarContabilidad && process.env.CONTABILIDAD_EMAIL) {
      cc.push(process.env.CONTABILIDAD_EMAIL);
    }

    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(value);
    };

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
            .info-box { background-color: white; border-left: 4px solid #2563eb; padding: 15px; margin: 15px 0; }
            .total { font-size: 24px; font-weight: bold; color: #2563eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>SGDigital Softwares</h1>
              <p>Cotización ${cotizacion.numero}</p>
            </div>
            
            <div class="content">
              <p>Estimado/a ${cotizacion.cliente.nombre},</p>
              
              ${mensaje ? `<p>${mensaje}</p>` : `
                <p>Por medio de la presente, le hacemos llegar nuestra cotización para los servicios de impresión digital solicitados.</p>
              `}
              
              <div class="info-box">
                <h3>Resumen de Cotización</h3>
                <p><strong>Número:</strong> ${cotizacion.numero}</p>
                <p><strong>Fecha:</strong> ${new Date(cotizacion.createdAt).toLocaleDateString('es-MX', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p><strong>Válida hasta:</strong> ${new Date(
                  new Date(cotizacion.createdAt).getTime() +
                    cotizacion.validezDias * 24 * 60 * 60 * 1000
                ).toLocaleDateString('es-MX', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p class="total">Total: ${formatCurrency(cotizacion.total)}</p>
                <p style="font-size: 12px; color: #64748b;">IVA incluido</p>
              </div>
              
              <p>Adjuntamos el documento PDF con el detalle completo de la cotización.</p>
              
              <p>Quedamos a su disposición para cualquier duda o aclaración.</p>
              
              <p>Atentamente,<br>
              <strong>${cotizacion.vendedor.name}</strong><br>
              ${cotizacion.vendedor.email}</p>
            </div>
            
            <div class="footer">
              <p>SGDigital Softwares - Soluciones de Impresión Digital</p>
              <p>Este es un correo automático, por favor no responder directamente.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const resend = getResendClient();
    if (!resend) {
      return NextResponse.json(
        {
          error: 'Email no configurado (falta RESEND_API_KEY).',
        },
        { status: 500 }
      );
    }

    // Enviar email
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'SGDigital <onboarding@resend.dev>',
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: `Cotización ${cotizacion.numero} - SGDigital Softwares`,
      html: htmlEmail,
      attachments: [
        {
          filename: `Cotizacion-${cotizacion.numero}.pdf`,
          content: Buffer.from(pdfBuffer),
        },
      ],
    });

    if (error) {
      console.error('Error enviando email:', error);

      const statusCode =
        typeof (error as unknown as { statusCode?: unknown }).statusCode === 'number'
          ? ((error as unknown as { statusCode: number }).statusCode)
          : 500;
      const message =
        typeof (error as unknown as { message?: unknown }).message === 'string'
          ? ((error as unknown as { message: string }).message)
          : 'Error al enviar el correo electrónico';

      // Resend "testing mode": solo permite enviar al email del owner.
      if (statusCode === 403 && message.includes('only send testing emails')) {
        return NextResponse.json(
          {
            error:
              'Resend está en modo testing: solo permite enviar a tu propio correo. Verifica un dominio en Resend y usa un remitente de ese dominio para enviar a clientes.',
            resend: { statusCode, message },
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: 'Error al enviar el correo electrónico', resend: { statusCode, message } },
        { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 }
      );
    }

    await prisma.cotizacion.update({
      where: { id },
      data: {
        emailSentCount: { increment: 1 },
        lastEmailSentAt: new Date(),
        estado: cotizacion.estado === 'BORRADOR' ? 'ENVIADA' : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Cotización enviada correctamente',
      emailId: data?.id,
    });
  } catch (error) {
    console.error('Error enviando cotización:', error);
    return NextResponse.json(
      { error: 'Error al enviar cotización' },
      { status: 500 }
    );
  }
}
