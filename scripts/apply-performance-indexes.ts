/**
 * Script para aplicar índices de rendimiento
 * Ejecutar: npx tsx scripts/apply-performance-indexes.ts
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🚀 Aplicando índices de rendimiento...\n')

  try {
    // Leer el archivo SQL
    const sqlPath = join(process.cwd(), 'prisma', 'migrations', '20260129_performance_indexes.sql')
    const sqlContent = readFileSync(sqlPath, 'utf-8')
    
    // Separar por comandos (cada CREATE INDEX)
    const commands = sqlContent
      .split('\n')
      .filter(line => line.trim().startsWith('CREATE INDEX'))
    
    console.log(`📊 Total de índices a crear: ${commands.length}\n`)
    
    let created = 0
    let skipped = 0
    let errors = 0

    for (const command of commands) {
      // Extraer nombre del índice
      const match = command.match(/CREATE INDEX IF NOT EXISTS "([^"]+)"/)
      const indexName = match ? match[1] : 'unknown'
      
      try {
        await prisma.$executeRawUnsafe(command)
        console.log(`✅ ${indexName}`)
        created++
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log(`⏭️  ${indexName} (ya existe)`)
          skipped++
        } else {
          console.log(`❌ ${indexName}: ${error}`)
          errors++
        }
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('📊 RESUMEN')
    console.log('='.repeat(80))
    console.log(`✅ Índices creados: ${created}`)
    console.log(`⏭️  Índices existentes: ${skipped}`)
    console.log(`❌ Errores: ${errors}`)
    console.log('')

    if (created > 0) {
      console.log('🎉 ¡Índices aplicados exitosamente!')
      console.log('')
      console.log('💡 Próximos pasos:')
      console.log('   1. Ejecuta: npm run perf:benchmark')
      console.log('   2. Compara los resultados con el benchmark anterior')
      console.log('   3. Verifica que los índices se crearon: npm run perf:indexes')
    } else if (skipped === commands.length) {
      console.log('✅ Todos los índices ya estaban creados')
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
