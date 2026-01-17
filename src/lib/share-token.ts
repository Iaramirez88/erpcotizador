import crypto from 'crypto'

type SharePayload = {
  cotizacionId: string
  exp: number
}

function base64UrlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + pad, 'base64')
}

function sign(secret: string, payloadB64: string) {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(payloadB64).digest())
}

export function createCotizacionShareToken(params: {
  cotizacionId: string
  ttlSeconds: number
  secret: string
}) {
  const payload: SharePayload = {
    cotizacionId: params.cotizacionId,
    exp: Math.floor(Date.now() / 1000) + params.ttlSeconds,
  }

  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const sig = sign(params.secret, payloadB64)
  return `${payloadB64}.${sig}`
}

export function verifyCotizacionShareToken(token: string, secret: string): { cotizacionId: string } | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [payloadB64, sig] = parts
  const expected = sign(secret, payloadB64)

  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!crypto.timingSafeEqual(a, b)) return null

  let payload: SharePayload
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as SharePayload
  } catch {
    return null
  }

  if (!payload?.cotizacionId || typeof payload.exp !== 'number') return null
  if (Math.floor(Date.now() / 1000) > payload.exp) return null

  return { cotizacionId: payload.cotizacionId }
}
