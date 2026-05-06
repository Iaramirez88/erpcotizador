export type WebFormCustomFieldType = 'input' | 'textarea' | 'phone' | 'email' | 'select' | 'check' | 'file'

export type WebFormCustomField = {
  id: string
  key: string
  label: string
  type: WebFormCustomFieldType
  placeholder: string
  helpText: string
  required: boolean
  options: string[]
  defaultValue: string
  fullWidth: boolean
}

export type WebFormVariableSource = 'static' | 'query'

export type WebFormVariable = {
  id: string
  key: string
  label: string
  source: WebFormVariableSource
  value: string
  queryParam: string
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim()
}

function sanitizeKey(value: unknown, fallback: string) {
  const normalized = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || fallback
}

export function createWebFormEntityId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function normalizeWebFormCustomFields(value: unknown): WebFormCustomField[] {
  if (!Array.isArray(value)) return []

  const fields: WebFormCustomField[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const row = item as Record<string, unknown>
    const type = normalizeString(row.type).toLowerCase() as WebFormCustomFieldType
    if (!['input', 'textarea', 'phone', 'email', 'select', 'check', 'file'].includes(type)) return

    const label = normalizeString(row.label) || `Campo ${index + 1}`
    const options = Array.isArray(row.options)
      ? row.options.map((option) => normalizeString(option)).filter(Boolean)
      : normalizeString(row.options)
        .split(/\r?\n|,/)
        .map((option) => option.trim())
        .filter(Boolean)

    fields.push({
      id: normalizeString(row.id) || `field-${index + 1}`,
      key: sanitizeKey(row.key || label, `field_${index + 1}`),
      label,
      type,
      placeholder: normalizeString(row.placeholder),
      helpText: normalizeString(row.helpText),
      required: typeof row.required === 'boolean' ? row.required : false,
      options,
      defaultValue: normalizeString(row.defaultValue),
      fullWidth: typeof row.fullWidth === 'boolean' ? row.fullWidth : type === 'textarea' || type === 'file',
    })
  })

  return fields
}

export function normalizeWebFormVariables(value: unknown): WebFormVariable[] {
  if (!Array.isArray(value)) return []

  const variables: WebFormVariable[] = []
  value.forEach((item, index) => {
    if (!item || typeof item !== 'object') return
    const row = item as Record<string, unknown>
    const key = sanitizeKey(row.key, `variable_${index + 1}`)
    const source = normalizeString(row.source).toLowerCase() === 'query' ? 'query' : 'static'

    variables.push({
      id: normalizeString(row.id) || `variable-${index + 1}`,
      key,
      label: normalizeString(row.label) || key,
      source,
      value: normalizeString(row.value),
      queryParam: normalizeString(row.queryParam) || key,
    })
  })

  return variables
}