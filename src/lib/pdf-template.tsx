import React from 'react'
import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  CotizacionTemplateSettings,
  DEFAULT_COTIZACION_TEMPLATE,
  mergeCotizacionTemplateSettings,
} from '@/lib/cotizacion-template'

/* eslint-disable jsx-a11y/alt-text */

interface Material {
  nombre: string
  tipo: string
}

interface ItemCotizacion {
  cantidad: number
  ancho: number | null
  alto: number | null
  metrosCuadrados?: number
  precioUnitario: number
  subtotal: number
  laminado: boolean
  troquelado: boolean
  instalacion: boolean
  material: Material | null
}

interface CotizacionPDFProps {
  cotizacion: {
    numero: string
    createdAt: Date
    validezDias: number
    estado?: string
    observaciones?: string | null
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
    items: ItemCotizacion[]
    subtotal: number
    iva: number
    total: number
    notas?: string | null
  }
  template?: CotizacionTemplateSettings | unknown
}

function createStyles(t: CotizacionTemplateSettings) {
  return StyleSheet.create({
    page: {
      padding: t.page.padding,
      fontSize: t.typography.baseFontSize,
      fontFamily: t.typography.fontFamily,
      backgroundColor: t.colors.pageBackground,
      color: t.colors.text,
    },
    header: {
      marginBottom: 20,
      borderBottom: 2,
      borderBottomColor: t.colors.primary,
      paddingBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    headerLeft: {
      flexGrow: 1,
      flexDirection: 'column',
    },
    logo: {
      width: 90,
      height: 42,
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
    observaciones: {
      marginTop: 15,
      padding: 10,
      backgroundColor: t.colors.warningBackground,
      borderLeft: 3,
      borderLeftColor: t.colors.warningBorder,
    },
    watermark: {
      position: 'absolute',
      top: '45%',
      left: '10%',
      right: '10%',
      textAlign: 'center',
      opacity: t.watermark.opacity,
      transform: [{ operation: 'rotate' as const, value: [t.watermark.rotateDeg] as [number] }],
      color: t.watermark.color,
      fontWeight: 'bold',
    },
    smallMuted: {
      fontSize: Math.max(t.typography.baseFontSize - 2, 8),
      color: t.colors.mutedText,
    },
  })
}

function formatCurrency(value: number, locale: string, currency: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}

function formatDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(date))
}

export default function CotizacionPDF({ cotizacion, template }: CotizacionPDFProps) {
  const t = mergeCotizacionTemplateSettings(template ?? DEFAULT_COTIZACION_TEMPLATE)
  const styles = createStyles(t)
  const locale = t.currency.locale
  const currency = t.currency.currency

  const observacion = (cotizacion.observaciones ?? '').trim()
  const nota = (cotizacion.notas ?? '').trim()
  const observacionesTexto = [observacion, nota].filter(Boolean).join('\n')

  return (
    <Document>
      <Page size={t.page.size} orientation={t.page.orientation} style={styles.page}>
        {t.watermark.enabled ? <Text style={styles.watermark}>{t.watermark.text}</Text> : null}

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>{t.header.title}</Text>
            <Text style={styles.empresa}>{t.header.companyName}</Text>
            {!!t.header.subtitle1 && <Text style={styles.empresa}>{t.header.subtitle1}</Text>}
            {!!t.header.subtitle2 && <Text style={styles.empresa}>{t.header.subtitle2}</Text>}
          </View>
          {t.header.showLogo && t.header.logoUrl ? <Image style={styles.logo} src={t.header.logoUrl} /> : null}
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
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Material</Text>
              <Text style={styles.col2}>Ancho (m)</Text>
              <Text style={styles.col3}>Alto (m)</Text>
              <Text style={styles.col4}>M² / Cant</Text>
              <Text style={styles.col5}>Subtotal</Text>
            </View>
            {cotizacion.items.map((item, index) => (
              <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <View style={styles.col1}>
                  <Text>{item.material?.nombre || 'N/A'}</Text>
                  <Text style={styles.smallMuted}>
                    {formatCurrency(item.precioUnitario, locale, currency)}/m²
                  </Text>
                  {(item.laminado || item.troquelado || item.instalacion) ? (
                    <Text style={styles.smallMuted}>
                      {[
                        item.laminado && 'Laminado',
                        item.troquelado && 'Troquelado',
                        item.instalacion && 'Instalación',
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.col2}>{(item.ancho ?? 0).toFixed(2)}</Text>
                <Text style={styles.col3}>{(item.alto ?? 0).toFixed(2)}</Text>
                <Text style={styles.col4}>
                  {(item.metrosCuadrados ?? 0).toFixed(2)} m² × {item.cantidad}
                </Text>
                <Text style={styles.col5}>{formatCurrency(item.subtotal, locale, currency)}</Text>
              </View>
            ))}
          </View>
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

        {t.toggles.showObservaciones && observacionesTexto ? (
          <View style={styles.observaciones}>
            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Observaciones:</Text>
            <Text>{observacionesTexto}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>{t.footer.text}</Text>
        </View>
      </Page>
    </Document>
  )
}
