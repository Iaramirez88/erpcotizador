import { requireCapabilityAccess, type ApiAccessFail, type ApiCapabilityAccessOk } from '@/lib/api-rbac'
import type { RbacV2CapabilityAction, RbacV2Scope } from '@/lib/rbac-v2-catalog'

type TaskWorkspaceAccessKind = 'workspace' | 'commercial' | 'either'

type TaskWorkspaceCapabilityArgs = {
  action: RbacV2CapabilityAction
  scope?: RbacV2Scope
  sedeId?: string
  kind?: TaskWorkspaceAccessKind
}

async function requireOperationalWorkspaceCapability(args: TaskWorkspaceCapabilityArgs) {
  return requireCapabilityAccess({
    domain: 'OPERACIONES',
    subdomain: 'TASK_WORKSPACES',
    action: args.action,
    scope: args.scope,
    sedeId: args.sedeId,
  })
}

async function requireCommercialTaskCapability(args: TaskWorkspaceCapabilityArgs) {
  return requireCapabilityAccess({
    domain: 'CAPTACION',
    subdomain: 'COMMERCIAL_TASKS',
    action: args.action,
    scope: args.scope,
    sedeId: args.sedeId,
  })
}

export async function requireWorkspaceTaskCapability(
  args: TaskWorkspaceCapabilityArgs,
): Promise<ApiCapabilityAccessOk | ApiAccessFail> {
  if (args.kind === 'workspace') {
    return requireOperationalWorkspaceCapability(args)
  }

  if (args.kind === 'commercial') {
    return requireCommercialTaskCapability(args)
  }

  const workspaceAccess = await requireOperationalWorkspaceCapability(args)
  if (workspaceAccess.ok) return workspaceAccess

  return requireCommercialTaskCapability(args)
}

export async function assertTaskCapabilitySedeAccess(args: {
  sedeId: string
  action: RbacV2CapabilityAction
  kind: Exclude<TaskWorkspaceAccessKind, 'either'>
}) {
  const access = await requireWorkspaceTaskCapability({
    action: args.action,
    scope: 'SEDE',
    sedeId: args.sedeId,
    kind: args.kind,
  })

  return access.ok ? null : access.response
}