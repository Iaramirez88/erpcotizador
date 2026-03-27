export type PosInvoicePageSize = 'A4' | 'LETTER' | 'LEGAL'
export type PosInvoiceOrientation = 'portrait' | 'landscape'
export type PosInvoiceFontFamily = 'Helvetica' | 'Times-Roman' | 'Courier'

export type PosInvoiceSideSpacing = {
  top: number
  right: number
  bottom: number
  left: number
}

export type PosInvoiceTemplateSettings = {
  page: {
    size: PosInvoicePageSize
    orientation: PosInvoiceOrientation
    padding: number
    marginHorizontal: number
    marginVertical: number
    marginSides?: PosInvoiceSideSpacing
    paddingSides?: PosInvoiceSideSpacing
  }
  colors: {
    primary: string
    secondary: string
    pageBackground: string
    text: string
    mutedText: string
    sectionBackground: string
    tableHeaderBackground: string
    tableHeaderText: string
    tableBorder: string
    border: string
    highlightBackground: string
  }
  typography: {
    fontFamily: PosInvoiceFontFamily
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
    showCustomerDocument: boolean
    showWarehouse: boolean
    showNotes: boolean
    showPayments: boolean
    showTotals: boolean
    showStatusBadge: boolean
  }
}

export const DEFAULT_POS_INVOICE_TEMPLATE: PosInvoiceTemplateSettings = {
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
    primary: '#f97316',
    secondary: '#fb923c',
    pageBackground: '#ffffff',
    text: '#111827',
    mutedText: '#6b7280',
    sectionBackground: '#fff7ed',
    tableHeaderBackground: '#f97316',
    tableHeaderText: '#ffffff',
    tableBorder: '#fed7aa',
    border: '#fdba74',
    highlightBackground: '#fff1e6',
  },
  typography: {
    fontFamily: 'Helvetica',
    baseFontSize: 10,
    titleFontSize: 22,
    sectionTitleFontSize: 12,
  },
  header: {
    title: 'FACTURA DE VENTA',
    companyName: 'SGDigital Softwares',
    subtitle1: 'Documento interno POS',
    subtitle2: 'Soporte comercial y de recaudo',
    logo: undefined,
    logoUrl: undefined,
    showLogo: true,
    customText: '',
  },
  footer: {
    showTimestamp: true,
    showPageNumbers: true,
    customText: 'Gracias por su compra',
  },
  sections: {
    showCustomerDocument: true,
    showWarehouse: true,
    showNotes: true,
    showPayments: true,
    showTotals: true,
    showStatusBadge: true,
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

function readSideSpacing(input: unknown, fallback: PosInvoiceSideSpacing, min: number, max: number): PosInvoiceSideSpacing {
  if (!isPlainObject(input)) return fallback
  return {
    top: clamp(asNumber(input.top, fallback.top), min, max),
    right: clamp(asNumber(input.right, fallback.right), min, max),
    bottom: clamp(asNumber(input.bottom, fallback.bottom), min, max),
    left: clamp(asNumber(input.left, fallback.left), min, max),
  }
}

export function mergePosInvoiceTemplateSettings(custom: unknown): PosInvoiceTemplateSettings {
  const defaults = DEFAULT_POS_INVOICE_TEMPLATE
  if (!isPlainObject(custom)) return defaults

  const page = isPlainObject(custom.page) ? custom.page : {}
  const colors = isPlainObject(custom.colors) ? custom.colors : {}
  const typography = isPlainObject(custom.typography) ? custom.typography : {}
  const header = isPlainObject(custom.header) ? custom.header : {}
  const footer = isPlainObject(custom.footer) ? custom.footer : {}
  const sections = isPlainObject(custom.sections) ? custom.sections : {}

  const size = asString(page.size, defaults.page.size) as PosInvoicePageSize
  const orientation = asString(page.orientation, defaults.page.orientation) as PosInvoiceOrientation
  const fontFamily = asString(typography.fontFamily, defaults.typography.fontFamily) as PosInvoiceFontFamily

  const legacyPadding = clamp(asNumber(page.padding, defaults.page.padding), 0, 120)
  const marginHorizontal = clamp(asNumber(page.marginHorizontal, defaults.page.marginHorizontal), 0, 120)
  const marginVertical = clamp(asNumber(page.marginVertical, defaults.page.marginVertical), 0, 120)

  const fallbackMarginSides: PosInvoiceSideSpacing = {
    top: marginVertical,
    right: marginHorizontal,
    bottom: marginVertical,
    left: marginHorizontal,
  }

  const normalized: PosInvoiceTemplateSettings = {
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
      secondary: asString(colors.secondary, defaults.colors.secondary),
      pageBackground: asString(colors.pageBackground, defaults.colors.pageBackground),
      text: asString(colors.text, defaults.colors.text),
      mutedText: asString(colors.mutedText, defaults.colors.mutedText),
      sectionBackground: asString(colors.sectionBackground, defaults.colors.sectionBackground),
      tableHeaderBackground: asString(colors.tableHeaderBackground, defaults.colors.tableHeaderBackground),
      tableHeaderText: asString(colors.tableHeaderText, defaults.colors.tableHeaderText),
      tableBorder: asString(colors.tableBorder, defaults.colors.tableBorder),
      border: asString(colors.border, defaults.colors.border),
      highlightBackground: asString(colors.highlightBackground, defaults.colors.highlightBackground),
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
      showCustomerDocument: asBoolean(sections.showCustomerDocument, defaults.sections.showCustomerDocument),
      showWarehouse: asBoolean(sections.showWarehouse, defaults.sections.showWarehouse),
      showNotes: asBoolean(sections.showNotes, defaults.sections.showNotes),
      showPayments: asBoolean(sections.showPayments, defaults.sections.showPayments),
      showTotals: asBoolean(sections.showTotals, defaults.sections.showTotals),
      showStatusBadge: asBoolean(sections.showStatusBadge, defaults.sections.showStatusBadge),
    },
  }

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