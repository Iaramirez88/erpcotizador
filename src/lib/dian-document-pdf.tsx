import React, { createElement } from 'react'
import { prisma } from '@/lib/prisma'
import { getReactPdfRenderer, pdfToBuffer } from '@/lib/react-pdf-node'
import type { ReactPdfComponents } from '@/lib/pdf-template'
import {
  buildAbsoluteVerificationUrl,
  buildDianDocumentVerificationPath,
  createVerificationQrDataUrl,
  DOCUMENT_QR_CARD_WIDTH,
  DOCUMENT_QR_IMAGE_SIZE,
  DOCUMENT_QR_SIZE,
} from '@/lib/document-verification'

function normalizeAssetUrl(value: unknown, origin: string): string | undefined {
  if (typeof value !== 'string') return undefined
  const raw = value.trim()
  if (!raw) return undefined
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`
  return undefined
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

function currency(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return '—'
  const parsed = typeof date === 'string' ? new Date(date) : date
  return parsed.toLocaleString('es-CO')
}

function textFromPayload(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberFromPayload(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

type PayloadLineItem = {
  descripcion: string
  quantity: number
  unitPrice: number
  total: number
}

function buildPayloadSummary(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      customerName: null,
      customerDocument: null,
      subtotal: null,
      iva: null,
      total: null,
      items: [] as PayloadLineItem[],
    }
  }

  const data = payload as Record<string, unknown>
  const ui = data.ui && typeof data.ui === 'object' && !Array.isArray(data.ui)
    ? (data.ui as Record<string, unknown>)
    : null
  const customer = data.customer && typeof data.customer === 'object' && !Array.isArray(data.customer)
    ? (data.customer as Record<string, unknown>)
    : null
  const buyer = ui?.buyer && typeof ui.buyer === 'object' && !Array.isArray(ui.buyer)
    ? (ui.buyer as Record<string, unknown>)
    : null
  const totals = data.totals && typeof data.totals === 'object' && !Array.isArray(data.totals)
    ? (data.totals as Record<string, unknown>)
    : null
  const uiTotals = ui?.totals && typeof ui.totals === 'object' && !Array.isArray(ui.totals)
    ? (ui.totals as Record<string, unknown>)
    : null
  const rawItems = Array.isArray(ui?.items)
    ? ui.items
    : Array.isArray(data.items)
      ? data.items
      : []

  const items = rawItems
    .map((item) => {
      const row = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : null
      if (!row) return null

      const descripcion =
        textFromPayload(row.descripcion) ||
        textFromPayload(row.description) ||
        textFromPayload(row.nombre) ||
        ''
      const quantity = numberFromPayload(row.quantity) ?? numberFromPayload(row.cantidad) ?? 0
      const unitPrice = numberFromPayload(row.unitPrice) ?? numberFromPayload(row.precioUnitario) ?? 0
      const total = numberFromPayload(row.total) ?? quantity * unitPrice

      if (!descripcion || quantity <= 0) return null

      return { descripcion, quantity, unitPrice, total }
    })
    .filter((item): item is PayloadLineItem => Boolean(item))

  return {
    customerName:
      textFromPayload(buyer?.nombre) ||
      textFromPayload(buyer?.name) ||
      textFromPayload(customer?.name) ||
      textFromPayload(data.customerName) ||
      textFromPayload(data.clienteNombre),
    customerDocument:
      textFromPayload(buyer?.documento) ||
      textFromPayload(buyer?.document) ||
      textFromPayload(customer?.document) ||
      textFromPayload(data.customerDocument) ||
      textFromPayload(data.clienteDocumento),
    subtotal:
      numberFromPayload(uiTotals?.subtotal) ??
      numberFromPayload(totals?.subtotal) ??
      numberFromPayload(data.subtotal),
    iva:
      numberFromPayload(uiTotals?.iva) ??
      numberFromPayload(uiTotals?.tax) ??
      numberFromPayload(totals?.tax) ??
      numberFromPayload(totals?.iva) ??
      numberFromPayload(data.iva),
    total:
      numberFromPayload(uiTotals?.total) ??
      numberFromPayload(totals?.total) ??
      numberFromPayload(data.total),
    items,
  }
}

type DianDocumentPdfData = {
  id: string
  numero?: string | null
  status: string
  direction: string
  type: string
  createdAt: Date
  transmittedAt?: Date | null
  expeditedAt?: Date | null
  deliveredAt?: Date | null
  receivedAt?: Date | null
  provider?: string | null
  providerRef?: string | null
  uuid?: string | null
  cufe?: string | null
  lastError?: string | null
  payload: unknown
  empresa?: {
    nombre: string
    nit?: string | null
    direccion?: string | null
    telefono?: string | null
    logo?: string | null
  } | null
  posInvoice?: {
    numero: string
    clienteNombre: string
    clienteDocumento?: string | null
    subtotal: number
    iva: number
    total: number
    items: Array<{ descripcion: string; quantity: number; unitPrice: number; total: number }>
  } | null
  posReturn?: {
    numero: string
    total: number
    motivo?: string | null
  } | null
}

type DianDocumentPdfCoreProps = {
  pdf: ReactPdfComponents
  document: DianDocumentPdfData
  verificationUrl: string
  verificationQrDataUrl?: string
}

function createStyles(StyleSheet: ReactPdfComponents['StyleSheet']) {
  return StyleSheet.create({
    page: {
      paddingTop: 42,
      paddingRight: 42,
      paddingBottom: 42,
      paddingLeft: 42,
      fontSize: 10,
      fontFamily: 'Helvetica',
      color: '#0f172a',
      position: 'relative',
      backgroundColor: '#ffffff',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottomWidth: 2,
      borderBottomColor: '#0f766e',
      paddingBottom: 12,
      marginBottom: 18,
    },
    headerLeft: { maxWidth: '68%' },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#0f766e',
      marginBottom: 4,
    },
    subtitle: { fontSize: 10, color: '#475569', marginBottom: 2 },
    logo: { width: 92, height: 48, objectFit: 'contain' },
    block: {
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      backgroundColor: '#f8fafc',
    },
    blockTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      marginBottom: 8,
      color: '#0f172a',
    },
    metrics: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    metric: {
      flexGrow: 1,
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 8,
      padding: 10,
      backgroundColor: '#f8fafc',
    },
    metricLabel: { fontSize: 8, color: '#64748b', textTransform: 'uppercase' },
    metricValue: { fontSize: 11, fontWeight: 'bold', marginTop: 3, color: '#0f172a' },
    row: { flexDirection: 'row', marginBottom: 4 },
    label: { width: '33%', fontWeight: 'bold', color: '#475569' },
    value: { width: '67%', color: '#0f172a' },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#0f766e',
      color: '#ffffff',
      padding: 8,
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      fontWeight: 'bold',
      fontSize: 9,
    },
    tableRow: {
      flexDirection: 'row',
      padding: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#e2e8f0',
      fontSize: 9,
      backgroundColor: '#ffffff',
    },
    colDescription: { width: '46%' },
    colQty: { width: '12%', textAlign: 'center' },
    colUnit: { width: '20%', textAlign: 'right' },
    colTotal: { width: '22%', textAlign: 'right' },
    totalsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
    totalsLabel: { width: 120, marginRight: 12, color: '#475569', textAlign: 'right' },
    totalsValue: { width: 110, fontWeight: 'bold', textAlign: 'right' },
    qrBox: {
      position: 'absolute',
      right: 42,
      bottom: 70,
      width: DOCUMENT_QR_CARD_WIDTH,
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 10,
      padding: 8,
      backgroundColor: '#ffffff',
    },
    qrTitle: { fontSize: 9, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
    qrImage: { width: DOCUMENT_QR_IMAGE_SIZE, height: DOCUMENT_QR_IMAGE_SIZE, alignSelf: 'center' },
    qrUrl: { fontSize: 7, color: '#64748b', marginTop: 6, textAlign: 'center' },
    footer: {
      position: 'absolute',
      left: 42,
      right: 42,
      bottom: 24,
      borderTopWidth: 1,
      borderTopColor: '#e2e8f0',
      paddingTop: 8,
      fontSize: 8,
      color: '#64748b',
      textAlign: 'center',
    },
  })
}

function DianDocumentPDFCore({ pdf, document, verificationUrl, verificationQrDataUrl }: DianDocumentPdfCoreProps) {
  const { Document, Page, Text, View, Image, StyleSheet } = pdf
  const styles = createStyles(StyleSheet)
  const payloadSummary = buildPayloadSummary(document.payload)
  const invoice = document.posInvoice
  const lineItems = invoice?.items?.length ? invoice.items : payloadSummary.items
  const totals = {
    subtotal: invoice?.subtotal ?? payloadSummary.subtotal,
    iva: invoice?.iva ?? payloadSummary.iva,
    total: invoice?.total ?? document.posReturn?.total ?? payloadSummary.total,
  }
  const customerName = invoice?.clienteNombre ?? payloadSummary.customerName ?? 'No definido'
  const customerDocument = invoice?.clienteDocumento ?? payloadSummary.customerDocument

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Documento DIAN</Text>
            <Text style={styles.subtitle}>{document.empresa?.nombre || 'SGDigital Softwares'}</Text>
            {document.empresa?.nit ? <Text style={styles.subtitle}>NIT: {document.empresa.nit}</Text> : null}
            {document.empresa?.direccion ? <Text style={styles.subtitle}>{document.empresa.direccion}</Text> : null}
          </View>
          {document.empresa?.logo ? <Image style={styles.logo} src={document.empresa.logo} /> : null}
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Documento</Text>
            <Text style={styles.metricValue}>{document.numero || invoice?.numero || document.posReturn?.numero || document.id}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Tipo</Text>
            <Text style={styles.metricValue}>{document.type}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Estado</Text>
            <Text style={styles.metricValue}>{document.status}</Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Datos del documento</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Dirección:</Text>
            <Text style={styles.value}>{document.direction}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Creado:</Text>
            <Text style={styles.value}>{formatDate(document.createdAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Transmitido:</Text>
            <Text style={styles.value}>{formatDate(document.transmittedAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>UUID:</Text>
            <Text style={styles.value}>{document.uuid || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>CUFE:</Text>
            <Text style={styles.value}>{document.cufe || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Ref. proveedor:</Text>
            <Text style={styles.value}>{document.providerRef || '—'}</Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Tercero relacionado</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Cliente:</Text>
            <Text style={styles.value}>{customerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Documento:</Text>
            <Text style={styles.value}>{customerDocument || '—'}</Text>
          </View>
          {document.provider ? (
            <View style={styles.row}>
              <Text style={styles.label}>Proveedor:</Text>
              <Text style={styles.value}>{document.provider}</Text>
            </View>
          ) : null}
        </View>

        {lineItems.length ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Detalle de la factura</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.colDescription}>Descripción</Text>
              <Text style={styles.colQty}>Cant.</Text>
              <Text style={styles.colUnit}>P. unit</Text>
              <Text style={styles.colTotal}>Total</Text>
            </View>
            {lineItems.map((item, index) => (
              <View key={`${item.descripcion}-${index}`} style={styles.tableRow}>
                <Text style={styles.colDescription}>{item.descripcion}</Text>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colUnit}>{currency(item.unitPrice)}</Text>
                <Text style={styles.colTotal}>{currency(item.total)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {totals.total !== null ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Totales</Text>
            {totals.subtotal !== null ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal</Text>
                <Text style={styles.totalsValue}>{currency(totals.subtotal)}</Text>
              </View>
            ) : null}
            {totals.iva !== null ? (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>IVA</Text>
                <Text style={styles.totalsValue}>{currency(totals.iva)}</Text>
              </View>
            ) : null}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Total</Text>
              <Text style={styles.totalsValue}>{currency(totals.total)}</Text>
            </View>
          </View>
        ) : null}

        {verificationQrDataUrl ? (
          <View style={styles.qrBox}>
            <Text style={styles.qrTitle}>Verificar original</Text>
            <Image style={styles.qrImage} src={verificationQrDataUrl} />
            <Text style={styles.qrUrl}>{verificationUrl}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>Escanea el QR o abre la URL para validar el documento original emitido por SGDigital.</Text>
          {document.lastError ? <Text>Último error registrado: {document.lastError}</Text> : null}
        </View>
      </Page>
    </Document>
  )
}

export async function loadDianDocumentPdfSource(documentId: string) {
  return prisma.dianElectronicDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      empresaId: true,
      sedeId: true,
      numero: true,
      status: true,
      direction: true,
      type: true,
      createdAt: true,
      transmittedAt: true,
      expeditedAt: true,
      deliveredAt: true,
      receivedAt: true,
      provider: true,
      providerRef: true,
      uuid: true,
      cufe: true,
      lastError: true,
      payload: true,
      empresa: {
        select: { nombre: true, nit: true, direccion: true, telefono: true, logo: true },
      },
      posInvoice: {
        select: {
          numero: true,
          clienteNombre: true,
          clienteDocumento: true,
          subtotal: true,
          iva: true,
          total: true,
          items: {
            orderBy: { createdAt: 'asc' },
            select: { descripcion: true, quantity: true, unitPrice: true, total: true },
          },
        },
      },
      posReturn: {
        select: { numero: true, total: true, motivo: true },
      },
    },
  })
}

export async function renderDianDocumentPdf(args: { documentId: string; origin: string }) {
  const document = await loadDianDocumentPdfSource(args.documentId)
  if (!document) return null

  const renderer = await getReactPdfRenderer()
  const hydratedDocument = {
    ...document,
    empresa: document.empresa
      ? {
          ...document.empresa,
          logo: normalizeAssetUrl(document.empresa.logo, args.origin) ?? document.empresa.logo,
        }
      : null,
  }
  const verificationUrl = buildAbsoluteVerificationUrl(args.origin, buildDianDocumentVerificationPath(document.id))
  const verificationQrDataUrl = await createVerificationQrDataUrl(verificationUrl, DOCUMENT_QR_SIZE)

  async function renderDocumentPdf() {
    const pdfDoc = DianDocumentPDFCore({
      pdf: {
        Document: renderer.Document,
        Page: renderer.Page,
        Text: renderer.Text,
        View: renderer.View,
        Image: renderer.Image,
        StyleSheet: renderer.StyleSheet,
      },
      document: hydratedDocument,
      verificationUrl,
      verificationQrDataUrl,
    })

    return pdfToBuffer(pdfDoc)
  }

  async function renderMinimalPdf() {
    const minimalDoc = createElement(
      renderer.Document,
      null,
      createElement(
        renderer.Page,
        { size: 'A4', style: { padding: 40, fontSize: 11, fontFamily: 'Helvetica' } },
        createElement(renderer.Text, { style: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 } }, 'DOCUMENTO DIAN'),
        createElement(renderer.Text, null, `ID: ${hydratedDocument.id}`),
        createElement(renderer.Text, null, `Estado: ${hydratedDocument.status}`),
        createElement(renderer.Text, null, `Tipo: ${hydratedDocument.type}`),
        createElement(renderer.Text, { style: { marginTop: 12 } }, `Verificación: ${verificationUrl}`),
        verificationQrDataUrl
          ? createElement(renderer.Image, { src: verificationQrDataUrl, style: { width: DOCUMENT_QR_SIZE, height: DOCUMENT_QR_SIZE, marginTop: 16 } })
          : null,
      ),
    )

    return pdfToBuffer(minimalDoc)
  }

  let buffer: Buffer | null = null
  let lastError: unknown = null

  for (const attempt of [renderDocumentPdf, renderMinimalPdf]) {
    try {
      buffer = await attempt()
      break
    } catch (error) {
      lastError = error
      console.warn('PDF DIAN: intento fallido', error)
    }
  }

  if (!buffer) {
    throw new Error(lastError instanceof Error ? lastError.message : 'Error desconocido')
  }

  return {
    document: hydratedDocument,
    verificationUrl,
    arrayBuffer: bufferToArrayBuffer(buffer),
    buffer,
  }
}