export type RbacV2Domain =
  | 'CORE'
  | 'CAPTACION'
  | 'VENTAS'
  | 'OPERACIONES'
  | 'RECURSOS'
  | 'FINANZAS'
  | 'ANALITICA'
  | 'IA'
  | 'VERTICALES'

export type RbacV2CapabilityAction =
  | 'READ'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ASSIGN'
  | 'APPROVE'
  | 'EXECUTE'
  | 'CLOSE'
  | 'EXPORT'
  | 'AUDIT'
  | 'CONFIGURE'

export type RbacV2Scope =
  | 'GLOBAL_PLATFORM'
  | 'EMPRESA'
  | 'SEDE'
  | 'TEAM'
  | 'OWN'
  | 'ASSIGNED'
  | 'VERTICAL'

export type RbacV2CapabilityDefinition = {
  domain: RbacV2Domain
  subdomain: string
  actions: RbacV2CapabilityAction[]
  recommendedScopes: RbacV2Scope[]
}

export type LegacyModuleMapping = {
  moduleKey: string
  targets: Array<{
    domain: RbacV2Domain
    subdomains: string[]
  }>
}

export const RBAC_V2_CAPABILITY_CATALOG: RbacV2CapabilityDefinition[] = [
  { domain: 'CORE', subdomain: 'DASHBOARD', actions: ['READ'], recommendedScopes: ['EMPRESA', 'SEDE'] },
  { domain: 'CORE', subdomain: 'PRODUCT_MAP', actions: ['READ'], recommendedScopes: ['EMPRESA', 'SEDE'] },
  { domain: 'CORE', subdomain: 'TEMPLATES', actions: ['READ'], recommendedScopes: ['EMPRESA', 'SEDE'] },
  { domain: 'CORE', subdomain: 'COMPANY', actions: ['READ', 'UPDATE', 'CONFIGURE'], recommendedScopes: ['EMPRESA'] },
  { domain: 'CORE', subdomain: 'USERS', actions: ['READ', 'CREATE', 'UPDATE', 'CONFIGURE'], recommendedScopes: ['EMPRESA', 'SEDE'] },
  { domain: 'CORE', subdomain: 'ROLES', actions: ['READ', 'CREATE', 'UPDATE', 'CONFIGURE'], recommendedScopes: ['EMPRESA', 'SEDE'] },
  { domain: 'CORE', subdomain: 'PLANS', actions: ['READ', 'CONFIGURE'], recommendedScopes: ['EMPRESA'] },
  { domain: 'CORE', subdomain: 'WEB_SERVICES', actions: ['READ', 'CREATE', 'UPDATE', 'CONFIGURE'], recommendedScopes: ['EMPRESA'] },

  { domain: 'CAPTACION', subdomain: 'INBOX', actions: ['READ', 'UPDATE', 'ASSIGN'], recommendedScopes: ['ASSIGNED', 'TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'CAPTACION', subdomain: 'CHANNELS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'CONFIGURE'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'CAPTACION', subdomain: 'LEADS', actions: ['READ', 'CREATE', 'UPDATE', 'ASSIGN', 'EXPORT'], recommendedScopes: ['OWN', 'ASSIGNED', 'TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'CAPTACION', subdomain: 'OPPORTUNITIES', actions: ['READ', 'CREATE', 'UPDATE', 'ASSIGN', 'EXPORT', 'CONFIGURE'], recommendedScopes: ['OWN', 'ASSIGNED', 'TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'CAPTACION', subdomain: 'CONTACTS', actions: ['READ', 'CREATE', 'UPDATE'], recommendedScopes: ['OWN', 'ASSIGNED', 'TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'CAPTACION', subdomain: 'ACTIVITIES', actions: ['READ', 'CREATE', 'UPDATE'], recommendedScopes: ['OWN', 'ASSIGNED', 'TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'CAPTACION', subdomain: 'AGENDA', actions: ['READ', 'CREATE', 'UPDATE'], recommendedScopes: ['OWN', 'TEAM', 'SEDE'] },
  { domain: 'CAPTACION', subdomain: 'COMMERCIAL_TASKS', actions: ['READ', 'CREATE', 'UPDATE', 'ASSIGN', 'EXECUTE', 'CLOSE'], recommendedScopes: ['OWN', 'ASSIGNED', 'TEAM', 'SEDE'] },

  { domain: 'VENTAS', subdomain: 'QUOTER', actions: ['READ', 'CREATE', 'UPDATE', 'CONFIGURE'], recommendedScopes: ['OWN', 'SEDE', 'EMPRESA'] },
  { domain: 'VENTAS', subdomain: 'QUOTES', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'EXPORT'], recommendedScopes: ['OWN', 'SEDE', 'EMPRESA'] },
  { domain: 'VENTAS', subdomain: 'DELIVERY_NOTES', actions: ['READ', 'CREATE', 'UPDATE', 'EXPORT'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'VENTAS', subdomain: 'POS', actions: ['READ', 'CREATE', 'UPDATE', 'EXECUTE'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'VENTAS', subdomain: 'CUSTOMERS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT'], recommendedScopes: ['SEDE', 'EMPRESA'] },

  { domain: 'OPERACIONES', subdomain: 'WORK_ORDERS', actions: ['READ', 'CREATE', 'UPDATE', 'ASSIGN', 'EXECUTE', 'CLOSE'], recommendedScopes: ['ASSIGNED', 'TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'OPERACIONES', subdomain: 'PROJECTS', actions: ['READ', 'CREATE', 'UPDATE', 'ASSIGN'], recommendedScopes: ['TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'OPERACIONES', subdomain: 'FILES', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'CONFIGURE'], recommendedScopes: ['TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'OPERACIONES', subdomain: 'TASK_WORKSPACES', actions: ['READ', 'CREATE', 'UPDATE', 'CONFIGURE'], recommendedScopes: ['TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'OPERACIONES', subdomain: 'INTERNAL_CHAT', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'], recommendedScopes: ['TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'OPERACIONES', subdomain: 'DOCUMENT_CAPTURE', actions: ['READ', 'CREATE', 'UPDATE', 'EXECUTE'], recommendedScopes: ['TEAM', 'SEDE', 'EMPRESA'] },

  { domain: 'RECURSOS', subdomain: 'INVENTORY', actions: ['READ', 'UPDATE', 'EXPORT'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'RECURSOS', subdomain: 'TRANSFERS', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'RECURSOS', subdomain: 'PRODUCTS', actions: ['READ', 'CREATE', 'UPDATE'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'RECURSOS', subdomain: 'MATERIALS', actions: ['READ', 'CREATE', 'UPDATE'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'RECURSOS', subdomain: 'PURCHASES', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'RECURSOS', subdomain: 'SUPPLIERS', actions: ['READ', 'CREATE', 'UPDATE'], recommendedScopes: ['SEDE', 'EMPRESA'] },

  { domain: 'FINANZAS', subdomain: 'ACCOUNTING', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'CLOSE', 'EXPORT'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'FINANZAS', subdomain: 'PAYROLL', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'EXPORT'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'FINANZAS', subdomain: 'INVOICING', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'EXPORT'], recommendedScopes: ['SEDE', 'EMPRESA'] },

  { domain: 'ANALITICA', subdomain: 'REPORTS', actions: ['READ', 'EXPORT'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'ANALITICA', subdomain: 'INTELLIGENCE', actions: ['READ', 'EXPORT'], recommendedScopes: ['SEDE', 'EMPRESA'] },
  { domain: 'ANALITICA', subdomain: 'AUDITS', actions: ['READ', 'AUDIT', 'EXPORT'], recommendedScopes: ['EMPRESA'] },

  { domain: 'IA', subdomain: 'COMMERCIAL_AI', actions: ['READ', 'EXECUTE', 'AUDIT'], recommendedScopes: ['ASSIGNED', 'TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'IA', subdomain: 'OPERATIONAL_AI', actions: ['READ', 'EXECUTE', 'AUDIT'], recommendedScopes: ['TEAM', 'SEDE', 'EMPRESA'] },
  { domain: 'IA', subdomain: 'CREATIVE_AI', actions: ['READ', 'EXECUTE', 'AUDIT'], recommendedScopes: ['SEDE', 'EMPRESA', 'VERTICAL'] },

  { domain: 'VERTICALES', subdomain: 'RESTAURANTE', actions: ['READ', 'CREATE', 'UPDATE', 'EXECUTE'], recommendedScopes: ['SEDE', 'EMPRESA', 'VERTICAL'] },
  { domain: 'VERTICALES', subdomain: 'ODONTOLOGIA', actions: ['READ', 'CREATE', 'UPDATE', 'EXECUTE'], recommendedScopes: ['SEDE', 'EMPRESA', 'VERTICAL'] },
  { domain: 'VERTICALES', subdomain: 'DOTACIONES', actions: ['READ', 'CREATE', 'UPDATE', 'EXECUTE'], recommendedScopes: ['SEDE', 'EMPRESA', 'VERTICAL'] },
]

export const LEGACY_MODULE_TO_RBAC_V2: LegacyModuleMapping[] = [
  { moduleKey: 'DASHBOARD', targets: [{ domain: 'CORE', subdomains: ['DASHBOARD', 'PRODUCT_MAP', 'TEMPLATES'] }] },
  { moduleKey: 'CONFIG', targets: [{ domain: 'CORE', subdomains: ['COMPANY', 'USERS', 'ROLES', 'PLANS', 'WEB_SERVICES'] }] },
  { moduleKey: 'CRM', targets: [{ domain: 'CAPTACION', subdomains: ['INBOX', 'CHANNELS', 'LEADS', 'OPPORTUNITIES', 'CONTACTS', 'ACTIVITIES', 'AGENDA', 'COMMERCIAL_TASKS'] }, { domain: 'OPERACIONES', subdomains: ['PROJECTS', 'FILES', 'TASK_WORKSPACES'] }, { domain: 'IA', subdomains: ['COMMERCIAL_AI'] }] },
  { moduleKey: 'COTIZADOR', targets: [{ domain: 'VENTAS', subdomains: ['QUOTER'] }, { domain: 'OPERACIONES', subdomains: ['WORK_ORDERS'] }, { domain: 'IA', subdomains: ['OPERATIONAL_AI', 'CREATIVE_AI'] }, { domain: 'VERTICALES', subdomains: ['DOTACIONES'] }] },
  { moduleKey: 'COTIZACIONES', targets: [{ domain: 'VENTAS', subdomains: ['QUOTES'] }] },
  { moduleKey: 'REMISIONES', targets: [{ domain: 'VENTAS', subdomains: ['DELIVERY_NOTES'] }] },
  { moduleKey: 'POS', targets: [{ domain: 'VENTAS', subdomains: ['POS'] }, { domain: 'FINANZAS', subdomains: ['INVOICING'] }, { domain: 'VERTICALES', subdomains: ['RESTAURANTE'] }] },
  { moduleKey: 'CLIENTES', targets: [{ domain: 'VENTAS', subdomains: ['CUSTOMERS'] }, { domain: 'VERTICALES', subdomains: ['ODONTOLOGIA'] }] },
  { moduleKey: 'ORDENES', targets: [{ domain: 'OPERACIONES', subdomains: ['WORK_ORDERS', 'INTERNAL_CHAT'] }] },
  { moduleKey: 'MATERIALES', targets: [{ domain: 'RECURSOS', subdomains: ['PRODUCTS', 'MATERIALS'] }] },
  { moduleKey: 'INVENTARIO', targets: [{ domain: 'RECURSOS', subdomains: ['INVENTORY', 'TRANSFERS'] }] },
  { moduleKey: 'COMPRAS', targets: [{ domain: 'RECURSOS', subdomains: ['PURCHASES'] }] },
  { moduleKey: 'PROVEEDORES', targets: [{ domain: 'RECURSOS', subdomains: ['SUPPLIERS'] }] },
  { moduleKey: 'ESCANEOS', targets: [{ domain: 'OPERACIONES', subdomains: ['DOCUMENT_CAPTURE'] }] },
  { moduleKey: 'CONTABILIDAD', targets: [{ domain: 'FINANZAS', subdomains: ['ACCOUNTING', 'PAYROLL'] }] },
  { moduleKey: 'REPORTES', targets: [{ domain: 'ANALITICA', subdomains: ['REPORTS', 'INTELLIGENCE', 'AUDITS'] }] },
  { moduleKey: 'NOTIFICACIONES', targets: [{ domain: 'CORE', subdomains: ['DASHBOARD'] }] },
]

export function buildRbacV2CapabilityId(args: {
  domain: RbacV2Domain
  subdomain: string
  action: RbacV2CapabilityAction
}) {
  return `${args.domain}.${args.subdomain}.${args.action}`
}

export function getLegacyModuleRbacV2Mapping(moduleKey: string) {
  return LEGACY_MODULE_TO_RBAC_V2.find((item) => item.moduleKey === moduleKey) ?? null
}

export function listCapabilitiesForDomain(domain: RbacV2Domain) {
  return RBAC_V2_CAPABILITY_CATALOG.filter((item) => item.domain === domain)
}