import { prisma } from '@/lib/prisma'
import { getActiveSedeForUser } from '@/lib/rbac'
import { buildAllowedDashboardPermissionKeysForUser } from '@/lib/dashboard-access'

export type DashboardChatAccess = {
  canAccessTeamChat: boolean
  canAccessCrmChat: boolean
}

export async function resolveDashboardChatAccessForUser(userId: string): Promise<DashboardChatAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { empresaId: true },
  })

  if (!user?.empresaId) {
    return { canAccessTeamChat: false, canAccessCrmChat: false }
  }

  const sede = await getActiveSedeForUser(userId)
  const permissionKeys = await buildAllowedDashboardPermissionKeysForUser({
    userId,
    empresaId: user.empresaId,
    sedeId: sede.id,
  })

  return {
    canAccessTeamChat: permissionKeys.includes('OPERACIONES.INTERNAL_CHAT'),
    canAccessCrmChat: permissionKeys.includes('OPERACIONES.GLOBAL_CHAT_CRM'),
  }
}