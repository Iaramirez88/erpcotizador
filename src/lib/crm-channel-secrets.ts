import crypto from 'node:crypto'

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4)
  return Buffer.from(padded, 'base64')
}

function getSecretMaterial() {
  const secret = process.env.CRM_CHANNEL_SECRET || process.env.NEXTAUTH_SECRET || ''
  if (!secret) {
    throw new Error('Falta configurar CRM_CHANNEL_SECRET o NEXTAUTH_SECRET para credenciales CRM.')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptChannelSecret(plainText: string) {
  if (!plainText) return ''

  const key = getSecretMaterial()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [base64UrlEncode(iv), base64UrlEncode(tag), base64UrlEncode(encrypted)].join('.')
}

export function decryptChannelSecret(payload: string | null | undefined) {
  if (!payload) return ''

  const [ivPart, tagPart, encryptedPart] = payload.split('.')
  if (!ivPart || !tagPart || !encryptedPart) return ''

  try {
    const key = getSecretMaterial()
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, base64UrlDecode(ivPart))
    decipher.setAuthTag(base64UrlDecode(tagPart))
    const decrypted = Buffer.concat([decipher.update(base64UrlDecode(encryptedPart)), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    return ''
  }
}

type SignedStatePayload = {
  channelId: string
  empresaId: string
  userId: string
  issuedAt: number
}

export function createSignedCrmState(payload: SignedStatePayload) {
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const signature = base64UrlEncode(crypto.createHmac('sha256', getSecretMaterial()).update(payloadB64).digest())
  return `${payloadB64}.${signature}`
}

export function verifySignedCrmState(token: string, maxAgeSeconds = 15 * 60): SignedStatePayload | null {
  const [payloadB64, signature] = token.split('.')
  if (!payloadB64 || !signature) return null

  const expected = base64UrlEncode(crypto.createHmac('sha256', getSecretMaterial()).update(payloadB64).digest())
  const receivedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (receivedBuffer.length !== expectedBuffer.length) return null
  if (!crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as SignedStatePayload
    if (!payload?.channelId || !payload?.empresaId || !payload?.userId || typeof payload?.issuedAt !== 'number') {
      return null
    }
    const ageSeconds = Math.floor(Date.now() / 1000) - payload.issuedAt
    if (ageSeconds < 0 || ageSeconds > maxAgeSeconds) return null
    return payload
  } catch {
    return null
  }
}