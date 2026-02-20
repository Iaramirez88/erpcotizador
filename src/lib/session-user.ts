import { prisma } from '@/lib/prisma'

export async function resolveUserIdFromSession(session: {
  user?: { id?: string | null; email?: string | null }
}): Promise<string | null> {
  const id = session.user?.id ?? null
  if (id) {
    const userById = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (userById?.id) return userById.id
  }

  const email = session.user?.email
  if (!email) return null

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}
