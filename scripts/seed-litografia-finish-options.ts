/**
 * Seed: Acabados iniciales para litografía (flyers)
 *
 * Ejecutar:
 *   npm run seed:acabados
 */

import { PrismaClient } from ".prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import dotenv from "dotenv"

dotenv.config()

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definido")
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    let empresa = await prisma.empresa.findFirst({ select: { id: true, nombre: true } })
    if (!empresa) {
      empresa = await prisma.empresa.create({
        data: {
          nombre: "SGDigital",
          nit: "900000000-1",
          direccion: "Dirección por definir",
          telefono: "0000000",
          email: "contacto@sgdigital.com",
        },
        select: { id: true, nombre: true },
      })
    }

    const presets: Array<{ key: string; nombre: string; valor: number; activo?: boolean }> = [
      { key: "TROQUEL", nombre: "Troquel", valor: 15000, activo: true },
    ]

    let created = 0
    let updated = 0

    for (const p of presets) {
      const existing = await prisma.litografiaFinishOption.findFirst({
        where: { empresaId: empresa.id, key: p.key },
        select: { id: true, nombre: true, activo: true },
      })

      if (!existing) {
        await prisma.litografiaFinishOption.create({
          data: {
            empresaId: empresa.id,
            key: p.key,
            nombre: p.nombre,
            valor: p.valor,
            activo: p.activo ?? true,
          },
          select: { id: true },
        })
        created += 1
      } else {
        await prisma.litografiaFinishOption.update({
          where: { id: existing.id },
          data: { nombre: p.nombre, valor: p.valor, activo: p.activo ?? existing.activo },
          select: { id: true },
        })
        updated += 1
      }
    }

    console.log(`Empresa: ${empresa.nombre} (${empresa.id})`)
    console.log(`Acabados: creados=${created}, actualizados=${updated}`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
