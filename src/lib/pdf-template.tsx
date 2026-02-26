import React from 'react'
import {
  CotizacionTemplateSettings,
  DEFAULT_COTIZACION_TEMPLATE,
  mergeCotizacionTemplateSettings,
} from '@/lib/cotizacion-template'

export type ReactPdfComponents = {
  Document: React.ElementType
  Page: React.ElementType
  Text: React.ElementType
  View: React.ElementType
  Image: React.ElementType
  StyleSheet: { create: (...args: any[]) => any }
}

/* eslint-disable jsx-a11y/alt-text */

export interface CotizacionPdfMaterial {
  nombre: string
  tipo: string
  imagenUrl?: string | null
}

export interface CotizacionPdfItem {
  descripcion?: string | null
  unidad?: string | null
  cantidad: number
  ancho: number | null
  alto: number | null
  metrosCuadrados?: number
  precioUnitario: number
  subtotal: number
  laminado: boolean
  troquelado: boolean
  instalacion: boolean
  costoInstalacion?: number
  imagenUrl?: string | null
  material: CotizacionPdfMaterial | null
}

export interface CotizacionPdfData {
  numero: string
  createdAt: Date | string
  validezDias: number
  estado?: string
  observaciones?: string | null
  garantia?: string | null
  paymentMethods?: string[]
  boldCheckoutUrl?: string | null
  cliente: {
    nombre: string
    email?: string | null
    telefono?: string | null
    empresa?: string | null
  }
  vendedor: {
    name: string | null
    email: string | null
    role?: string | null
    telefono?: string | null
    cargo?: string | null
    sedeNombre?: string | null
  }
  items: CotizacionPdfItem[]
  subtotal: number
  iva: number
  total: number
  notas?: string | null
}

export interface CotizacionPDFProps {
  cotizacion: CotizacionPdfData
  template?: CotizacionTemplateSettings | unknown
}

export interface CotizacionPDFCoreProps extends CotizacionPDFProps {
  pdf: ReactPdfComponents
}

function createStyles(t: CotizacionTemplateSettings, StyleSheet: ReactPdfComponents['StyleSheet']) {
  const watermarkScale = Math.max(0.2, Math.min(1, Number(t.watermark.scale ?? 0.8)))
  const watermarkOffsetPct = (1 - watermarkScale) * 50
  const backgroundOpacity = Math.max(0, Math.min(1, Number(t.page.backgroundImageOpacity ?? 1)))

  const getPageDimsPt = () => {
    const size = t.page.size
    const orientation = t.page.orientation
    const dims =
      size === 'A4'
        ? { w: 595.28, h: 841.89 }
        : size === 'LEGAL'
          ? { w: 612, h: 1008 }
          : { w: 612, h: 792 } // LETTER

    const isLandscape = orientation === 'landscape'
    return isLandscape ? { width: dims.h, height: dims.w } : { width: dims.w, height: dims.h }
  }

  const legacyMargin = Number.isFinite(t.page.padding) ? t.page.padding : 40
  const marginSides = t.page.marginSides ?? {
    top: legacyMargin,
    right: legacyMargin,
    bottom: legacyMargin,
    left: legacyMargin,
  }
  const paddingSides = t.page.paddingSides ?? { top: 0, right: 0, bottom: 0, left: 0 }
  const safeAreaSides = t.page.safeAreaSides ?? { top: 0, right: 0, bottom: 0, left: 0 }

  const pageDimsPt = getPageDimsPt()

  const footerOffset = Math.max(0, Number(t.footer.bottomOffset ?? 0))
  const userFooterReserveHeight = Math.max(0, Number(t.footer.reserveHeight ?? 60))

  const footerFontSize = Math.max(t.typography.baseFontSize - 1, 8)
  const estimateWrappedLines = (text: string, charsPerLine: number) => {
    const safeCharsPerLine = Math.max(10, Math.floor(charsPerLine))
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => {
        const len = line.trim().length
        return Math.max(1, Math.ceil(len / safeCharsPerLine))
      })
      .reduce((a, b) => a + b, 0)
  }

  // Estimación para evitar que el footer (fixed/absolute) se monte encima del contenido.
  // Si el texto ocupa más líneas que `reserveHeight`, ampliamos automáticamente la reserva.
  const footerTextLeft = String(t.footer.leftText || t.footer.text || '').trim()
  const footerTextRight = String(t.footer.rightText || '').trim()
  const approxCharsPerFullLine = 90
  const leftLines = estimateWrappedLines(footerTextLeft, approxCharsPerFullLine * 0.65)
  const rightLines = estimateWrappedLines(footerTextRight, approxCharsPerFullLine * 0.35)
  const footerLines = Math.max(leftLines, rightLines)
  const footerLineHeight = footerFontSize * 1.25
  const estimatedFooterHeight = 15 + footerLines * footerLineHeight + 6

  const footerReserveHeight = Math.max(userFooterReserveHeight, estimatedFooterHeight)

  // "Área de información" por altura: por defecto 75% de la página.
  // El 25% restante se divide entre header (arriba) y footer+membrete (abajo).
  const useInfoAreaHeightPct = Boolean(t.page.useInfoAreaHeightPct)
  const infoAreaHeightPct = Math.max(0.5, Math.min(0.95, Number(t.page.infoAreaHeightPct ?? 0.75)))

  const computedSafeArea = (() => {
    if (!useInfoAreaHeightPct) return safeAreaSides

    const pageHeightPt = pageDimsPt.height
    const reservedTotal = Math.max(0, pageHeightPt * (1 - infoAreaHeightPct))
    const band = reservedTotal / 2
    const footerNeeds = footerReserveHeight + footerOffset

    // Reservamos `band` arriba. Abajo reservamos `band` total, pero lo separamos en:
    // - `safeBottomMemberte`: zona decorativa inferior (membrete)
    // - `footerNeeds`: espacio funcional del footer
    const safeBottomMemberte = Math.max(0, band - footerNeeds)

    return {
      ...safeAreaSides,
      top: Math.max(safeAreaSides.top ?? 0, band),
      bottom: Math.max(safeAreaSides.bottom ?? 0, safeBottomMemberte),
    }
  })()

  const pagePaddingTop = (marginSides.top ?? 0) + (computedSafeArea.top ?? 0) + (paddingSides.top ?? 0)
  const pagePaddingRight = (marginSides.right ?? 0) + (computedSafeArea.right ?? 0) + (paddingSides.right ?? 0)
  const pagePaddingBottom =
    (marginSides.bottom ?? 0) +
    (computedSafeArea.bottom ?? 0) +
    (paddingSides.bottom ?? 0) +
    footerReserveHeight +
    footerOffset
  const pagePaddingLeft = (marginSides.left ?? 0) + (computedSafeArea.left ?? 0) + (paddingSides.left ?? 0)


  const footerLeftRight = (marginSides.left ?? 0) + (computedSafeArea.left ?? 0) + (paddingSides.left ?? 0)
  const footerRightRight = (marginSides.right ?? 0) + (computedSafeArea.right ?? 0) + (paddingSides.right ?? 0)
  const footerBottom = Math.max(
    10,
    (marginSides.bottom ?? 0) + (computedSafeArea.bottom ?? 0) + (paddingSides.bottom ?? 0) + footerOffset
  )

  return StyleSheet.create({
    page: {
      fontSize: t.typography.baseFontSize,
      fontFamily: t.typography.fontFamily,
      backgroundColor: t.colors.pageBackground,
      color: t.colors.text,
      position: 'relative',
      overflow: 'hidden',
      // IMPORTANT: padding en Page para que se respete en TODAS las páginas.
      // Si el padding está en un <View> y ese View se parte entre páginas,
      // el paddingTop no se re-aplica en la página siguiente.
      paddingTop: pagePaddingTop,
      paddingRight: pagePaddingRight,
      paddingBottom: pagePaddingBottom,
      paddingLeft: pagePaddingLeft,
    },
    content: {
      // Contenedor lógico del contenido (sin padding; lo aporta la Page)
      flexDirection: 'column',
    },
    pageBackgroundImage: {
      position: 'absolute',
      // Full-bleed real: en react-pdf, el padding del <Page> puede afectar el sistema
      // de coordenadas/medidas. Compensamos el padding para que el fondo no se recorte
      // ni se mueva al cambiar márgenes/áreas seguras/"% por altura".
      top: 0,
      left: 0,
      width: pageDimsPt.width,
      height: pageDimsPt.height,
      transform: [{ translateX: -pagePaddingLeft }, { translateY: -pagePaddingTop }] as any,
      objectFit: 'cover',
      opacity: backgroundOpacity,
    },
    header: {
      marginBottom: 20,
      borderBottomWidth: 2,
      borderBottomColor: t.colors.primary,
      paddingBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerLeft: {
      flexGrow: 1,
      flexDirection: 'column',
    },
    headerLeftTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerLeftText: {
      flexGrow: 1,
      flexDirection: 'column',
    },
    headerRight: {
      width: '40%',
      flexDirection: 'column',
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
    },
    headerRightText: {
      flexDirection: 'column',
      alignItems: 'flex-end',
    },
    headerRightLine: {
      fontSize: Math.max(t.typography.baseFontSize - 1, 8),
      color: t.colors.mutedText,
      textAlign: 'right',
    },
    logo: {
      width: 90,
      height: 42,
      objectFit: 'contain',
    },
    logoRight: {
      width: 70,
      height: 32,
      objectFit: 'contain',
    },
    title: {
      fontSize: t.typography.titleFontSize,
      fontWeight: 'bold',
      color: t.colors.primary,
      marginBottom: 5,
    },
    empresa: {
      fontSize: t.typography.sectionTitleFontSize,
      color: t.colors.mutedText,
      marginBottom: 2,
    },
    section: {
      marginBottom: 15,
    },
    sectionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'stretch',
      width: '100%',
    },
    sectionCol: {
      flexDirection: 'column',
      alignSelf: 'stretch',
    },
    sectionTitle: {
      fontSize: t.typography.sectionTitleFontSize,
      fontWeight: 'bold',
      marginBottom: 8,
      color: t.colors.text,
      backgroundColor: t.colors.sectionBackground,
      padding: 5,
    },
    row: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    infoRow: {
      flexDirection: 'row',
      marginBottom: 5,
    },
    label: {
      width: '30%',
      fontWeight: 'bold',
      color: t.colors.mutedText,
    },
    value: {
      width: '70%',
      color: t.colors.text,
    },
    table: {
      marginTop: 10,
      marginBottom: 15,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: t.colors.tableHeaderBackground,
      color: t.colors.tableHeaderText,
      padding: 8,
      fontWeight: 'bold',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: t.colors.tableBorder,
      padding: 8,
    },
    tableRowAlt: {
      flexDirection: 'row',
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
      borderBottomWidth: 1,
      borderBottomColor: t.colors.tableBorder,
      padding: 8,
    },
    col1: { width: '30%' },
    col2: { width: '12%' },
    col3: { width: '12%' },
    col4: { width: '16%' },
    col5: { width: '15%', textAlign: 'right' },
    col6: { width: '15%', textAlign: 'right' },

    colU1: { width: '55%' },
    colU2: { width: '15%', textAlign: 'center' },
    colU3: { width: '15%', textAlign: 'right' },
    colU4: { width: '15%', textAlign: 'right' },
    totals: {
      marginTop: 10,
      alignItems: 'flex-end',
    },
    totalRow: {
      flexDirection: 'row',
      width: '40%',
      justifyContent: 'space-between',
      padding: 5,
    },
    totalLabel: {
      fontWeight: 'bold',
      color: t.colors.mutedText,
    },
    totalValue: {
      color: t.colors.text,
    },
    grandTotal: {
      flexDirection: 'row',
      width: '40%',
      justifyContent: 'space-between',
      padding: 8,
      backgroundColor: t.colors.primary,
      color: t.colors.tableHeaderText,
      fontWeight: 'bold',
      fontSize: Math.max(t.typography.baseFontSize + 2, 12),
      marginTop: 5,
    },
    footer: {
      position: 'absolute',
      left: footerLeftRight,
      right: footerRightRight,
      bottom: footerBottom,
      paddingTop: 15,
      borderTopWidth: 1,
      borderTopColor: t.colors.tableBorder,
      fontSize: Math.max(t.typography.baseFontSize - 1, 8),
      color: t.colors.mutedText,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    footerLeft: {
      width: '65%',
    },
    footerRight: {
      width: '35%',
      textAlign: 'right',
    },
    observaciones: {
      marginTop: 15,
      padding: 10,
      backgroundColor: t.colors.warningBackground,
      borderLeftWidth: 3,
      borderLeftColor: t.colors.warningBorder,
    },
    infoBlock: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: t.colors.tableBorder,
      padding: 8,
      backgroundColor: t.colors.sectionBackground,
    },
    smallMuted: {
      fontSize: Math.max(t.typography.baseFontSize - 2, 8),
      color: t.colors.mutedText,
    },
    itemTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },
    itemImage: {
      width: 28,
      height: 28,
      objectFit: 'cover',
      borderRadius: 3,
      marginRight: 6,
    },
    watermarkText: {
      position: 'absolute',
      top: '45%',
      left: '10%',
      right: '10%',
      textAlign: 'center',
      opacity: t.watermark.opacity,
      transform: [{ rotate: `${t.watermark.rotateDeg}deg` } as any],
      color: t.watermark.color,
      fontWeight: 'bold',
      fontSize: t.watermark.fontSize,
    },
    watermarkImage: {
      position: 'absolute',
      top: `${watermarkOffsetPct}%`,
      left: `${watermarkOffsetPct}%`,
      width: `${watermarkScale * 100}%`,
      height: `${watermarkScale * 100}%`,
      objectFit: 'contain',
      opacity: t.watermark.opacity,
      transform: [{ rotate: `${t.watermark.rotateDeg}deg` } as any],
    },
  })
}

function formatCurrency(value: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}

function formatDate(date: Date | string, locale: string) {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(date))
}

export default function CotizacionPDF({ pdf, cotizacion, template }: CotizacionPDFCoreProps) {
  const { Document, Image, Page, Text, View, StyleSheet } = pdf
  const t = mergeCotizacionTemplateSettings(template ?? DEFAULT_COTIZACION_TEMPLATE)
  const styles = createStyles(t, StyleSheet)
  const locale = t.currency.locale
  const currency = t.currency.currency
  const footerOffset = Math.max(0, Number(t.footer.bottomOffset ?? 0))
  const footerReserveHeight = Math.max(0, Number(t.footer.reserveHeight ?? 60))

  const watermarkImageSrc = t.watermark.useLogo ? (t.header.logoUrl ?? '') : (t.watermark.imageUrl ?? '')
  const hasWatermarkImage = t.watermark.mode === 'image' && Boolean(watermarkImageSrc)
  const headerRightLines = [
    t.header.right.line1,
    t.header.right.line2,
    t.header.right.line3,
    t.header.right.line4,
    t.header.right.line5,
  ]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)

  const hasHeaderRight =
    headerRightLines.length > 0 || (t.header.right.showLogo && Boolean((t.header.right.logoUrl ?? '').trim()))
  const hasFooterRight = Boolean((t.footer.rightText ?? '').trim())

  const blockStyle = (side: 'left' | 'right', widthPct: number) => {
    const w = Number(widthPct)
    const width = `${Number.isFinite(w) ? w : 100}%`
    return {
      width,
      ...(side === 'right' ? { marginLeft: 'auto' } : null),
    } as const
  }

  const roleToCargo = (role?: string | null) => {
    const r = String(role ?? '').trim().toUpperCase()
    if (!r) return ''
    if (r === 'SUPER_ADMIN') return 'Super Admin'
    if (r === 'ADMIN') return 'Administrador'
    if (r === 'MANAGER') return 'Gerente'
    if (r === 'SELLER') return 'Vendedor'
    return r
  }

  const getUnitKey = (u: unknown): 'm2' | 'ml' | 'unidad' => {
    const unit = String(u ?? '').trim().toLowerCase()
    if (unit === 'm2' || unit === 'm²') return 'm2'
    if (unit === 'ml' || unit === 'm' || unit === 'metro') return 'ml'
    return 'unidad'
  }

  const metrajeItems = cotizacion.items.filter((it) => {
    const key = getUnitKey(it.unidad)
    return key === 'm2' || key === 'ml'
  })
  const unidadItems = cotizacion.items.filter((it) => getUnitKey(it.unidad) === 'unidad')

  const observacion = (cotizacion.observaciones ?? '').trim()
  const nota = (cotizacion.notas ?? '').trim()
  const observacionesTexto = [observacion, nota].filter(Boolean).join('\n')
  const garantiaTexto = (cotizacion.garantia ?? '').trim()
  const paymentMethodsTexto = Array.isArray(cotizacion.paymentMethods)
    ? cotizacion.paymentMethods.map((x) => String(x || '').trim()).filter(Boolean).join(', ')
    : ''
  const boldUrlTexto = (cotizacion.boldCheckoutUrl ?? '').trim()

  const vendedorTelefonoTexto = (
    String(cotizacion.vendedor?.telefono ?? '').trim() || String(t.blocks?.vendedor?.telefonoOverride ?? '').trim()
  ).trim()
  const vendedorCargoTexto = (
    String(cotizacion.vendedor?.cargo ?? '').trim() ||
    String(t.blocks?.vendedor?.cargoOverride ?? '').trim() ||
    roleToCargo(cotizacion.vendedor?.role)
  ).trim()
  const vendedorSedeTexto = String(cotizacion.vendedor?.sedeNombre ?? '').trim()

  const getPageHeightPt = () => {
    const size = t.page.size
    const orientation = t.page.orientation
    const dims =
      size === 'A4'
        ? { w: 595.28, h: 841.89 }
        : size === 'LEGAL'
          ? { w: 612, h: 1008 }
          : { w: 612, h: 792 } // LETTER

    return orientation === 'landscape' ? dims.w : dims.h
  }

  const keepTogetherPresenceAhead = (() => {
    // Si el modo 75% no está activo, igual evitamos títulos huérfanos al final.
    if (!t.page.useInfoAreaHeightPct) return 140
    const pageHeightPt = getPageHeightPt()
    const pct = Math.max(0.5, Math.min(0.95, Number(t.page.infoAreaHeightPct ?? 0.75)))
    const reservedTotal = Math.max(0, pageHeightPt * (1 - pct))
    const band = reservedTotal / 2
    return Math.max(140, Math.round(band))
  })()

  return (
    <Document>
      <Page size={t.page.size} orientation={t.page.orientation} style={styles.page}>
        {t.page.backgroundImageUrl ? (
          <Image fixed style={styles.pageBackgroundImage} src={t.page.backgroundImageUrl} />
        ) : null}

        {t.watermark.enabled ? (
          hasWatermarkImage ? (
            <Image fixed style={styles.watermarkImage} src={watermarkImageSrc} />
          ) : (
            <Text fixed style={styles.watermarkText}>{t.watermark.text}</Text>
          )
        ) : null}

        <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerLeftTop}>
                  <View style={styles.headerLeftText}>
                    <Text style={styles.title}>{t.header.title}</Text>
                    <Text style={styles.empresa}>{t.header.companyName}</Text>
                    {!!t.header.subtitle1 && <Text style={styles.empresa}>{t.header.subtitle1}</Text>}
                    {!!t.header.subtitle2 && <Text style={styles.empresa}>{t.header.subtitle2}</Text>}
                  </View>
                  {t.header.showLogo && t.header.logoUrl ? <Image style={styles.logo} src={t.header.logoUrl} /> : null}
                </View>
              </View>

              {hasHeaderRight ? (
                <View style={styles.headerRight}>
                  {t.header.right.showLogo && t.header.right.logoUrl ? <Image style={styles.logoRight} src={t.header.right.logoUrl} /> : null}
                  {headerRightLines.length > 0 ? (
                    <View style={styles.headerRightText}>
                      {headerRightLines.map((line, idx) => (
                        <Text key={idx} style={styles.headerRightLine}>
                          {line}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionsRow}>
                {t.blocks.vendedor.side === 'right' && t.blocks.cliente.side === 'left' ? (
                  <>
                    <View style={[styles.sectionCol, blockStyle('left', t.blocks.cliente.widthPct)]}>
                      <Text style={styles.sectionTitle}>Datos del Cliente</Text>
                      <View style={styles.infoBlock}>
                        <View style={styles.row}>
                          <Text style={styles.label}>Cliente:</Text>
                          <Text style={styles.value}>{cotizacion.cliente.nombre}</Text>
                        </View>
                        {t.toggles.showClienteEmail ? (
                          <View style={styles.row}>
                            <Text style={styles.label}>Email:</Text>
                            <Text style={styles.value}>{cotizacion.cliente.email ?? ''}</Text>
                          </View>
                        ) : null}
                        {t.toggles.showClienteTelefono && cotizacion.cliente.telefono ? (
                          <View style={styles.row}>
                            <Text style={styles.label}>Teléfono:</Text>
                            <Text style={styles.value}>{cotizacion.cliente.telefono}</Text>
                          </View>
                        ) : null}
                        {t.toggles.showClienteEmpresa && cotizacion.cliente.empresa ? (
                          <View style={styles.row}>
                            <Text style={styles.label}>Empresa:</Text>
                            <Text style={styles.value}>{cotizacion.cliente.empresa}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View style={[styles.sectionCol, blockStyle('right', t.blocks.vendedor.widthPct)]}>
                      <Text style={styles.sectionTitle}>Información General</Text>
                      <View style={styles.row}>
                        <Text style={styles.label}>Número:</Text>
                        <Text style={styles.value}>{cotizacion.numero}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>Fecha:</Text>
                        <Text style={styles.value}>{formatDate(cotizacion.createdAt, locale)}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.label}>Válido hasta:</Text>
                        <Text style={styles.value}>
                          {formatDate(
                            new Date(
                              new Date(cotizacion.createdAt).getTime() + cotizacion.validezDias * 24 * 60 * 60 * 1000
                            ),
                            locale
                          )}
                        </Text>
                      </View>
                      {t.toggles.showEstado && cotizacion.estado ? (
                        <View style={styles.infoRow}>
                          <Text style={styles.label}>Estado:</Text>
                          <Text style={styles.value}>{cotizacion.estado}</Text>
                        </View>
                      ) : null}
                      {t.toggles.showVendedor ? (
                        <View style={styles.infoBlock}>
                          <View style={styles.row}>
                            <Text style={styles.label}>Usuario:</Text>
                            <Text style={styles.value}>{cotizacion.vendedor?.name ?? ''}</Text>
                          </View>
                          <View style={styles.row}>
                            <Text style={styles.label}>Correo:</Text>
                            <Text style={styles.value}>{cotizacion.vendedor?.email ?? ''}</Text>
                          </View>
                          {vendedorSedeTexto ? (
                            <View style={styles.row}>
                              <Text style={styles.label}>Sede:</Text>
                              <Text style={styles.value}>{vendedorSedeTexto}</Text>
                            </View>
                          ) : null}
                          {vendedorTelefonoTexto ? (
                            <View style={styles.row}>
                              <Text style={styles.label}>Teléfono:</Text>
                              <Text style={styles.value}>{vendedorTelefonoTexto}</Text>
                            </View>
                          ) : null}
                          {vendedorCargoTexto ? (
                            <View style={styles.row}>
                              <Text style={styles.label}>Cargo:</Text>
                              <Text style={styles.value}>{vendedorCargoTexto}</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </>
                ) : (
                  <>
                    <View style={[styles.sectionCol, blockStyle('left', t.blocks.vendedor.widthPct)]}>
                      <Text style={styles.sectionTitle}>Información General</Text>
                      <View style={styles.row}>
                        <Text style={styles.label}>Número:</Text>
                        <Text style={styles.value}>{cotizacion.numero}</Text>
                      </View>
                      <View style={styles.row}>
                        <Text style={styles.label}>Fecha:</Text>
                        <Text style={styles.value}>{formatDate(cotizacion.createdAt, locale)}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Text style={styles.label}>Válido hasta:</Text>
                        <Text style={styles.value}>
                          {formatDate(
                            new Date(
                              new Date(cotizacion.createdAt).getTime() + cotizacion.validezDias * 24 * 60 * 60 * 1000
                            ),
                            locale
                          )}
                        </Text>
                      </View>
                      {t.toggles.showEstado && cotizacion.estado ? (
                        <View style={styles.infoRow}>
                          <Text style={styles.label}>Estado:</Text>
                          <Text style={styles.value}>{cotizacion.estado}</Text>
                        </View>
                      ) : null}
                      {t.toggles.showVendedor ? (
                        <View style={styles.infoBlock}>
                          <View style={styles.row}>
                            <Text style={styles.label}>Usuario:</Text>
                            <Text style={styles.value}>{cotizacion.vendedor?.name ?? ''}</Text>
                          </View>
                          <View style={styles.row}>
                            <Text style={styles.label}>Correo:</Text>
                            <Text style={styles.value}>{cotizacion.vendedor?.email ?? ''}</Text>
                          </View>
                          {vendedorSedeTexto ? (
                            <View style={styles.row}>
                              <Text style={styles.label}>Sede:</Text>
                              <Text style={styles.value}>{vendedorSedeTexto}</Text>
                            </View>
                          ) : null}
                          {vendedorTelefonoTexto ? (
                            <View style={styles.row}>
                              <Text style={styles.label}>Teléfono:</Text>
                              <Text style={styles.value}>{vendedorTelefonoTexto}</Text>
                            </View>
                          ) : null}
                          {vendedorCargoTexto ? (
                            <View style={styles.row}>
                              <Text style={styles.label}>Cargo:</Text>
                              <Text style={styles.value}>{vendedorCargoTexto}</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>

                    <View style={[styles.sectionCol, blockStyle('right', t.blocks.cliente.widthPct)]}>
                      <Text style={styles.sectionTitle}>Datos del Cliente</Text>
                      <View style={styles.infoBlock}>
                        <View style={styles.row}>
                          <Text style={styles.label}>Cliente:</Text>
                          <Text style={styles.value}>{cotizacion.cliente.nombre}</Text>
                        </View>
                        {t.toggles.showClienteEmail ? (
                          <View style={styles.row}>
                            <Text style={styles.label}>Email:</Text>
                            <Text style={styles.value}>{cotizacion.cliente.email ?? ''}</Text>
                          </View>
                        ) : null}
                        {t.toggles.showClienteTelefono && cotizacion.cliente.telefono ? (
                          <View style={styles.row}>
                            <Text style={styles.label}>Teléfono:</Text>
                            <Text style={styles.value}>{cotizacion.cliente.telefono}</Text>
                          </View>
                        ) : null}
                        {t.toggles.showClienteEmpresa && cotizacion.cliente.empresa ? (
                          <View style={styles.row}>
                            <Text style={styles.label}>Empresa:</Text>
                            <Text style={styles.value}>{cotizacion.cliente.empresa}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalle de Productos/Servicios</Text>

          {metrajeItems.length > 0 ? (
            <View style={styles.table}>
              {unidadItems.length > 0 ? <Text style={styles.smallMuted}>Ítems por metraje</Text> : null}
              <View style={styles.tableHeader}>
                <Text style={styles.col1}>Material</Text>
                <Text style={styles.col2}>Ancho (m)</Text>
                <Text style={styles.col3}>Alto (m)</Text>
                <Text style={styles.col4}>Medida / Cant</Text>
                <Text style={styles.col5}>Valor Unit.</Text>
                <Text style={styles.col6}>Subtotal</Text>
              </View>

              {metrajeItems.map((item, index) => {
                const unitKey = getUnitKey(item.unidad)
                const title = (item.descripcion ?? '').trim() || item.material?.nombre || 'Ítem'
                const showMaterialName = item.material?.nombre && item.material.nombre !== title
                const medida = Number(item.metrosCuadrados ?? 0)
                const imageSrc = item.imagenUrl || item.material?.imagenUrl || null

                return (
                  <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <View style={styles.col1}>
                      <View style={styles.itemTitleRow}>
                        {imageSrc ? <Image style={styles.itemImage} src={imageSrc} /> : null}
                        <Text>{title}</Text>
                      </View>
                      {showMaterialName ? <Text style={styles.smallMuted}>{item.material?.nombre}</Text> : null}
                      {item.laminado || item.troquelado || item.instalacion ? (
                        <Text style={styles.smallMuted}>
                          {[
                            item.laminado && 'Laminado',
                            item.troquelado && 'Troquelado',
                            item.instalacion &&
                              `Instalación${
                                (item.costoInstalacion ?? 0) > 0
                                  ? ` (${formatCurrency(item.costoInstalacion ?? 0, locale, currency)})`
                                  : ''
                              }`,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.col2}>{(item.ancho ?? 0).toFixed(2)}</Text>
                    <Text style={styles.col3}>{(item.alto ?? 0).toFixed(2)}</Text>
                    <Text style={styles.col4}>
                      {unitKey === 'ml'
                        ? `${medida.toFixed(2)} m × ${item.cantidad}`
                        : `${medida.toFixed(2)} m² × ${item.cantidad}`}
                    </Text>
                    <Text style={styles.col5}>{formatCurrency(item.precioUnitario, locale, currency)}</Text>
                    <Text style={styles.col6}>{formatCurrency(item.subtotal, locale, currency)}</Text>
                  </View>
                )
              })}
            </View>
          ) : null}

          {unidadItems.length > 0 ? (
            <View style={styles.table}>
              {metrajeItems.length > 0 ? <Text style={styles.smallMuted}>Ítems por unidad</Text> : null}
              <View style={styles.tableHeader}>
                <Text style={styles.colU1}>Descripción</Text>
                <Text style={styles.colU2}>Cant</Text>
                <Text style={styles.colU3}>Valor Unit.</Text>
                <Text style={styles.colU4}>Subtotal</Text>
              </View>

              {unidadItems.map((item, index) => {
                const title = (item.descripcion ?? '').trim() || item.material?.nombre || 'Ítem'
                const showMaterialName = item.material?.nombre && item.material.nombre !== title
                const imageSrc = item.imagenUrl || item.material?.imagenUrl || null

                return (
                  <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <View style={styles.colU1}>
                      <View style={styles.itemTitleRow}>
                        {imageSrc ? <Image style={styles.itemImage} src={imageSrc} /> : null}
                        <Text>{title}</Text>
                      </View>
                      {showMaterialName ? <Text style={styles.smallMuted}>{item.material?.nombre}</Text> : null}
                      {item.laminado || item.troquelado || item.instalacion ? (
                        <Text style={styles.smallMuted}>
                          {[
                            item.laminado && 'Laminado',
                            item.troquelado && 'Troquelado',
                            item.instalacion &&
                              `Instalación${
                                (item.costoInstalacion ?? 0) > 0
                                  ? ` (${formatCurrency(item.costoInstalacion ?? 0, locale, currency)})`
                                  : ''
                              }`,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.colU2}>{item.cantidad}</Text>
                    <Text style={styles.colU3}>{formatCurrency(item.precioUnitario, locale, currency)}</Text>
                    <Text style={styles.colU4}>{formatCurrency(item.subtotal, locale, currency)}</Text>
                  </View>
                )
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{formatCurrency(cotizacion.subtotal, locale, currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>IVA:</Text>
            <Text style={styles.totalValue}>{formatCurrency(cotizacion.iva, locale, currency)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text>TOTAL:</Text>
            <Text>{formatCurrency(cotizacion.total, locale, currency)}</Text>
        </View>

        {(garantiaTexto || paymentMethodsTexto || boldUrlTexto) ? (
          <View style={styles.section} wrap={false} minPresenceAhead={keepTogetherPresenceAhead}>
            <Text style={styles.sectionTitle}>Condiciones</Text>
            {paymentMethodsTexto ? (
              <View style={styles.row}>
                <Text style={styles.label}>Formas de pago:</Text>
                <Text style={styles.value}>{paymentMethodsTexto}</Text>
              </View>
            ) : null}
            {boldUrlTexto ? (
              <View style={styles.row}>
                <Text style={styles.label}>Link de pago:</Text>
                <Text style={styles.value}>{boldUrlTexto}</Text>
              </View>
            ) : null}
            {garantiaTexto ? (
              <View style={styles.row}>
                <Text style={styles.label}>Garantía:</Text>
                <Text style={styles.value}>{garantiaTexto}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {t.toggles.showObservaciones && observacionesTexto ? (
          <View style={styles.observaciones} wrap>
            <Text style={{ fontWeight: 'bold', marginBottom: 5 }} minPresenceAhead={60}>
              Observaciones:
            </Text>
            <Text>{observacionesTexto}</Text>
          </View>
        ) : null}

          </View>
        </View>

        <View style={styles.footer} fixed>
          {hasFooterRight ? (
            <View style={styles.footerRow}>
              <Text style={styles.footerLeft}>{t.footer.leftText || t.footer.text}</Text>
              <Text style={styles.footerRight}>{t.footer.rightText}</Text>
            </View>
          ) : (
            <Text>{t.footer.leftText || t.footer.text}</Text>
          )}
        </View>
      </Page>
    </Document>
  )
}
