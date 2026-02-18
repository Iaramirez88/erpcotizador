import React from 'react'
import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  CotizacionTemplateSettings,
  DEFAULT_COTIZACION_TEMPLATE,
  mergeCotizacionTemplateSettings,
} from '@/lib/cotizacion-template'

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

function createStyles(t: CotizacionTemplateSettings) {
  const watermarkScale = Math.max(0.2, Math.min(1, Number(t.watermark.scale ?? 0.8)))
  const watermarkOffsetPct = (1 - watermarkScale) * 50
  const backgroundOpacity = Math.max(0, Math.min(1, Number(t.page.backgroundImageOpacity ?? 1)))

  return StyleSheet.create({
    page: {
      padding: t.page.padding,
      fontSize: t.typography.baseFontSize,
      fontFamily: t.typography.fontFamily,
      backgroundColor: t.colors.pageBackground,
      color: t.colors.text,
    },
    pageBackgroundImage: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: backgroundOpacity,
    },
    header: {
      marginBottom: 20,
      borderBottom: 2,
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
      borderBottom: 1,
      borderBottomColor: t.colors.tableBorder,
      padding: 8,
    },
    tableRowAlt: {
      flexDirection: 'row',
      backgroundColor: 'rgba(148, 163, 184, 0.12)',
      borderBottom: 1,
      borderBottomColor: t.colors.tableBorder,
      padding: 8,
    },
    col1: { width: '35%' },
    col2: { width: '15%' },
    col3: { width: '15%' },
    col4: { width: '20%' },
    col5: { width: '15%', textAlign: 'right' },

    colU1: { width: '70%' },
    colU2: { width: '15%' },
    colU3: { width: '15%', textAlign: 'right' },
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
      marginTop: 30,
      paddingTop: 15,
      borderTop: 1,
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
      borderLeft: 3,
      borderLeftColor: t.colors.warningBorder,
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

export default function CotizacionPDF({ cotizacion, template }: CotizacionPDFProps) {
  const t = mergeCotizacionTemplateSettings(template ?? DEFAULT_COTIZACION_TEMPLATE)
  const styles = createStyles(t)
  const locale = t.currency.locale
  const currency = t.currency.currency

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

  const getUnitKey = (u: unknown): 'm2' | 'ml' | 'unidad' => {
    const unit = String(u ?? '').trim().toLowerCase()
    if (unit === 'm2' || unit === 'm²') return 'm2'
    if (unit === 'ml' || unit === 'm' || unit === 'metro') return 'ml'
    return 'unidad'
  }

  const getUnitLabel = (key: 'm2' | 'ml' | 'unidad') => {
    if (key === 'm2') return 'm²'
    if (key === 'ml') return 'm'
    return 'und'
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

  return (
    <Document>
      <Page size={t.page.size} orientation={t.page.orientation} style={styles.page}>
        {t.page.backgroundImageUrl ? <Image style={styles.pageBackgroundImage} src={t.page.backgroundImageUrl} /> : null}

        {t.watermark.enabled ? (
          hasWatermarkImage ? (
            <Image style={styles.watermarkImage} src={watermarkImageSrc} />
          ) : (
            <Text style={styles.watermarkText}>{t.watermark.text}</Text>
          )
        ) : null}

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
                new Date(new Date(cotizacion.createdAt).getTime() + cotizacion.validezDias * 24 * 60 * 60 * 1000),
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
            <View style={styles.infoRow}>
              <Text style={styles.label}>Vendedor:</Text>
              <Text style={styles.value}>{cotizacion.vendedor?.name ?? ''}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos del Cliente</Text>
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
                <Text style={styles.col5}>Subtotal</Text>
              </View>

              {metrajeItems.map((item, index) => {
                const unitKey = getUnitKey(item.unidad)
                const unitLabel = getUnitLabel(unitKey)
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
                      <Text style={styles.smallMuted}>
                        {formatCurrency(item.precioUnitario, locale, currency)}/{unitLabel}
                      </Text>
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
                    <Text style={styles.col5}>{formatCurrency(item.subtotal, locale, currency)}</Text>
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
                <Text style={styles.colU3}>Subtotal</Text>
              </View>

              {unidadItems.map((item, index) => {
                const unitKey = getUnitKey(item.unidad)
                const unitLabel = getUnitLabel(unitKey)
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
                      <Text style={styles.smallMuted}>
                        {formatCurrency(item.precioUnitario, locale, currency)}/{unitLabel}
                      </Text>
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
                    <Text style={styles.colU3}>{formatCurrency(item.subtotal, locale, currency)}</Text>
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
        </View>

        {(garantiaTexto || paymentMethodsTexto || boldUrlTexto) ? (
          <View style={styles.section}>
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
          <View style={styles.observaciones}>
            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Observaciones:</Text>
            <Text>{observacionesTexto}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
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
