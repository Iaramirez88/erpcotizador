const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'span', 'div', 'font'])
const ALLOWED_STYLE_PROPS = new Set(['font-size', 'font-weight', 'font-style', 'text-decoration', 'text-align', 'line-height'])

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function sanitizeStyleAttribute(rawStyle: string) {
  return rawStyle
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [rawProp, ...rawValueParts] = entry.split(':')
      const prop = rawProp?.trim().toLowerCase()
      const value = rawValueParts.join(':').trim()
      if (!prop || !value || !ALLOWED_STYLE_PROPS.has(prop)) return null
      if (/expression|javascript:|url\s*\(/i.test(value)) return null
      return `${prop}:${value}`
    })
    .filter((entry): entry is string => Boolean(entry))
    .join('; ')
}

export function hasRichTextMarkup(value: string) {
  return /<\/?[a-z][^>]*>/i.test(value)
}

export function plainTextToRichTextHtml(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function normalizeRichTextHtml(value: string) {
  const source = hasRichTextMarkup(value) ? value : plainTextToRichTextHtml(value)
  if (!source.trim()) return ''

  return source
    .replace(/<\/?(script|style|iframe|object|embed|meta|link)[^>]*>/gi, '')
    .replace(/ on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, rawTag: string, rawAttrs: string) => {
      const isClosing = full.startsWith('</')
      const tag = rawTag.toLowerCase()
      if (!ALLOWED_TAGS.has(tag)) return ''
      if (isClosing) return `</${tag}>`
      if (tag === 'br') return '<br>'

      const styleMatch = rawAttrs.match(/style\s*=\s*("([^"]*)"|'([^']*)')/i)
      const sanitizedStyle = sanitizeStyleAttribute(styleMatch?.[2] || styleMatch?.[3] || '')
      return sanitizedStyle ? `<${tag} style="${escapeHtml(sanitizedStyle)}">` : `<${tag}>`
    })
    .replace(/<(div|span)>(\s|&nbsp;)*<\/(div|span)>/gi, '')
    .trim()
}

export function richTextToPlainText(value: string) {
  const normalized = normalizeRichTextHtml(value)
  if (!normalized) return ''

  const withBreaks = normalized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|li)>/gi, '\n')
    .replace(/<(ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')

  return decodeHtml(withBreaks)
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function summarizeRichText(value: string, fallback: string, limit = 160) {
  const text = richTextToPlainText(value)
  if (!text) return fallback
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}...` : text
}