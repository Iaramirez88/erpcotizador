const DASHBOARD_LAST_ROUTE_KEY_PREFIX = 'sg_dashboard_last_route:'

export function getDashboardLastRouteStorageKey(userId: string) {
  return `${DASHBOARD_LAST_ROUTE_KEY_PREFIX}${userId}`
}

export function isPersistableDashboardRoute(pathname: string) {
  return pathname.startsWith('/dashboard') && pathname !== '/dashboard'
}

export function isSafeDashboardRoute(href: string) {
  return href.startsWith('/dashboard/') && !href.startsWith('//')
}
