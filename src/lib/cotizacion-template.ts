export type CotizacionPageSize = 'A4' | 'LETTER' | 'LEGAL'
export type CotizacionOrientation = 'portrait' | 'landscape'
export type CotizacionFontFamily = 'Helvetica' | 'Times-Roman' | 'Courier'

export type CotizacionTemplateSettings = {
  page: {
    size: CotizacionPageSize
    orientation: CotizacionOrientation
    padding: number
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
    warningBackground: string
    warningBorder: string
  }
  typography: {
    fontFamily: CotizacionFontFamily
    baseFontSize: number
    titleFontSize: number
    sectionTitleFontSize: number
  }
  header: {
    title: string
    companyName: string
    subtitle1: string
    subtitle2: string
    logoUrl?: string
    showLogo: boolean
  }
  watermark: {
    enabled: boolean
    text: string
    color: string
    opacity: number
    fontSize: number
    rotateDeg: number
  }
  footer: {
    text: string
  }
  toggles: {
    showVendedor: boolean
    showClienteEmail: boolean
    showClienteTelefono: boolean
    showClienteEmpresa: boolean
    showEstado: boolean
    showObservaciones: boolean
  }
  currency: {
    locale: string
    currency: string
  }
}

export const DEFAULT_COTIZACION_TEMPLATE: CotizacionTemplateSettings = {
  page: { size: 'A4', orientation: 'portrait', padding: 40 },
  colors: {
    primary: '#2563eb',
    pageBackground: '#ffffff',
    text: '#1e293b',
    mutedText: '#64748b',
    sectionBackground: '#f1f5f9',
    tableHeaderBackground: '#2563eb',
    tableHeaderText: '#ffffff',
    tableBorder: '#e2e8f0',
    warningBackground: '#fef3c7',
    warningBorder: '#f59e0b',
  },
  typography: {
    fontFamily: 'Helvetica',
    baseFontSize: 10,
    titleFontSize: 24,
    sectionTitleFontSize: 12,
  },
  header: {
    title: 'COTIZACIÓN',
    companyName: 'SGDigital Softwares',
    subtitle1: 'Soluciones de Impresión Digital',
    subtitle2: '',
    showLogo: false,
  },
  watermark: {
    enabled: false,
    text: 'COTIZACIÓN',
    color: '#111827',
    opacity: 0.08,
    fontSize: 64,
    rotateDeg: -35,
  },
  footer: {
    text: 'Gracias por confiar en nosotros. Esta cotización está sujeta a cambios según especificaciones finales.',
  },
  toggles: {
    showVendedor: true,
    showClienteEmail: true,
    showClienteTelefono: true,
    showClienteEmpresa: true,
    showEstado: true,
    showObservaciones: true,
  },
  currency: {
    locale: 'es-MX',
    currency: 'MXN',
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

export function mergeCotizacionTemplateSettings(input: unknown): CotizacionTemplateSettings {
  const defaults = DEFAULT_COTIZACION_TEMPLATE
  if (!isPlainObject(input)) return defaults

  const page = isPlainObject(input.page) ? input.page : {}
  const colors = isPlainObject(input.colors) ? input.colors : {}
  const typography = isPlainObject(input.typography) ? input.typography : {}
  const header = isPlainObject(input.header) ? input.header : {}
  const watermark = isPlainObject(input.watermark) ? input.watermark : {}
  const footer = isPlainObject(input.footer) ? input.footer : {}
  const toggles = isPlainObject(input.toggles) ? input.toggles : {}
  const currency = isPlainObject(input.currency) ? input.currency : {}

  const size = asString(page.size, defaults.page.size) as CotizacionPageSize
  const orientation = asString(page.orientation, defaults.page.orientation) as CotizacionOrientation
  const fontFamily = asString(typography.fontFamily, defaults.typography.fontFamily) as CotizacionFontFamily

  const normalized: CotizacionTemplateSettings = {
    page: {
      size: ['A4', 'LETTER', 'LEGAL'].includes(size) ? size : defaults.page.size,
      orientation: ['portrait', 'landscape'].includes(orientation) ? orientation : defaults.page.orientation,
      padding: clamp(asNumber(page.padding, defaults.page.padding), 12, 80),
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
      warningBackground: asString(colors.warningBackground, defaults.colors.warningBackground),
      warningBorder: asString(colors.warningBorder, defaults.colors.warningBorder),
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
      logoUrl: typeof header.logoUrl === 'string' ? header.logoUrl : defaults.header.logoUrl,
      showLogo: asBoolean(header.showLogo, defaults.header.showLogo),
    },
    watermark: {
      enabled: asBoolean(watermark.enabled, defaults.watermark.enabled),
      text: asString(watermark.text, defaults.watermark.text),
      color: asString(watermark.color, defaults.watermark.color),
      opacity: clamp(asNumber(watermark.opacity, defaults.watermark.opacity), 0, 0.25),
      fontSize: clamp(asNumber(watermark.fontSize, defaults.watermark.fontSize), 24, 120),
      rotateDeg: clamp(asNumber(watermark.rotateDeg, defaults.watermark.rotateDeg), -90, 90),
    },
    footer: {
      text: asString(footer.text, defaults.footer.text),
    },
    toggles: {
      showVendedor: asBoolean(toggles.showVendedor, defaults.toggles.showVendedor),
      showClienteEmail: asBoolean(toggles.showClienteEmail, defaults.toggles.showClienteEmail),
      showClienteTelefono: asBoolean(toggles.showClienteTelefono, defaults.toggles.showClienteTelefono),
      showClienteEmpresa: asBoolean(toggles.showClienteEmpresa, defaults.toggles.showClienteEmpresa),
      showEstado: asBoolean(toggles.showEstado, defaults.toggles.showEstado),
      showObservaciones: asBoolean(toggles.showObservaciones, defaults.toggles.showObservaciones),
    },
    currency: {
      locale: asString(currency.locale, defaults.currency.locale),
      currency: asString(currency.currency, defaults.currency.currency),
    },
  }

  return normalized
}
