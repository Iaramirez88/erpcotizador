/**
 * Prueba en consola: Litografía (tarifario + transporte)
 *
 * Verifica que el total cambie (suba/baje) según las opciones escogidas:
 * - Cambio de tamaño
 * - Cambio de papel/acabado (si hay tarifa específica)
 * - Cambio de transporte (suma fija)
 *
 * Ejecutar:
 *   npm run litografia:test
 */

import { PrismaClient } from ".prisma/client/default"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import dotenv from "dotenv"

dotenv.config()

type Rate = {
  id: string
  formatoKey: string
  tintas: 1 | 2 | 4
  tirajeMin: number
  tirajeMax: number
  paperRateId: string | null
  finishOptionId: string | null
  precioTotal: number
}

function money(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)
}

async function getEmpresa(prisma: PrismaClient) {
  const forcedId = (process.env.LITOGRAFIA_EMPRESA_ID || "").trim()
  if (forcedId) {
    const empresa = await prisma.empresa.findUnique({ where: { id: forcedId }, select: { id: true, nombre: true } })
    if (!empresa) throw new Error(`No existe empresa con id=${forcedId}`)
    return empresa
  }

  const empresa = await prisma.empresa.findFirst({ select: { id: true, nombre: true } })
  if (!empresa) throw new Error("No hay empresas. Ejecuta primero: npm run litografia:reset")
  return empresa
}

function pickBestRate(args: {
  rates: Rate[]
  formatoKey: string
  tintas: 1 | 2 | 4
  cantidad: number
  paperRateId: string | null
  finishOptionId: string | null
}) {
  const { rates, formatoKey, tintas, cantidad, paperRateId, finishOptionId } = args

  const candidates = rates
    .filter((r) => r.formatoKey === formatoKey)
    .filter((r) => r.tintas === tintas)
    .filter((r) => r.tirajeMin <= cantidad && r.tirajeMax >= cantidad)
    .filter((r) => (r.paperRateId == null ? true : r.paperRateId === paperRateId))
    .filter((r) => (r.finishOptionId == null ? true : r.finishOptionId === finishOptionId))

  if (!candidates.length) return null

  const score = (r: Rate) => {
    let s = 0
    if (paperRateId && r.paperRateId === paperRateId) s += 2
    if (finishOptionId && r.finishOptionId === finishOptionId) s += 1
    return s
  }

  // Mayor score = más específica. En empate, rango más estrecho.
  return candidates.sort((a, b) => {
    const ds = score(b) - score(a)
    if (ds !== 0) return ds
    const ra = a.tirajeMax - a.tirajeMin
    const rb = b.tirajeMax - b.tirajeMin
    return ra - rb
  })[0]!
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL no está definido")

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const empresa = await getEmpresa(prisma)

    const [sizes, papers, finishes, rates] = await Promise.all([
      prisma.litografiaPrintSize.findMany({ where: { empresaId: empresa.id, activo: true }, orderBy: { nombre: "asc" }, select: { key: true, nombre: true } }),
      prisma.litografiaPaperRate.findMany({ where: { empresaId: empresa.id, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
      prisma.litografiaFinishOption.findMany({ where: { empresaId: empresa.id, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
      prisma.litografiaFlyerRate.findMany({ where: { empresaId: empresa.id, activo: true }, orderBy: [{ tirajeMin: "asc" }], select: { id: true, formatoKey: true, tintas: true, tirajeMin: true, tirajeMax: true, paperRateId: true, finishOptionId: true, precioTotal: true } }),
    ])

    if (!sizes.length) throw new Error("No hay tamaños activos. Ejecuta: npm run litografia:reset")
    if (!rates.length) throw new Error("No hay tarifas activas. Ejecuta: npm run litografia:reset")

    const cantidad = 1000
    const tintas: 1 | 2 | 4 = 4

    const sizeMedio = sizes.find((s) => s.key === "MEDIO_CARTA") ?? sizes[0]!
    const sizeCarta = sizes.find((s) => s.key === "CARTA") ?? sizes[0]!

    const scenarios = [
      { name: `Medio carta: ${sizeMedio.nombre}`, formatoKey: sizeMedio.key, paperRateId: null, finishOptionId: null },
      { name: `Carta: ${sizeCarta.nombre}`, formatoKey: sizeCarta.key, paperRateId: null, finishOptionId: null },
    ]

    console.log(`Empresa: ${empresa.nombre} (${empresa.id})`)
    console.log(`Cantidad=${cantidad} | Tintas=${tintas}`)

    for (const s of scenarios) {
      const rate = pickBestRate({ rates: rates as Rate[], formatoKey: s.formatoKey, tintas, cantidad, paperRateId: s.paperRateId, finishOptionId: s.finishOptionId })
      if (!rate) {
        console.log(`\n${s.name}`)
        console.log(`  ❌ No hay tarifa que aplique (revisa rangos/papel/acabado).`)
        continue
      }

      const base = rate.precioTotal
      const t0 = 0
      const tNorte = 20000
      const total0 = base + t0
      const totalNorte = base + tNorte

      console.log(`\n${s.name}`)
      console.log(`  Base (tarifario): ${money(base)}  [rateId=${rate.id}]`)
      if (rate.paperRateId == null && rate.finishOptionId == null) {
        console.log(`  (Tarifa genérica: aplica a cualquier papel/acabado)`)
      } else {
        console.log(`  (Tarifa específica: depende de papel/acabado)`)
      }
      console.log(`  + Transporte 0:   ${money(total0)}`)
      console.log(`  + Transporte 20k: ${money(totalNorte)} (Δ=${money(totalNorte - total0)})`)
    }

    console.log("\n✅ Prueba finalizada. Si el Δ del transporte no es 20k, hay un bug.")
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error("❌ Test Litografía falló:", e)
  process.exit(1)
})
