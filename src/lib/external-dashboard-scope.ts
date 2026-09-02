export const EXTERNAL_DASHBOARD_SCOPE_COOKIE = 'ordex_external_dashboard_scope'
export const EXTERNAL_DASHBOARD_SCOPE_ROP_ONBOARDING = 'rop_onboarding'

const EXTERNAL_ROP_ALLOWED_MODULES = ['DASHBOARD', 'NOTIFICACIONES'] as const

const EXTERNAL_ROP_ALLOWED_HREFS = [
  '/dashboard',
  '/dashboard/rop',
  '/dashboard/rop/activar',
  '/dashboard/rop/perfil',
  '/dashboard/rop/empresas',
  '/dashboard/rop/necesidades',
  '/dashboard/perfil',
  '/dashboard/notificaciones',
  '/dashboard/ayuda',
] as const

export function getExternalDashboardScopeAllowedHrefs(scope: string | null | undefined): string[] | null {
  if (scope !== EXTERNAL_DASHBOARD_SCOPE_ROP_ONBOARDING) return null
  return [...EXTERNAL_ROP_ALLOWED_HREFS]
}

export function intersectDashboardHrefsWithExternalScope(args: {
  hrefs: string[] | null
  scope: string | null | undefined
}): string[] | null {
  const scopedAllowedHrefs = getExternalDashboardScopeAllowedHrefs(args.scope)
  if (!scopedAllowedHrefs) return args.hrefs
  if (!args.hrefs?.length) return scopedAllowedHrefs

  const scopedSet = new Set(scopedAllowedHrefs)
  return args.hrefs.filter((href) => scopedSet.has(href))
}

export function shouldApplyExternalDashboardScope(scope: string | null | undefined): boolean {
  return scope === EXTERNAL_DASHBOARD_SCOPE_ROP_ONBOARDING
}

export function isModuleAllowedForExternalDashboardScope(args: {
  moduleKey: string
  scope: string | null | undefined
}): boolean {
  if (args.scope !== EXTERNAL_DASHBOARD_SCOPE_ROP_ONBOARDING) return true
  return EXTERNAL_ROP_ALLOWED_MODULES.includes(args.moduleKey as (typeof EXTERNAL_ROP_ALLOWED_MODULES)[number])
}

export function isCapabilityAllowedForExternalDashboardScope(args: {
  scope: string | null | undefined
  domain: string
  subdomain: string
}): boolean {
  if (args.scope !== EXTERNAL_DASHBOARD_SCOPE_ROP_ONBOARDING) return true

  return args.domain === 'CORE' && args.subdomain === 'ROP'
}