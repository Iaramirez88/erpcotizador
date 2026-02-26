import React from 'react'
import type { ReactPdfComponents } from '@/lib/pdf-template'
import {
  RemisionTemplateSettings,
  DEFAULT_REMISION_TEMPLATE,
  mergeRemisionTemplateSettings,
} from '@/lib/remision-template'

/* eslint-disable jsx-a11y/alt-text */

export interface RemisionItem {
  quantity: number
  note?: string | null
  material: {
    nombre: string
    unidadMedida: string
  }
}

export interface RemisionPDFProps {
  remision: {
    numero: string
    createdAt: Date | string
    status: string
    clienteNombre?: string | null
    note?: string | null
    warehouse?: {
      nombre: string
    } | null
    items: RemisionItem[]
    createdBy?: {
      name: string | null
      email: string | null
    } | null
  }
  empresa?: {
    nombre?: string
    nit?: string
    direccion?: string
    telefono?: string
    logo?: string
  }
  template?: RemisionTemplateSettings | unknown
}

export interface RemisionPDFCoreProps extends RemisionPDFProps {
  pdf: ReactPdfComponents
}

function createStyles(t: RemisionTemplateSettings, StyleSheet: ReactPdfComponents['StyleSheet']) {
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
      marginBottom: 20,
      borderBottom: 2,
      borderBottomColor: t.colors.primary,
      paddingBottom: 15,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerLeft: {
      flexGrow: 1,
    },
    logo: {
      width: 80,
      height: 38,
      objectFit: 'contain',
    },
    title: {
      fontSize: t.typography.titleFontSize,
      fontWeight: 'bold',
      color: t.colors.primary,
      marginBottom: 5,
    },
    empresa: {
      fontSize: Math.max(t.typography.baseFontSize + 1, 9),
      color: t.colors.mutedText,
      marginBottom: 2,
    },
    section: {
      marginBottom: 15,
      padding: 12,
      backgroundColor: t.colors.sectionBackground,
      borderRadius: 4,
    },
    sectionTitle: {
      fontSize: t.typography.sectionTitleFontSize,
      fontWeight: 'bold',
      color: t.colors.text,
      marginBottom: 8,
      borderBottom: 1,
      borderBottomColor: t.colors.tableBorder,
      paddingBottom: 4,
    },
    row: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    label: {
      fontWeight: 'bold',
      color: t.colors.mutedText,
      width: '35%',
    },
    value: {
      color: t.colors.text,
      width: '65%',
    },
    table: {
      marginTop: 10,
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
      borderBottom: 1,
      borderBottomColor: t.colors.tableBorder,
      padding: 8,
      fontSize: Math.max(t.typography.baseFontSize - 1, 8),
    },
    col1: { width: '10%' },
    col2: { width: '45%' },
    col3: { width: '15%', textAlign: 'center' },
    col4: { width: '30%' },
    footer: {
      position: 'absolute',
      bottom: footerBottom,
      left: footerLeftRight,
      right: footerRightRight,
      borderTop: 1,
      borderTopColor: t.colors.tableBorder,
      paddingTop: 10,
      fontSize: Math.max(t.typography.baseFontSize - 2, 7),
      color: t.colors.mutedText,
      textAlign: 'center',
    },
    statusBadge: {
      padding: '4px 8px',
      borderRadius: 4,
      fontSize: Math.max(t.typography.baseFontSize - 1, 8),
      fontWeight: 'bold',
    },
    statusEmitida: {
      backgroundColor: '#dcfce7',
      color: '#166534',
    },
    statusAnulada: {
      backgroundColor: '#fee2e2',
      color: '#991b1b',
    },
  })
}

function formatDate(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatUnidadMedida(unidad: string): string {
  const u = String(unidad || '').trim().toLowerCase()
  if (u === 'm2' || u === 'm²') return 'm²'
  if (u === 'ml' || u === 'm' || u === 'metro') return 'm'
  if (u === 'unidad' || u === 'und') return 'und'
  return unidad
}

export function RemisionPDFCore({ pdf, remision, empresa, template }: RemisionPDFCoreProps) {
  const { Document, Page, Text, View, Image, StyleSheet } = pdf
  const t = mergeRemisionTemplateSettings(template ?? DEFAULT_REMISION_TEMPLATE)
  const styles = createStyles(t, StyleSheet)

  return (
    <Document>
      <Page size={t.page.size} orientation={t.page.orientation} style={styles.page}>
        <View style={styles.contentMargin}>
          <View style={styles.contentPadding}>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.title}>{t.header.title}</Text>
                <Text style={styles.empresa}>{t.header.companyName}</Text>
                {t.header.subtitle1 ? <Text style={styles.empresa}>{t.header.subtitle1}</Text> : null}
                {t.header.subtitle2 ? <Text style={styles.empresa}>{t.header.subtitle2}</Text> : null}
              </View>
              {t.header.showLogo && t.header.logoUrl ? <Image style={styles.logo} src={t.header.logoUrl} /> : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información General</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Número:</Text>
                <Text style={styles.value}>{remision.numero}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Fecha:</Text>
                <Text style={styles.value}>{formatDate(remision.createdAt)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Estado:</Text>
                <Text
                  style={[
                    styles.value,
                    remision.status === 'EMITIDA' ? styles.statusEmitida : styles.statusAnulada,
                  ]}
                >
                  {remision.status}
                </Text>
              </View>
              {t.sections.showWarehouse && remision.warehouse?.nombre ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Sede:</Text>
                  <Text style={styles.value}>{remision.warehouse.nombre}</Text>
                </View>
              ) : null}
              {t.sections.showCliente && remision.clienteNombre ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Cliente:</Text>
                  <Text style={styles.value}>{remision.clienteNombre}</Text>
                </View>
              ) : null}
              {t.sections.showCreatedBy && remision.createdBy?.name ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Elaborado por:</Text>
                  <Text style={styles.value}>{remision.createdBy.name}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detalle de Items</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={styles.col1}>#</Text>
                  <Text style={styles.col2}>Material</Text>
                  <Text style={styles.col3}>Cantidad</Text>
                  <Text style={styles.col4}>Nota</Text>
                </View>
                {remision.items.map((item, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.col1}>{idx + 1}</Text>
                    <Text style={styles.col2}>{item.material.nombre}</Text>
                    <Text style={styles.col3}>
                      {item.quantity} {formatUnidadMedida(item.material.unidadMedida)}
                    </Text>
                    <Text style={styles.col4}>{item.note || '—'}</Text>
                  </View>
                ))}
              </View>
            </View>

            {t.sections.showObservaciones && remision.note ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Observaciones</Text>
                <Text>{remision.note}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.footer}>
          {t.footer.showTimestamp ? (
            <Text>Remisión generada el {new Date().toLocaleString('es-CO')}</Text>
          ) : null}
          {t.footer.showPageNumbers ? (
            <Text
              render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
                `Página ${pageNumber} de ${totalPages}`
              }
            />
          ) : null}
          <Text>{t.footer.customText}</Text>
        </View>
      </Page>
    </Document>
  )
}
