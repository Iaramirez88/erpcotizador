export const NOMINA_BASE_PATH = '/dashboard/nomina'
export const NOMINA_LEGACY_BASE_PATH = '/dashboard/contabilidad/nomina'

export function nominaHref(segment = '') {
  const cleaned = segment.replace(/^\/+/, '')
  return cleaned ? `${NOMINA_BASE_PATH}/${cleaned}` : NOMINA_BASE_PATH
}

export function normalizeNominaPathname(pathname: string) {
  if (pathname === NOMINA_LEGACY_BASE_PATH) return NOMINA_BASE_PATH
  if (pathname.startsWith(`${NOMINA_LEGACY_BASE_PATH}/`)) {
    return `${NOMINA_BASE_PATH}${pathname.slice(NOMINA_LEGACY_BASE_PATH.length)}`
  }
  return pathname
}