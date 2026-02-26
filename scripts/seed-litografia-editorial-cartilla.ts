/**
 * Seed: Dropdown editorial (Litografía) - ejemplo Cartilla
 *
 * Inserta/actualiza el dropdown `litografia_editorial_producto` y crea la opción `cartilla`.
 *
 * Ejecutar:
 *   npx tsx scripts/seed-litografia-editorial-cartilla.ts
 */

import { PrismaClient } from ".prisma/client/default"
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
    // Empresa: usa la primera existente o crea una por defecto
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

    const dropdownKey = "litografia_editorial_producto"

    const dropdown = await prisma.configDropdown.upsert({
      where: { empresaId_key: { empresaId: empresa.id, key: dropdownKey } },
      create: {
        empresaId: empresa.id,
        key: dropdownKey,
        nombre: "Litografía: Editorial (libros/cartillas/revistas)",
        descripcion: null,
      },
      update: {
        nombre: "Litografía: Editorial (libros/cartillas/revistas)",
      },
      select: { id: true, key: true, nombre: true },
    })

    const item = await prisma.configDropdownItem.upsert({
      where: { dropdownId_value: { dropdownId: dropdown.id, value: "cartilla" } },
      create: {
        dropdownId: dropdown.id,
        value: "cartilla",
        label: "Cartilla",
        sortOrder: 20,
        activo: true,
        meta: {
          kind: "CARTILLA",
          totalPaginas: 16,
          paginasPortadaContraportada: 0,
          cartasPorPlancha: 2,
          paginasPorPliego: 4,
        },
      },
      update: {
        label: "Cartilla",
        activo: true,
        meta: {
          kind: "CARTILLA",
          totalPaginas: 16,
          paginasPortadaContraportada: 0,
          cartasPorPlancha: 2,
          paginasPorPliego: 4,
        },
      },
      select: { id: true, value: true, label: true, activo: true },
    })

    console.log(`Empresa: ${empresa.nombre} (${empresa.id})`)
    console.log(`Dropdown: ${dropdown.nombre} (${dropdown.key}) [${dropdown.id}]`)
    console.log(`Item: ${item.label} (${item.value}) activo=${item.activo} [${item.id}]`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
