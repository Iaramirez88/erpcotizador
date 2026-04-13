export type WebsiteServiceAttachmentType = 'image' | 'document'

export type WebsiteServiceAttachment = {
  id: string
  name: string
  url: string
  type: WebsiteServiceAttachmentType
  mimeType: string | null
  sizeBytes: number | null
  uploadedAt: string
}

export type WebsiteServiceCustomFieldType = 'TEXT' | 'FILE'

export type WebsiteServiceCustomField = {
  id: string
  label: string
  type: WebsiteServiceCustomFieldType
  textValue: string | null
  file: WebsiteServiceAttachment | null
}

function normalizeString(value: unknown) {
  const normalized = String(value ?? '').trim()
  return normalized || null
}

export function createWebsiteServiceFieldId(prefix: string) {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}-${uuid}`
}

export function normalizeWebsiteServiceAttachments(value: unknown): WebsiteServiceAttachment[] {
  if (!Array.isArray(value)) return []

  const attachments: WebsiteServiceAttachment[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const row = item as Record<string, unknown>
    const name = normalizeString(row.name)
    const url = normalizeString(row.url)
    const rawType = String(row.type || '').trim().toLowerCase()
    const type: WebsiteServiceAttachmentType | null = rawType === 'image' || rawType === 'document' ? rawType : null

    if (!name || !url || !type) return

    attachments.push({
      id: normalizeString(row.id) || `attachment-${index + 1}`,
      name,
      url,
      type,
      mimeType: normalizeString(row.mimeType),
      sizeBytes: typeof row.sizeBytes === 'number' && Number.isFinite(row.sizeBytes) ? row.sizeBytes : null,
      uploadedAt: normalizeString(row.uploadedAt) || new Date().toISOString(),
    })
  })

  return attachments
}

export function normalizeWebsiteServiceCustomFields(value: unknown): WebsiteServiceCustomField[] {
  if (!Array.isArray(value)) return []

  const fields: WebsiteServiceCustomField[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const row = item as Record<string, unknown>
    const label = normalizeString(row.label)
    const type = String(row.type || '').trim().toUpperCase() as WebsiteServiceCustomFieldType
    if (!label || (type !== 'TEXT' && type !== 'FILE')) return

    const file = type === 'FILE' ? normalizeWebsiteServiceAttachments(row.file ? [row.file] : [])[0] ?? null : null
    const textValue = type === 'TEXT' ? normalizeString(row.textValue) : null

    fields.push({
      id: normalizeString(row.id) || `field-${index + 1}`,
      label,
      type,
      textValue,
      file,
    })
  })

  return fields
}

export function formatWebsiteServiceAttachmentSize(sizeBytes?: number | null) {
  if (!sizeBytes || !Number.isFinite(sizeBytes)) return 'Sin tamaño'
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

export function websiteServiceAttachmentAccept() {
  return 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar'
}