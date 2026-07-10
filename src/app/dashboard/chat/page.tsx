import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getActiveSedeForUser } from '@/lib/rbac'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { buildAllowedDashboardPermissionKeysForUser } from '@/lib/dashboard-access'
import { CrmGlobalChatClient } from '@/components/crm/crm-global-chat-client'

export default async function GlobalChatPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/auth/login')

  const [user, sede] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true } }),
    getActiveSedeForUser(userId),
  ])

  const permissionKeys = user?.empresaId
    ? await buildAllowedDashboardPermissionKeysForUser({
        userId,
        empresaId: user.empresaId,
        sedeId: sede.id,
      })
    : []

  return (
    <CrmGlobalChatClient
      canAccessTeamChat={permissionKeys.includes('OPERACIONES.INTERNAL_CHAT')}
      canAccessCrmChat={permissionKeys.includes('OPERACIONES.GLOBAL_CHAT_CRM')}
    />
  )
}