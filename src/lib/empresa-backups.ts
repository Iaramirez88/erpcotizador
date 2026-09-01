import { createHash } from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { EmpresaBackupFormat, EmpresaBackupTriggerSource, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ensurePlanOwnerUserIdForEmpresa } from '@/lib/plan-owner'
import { buildXlsxBuffer, formatDateForFilename, type ExcelSheetSpec } from '@/lib/excel-export'

export const BACKUP_MODULES = [
  { id: 'PLATAFORMA', label: 'Plataforma', description: 'Sedes, permisos, ajustes y configuración del espacio.' },
  { id: 'VENTAS', label: 'Ventas', description: 'Clientes, cotizaciones, remisiones, POS y DIAN.' },
  { id: 'CRM', label: 'CRM', description: 'Leads, oportunidades, conversaciones, tareas y canales.' },
  { id: 'OPERACIONES', label: 'Operaciones', description: 'Órdenes, producción, escaneos, chats internos e IA operativa.' },
  { id: 'RECURSOS', label: 'Inventario', description: 'Materiales, inventario, proveedores, compras y catalogos.' },
  { id: 'CONTABILIDAD', label: 'Contabilidad', description: 'Contabilidad, nómina, tesorería y cierres financieros.' },
  { id: 'VERTICALES', label: 'Verticales', description: 'Odontología, dotaciones y restaurante.' },
  { id: 'COTIZADOR', label: 'Litografía', description: 'Tarifarios y configuración especializada de litografía.' },
] as const

export type BackupModuleId = (typeof BACKUP_MODULES)[number]['id']

type RuntimeField = {
  name: string
  kind?: string
  type?: string
  isList?: boolean
  isId?: boolean
  relationFromFields?: string[]
  dbName?: string | null
}

type RuntimeModel = {
  dbName?: string | null
  fields: RuntimeField[]
}

type BackupDateRange = {
  from?: Date | null
  to?: Date | null
}

type BackupRowsByModel = Record<string, Array<Record<string, unknown>>>

type BackupPrismaClient = typeof prisma | Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

type BackupManifest = {
  version: number
  empresaId: string
  moduleIds: BackupModuleId[]
  periodStart: string | null
  periodEnd: string | null
  createdAt: string
  rowsCount: number
  rowsByModel: BackupRowsByModel
}

type ScopeSeed = {
  empresaId: string
  sedeIds: string[]
  userIds: string[]
}

type ScopeState = ScopeSeed & {
  idsByModel: Map<string, string[]>
}

type BackupBuildResult = {
  manifest: BackupManifest
  estimatedBytes: number
  sheetCount: number
  modelOrder: string[]
  scope: ScopeState
}

type CreateBackupArgs = {
  empresaId: string
  userId?: string | null
  moduleIds: BackupModuleId[]
  format: EmpresaBackupFormat
  triggerSource: EmpresaBackupTriggerSource
  range?: BackupDateRange
  label?: string
}

type RestoreBackupArgs = {
  empresaId: string
  userId: string
  sqlContent: string
}

const BACKUP_MANIFEST_BEGIN = '-- SGDIGITAL_BACKUP_MANIFEST_BEGIN'
const BACKUP_MANIFEST_END = '-- SGDIGITAL_BACKUP_MANIFEST_END'
const BACKUP_MANIFEST_VERSION = 1

const DATE_FIELD_CANDIDATES = [
  'createdAt',
  'fecha',
  'fechaCompra',
  'appointmentDate',
  'occurredAt',
  'receivedAt',
  'paidAt',
  'publishAt',
  'sentAt',
  'updatedAt',
  'fechaInicio',
  'fechaEntrega',
] as const

const EXCLUDED_MODELS = new Set<string>([
  'User',
  'EmailVerificationCode',
  'PasswordResetToken',
  'Account',
  'Session',
  'VerificationToken',
  'CotizacionTemplate',
  'CotizacionTemplateVersion',
  'EmpresaCotizacionTemplate',
  'EmpresaCotizacionTemplateVersion',
  'RemisionTemplate',
  'OrdenCompraTemplate',
  'PosInvoiceTemplate',
  'UiPreference',
  'Notification',
  'WebPushSubscription',
  'WorkspaceAccessRequest',
  'BackupAccessGrant',
  'EmpresaBackup',
])

function lowerFirst(value: string) {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value
}

function getRuntimeModels(): Record<string, RuntimeModel> {
  const runtimeDataModel = (prisma as unknown as { _runtimeDataModel?: { models?: Record<string, RuntimeModel> } })._runtimeDataModel
  return runtimeDataModel?.models ?? {}
}

function getRuntimeModel(modelName: string): RuntimeModel | null {
  return getRuntimeModels()[modelName] ?? null
}

function getRuntimeField(modelName: string, fieldName: string): RuntimeField | null {
  return getRuntimeModel(modelName)?.fields.find((field) => field.name === fieldName) ?? null
}

function hasField(modelName: string, fieldName: string): boolean {
  return !!getRuntimeField(modelName, fieldName)
}

function getIdFieldName(modelName: string): string | null {
  const model = getRuntimeModel(modelName)
  if (!model) return null
  return model.fields.find((field) => field.isId)?.name ?? (model.fields.some((field) => field.name === 'id') ? 'id' : null)
}

function getModelDbName(modelName: string): string {
  return getRuntimeModel(modelName)?.dbName ?? modelName
}

function getModelDateField(modelName: string): string | null {
  for (const candidate of DATE_FIELD_CANDIDATES) {
    if (hasField(modelName, candidate)) return candidate
  }
  return null
}

function getModelScalarFieldNames(modelName: string): string[] {
  return (getRuntimeModel(modelName)?.fields ?? [])
    .filter((field) => field.kind === 'scalar' || field.kind === 'enum')
    .map((field) => field.name)
}

function getRelationDependencies(modelName: string, selectedModels: Set<string>): Array<{ sourceField: string; targetModel: string }> {
  const model = getRuntimeModel(modelName)
  if (!model) return []
  return model.fields
    .filter((field) => field.kind === 'object' && Array.isArray(field.relationFromFields) && field.relationFromFields.length === 1 && selectedModels.has(String(field.type)))
    .map((field) => ({ sourceField: String(field.relationFromFields?.[0] ?? ''), targetModel: String(field.type ?? '') }))
    .filter((item) => item.sourceField && item.targetModel)
}

function classifyModel(modelName: string): BackupModuleId | null {
  if (EXCLUDED_MODELS.has(modelName)) return null

  if (/^Crm/.test(modelName)) return 'CRM'
  if (/^(Accounting|Payroll|Treasury)/.test(modelName) || modelName === 'BillingInvoice' || modelName === 'BillingReminderLog') return 'CONTABILIDAD'
  if (/^(Odontology|DotacionPedido|RestauranteTurno)/.test(modelName)) return 'VERTICALES'
  if (/^Litografia/.test(modelName)) return 'COTIZADOR'
  if (/^(Inventory|Material|Product|Proveedor|Compra|Terminado|CustomProductRequest|SedeMaterialWaste)/.test(modelName)) return 'RECURSOS'
  if (/^(Pos|Remision|Cotizacion|Cliente|DianElectronic|ItemCotizacion)/.test(modelName)) return 'VENTAS'
  if (/^(OrdenTrabajo|EtapaProduccion|Maquina|DocumentScan|DecisionEngineSnapshot|InternalChat)/.test(modelName)) return 'OPERACIONES'

  const platformModels = new Set<string>([
    'EmpresaModuleOverride',
    'DomainEntitlement',
    'CapabilityEntitlement',
    'RegistrationInvite',
    'Sede',
    'SedeMembership',
    'Team',
    'TeamMember',
    'UserModuleAccess',
    'UserGlobalAccess',
    'UserCapabilityGrant',
    'PermissionProfile',
    'PermissionProfileAssignment',
    'WebsiteService',
    'WebsiteServiceReminderSetting',
    'WebsiteServiceReminderLog',
    'WebsiteServiceMessageTemplate',
    'WebsiteServiceModuleAccess',
    'ConfigDropdown',
    'ConfigDropdownItem',
    'HelpVideo',
  ])

  return platformModels.has(modelName) ? 'PLATAFORMA' : null
}

export function listBackupModules() {
  return BACKUP_MODULES.map((moduleItem) => ({ ...moduleItem }))
}

function listExportableModels(moduleIds: BackupModuleId[]): string[] {
  const selectedModules = new Set(moduleIds)
  return Object.keys(getRuntimeModels())
    .filter((modelName) => selectedModules.has(classifyModel(modelName) as BackupModuleId))
    .sort((a, b) => a.localeCompare(b))
}

function topologicalSortModels(modelNames: string[]): string[] {
  const selectedModels = new Set(modelNames)
  const indegree = new Map<string, number>(modelNames.map((name) => [name, 0]))
  const edges = new Map<string, Set<string>>()

  for (const modelName of modelNames) {
    for (const dependency of getRelationDependencies(modelName, selectedModels)) {
      if (!edges.has(dependency.targetModel)) edges.set(dependency.targetModel, new Set())
      if (!edges.get(dependency.targetModel)?.has(modelName)) {
        edges.get(dependency.targetModel)?.add(modelName)
        indegree.set(modelName, (indegree.get(modelName) ?? 0) + 1)
      }
    }
  }

  const queue = modelNames.filter((name) => (indegree.get(name) ?? 0) === 0).sort((a, b) => a.localeCompare(b))
  const sorted: string[] = []

  while (queue.length) {
    const current = queue.shift() as string
    sorted.push(current)

    for (const next of edges.get(current) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1)
      if ((indegree.get(next) ?? 0) === 0) {
        queue.push(next)
        queue.sort((a, b) => a.localeCompare(b))
      }
    }
  }

  if (sorted.length === modelNames.length) return sorted

  const remaining = modelNames.filter((name) => !sorted.includes(name)).sort((a, b) => a.localeCompare(b))
  return [...sorted, ...remaining]
}

async function buildScopeSeed(empresaId: string): Promise<ScopeSeed> {
  const [sedes, users] = await Promise.all([
    prisma.sede.findMany({ where: { empresaId }, select: { id: true } }),
    prisma.user.findMany({
      where: {
        OR: [
          { empresaId },
          { sedeMemberships: { some: { sede: { empresaId } } } },
        ],
      },
      select: { id: true },
    }),
  ])

  return {
    empresaId,
    sedeIds: sedes.map((item) => item.id),
    userIds: users.map((item) => item.id),
  }
}

function buildDateWhere(modelName: string, range?: BackupDateRange): Record<string, unknown> | null {
  if (!range?.from && !range?.to) return null
  const dateField = getModelDateField(modelName)
  if (!dateField) return null
  return {
    [dateField]: {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    },
  }
}

function combineWhere(parts: Array<Record<string, unknown> | null>): Record<string, unknown> | null {
  const activeParts = parts.filter(Boolean) as Record<string, unknown>[]
  if (!activeParts.length) return null
  if (activeParts.length === 1) return activeParts[0]
  return { AND: activeParts }
}

function buildModelWhere(modelName: string, scope: ScopeState, range?: BackupDateRange): Record<string, unknown> | null {
  const directScopeParts: Array<Record<string, unknown> | null> = []

  if (hasField(modelName, 'empresaId')) {
    directScopeParts.push({ empresaId: scope.empresaId })
  } else if (hasField(modelName, 'sedeId') && scope.sedeIds.length) {
    directScopeParts.push({ sedeId: { in: scope.sedeIds } })
  } else if (hasField(modelName, 'userId') && scope.userIds.length) {
    directScopeParts.push({ userId: { in: scope.userIds } })
  }

  if (directScopeParts.length) {
    return combineWhere([...directScopeParts, buildDateWhere(modelName, range)])
  }

  const relationDependencies = getRelationDependencies(modelName, new Set(Object.keys(getRuntimeModels())))
  for (const relation of relationDependencies) {
    const parentIds = scope.idsByModel.get(relation.targetModel) ?? []
    if (!parentIds.length) continue
    return { [relation.sourceField]: { in: parentIds } }
  }

  return null
}

function getDelegate(client: BackupPrismaClient, modelName: string): {
  findMany: (args?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>
  create: (args: Record<string, unknown>) => Promise<unknown>
  deleteMany: (args?: Record<string, unknown>) => Promise<{ count: number }>
} | null {
  const delegate = (client as unknown as Record<string, unknown>)[lowerFirst(modelName)] as {
    findMany?: (args?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>
    create?: (args: Record<string, unknown>) => Promise<unknown>
    deleteMany?: (args?: Record<string, unknown>) => Promise<{ count: number }>
  } | undefined

  if (!delegate?.findMany || !delegate?.create || !delegate?.deleteMany) return null
  return delegate as {
    findMany: (args?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>
    create: (args: Record<string, unknown>) => Promise<unknown>
    deleteMany: (args?: Record<string, unknown>) => Promise<{ count: number }>
  }
}

function getModelOrderBy(modelName: string): Record<string, 'asc'> | undefined {
  if (hasField(modelName, 'createdAt')) return { createdAt: 'asc' }
  if (hasField(modelName, 'updatedAt')) return { updatedAt: 'asc' }
  const idField = getIdFieldName(modelName)
  return idField ? { [idField]: 'asc' } : undefined
}

function normalizeJsonValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => normalizeJsonValue(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeJsonValue(item)]))
  }
  return value
}

function estimateRowsBytes(rowsByModel: BackupRowsByModel): number {
  return Buffer.byteLength(JSON.stringify(rowsByModel), 'utf8')
}

async function buildBackupRows(args: {
  empresaId: string
  moduleIds: BackupModuleId[]
  range?: BackupDateRange
  client?: BackupPrismaClient
}): Promise<BackupBuildResult> {
  const client = args.client ?? prisma
  const modelNames = topologicalSortModels(listExportableModels(args.moduleIds))
  const seed = await buildScopeSeed(args.empresaId)
  const scope: ScopeState = { ...seed, idsByModel: new Map() }
  const rowsByModel: BackupRowsByModel = {}
  let rowsCount = 0
  let sheetCount = 0

  for (const modelName of modelNames) {
    const delegate = getDelegate(client, modelName)
    if (!delegate) continue

    const where = buildModelWhere(modelName, scope, args.range)
    if (!where) continue

    const rows = await delegate.findMany({ where, orderBy: getModelOrderBy(modelName) })
    if (!rows.length) continue

    rowsByModel[modelName] = rows.map((row) => normalizeJsonValue(row) as Record<string, unknown>)
    rowsCount += rows.length
    sheetCount += 1

    const idField = getIdFieldName(modelName)
    if (idField) {
      const ids = rows.map((row) => String(row[idField] ?? '')).filter(Boolean)
      scope.idsByModel.set(modelName, ids)
    }
  }

  return {
    manifest: {
      version: BACKUP_MANIFEST_VERSION,
      empresaId: args.empresaId,
      moduleIds: args.moduleIds,
      periodStart: args.range?.from ? args.range.from.toISOString() : null,
      periodEnd: args.range?.to ? args.range.to.toISOString() : null,
      createdAt: new Date().toISOString(),
      rowsCount,
      rowsByModel,
    },
    estimatedBytes: estimateRowsBytes(rowsByModel),
    sheetCount,
    modelOrder: modelNames,
    scope,
  }
}

async function deleteRowsFromBuild(args: {
  built: BackupBuildResult
  client?: BackupPrismaClient
}) {
  const client = args.client ?? prisma

  for (const modelName of [...args.built.modelOrder].reverse()) {
    const rows = args.built.manifest.rowsByModel[modelName] ?? []
    if (!rows.length) continue

    const delegate = getDelegate(client, modelName)
    if (!delegate) continue

    const idField = getIdFieldName(modelName)
    if (idField) {
      const ids = rows.map((row) => row[idField]).filter((value): value is string | number => value != null)
      if (ids.length) {
        await delegate.deleteMany({ where: { [idField]: { in: ids } } })
        continue
      }
    }

    const where = buildModelWhere(modelName, args.built.scope)
    if (!where) continue
    await delegate.deleteMany({ where })
  }
}

function chunkString(value: string, chunkSize = 120): string[] {
  const chunks: string[] = []
  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize))
  }
  return chunks
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function sqlScalarLiteral(value: unknown): string {
  if (value == null) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  return sqlStringLiteral(String(value))
}

function resolveArraySqlType(field: RuntimeField | null): string {
  switch (field?.type) {
    case 'Int':
      return 'integer'
    case 'Float':
      return 'double precision'
    case 'Boolean':
      return 'boolean'
    case 'DateTime':
      return 'timestamptz'
    default:
      return 'text'
  }
}

function toSqlLiteral(modelName: string, fieldName: string, value: unknown): string {
  const field = getRuntimeField(modelName, fieldName)

  if (value == null) return 'NULL'

  if (field?.isList) {
    const items = Array.isArray(value) ? value : []
    const sqlType = resolveArraySqlType(field)
    if (!items.length) return `ARRAY[]::${sqlType}[]`
    return `ARRAY[${items.map((item) => sqlScalarLiteral(item)).join(', ')}]::${sqlType}[]`
  }

  if (field?.type === 'Json' || (typeof value === 'object' && !(value instanceof Date))) {
    return `${sqlStringLiteral(JSON.stringify(value))}::jsonb`
  }

  if (field?.type === 'DateTime' || value instanceof Date) {
    return `${sqlStringLiteral(new Date(value as string | number | Date).toISOString())}::timestamptz`
  }

  return sqlScalarLiteral(value)
}

function buildSqlDocument(manifest: BackupManifest): string {
  const encodedManifest = Buffer.from(JSON.stringify(manifest), 'utf8').toString('base64')
  const manifestLines = chunkString(encodedManifest).map((line) => `-- ${line}`)
  const statements: string[] = []

  for (const modelName of Object.keys(manifest.rowsByModel)) {
    const rows = manifest.rowsByModel[modelName] ?? []
    if (!rows.length) continue

    const scalarFields = getModelScalarFieldNames(modelName)
    const tableName = getModelDbName(modelName)
    statements.push(`-- Modelo: ${modelName} (${rows.length} fila(s))`)

    for (const row of rows) {
      const columns = scalarFields.filter((fieldName) => Object.prototype.hasOwnProperty.call(row, fieldName))
      if (!columns.length) continue
      const values = columns.map((fieldName) => toSqlLiteral(modelName, fieldName, row[fieldName]))
      statements.push(`INSERT INTO ${quoteIdentifier(tableName)} (${columns.map((name) => quoteIdentifier(getRuntimeField(modelName, name)?.dbName ?? name)).join(', ')}) VALUES (${values.join(', ')});`)
    }
  }

  return [
    BACKUP_MANIFEST_BEGIN,
    ...manifestLines,
    BACKUP_MANIFEST_END,
    'BEGIN;',
    ...statements,
    'COMMIT;',
    '',
  ].join('\n')
}

function buildExcelSheets(manifest: BackupManifest): ExcelSheetSpec[] {
  return Object.entries(manifest.rowsByModel).map(([modelName, rows]) => ({
    name: modelName,
    rows,
  }))
}

function getBackupFolder(empresaId: string): string {
  return path.join(process.cwd(), 'storage', 'backups', empresaId)
}

function getBackupManifestPath(empresaId: string, backupId: string): string {
  return path.join(getBackupFolder(empresaId), `${backupId}.manifest.json`)
}

async function ensureBackupFolder(empresaId: string) {
  await fs.mkdir(getBackupFolder(empresaId), { recursive: true })
}

async function writeBackupArtifacts(args: {
  empresaId: string
  backupId: string
  format: EmpresaBackupFormat
  manifest: BackupManifest
}): Promise<{ fileName: string; filePath: string; mimeType: string; bytes: number; checksum: string }> {
  await ensureBackupFolder(args.empresaId)
  const dateTag = formatDateForFilename(new Date())
  const extension = args.format === 'SQL' ? 'sql' : 'xlsx'
  const fileName = `respaldo-${args.empresaId}-${dateTag}-${args.backupId}.${extension}`
  const filePath = path.join(getBackupFolder(args.empresaId), fileName)
  const manifestPath = getBackupManifestPath(args.empresaId, args.backupId)

  const fileBuffer = args.format === 'SQL'
    ? Buffer.from(buildSqlDocument(args.manifest), 'utf8')
    : await buildXlsxBuffer(buildExcelSheets(args.manifest))

  await fs.writeFile(filePath, fileBuffer)
  await fs.writeFile(manifestPath, JSON.stringify(args.manifest, null, 2), 'utf8')

  return {
    fileName,
    filePath,
    mimeType: args.format === 'SQL' ? 'application/sql' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    bytes: fileBuffer.byteLength,
    checksum: createHash('sha256').update(fileBuffer).digest('hex'),
  }
}

function normalizeModuleIds(moduleIds: string[] | BackupModuleId[] | null | undefined): BackupModuleId[] {
  const allowed = new Set(BACKUP_MODULES.map((item) => item.id))
  const next = Array.from(new Set((moduleIds ?? []).filter((item): item is BackupModuleId => typeof item === 'string' && allowed.has(item as BackupModuleId))))
  return next.length ? next : BACKUP_MODULES.map((item) => item.id)
}

export async function estimateBackup(args: { empresaId: string; moduleIds?: BackupModuleId[]; range?: BackupDateRange }) {
  const normalizedModuleIds = normalizeModuleIds(args.moduleIds)
  const built = await buildBackupRows({ empresaId: args.empresaId, moduleIds: normalizedModuleIds, range: args.range })
  return {
    moduleIds: normalizedModuleIds,
    estimatedBytes: built.estimatedBytes,
    rowsCount: built.manifest.rowsCount,
    modelsCount: Object.keys(built.manifest.rowsByModel).length,
    periodStart: built.manifest.periodStart,
    periodEnd: built.manifest.periodEnd,
  }
}

export async function createEmpresaBackup(args: CreateBackupArgs) {
  const normalizedModuleIds = normalizeModuleIds(args.moduleIds)
  const built = await buildBackupRows({ empresaId: args.empresaId, moduleIds: normalizedModuleIds, range: args.range })
  const backupId = globalThis.crypto?.randomUUID?.() ?? createHash('sha1').update(`${args.empresaId}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 24)
  const artifact = await writeBackupArtifacts({ empresaId: args.empresaId, backupId, format: args.format, manifest: built.manifest })

  const record = await prisma.empresaBackup.create({
    data: {
      id: backupId,
      empresaId: args.empresaId,
      createdByUserId: args.userId ?? null,
      triggerSource: args.triggerSource,
      format: args.format,
      fileName: artifact.fileName,
      storagePath: artifact.filePath,
      mimeType: artifact.mimeType,
      bytes: artifact.bytes,
      rowsCount: built.manifest.rowsCount,
      checksum: artifact.checksum,
      modulesJson: normalizedModuleIds,
      filtersJson: {
        label: args.label ?? null,
        periodStart: built.manifest.periodStart,
        periodEnd: built.manifest.periodEnd,
      },
      periodStart: args.range?.from ?? null,
      periodEnd: args.range?.to ?? null,
    },
    select: {
      id: true,
      fileName: true,
      format: true,
      bytes: true,
      rowsCount: true,
      createdAt: true,
      triggerSource: true,
    },
  })

  return { ...record, moduleIds: normalizedModuleIds, estimatedBytes: built.estimatedBytes }
}

export async function ensureMonthlyAutomaticBackup(args: { empresaId: string }) {
  const now = new Date()
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  const existing = await prisma.empresaBackup.findFirst({
    where: {
      empresaId: args.empresaId,
      triggerSource: 'AUTO',
      periodStart,
      periodEnd,
    },
    select: { id: true },
  })

  if (existing?.id) return existing

  return createEmpresaBackup({
    empresaId: args.empresaId,
    moduleIds: BACKUP_MODULES.map((item) => item.id),
    format: 'SQL',
    triggerSource: 'AUTO',
    range: { from: periodStart, to: periodEnd },
    label: 'Respaldo automático mensual',
  })
}

export async function getBackupAccess(args: { empresaId: string; userId: string }) {
  const [user, adminMembership, grant] = await Promise.all([
    prisma.user.findUnique({ where: { id: args.userId }, select: { role: true } }),
    prisma.sedeMembership.findFirst({
      where: { userId: args.userId, sede: { empresaId: args.empresaId }, role: 'ADMIN' },
      select: { id: true },
    }),
    prisma.backupAccessGrant.findUnique({
      where: { empresaId_userId: { empresaId: args.empresaId, userId: args.userId } },
      select: { allowImport: true },
    }),
  ])

  const isAdmin = user?.role === 'ADMIN' || Boolean(adminMembership?.id)
  return {
    isAdmin,
    hasGrant: Boolean(grant),
    canExport: isAdmin || Boolean(grant),
    canImport: isAdmin || Boolean(grant?.allowImport),
  }
}

export async function resolveBackupDangerZoneRecipient(args: { empresaId: string; fallbackUserId: string }) {
  const ownerUserId = await ensurePlanOwnerUserIdForEmpresa(args.empresaId)

  const [ownerUser, currentUser, firstAdminUser, empresa] = await Promise.all([
    ownerUserId
      ? prisma.user.findUnique({
          where: { id: ownerUserId },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve(null),
    prisma.user.findUnique({
      where: { id: args.fallbackUserId },
      select: { id: true, name: true, email: true },
    }),
    prisma.user.findFirst({
      where: {
        email: { not: '' },
        sedeMemberships: {
          some: {
            role: 'ADMIN',
            sede: { empresaId: args.empresaId },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true },
    }),
    prisma.empresa.findUnique({
      where: { id: args.empresaId },
      select: { nombre: true, email: true },
    }),
  ])

  const candidates = [
    ownerUser,
    currentUser,
    firstAdminUser,
    empresa?.email && currentUser?.id
      ? {
          id: currentUser.id,
          name: empresa.nombre,
          email: empresa.email,
        }
      : null,
  ]

  const selected = candidates.find((candidate) => candidate?.email?.trim())
  if (!selected?.email) return null

  return {
    userId: selected.id,
    name: selected.name?.trim() || null,
    email: selected.email.trim().toLowerCase(),
  }
}

export async function listBackupAccessUsers(empresaId: string) {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { empresaId },
        { sedeMemberships: { some: { sede: { empresaId } } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      backupAccessGrants: {
        where: { empresaId },
        select: { allowImport: true, createdAt: true },
      },
      sedeMemberships: {
        where: { sede: { empresaId }, role: 'ADMIN' },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
  })

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.sedeMemberships.length > 0,
    hasGrant: user.backupAccessGrants.length > 0,
    allowImport: user.backupAccessGrants[0]?.allowImport ?? false,
    grantedAt: user.backupAccessGrants[0]?.createdAt ?? null,
  }))
}

export async function upsertBackupAccessGrant(args: { empresaId: string; userId: string; enabled: boolean; allowImport: boolean }) {
  if (!args.enabled) {
    await prisma.backupAccessGrant.deleteMany({ where: { empresaId: args.empresaId, userId: args.userId } })
    return { enabled: false, allowImport: false }
  }

  const row = await prisma.backupAccessGrant.upsert({
    where: { empresaId_userId: { empresaId: args.empresaId, userId: args.userId } },
    create: { empresaId: args.empresaId, userId: args.userId, allowImport: args.allowImport },
    update: { allowImport: args.allowImport },
    select: { allowImport: true },
  })

  return { enabled: true, allowImport: row.allowImport }
}

export async function listEmpresaBackups(empresaId: string) {
  const rows = await prisma.empresaBackup.findMany({
    where: { empresaId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      format: true,
      triggerSource: true,
      fileName: true,
      bytes: true,
      rowsCount: true,
      periodStart: true,
      periodEnd: true,
      importedAt: true,
      createdAt: true,
      createdByUser: { select: { id: true, name: true, email: true } },
      importedByUser: { select: { id: true, name: true, email: true } },
      modulesJson: true,
      filtersJson: true,
    },
    take: 60,
  })

  return rows.map((row) => ({
    ...row,
    modulesJson: Array.isArray(row.modulesJson) ? row.modulesJson : [],
    filtersJson: row.filtersJson ?? {},
  }))
}

export async function readBackupFile(empresaId: string, backupId: string) {
  const row = await prisma.empresaBackup.findFirst({
    where: { id: backupId, empresaId },
    select: { id: true, storagePath: true, fileName: true, mimeType: true, format: true },
  })

  if (!row) return null
  const buffer = await fs.readFile(row.storagePath)
  return { ...row, buffer }
}

export async function importEmpresaBackup(args: RestoreBackupArgs) {
  const manifest = parseSqlBackupManifest(args.sqlContent)
  if (manifest.empresaId !== args.empresaId) {
    throw new Error('El respaldo no corresponde a esta empresa.')
  }

  const moduleIds = normalizeModuleIds(manifest.moduleIds)
  const modelNames = topologicalSortModels(Object.keys(manifest.rowsByModel))

  await prisma.$transaction(async (tx) => {
    const current = await buildBackupRows({ empresaId: args.empresaId, moduleIds, client: tx })
    await deleteRowsFromBuild({ built: current, client: tx as unknown as PrismaClient })

    for (const modelName of modelNames) {
      const delegate = getDelegate(tx as unknown as PrismaClient, modelName)
      const rows = manifest.rowsByModel[modelName] ?? []
      if (!delegate || !rows.length) continue

      for (const row of rows) {
        await delegate.create({ data: row })
      }
    }
  })

  const created = await prisma.empresaBackup.create({
    data: {
      empresaId: args.empresaId,
      createdByUserId: args.userId,
      importedByUserId: args.userId,
      triggerSource: 'IMPORT',
      format: 'SQL',
      fileName: `importado-${formatDateForFilename(new Date())}.sql`,
      storagePath: '',
      mimeType: 'application/sql',
      bytes: Buffer.byteLength(args.sqlContent, 'utf8'),
      rowsCount: manifest.rowsCount,
      modulesJson: moduleIds,
      filtersJson: {
        restoredFromUpload: true,
        sourceCreatedAt: manifest.createdAt,
      },
      periodStart: manifest.periodStart ? new Date(manifest.periodStart) : null,
      periodEnd: manifest.periodEnd ? new Date(manifest.periodEnd) : null,
      importedAt: new Date(),
    },
    select: { id: true, rowsCount: true, createdAt: true },
  })

  return { backup: created, rowsCount: manifest.rowsCount, modelCount: Object.keys(manifest.rowsByModel).length }
}

async function removePathIfExists(targetPath: string) {
  await fs.rm(targetPath, { recursive: true, force: true })
}

export async function purgeEmpresaWorkspaceData(args: { empresaId: string; moduleIds?: BackupModuleId[] }) {
  const moduleIds = normalizeModuleIds(args.moduleIds)
  const built = await buildBackupRows({ empresaId: args.empresaId, moduleIds })

  await prisma.$transaction(async (tx) => {
    await deleteRowsFromBuild({ built, client: tx as unknown as PrismaClient })
    await tx.backupAccessGrant.deleteMany({ where: { empresaId: args.empresaId } })
    await tx.empresaBackup.deleteMany({ where: { empresaId: args.empresaId } })
    await tx.user.updateMany({ where: { empresaId: args.empresaId }, data: { empresaId: null } })
    await tx.empresa.update({
      where: { id: args.empresaId },
      data: {
        planOwnerUserId: null,
        onboardingData: {},
        dashboardConfig: {},
        dianSettings: {},
      },
    })
  })

  await Promise.allSettled([
    removePathIfExists(getBackupFolder(args.empresaId)),
    removePathIfExists(path.join(process.cwd(), '.runtime-data', 'ai-workspace-history', `${args.empresaId}.json`)),
    removePathIfExists(path.join(process.cwd(), '.runtime-data', 'crm-files', `${args.empresaId}.json`)),
    removePathIfExists(path.join(process.cwd(), '.runtime-data', 'litografia-ai-knowledge', `${args.empresaId}.json`)),
    removePathIfExists(path.join(process.cwd(), '.runtime-data', 'litografia-ai-pending-images', args.empresaId)),
    removePathIfExists(path.join(process.cwd(), '.runtime-data', 'litografia-ai-pending-vectorizations', args.empresaId)),
    removePathIfExists(path.join(process.cwd(), 'public', 'uploads', 'crm-files', args.empresaId)),
    removePathIfExists(path.join(process.cwd(), 'public', 'uploads', 'crm-inbound-media', args.empresaId)),
  ])

  return {
    deletedRows: built.manifest.rowsCount,
    deletedModels: Object.keys(built.manifest.rowsByModel).length,
    moduleIds,
  }
}

export function parseSqlBackupManifest(sqlContent: string): BackupManifest {
  const lines = sqlContent.split(/\r?\n/g)
  const startIndex = lines.findIndex((line) => line.trim() === BACKUP_MANIFEST_BEGIN)
  const endIndex = lines.findIndex((line) => line.trim() === BACKUP_MANIFEST_END)

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex + 1) {
    throw new Error('El archivo SQL no contiene un manifiesto de respaldo válido.')
  }

  const encoded = lines
    .slice(startIndex + 1, endIndex)
    .map((line) => line.replace(/^--\s?/, '').trim())
    .join('')

  const parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as BackupManifest
  if (!parsed || parsed.version !== BACKUP_MANIFEST_VERSION || !parsed.empresaId || !parsed.rowsByModel) {
    throw new Error('El manifiesto del respaldo es inválido.')
  }

  return parsed
}

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}