import { PrismaClient } from '.prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { ensureOdontologySeedsForEmpresa } from '../src/lib/business-type-seeds'

dotenv.config()

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está definido')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    let empresa = await prisma.empresa.findFirst({ select: { id: true, nombre: true } })
    if (!empresa) {
      empresa = await prisma.empresa.create({
        data: {
          nombre: 'SGDigital Odontología',
          nit: '900000000-OD',
          direccion: 'Dirección por definir',
          telefono: '0000000',
          email: 'odontologia@sgdigital.com',
        },
        select: { id: true, nombre: true },
      })
    }

    await ensureOdontologySeedsForEmpresa(empresa.id)

    console.log(`Empresa: ${empresa.nombre} (${empresa.id})`)
    console.log('Seeds odontológicos aplicados correctamente')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})