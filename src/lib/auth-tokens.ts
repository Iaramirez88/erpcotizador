import crypto from 'crypto'

export function randomDigits(length: number) {
  const digits = '0123456789'
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += digits[bytes[i] % 10]
  }
  return out
}

export function randomToken(bytes: number = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

export function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function timingSafeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}
