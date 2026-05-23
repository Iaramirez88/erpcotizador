export type OdontogramEntry = {
  toothCode: string
  condition: string
  diagnosis: string
  recommendedProcedure?: string | null
  notes?: string | null
}

export type DentitionType = 'ADULT' | 'PEDIATRIC'

export type OdontologyClinicalAttachmentType = 'image' | 'audio' | 'video' | 'document'

export type OdontologyClinicalAttachment = {
  id: string
  name: string
  url: string
  type: OdontologyClinicalAttachmentType
  mimeType?: string | null
  sizeBytes?: number | null
  uploadedAt?: string | null
  provider?: string | null
  externalId?: string | null
}

export type OdontogramPayload = {
  version: 1
  entries: OdontogramEntry[]
  attachments?: OdontologyClinicalAttachment[]
  sessionLabel?: string | null
  dentitionType?: DentitionType
}

export const ODONTOGRAM_TOP_ROW = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'] as const
export const ODONTOGRAM_BOTTOM_ROW = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'] as const
export const ODONTOGRAM_PRIMARY_TOP_ROW = ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'] as const
export const ODONTOGRAM_PRIMARY_BOTTOM_ROW = ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75'] as const
export const ODONTOGRAM_TOOTH_CODES = [
  ...ODONTOGRAM_TOP_ROW,
  ...ODONTOGRAM_BOTTOM_ROW,
  ...ODONTOGRAM_PRIMARY_TOP_ROW,
  ...ODONTOGRAM_PRIMARY_BOTTOM_ROW,
] as const

export function normalizeDentitionType(value: unknown): DentitionType {
  return value === 'PEDIATRIC' ? 'PEDIATRIC' : 'ADULT'
}

export function getDentitionLabel(value: DentitionType) {
  return value === 'PEDIATRIC' ? 'Dentición temporal · 20 piezas' : 'Dentición permanente · 32 piezas'
}

export function getOdontogramRows(dentitionType: DentitionType) {
  if (dentitionType === 'PEDIATRIC') {
    return {
      top: [...ODONTOGRAM_PRIMARY_TOP_ROW],
      bottom: [...ODONTOGRAM_PRIMARY_BOTTOM_ROW],
    }
  }

  return {
    top: [...ODONTOGRAM_TOP_ROW],
    bottom: [...ODONTOGRAM_BOTTOM_ROW],
  }
}

export function getPatientAgeYears(value: string | Date | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const today = new Date()
  let years = today.getFullYear() - date.getFullYear()
  const monthDiff = today.getMonth() - date.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    years -= 1
  }

  return years >= 0 ? years : null
}

export function inferDentitionTypeFromBirthDate(value: string | Date | null | undefined): DentitionType {
  const age = getPatientAgeYears(value)
  if (age !== null && age < 12) return 'PEDIATRIC'
  return 'ADULT'
}

export function isOdontogramToothCode(value: string): value is typeof ODONTOGRAM_TOOTH_CODES[number] {
  return (ODONTOGRAM_TOOTH_CODES as readonly string[]).includes(value)
}

export function normalizeToothCode(value: unknown) {
  const toothCode = typeof value === 'string' ? value.trim() : ''
  return isOdontogramToothCode(toothCode) ? toothCode : null
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function normalizeRequiredText(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function normalizeAttachmentType(value: unknown): OdontologyClinicalAttachmentType | null {
  const normalized = normalizeRequiredText(value).toLowerCase()
  if (normalized === 'image' || normalized === 'audio' || normalized === 'video' || normalized === 'document') {
    return normalized
  }
  return null
}

function normalizeAttachments(value: unknown): OdontologyClinicalAttachment[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []

    const row = item as Record<string, unknown>
    const url = normalizeRequiredText(row.url)
    const name = normalizeRequiredText(row.name)
    const type = normalizeAttachmentType(row.type)

    if (!url || !name || !type) return []

    return [{
      id: normalizeRequiredText(row.id) || `attachment-${index + 1}`,
      name,
      url,
      type,
      mimeType: normalizeOptionalText(row.mimeType),
      sizeBytes: typeof row.sizeBytes === 'number' && Number.isFinite(row.sizeBytes) ? row.sizeBytes : null,
      uploadedAt: normalizeOptionalText(row.uploadedAt),
      provider: normalizeOptionalText(row.provider),
      externalId: normalizeOptionalText(row.externalId),
    }]
  })
}

export function normalizeOdontogramPayload(value: unknown): OdontogramPayload {
  const rawValue = typeof value === 'object' && value ? (value as Record<string, unknown>) : {}
  const rawEntries = typeof value === 'object' && value && Array.isArray((value as { entries?: unknown[] }).entries)
    ? (value as { entries: unknown[] }).entries
    : []

  const entries: OdontogramEntry[] = []

  for (const entry of rawEntries) {
    if (!entry || typeof entry !== 'object') continue
    const toothCode = normalizeToothCode((entry as { toothCode?: unknown }).toothCode)
    const diagnosis = normalizeRequiredText((entry as { diagnosis?: unknown }).diagnosis)
    const condition = normalizeRequiredText((entry as { condition?: unknown }).condition)

    if (!toothCode || !diagnosis || !condition) continue

    entries.push({
      toothCode,
      diagnosis,
      condition,
      recommendedProcedure: normalizeOptionalText((entry as { recommendedProcedure?: unknown }).recommendedProcedure),
      notes: normalizeOptionalText((entry as { notes?: unknown }).notes),
    })
  }

  return {
    version: 1,
    entries,
    attachments: normalizeAttachments(rawValue.attachments),
    sessionLabel: normalizeOptionalText(rawValue.sessionLabel),
    dentitionType: normalizeDentitionType(rawValue.dentitionType),
  }
}

export function findToothEntry(entries: OdontogramEntry[], toothCode: string) {
  return entries.find((entry) => entry.toothCode === toothCode) ?? null
}

export function normalizeClinicalLabel(value: string | null | undefined) {
  if (!value) return 'Libre'
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}