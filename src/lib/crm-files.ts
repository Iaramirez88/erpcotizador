import crypto from 'node:crypto'
import fs from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { convertStorageLimitGbToBytes, getManagedPlanByTier } from '@/lib/managed-plans'

export type CrmFileItemType = 'folder' | 'image' | 'audio' | 'video' | 'document'
export type CrmFileEntityType = 'TASK' | 'LEAD' | 'OPPORTUNITY'
export type CrmFileAuditAction = 'CREATED' | 'UPLOADED' | 'RENAMED' | 'MOVED' | 'SHARED' | 'LINKED' | 'UNLINKED'
export type CrmExternalFileProvider = 'GOOGLE_DRIVE' | 'ONEDRIVE'

export type CrmFileLinkedEntities = {
  tasks: string[]
  leads: string[]
  opportunities: string[]
}

export type CrmFileAuditEntry = {
  id: string
  action: CrmFileAuditAction
  at: string
  actorUserId: string | null
  actorLabel: string | null
  message: string
}

export type CrmFileItem = {
  id: string
  name: string
  path: string
  directoryPath: string
  type: CrmFileItemType
  sizeBytes: number
  updatedAt: string
  url: string | null
  extension: string | null
  mimeType: string | null
  createdAt: string
  createdById: string | null
  sourceProvider?: CrmExternalFileProvider | null
  externalId?: string | null
  isExternal?: boolean
  sharedWithUserIds: string[]
  linkedEntities: CrmFileLinkedEntities
  auditTrail: CrmFileAuditEntry[]
}

export type CrmFolderNode = {
  name: string
  path: string
  children: CrmFolderNode[]
}

export type CrmStorageUsageSummary = {
  totalBytes: number
  usedBytes: number
  freeBytes: number
  filesCount: number
  foldersCount: number
  lastUploadedAt: string | null
}

export type CrmFilesSnapshot = {
  currentPath: string
  breadcrumbs: Array<{ label: string; path: string }>
  tree: CrmFolderNode
  items: CrmFileItem[]
  recentItems: CrmFileItem[]
  usage: {
    totalBytes: number
    usedBytes: number
    freeBytes: number
    filesCount: number
    foldersCount: number
  }
}

type CrmFilesActor = {
  userId?: string | null
  label?: string | null
}

type CrmFilesIndexEntry = {
  id: string
  kind: 'folder' | 'file' | 'external'
  createdAt: string
  updatedAt: string
  createdById: string | null
  externalName?: string | null
  externalProvider?: CrmExternalFileProvider | null
  externalUrl?: string | null
  externalId?: string | null
  externalMimeType?: string | null
  externalSizeBytes?: number | null
  sharedWithUserIds: string[]
  linkedEntities: CrmFileLinkedEntities
  auditTrail: CrmFileAuditEntry[]
}

type CrmFilesIndex = {
  version: 1
  entries: Record<string, CrmFilesIndexEntry>
}

const DEFAULT_QUOTA_BYTES = 1000 * 1024 * 1024
const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_AUDIT_ITEMS = 30

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov'])

function emptyLinkedEntities(): CrmFileLinkedEntities {
  return { tasks: [], leads: [], opportunities: [] }
}

function normalizeLinkedEntities(value?: Partial<CrmFileLinkedEntities> | null): CrmFileLinkedEntities {
  const normalize = (items: string[] | undefined) => Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean)))
  return {
    tasks: normalize(value?.tasks),
    leads: normalize(value?.leads),
    opportunities: normalize(value?.opportunities),
  }
}

function normalizeAuditTrail(value: unknown): CrmFileAuditEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => ({
      id: typeof entry?.id === 'string' && entry.id ? entry.id : crypto.randomUUID(),
      action: typeof entry?.action === 'string' ? (entry.action as CrmFileAuditAction) : 'CREATED',
      at: typeof entry?.at === 'string' && entry.at ? entry.at : new Date().toISOString(),
      actorUserId: typeof entry?.actorUserId === 'string' && entry.actorUserId ? entry.actorUserId : null,
      actorLabel: typeof entry?.actorLabel === 'string' && entry.actorLabel ? entry.actorLabel : null,
      message: typeof entry?.message === 'string' && entry.message ? entry.message : 'Actividad registrada',
    }))
    .slice(0, MAX_AUDIT_ITEMS)
}

function createAuditEntry(action: CrmFileAuditAction, actor: CrmFilesActor | undefined, message: string): CrmFileAuditEntry {
  return {
    id: crypto.randomUUID(),
    action,
    at: new Date().toISOString(),
    actorUserId: actor?.userId || null,
    actorLabel: actor?.label || null,
    message,
  }
}

function normalizeExternalProvider(value: unknown): CrmExternalFileProvider | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return raw === 'GOOGLE_DRIVE' || raw === 'ONEDRIVE' ? raw : null
}

function appendAudit(entry: CrmFilesIndexEntry, action: CrmFileAuditAction, actor: CrmFilesActor | undefined, message: string) {
  entry.auditTrail = [createAuditEntry(action, actor, message), ...normalizeAuditTrail(entry.auditTrail)].slice(0, MAX_AUDIT_ITEMS)
  entry.updatedAt = new Date().toISOString()
}

function createIndexEntry(kind: 'folder' | 'file' | 'external', actor?: CrmFilesActor): CrmFilesIndexEntry {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    kind,
    createdAt: now,
    updatedAt: now,
    createdById: actor?.userId || null,
    externalName: null,
    externalProvider: null,
    externalUrl: null,
    externalId: null,
    externalMimeType: null,
    externalSizeBytes: null,
    sharedWithUserIds: [],
    linkedEntities: emptyLinkedEntities(),
    auditTrail: [],
  }
}

function normalizeSegment(segment: string) {
  const clean = segment.trim()
  if (!clean || clean === '.' || clean === '..' || clean.includes('\\') || clean.includes('\u0000')) {
    throw new Error('Ruta inválida.')
  }
  return clean
}

function sanitizeFolderName(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._ -]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim()
}

function sanitizeFileName(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim()
}

function joinClientPath(segments: string[]) {
  return segments.join('/')
}

function pathPrefixes(entryPath: string) {
  const segments = normalizeCrmFilesPath(entryPath)
  return segments.map((_, index) => joinClientPath(segments.slice(0, index + 1)))
}

function resolveMimeType(fileName: string, explicitMimeType?: string | null) {
  if (explicitMimeType && explicitMimeType !== 'application/octet-stream') return explicitMimeType
  const ext = path.extname(fileName).toLowerCase()
  return MIME_BY_EXTENSION[ext] || 'application/octet-stream'
}

function resolveItemType(fileName: string, mimeType?: string | null): Exclude<CrmFileItemType, 'folder'> {
  const ext = path.extname(fileName).toLowerCase()
  const normalizedMime = (mimeType || '').toLowerCase()

  if (normalizedMime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (normalizedMime.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext)) return 'audio'
  if (normalizedMime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)) return 'video'
  return 'document'
}

function getQuotaBytesFromEnv() {
  const raw = Number(process.env.CRM_FILES_MAX_BYTES || '')
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_QUOTA_BYTES
}

async function getQuotaBytes(empresaId: string) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { planTier: true },
  })

  if (!empresa?.planTier) return getQuotaBytesFromEnv()

  const plan = await getManagedPlanByTier(empresa.planTier)
  return convertStorageLimitGbToBytes(plan.storageLimitGb) ?? getQuotaBytesFromEnv()
}

export function normalizeCrmFilesPath(input: string | null | undefined) {
  if (!input) return []
  return input
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => normalizeSegment(segment))
}

function getPublicRootRelativePath(empresaId: string) {
  return path.posix.join('uploads', 'crm-files', empresaId)
}

function getMetadataStoreAbsolutePath(empresaId: string) {
  return path.join(process.cwd(), '.runtime-data', 'crm-files', `${empresaId}.json`)
}

export function getCrmFilesRootAbsolutePath(empresaId: string) {
  return path.join(process.cwd(), 'public', 'uploads', 'crm-files', empresaId)
}

async function ensureCrmFilesRoot(empresaId: string) {
  const root = getCrmFilesRootAbsolutePath(empresaId)
  await fs.mkdir(root, { recursive: true })
  return root
}

async function ensureMetadataStore(empresaId: string) {
  const filePath = getMetadataStoreAbsolutePath(empresaId)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  return filePath
}

function assertInsideRoot(root: string, target: string) {
  const relative = path.relative(root, target)
  if (!relative || relative === '') return
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Ruta fuera del administrador de archivos.')
  }
}

function getAbsolutePathForSegments(root: string, segments: string[]) {
  const target = path.join(root, ...segments)
  assertInsideRoot(root, target)
  return target
}

function buildFileUrl(empresaId: string, segments: string[]) {
  const encoded = segments.map((segment) => encodeURIComponent(segment)).join('/')
  return `/${getPublicRootRelativePath(empresaId)}/${encoded}`
}

async function pathExists(target: string) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function readIndex(empresaId: string): Promise<CrmFilesIndex> {
  const filePath = await ensureMetadataStore(empresaId)
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<CrmFilesIndex>
    const entries = Object.fromEntries(Object.entries(parsed.entries || {}).map(([entryPath, entry]) => [
      entryPath,
      {
        id: typeof entry?.id === 'string' && entry.id ? entry.id : crypto.randomUUID(),
        kind: entry?.kind === 'folder' ? 'folder' : entry?.kind === 'external' ? 'external' : 'file',
        createdAt: typeof entry?.createdAt === 'string' && entry.createdAt ? entry.createdAt : new Date().toISOString(),
        updatedAt: typeof entry?.updatedAt === 'string' && entry.updatedAt ? entry.updatedAt : new Date().toISOString(),
        createdById: typeof entry?.createdById === 'string' && entry.createdById ? entry.createdById : null,
        externalName: typeof entry?.externalName === 'string' && entry.externalName ? entry.externalName : null,
        externalProvider: normalizeExternalProvider(entry?.externalProvider),
        externalUrl: typeof entry?.externalUrl === 'string' && entry.externalUrl ? entry.externalUrl : null,
        externalId: typeof entry?.externalId === 'string' && entry.externalId ? entry.externalId : null,
        externalMimeType: typeof entry?.externalMimeType === 'string' && entry.externalMimeType ? entry.externalMimeType : null,
        externalSizeBytes: typeof entry?.externalSizeBytes === 'number' && Number.isFinite(entry.externalSizeBytes) ? entry.externalSizeBytes : null,
        sharedWithUserIds: Array.from(new Set(Array.isArray(entry?.sharedWithUserIds) ? entry.sharedWithUserIds.map((userId) => String(userId || '').trim()).filter(Boolean) : [])),
        linkedEntities: normalizeLinkedEntities(entry?.linkedEntities),
        auditTrail: normalizeAuditTrail(entry?.auditTrail),
      } satisfies CrmFilesIndexEntry,
    ]))
    return { version: 1, entries }
  } catch {
    return { version: 1, entries: {} }
  }
}

async function writeIndex(empresaId: string, index: CrmFilesIndex) {
  const filePath = await ensureMetadataStore(empresaId)
  await fs.writeFile(filePath, JSON.stringify(index, null, 2), 'utf8')
}

function ensureIndexEntry(index: CrmFilesIndex, entryPath: string, kind: 'folder' | 'file' | 'external', actor?: CrmFilesActor) {
  const current = index.entries[entryPath]
  if (current) {
    current.kind = kind
    current.linkedEntities = normalizeLinkedEntities(current.linkedEntities)
    current.auditTrail = normalizeAuditTrail(current.auditTrail)
    return current
  }
  const created = createIndexEntry(kind, actor)
  index.entries[entryPath] = created
  return created
}

function ensureFolderEntries(index: CrmFilesIndex, segments: string[], actor?: CrmFilesActor) {
  for (let indexPosition = 0; indexPosition < segments.length; indexPosition += 1) {
    const folderPath = joinClientPath(segments.slice(0, indexPosition + 1))
    const metadata = ensureIndexEntry(index, folderPath, 'folder', actor)
    if (!metadata.auditTrail.length) {
      appendAudit(metadata, 'CREATED', actor, `Carpeta creada por ${actor?.label || 'usuario interno'}.`)
    }
  }
}

function buildExternalProviderLabel(provider: CrmExternalFileProvider | null | undefined) {
  if (provider === 'GOOGLE_DRIVE') return 'Google Drive'
  if (provider === 'ONEDRIVE') return 'OneDrive'
  return 'Archivo externo'
}

function buildExternalEntryPath(provider: CrmExternalFileProvider, externalId: string | null | undefined, url: string) {
  const stableId = String(externalId || '').trim() || crypto.createHash('sha1').update(`${provider}:${url}`).digest('hex')
  return ['__external__', provider.toLowerCase(), stableId].join('/')
}

function buildExternalItem(entryPath: string, entry: CrmFilesIndexEntry): CrmFileItem {
  const providerLabel = buildExternalProviderLabel(entry.externalProvider)
  const name = entry.externalName || entry.externalId || providerLabel
  const mimeType = entry.externalMimeType || null
  const extension = mimeType ? null : (path.extname(name).toLowerCase() || null)
  return {
    id: entry.id,
    name,
    path: entryPath,
    directoryPath: providerLabel,
    type: resolveItemType(name, mimeType),
    sizeBytes: typeof entry.externalSizeBytes === 'number' ? entry.externalSizeBytes : 0,
    updatedAt: entry.updatedAt,
    url: entry.externalUrl || null,
    extension,
    mimeType,
    createdAt: entry.createdAt,
    createdById: entry.createdById,
    sourceProvider: entry.externalProvider || null,
    externalId: entry.externalId || null,
    isExternal: true,
    sharedWithUserIds: entry.sharedWithUserIds,
    linkedEntities: normalizeLinkedEntities(entry.linkedEntities),
    auditTrail: normalizeAuditTrail(entry.auditTrail),
  }
}

function deleteIndexEntries(index: CrmFilesIndex, entryPath: string) {
  const prefix = `${entryPath}/`
  Object.keys(index.entries).forEach((key) => {
    if (key === entryPath || key.startsWith(prefix)) {
      delete index.entries[key]
    }
  })
}

function moveIndexEntries(index: CrmFilesIndex, sourcePath: string, targetPath: string) {
  const nextEntries: Record<string, CrmFilesIndexEntry> = {}
  const sourcePrefix = `${sourcePath}/`
  const targetPrefix = `${targetPath}/`

  for (const [key, entry] of Object.entries(index.entries)) {
    if (key === sourcePath) {
      nextEntries[targetPath] = { ...entry, updatedAt: new Date().toISOString() }
      continue
    }
    if (key.startsWith(sourcePrefix)) {
      const suffix = key.slice(sourcePrefix.length)
      nextEntries[`${targetPrefix}${suffix}`] = { ...entry, updatedAt: new Date().toISOString() }
      continue
    }
    nextEntries[key] = entry
  }

  index.entries = nextEntries
}

function mapEntityTypeToKey(entityType: CrmFileEntityType) {
  if (entityType === 'TASK') return 'tasks'
  if (entityType === 'LEAD') return 'leads'
  return 'opportunities'
}

function hasUserAccessToPath(index: CrmFilesIndex, entryPath: string, currentUserId?: string | null) {
  if (!currentUserId || !entryPath) return true
  const prefixes = pathPrefixes(entryPath)
  for (let position = prefixes.length - 1; position >= 0; position -= 1) {
    const metadata = index.entries[prefixes[position]]
    if (!metadata) continue
    if (!metadata.createdById) return true
    if (metadata.createdById === currentUserId) return true
    if (metadata.sharedWithUserIds.includes(currentUserId)) return true
  }
  return false
}

async function buildItemFromSegments(args: { root: string; empresaId: string; itemSegments: string[]; index: CrmFilesIndex; actorForAutoCreate?: CrmFilesActor }) {
  const absolutePath = getAbsolutePathForSegments(args.root, args.itemSegments)
  const stats = await fs.stat(absolutePath)
  const name = args.itemSegments[args.itemSegments.length - 1] || '/'
  const isDirectory = stats.isDirectory()
  const entryPath = joinClientPath(args.itemSegments)
  const metadata = ensureIndexEntry(args.index, entryPath, isDirectory ? 'folder' : 'file', args.actorForAutoCreate)
  const extension = isDirectory ? null : (path.extname(name).toLowerCase() || null)
  const mimeType = isDirectory ? null : resolveMimeType(name)

  return {
    id: metadata.id,
    name,
    path: entryPath,
    directoryPath: joinClientPath(args.itemSegments.slice(0, -1)),
    type: isDirectory ? 'folder' : resolveItemType(name, mimeType),
    sizeBytes: isDirectory ? 0 : stats.size,
    updatedAt: stats.mtime.toISOString(),
    url: isDirectory ? null : buildFileUrl(args.empresaId, args.itemSegments),
    extension,
    mimeType,
    createdAt: metadata.createdAt,
    createdById: metadata.createdById,
    sharedWithUserIds: metadata.sharedWithUserIds,
    linkedEntities: normalizeLinkedEntities(metadata.linkedEntities),
    auditTrail: normalizeAuditTrail(metadata.auditTrail),
  } satisfies CrmFileItem
}

function sanitizeEntryName(currentName: string, requestedName: string, isDirectory: boolean) {
  if (isDirectory) {
    const folderName = sanitizeFolderName(requestedName)
    if (!folderName) throw new Error('Escribe un nombre válido para la carpeta.')
    return normalizeSegment(folderName)
  }

  const currentExt = path.extname(currentName)
  const requestedExt = path.extname(requestedName)
  const effectiveExt = requestedExt || currentExt
  const safeBaseName = sanitizeFileName(path.basename(requestedName, requestedExt || currentExt))
  if (!safeBaseName) throw new Error('Escribe un nombre válido para el archivo.')
  return normalizeSegment(`${safeBaseName}${effectiveExt}`)
}

async function buildFolderTree(args: { root: string; index: CrmFilesIndex; currentUserId?: string | null; segments?: string[] }): Promise<CrmFolderNode | null> {
  const segments = args.segments || []
  const currentPath = getAbsolutePathForSegments(args.root, segments)
  const entries = await fs.readdir(currentPath, { withFileTypes: true }).catch(() => [])
  const childDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }))

  const children = (await Promise.all(childDirectories.map((name) => buildFolderTree({
    root: args.root,
    index: args.index,
    currentUserId: args.currentUserId,
    segments: [...segments, name],
  })))).filter((node): node is CrmFolderNode => Boolean(node))

  const entryPath = joinClientPath(segments)
  const isRoot = segments.length === 0
  const hasDirectAccess = isRoot || hasUserAccessToPath(args.index, entryPath, args.currentUserId)
  if (!isRoot && !hasDirectAccess && children.length === 0) {
    return null
  }

  return {
    name: segments[segments.length - 1] || '/',
    path: entryPath,
    children,
  }
}

function collectVisibleFolderPaths(node: CrmFolderNode, bucket = new Set<string>()) {
  bucket.add(node.path)
  node.children.forEach((child) => collectVisibleFolderPaths(child, bucket))
  return bucket
}

function treeContainsPath(node: CrmFolderNode, targetPath: string): boolean {
  if (node.path === targetPath) return true
  return node.children.some((child) => treeContainsPath(child, targetPath))
}

async function listDirectoryItems(args: { root: string; empresaId: string; segments: string[]; index: CrmFilesIndex; currentUserId?: string | null; visibleFolderPaths: Set<string> }) {
  const directory = getAbsolutePathForSegments(args.root, args.segments)
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const items = await Promise.all(entries.map((entry) => buildItemFromSegments({
    root: args.root,
    empresaId: args.empresaId,
    itemSegments: [...args.segments, entry.name],
    index: args.index,
  })))

  return items
    .filter((item) => item.type === 'folder'
      ? args.visibleFolderPaths.has(item.path)
      : hasUserAccessToPath(args.index, item.path, args.currentUserId))
    .sort((left, right) => {
      if (left.type === 'folder' && right.type !== 'folder') return -1
      if (left.type !== 'folder' && right.type === 'folder') return 1
      return left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
    })
}

async function walkUsage(args: { root: string; empresaId: string; index: CrmFilesIndex; currentUserId?: string | null; visibleFolderPaths: Set<string>; segments?: string[] }): Promise<{ usedBytes: number; filesCount: number; foldersCount: number; recentItems: CrmFileItem[] }> {
  const segments = args.segments || []
  const directory = getAbsolutePathForSegments(args.root, segments)
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])

  let usedBytes = 0
  let filesCount = 0
  let foldersCount = segments.length > 0 ? 1 : 0
  let recentItems: CrmFileItem[] = []

  for (const entry of entries) {
    const itemSegments = [...segments, entry.name]
    const itemPath = joinClientPath(itemSegments)
    const absolutePath = getAbsolutePathForSegments(args.root, itemSegments)
    const stats = await fs.stat(absolutePath)

    if (entry.isDirectory()) {
      if (!args.visibleFolderPaths.has(itemPath)) continue
      const child = await walkUsage({ ...args, segments: itemSegments })
      usedBytes += child.usedBytes
      filesCount += child.filesCount
      foldersCount += child.foldersCount
      recentItems = recentItems.concat(child.recentItems)
      continue
    }

    if (!hasUserAccessToPath(args.index, itemPath, args.currentUserId)) continue
    recentItems.push(await buildItemFromSegments({
      root: args.root,
      empresaId: args.empresaId,
      itemSegments,
      index: args.index,
    }))
    usedBytes += stats.size
    filesCount += 1
  }

  recentItems.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  return {
    usedBytes,
    filesCount,
    foldersCount,
    recentItems: recentItems.slice(0, 120),
  }
}

export async function getCrmFilesSnapshot(args: { empresaId: string; currentPath?: string | null; currentUserId?: string | null }): Promise<CrmFilesSnapshot> {
  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const currentSegments = normalizeCrmFilesPath(args.currentPath)
  const tree = await buildFolderTree({ root, index, currentUserId: args.currentUserId })
  const safeTree = tree || { name: '/', path: '', children: [] }
  const currentClientPath = joinClientPath(currentSegments)

  if (currentClientPath && !treeContainsPath(safeTree, currentClientPath)) {
    throw new Error('No tienes acceso a esa carpeta del repositorio.')
  }

  const currentDirectory = getAbsolutePathForSegments(root, currentSegments)
  const currentStats = await fs.stat(currentDirectory).catch(() => null)
  if (!currentStats || !currentStats.isDirectory()) {
    throw new Error('La carpeta solicitada no existe.')
  }

  const visibleFolderPaths = collectVisibleFolderPaths(safeTree)
  const [items, usage] = await Promise.all([
    listDirectoryItems({ root, empresaId: args.empresaId, segments: currentSegments, index, currentUserId: args.currentUserId, visibleFolderPaths }),
    walkUsage({ root, empresaId: args.empresaId, index, currentUserId: args.currentUserId, visibleFolderPaths }),
  ])

  const breadcrumbs = [{ label: '/', path: '' }]
  currentSegments.forEach((segment, indexPosition) => {
    breadcrumbs.push({
      label: segment,
      path: joinClientPath(currentSegments.slice(0, indexPosition + 1)),
    })
  })

  await writeIndex(args.empresaId, index)
  const totalBytes = await getQuotaBytes(args.empresaId)
  return {
    currentPath: currentClientPath,
    breadcrumbs,
    tree: safeTree,
    items,
    recentItems: usage.recentItems,
    usage: {
      totalBytes,
      usedBytes: usage.usedBytes,
      freeBytes: Math.max(totalBytes - usage.usedBytes, 0),
      filesCount: usage.filesCount,
      foldersCount: usage.foldersCount,
    },
  }
}

export async function getCrmStorageUsageSummary(args: { empresaId: string }): Promise<CrmStorageUsageSummary> {
  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const tree = await buildFolderTree({ root, index })
  const visibleFolderPaths = collectVisibleFolderPaths(tree || { name: '/', path: '', children: [] })
  const usage = await walkUsage({ root, empresaId: args.empresaId, index, visibleFolderPaths })
  const totalBytes = await getQuotaBytes(args.empresaId)
  const lastUploadedAt = usage.recentItems.reduce<string | null>((latest, item) => {
    const createdAt = item.createdAt || null
    if (!createdAt) return latest
    if (!latest) return createdAt
    return new Date(createdAt).getTime() > new Date(latest).getTime() ? createdAt : latest
  }, null)

  return {
    totalBytes,
    usedBytes: usage.usedBytes,
    freeBytes: Math.max(totalBytes - usage.usedBytes, 0),
    filesCount: usage.filesCount,
    foldersCount: usage.foldersCount,
    lastUploadedAt,
  }
}

export async function getCrmFileItemByPath(args: { empresaId: string; entryPath: string; currentUserId?: string | null }) {
  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const externalMetadata = index.entries[String(args.entryPath || '').trim()]
  if (externalMetadata?.kind === 'external') {
    if (!hasUserAccessToPath(index, String(args.entryPath || '').trim(), args.currentUserId)) {
      throw new Error('No tienes acceso a ese elemento del repositorio.')
    }
    await writeIndex(args.empresaId, index)
    return buildExternalItem(String(args.entryPath || '').trim(), externalMetadata)
  }
  const segments = normalizeCrmFilesPath(args.entryPath)
  if (!segments.length) {
    throw new Error('Selecciona un archivo o carpeta válida.')
  }
  if (!hasUserAccessToPath(index, joinClientPath(segments), args.currentUserId)) {
    throw new Error('No tienes acceso a ese elemento del repositorio.')
  }
  const item = await buildItemFromSegments({ root, empresaId: args.empresaId, itemSegments: segments, index })
  await writeIndex(args.empresaId, index)
  return item
}

export async function createCrmFolder(args: { empresaId: string; currentPath?: string | null; name: string; actor?: CrmFilesActor }) {
  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const currentSegments = normalizeCrmFilesPath(args.currentPath)
  const folderName = sanitizeFolderName(args.name)

  if (!folderName) {
    throw new Error('Escribe un nombre válido para la carpeta.')
  }

  const folderSegments = [...currentSegments, normalizeSegment(folderName)]
  const target = getAbsolutePathForSegments(root, folderSegments)
  await fs.mkdir(target, { recursive: true })
  const metadata = ensureIndexEntry(index, joinClientPath(folderSegments), 'folder', args.actor)
  if (!metadata.auditTrail.length) {
    appendAudit(metadata, 'CREATED', args.actor, `Carpeta creada por ${args.actor?.label || 'usuario interno'}.`)
  }
  await writeIndex(args.empresaId, index)
  return buildItemFromSegments({ root, empresaId: args.empresaId, itemSegments: folderSegments, index, actorForAutoCreate: args.actor })
}

export async function uploadCrmFiles(args: {
  empresaId: string
  currentPath?: string | null
  actor?: CrmFilesActor
  files: Array<{ name: string; type?: string | null; size?: number | null; bytes: Buffer }>
}) {
  if (!args.files.length) {
    throw new Error('No se recibieron archivos para subir.')
  }

  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const currentSegments = normalizeCrmFilesPath(args.currentPath)
  const directory = getAbsolutePathForSegments(root, currentSegments)
  await fs.mkdir(directory, { recursive: true })
  ensureFolderEntries(index, currentSegments, args.actor)
  const tree = await buildFolderTree({ root, index })
  const visibleFolderPaths = collectVisibleFolderPaths(tree || { name: '/', path: '', children: [] })
  const usage = await walkUsage({ root, empresaId: args.empresaId, index, visibleFolderPaths })
  const quotaBytes = await getQuotaBytes(args.empresaId)
  let projectedUsedBytes = usage.usedBytes
  const uploaded: CrmFileItem[] = []

  for (const file of args.files) {
    if (typeof file.size === 'number' && file.size > MAX_FILE_BYTES) {
      throw new Error(`El archivo ${file.name} supera el límite de 20 MB.`)
    }

    const fileSize = typeof file.size === 'number' && Number.isFinite(file.size) ? file.size : file.bytes.byteLength
    if (projectedUsedBytes + fileSize > quotaBytes) {
      throw new Error('Tu plan alcanzó el límite de espacio disponible para archivos CRM.')
    }

    const extension = path.extname(file.name)
    const baseName = sanitizeFileName(path.basename(file.name, extension)) || 'archivo'
    const finalName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}${extension}`
    const itemSegments = [...currentSegments, finalName]
    const absolutePath = getAbsolutePathForSegments(root, itemSegments)
    await fs.writeFile(absolutePath, file.bytes)
    const metadata = ensureIndexEntry(index, joinClientPath(itemSegments), 'file', args.actor)
    if (!metadata.auditTrail.length) {
      appendAudit(metadata, 'UPLOADED', args.actor, `Archivo subido por ${args.actor?.label || 'usuario interno'}.`)
    }
    uploaded.push(await buildItemFromSegments({ root, empresaId: args.empresaId, itemSegments, index, actorForAutoCreate: args.actor }))
    projectedUsedBytes += fileSize
  }

  await writeIndex(args.empresaId, index)
  return uploaded
}

export async function deleteCrmEntry(args: { empresaId: string; entryPath: string }) {
  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const segments = normalizeCrmFilesPath(args.entryPath)
  if (!segments.length) {
    throw new Error('No se puede eliminar la raíz del administrador.')
  }

  const target = getAbsolutePathForSegments(root, segments)
  const stats = await fs.stat(target).catch(() => null)
  if (!stats) {
    throw new Error('El archivo o carpeta ya no existe.')
  }

  if (stats.isDirectory()) {
    await fs.rm(target, { recursive: true, force: true })
    deleteIndexEntries(index, joinClientPath(segments))
    await writeIndex(args.empresaId, index)
    return { type: 'folder' as const }
  }

  await fs.unlink(target)
  deleteIndexEntries(index, joinClientPath(segments))
  await writeIndex(args.empresaId, index)
  return { type: 'file' as const }
}

export async function renameCrmEntry(args: { empresaId: string; entryPath: string; newName: string; actor?: CrmFilesActor }) {
  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const sourceSegments = normalizeCrmFilesPath(args.entryPath)
  if (!sourceSegments.length) {
    throw new Error('No se puede renombrar la raíz del administrador.')
  }

  const sourcePath = getAbsolutePathForSegments(root, sourceSegments)
  const stats = await fs.stat(sourcePath).catch(() => null)
  if (!stats) {
    throw new Error('El archivo o carpeta no existe.')
  }

  const previousName = sourceSegments[sourceSegments.length - 1] || ''
  const nextName = sanitizeEntryName(previousName, args.newName, stats.isDirectory())
  const targetSegments = [...sourceSegments.slice(0, -1), nextName]
  const targetPath = getAbsolutePathForSegments(root, targetSegments)
  if (sourcePath === targetPath) {
    return buildItemFromSegments({ root, empresaId: args.empresaId, itemSegments: sourceSegments, index })
  }
  if (await pathExists(targetPath)) {
    throw new Error('Ya existe un elemento con ese nombre en la carpeta actual.')
  }

  await fs.rename(sourcePath, targetPath)
  moveIndexEntries(index, joinClientPath(sourceSegments), joinClientPath(targetSegments))
  const metadata = ensureIndexEntry(index, joinClientPath(targetSegments), stats.isDirectory() ? 'folder' : 'file', args.actor)
  appendAudit(metadata, 'RENAMED', args.actor, `${args.actor?.label || 'Usuario interno'} renombró ${previousName} a ${nextName}.`)
  await writeIndex(args.empresaId, index)
  return buildItemFromSegments({ root, empresaId: args.empresaId, itemSegments: targetSegments, index })
}

export async function moveCrmEntry(args: { empresaId: string; entryPath: string; targetDirectoryPath: string; actor?: CrmFilesActor }) {
  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const sourceSegments = normalizeCrmFilesPath(args.entryPath)
  const targetDirectorySegments = normalizeCrmFilesPath(args.targetDirectoryPath)
  if (!sourceSegments.length) {
    throw new Error('No se puede mover la raíz del administrador.')
  }

  const sourcePath = getAbsolutePathForSegments(root, sourceSegments)
  const sourceStats = await fs.stat(sourcePath).catch(() => null)
  if (!sourceStats) {
    throw new Error('El archivo o carpeta no existe.')
  }

  const targetDirectory = getAbsolutePathForSegments(root, targetDirectorySegments)
  const targetDirectoryStats = await fs.stat(targetDirectory).catch(() => null)
  if (!targetDirectoryStats || !targetDirectoryStats.isDirectory()) {
    throw new Error('La carpeta destino no existe.')
  }

  if (sourceStats.isDirectory()) {
    const sourceClientPath = joinClientPath(sourceSegments)
    const targetClientPath = joinClientPath(targetDirectorySegments)
    if (targetClientPath === sourceClientPath || (targetClientPath && targetClientPath.startsWith(`${sourceClientPath}/`))) {
      throw new Error('No puedes mover una carpeta dentro de sí misma.')
    }
  }

  const targetSegments = [...targetDirectorySegments, sourceSegments[sourceSegments.length - 1]]
  const targetPath = getAbsolutePathForSegments(root, targetSegments)
  if (sourcePath === targetPath) {
    return buildItemFromSegments({ root, empresaId: args.empresaId, itemSegments: sourceSegments, index })
  }
  if (await pathExists(targetPath)) {
    throw new Error('Ya existe un elemento con ese nombre en la carpeta destino.')
  }

  await fs.rename(sourcePath, targetPath)
  moveIndexEntries(index, joinClientPath(sourceSegments), joinClientPath(targetSegments))
  const metadata = ensureIndexEntry(index, joinClientPath(targetSegments), sourceStats.isDirectory() ? 'folder' : 'file', args.actor)
  appendAudit(metadata, 'MOVED', args.actor, `${args.actor?.label || 'Usuario interno'} movió el elemento a /${joinClientPath(targetDirectorySegments) || ''}.`)
  await writeIndex(args.empresaId, index)
  return buildItemFromSegments({ root, empresaId: args.empresaId, itemSegments: targetSegments, index })
}

export async function updateCrmEntrySharing(args: { empresaId: string; entryPath: string; sharedWithUserIds: string[]; actor?: CrmFilesActor }) {
  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const externalEntry = index.entries[args.entryPath]
  if (externalEntry?.kind === 'external') {
    externalEntry.sharedWithUserIds = Array.from(new Set(args.sharedWithUserIds.map((userId) => String(userId || '').trim()).filter(Boolean)))
    appendAudit(externalEntry, 'SHARED', args.actor, `${args.actor?.label || 'Usuario interno'} actualizó el acceso compartido con ${externalEntry.sharedWithUserIds.length} usuario(s).`)
    await writeIndex(args.empresaId, index)
    return buildExternalItem(args.entryPath, externalEntry)
  }
  const segments = normalizeCrmFilesPath(args.entryPath)
  if (!segments.length) throw new Error('Selecciona un archivo o carpeta válida.')
  const absolutePath = getAbsolutePathForSegments(root, segments)
  const stats = await fs.stat(absolutePath).catch(() => null)
  if (!stats) throw new Error('El elemento no existe.')

  const entryPath = joinClientPath(segments)
  const metadata = ensureIndexEntry(index, entryPath, stats.isDirectory() ? 'folder' : 'file', args.actor)
  metadata.sharedWithUserIds = Array.from(new Set(args.sharedWithUserIds.map((userId) => String(userId || '').trim()).filter(Boolean)))
  appendAudit(metadata, 'SHARED', args.actor, `${args.actor?.label || 'Usuario interno'} actualizó el acceso compartido con ${metadata.sharedWithUserIds.length} usuario(s).`)
  await writeIndex(args.empresaId, index)
  return buildItemFromSegments({ root, empresaId: args.empresaId, itemSegments: segments, index })
}

export async function linkCrmEntryToEntity(args: { empresaId: string; entryPath: string; entityType: CrmFileEntityType; entityId: string; actor?: CrmFilesActor }) {
  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const externalEntry = index.entries[args.entryPath]
  if (externalEntry?.kind === 'external') {
    const key = mapEntityTypeToKey(args.entityType)
    externalEntry.linkedEntities = normalizeLinkedEntities({
      ...externalEntry.linkedEntities,
      [key]: [...externalEntry.linkedEntities[key], args.entityId],
    })
    appendAudit(externalEntry, 'LINKED', args.actor, `${args.actor?.label || 'Usuario interno'} vinculó este elemento con ${args.entityType} ${args.entityId}.`)
    await writeIndex(args.empresaId, index)
    return buildExternalItem(args.entryPath, externalEntry)
  }
  const segments = normalizeCrmFilesPath(args.entryPath)
  if (!segments.length) throw new Error('Selecciona un archivo o carpeta válida.')
  const absolutePath = getAbsolutePathForSegments(root, segments)
  const stats = await fs.stat(absolutePath).catch(() => null)
  if (!stats) throw new Error('El elemento no existe.')

  const entryPath = joinClientPath(segments)
  const metadata = ensureIndexEntry(index, entryPath, stats.isDirectory() ? 'folder' : 'file', args.actor)
  const key = mapEntityTypeToKey(args.entityType)
  metadata.linkedEntities = normalizeLinkedEntities({
    ...metadata.linkedEntities,
    [key]: [...metadata.linkedEntities[key], args.entityId],
  })
  appendAudit(metadata, 'LINKED', args.actor, `${args.actor?.label || 'Usuario interno'} vinculó este elemento con ${args.entityType} ${args.entityId}.`)
  await writeIndex(args.empresaId, index)
  return buildItemFromSegments({ root, empresaId: args.empresaId, itemSegments: segments, index })
}

export async function unlinkCrmEntryFromEntity(args: { empresaId: string; entryPath: string; entityType: CrmFileEntityType; entityId: string; actor?: CrmFilesActor }) {
  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const externalEntry = index.entries[args.entryPath]
  if (externalEntry?.kind === 'external') {
    const key = mapEntityTypeToKey(args.entityType)
    externalEntry.linkedEntities = normalizeLinkedEntities({
      ...externalEntry.linkedEntities,
      [key]: externalEntry.linkedEntities[key].filter((item) => item !== args.entityId),
    })
    appendAudit(externalEntry, 'UNLINKED', args.actor, `${args.actor?.label || 'Usuario interno'} retiró el vínculo con ${args.entityType} ${args.entityId}.`)
    const hasLinks = Object.values(externalEntry.linkedEntities).some((items) => items.length > 0)
    if (!hasLinks) {
      delete index.entries[args.entryPath]
    }
    await writeIndex(args.empresaId, index)
    return externalEntry.kind === 'external' ? buildExternalItem(args.entryPath, externalEntry) : buildExternalItem(args.entryPath, ensureIndexEntry(index, args.entryPath, 'external', args.actor))
  }
  const segments = normalizeCrmFilesPath(args.entryPath)
  if (!segments.length) throw new Error('Selecciona un archivo o carpeta válida.')
  const absolutePath = getAbsolutePathForSegments(root, segments)
  const stats = await fs.stat(absolutePath).catch(() => null)
  if (!stats) throw new Error('El elemento no existe.')

  const entryPath = joinClientPath(segments)
  const metadata = ensureIndexEntry(index, entryPath, stats.isDirectory() ? 'folder' : 'file', args.actor)
  const key = mapEntityTypeToKey(args.entityType)
  metadata.linkedEntities = normalizeLinkedEntities({
    ...metadata.linkedEntities,
    [key]: metadata.linkedEntities[key].filter((item) => item !== args.entityId),
  })
  appendAudit(metadata, 'UNLINKED', args.actor, `${args.actor?.label || 'Usuario interno'} retiró el vínculo con ${args.entityType} ${args.entityId}.`)
  await writeIndex(args.empresaId, index)
  return buildItemFromSegments({ root, empresaId: args.empresaId, itemSegments: segments, index })
}

export async function listCrmLinkedEntries(args: { empresaId: string; entityType: CrmFileEntityType; entityId: string; currentUserId?: string | null }) {
  const root = await ensureCrmFilesRoot(args.empresaId)
  const index = await readIndex(args.empresaId)
  const key = mapEntityTypeToKey(args.entityType)
  const result: CrmFileItem[] = []

  for (const [entryPath, entry] of Object.entries(index.entries)) {
    if (!entry.linkedEntities[key].includes(args.entityId)) continue
    if (!hasUserAccessToPath(index, entryPath, args.currentUserId)) continue
    if (entry.kind === 'external') {
      result.push(buildExternalItem(entryPath, entry))
      continue
    }
    const segments = normalizeCrmFilesPath(entryPath)
    if (!segments.length) continue
    try {
      result.push(await buildItemFromSegments({ root, empresaId: args.empresaId, itemSegments: segments, index }))
    } catch {
      continue
    }
  }

  await writeIndex(args.empresaId, index)
  return result.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
}

export async function createOrLinkCrmExternalEntry(args: {
  empresaId: string
  entityType: CrmFileEntityType
  entityId: string
  provider: CrmExternalFileProvider
  name: string
  url: string
  externalId?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  updatedAt?: string | null
  actor?: CrmFilesActor
}) {
  const index = await readIndex(args.empresaId)
  const entryPath = buildExternalEntryPath(args.provider, args.externalId, args.url)
  const metadata = ensureIndexEntry(index, entryPath, 'external', args.actor)
  metadata.externalName = args.name.trim() || metadata.externalName || args.externalId || buildExternalProviderLabel(args.provider)
  metadata.externalProvider = args.provider
  metadata.externalUrl = args.url.trim()
  metadata.externalId = String(args.externalId || '').trim() || metadata.externalId || null
  metadata.externalMimeType = String(args.mimeType || '').trim() || null
  metadata.externalSizeBytes = typeof args.sizeBytes === 'number' && Number.isFinite(args.sizeBytes) ? args.sizeBytes : null
  metadata.updatedAt = args.updatedAt ? new Date(args.updatedAt).toISOString() : new Date().toISOString()
  const key = mapEntityTypeToKey(args.entityType)
  metadata.linkedEntities = normalizeLinkedEntities({
    ...metadata.linkedEntities,
    [key]: [...metadata.linkedEntities[key], args.entityId],
  })
  appendAudit(metadata, 'LINKED', args.actor, `${args.actor?.label || 'Usuario interno'} vinculó un archivo externo de ${buildExternalProviderLabel(args.provider)} con ${args.entityType} ${args.entityId}.`)
  await writeIndex(args.empresaId, index)
  return buildExternalItem(entryPath, metadata)
}
