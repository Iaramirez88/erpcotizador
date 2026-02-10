/**
 * Backfill: crea filas faltantes en inventory_stocks para materiales existentes,
 * en la bodega por defecto de una sede.
 *
 * IMPORTANTE:
 * - Solo asigna cantidad inicial = material.stockActual cuando el material NO
 *   tiene NINGUNA fila en inventory_stocks (para evitar doble-conteo).
 * - Si el material ya tiene stocks en otras bodegas, solo crea la fila faltante
 *   en la bodega por defecto con quantity = 0.
 *
 * Ejecutar:
 *   npx tsx scripts/backfill-inventory-stock-default-warehouse.ts --dry-run
 *   npx tsx scripts/backfill-inventory-stock-default-warehouse.ts
 *
 * Opcionales:
 *   --empresa <empresaId>
 *   --sede <sedeId>
 */

import dotenv from 'dotenv'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '.prisma/client/default'

dotenv.config()

type Args = {
  dryRun: boolean
  empresaId?: string
  sedeId?: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--dry-run') {
      args.dryRun = true
      continue
    }

    if (token === '--empresa') {
      args.empresaId = argv[i + 1]
      i++
      continue
    }

    if (token === '--sede') {
      args.sedeId = argv[i + 1]
      i++
      continue
    }
  }

  if (!args.empresaId && process.env.EMPRESA_ID) args.empresaId = process.env.EMPRESA_ID
  if (!args.sedeId && process.env.SEDE_ID) args.sedeId = process.env.SEDE_ID

  return args
}

function asNonNegativeNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en el entorno (.env)')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const empresas = await prisma.empresa.findMany({ select: { id: true, nombre: true } })

    let empresaId = args.empresaId
    if (!empresaId) {
      if (empresas.length === 1) empresaId = empresas[0]?.id
      else {
        const ids = empresas.map((e) => `${e.id}${e.nombre ? ` (${e.nombre})` : ''}`).join('\n- ')
        throw new Error(
          `Hay múltiples empresas. Especifica --empresa <id> o EMPRESA_ID. Disponibles:\n- ${ids}`,
        )
      }
    }

    const sedes = await prisma.sede.findMany({
      where: { empresaId },
      select: { id: true, nombre: true },
    })

    let sedeId = args.sedeId
    if (!sedeId) {
      if (sedes.length === 1) sedeId = sedes[0]?.id
      else {
        const ids = sedes.map((s) => `${s.id}${s.nombre ? ` (${s.nombre})` : ''}`).join('\n- ')
        throw new Error(
          `Hay múltiples sedes para la empresa. Especifica --sede <id> o SEDE_ID. Disponibles:\n- ${ids}`,
        )
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Backfill inventory_stocks (default warehouse)')
    console.log('Empresa:', empresaId)
    console.log('Sede:', sedeId)
    console.log('Modo:', args.dryRun ? 'DRY-RUN' : 'APLICAR')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // 1) Resolver bodega por defecto para la sede (preferimos sedeId; fallback a sedeId null)
    const warehouseDefault = await prisma.inventoryWarehouse.findFirst({
      where: {
        empresaId,
        OR: [{ sedeId }, { sedeId: null }],
        isDefault: true,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, nombre: true, sedeId: true, isDefault: true },
    })

    let warehouseId: string
    let warehouseNombre: string

    if (warehouseDefault) {
      warehouseId = warehouseDefault.id
      warehouseNombre = warehouseDefault.nombre
    } else {
      const anyWarehouse = await prisma.inventoryWarehouse.findFirst({
        where: {
          empresaId,
          OR: [{ sedeId }, { sedeId: null }],
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, nombre: true, isDefault: true },
      })

      if (anyWarehouse) {
        warehouseId = anyWarehouse.id
        warehouseNombre = anyWarehouse.nombre

        if (!anyWarehouse.isDefault) {
          if (!args.dryRun) {
            await prisma.inventoryWarehouse.update({
              where: { id: warehouseId },
              data: { isDefault: true },
            })
          }
          console.log(
            `⚠️  No había bodega default. ${args.dryRun ? 'Simulando' : 'Marcando'} como default: ${warehouseNombre}`,
          )
        }
      } else {
        // Crear bodega "Principal" asociada a la sede.
        warehouseNombre = 'Principal'
        if (args.dryRun) {
          warehouseId = 'DRY_RUN_WAREHOUSE_ID'
          console.log('⚠️  No había bodegas. Simulando creación de bodega Principal (PRIN)')
        } else {
          const created = await prisma.inventoryWarehouse.create({
            data: {
              empresaId,
              sedeId,
              nombre: warehouseNombre,
              codigo: 'PRIN',
              isDefault: true,
            },
            select: { id: true, nombre: true },
          })
          warehouseId = created.id
          warehouseNombre = created.nombre
          console.log('✅ Bodega creada como default:', warehouseNombre)
        }
      }
    }

    console.log('Bodega default usada:', warehouseNombre)

    // 2) Encontrar materiales y su estado de stocks
    //    a) Sin NINGÚN stock: creamos en default con quantity = stockActual
    //    b) Con stocks pero sin stock en default: creamos en default con quantity = 0

    const materialsNoStocks = await prisma.material.findMany({
      where: {
        empresaId,
        stocks: { none: {} },
      },
      select: { id: true, nombre: true, stockActual: true },
    })

    const materialsMissingDefault = await prisma.material.findMany({
      where: {
        empresaId,
        stocks: {
          some: {},
          none: { warehouseId },
        },
      },
      select: { id: true, nombre: true },
    })

    console.log('Materiales sin stocks (asignar stockActual):', materialsNoStocks.length)
    console.log('Materiales con stocks pero sin fila en default (asignar 0):', materialsMissingDefault.length)

    if (args.dryRun) {
      console.log('DRY-RUN: no se aplicaron cambios.')
      return
    }

    // Insertar en batches para evitar queries gigantes.
    const BATCH = 500

    let createdWithStock = 0
    for (let i = 0; i < materialsNoStocks.length; i += BATCH) {
      const batch = materialsNoStocks.slice(i, i + BATCH)
      const data = batch.map((m) => ({
        warehouseId,
        materialId: m.id,
        quantity: asNonNegativeNumber(m.stockActual),
      }))

      const res = await prisma.inventoryStock.createMany({ data, skipDuplicates: true })
      createdWithStock += res.count
    }

    let createdWithZero = 0
    for (let i = 0; i < materialsMissingDefault.length; i += BATCH) {
      const batch = materialsMissingDefault.slice(i, i + BATCH)
      const data = batch.map((m) => ({
        warehouseId,
        materialId: m.id,
        quantity: 0,
      }))

      const res = await prisma.inventoryStock.createMany({ data, skipDuplicates: true })
      createdWithZero += res.count
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ Backfill terminado')
    console.log('Filas creadas (quantity = stockActual):', createdWithStock)
    console.log('Filas creadas (quantity = 0):', createdWithZero)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
