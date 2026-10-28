export type ContabilidadNavItem = {
  label: string
  href: string
  shortLabel?: string
  description: string
  primary?: boolean
}

export const CONTABILIDAD_NAV_ITEMS: ContabilidadNavItem[] = [
  {
    label: 'Resumen',
    href: '/dashboard/contabilidad',
    description: 'Tablero contable y estado del motor',
    primary: true,
  },
  {
    label: 'Comprobantes',
    href: '/dashboard/contabilidad/comprobantes',
    shortLabel: 'Comprob.',
    description: 'Registro y aprobación de asientos',
    primary: true,
  },
  {
    label: 'Libros',
    href: '/dashboard/contabilidad/libros',
    description: 'Diario, mayor y auxiliares',
    primary: true,
  },
  {
    label: 'Estados financieros',
    href: '/dashboard/contabilidad/estados-financieros',
    shortLabel: 'Estados',
    description: 'ESF, ERI y balance de prueba',
    primary: true,
  },
  {
    label: 'Tesorería',
    href: '/dashboard/contabilidad/tesoreria',
    description: 'Bancos y movimientos',
    primary: true,
  },
  {
    label: 'Conciliaciones',
    href: '/dashboard/contabilidad/conciliaciones',
    shortLabel: 'Conciliar',
    description: 'Cierre de cortes bancarios',
    primary: true,
  },
  {
    label: 'Impuestos',
    href: '/dashboard/contabilidad/impuestos',
    description: 'IVA, retenciones y calendario',
  },
  {
    label: 'Cierres',
    href: '/dashboard/contabilidad/cierres',
    description: 'Cierre y bloqueo de períodos',
  },
  {
    label: 'Plan de cuentas',
    href: '/dashboard/contabilidad/plan-de-cuentas',
    shortLabel: 'Cuentas',
    description: 'PUC y jerarquía de cuentas',
  },
  {
    label: 'Centros',
    href: '/dashboard/contabilidad/centros-de-costo',
    description: 'Centros de costo',
  },
  {
    label: 'Reglas',
    href: '/dashboard/contabilidad/reglas',
    description: 'Automatización de asientos',
  },
]

export const CONTABILIDAD_NAV_MAX_VISIBLE = 8

const NAV_ORDER = new Map(CONTABILIDAD_NAV_ITEMS.map((item, index) => [item.href, index]))

export function isContabilidadNavItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard/contabilidad') {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Limpia una lista de anclas recibida desde el cliente, localStorage o la API:
 * descarta valores que no son texto, hrefs fuera del catálogo y duplicados.
 * Se usa tanto en el navegador como en el servidor para que ambos lados
 * compartan exactamente la misma validación.
 */
export function sanitizeContabilidadNavPinnedHrefs(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const known = new Set(CONTABILIDAD_NAV_ITEMS.map((item) => item.href))
  const result: string[] = []

  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const href = entry.trim()
    if (!href || !known.has(href) || result.includes(href)) continue
    result.push(href)
  }

  return result
}

export type ContabilidadSubnavResolution = {
  activeItem: ContabilidadNavItem | null
  visibleItems: ContabilidadNavItem[]
  overflowItems: ContabilidadNavItem[]
}

/**
 * Resuelve qué secciones se muestran directamente en la barra y cuáles quedan
 * dentro del menú "más". Reglas:
 * - La sección activa siempre es visible.
 * - Las secciones ancladas por el usuario siempre son visibles.
 * - El resto de la barra se completa con las secciones primarias (máx. 6)
 *   hasta llegar al tope de `CONTABILIDAD_NAV_MAX_VISIBLE`.
 */
export function resolveContabilidadSubnav(params: {
  pathname: string
  pinnedHrefs: readonly string[]
}): ContabilidadSubnavResolution {
  const { pathname, pinnedHrefs } = params
  const pinned = new Set(pinnedHrefs)
  const activeItem = CONTABILIDAD_NAV_ITEMS.find((item) => isContabilidadNavItemActive(pathname, item.href)) ?? null
  const visible: ContabilidadNavItem[] = []

  for (const item of CONTABILIDAD_NAV_ITEMS) {
    if (activeItem?.href === item.href || pinned.has(item.href)) {
      visible.push(item)
    }
  }

  for (const item of CONTABILIDAD_NAV_ITEMS) {
    if (visible.length >= CONTABILIDAD_NAV_MAX_VISIBLE) break
    if (!item.primary) continue
    if (visible.some((entry) => entry.href === item.href)) continue
    visible.push(item)
  }

  visible.sort((a, b) => (NAV_ORDER.get(a.href) ?? 0) - (NAV_ORDER.get(b.href) ?? 0))

  const visibleHrefs = new Set(visible.map((item) => item.href))

  return {
    activeItem,
    visibleItems: visible,
    overflowItems: CONTABILIDAD_NAV_ITEMS.filter((item) => !visibleHrefs.has(item.href)),
  }
}

