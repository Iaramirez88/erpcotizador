export function normalizeWhatsAppPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (!trimmed) return null

  const withoutPrefix = trimmed.replace(/^tel:/i, '').trim()
  if (!withoutPrefix) return null

  // WhatsApp wa.me requiere solo dígitos (con código de país), sin +, espacios ni símbolos.
  // Ejemplos válidos: 5215512345678, 573001234567
  let digits = withoutPrefix

  // Manejar prefijo internacional "00" (e.g. 0057...)
  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  // Quitar todo lo que no sea dígito
  digits = digits.replace(/\D/g, '')

  if (!digits) return null
  if (digits.length < 8) return null

  return digits
}

export function buildWhatsAppWebUrl(args: { phone?: unknown; message: string }): string {
  const phone = normalizeWhatsAppPhone(args.phone)
  const text = encodeURIComponent(args.message ?? '')

  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`
}
