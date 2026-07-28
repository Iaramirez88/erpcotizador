type JsonRecord = Record<string, unknown>

const AVATAR_KEYS = [
  'avatar',
  'avatarUrl',
  'avatar_url',
  'avatarURL',
  'photo',
  'photoUrl',
  'photo_url',
  'image',
  'imageUrl',
  'image_url',
  'profileImage',
  'profileImageUrl',
  'profile_image',
  'profile_image_url',
  'profilePicture',
  'profilePictureUrl',
  'profile_picture',
  'profile_picture_url',
  'pictureUrl',
  'picture_url',
]

const CONTAINER_KEYS = [
  'profile',
  'contact',
  'customer',
  'sender',
  'user',
  'lead',
  'cliente',
  'participant',
  'author',
  'from',
  'payload',
  'payloadJson',
  'normalizedDataJson',
  'rawPayloadJson',
  'data',
  'message',
  'entry',
  'change',
  'value',
]

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonRecord
}

function normalizeAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null
  return normalized
}

function readPictureNode(value: unknown): string | null {
  const direct = normalizeAvatarUrl(value)
  if (direct) return direct

  const record = asRecord(value)
  if (!record) return null

  const nestedUrl = normalizeAvatarUrl(record.url)
  if (nestedUrl) return nestedUrl

  const data = asRecord(record.data)
  return data ? normalizeAvatarUrl(data.url) : null
}

export function extractAvatarUrl(source: unknown, depth = 0, seen = new Set<unknown>()): string | null {
  if (!source || depth > 5 || seen.has(source)) return null
  seen.add(source)

  const direct = normalizeAvatarUrl(source)
  if (direct) return direct

  if (Array.isArray(source)) {
    for (const item of source.slice(0, 6)) {
      const found = extractAvatarUrl(item, depth + 1, seen)
      if (found) return found
    }
    return null
  }

  const record = asRecord(source)
  if (!record) return null

  for (const key of AVATAR_KEYS) {
    const found = normalizeAvatarUrl(record[key])
    if (found) return found
  }

  const picture = readPictureNode(record.picture)
  if (picture) return picture

  for (const key of CONTAINER_KEYS) {
    const found = extractAvatarUrl(record[key], depth + 1, seen)
    if (found) return found
  }

  return null
}

export function resolveCrmConversationAvatarUrl(args: {
  contactAvatarUrl?: string | null
  messages?: Array<{ payloadJson?: unknown } | null | undefined>
  captures?: Array<{ normalizedDataJson?: unknown; rawPayloadJson?: unknown } | null | undefined>
}) {
  const direct = normalizeAvatarUrl(args.contactAvatarUrl)
  if (direct) return direct

  for (const message of [...(args.messages ?? [])].reverse()) {
    const found = extractAvatarUrl(message?.payloadJson)
    if (found) return found
  }

  for (const capture of args.captures ?? []) {
    const found = extractAvatarUrl(capture?.normalizedDataJson) ?? extractAvatarUrl(capture?.rawPayloadJson)
    if (found) return found
  }

  return null
}

export function getAvatarInitials(label?: string | null, fallback = 'U') {
  const normalized = (label ?? '').trim()
  if (!normalized) return fallback

  const parts = normalized.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? fallback
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return `${first}${second}`.toUpperCase()
}