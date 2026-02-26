export type CotizacionPageSize = 'A4' | 'LETTER' | 'LEGAL'
export type CotizacionOrientation = 'portrait' | 'landscape'
export type CotizacionFontFamily = 'Helvetica' | 'Times-Roman' | 'Courier'

export type PageSideSpacing = {
  top: number
  right: number
  bottom: number
  left: number
}

export type BlockSide = 'left' | 'right'
export type BlockWidthPct = 25 | 50 | 75 | 100

export type CotizacionTemplateSettings = {
  page: {
    size: CotizacionPageSize
    orientation: CotizacionOrientation
    padding: number
    /**
     * Si está habilitado, se reserva automáticamente espacio superior/inferior
     * para que el área de información ocupe `infoAreaHeightPct` del alto de la página.
     */
    useInfoAreaHeightPct?: boolean
    /**
     * Por defecto 0.75 => el 25% restante se reparte entre header/footer.
     */
    infoAreaHeightPct?: number
    /**
     * Espaciado externo (margen) por lado para el contenido.
     * Si existe, se prioriza sobre `padding`.
     */
    marginSides?: PageSideSpacing
    /**
     * Espaciado interno (padding) por lado para el contenido.
     */
    paddingSides?: PageSideSpacing
    /**
     * Área segura adicional por lado para evitar que el contenido pise el membrete/fondo.
     * Se suma al margen/padding al calcular el layout.
     */
    safeAreaSides?: PageSideSpacing
    backgroundImageUrl?: string
    backgroundImageOpacity: number
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
    right: {
      showLogo: boolean
      logoUrl?: string
      line1: string
      line2: string
      line3: string
      line4: string
      line5: string
    }
  }
  watermark: {
    enabled: boolean
    mode: 'text' | 'image'
    text: string
    imageUrl?: string
    useLogo: boolean
    color: string
    opacity: number
    fontSize: number
    rotateDeg: number
    scale: number
  }
  footer: {
    text: string
    leftText: string
    rightText: string
    bottomOffset: number
    reserveHeight: number
  }
  blocks: {
    vendedor: {
      side: BlockSide
      widthPct: BlockWidthPct
      telefonoOverride?: string
      cargoOverride?: string
    }
    cliente: {
      side: BlockSide
      widthPct: BlockWidthPct
    }
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
  page: {
    size: 'A4',
    orientation: 'portrait',
    padding: 40,
    useInfoAreaHeightPct: true,
    infoAreaHeightPct: 0.75,
    marginSides: { top: 40, right: 40, bottom: 40, left: 40 },
    paddingSides: { top: 0, right: 0, bottom: 0, left: 0 },
    safeAreaSides: { top: 0, right: 0, bottom: 0, left: 0 },
    backgroundImageOpacity: 1,
  },
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
    right: {
      showLogo: false,
      line1: '',
      line2: '',
      line3: '',
      line4: '',
      line5: '',
    },
  },
  watermark: {
    enabled: false,
    mode: 'text',
    text: 'COTIZACIÓN',
    useLogo: false,
    color: '#111827',
    opacity: 0.08,
    fontSize: 64,
    rotateDeg: -35,
    scale: 0.8,
  },
  footer: {
    text: 'Gracias por confiar en nosotros. Esta cotización está sujeta a cambios según especificaciones finales.',
    leftText: 'Gracias por confiar en nosotros. Esta cotización está sujeta a cambios según especificaciones finales.',
    rightText: '',
    bottomOffset: 0,
    reserveHeight: 60,
  },
  blocks: {
    vendedor: {
      side: 'right',
      widthPct: 100,
      telefonoOverride: '',
      cargoOverride: '',
    },
    cliente: {
      side: 'left',
      widthPct: 100,
    },
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
    locale: 'es-CO',
    currency: 'COP',
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

function asBlockSide(value: unknown, fallback: BlockSide): BlockSide {
  const v = typeof value === 'string' ? value : ''
  return v === 'left' || v === 'right' ? v : fallback
}

function asBlockWidthPct(value: unknown, fallback: BlockWidthPct): BlockWidthPct {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (n === 25 || n === 50 || n === 75 || n === 100) return n
  return fallback
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

export function mergeCotizacionTemplateSettings(input: unknown): CotizacionTemplateSettings {
  const defaults = DEFAULT_COTIZACION_TEMPLATE
  if (!isPlainObject(input)) return defaults

  const page = isPlainObject(input.page) ? input.page : {}
  const colors = isPlainObject(input.colors) ? input.colors : {}
  const typography = isPlainObject(input.typography) ? input.typography : {}
  const header = isPlainObject(input.header) ? input.header : {}
  const headerRight = isPlainObject(header.right) ? header.right : {}
  const watermark = isPlainObject(input.watermark) ? input.watermark : {}
  const footer = isPlainObject(input.footer) ? input.footer : {}
  const blocks = isPlainObject(input.blocks) ? input.blocks : {}
  const vendedorBlock = isPlainObject(blocks.vendedor) ? blocks.vendedor : {}
  const clienteBlock = isPlainObject(blocks.cliente) ? blocks.cliente : {}
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
      useInfoAreaHeightPct: asBoolean(
        (page as Record<string, unknown>).useInfoAreaHeightPct,
        defaults.page.useInfoAreaHeightPct ?? false
      ),
      infoAreaHeightPct: clamp(
        asNumber((page as Record<string, unknown>).infoAreaHeightPct, defaults.page.infoAreaHeightPct ?? 0.75),
        0.5,
        0.95
      ),
      marginSides: readSideSpacing(
        page.marginSides,
        // Compatibilidad: usar el padding legacy como margen uniforme
        {
          top: clamp(asNumber(page.padding, defaults.page.padding), 12, 120),
          right: clamp(asNumber(page.padding, defaults.page.padding), 12, 120),
          bottom: clamp(asNumber(page.padding, defaults.page.padding), 12, 120),
          left: clamp(asNumber(page.padding, defaults.page.padding), 12, 120),
        },
        0,
        120
      ),
      paddingSides: readSideSpacing(page.paddingSides, defaults.page.paddingSides ?? { top: 0, right: 0, bottom: 0, left: 0 }, 0, 120),
      safeAreaSides: readSideSpacing(
        (page as Record<string, unknown>).safeAreaSides,
        defaults.page.safeAreaSides ?? { top: 0, right: 0, bottom: 0, left: 0 },
        0,
        250
      ),
      backgroundImageUrl:
        typeof page.backgroundImageUrl === 'string' && page.backgroundImageUrl.trim()
          ? page.backgroundImageUrl.trim()
          : defaults.page.backgroundImageUrl,
      backgroundImageOpacity: clamp(asNumber(page.backgroundImageOpacity, defaults.page.backgroundImageOpacity), 0, 1),
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
      right: {
        showLogo: asBoolean(headerRight.showLogo, defaults.header.right.showLogo),
        logoUrl: typeof headerRight.logoUrl === 'string' ? headerRight.logoUrl : defaults.header.right.logoUrl,
        line1: asString(headerRight.line1, defaults.header.right.line1),
        line2: asString(headerRight.line2, defaults.header.right.line2),
        line3: asString(headerRight.line3, defaults.header.right.line3),
        line4: asString(headerRight.line4, defaults.header.right.line4),
        line5: asString(headerRight.line5, defaults.header.right.line5),
      },
    },
    watermark: {
      enabled: asBoolean(watermark.enabled, defaults.watermark.enabled),
      mode: ((): 'text' | 'image' => {
        const v = asString(watermark.mode, defaults.watermark.mode)
        return v === 'image' ? 'image' : 'text'
      })(),
      text: asString(watermark.text, defaults.watermark.text),
      imageUrl:
        typeof watermark.imageUrl === 'string' && watermark.imageUrl.trim()
          ? watermark.imageUrl.trim()
          : defaults.watermark.imageUrl,
      useLogo: asBoolean(watermark.useLogo, defaults.watermark.useLogo),
      color: asString(watermark.color, defaults.watermark.color),
      opacity: clamp(asNumber(watermark.opacity, defaults.watermark.opacity), 0, 0.25),
      fontSize: clamp(asNumber(watermark.fontSize, defaults.watermark.fontSize), 24, 120),
      rotateDeg: clamp(asNumber(watermark.rotateDeg, defaults.watermark.rotateDeg), -90, 90),
      scale: clamp(asNumber(watermark.scale, defaults.watermark.scale), 0.2, 1),
    },
    footer: {
      text: asString(footer.text, defaults.footer.text),
      leftText: (() => {
        if (typeof footer.leftText === 'string') return footer.leftText
        if (typeof footer.text === 'string') return footer.text
        return defaults.footer.leftText
      })(),
      rightText: asString(footer.rightText, defaults.footer.rightText),
      bottomOffset: clamp(asNumber((footer as Record<string, unknown>).bottomOffset, defaults.footer.bottomOffset), 0, 200),
      reserveHeight: clamp(asNumber((footer as Record<string, unknown>).reserveHeight, defaults.footer.reserveHeight), 0, 260),
    },
    blocks: {
      vendedor: {
        side: asBlockSide(vendedorBlock.side, defaults.blocks.vendedor.side),
        widthPct: asBlockWidthPct(vendedorBlock.widthPct, defaults.blocks.vendedor.widthPct),
        telefonoOverride:
          typeof vendedorBlock.telefonoOverride === 'string'
            ? vendedorBlock.telefonoOverride
            : defaults.blocks.vendedor.telefonoOverride,
        cargoOverride:
          typeof vendedorBlock.cargoOverride === 'string'
            ? vendedorBlock.cargoOverride
            : defaults.blocks.vendedor.cargoOverride,
      },
      cliente: {
        side: asBlockSide(clienteBlock.side, defaults.blocks.cliente.side),
        widthPct: asBlockWidthPct(clienteBlock.widthPct, defaults.blocks.cliente.widthPct),
      },
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
