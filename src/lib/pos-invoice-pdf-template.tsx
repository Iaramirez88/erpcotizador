import React from 'react'
import type { ReactPdfComponents } from '@/lib/pdf-template'
import {
  DEFAULT_POS_INVOICE_TEMPLATE,
  PosInvoiceTemplateSettings,
  mergePosInvoiceTemplateSettings,
} from '@/lib/pos-invoice-template'

export interface PosInvoicePdfItem {
  descripcion: string
  quantity: number
  unitPrice: number
  total: number
}

export interface PosInvoicePdfPayment {
  method: string
  amount: number
  note?: string | null
  receivedAt?: string | Date | null
}

export interface PosInvoicePdfProps {
  invoice: {
    numero: string
    createdAt: Date | string
    status: string
    clienteNombre: string
    clienteDocumento?: string | null
    warehouse?: { nombre?: string | null; codigo?: string | null } | null
    subtotal: number
    iva: number
    total: number
    note?: string | null
    items: PosInvoicePdfItem[]
    payments?: PosInvoicePdfPayment[]
  }
  empresa?: {
    nombre?: string
    nit?: string
    direccion?: string
    telefono?: string
    logo?: string
  }
  template?: PosInvoiceTemplateSettings | unknown
}

export interface PosInvoicePdfCoreProps extends PosInvoicePdfProps {
  pdf: ReactPdfComponents
}

function currency(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

function createStyles(t: PosInvoiceTemplateSettings, StyleSheet: ReactPdfComponents['StyleSheet']) {
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
    headerLeft: { flexGrow: 1, paddingRight: 14 },
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
    logo: { width: 88, height: 42, objectFit: 'contain' },
    highlightBox: {
      backgroundColor: t.colors.highlightBackground,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 14,
    },
    highlightRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
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
      marginTop: 2,
    },
    statusBadge: {
      marginTop: 8,
      alignSelf: 'flex-start',
      backgroundColor: t.colors.primary,
      color: t.colors.tableHeaderText,
      borderRadius: 999,
      paddingTop: 4,
      paddingRight: 10,
      paddingBottom: 4,
      paddingLeft: 10,
      fontSize: Math.max(t.typography.baseFontSize - 1, 8),
    },
    section: {
      marginBottom: 14,
      padding: 12,
      backgroundColor: t.colors.sectionBackground,
      borderRadius: 8,
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
    row: { flexDirection: 'row', marginBottom: 4 },
    label: { width: '35%', fontWeight: 'bold', color: t.colors.mutedText },
    value: { width: '65%', color: t.colors.text },
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
    colDescription: { width: '46%' },
    colQty: { width: '12%', textAlign: 'center' },
    colUnit: { width: '20%', textAlign: 'right' },
    colTotal: { width: '22%', textAlign: 'right' },
    totalsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 4,
    },
    totalsLabel: { width: 120, color: t.colors.mutedText, textAlign: 'right', marginRight: 12 },
    totalsValue: { width: 110, textAlign: 'right', fontWeight: 'bold', color: t.colors.text },
    paymentRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: t.colors.tableBorder,
      paddingTop: 6,
      paddingBottom: 6,
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

export function PosInvoicePDFCore({ pdf, invoice, empresa, template }: PosInvoicePdfCoreProps) {
  const { Document, Page, Text, View, Image, StyleSheet } = pdf
  const t = mergePosInvoiceTemplateSettings(template ?? DEFAULT_POS_INVOICE_TEMPLATE)
  const styles = createStyles(t, StyleSheet)
  const logoSrc = t.header.logoUrl || t.header.logo || empresa?.logo
  const paid = (invoice.payments ?? []).reduce((acc, payment) => acc + payment.amount, 0)
  const balance = Math.max(0, invoice.total - paid)

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
                  <Text style={styles.highlightLabel}>Factura</Text>
                  <Text style={styles.highlightValue}>{invoice.numero}</Text>
                </View>
                <View>
                  <Text style={styles.highlightLabel}>Fecha</Text>
                  <Text style={styles.highlightValue}>{formatDate(invoice.createdAt)}</Text>
                </View>
                <View>
                  <Text style={styles.highlightLabel}>Total</Text>
                  <Text style={styles.highlightValue}>{currency(invoice.total)}</Text>
                </View>
              </View>
              {t.sections.showStatusBadge ? <Text style={styles.statusBadge}>{invoice.status}</Text> : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cliente y despacho</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Cliente:</Text>
                <Text style={styles.value}>{invoice.clienteNombre}</Text>
              </View>
              {t.sections.showCustomerDocument && invoice.clienteDocumento ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Documento:</Text>
                  <Text style={styles.value}>{invoice.clienteDocumento}</Text>
                </View>
              ) : null}
              {t.sections.showWarehouse && invoice.warehouse?.nombre ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Sede / caja:</Text>
                  <Text style={styles.value}>{invoice.warehouse.nombre}{invoice.warehouse.codigo ? ` (${invoice.warehouse.codigo})` : ''}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detalle facturado</Text>
              <View style={styles.tableHeader}>
                <Text style={styles.colDescription}>Descripción</Text>
                <Text style={styles.colQty}>Cant.</Text>
                <Text style={styles.colUnit}>P. unit</Text>
                <Text style={styles.colTotal}>Total</Text>
              </View>
              {invoice.items.map((item, index) => (
                <View key={`${item.descripcion}-${index}`} style={styles.tableRow}>
                  <Text style={styles.colDescription}>{item.descripcion}</Text>
                  <Text style={styles.colQty}>{item.quantity}</Text>
                  <Text style={styles.colUnit}>{currency(item.unitPrice)}</Text>
                  <Text style={styles.colTotal}>{currency(item.total)}</Text>
                </View>
              ))}
            </View>

            {t.sections.showTotals ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Totales</Text>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Subtotal</Text>
                  <Text style={styles.totalsValue}>{currency(invoice.subtotal)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>IVA</Text>
                  <Text style={styles.totalsValue}>{currency(invoice.iva)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total</Text>
                  <Text style={styles.totalsValue}>{currency(invoice.total)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Pagado</Text>
                  <Text style={styles.totalsValue}>{currency(paid)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Saldo</Text>
                  <Text style={styles.totalsValue}>{currency(balance)}</Text>
                </View>
              </View>
            ) : null}

            {t.sections.showPayments && invoice.payments?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pagos registrados</Text>
                {invoice.payments.map((payment, index) => (
                  <View key={`${payment.method}-${index}`} style={styles.paymentRow}>
                    <Text>{payment.method}</Text>
                    <Text>{currency(payment.amount)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {t.sections.showNotes && invoice.note ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Observaciones</Text>
                <Text>{invoice.note}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.footer}>
          {t.footer.showTimestamp ? <Text>Factura generada el {new Date().toLocaleString('es-CO')}</Text> : null}
          {t.footer.showPageNumbers ? (
            <Text render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Página ${pageNumber} de ${totalPages}`} />
          ) : null}
          <Text>{t.footer.customText}</Text>
        </View>
      </Page>
    </Document>
  )
}