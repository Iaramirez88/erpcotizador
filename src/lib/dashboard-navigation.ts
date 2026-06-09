import {
  DASHBOARD_NAV_CATALOG,
  DASHBOARD_PATH_MODULE_OVERRIDES,
  DASHBOARD_SECTION_ORDER,
  type DashboardSectionTitle,
} from '@/lib/product-architecture'

export type DashboardNavDefinition = {
  name: string
  href: string
}

function getDashboardNavCatalogItem(href: string) {
  return DASHBOARD_NAV_CATALOG.find((item) => item.href === href) ?? null
}

function getLongestPrefixDashboardItem(pathname: string) {
  return [...DASHBOARD_NAV_CATALOG]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => item.href !== '/dashboard' && pathname.startsWith(item.href)) ?? null
}

export function isOnboardingScopedDashboardHref(href: string): boolean {
  return getDashboardNavCatalogItem(href)?.onboardingScoped === true
}

export function sectionForDashboardHref(href: string): string {
  return getDashboardNavCatalogItem(href)?.section ?? 'Otros'
}

export function moduleForDashboardHref(href: string): string | null {
  return getDashboardNavCatalogItem(href)?.moduleKey ?? null
}

export function moduleForDashboardPath(pathname: string): string | null {
  const override = DASHBOARD_PATH_MODULE_OVERRIDES.find((item) => pathname.startsWith(item.prefix))
  if (override) return override.moduleKey
  if (pathname === '/dashboard') return 'DASHBOARD'

  const exactMatch = getDashboardNavCatalogItem(pathname)
  if (exactMatch) return exactMatch.moduleKey

  return getLongestPrefixDashboardItem(pathname)?.moduleKey ?? null
}

export function buildDashboardNavDefinitions(t: (key: string) => string): DashboardNavDefinition[] {
  return DASHBOARD_NAV_CATALOG.map((item) => ({
    name: item.labelKey ? t(item.labelKey) : item.label,
    href: item.href,
  }))
}

export function getDashboardSectionOrder(): DashboardSectionTitle[] {
  return DASHBOARD_SECTION_ORDER
}