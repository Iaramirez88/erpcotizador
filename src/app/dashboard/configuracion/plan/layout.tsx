import { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { ensurePlanOwnerUserIdForEmpresa } from '@/lib/plan-owner'
import { isSuperAdminEmail } from '@/lib/super-admin'

export default async function PlanLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/auth/login')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, empresaId: true },
  })

  const isSystemSuperAdmin = isSuperAdminEmail(user?.email)
  if (isSystemSuperAdmin) return children

  const empresaId = user?.empresaId
  if (!empresaId) redirect('/dashboard')

  const ownerUserId = await ensurePlanOwnerUserIdForEmpresa(empresaId)
  if (!ownerUserId || ownerUserId !== userId) redirect('/dashboard')

  return children
}
