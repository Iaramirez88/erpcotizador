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

function normalizeDashboardHref(href: string) {
  return href.split('#', 1)[0]?.split('?', 1)[0] ?? href
}

function getDashboardNavCatalogItem(href: string) {
  const normalizedHref = normalizeDashboardHref(href)
  return DASHBOARD_NAV_CATALOG.find((item) => item.href === normalizedHref) ?? null
}

function getLongestPrefixDashboardItem(pathname: string) {
  const normalizedPathname = normalizeDashboardHref(pathname)
  return [...DASHBOARD_NAV_CATALOG]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => item.href !== '/dashboard' && normalizedPathname.startsWith(item.href)) ?? null
}

function getDashboardNavItemForPath(pathname: string) {
  const normalizedPathname = normalizeDashboardHref(pathname)
  if (normalizedPathname === '/dashboard') return getDashboardNavCatalogItem('/dashboard')

  const exactMatch = getDashboardNavCatalogItem(normalizedPathname)
  if (exactMatch) return exactMatch

  return getLongestPrefixDashboardItem(normalizedPathname)
}

export function isOnboardingScopedDashboardHref(href: string): boolean {
  return getDashboardNavCatalogItem(href)?.onboardingScoped === true
}

export function sectionForDashboardHref(href: string): string {
  return getDashboardNavCatalogItem(href)?.section ?? 'Otros'
}

const DASHBOARD_SECTION_LABEL_KEYS: Record<string, string> = {
  Inicio: 'nav.section.home',
  Captación: 'nav.section.acquisition',
  Ventas: 'nav.section.sales',
  Operaciones: 'nav.section.operations',
  Inventario: 'nav.section.inventory',
  Compras: 'nav.section.purchases',
  Finanzas: 'nav.section.finance',
  Analítica: 'nav.section.analytics',
  IA: 'nav.section.ai',
  Verticales: 'nav.section.verticals',
  Configuración: 'nav.section.settings',
  Administración: 'nav.section.admin',
  Otros: 'nav.section.other',
}

export function dashboardSectionLabel(t: (key: string) => string, section: string): string {
  if (section === 'Captación') return t('nav.crm')
  if (section === 'Recursos') return t('nav.section.inventory')
  const key = DASHBOARD_SECTION_LABEL_KEYS[section]
  return key ? t(key) : section
}

export function moduleForDashboardHref(href: string): string | null {
  return getDashboardNavCatalogItem(href)?.moduleKey ?? null
}

export function moduleForDashboardPath(pathname: string): string | null {
  const normalizedPathname = normalizeDashboardHref(pathname)
  const override = DASHBOARD_PATH_MODULE_OVERRIDES.find((item) => normalizedPathname.startsWith(item.prefix))
  if (override) return override.moduleKey
  if (normalizedPathname === '/dashboard') return 'DASHBOARD'

  const exactMatch = getDashboardNavCatalogItem(normalizedPathname)
  if (exactMatch) return exactMatch.moduleKey

  return getLongestPrefixDashboardItem(normalizedPathname)?.moduleKey ?? null
}

export function labelForDashboardPath(t: (key: string) => string, pathname: string): string {
  const item = getDashboardNavItemForPath(pathname)
  if (!item) return t('permissionBoundary.unknownSection')
  return item.labelKey ? t(item.labelKey) : item.label
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