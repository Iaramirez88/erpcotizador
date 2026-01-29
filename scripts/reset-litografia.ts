/**
 * Reset + Seed: Litografía (por empresa)
 *
 * Borra toda la configuración de litografía (perfiles, papeles, acabados, tamaños, tarifas)
 * y crea 2 registros de muestra por módulo.
 *
 * Ejecutar:
 *   npm run litografia:reset
 */

import { PrismaClient } from ".prisma/client/index"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import dotenv from "dotenv"

dotenv.config()

async function getEmpresa(prisma: PrismaClient) {
  const forcedId = (process.env.LITOGRAFIA_EMPRESA_ID || "").trim()
  if (forcedId) {
    const empresa = await prisma.empresa.findUnique({ where: { id: forcedId }, select: { id: true, nombre: true } })
    if (!empresa) throw new Error(`No existe empresa con id=${forcedId}`)
    return empresa
  }

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
  return empresa
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está definido")

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const empresa = await getEmpresa(prisma)

    const deleted = await prisma.$transaction(async (tx) => {
      const dFlyers = await tx.litografiaFlyerRate.deleteMany({ where: { empresaId: empresa.id } })
      const dProfiles = await tx.litografiaPrintProfile.deleteMany({ where: { empresaId: empresa.id } })
      const dPapers = await tx.litografiaPaperRate.deleteMany({ where: { empresaId: empresa.id } })
      const dFinishes = await tx.litografiaFinishOption.deleteMany({ where: { empresaId: empresa.id } })
      const dSizes = await tx.litografiaPrintSize.deleteMany({ where: { empresaId: empresa.id } })
      return { dFlyers, dProfiles, dPapers, dFinishes, dSizes }
    })

    await prisma.$transaction(async (tx) => {
      const size1 = await tx.litografiaPrintSize.create({
        data: { empresaId: empresa.id, key: "MEDIO_OFICIO", nombre: "Medio oficio", widthCm: 14, heightCm: 21.6, activo: true },
        select: { id: true, key: true, nombre: true },
      })
      const size2 = await tx.litografiaPrintSize.create({
        data: { empresaId: empresa.id, key: "CARTA", nombre: "Carta", widthCm: 21.6, heightCm: 27.9, activo: true },
        select: { id: true, key: true, nombre: true },
      })

      // Normalizamos nombres/códigos a lo que verá el usuario
      // MEDIO_CARTA = 1/2 Carta (equivalente a 1/2 Letter)
      await tx.litografiaPrintSize.update({
        where: { id: size1.id, empresaId: empresa.id },
        data: { key: "MEDIO_CARTA", nombre: "Medio carta" },
        select: { id: true },
      })

      const profile1 = await tx.litografiaPrintProfile.create({
        data: { empresaId: empresa.id, nombre: "Perfil Económico", costoPlanchaPorColor: 15000, costoTintaPorColor: 7000, activo: true },
        select: { id: true, nombre: true },
      })
      const profile2 = await tx.litografiaPrintProfile.create({
        data: { empresaId: empresa.id, nombre: "Perfil Premium", costoPlanchaPorColor: 25000, costoTintaPorColor: 12000, activo: true },
        select: { id: true, nombre: true },
      })

      const paper1 = await tx.litografiaPaperRate.create({
        data: {
          empresaId: empresa.id,
          nombre: "Propalcote 115g",
          tipo: "propalcote",
          gramaje: 115,
          pliegoWidthCm: 70,
          pliegoHeightCm: 100,
          costoPliego: 6500,
          activo: true,
        },
        select: { id: true, nombre: true },
      })
      const paper2 = await tx.litografiaPaperRate.create({
        data: {
          empresaId: empresa.id,
          nombre: "Bond 75g",
          tipo: "bond",
          gramaje: 75,
          pliegoWidthCm: 70,
          pliegoHeightCm: 100,
          costoPliego: 4500,
          activo: true,
        },
        select: { id: true, nombre: true },
      })

      const finish1 = await tx.litografiaFinishOption.create({
        data: { empresaId: empresa.id, key: "TROQUEL", nombre: "Troquel", valor: 15000, activo: true },
        select: { id: true, key: true, nombre: true },
      })
      const finish2 = await tx.litografiaFinishOption.create({
        data: { empresaId: empresa.id, key: "LAM_MATE", nombre: "Laminado mate", valor: 25000, activo: true },
        select: { id: true, key: true, nombre: true },
      })

      // Tarifario: dejar SOLO 2 items de prueba (uno Carta y uno Medio carta)
      // Nota: se crean como genéricas (sin papel/acabado) para evitar confusión.
      const rate1 = await tx.litografiaFlyerRate.create({
        data: {
          empresaId: empresa.id,
          formatoKey: "MEDIO_CARTA",
          tintas: 4,
          tirajeMin: 500,
          tirajeMax: 1000,
          paperRateId: null,
          finishOptionId: null,
          precioTotal: 220000,
          activo: true,
        },
        select: { id: true },
      })

      const rate2 = await tx.litografiaFlyerRate.create({
        data: {
          empresaId: empresa.id,
          formatoKey: "CARTA",
          tintas: 4,
          tirajeMin: 500,
          tirajeMax: 1000,
          paperRateId: null,
          finishOptionId: null,
          precioTotal: 260000,
          activo: true,
        },
        select: { id: true },
      })

      return { size1, size2, profile1, profile2, paper1, paper2, finish1, finish2, rate1, rate2 }
    })

    console.log(`✅ Litografía reseteada para empresa: ${empresa.nombre} (${empresa.id})`)
    console.log(
      `Eliminado: tarifas=${deleted.dFlyers.count}, perfiles=${deleted.dProfiles.count}, papeles=${deleted.dPapers.count}, acabados=${deleted.dFinishes.count}, tamaños=${deleted.dSizes.count}`,
    )
    console.log(`Creado: tamaños=2, perfiles=2, papeles=2, acabados=2, tarifas=2`)
    console.log(`Tamaños: Medio carta (MEDIO_CARTA), Carta (CARTA)`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error("❌ Reset Litografía falló:", e)
  process.exit(1)
})
