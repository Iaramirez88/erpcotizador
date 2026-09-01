import { ModuleKey } from '@prisma/client'
import {
  buildAllowedDashboardHrefsFromContext,
  buildAllowedDashboardPermissionKeysFromContext,
  type DashboardAccessContext,
} from '../src/lib/dashboard-access-rules'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function createContext(args?: {
  legacyAccess?: Partial<Record<ModuleKey, 'NONE' | 'READ' | 'WRITE' | 'ADMIN'>>
  grants?: Array<{ domain: string; subdomain: string; action: string; allowed: boolean; scopeType: string; scopeValue: string | null; source: string }>
}): DashboardAccessContext {
  const grantsByCapability = new Map<string, Array<{ allowed: boolean; scopeType: string; scopeValue: string | null; source: string }>>()

  for (const grant of args?.grants ?? []) {
    const key = `${grant.domain}.${grant.subdomain}.${grant.action}`
    const current = grantsByCapability.get(key) ?? []
    current.push({
      allowed: grant.allowed,
      scopeType: grant.scopeType,
      scopeValue: grant.scopeValue,
      source: grant.source,
    })
    grantsByCapability.set(key, current)
  }

  return {
    userId: 'user-test',
    empresaId: 'empresa-test',
    sedeId: 'sede-test',
    isSuperAdmin: false,
    membershipRole: null,
    legacyAccess: args?.legacyAccess ?? {},
    disabledDomains: new Set(),
    disabledCapabilities: new Set(),
    grantsByCapability,
  }
}

function main() {
  const legacyCrmContext = createContext({ legacyAccess: { [ModuleKey.CRM]: 'READ' } })
  const legacyCrmHrefs = buildAllowedDashboardHrefsFromContext({ context: legacyCrmContext })
  const legacyCrmKeys = buildAllowedDashboardPermissionKeysFromContext({ context: legacyCrmContext })
  assert(legacyCrmHrefs.includes('/dashboard/crm/integraciones'), 'El legado CRM debe seguir viendo Automatización')
  assert(legacyCrmHrefs.includes('/dashboard/crm/archivos'), 'El legado CRM debe seguir viendo DRIVE')
  assert(!legacyCrmHrefs.includes('/dashboard/chat'), 'El legado CRM no debe ver Conversaciones por herencia indirecta')
  assert(!legacyCrmKeys.includes('OPERACIONES.GLOBAL_CHAT_CRM'), 'El legado CRM no debe resolver el permiso directo de Conversaciones CRM')

  const legacyDashboardContext = createContext({ legacyAccess: { [ModuleKey.DASHBOARD]: 'READ' } })
  const legacyDashboardHrefs = buildAllowedDashboardHrefsFromContext({ context: legacyDashboardContext })
  const legacyDashboardKeys = buildAllowedDashboardPermissionKeysFromContext({ context: legacyDashboardContext })
  assert(legacyDashboardHrefs.includes('/dashboard/mapa-producto'), 'El legado Dashboard debe seguir viendo Mapa de producto')
  assert(legacyDashboardHrefs.includes('/dashboard/plantillas'), 'El legado Dashboard debe seguir viendo Plantillas')
  assert(!legacyDashboardHrefs.includes('/dashboard/rop'), 'El legado Dashboard no debe abrir ROP sin grant directo')
  assert(!legacyDashboardKeys.includes('CORE.ROP'), 'El legado Dashboard no debe resolver CORE.ROP por herencia')

  const legacyOrdersContext = createContext({ legacyAccess: { [ModuleKey.ORDENES]: 'READ' } })
  const legacyOrdersHrefs = buildAllowedDashboardHrefsFromContext({ context: legacyOrdersContext })
  const legacyOrdersKeys = buildAllowedDashboardPermissionKeysFromContext({ context: legacyOrdersContext })
  assert(legacyOrdersHrefs.includes('/dashboard/chat'), 'El legado Órdenes debe seguir viendo Conversaciones internas')
  assert(legacyOrdersKeys.includes('OPERACIONES.INTERNAL_CHAT'), 'El legado Órdenes debe resolver Conversaciones internas')

  const directRopContext = createContext({
    grants: [{ domain: 'CORE', subdomain: 'ROP', action: 'READ', allowed: true, scopeType: 'SEDE', scopeValue: 'sede-test', source: 'DIRECT' }],
  })
  const directRopHrefs = buildAllowedDashboardHrefsFromContext({ context: directRopContext })
  const directRopKeys = buildAllowedDashboardPermissionKeysFromContext({ context: directRopContext })
  assert(directRopHrefs.includes('/dashboard/rop'), 'Un grant directo debe abrir la ruta de ROP')
  assert(directRopKeys.includes('CORE.ROP'), 'Un grant directo debe resolver CORE.ROP')

  console.log('OK dashboard-access-rbac')
}

try {
  main()
} catch (error) {
  console.error('FAIL dashboard-access-rbac', error)
  process.exit(1)
}