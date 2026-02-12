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

import {
  computeLitografiaMinPlusUnitTotal,
  computeLitografiaTarifarioInterpolatedTotal,
  matchLitografiaTarifaByRange,
  buildLitografiaTarifarioPoints,
} from "../src/lib/litografia-tarifario-pricing"

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

function fmt(n: number) {
  return money(Math.round(n))
}

function parseIntEnv(name: string, fallback: number) {
  const raw = (process.env[name] || "").trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
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

    const cantidad = parseIntEnv("LITOGRAFIA_QTY", 750)
    const cantidades = Array.from(new Set([cantidad, 480, 520, 750, 1000, 1500].filter((x) => x > 0))).sort((a, b) => a - b)
    const tintas: 1 | 2 | 4 = 4

    const sizeMedio = sizes.find((s) => s.key === "MEDIO_CARTA") ?? sizes[0]!
    const sizeCarta = sizes.find((s) => s.key === "CARTA") ?? sizes[0]!

    const scenarios = [
      { name: `Medio carta: ${sizeMedio.nombre}`, formatoKey: sizeMedio.key, paperRateId: null, finishOptionId: null },
      { name: `Carta: ${sizeCarta.nombre}`, formatoKey: sizeCarta.key, paperRateId: null, finishOptionId: null },
    ]

    console.log(`Empresa: ${empresa.nombre} (${empresa.id})`)
    console.log(`Tintas=${tintas} | Cantidades=${cantidades.join(", ")}`)

    for (const s of scenarios) {
      console.log(`\n${s.name}`)

      const baseRates = (rates as Rate[])
        .filter((r) => r.formatoKey === s.formatoKey)
        .filter((r) => r.tintas === tintas)
        .filter((r) => (r.paperRateId == null ? true : r.paperRateId === s.paperRateId))
        .filter((r) => (r.finishOptionId == null ? true : r.finishOptionId === s.finishOptionId))

      if (!baseRates.length) {
        console.log(`  ❌ No hay tarifas para el formato/tintas seleccionados.`)
        continue
      }

      const points = buildLitografiaTarifarioPoints(baseRates)
      const defaultMinQty = parseIntEnv("LITOGRAFIA_MIN_QTY", 500)
      const minRes = computeLitografiaTarifarioInterpolatedTotal({ rates: baseRates, cantidad: defaultMinQty })
      const minTotal = minRes.ok ? minRes.precioTotal : 0

      // Derivamos un "adicional por unidad" usando el siguiente punto disponible > minQty.
      const nextPoint = points.find((p) => p.qty > defaultMinQty) || null
      const unitAdditional = nextPoint ? (nextPoint.precioTotal - minTotal) / (nextPoint.qty - defaultMinQty) : 0

      console.log(`  Puntos (tirajeMax): ${points.map((p) => `${p.qty}:${Math.round(p.precioTotal)}`).join(" | ")}`)
      console.log(`  MinQty=${defaultMinQty} => MinTotal=${fmt(minTotal)} | unitAdditional≈${fmt(unitAdditional)} / unidad`)

      for (const qty of cantidades) {
        const matched = pickBestRate({ rates: rates as Rate[], formatoKey: s.formatoKey, tintas, cantidad: qty, paperRateId: s.paperRateId, finishOptionId: s.finishOptionId })
        const byRange = matched ? matched.precioTotal : NaN

        const interp = computeLitografiaTarifarioInterpolatedTotal({ rates: baseRates, cantidad: qty })
        const byInterp = interp.ok ? interp.precioTotal : NaN

        const byMinPlus = computeLitografiaMinPlusUnitTotal({
          cantidad: qty,
          minQty: defaultMinQty,
          minTotal,
          unitAdditional,
        })

        const t0 = 0
        const tNorte = 20000

        console.log(`\n  Tiraje=${qty}`)
        if (matched) {
          console.log(`    Rango (actual):     ${fmt(byRange)}  [${matched.tirajeMin}-${matched.tirajeMax} rateId=${matched.id}]`)
        } else {
          console.log(`    Rango (actual):     ❌ sin match`)
        }

        if (interp.ok) {
          const b = interp.upper.qty === interp.lower.qty ? `${interp.upper.qty}` : `${interp.lower.qty}→${interp.upper.qty}`
          console.log(`    Interpolación:      ${fmt(byInterp)}  (${interp.mode} ${b})`)
        } else {
          console.log(`    Interpolación:      ❌ ${interp.error}`)
        }

        console.log(`    Mín + adicional:    ${fmt(byMinPlus)}`)
        console.log(`    + Transporte 20k:   rango=${fmt((Number.isFinite(byRange) ? byRange : 0) + tNorte)} | interp=${fmt((Number.isFinite(byInterp) ? byInterp : 0) + tNorte)} | min+u=${fmt(byMinPlus + tNorte)}`)
        console.log(`    Δ transporte (ref): ${money(tNorte - t0)}`)
      }
    }

    console.log("\n✅ Prueba finalizada. Compara Rango vs Interpolación vs Mín+Adicional.")
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((e) => {
  console.error("❌ Test Litografía falló:", e)
  process.exit(1)
})
