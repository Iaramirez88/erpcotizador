import { requireCapabilityAccess, type ApiAccessFail, type ApiCapabilityAccessOk } from '@/lib/api-rbac'
import type { RbacV2CapabilityAction, RbacV2Scope } from '@/lib/rbac-v2-catalog'

type TaskWorkspaceCapabilityArgs = {
  action: RbacV2CapabilityAction
  scope?: RbacV2Scope
  sedeId?: string
}

export async function requireWorkspaceTaskCapability(
  args: TaskWorkspaceCapabilityArgs,
): Promise<ApiCapabilityAccessOk | ApiAccessFail> {
  const workspaceAccess = await requireCapabilityAccess({
    domain: 'OPERACIONES',
    subdomain: 'TASK_WORKSPACES',
    action: args.action,
    scope: args.scope,
    sedeId: args.sedeId,
  })
  if (workspaceAccess.ok) return workspaceAccess

  return requireCapabilityAccess({
    domain: 'CAPTACION',
    subdomain: 'COMMERCIAL_TASKS',
    action: args.action,
    scope: args.scope,
    sedeId: args.sedeId,
  })
}