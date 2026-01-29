/**
 * 📊 Benchmark de Queries - Mide el rendimiento de consultas críticas
 * 
 * Ejecutar: npx tsx scripts/benchmark-queries.ts
 * 
 * Este script mide:
 * - Tiempos de consultas individuales
 * - Queries N+1
 * - Impacto de includes vs select
 * - Consultas del dashboard
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
const prisma = new PrismaClient({ 
  adapter,
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' }
  ]
})

interface BenchmarkResult {
  name: string
  duration: number
  queryCount: number
  status: 'success' | 'error'
  error?: string
}

const results: BenchmarkResult[] = []
let queryCount = 0

// Contador de queries
prisma.$on('query', () => {
  queryCount++
})

async function benchmark(name: string, fn: () => Promise<unknown>): Promise<void> {
  const initialQueryCount = queryCount
  const start = performance.now()
  
  try {
    await fn()
    const duration = performance.now() - start
    const queries = queryCount - initialQueryCount
    
    results.push({
      name,
      duration,
      queryCount: queries,
      status: 'success'
    })
    
    console.log(`✅ ${name}: ${duration.toFixed(2)}ms (${queries} queries)`)
  } catch (error) {
    const duration = performance.now() - start
    results.push({
      name,
      duration,
      queryCount: queryCount - initialQueryCount,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    })
    
    console.log(`❌ ${name}: ERROR - ${error}`)
  }
}

async function main() {
  console.log('🚀 Iniciando benchmarks de queries...\n')

  // ============================================
  // 1. QUERIES BÁSICAS
  // ============================================
  
  await benchmark('User findFirst (básico)', async () => {
    await prisma.user.findFirst({
      select: { id: true, email: true }
    })
  })

  await benchmark('User findFirst (con relaciones)', async () => {
    await prisma.user.findFirst({
      include: {
        sedeMemberships: {
          include: {
            sede: true
          }
        }
      }
    })
  })

  // ============================================
  // 2. DASHBOARD QUERIES (LAS MÁS CRÍTICAS)
  // ============================================

  const empresa = await prisma.empresa.findFirst({ select: { id: true } })
  const empresaId = empresa?.id

  if (empresaId) {
    await benchmark('Dashboard: Contar cotizaciones', async () => {
      await prisma.cotizacion.count({ 
        where: { cliente: { empresaId } } 
      })
    })

    await benchmark('Dashboard: Aggregate cotizaciones', async () => {
      await prisma.cotizacion.aggregate({
        where: { cliente: { empresaId }, estado: 'APROBADA' },
        _sum: { total: true }
      })
    })

    await benchmark('Dashboard: Últimas 6 cotizaciones (con includes)', async () => {
      await prisma.cotizacion.findMany({
        where: { cliente: { empresaId } },
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
      })
    })

    await benchmark('Dashboard: Últimas 6 cotizaciones (solo select)', async () => {
      await prisma.cotizacion.findMany({
        where: { cliente: { empresaId } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          numero: true,
          total: true,
          estado: true,
          createdAt: true,
          cliente: { select: { nombre: true } }
        }
      })
    })
  }

  // ============================================
  // 3. QUERIES CON POTENCIAL N+1
  // ============================================

  await benchmark('Cotizaciones con items (N+1 potencial)', async () => {
    const cotizaciones = await prisma.cotizacion.findMany({
      take: 10
    })
    
    // Esto generaría N+1 queries
    for (const cot of cotizaciones) {
      await prisma.itemCotizacion.findMany({
        where: { cotizacionId: cot.id }
      })
    }
  })

  await benchmark('Cotizaciones con items (optimizado con include)', async () => {
    await prisma.cotizacion.findMany({
      take: 10,
      include: {
        items: true
      }
    })
  })

  // ============================================
  // 4. QUERIES DE LISTADOS PESADOS
  // ============================================

  await benchmark('Listar 50 materiales (todos los campos)', async () => {
    await prisma.material.findMany({
      take: 50
    })
  })

  await benchmark('Listar 50 materiales (solo campos necesarios)', async () => {
    await prisma.material.findMany({
      take: 50,
      select: {
        id: true,
        nombre: true,
        precioUnidad: true,
        tipo: true
      }
    })
  })

  // ============================================
  // 5. BÚSQUEDAS
  // ============================================

  await benchmark('Búsqueda de clientes (sin índice)', async () => {
    await prisma.cliente.findMany({
      where: {
        OR: [
          { nombre: { contains: 'test', mode: 'insensitive' } },
          { email: { contains: 'test', mode: 'insensitive' } }
        ]
      },
      take: 20
    })
  })

  // ============================================
  // 6. QUERIES COMPLEJAS CON MÚLTIPLES JOINS
  // ============================================

  await benchmark('Query compleja: Orden con todas las relaciones', async () => {
    await prisma.ordenTrabajo.findFirst({
      include: {
        cliente: true,
        vendedor: true,
        sede: true,
        cotizacion: true,
        etapas: {
          include: {
            maquina: true
          }
        }
      }
    })
  })

  // ============================================
  // 7. SIMULACIÓN DE CARGA DEL DASHBOARD
  // ============================================

  await benchmark('Dashboard completo (todas las queries en paralelo)', async () => {
    if (!empresaId) return

    const sedeScope = { cliente: { empresaId } }

    await Promise.all([
      // Conteos
      prisma.cotizacion.count({ where: sedeScope }),
      prisma.cotizacion.count({ where: { ...sedeScope, estado: 'ENVIADA' } }),
      prisma.cotizacion.count({ where: { ...sedeScope, estado: 'APROBADA' } }),
      prisma.ordenTrabajo.count({ where: { cliente: { empresaId } } }),
      
      // Agregaciones
      prisma.cotizacion.aggregate({ 
        where: { ...sedeScope, estado: 'APROBADA' }, 
        _sum: { total: true } 
      }),
      prisma.ordenTrabajo.aggregate({ 
        where: { cliente: { empresaId } }, 
        _sum: { total: true } 
      }),
      
      // Listados recientes
      prisma.cotizacion.findMany({
        where: sedeScope,
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          numero: true,
          total: true,
          estado: true,
          createdAt: true,
          cliente: { select: { nombre: true } }
        }
      }),
      
      prisma.ordenTrabajo.findMany({
        where: { cliente: { empresaId } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          numero: true,
          estado: true,
          total: true,
          createdAt: true,
          cliente: { select: { nombre: true } }
        }
      })
    ])
  })

  // ============================================
  // RESUMEN
  // ============================================

  console.log('\n' + '='.repeat(80))
  console.log('📊 RESUMEN DE BENCHMARKS')
  console.log('='.repeat(80))

  const successful = results.filter(r => r.status === 'success')
  const failed = results.filter(r => r.status === 'error')

  console.log(`\n✅ Exitosos: ${successful.length}`)
  console.log(`❌ Fallidos: ${failed.length}`)
  
  if (successful.length > 0) {
    console.log('\n🐌 Queries más lentas:')
    const slowest = [...successful].sort((a, b) => b.duration - a.duration).slice(0, 5)
    slowest.forEach((r, i) => {
      console.log(`${i + 1}. ${r.name}: ${r.duration.toFixed(2)}ms (${r.queryCount} queries)`)
    })

    console.log('\n⚡ Queries más rápidas:')
    const fastest = [...successful].sort((a, b) => a.duration - b.duration).slice(0, 5)
    fastest.forEach((r, i) => {
      console.log(`${i + 1}. ${r.name}: ${r.duration.toFixed(2)}ms (${r.queryCount} queries)`)
    })

    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length
    const totalQueries = successful.reduce((sum, r) => sum + r.queryCount, 0)
    
    console.log(`\n📈 Promedio de duración: ${avgDuration.toFixed(2)}ms`)
    console.log(`📊 Total de queries ejecutadas: ${totalQueries}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('💡 RECOMENDACIONES:')
  console.log('='.repeat(80))
  
  const slowQueries = successful.filter(r => r.duration > 100)
  if (slowQueries.length > 0) {
    console.log('\n⚠️  Queries que tardan más de 100ms:')
    slowQueries.forEach(r => {
      console.log(`  - ${r.name}: ${r.duration.toFixed(2)}ms`)
      
      if (r.name.includes('include') && r.queryCount > 5) {
        console.log(`    💡 Considera usar 'select' en lugar de 'include'`)
      }
      
      if (r.name.includes('N+1')) {
        console.log(`    💡 Problema N+1 detectado - usa 'include' o dataloader`)
      }
      
      if (r.queryCount > 10) {
        console.log(`    💡 ${r.queryCount} queries - considera optimizar o usar transacciones`)
      }
    })
  }

  console.log('\n✅ Considera agregar índices para:')
  console.log('  - Búsquedas frecuentes (nombre, email)')
  console.log('  - Campos de ordenamiento (createdAt, updatedAt)')
  console.log('  - Claves foráneas frecuentes (empresaId, sedeId, clienteId)')
  
  console.log('\n✅ Optimizaciones recomendadas:')
  console.log('  - Usa "select" en lugar de "include" cuando solo necesites campos específicos')
  console.log('  - Ejecuta queries independientes en paralelo con Promise.all()')
  console.log('  - Implementa caché para datos que no cambian frecuentemente')
  console.log('  - Considera paginación para listados grandes')
  console.log('  - Revisa el log de queries en desarrollo para detectar N+1')

  console.log('\n')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
