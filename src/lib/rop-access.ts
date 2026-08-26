import 'server-only'

import { canAccessCapability, requireCapabilityAccess } from '@/lib/api-rbac'
import type { RbacV2CapabilityAction } from '@/lib/rbac-v2-catalog'

const ROP_CAPABILITY = {
  domain: 'CORE' as const,
  subdomain: 'ROP',
  allowLegacyFallback: false,
}

export async function canAccessRopModule() {
  return canAccessCapability({ ...ROP_CAPABILITY, action: 'READ' })
}

export async function requireRopReadAccess() {
  return requireCapabilityAccess({ ...ROP_CAPABILITY, action: 'READ' })
}

export async function requireRopAccess(action: RbacV2CapabilityAction) {
  return requireCapabilityAccess({ ...ROP_CAPABILITY, action })
}