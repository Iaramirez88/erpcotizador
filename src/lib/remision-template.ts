export type RemisionPageSize = 'A4' | 'LETTER' | 'LEGAL'
export type RemisionOrientation = 'portrait' | 'landscape'
export type RemisionFontFamily = 'Helvetica' | 'Times-Roman' | 'Courier'

export type PageSideSpacing = {
  top: number
  right: number
  bottom: number
  left: number
}

export type RemisionTemplateSettings = {
  page: {
    size: RemisionPageSize
    orientation: RemisionOrientation
    /**
     * Compatibilidad: valor legacy que antes se usaba como padding general.
     * En el PDF se usa como fallback para el margen externo si no existe `marginSides`.
     */
    padding: number
    marginHorizontal: number
    marginVertical: number
    /** Espaciado externo (margen) por lado del contenido */
    marginSides?: PageSideSpacing
    /** Espaciado interno (padding) por lado del contenido */
    paddingSides?: PageSideSpacing
  }
  colors: {
    primary: string
    pageBackground: string
    text: string
    mutedText: string
    sectionBackground: string
    tableHeaderBackground: string
    tableHeaderText: string
    tableBorder: string
    border: string
    background: string
  }
  typography: {
    fontFamily: RemisionFontFamily
    baseFontSize: number
    titleFontSize: number
    sectionTitleFontSize: number
  }
  header: {
    title: string
    companyName: string
    subtitle1: string
    subtitle2: string
    logo?: string
    logoUrl?: string
    showLogo: boolean
    customText?: string
  }
  footer: {
    showTimestamp: boolean
    showPageNumbers: boolean
    customText: string
  }
  sections: {
    showWarehouse: boolean
    showCliente: boolean
    showCreatedBy: boolean
    showObservaciones: boolean
  }
}

export const DEFAULT_REMISION_TEMPLATE: RemisionTemplateSettings = {
  page: {
    size: 'A4',
    orientation: 'portrait',
    padding: 40,
    marginHorizontal: 40,
    marginVertical: 40,
    marginSides: { top: 40, right: 40, bottom: 40, left: 40 },
    paddingSides: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  colors: {
    primary: '#2563eb',
    pageBackground: '#ffffff',
    text: '#1f2937',
    mutedText: '#6b7280',
    sectionBackground: '#f9fafb',
    tableHeaderBackground: '#2563eb',
    tableHeaderText: '#ffffff',
    tableBorder: '#e5e7eb',
    border: '#e5e7eb',
    background: '#f9fafb',
  },
  typography: {
    fontFamily: 'Helvetica',
    baseFontSize: 10,
    titleFontSize: 22,
    sectionTitleFontSize: 12,
  },
  header: {
    title: 'REMISIÓN',
    companyName: 'SGDigital Softwares',
    subtitle1: '',
    subtitle2: '',
    logo: undefined,
    logoUrl: undefined,
    showLogo: true,
    customText: '',
  },
  footer: {
    showTimestamp: true,
    showPageNumbers: true,
    customText: 'SGDigital Softwares © 2026',
  },
  sections: {
    showWarehouse: true,
    showCliente: true,
    showCreatedBy: true,
    showObservaciones: true,
  },
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function readSideSpacing(input: unknown, fallback: PageSideSpacing, min: number, max: number): PageSideSpacing {
  if (!isPlainObject(input)) return fallback
  return {
    top: clamp(asNumber(input.top, fallback.top), min, max),
    right: clamp(asNumber(input.right, fallback.right), min, max),
    bottom: clamp(asNumber(input.bottom, fallback.bottom), min, max),
    left: clamp(asNumber(input.left, fallback.left), min, max),
  }
}

export function mergeRemisionTemplateSettings(custom: unknown): RemisionTemplateSettings {
  const defaults = DEFAULT_REMISION_TEMPLATE
  if (!isPlainObject(custom)) return defaults

  const page = isPlainObject(custom.page) ? custom.page : {}
  const colors = isPlainObject(custom.colors) ? custom.colors : {}
  const typography = isPlainObject(custom.typography) ? custom.typography : {}
  const header = isPlainObject(custom.header) ? custom.header : {}
  const footer = isPlainObject(custom.footer) ? custom.footer : {}
  const sections = isPlainObject(custom.sections) ? custom.sections : {}

  const size = asString(page.size, defaults.page.size) as RemisionPageSize
  const orientation = asString(page.orientation, defaults.page.orientation) as RemisionOrientation
  const fontFamily = asString(typography.fontFamily, defaults.typography.fontFamily) as RemisionFontFamily

  const legacyPadding = clamp(asNumber(page.padding, defaults.page.padding), 0, 120)
  const marginHorizontal = clamp(asNumber(page.marginHorizontal, defaults.page.marginHorizontal), 0, 120)
  const marginVertical = clamp(asNumber(page.marginVertical, defaults.page.marginVertical), 0, 120)

  const fallbackMarginSides: PageSideSpacing = {
    top: marginVertical,
    right: marginHorizontal,
    bottom: marginVertical,
    left: marginHorizontal,
  }

  const normalized: RemisionTemplateSettings = {
    page: {
      size: ['A4', 'LETTER', 'LEGAL'].includes(size) ? size : defaults.page.size,
      orientation: ['portrait', 'landscape'].includes(orientation) ? orientation : defaults.page.orientation,
      padding: legacyPadding,
      marginHorizontal,
      marginVertical,
      marginSides: readSideSpacing(page.marginSides, fallbackMarginSides, 0, 120),
      paddingSides: readSideSpacing(page.paddingSides, defaults.page.paddingSides ?? { top: 0, right: 0, bottom: 0, left: 0 }, 0, 120),
    },
    colors: {
      primary: asString(colors.primary, defaults.colors.primary),
      pageBackground: asString(colors.pageBackground, defaults.colors.pageBackground),
      text: asString(colors.text, defaults.colors.text),
      mutedText: asString(colors.mutedText, defaults.colors.mutedText),
      sectionBackground: asString(colors.sectionBackground, defaults.colors.sectionBackground),
      tableHeaderBackground: asString(colors.tableHeaderBackground, defaults.colors.tableHeaderBackground),
      tableHeaderText: asString(colors.tableHeaderText, defaults.colors.tableHeaderText),
      tableBorder: asString(colors.tableBorder, defaults.colors.tableBorder),
      border: asString(colors.border, defaults.colors.border),
      background: asString(colors.background, defaults.colors.background),
    },
    typography: {
      fontFamily: ['Helvetica', 'Times-Roman', 'Courier'].includes(fontFamily) ? fontFamily : defaults.typography.fontFamily,
      baseFontSize: clamp(asNumber(typography.baseFontSize, defaults.typography.baseFontSize), 8, 14),
      titleFontSize: clamp(asNumber(typography.titleFontSize, defaults.typography.titleFontSize), 16, 40),
      sectionTitleFontSize: clamp(asNumber(typography.sectionTitleFontSize, defaults.typography.sectionTitleFontSize), 10, 18),
    },
    header: {
      title: asString(header.title, defaults.header.title),
      companyName: asString(header.companyName, defaults.header.companyName),
      subtitle1: asString(header.subtitle1, defaults.header.subtitle1),
      subtitle2: asString(header.subtitle2, defaults.header.subtitle2),
      logo: typeof header.logo === 'string' ? header.logo : defaults.header.logo,
      logoUrl: typeof header.logoUrl === 'string' ? header.logoUrl : defaults.header.logoUrl,
      showLogo: asBoolean(header.showLogo, defaults.header.showLogo),
      customText: asString(header.customText, defaults.header.customText ?? ''),
    },
    footer: {
      showTimestamp: asBoolean(footer.showTimestamp, defaults.footer.showTimestamp),
      showPageNumbers: asBoolean(footer.showPageNumbers, defaults.footer.showPageNumbers),
      customText: asString(footer.customText, defaults.footer.customText),
    },
    sections: {
      showWarehouse: asBoolean(sections.showWarehouse, defaults.sections.showWarehouse),
      showCliente: asBoolean(sections.showCliente, defaults.sections.showCliente),
      showCreatedBy: asBoolean(sections.showCreatedBy, defaults.sections.showCreatedBy),
      showObservaciones: asBoolean(sections.showObservaciones, defaults.sections.showObservaciones),
    },
  }

  // Compatibilidad: si no existían márgenes configurados, usar padding legacy como margen
  const marginSidesProvided = isPlainObject(page.marginSides)
  const marginLegacyProvided = typeof page.marginHorizontal === 'number' || typeof page.marginVertical === 'number'
  if (!marginSidesProvided && !marginLegacyProvided) {
    normalized.page.marginSides = {
      top: legacyPadding,
      right: legacyPadding,
      bottom: legacyPadding,
      left: legacyPadding,
    }
  }

  return normalized
}
