export type RemisionPageSize = 'A4' | 'LETTER' | 'LEGAL'
export type RemisionOrientation = 'portrait' | 'landscape'
export type RemisionFontFamily = 'Helvetica' | 'Times-Roman' | 'Courier'

export type RemisionTemplateSettings = {
  page: {
    size: RemisionPageSize
    orientation: RemisionOrientation
    padding: number
    marginHorizontal: number
    marginVertical: number
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

export function mergeRemisionTemplateSettings(
  custom: unknown
): RemisionTemplateSettings {
  if (!custom || typeof custom !== 'object') {
    return DEFAULT_REMISION_TEMPLATE
  }

  const c = custom as Partial<RemisionTemplateSettings>

  return {
    page: {
      size: c.page?.size || DEFAULT_REMISION_TEMPLATE.page.size,
      orientation: c.page?.orientation || DEFAULT_REMISION_TEMPLATE.page.orientation,
      padding: c.page?.padding ?? DEFAULT_REMISION_TEMPLATE.page.padding,
      marginHorizontal: c.page?.marginHorizontal ?? DEFAULT_REMISION_TEMPLATE.page.marginHorizontal,
      marginVertical: c.page?.marginVertical ?? DEFAULT_REMISION_TEMPLATE.page.marginVertical,
    },
    colors: {
      primary: c.colors?.primary || DEFAULT_REMISION_TEMPLATE.colors.primary,
      pageBackground: c.colors?.pageBackground || DEFAULT_REMISION_TEMPLATE.colors.pageBackground,
      text: c.colors?.text || DEFAULT_REMISION_TEMPLATE.colors.text,
      mutedText: c.colors?.mutedText || DEFAULT_REMISION_TEMPLATE.colors.mutedText,
      sectionBackground: c.colors?.sectionBackground || DEFAULT_REMISION_TEMPLATE.colors.sectionBackground,
      tableHeaderBackground: c.colors?.tableHeaderBackground || DEFAULT_REMISION_TEMPLATE.colors.tableHeaderBackground,
      tableHeaderText: c.colors?.tableHeaderText || DEFAULT_REMISION_TEMPLATE.colors.tableHeaderText,
      tableBorder: c.colors?.tableBorder || DEFAULT_REMISION_TEMPLATE.colors.tableBorder,
      border: c.colors?.border || DEFAULT_REMISION_TEMPLATE.colors.border,
      background: c.colors?.background || DEFAULT_REMISION_TEMPLATE.colors.background,
    },
    typography: {
      fontFamily: c.typography?.fontFamily || DEFAULT_REMISION_TEMPLATE.typography.fontFamily,
      baseFontSize: c.typography?.baseFontSize ?? DEFAULT_REMISION_TEMPLATE.typography.baseFontSize,
      titleFontSize: c.typography?.titleFontSize ?? DEFAULT_REMISION_TEMPLATE.typography.titleFontSize,
      sectionTitleFontSize: c.typography?.sectionTitleFontSize ?? DEFAULT_REMISION_TEMPLATE.typography.sectionTitleFontSize,
    },
    header: {
      title: c.header?.title || DEFAULT_REMISION_TEMPLATE.header.title,
      companyName: c.header?.companyName || DEFAULT_REMISION_TEMPLATE.header.companyName,
      subtitle1: c.header?.subtitle1 || DEFAULT_REMISION_TEMPLATE.header.subtitle1,
      subtitle2: c.header?.subtitle2 || DEFAULT_REMISION_TEMPLATE.header.subtitle2,
      logo: c.header?.logo,
      logoUrl: c.header?.logoUrl,
      showLogo: c.header?.showLogo ?? DEFAULT_REMISION_TEMPLATE.header.showLogo,
      customText: c.header?.customText || DEFAULT_REMISION_TEMPLATE.header.customText,
    },
    footer: {
      showTimestamp: c.footer?.showTimestamp ?? DEFAULT_REMISION_TEMPLATE.footer.showTimestamp,
      showPageNumbers: c.footer?.showPageNumbers ?? DEFAULT_REMISION_TEMPLATE.footer.showPageNumbers,
      customText: c.footer?.customText || DEFAULT_REMISION_TEMPLATE.footer.customText,
    },
    sections: {
      showWarehouse: c.sections?.showWarehouse ?? DEFAULT_REMISION_TEMPLATE.sections.showWarehouse,
      showCliente: c.sections?.showCliente ?? DEFAULT_REMISION_TEMPLATE.sections.showCliente,
      showCreatedBy: c.sections?.showCreatedBy ?? DEFAULT_REMISION_TEMPLATE.sections.showCreatedBy,
      showObservaciones: c.sections?.showObservaciones ?? DEFAULT_REMISION_TEMPLATE.sections.showObservaciones,
    },
  }
}
