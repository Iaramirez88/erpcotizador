import crypto from 'node:crypto'
import fs from 'fs/promises'
import path from 'path'

export type AiWorkspaceHistoryKind = 'LITOGRAFIA_QUOTE' | 'IMAGE_GENERATION' | 'IMAGE_VECTORIZATION'

export type AiWorkspaceHistoryEntry = {
  id: string
  kind: AiWorkspaceHistoryKind
  prompt: string
  createdAt: string
  actorUserId: string | null
  actorLabel: string | null
  summary: string | null
  responseText: string | null
  metadata: Record<string, unknown> | null
  asset: {
    name: string
    path: string
    url: string
    mimeType: string | null
    sizeBytes: number | null
  } | null
}

type AiWorkspaceHistoryStore = {
  version: 1
  entries: AiWorkspaceHistoryEntry[]
}

type AiWorkspaceHistoryQueryArgs = {
  empresaId: string
  limit?: number
  kinds?: AiWorkspaceHistoryKind[]
  actorUserId?: string | null
  actorQuery?: string | null
  promptQuery?: string | null
  from?: string | null
  to?: string | null
}

type AiWorkspaceHistoryPaginationArgs = AiWorkspaceHistoryQueryArgs & {
  page?: number
  pageSize?: number
}

const MAX_HISTORY_ITEMS = 120

function getHistoryStorePath(empresaId: string) {
  return path.join(process.cwd(), '.runtime-data', 'ai-workspace-history', `${empresaId}.json`)
}

async function ensureStorePath(empresaId: string) {
  const filePath = getHistoryStorePath(empresaId)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  return filePath
}

async function readHistoryStore(empresaId: string): Promise<AiWorkspaceHistoryStore> {
  const filePath = await ensureStorePath(empresaId)
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AiWorkspaceHistoryStore>
    const entries: AiWorkspaceHistoryEntry[] = Array.isArray(parsed.entries)
      ? parsed.entries
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => ({
            id: typeof entry.id === 'string' && entry.id ? entry.id : crypto.randomUUID(),
            kind: entry.kind === 'IMAGE_GENERATION'
              ? 'IMAGE_GENERATION'
              : entry.kind === 'IMAGE_VECTORIZATION'
                ? 'IMAGE_VECTORIZATION'
                : 'LITOGRAFIA_QUOTE',
            prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
            createdAt: typeof entry.createdAt === 'string' && entry.createdAt ? entry.createdAt : new Date().toISOString(),
            actorUserId: typeof entry.actorUserId === 'string' && entry.actorUserId ? entry.actorUserId : null,
            actorLabel: typeof entry.actorLabel === 'string' && entry.actorLabel ? entry.actorLabel : null,
            summary: typeof entry.summary === 'string' && entry.summary ? entry.summary : null,
            responseText: typeof entry.responseText === 'string' && entry.responseText ? entry.responseText : null,
            metadata: entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
              ? (entry.metadata as Record<string, unknown>)
              : null,
            asset: entry.asset && typeof entry.asset === 'object' && !Array.isArray(entry.asset)
              ? {
                  name: typeof entry.asset.name === 'string' ? entry.asset.name : 'archivo',
                  path: typeof entry.asset.path === 'string' ? entry.asset.path : '',
                  url: typeof entry.asset.url === 'string' ? entry.asset.url : '',
                  mimeType: typeof entry.asset.mimeType === 'string' && entry.asset.mimeType ? entry.asset.mimeType : null,
                  sizeBytes: typeof entry.asset.sizeBytes === 'number' && Number.isFinite(entry.asset.sizeBytes) ? entry.asset.sizeBytes : null,
                }
              : null,
          }))
      : []

    return { version: 1, entries }
  } catch {
    return { version: 1, entries: [] }
  }
}

async function writeHistoryStore(empresaId: string, store: AiWorkspaceHistoryStore) {
  const filePath = await ensureStorePath(empresaId)
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), 'utf8')
}

function normalizeSearchText(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function parseFilterDate(value: string | null | undefined, boundary: 'start' | 'end') {
  const normalized = String(value || '').trim()
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'
    const parsed = new Date(`${normalized}${suffix}`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  if (boundary === 'start') {
    parsed.setUTCHours(0, 0, 0, 0)
  } else {
    parsed.setUTCHours(23, 59, 59, 999)
  }
  return parsed
}

export async function appendAiWorkspaceHistory(args: {
  empresaId: string
  entry: Omit<AiWorkspaceHistoryEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
}) {
  const store = await readHistoryStore(args.empresaId)
  const nextEntry: AiWorkspaceHistoryEntry = {
    id: args.entry.id || crypto.randomUUID(),
    createdAt: args.entry.createdAt || new Date().toISOString(),
    ...args.entry,
  }

  store.entries = [nextEntry, ...store.entries].slice(0, MAX_HISTORY_ITEMS)
  await writeHistoryStore(args.empresaId, store)
  return nextEntry
}

export async function queryAiWorkspaceHistory(args: AiWorkspaceHistoryQueryArgs) {
  const store = await readHistoryStore(args.empresaId)
  const allowedKinds = Array.isArray(args.kinds) && args.kinds.length ? new Set(args.kinds) : null
  const actorUserId = typeof args.actorUserId === 'string' && args.actorUserId.trim() ? args.actorUserId.trim() : null
  const actorNeedle = normalizeSearchText(args.actorQuery)
  const promptNeedle = normalizeSearchText(args.promptQuery)
  const fromDate = parseFilterDate(args.from, 'start')
  const toDate = parseFilterDate(args.to, 'end')
  const limit = Math.max(1, Math.min(MAX_HISTORY_ITEMS, Math.trunc(args.limit ?? 50) || 50))

  return store.entries
    .filter((entry) => (allowedKinds ? allowedKinds.has(entry.kind) : true))
    .filter((entry) => (actorUserId ? entry.actorUserId === actorUserId : true))
    .filter((entry) => {
      if (!actorNeedle) return true
      const haystack = normalizeSearchText(`${entry.actorLabel || ''} ${entry.actorUserId || ''}`)
      return haystack.includes(actorNeedle)
    })
    .filter((entry) => {
      if (!promptNeedle) return true
      const haystack = normalizeSearchText(`${entry.prompt} ${entry.summary || ''} ${entry.responseText || ''}`)
      return haystack.includes(promptNeedle)
    })
    .filter((entry) => {
      const createdAt = new Date(entry.createdAt)
      if (Number.isNaN(createdAt.getTime())) return false
      if (fromDate && createdAt < fromDate) return false
      if (toDate && createdAt > toDate) return false
      return true
    })
    .slice(0, limit)
}

export async function queryAiWorkspaceHistoryPage(args: AiWorkspaceHistoryPaginationArgs) {
  const store = await readHistoryStore(args.empresaId)
  const allowedKinds = Array.isArray(args.kinds) && args.kinds.length ? new Set(args.kinds) : null
  const actorUserId = typeof args.actorUserId === 'string' && args.actorUserId.trim() ? args.actorUserId.trim() : null
  const actorNeedle = normalizeSearchText(args.actorQuery)
  const promptNeedle = normalizeSearchText(args.promptQuery)
  const fromDate = parseFilterDate(args.from, 'start')
  const toDate = parseFilterDate(args.to, 'end')
  const pageSize = Math.max(1, Math.min(MAX_HISTORY_ITEMS, Math.trunc(args.pageSize ?? 10) || 10))
  const page = Math.max(1, Math.trunc(args.page ?? 1) || 1)

  const filtered = store.entries
    .filter((entry) => (allowedKinds ? allowedKinds.has(entry.kind) : true))
    .filter((entry) => (actorUserId ? entry.actorUserId === actorUserId : true))
    .filter((entry) => {
      if (!actorNeedle) return true
      const haystack = normalizeSearchText(`${entry.actorLabel || ''} ${entry.actorUserId || ''}`)
      return haystack.includes(actorNeedle)
    })
    .filter((entry) => {
      if (!promptNeedle) return true
      const haystack = normalizeSearchText(`${entry.prompt} ${entry.summary || ''} ${entry.responseText || ''}`)
      return haystack.includes(promptNeedle)
    })
    .filter((entry) => {
      const createdAt = new Date(entry.createdAt)
      if (Number.isNaN(createdAt.getTime())) return false
      if (fromDate && createdAt < fromDate) return false
      if (toDate && createdAt > toDate) return false
      return true
    })

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const items = filtered.slice(start, start + pageSize)

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrevious: safePage > 1,
  }
}

export async function listAiWorkspaceHistory(args: {
  empresaId: string
  limit?: number
  kinds?: AiWorkspaceHistoryKind[]
}) {
  return queryAiWorkspaceHistory(args)
}