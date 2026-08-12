type DailyRoomResponse = {
  name?: string
  url?: string
}

async function dailyRequest(args: {
  apiKey: string
  path: string
  method?: 'GET' | 'POST'
  body?: Record<string, unknown>
}) {
  const response = await fetch(`https://api.daily.co/v1${args.path}`, {
    method: args.method || 'GET',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      Accept: 'application/json',
      ...(args.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
    cache: 'no-store',
  })

  const json = await response.json().catch(() => null) as Record<string, unknown> | null

  return {
    ok: response.ok,
    status: response.status,
    json,
  }
}

export function normalizeDailyRoomSegment(value: string, fallback: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

export function buildCrmDailyRoomName(roomPrefix: string, conversationId: string) {
  return `${normalizeDailyRoomSegment(roomPrefix || 'crm-room', 'crm-room')}-${normalizeDailyRoomSegment(conversationId, 'conversation')}`
}

export async function ensureDailyRoom(args: {
  apiKey: string
  roomName: string
  callType: 'video' | 'audio'
  enableRecording: boolean
  domainHost: string
}) {
  const current = await dailyRequest({
    apiKey: args.apiKey,
    path: `/rooms/${encodeURIComponent(args.roomName)}`,
  })

  if (current.ok) {
    return current.json as DailyRoomResponse
  }

  if (current.status !== 404) {
    throw new Error((current.json?.info as string) || (current.json?.error as string) || `Daily devolvió ${current.status} al consultar la sala.`)
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = nowSeconds + (8 * 60 * 60)
  const created = await dailyRequest({
    apiKey: args.apiKey,
    path: '/rooms',
    method: 'POST',
    body: {
      name: args.roomName,
      privacy: 'private',
      properties: {
        exp: expiresAt,
        eject_at_room_exp: true,
        start_video_off: args.callType === 'audio',
        start_audio_off: false,
        enable_prejoin_ui: true,
        enable_screenshare: args.callType === 'video',
        enable_chat: false,
        enable_people_ui: true,
        enable_network_ui: false,
        ...(args.enableRecording ? { enable_recording: 'local' } : {}),
        lang: 'es',
      },
    },
  })

  if (!created.ok) {
    throw new Error((created.json?.info as string) || (created.json?.error as string) || `Daily devolvió ${created.status} al crear la sala.`)
  }

  return {
    ...(created.json as DailyRoomResponse),
    url: (created.json?.url as string) || `https://${args.domainHost}/${args.roomName}`,
  }
}

export async function createDailyMeetingToken(args: {
  apiKey: string
  roomName: string
  callType: 'video' | 'audio'
  canRecord: boolean
  userId: string
  userName: string
  isOwner?: boolean
}) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = nowSeconds + (2 * 60 * 60)
  const response = await dailyRequest({
    apiKey: args.apiKey,
    path: '/meeting-tokens',
    method: 'POST',
    body: {
      properties: {
        room_name: args.roomName,
        user_name: args.userName,
        user_id: args.userId.slice(0, 36),
        is_owner: args.isOwner !== false,
        nbf: nowSeconds - 30,
        exp: expiresAt,
        eject_at_token_exp: true,
        start_video_off: args.callType === 'audio',
        start_audio_off: false,
        enable_prejoin_ui: true,
        enable_recording_ui: args.canRecord,
        lang: 'es',
      },
    },
  })

  const token = typeof response.json?.token === 'string' ? response.json.token : ''
  if (!response.ok || !token) {
    throw new Error((response.json?.info as string) || (response.json?.error as string) || `Daily devolvió ${response.status} al crear el token.`)
  }

  return {
    token,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  }
}