import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function ensurePlanOwnerUserIdForEmpresa(empresaId: string): Promise<string | null> {
  let empresa: { id: string; planOwnerUserId: string | null } | null = null

  try {
    empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, planOwnerUserId: true },
    })
  } catch (error: unknown) {
    // En entornos locales con BD desactualizada (migraciones pendientes), esta columna puede no existir.
    // No bloqueamos toda la app por esto: devolvemos null y dejamos que el gating se comporte como "sin owner".
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[plan-owner] Missing column in DB (P2022). Run prisma migrations to enable plan ownership.')
      }
      return null
    }

    throw error
  }

  if (!empresa?.id) return null
  if (empresa.planOwnerUserId) return empresa.planOwnerUserId

  const adminMembership = await prisma.sedeMembership.findFirst({
    where: {
      role: 'ADMIN',
      sede: { empresaId },
    },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  })

  const earliestUser = await prisma.user.findFirst({
    where: { empresaId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  const candidateUserId = adminMembership?.userId ?? earliestUser?.id ?? null
  if (!candidateUserId) return null

  try {
    await prisma.empresa.updateMany({
      where: { id: empresaId, planOwnerUserId: null },
      data: { planOwnerUserId: candidateUserId },
    })
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[plan-owner] Missing column in DB (P2022). Skipping backfill of planOwnerUserId.')
      }
      return null
    }
    throw error
  }

  return candidateUserId
}

export async function isPlanOwnerForEmpresa(args: { empresaId: string; userId: string }): Promise<boolean> {
  const ownerUserId = await ensurePlanOwnerUserIdForEmpresa(args.empresaId)
  return Boolean(ownerUserId && ownerUserId === args.userId)
}
