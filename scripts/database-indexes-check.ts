/**
 * 🔍 Verificador de Índices de Base de Datos
 * 
 * Ejecutar: npx tsx scripts/database-indexes-check.ts
 * 
 * Analiza:
 * - Índices existentes
 * - Tablas sin índices
 * - Campos que deberían tener índices
 * - Índices no utilizados
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface IndexInfo {
  tablename: string
  indexname: string
  indexdef: string
}

interface TableInfo {
  tablename: string
  schemaname: string
}

async function getIndexes(): Promise<IndexInfo[]> {
  const result = await prisma.$queryRaw<IndexInfo[]>`
    SELECT 
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `
  
  return result
}

async function getTables(): Promise<TableInfo[]> {
  const result = await prisma.$queryRaw<TableInfo[]>`
    SELECT 
      tablename,
      schemaname
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `
  
  return result
}

async function getTableStats(tableName: string): Promise<{ rows: number }> {
  const result = await prisma.$queryRaw<{ reltuples: number }[]>`
    SELECT reltuples::bigint as reltuples
    FROM pg_class
    WHERE relname = ${tableName}
  `
  
  return { rows: result[0]?.reltuples || 0 }
}

async function main() {
  console.log('🔍 Analizando índices de base de datos...\n')

  const tables = await getTables()
  const indexes = await getIndexes()

  // Agrupar índices por tabla
  const indexesByTable = new Map<string, IndexInfo[]>()
  for (const index of indexes) {
    if (!indexesByTable.has(index.tablename)) {
      indexesByTable.set(index.tablename, [])
    }
    indexesByTable.get(index.tablename)!.push(index)
  }

  console.log('📊 ANÁLISIS DE ÍNDICES POR TABLA')
  console.log('='.repeat(80))

  for (const table of tables) {
    const tableIndexes = indexesByTable.get(table.tablename) || []
    const stats = await getTableStats(table.tablename)
    
    console.log(`\n📁 Tabla: ${table.tablename}`)
    console.log(`   Filas: ~${stats.rows}`)
    console.log(`   Índices: ${tableIndexes.length}`)
    
    if (tableIndexes.length > 0) {
      tableIndexes.forEach(idx => {
        const isPrimary = idx.indexname.includes('_pkey')
        const isUnique = idx.indexdef.includes('UNIQUE')
        const isForeign = idx.indexname.includes('_fkey') || idx.indexname.includes('_idx')
        
        let type = '📍 Regular'
        if (isPrimary) type = '🔑 Primary Key'
        else if (isUnique) type = '🔒 Unique'
        else if (isForeign) type = '🔗 Foreign Key'
        
        console.log(`   ${type}: ${idx.indexname}`)
      })
    } else {
      console.log('   ⚠️  Sin índices (excepto PK)')
    }
  }

  // Analizar tablas críticas
  console.log('\n' + '='.repeat(80))
  console.log('🎯 ANÁLISIS DE TABLAS CRÍTICAS')
  console.log('='.repeat(80))

  const criticalTables = [
    'cotizaciones',
    'ordenes_trabajo',
    'clientes',
    'materiales',
    'items_cotizacion',
    'users',
    'sedes',
    'document_scans'
  ]

  for (const tableName of criticalTables) {
    const tableIndexes = indexesByTable.get(tableName) || []
    const stats = await getTableStats(tableName)
    
    console.log(`\n📊 ${tableName} (${stats.rows} filas)`)
    
    // Recomendaciones específicas por tabla
    const recommendations: string[] = []
    
    if (tableName === 'cotizaciones') {
      const hasSedeIndex = tableIndexes.some(i => i.indexdef.includes('sedeId'))
      const hasEstadoIndex = tableIndexes.some(i => i.indexdef.includes('estado'))
      const hasCreatedAtIndex = tableIndexes.some(i => i.indexdef.includes('createdAt'))
      
      if (!hasSedeIndex) recommendations.push('Agregar índice en sedeId')
      if (!hasEstadoIndex) recommendations.push('Agregar índice en estado')
      if (!hasCreatedAtIndex) recommendations.push('Agregar índice en createdAt para ordenamiento')
      if (stats.rows > 1000 && !hasSedeIndex) {
        recommendations.push('⚠️  CRÍTICO: >1000 filas sin índice en sedeId')
      }
    }
    
    if (tableName === 'clientes') {
      const hasNombreIndex = tableIndexes.some(i => i.indexdef.includes('nombre'))
      const hasEmailIndex = tableIndexes.some(i => i.indexdef.includes('email'))
      
      if (!hasNombreIndex && stats.rows > 100) {
        recommendations.push('Considerar índice GIN para búsqueda por nombre')
      }
      if (!hasEmailIndex && stats.rows > 100) {
        recommendations.push('Agregar índice en email para búsquedas')
      }
    }
    
    if (tableName === 'items_cotizacion') {
      const hasCotizacionIdIndex = tableIndexes.some(i => i.indexdef.includes('cotizacionId'))
      
      if (!hasCotizacionIdIndex) {
        recommendations.push('⚠️  Agregar índice en cotizacionId para evitar N+1')
      }
    }
    
    if (tableName === 'document_scans') {
      const hasStatusIndex = tableIndexes.some(i => i.indexdef.includes('status'))
      const hasCreatedAtIndex = tableIndexes.some(i => i.indexdef.includes('createdAt'))
      
      if (!hasStatusIndex) recommendations.push('Agregar índice compuesto (status, approved)')
      if (!hasCreatedAtIndex) recommendations.push('Agregar índice en createdAt')
    }

    if (recommendations.length > 0) {
      console.log('   💡 Recomendaciones:')
      recommendations.forEach(rec => console.log(`      - ${rec}`))
    } else {
      console.log('   ✅ Índices adecuados')
    }
  }

  // Sugerencias de índices compuestos
  console.log('\n' + '='.repeat(80))
  console.log('💡 ÍNDICES COMPUESTOS RECOMENDADOS')
  console.log('='.repeat(80))

  console.log(`
CREATE INDEX IF NOT EXISTS idx_cotizaciones_sede_estado ON cotizaciones(sedeId, estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_sede_created ON cotizaciones(sedeId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_ordenes_sede_estado ON ordenes_trabajo(sedeId, estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_sede_created ON ordenes_trabajo(sedeId, createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON clientes(empresaId);
CREATE INDEX IF NOT EXISTS idx_materiales_empresa ON materiales(empresaId);
CREATE INDEX IF NOT EXISTS idx_scans_status_approved ON document_scans(status, approved);
CREATE INDEX IF NOT EXISTS idx_scans_created ON document_scans(createdAt DESC);

-- Índices para búsquedas de texto (requiere extensión pg_trgm)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX idx_clientes_nombre_gin ON clientes USING gin(nombre gin_trgm_ops);
-- CREATE INDEX idx_clientes_email_gin ON clientes USING gin(email gin_trgm_ops);
  `)

  console.log('\n' + '='.repeat(80))
  console.log('📈 ESTADÍSTICAS GENERALES')
  console.log('='.repeat(80))

  console.log(`\n   Total de tablas: ${tables.length}`)
  console.log(`   Total de índices: ${indexes.length}`)
  console.log(`   Promedio de índices por tabla: ${(indexes.length / tables.length).toFixed(1)}`)

  const tablesWithoutIndexes = tables.filter(t => !indexesByTable.has(t.tablename))
  if (tablesWithoutIndexes.length > 0) {
    console.log(`\n   ⚠️  Tablas sin índices adicionales (solo PK):`)
    tablesWithoutIndexes.forEach(t => console.log(`      - ${t.tablename}`))
  }

  console.log('\n💡 PRÓXIMOS PASOS:')
  console.log('   1. Copia los índices recomendados arriba')
  console.log('   2. Crea una nueva migración: npx prisma migrate dev --name add_performance_indexes')
  console.log('   3. Ejecuta los índices manualmente o agrégalos al schema de Prisma')
  console.log('   4. Vuelve a ejecutar benchmark-queries.ts para medir la mejora')

  console.log('\n')
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
