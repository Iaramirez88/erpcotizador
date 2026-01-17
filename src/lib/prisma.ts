/**
 * Cliente de Prisma - Singleton para evitar múltiples instancias
 * 
 * En desarrollo, Next.js hace hot-reload y crearía múltiples instancias
 * de PrismaClient. Esta configuración evita ese problema.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

if (!globalForPrisma.pool) {
  globalForPrisma.pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  })
}

const adapter = new PrismaPg(globalForPrisma.pool)

export const prisma =
  globalForPrisma.prisma ??
  (new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }) as PrismaClient)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
