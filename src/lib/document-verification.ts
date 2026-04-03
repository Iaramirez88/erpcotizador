import QRCode from 'qrcode'

export const DOCUMENT_QR_SIZE = 90
export const DOCUMENT_QR_IMAGE_SIZE = 74
export const DOCUMENT_QR_CARD_WIDTH = 104

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, '')
}

export function buildPosInvoiceVerificationPath(invoiceId: string) {
  return `/api/public/verificar/facturas/${encodeURIComponent(invoiceId)}`
}

export function buildDianDocumentVerificationPath(documentId: string) {
  return `/api/public/verificar/dian/${encodeURIComponent(documentId)}`
}

export function buildAbsoluteVerificationUrl(origin: string, path: string) {
  return `${normalizeOrigin(origin)}${path}`
}

export async function createVerificationQrDataUrl(url: string, size = DOCUMENT_QR_SIZE) {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
  })
}