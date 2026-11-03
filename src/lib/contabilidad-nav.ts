export type ContabilidadNavItem = {
  labelKey: string
  href: string
  shortLabelKey?: string
  descriptionKey: string
  primary?: boolean
}

export const CONTABILIDAD_NAV_ITEMS: ContabilidadNavItem[] = [
  {
    labelKey: 'contabilidad.nav.resumen',
    href: '/dashboard/contabilidad',
    descriptionKey: 'contabilidad.nav.resumen.description',
    primary: true,
  },
  {
    labelKey: 'contabilidad.nav.comprobantes',
    href: '/dashboard/contabilidad/comprobantes',
    shortLabelKey: 'contabilidad.nav.comprobantes.short',
    descriptionKey: 'contabilidad.nav.comprobantes.description',
    primary: true,
  },
  {
    labelKey: 'contabilidad.nav.libros',
    href: '/dashboard/contabilidad/libros',
    descriptionKey: 'contabilidad.nav.libros.description',
    primary: true,
  },
  {
    labelKey: 'contabilidad.nav.estados',
    href: '/dashboard/contabilidad/estados-financieros',
    shortLabelKey: 'contabilidad.nav.estados.short',
    descriptionKey: 'contabilidad.nav.estados.description',
    primary: true,
  },
  {
    labelKey: 'contabilidad.nav.tesoreria',
    href: '/dashboard/contabilidad/tesoreria',
    descriptionKey: 'contabilidad.nav.tesoreria.description',
    primary: true,
  },
  {
    labelKey: 'contabilidad.nav.conciliaciones',
    href: '/dashboard/contabilidad/conciliaciones',
    shortLabelKey: 'contabilidad.nav.conciliaciones.short',
    descriptionKey: 'contabilidad.nav.conciliaciones.description',
    primary: true,
  },
  {
    labelKey: 'contabilidad.nav.impuestos',
    href: '/dashboard/contabilidad/impuestos',
    descriptionKey: 'contabilidad.nav.impuestos.description',
  },
  {
    labelKey: 'contabilidad.nav.cierres',
    href: '/dashboard/contabilidad/cierres',
    descriptionKey: 'contabilidad.nav.cierres.description',
  },
  {
    labelKey: 'contabilidad.nav.planCuentas',
    href: '/dashboard/contabilidad/plan-de-cuentas',
    shortLabelKey: 'contabilidad.nav.planCuentas.short',
    descriptionKey: 'contabilidad.nav.planCuentas.description',
  },
  {
    labelKey: 'contabilidad.nav.centros',
    href: '/dashboard/contabilidad/centros-de-costo',
    descriptionKey: 'contabilidad.nav.centros.description',
  },
  {
    labelKey: 'contabilidad.nav.reglas',
    href: '/dashboard/contabilidad/reglas',
    descriptionKey: 'contabilidad.nav.reglas.description',
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

