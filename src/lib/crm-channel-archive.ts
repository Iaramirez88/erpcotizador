/**
 * Estado de archivo de los canales CRM.
 *
 * Se persiste dentro de `CrmChannelConnection.settingsJson.archive` para no
 * requerir una migración de schema: archivar es una dimensión distinta del
 * `status` operativo (un canal archivado siempre queda en DISABLED), y el
 * histórico comercial se conserva intacto.
 */
export const CHANNEL_ARCHIVE_SETTINGS_KEY = 'archive'

export type CrmChannelArchiveState = {
  archivedAt: string | null
  archivedById: string | null
}

function asSettingsRecord(settingsJson: unknown): Record<string, unknown> {
  if (!settingsJson || typeof settingsJson !== 'object' || Array.isArray(settingsJson)) return {}
  return settingsJson as Record<string, unknown>
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function getChannelArchiveState(settingsJson: unknown): CrmChannelArchiveState {
  const raw = asSettingsRecord(settingsJson)[CHANNEL_ARCHIVE_SETTINGS_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { archivedAt: null, archivedById: null }
  }

  const metadata = raw as Record<string, unknown>
  const archivedById = typeof metadata.archivedById === 'string' && metadata.archivedById.trim()
    ? metadata.archivedById.trim()
    : null

  return {
    archivedAt: normalizeIsoDate(metadata.archivedAt),
    archivedById,
  }
}

export function getChannelArchivedAt(settingsJson: unknown): string | null {
  return getChannelArchiveState(settingsJson).archivedAt
}

export function isChannelArchived(settingsJson: unknown): boolean {
  return getChannelArchiveState(settingsJson).archivedAt !== null
}

/**
 * Devuelve una copia de `settingsJson` con el estado de archivo aplicado.
 * Pasar `archivedAt = null` elimina los metadatos (restaurar).
 */
export function withChannelArchiveState(
  settingsJson: unknown,
  archive: { archivedAt: string | Date | null; archivedById?: string | null },
): Record<string, unknown> {
  const next = { ...asSettingsRecord(settingsJson) }

  if (!archive.archivedAt) {
    delete next[CHANNEL_ARCHIVE_SETTINGS_KEY]
    return next
  }

  const archivedAt = normalizeIsoDate(
    archive.archivedAt instanceof Date ? archive.archivedAt.toISOString() : archive.archivedAt,
  )

  if (!archivedAt) {
    delete next[CHANNEL_ARCHIVE_SETTINGS_KEY]
    return next
  }

  next[CHANNEL_ARCHIVE_SETTINGS_KEY] = {
    archivedAt,
    ...(archive.archivedById ? { archivedById: archive.archivedById } : {}),
  }

  return next
}

export function channelHasActivity(counts?: { conversations?: number | null; captures?: number | null } | null): boolean {
  if (!counts) return false
  return (counts.conversations ?? 0) > 0 || (counts.captures ?? 0) > 0
}
