/**
 * Smoke test: cotizaciones (campos + PDF público)
 * Ejecutar con: npx tsx scripts/smoke-cotizaciones.ts
 */

import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { pdf } from '@react-pdf/renderer'
import { prisma } from '../src/lib/prisma'
import { getActiveSedeForUser } from '../src/lib/rbac'
import CotizacionPDF from '../src/lib/pdf-template'
import { createCotizacionShareToken, verifyCotizacionShareToken } from '../src/lib/share-token'

async function main() {
  const adminEmail = 'admin@sgdigital.com'

  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, email: true },
  })

  if (!admin) {
    throw new Error(`No existe el usuario admin (${adminEmail}). Ejecuta: npx tsx scripts/create-admin.ts`)
  }

  const sede = await getActiveSedeForUser(admin.id)

  // Asegura configuración razonable para el test
  await prisma.sede.update({
    where: { id: sede.id },
    data: {
      codigo: sede.codigo ?? 'PRIN',
      cotizacionesPricesIncludeIva: true,
      cotizacionesIvaPct: 19,
    },
  })

  const clienteDocumento = 'SMOKE-0001'
  const cliente = await prisma.cliente.upsert({
    where: { documento: clienteDocumento },
    update: {
      nombre: 'Cliente Smoke Test',
      email: 'smoke.cliente@sgdigital.local',
      telefono: '3000000000',
      direccion: 'Dirección QA',
      ciudad: 'Bogotá',
      departamento: 'Cundinamarca',
    },
    create: {
      nombre: 'Cliente Smoke Test',
      tipoDocumento: 'NIT',
      documento: clienteDocumento,
      email: 'smoke.cliente@sgdigital.local',
      telefono: '3000000000',
      direccion: 'Dirección QA',
      ciudad: 'Bogotá',
      departamento: 'Cundinamarca',
      empresaId: sede.empresaId,
    },
    select: { id: true, nombre: true, email: true },
  })

  // Números consistentes con IVA incluido (19%): total=119000 => base=100000, iva=19000
  const subtotal = 100000
  const iva = 19000
  const total = 119000

  const cotizacion = await prisma.$transaction(async (tx) => {
    const seq = await tx.cotizacionSequence.upsert({
      where: { sedeId: sede.id },
      update: { currentNumber: { increment: 1 } },
      create: { sedeId: sede.id, currentNumber: 1 },
      select: { currentNumber: true },
    })

    const numero = `COT-${(sede.codigo ?? 'PRIN').trim() || '00'}-${String(seq.currentNumber).padStart(4, '0')}`

    return tx.cotizacion.create({
      data: {
        numero,
        sedeId: sede.id,
        clienteId: cliente.id,
        vendedorId: admin.id,
        subtotal,
        descuento: 0,
        iva,
        total,
        validezDias: 15,
        estado: 'BORRADOR',
        observaciones: 'Smoke test: observaciones.\n\nTiempo de entrega: 2 días.',
        garantia: '30 días por defectos de impresión',
        paymentMethods: ['Efectivo', 'Transferencia', 'Tarjeta'],
        boldCheckoutUrl: 'https://checkout.bold.co/pay/SMOKE',
        items: {
          create: [
            {
              descripcion: 'Impresión vinilo (smoke)',
              cantidad: 1,
              unidad: 'unidad',
              ancho: 1,
              alto: 1,
              area: 1,
              laminado: false,
              troquelado: false,
              instalacion: false,
              costoMaterial: 0,
              costoImpresion: 0,
              costoAcabados: 0,
              costoInstalacion: 0,
              precioUnitario: total,
              subtotal: total,
            },
          ],
        },
      },
      select: { id: true, numero: true },
    })
  })

  const cotizacionFull = await prisma.cotizacion.findUnique({
    where: { id: cotizacion.id },
    include: {
      cliente: true,
      vendedor: { select: { id: true, name: true, email: true } },
      items: { include: { material: true } },
    },
  })

  if (!cotizacionFull) {
    throw new Error('No se pudo cargar la cotización creada.')
  }

  const secret = process.env.SHARE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('Falta SHARE_TOKEN_SECRET o NEXTAUTH_SECRET en el entorno (.env) para generar/verificar tokens.')
  }

  const token = createCotizacionShareToken({ cotizacionId: cotizacion.id, ttlSeconds: 600, secret })

  const verified = verifyCotizacionShareToken(token, secret)
  if (!verified || verified.cotizacionId !== cotizacion.id) {
    throw new Error('Token generado no es verificable (o expira inmediatamente).')
  }

  const pdfDoc = CotizacionPDF({
    cotizacion: {
      numero: cotizacionFull.numero,
      createdAt: cotizacionFull.createdAt,
      validezDias: cotizacionFull.validezDias,
      estado: cotizacionFull.estado,
      observaciones: cotizacionFull.observaciones,
      garantia: cotizacionFull.garantia ?? null,
      paymentMethods: cotizacionFull.paymentMethods ?? [],
      boldCheckoutUrl: cotizacionFull.boldCheckoutUrl ?? null,
      cliente: {
        nombre: cotizacionFull.cliente.nombre,
        email: cotizacionFull.cliente.email,
        telefono: cotizacionFull.cliente.telefono,
      },
      vendedor: {
        name: cotizacionFull.vendedor.name,
        email: cotizacionFull.vendedor.email,
      },
      items: cotizacionFull.items.map((item) => ({
        cantidad: item.cantidad,
        ancho: item.ancho,
        alto: item.alto,
        metrosCuadrados: (item.ancho || 0) * (item.alto || 0) * item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.subtotal,
        laminado: item.laminado,
        troquelado: item.troquelado,
        instalacion: item.instalacion,
        costoInstalacion: item.costoInstalacion,
        material: item.material
          ? {
              nombre: item.material.nombre,
              tipo: item.material.tipo,
            }
          : null,
      })),
      subtotal: cotizacionFull.subtotal,
      iva: cotizacionFull.iva,
      total: cotizacionFull.total,
    },
    template: null,
  })

  const buffer = await pdf(pdfDoc).toBuffer()
  const outPath = path.join(process.cwd(), 'tmp-smoke-cotizacion.pdf')
  await fs.writeFile(outPath, buffer)

  console.log('✅ Smoke OK')
  console.log('Cotización:', cotizacion.numero, cotizacion.id)
  console.log('PDF:', outPath)
  console.log('Token (válido 10 min):', token)
}

main()
  .catch((err) => {
    console.error('❌ Smoke FAIL')
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
