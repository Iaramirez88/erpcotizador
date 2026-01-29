/**
 * Prueba rápida de concurrencia para numeración de cotizaciones por sede.
 * Ejecutar con: npx tsx scripts/test-cotizacion-sequence-concurrency.ts
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { getActiveSedeForUser } from '../src/lib/rbac'

async function main() {
  const adminEmail = 'admin@sgdigital.com'
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  })

  if (!admin) {
    throw new Error(`No existe el usuario admin (${adminEmail}). Ejecuta: npx tsx scripts/create-admin.ts`)
  }

  const sede = await getActiveSedeForUser(admin.id)

  const clienteDocumento = 'SMOKE-SEQ-CONC'
  const cliente = await prisma.cliente.upsert({
    where: { documento: clienteDocumento },
    update: {},
    create: {
      nombre: 'Cliente Seq Concurrency',
      tipoDocumento: 'NIT',
      documento: clienteDocumento,
      email: 'seq.conc@sgdigital.local',
      telefono: '3000000000',
      direccion: 'Dirección QA',
      ciudad: 'Bogotá',
      departamento: 'Cundinamarca',
      empresaId: sede.empresaId,
    },
    select: { id: true },
  })

  const count = Number(process.env.SEQ_TEST_COUNT ?? 10)

  const createOne = async () => {
    return prisma.$transaction(async (tx) => {
      const seq = await tx.cotizacionSequence.upsert({
        where: { sedeId: sede.id },
        update: { currentNumber: { increment: 1 } },
        create: { sedeId: sede.id, currentNumber: 1 },
        select: { currentNumber: true },
      })

      const numero = `COT-${(sede.codigo ?? 'PRIN').trim() || '00'}-${String(seq.currentNumber).padStart(4, '0')}`

      const cotizacion = await tx.cotizacion.create({
        data: {
          numero,
          sedeId: sede.id,
          clienteId: cliente.id,
          vendedorId: admin.id,
          subtotal: 1000,
          descuento: 0,
          iva: 0,
          total: 1000,
          validezDias: 15,
          estado: 'BORRADOR',
          observaciones: 'SEQ CONCURRENCY TEST',
          items: {
            create: [
              {
                descripcion: 'Item test',
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
                precioUnitario: 1000,
                subtotal: 1000,
              },
            ],
          },
        },
        select: { id: true, numero: true },
      })

      return cotizacion
    })
  }

  // Ejecuta en paralelo para forzar concurrencia
  const results = await Promise.all(Array.from({ length: count }, () => createOne()))
  const numeros = results.map((r) => r.numero)

  const unique = new Set(numeros)
  if (unique.size !== numeros.length) {
    throw new Error(`Colisión detectada: ${numeros.length - unique.size} duplicados`) 
  }

  console.log('✅ Concurrencia OK')
  console.log(`Creadas: ${numeros.length}`)
  console.log('Números:')
  for (const n of numeros.sort()) console.log(' -', n)
}

main()
  .catch((err) => {
    console.error('❌ Concurrencia FAIL')
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
