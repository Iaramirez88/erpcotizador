/**
 * 🚀 Análisis de Rendimiento de Arranque
 * 
 * Ejecutar: npx tsx scripts/startup-performance.ts
 * 
 * Mide el tiempo de:
 * - Inicialización de Prisma
 * - Primera conexión a DB
 * - Carga de módulos
 * - Primera query
 */

import 'dotenv/config'
import { performance } from 'perf_hooks'

const startTime = performance.now()

console.log('🚀 Analizando rendimiento de arranque...\n')

// 1. Medir importación de módulos
const moduleStart = performance.now()

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const moduleEnd = performance.now()
console.log(`✅ Importación de módulos: ${(moduleEnd - moduleStart).toFixed(2)}ms`)

// 2. Medir creación del pool
const poolStart = performance.now()

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
})

const poolEnd = performance.now()
console.log(`✅ Creación de Pool: ${(poolEnd - poolStart).toFixed(2)}ms`)

// 3. Medir creación del adapter
const adapterStart = performance.now()

const adapter = new PrismaPg(pool)

const adapterEnd = performance.now()
console.log(`✅ Creación de Adapter: ${(adapterEnd - adapterStart).toFixed(2)}ms`)

// 4. Medir creación de PrismaClient
const prismaStart = performance.now()

const prisma = new PrismaClient({ 
  adapter,
  log: ['error']
})

const prismaEnd = performance.now()
console.log(`✅ Creación de PrismaClient: ${(prismaEnd - prismaStart).toFixed(2)}ms`)

async function main() {
  // 5. Medir primera conexión
  const connectStart = performance.now()
  
  await prisma.$connect()
  
  const connectEnd = performance.now()
  console.log(`✅ Primera conexión: ${(connectEnd - connectStart).toFixed(2)}ms`)

  // 6. Medir primera query simple
  const simpleQueryStart = performance.now()
  
  await prisma.$queryRaw`SELECT 1`
  
  const simpleQueryEnd = performance.now()
  console.log(`✅ Query simple (SELECT 1): ${(simpleQueryEnd - simpleQueryStart).toFixed(2)}ms`)

  // 7. Medir query con Prisma
  const prismaQueryStart = performance.now()
  
  await prisma.user.findFirst({ select: { id: true } })
  
  const prismaQueryEnd = performance.now()
  console.log(`✅ Primera query Prisma: ${(prismaQueryEnd - prismaQueryStart).toFixed(2)}ms`)

  // 8. Medir query compleja
  const complexQueryStart = performance.now()
  
  await prisma.user.findFirst({
    include: {
      sedeMemberships: {
        include: {
          sede: true
        }
      }
    }
  })
  
  const complexQueryEnd = performance.now()
  console.log(`✅ Query compleja con includes: ${(complexQueryEnd - complexQueryStart).toFixed(2)}ms`)

  // 9. Medir múltiples queries en paralelo
  const parallelStart = performance.now()
  
  await Promise.all([
    prisma.user.count(),
    prisma.empresa.count(),
    prisma.sede.count()
  ])
  
  const parallelEnd = performance.now()
  console.log(`✅ 3 queries en paralelo: ${(parallelEnd - parallelStart).toFixed(2)}ms`)

  const totalTime = performance.now() - startTime

  console.log('\n' + '='.repeat(80))
  console.log('📊 RESUMEN DE ARRANQUE')
  console.log('='.repeat(80))
  console.log(`\n⏱️  Tiempo total: ${totalTime.toFixed(2)}ms`)

  // Análisis
  const importPercent = ((moduleEnd - moduleStart) / totalTime * 100).toFixed(1)
  const connectPercent = ((connectEnd - connectStart) / totalTime * 100).toFixed(1)

  console.log(`\n📈 Desglose:`)
  console.log(`   Importaciones: ${(moduleEnd - moduleStart).toFixed(2)}ms (${importPercent}%)`)
  console.log(`   Pool + Adapter: ${(adapterEnd - poolStart).toFixed(2)}ms`)
  console.log(`   PrismaClient: ${(prismaEnd - prismaStart).toFixed(2)}ms`)
  console.log(`   Primera conexión: ${(connectEnd - connectStart).toFixed(2)}ms (${connectPercent}%)`)
  console.log(`   Primera query: ${(prismaQueryEnd - prismaQueryStart).toFixed(2)}ms`)

  console.log('\n💡 RECOMENDACIONES:')
  
  if (connectEnd - connectStart > 200) {
    console.log('   ⚠️  La primera conexión es lenta (>200ms)')
    console.log('      - Verifica la latencia de red con tu base de datos')
    console.log('      - Considera usar connection pooling')
    console.log('      - Si es una DB remota, evalúa la ubicación geográfica')
  }

  if (moduleEnd - moduleStart > 100) {
    console.log('   ⚠️  Las importaciones son lentas (>100ms)')
    console.log('      - Considera usar dynamic imports para módulos pesados')
    console.log('      - Revisa el tamaño de tus dependencias')
  }

  if (totalTime > 1000) {
    console.log('   ⚠️  El arranque total es muy lento (>1s)')
    console.log('      - Implementa lazy loading de módulos')
    console.log('      - Usa connection pooling reutilizable')
    console.log('      - Considera serverless/edge runtime si es apropiado')
  } else if (totalTime < 500) {
    console.log('   ✅ El arranque es rápido (<500ms) - ¡Buen trabajo!')
  }

  console.log('\n📚 Recursos:')
  console.log('   - Connection Pooling: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management')
  console.log('   - Edge Functions: https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes')

  console.log('\n')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
