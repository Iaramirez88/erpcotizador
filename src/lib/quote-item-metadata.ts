export const QUOTE_ITEM_META_PREFIX = 'QUOTE_ITEM_META:'

export type QuoteReferenceImageScalePct = 25 | 50 | 75 | 100

export type QuoteItemExtraMeta = {
  version: 1
  additionalFieldTitle?: string
  additionalFieldDescription?: string
  additionalValue?: number
  referenceImage?: {
    name?: string
    url: string
    scalePct: QuoteReferenceImageScalePct
  }
}

export type ParsedQuoteItemObservaciones = {
  plainText: string
  extraMeta: QuoteItemExtraMeta | null
}

function parseMeta(raw: string): QuoteItemExtraMeta | null {
  const idx = raw.indexOf(QUOTE_ITEM_META_PREFIX)
  if (idx < 0) return null
  const json = raw.slice(idx + QUOTE_ITEM_META_PREFIX.length).trim()
  if (!json) return null

  try {
    const parsed = JSON.parse(json) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const record = parsed as Record<string, unknown>
    const version = Number(record.version)
    if (version !== 1) return null

    const referenceRaw =
      record.referenceImage && typeof record.referenceImage === 'object' && !Array.isArray(record.referenceImage)
        ? (record.referenceImage as Record<string, unknown>)
        : null

    const scaleCandidate = Number(referenceRaw?.scalePct)
    const scalePct: QuoteReferenceImageScalePct =
      scaleCandidate === 25 || scaleCandidate === 50 || scaleCandidate === 75 || scaleCandidate === 100
        ? scaleCandidate
        : 100

    const url = typeof referenceRaw?.url === 'string' ? referenceRaw.url.trim() : ''

    return {
      version: 1,
      additionalFieldTitle:
        typeof record.additionalFieldTitle === 'string' ? record.additionalFieldTitle.trim() || undefined : undefined,
      additionalFieldDescription:
        typeof record.additionalFieldDescription === 'string'
          ? record.additionalFieldDescription.trim() || undefined
          : undefined,
      additionalValue: (() => {
        const rawValue = typeof record.additionalValue === 'number' ? record.additionalValue : Number(record.additionalValue)
        return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : undefined
      })(),
      referenceImage: url
        ? {
            name: typeof referenceRaw?.name === 'string' ? referenceRaw.name.trim() || undefined : undefined,
            url,
            scalePct,
          }
        : undefined,
    }
  } catch {
    return null
  }
}

export function parseQuoteItemObservaciones(raw: unknown): ParsedQuoteItemObservaciones {
  const text = typeof raw === 'string' ? raw : ''
  if (!text.trim()) return { plainText: '', extraMeta: null }

  const extraMeta = parseMeta(text)
  const plainText = text
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(QUOTE_ITEM_META_PREFIX))
    .join('\n')
    .trim()

  return { plainText, extraMeta }
}

export function buildQuoteItemObservaciones(args: {
  plainText?: string | null
  extraMeta?: QuoteItemExtraMeta | null
}): string {
  const parts: string[] = []
  const plainText = typeof args.plainText === 'string' ? args.plainText.trim() : ''
  if (plainText) parts.push(plainText)

  const extraMeta = args.extraMeta
  if (extraMeta) {
    const hasMeaningfulValue = Boolean(
      extraMeta.additionalFieldTitle?.trim()
      || extraMeta.additionalFieldDescription?.trim()
      || (typeof extraMeta.additionalValue === 'number' && Number.isFinite(extraMeta.additionalValue) && extraMeta.additionalValue > 0)
      || extraMeta.referenceImage?.url?.trim()
    )

    if (hasMeaningfulValue) {
      parts.push(`${QUOTE_ITEM_META_PREFIX}${JSON.stringify({
        version: 1,
        additionalFieldTitle: extraMeta.additionalFieldTitle?.trim() || undefined,
        additionalFieldDescription: extraMeta.additionalFieldDescription?.trim() || undefined,
        additionalValue:
          typeof extraMeta.additionalValue === 'number' && Number.isFinite(extraMeta.additionalValue) && extraMeta.additionalValue > 0
            ? extraMeta.additionalValue
            : undefined,
        referenceImage: extraMeta.referenceImage?.url
          ? {
              name: extraMeta.referenceImage.name?.trim() || undefined,
              url: extraMeta.referenceImage.url.trim(),
              scalePct: extraMeta.referenceImage.scalePct,
            }
          : undefined,
      })}`)
    }
  }

  return parts.join('\n')
}