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

function runtimeModelHasField(client: PrismaClient, modelName: string, fieldName: string): boolean {
  try {
    const runtimeDataModel = (client as unknown as { _runtimeDataModel?: any })._runtimeDataModel
    const model = runtimeDataModel?.models?.[modelName]
    const fields: Array<{ name: string }> | undefined = model?.fields
    return Array.isArray(fields) ? fields.some((f) => f?.name === fieldName) : false
  } catch {
    return false
  }
}

let prismaClient = globalForPrisma.prisma

// En desarrollo, el singleton puede quedar desfasado si se regeneró Prisma Client
// mientras el server estaba corriendo (HMR + cache global). Si detectamos que le
// faltan campos nuevos, forzamos una nueva instancia.
if (process.env.NODE_ENV !== 'production' && prismaClient) {
  const hasTrialTier = runtimeModelHasField(prismaClient, 'Empresa', 'trialTier')
  if (!hasTrialTier) prismaClient = undefined
}

export const prisma =
  prismaClient ??
  (new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }) as PrismaClient)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
