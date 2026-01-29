/**
 * 🔍 Analizador de Queries Lentas
 * 
 * Ejecutar: npx tsx scripts/analyze-slow-queries.ts
 * 
 * Este script:
 * - Intercepta todas las queries de Prisma
 * - Mide su tiempo de ejecución
 * - Identifica queries lentas (> 50ms)
 * - Genera un reporte con recomendaciones
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { performance } from 'perf_hooks'

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
})

const adapter = new PrismaPg(pool)

interface QueryLog {
  query: string
  duration: number
  timestamp: Date
  params?: string
}

const queryLogs: QueryLog[] = []
const slowQueryThreshold = 50 // ms

const prisma = new PrismaClient({ 
  adapter,
  log: [
    { level: 'query', emit: 'event' }
  ]
})

// Interceptar queries
prisma.$on('query', (e) => {
  const duration = e.duration
  
  queryLogs.push({
    query: e.query,
    duration,
    timestamp: new Date(),
    params: e.params
  })

  if (duration > slowQueryThreshold) {
    console.log(`🐌 Query lenta detectada (${duration}ms):`)
    console.log(`   ${e.query.substring(0, 100)}...`)
    console.log(`   Parámetros: ${e.params}`)
    console.log('')
  }
})

async function runTestQueries() {
  console.log('🔍 Ejecutando queries de prueba...\n')

  try {
    // Simular carga del dashboard
    const empresa = await prisma.empresa.findFirst({ select: { id: true } })
    if (!empresa) {
      console.log('⚠️  No hay empresas en la base de datos')
      return
    }

    const sedeScope = { cliente: { empresaId: empresa.id } }

    console.log('📊 Ejecutando queries del dashboard...\n')

    await Promise.all([
      prisma.cotizacion.count({ where: sedeScope }),
      prisma.cotizacion.count({ where: { ...sedeScope, estado: 'ENVIADA' } }),
      prisma.ordenTrabajo.count({ where: { cliente: { empresaId: empresa.id } } }),
      
      prisma.cotizacion.findMany({
        where: sedeScope,
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          cliente: true,
          items: {
            include: {
              material: true
            }
          },
          vendedor: true
        }
      }),

      prisma.ordenTrabajo.findMany({
        where: { cliente: { empresaId: empresa.id } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          cliente: true,
          vendedor: true,
          sede: true,
          cotizacion: true
        }
      })
    ])

    console.log('📋 Ejecutando queries de listados...\n')

    await prisma.material.findMany({ take: 50 })
    await prisma.cliente.findMany({ 
      where: { empresaId: empresa.id },
      take: 50 
    })

  } catch (error) {
    console.error('❌ Error ejecutando queries:', error)
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(80))
  console.log('📊 REPORTE DE ANÁLISIS DE QUERIES')
  console.log('='.repeat(80))

  const totalQueries = queryLogs.length
  const slowQueries = queryLogs.filter(q => q.duration > slowQueryThreshold)
  const avgDuration = queryLogs.reduce((sum, q) => sum + q.duration, 0) / totalQueries
  const maxDuration = Math.max(...queryLogs.map(q => q.duration))

  console.log(`\n📈 Estadísticas generales:`)
  console.log(`   Total de queries: ${totalQueries}`)
  console.log(`   Queries lentas (>${slowQueryThreshold}ms): ${slowQueries.length}`)
  console.log(`   Duración promedio: ${avgDuration.toFixed(2)}ms`)
  console.log(`   Duración máxima: ${maxDuration.toFixed(2)}ms`)

  if (slowQueries.length > 0) {
    console.log(`\n🐌 Top 10 queries más lentas:`)
    const sorted = [...slowQueries].sort((a, b) => b.duration - a.duration).slice(0, 10)
    
    sorted.forEach((log, i) => {
      console.log(`\n${i + 1}. Duración: ${log.duration}ms`)
      
      // Detectar tipo de query
      const queryType = detectQueryType(log.query)
      console.log(`   Tipo: ${queryType}`)
      
      // Mostrar query (truncada)
      const queryPreview = log.query.length > 150 
        ? log.query.substring(0, 150) + '...' 
        : log.query
      console.log(`   Query: ${queryPreview}`)
      
      // Análisis y recomendaciones
      const recommendations = analyzeQuery(log.query, log.duration)
      if (recommendations.length > 0) {
        console.log(`   💡 Recomendaciones:`)
        recommendations.forEach(rec => console.log(`      - ${rec}`))
      }
    })
  }

  console.log('\n' + '='.repeat(80))
  console.log('💡 RECOMENDACIONES GENERALES')
  console.log('='.repeat(80))

  if (slowQueries.length > totalQueries * 0.3) {
    console.log('\n⚠️  MÁS DEL 30% DE TUS QUERIES SON LENTAS')
    console.log('   Considera:')
    console.log('   - Revisar índices en la base de datos')
    console.log('   - Optimizar las relaciones en Prisma')
    console.log('   - Usar select en lugar de include cuando sea posible')
  }

  console.log('\n✅ Mejores prácticas:')
  console.log('   1. Usa "select" para traer solo los campos necesarios')
  console.log('   2. Evita N+1 queries usando "include" apropiadamente')
  console.log('   3. Ejecuta queries independientes en paralelo')
  console.log('   4. Implementa paginación en listados grandes')
  console.log('   5. Considera caché para datos estáticos')
  console.log('   6. Revisa el plan de ejecución de queries complejas')

  console.log('\n📚 Recursos útiles:')
  console.log('   - Prisma Performance: https://www.prisma.io/docs/guides/performance-and-optimization')
  console.log('   - PostgreSQL Indexes: https://www.postgresql.org/docs/current/indexes.html')

  console.log('\n')
}

function detectQueryType(query: string): string {
  if (query.includes('SELECT COUNT')) return 'COUNT'
  if (query.includes('SELECT SUM')) return 'AGGREGATE (SUM)'
  if (query.includes('SELECT AVG')) return 'AGGREGATE (AVG)'
  if (query.includes('JOIN')) return 'JOIN'
  if (query.includes('WHERE') && query.includes('LIKE')) return 'SEARCH (LIKE)'
  if (query.includes('WHERE')) return 'SELECT con filtro'
  if (query.includes('INSERT')) return 'INSERT'
  if (query.includes('UPDATE')) return 'UPDATE'
  if (query.includes('DELETE')) return 'DELETE'
  return 'SELECT simple'
}

function analyzeQuery(query: string, duration: number): string[] {
  const recommendations: string[] = []

  // Detectar múltiples JOINs
  const joinCount = (query.match(/JOIN/g) || []).length
  if (joinCount > 3) {
    recommendations.push(`${joinCount} JOINs detectados - considera denormalizar datos frecuentes`)
  }

  // Detectar LIKE sin índice
  if (query.includes('LIKE') && query.includes('%')) {
    recommendations.push('Búsqueda con LIKE - considera usar full-text search o índices GIN')
  }

  // Detectar SELECT *
  if (query.match(/SELECT\s+\*/)) {
    recommendations.push('SELECT * - usa "select" para traer solo campos necesarios')
  }

  // Query muy lenta
  if (duration > 200) {
    recommendations.push('Query extremadamente lenta - requiere optimización urgente')
  }

  // Sin índices evidentes
  if (query.includes('WHERE') && !query.includes('INDEX')) {
    recommendations.push('Verifica que los campos en WHERE tengan índices')
  }

  // ORDER BY sin LIMIT
  if (query.includes('ORDER BY') && !query.includes('LIMIT')) {
    recommendations.push('ORDER BY sin LIMIT - considera paginación')
  }

  return recommendations
}

async function main() {
  console.log('🚀 Analizador de Queries Lentas\n')
  console.log(`⏱️  Umbral de query lenta: ${slowQueryThreshold}ms\n`)

  await runTestQueries()
  await generateReport()
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
