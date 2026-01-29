/**
 * Seed: Tarifas iniciales para flyers (litografía)
 *
 * Crea/actualiza tarifas por rangos para todos los formatos de la categoría "Volantes y Flyers".
 *
 * Ejecutar:
 *   npm run seed:flyers
 */

import { PrismaClient } from '.prisma/client/default'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import dotenv from 'dotenv'

import { PRODUCT_PRESETS } from '../src/lib/product-presets'
import { computeLitografia } from '../src/lib/litografia'

dotenv.config()

function n(value: unknown, fallback = 0) {
  const v = Number(value)
  return Number.isFinite(v) ? v : fallback
}

function roundMoney(value: number) {
  // Redondeo suave a centenas (COP)
  return Math.round(value / 100) * 100
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está definido')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  const flyers = PRODUCT_PRESETS.filter((p) => p.categoria === 'Volantes y Flyers')
  if (!flyers.length) {
    console.log('No se encontraron presets de "Volantes y Flyers". Nada que seedear.')
    await prisma.$disconnect()
    return
  }

  // Empresa: usa la primera existente o crea una por defecto
  let empresa = await prisma.empresa.findFirst({ select: { id: true, nombre: true } })
  if (!empresa) {
    empresa = await prisma.empresa.create({
      data: {
        nombre: 'SGDigital',
        nit: '900000000-1',
        direccion: 'Dirección por definir',
        telefono: '0000000',
        email: 'contacto@sgdigital.com',
      },
      select: { id: true, nombre: true },
    })
  }

  // Rangos típicos (incluye un rango bajo por si alguien escribe <500)
  const rangos: Array<[number, number]> = [
    [1, 499],
    [500, 1000],
    [1001, 2000],
    [2001, 5000],
    [5001, 10000],
  ]

  // Tintas permitidas
  const tintasList: Array<1 | 2 | 4> = [1, 2, 4]

  // Modelo “aproximado” para precargar (admin puede ajustar luego desde UI)
  // Papel: costo por unidad proporcional al área
  const paperCostPerCm2 = 1.25 // COP/cm² (ajustable)

  // Costos fijos base por trabajo (no por unidad)
  const costoPlanchaPorColor = 20000
  const costoTintaPorColor = 8000
  const costoCorte = 50000
  const costoAcabados = 0
  const costoTransporte = 20000

  let created = 0
  let updated = 0

  for (const preset of flyers) {
    const area = n(preset.widthCm) * n(preset.heightCm)
    const costoPapelUnidad = Math.max(0, area * paperCostPerCm2)

    for (const tintas of tintasList) {
      for (const [tirajeMin, tirajeMax] of rangos) {
        // Para que el rango “se vea” estable, cotizamos usando el máximo del rango.
        const cantidad = tirajeMax
        const calc = computeLitografia({
          cantidad,
          colores: tintas,
          desperdicioPct: 3,
          costoPlanchaPorColor,
          costoTintaPorColor,
          costoPapelUnidad,
          papelModo: 'unidad',
          costoCorte,
          costoAcabados,
          costoTransporte,
          margenPct: 0,
        })

        const precioTotal = roundMoney(calc.precioVenta)

        const existing = await prisma.litografiaFlyerRate.findFirst({
          where: {
            empresaId: empresa.id,
            formatoKey: preset.key,
            tintas,
            tirajeMin,
            tirajeMax,
            paperRateId: null,
            finishOptionId: null,
          },
          select: { id: true, precioTotal: true, activo: true },
        })

        if (!existing) {
          await prisma.litografiaFlyerRate.create({
            data: {
              empresaId: empresa.id,
              formatoKey: preset.key,
              tintas,
              tirajeMin,
              tirajeMax,
              precioTotal,
              activo: true,
            },
            select: { id: true },
          })
          created += 1
        } else {
          await prisma.litografiaFlyerRate.update({
            where: { id: existing.id },
            data: { precioTotal, activo: true },
            select: { id: true },
          })
          updated += 1
        }
      }
    }
  }

  console.log(`Empresa: ${empresa.nombre} (${empresa.id})`)
  console.log(`Formatos flyers: ${flyers.length}`)
  console.log(`Tarifas creadas: ${created}`)
  console.log(`Tarifas actualizadas: ${updated}`)

  await prisma.$disconnect()
  await pool.end()
}

main().catch((e) => {
  console.error('❌ Seed flyers falló:', e)
  process.exit(1)
})
