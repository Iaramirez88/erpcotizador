import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { ROP_DEFAULT_CATALOG, seedRopCatalog } from '../src/lib/rop-catalog'

dotenv.config()

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está definido')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const summary = await seedRopCatalog(prisma)
    const subcategoryTotal = ROP_DEFAULT_CATALOG.reduce((total, category) => total + category.subcategories.length, 0)

    console.log(`Categorias ROP procesadas: ${summary.categories}`)
    console.log(`Subcategorias ROP procesadas: ${summary.subcategories} (${subcategoryTotal} esperadas)`)
    console.log(`Servicios ROP procesados: ${summary.services}`)
    console.log('Seed ROP catálogo completado.')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Seed ROP catálogo falló:', error)
  process.exit(1)
})

