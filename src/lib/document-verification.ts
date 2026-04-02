import QRCode from 'qrcode'

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, '')
}

export function buildPosInvoiceVerificationPath(invoiceId: string) {
  return `/verificar/facturas/${encodeURIComponent(invoiceId)}`
}

export function buildDianDocumentVerificationPath(documentId: string) {
  return `/verificar/dian/${encodeURIComponent(documentId)}`
}

export function buildAbsoluteVerificationUrl(origin: string, path: string) {
  return `${normalizeOrigin(origin)}${path}`
}

export async function createVerificationQrDataUrl(url: string, size = 180) {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
  })
}