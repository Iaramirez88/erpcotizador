import React from 'react'
import type { ReactPdfComponents } from '@/lib/pdf-template'
import {
  DEFAULT_ORDEN_COMPRA_TEMPLATE,
  OrdenCompraTemplateSettings,
  mergeOrdenCompraTemplateSettings,
} from '@/lib/orden-compra-template'

export interface OrdenCompraPdfItem {
  descripcion: string
  cantidad: number
  precioUnitario: number
  descuento: number
  iva: number
}

export interface OrdenCompraPdfProps {
  orden: {
    numeroOrden?: string | null
    numeroPedido?: string | null
    fechaCompra: Date | string
    proveedorNombre: string
    proveedorTelefono?: string | null
    proveedorDireccion?: string | null
    sede?: string | null
    observaciones?: string | null
    recibidoPorNombre?: string | null
    autorizado?: boolean
    items: OrdenCompraPdfItem[]
  }
  empresa?: {
    nombre?: string
    nit?: string
    direccion?: string
    telefono?: string
    logo?: string
  }
  template?: OrdenCompraTemplateSettings | unknown
}

export interface OrdenCompraPdfCoreProps extends OrdenCompraPdfProps {
  pdf: ReactPdfComponents
}

function createStyles(t: OrdenCompraTemplateSettings, StyleSheet: ReactPdfComponents['StyleSheet']) {
  const legacyPadding = Number.isFinite(t.page.padding) ? t.page.padding : 40
  const marginSides =
    t.page.marginSides ?? {
      top: t.page.marginVertical ?? legacyPadding,
      right: t.page.marginHorizontal ?? legacyPadding,
      bottom: t.page.marginVertical ?? legacyPadding,
      left: t.page.marginHorizontal ?? legacyPadding,
    }
  const paddingSides = t.page.paddingSides ?? { top: 0, right: 0, bottom: 0, left: 0 }
  const footerLeftRight = marginSides.left + paddingSides.left
  const footerRightRight = marginSides.right + paddingSides.right
  const footerBottom = Math.max(10, (marginSides.bottom ?? 0) + (paddingSides.bottom ?? 0))

  return StyleSheet.create({
    page: {
      fontSize: t.typography.baseFontSize,
      fontFamily: t.typography.fontFamily,
      backgroundColor: t.colors.pageBackground,
      color: t.colors.text,
      position: 'relative',
    },
    contentMargin: {
      paddingTop: marginSides.top,
      paddingRight: marginSides.right,
      paddingBottom: marginSides.bottom,
      paddingLeft: marginSides.left,
    },
    contentPadding: {
      paddingTop: paddingSides.top,
      paddingRight: paddingSides.right,
      paddingBottom: paddingSides.bottom,
      paddingLeft: paddingSides.left,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottomWidth: 2,
      borderBottomColor: t.colors.primary,
      paddingBottom: 14,
      marginBottom: 18,
    },
    headerLeft: { flexGrow: 1, paddingRight: 12 },
    title: {
      fontSize: t.typography.titleFontSize,
      fontWeight: 'bold',
      color: t.colors.primary,
      marginBottom: 4,
    },
    company: {
      fontSize: Math.max(t.typography.baseFontSize + 1, 9),
      color: t.colors.mutedText,
      marginBottom: 2,
    },
    logo: {
      width: 84,
      height: 40,
      objectFit: 'contain',
    },
    highlightBox: {
      backgroundColor: t.colors.highlightBackground,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 6,
      padding: 12,
      marginBottom: 14,
    },
    highlightRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 4,
    },
    highlightLabel: {
      fontSize: Math.max(t.typography.baseFontSize - 1, 8),
      color: t.colors.mutedText,
      textTransform: 'uppercase',
    },
    highlightValue: {
      fontSize: Math.max(t.typography.baseFontSize + 1, 10),
      fontWeight: 'bold',
      color: t.colors.text,
    },
    section: {
      marginBottom: 14,
      padding: 12,
      backgroundColor: t.colors.sectionBackground,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    sectionTitle: {
      fontSize: t.typography.sectionTitleFontSize,
      fontWeight: 'bold',
      color: t.colors.text,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.tableBorder,
      paddingBottom: 4,
    },
    row: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    label: {
      width: '34%',
      fontWeight: 'bold',
      color: t.colors.mutedText,
    },
    value: {
      width: '66%',
      color: t.colors.text,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: t.colors.tableHeaderBackground,
      color: t.colors.tableHeaderText,
      padding: 8,
      fontWeight: 'bold',
      fontSize: Math.max(t.typography.baseFontSize - 1, 8),
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: t.colors.tableBorder,
      padding: 8,
      fontSize: Math.max(t.typography.baseFontSize - 1, 8),
    },
    colDescription: { width: '42%' },
    colQty: { width: '12%', textAlign: 'center' },
    colUnit: { width: '16%', textAlign: 'right' },
    colDiscount: { width: '14%', textAlign: 'right' },
    colTotal: { width: '16%', textAlign: 'right' },
    totalsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 3,
    },
    totalsLabel: {
      width: 120,
      color: t.colors.mutedText,
      textAlign: 'right',
      marginRight: 12,
    },
    totalsValue: {
      width: 100,
      textAlign: 'right',
      fontWeight: 'bold',
      color: t.colors.text,
    },
    footer: {
      position: 'absolute',
      bottom: footerBottom,
      left: footerLeftRight,
      right: footerRightRight,
      borderTopWidth: 1,
      borderTopColor: t.colors.tableBorder,
      paddingTop: 10,
      fontSize: Math.max(t.typography.baseFontSize - 2, 7),
      color: t.colors.mutedText,
      textAlign: 'center',
    },
  })
}

function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

function lineSubtotal(item: OrdenCompraPdfItem) {
  return Math.max(0, item.cantidad * item.precioUnitario - item.descuento)
}

function lineTotal(item: OrdenCompraPdfItem) {
  return lineSubtotal(item) + item.iva
}

function currency(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

export function OrdenCompraPDFCore({ pdf, orden, empresa, template }: OrdenCompraPdfCoreProps) {
  const { Document, Page, Text, View, Image, StyleSheet } = pdf
  const t = mergeOrdenCompraTemplateSettings(template ?? DEFAULT_ORDEN_COMPRA_TEMPLATE)
  const styles = createStyles(t, StyleSheet)
  const logoSrc = t.header.logoUrl || t.header.logo || empresa?.logo

  const subtotalSinIva = orden.items.reduce((acc, item) => acc + lineSubtotal(item), 0)
  const iva = orden.items.reduce((acc, item) => acc + item.iva, 0)
  const descuento = orden.items.reduce((acc, item) => acc + item.descuento, 0)
  const total = subtotalSinIva + iva

  return (
    <Document>
      <Page size={t.page.size} orientation={t.page.orientation} style={styles.page}>
        <View style={styles.contentMargin}>
          <View style={styles.contentPadding}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.title}>{t.header.title}</Text>
                <Text style={styles.company}>{t.header.companyName || empresa?.nombre || 'SGDigital Softwares'}</Text>
                {t.header.subtitle1 ? <Text style={styles.company}>{t.header.subtitle1}</Text> : null}
                {t.header.subtitle2 ? <Text style={styles.company}>{t.header.subtitle2}</Text> : null}
                {t.header.customText ? <Text style={styles.company}>{t.header.customText}</Text> : null}
              </View>
              {t.header.showLogo && logoSrc ? <Image style={styles.logo} src={logoSrc} /> : null}
            </View>

            <View style={styles.highlightBox}>
              <View style={styles.highlightRow}>
                <View>
                  <Text style={styles.highlightLabel}>Orden</Text>
                  <Text style={styles.highlightValue}>{orden.numeroOrden || 'Sin consecutivo'}</Text>
                </View>
                <View>
                  <Text style={styles.highlightLabel}>Fecha</Text>
                  <Text style={styles.highlightValue}>{formatDate(orden.fechaCompra)}</Text>
                </View>
                <View>
                  <Text style={styles.highlightLabel}>Estado</Text>
                  <Text style={styles.highlightValue}>{orden.autorizado ? 'Autorizada' : 'Pendiente'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Proveedor y despacho</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Proveedor:</Text>
                <Text style={styles.value}>{orden.proveedorNombre}</Text>
              </View>
              {t.sections.showSupplierContact && orden.proveedorTelefono ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Teléfono:</Text>
                  <Text style={styles.value}>{orden.proveedorTelefono}</Text>
                </View>
              ) : null}
              {t.sections.showSupplierContact && orden.proveedorDireccion ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Dirección:</Text>
                  <Text style={styles.value}>{orden.proveedorDireccion}</Text>
                </View>
              ) : null}
              {t.sections.showRequestNumber && orden.numeroPedido ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Pedido:</Text>
                  <Text style={styles.value}>{orden.numeroPedido}</Text>
                </View>
              ) : null}
              {t.sections.showSite && orden.sede ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Sede destino:</Text>
                  <Text style={styles.value}>{orden.sede}</Text>
                </View>
              ) : null}
              {t.sections.showPreparedBy && orden.recibidoPorNombre ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Responsable:</Text>
                  <Text style={styles.value}>{orden.recibidoPorNombre}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detalle solicitado</Text>
              <View style={styles.tableHeader}>
                <Text style={styles.colDescription}>Descripción</Text>
                <Text style={styles.colQty}>Cant.</Text>
                <Text style={styles.colUnit}>P. unit</Text>
                <Text style={styles.colDiscount}>Desc.</Text>
                <Text style={styles.colTotal}>Total</Text>
              </View>
              {orden.items.map((item, index) => (
                <View key={`${item.descripcion}-${index}`} style={styles.tableRow}>
                  <Text style={styles.colDescription}>{item.descripcion}</Text>
                  <Text style={styles.colQty}>{item.cantidad}</Text>
                  <Text style={styles.colUnit}>{currency(item.precioUnitario)}</Text>
                  <Text style={styles.colDiscount}>{currency(item.descuento)}</Text>
                  <Text style={styles.colTotal}>{currency(lineTotal(item))}</Text>
                </View>
              ))}
            </View>

            {t.sections.showTotals ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Totales</Text>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Subtotal sin IVA</Text>
                  <Text style={styles.totalsValue}>{currency(subtotalSinIva)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Descuento</Text>
                  <Text style={styles.totalsValue}>{currency(descuento)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>IVA</Text>
                  <Text style={styles.totalsValue}>{currency(iva)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total</Text>
                  <Text style={styles.totalsValue}>{currency(total)}</Text>
                </View>
              </View>
            ) : null}

            {t.sections.showNotes && orden.observaciones ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Observaciones</Text>
                <Text>{orden.observaciones}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.footer}>
          {t.footer.showTimestamp ? <Text>Orden generada el {new Date().toLocaleString('es-CO')}</Text> : null}
          {t.footer.showPageNumbers ? (
            <Text render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Página ${pageNumber} de ${totalPages}`} />
          ) : null}
          <Text>{t.footer.customText}</Text>
        </View>
      </Page>
    </Document>
  )
}