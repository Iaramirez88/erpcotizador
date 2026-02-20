import { prisma } from '@/lib/prisma'

export async function ensurePlanOwnerUserIdForEmpresa(empresaId: string): Promise<string | null> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, planOwnerUserId: true },
  })

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

  await prisma.empresa.updateMany({
    where: { id: empresaId, planOwnerUserId: null },
    data: { planOwnerUserId: candidateUserId },
  })

  return candidateUserId
}

export async function isPlanOwnerForEmpresa(args: { empresaId: string; userId: string }): Promise<boolean> {
  const ownerUserId = await ensurePlanOwnerUserIdForEmpresa(args.empresaId)
  return Boolean(ownerUserId && ownerUserId === args.userId)
}
