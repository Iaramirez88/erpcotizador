import { prisma } from '@/lib/prisma'
import { canUserAccessWorkspace, getAccessibleTaskWorkspace } from '@/lib/crm-task-workspaces'

export async function getGanttPlanAccess(planId: string, empresaId: string, userId: string) {
  const plan = await prisma.crmGanttPlan.findFirst({
    where: { id: planId, empresaId, archivedAt: null },
    select: { id: true, workspaceId: true, createdById: true, members: { where: { userId }, select: { role: true } } },
  })
  if (!plan) return null
  const isOwner = plan.createdById === userId
  const membership = plan.members[0] || null
  if (!plan.workspaceId) return { plan, canView: isOwner || Boolean(membership), canComment: isOwner || Boolean(membership), canEdit: isOwner }
  const workspace = await getAccessibleTaskWorkspace(prisma, { workspaceId: plan.workspaceId, empresaId, userId })
  const canViewWorkspace = Boolean(workspace)
  const canEditWorkspace = Boolean(workspace && canUserAccessWorkspace(workspace, userId, 'edit'))
  return { plan, canView: isOwner || Boolean(membership) || canViewWorkspace, canComment: isOwner || Boolean(membership) || canEditWorkspace, canEdit: isOwner || canEditWorkspace }
}