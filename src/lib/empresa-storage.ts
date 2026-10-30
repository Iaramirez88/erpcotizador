import fs from 'fs/promises'
import path from 'path'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/prisma'
import { getCrmStorageUsageSummary, getCrmStorageUsageByOwner } from '@/lib/crm-files'
import { getS3Bucket, getS3Client, isS3Enabled } from '@/lib/s3'

export type EmpresaStorageBreakdown = {
  crm: number
  uploads: number
  scans: number
  backups: number
  s3: number
}

export type EmpresaStorageUsageSummary = {
  totalBytes: number
  usedBytes: number
  freeBytes: number
  filesCount: number
  foldersCount: number
  lastUploadedAt: string | null
  breakdown: EmpresaStorageBreakdown
}

async function walkDirectoryBytes(dir: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0
  let files = 0
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const child = await walkDirectoryBytes(absolute)
      bytes += child.bytes
      files += child.files
      continue
    }

    if (entry.isFile()) {
      const stats = await fs.stat(absolute).catch(() => null)
      if (stats) {
        bytes += stats.size
        files += 1
      }
    }
  }

  return { bytes, files }
}

async function getScansBytesForEmpresa(empresaId: string): Promise<{ bytes: number; files: number }> {
  const rows = await prisma.documentScan.findMany({
    where: { OR: [{ sede: { empresaId } }, { user: { empresaId } }] },
    select: { storedFileName: true },
  })

  const scansDir = path.join(process.cwd(), 'public', 'scans')
  let bytes = 0
  let files = 0

  await Promise.all(rows.map(async (row) => {
    const fileName = String(row.storedFileName || '').trim()
    if (!fileName) return
    const stats = await fs.stat(path.join(scansDir, fileName)).catch(() => null)
    if (stats) {
      bytes += stats.size
      files += 1
    }
  }))

  return { bytes, files }
}

async function getUploadsBytesForEmpresa(empresaId: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0
  let files = 0

  for (const folder of ['uploads', 'soportes']) {
    const dir = path.join(process.cwd(), 'public', folder, empresaId)
    const usage = await walkDirectoryBytes(dir)
    bytes += usage.bytes
    files += usage.files
  }

  return { bytes, files }
}

async function getS3BytesForEmpresa(empresaId: string): Promise<{ bytes: number; files: number }> {
  if (!isS3Enabled()) return { bytes: 0, files: 0 }

  try {
    const client = getS3Client()
    const bucket = getS3Bucket()
    const prefix = `${empresaId}/`

    let bytes = 0
    let files = 0
    let continuationToken: string | undefined

    do {
      const result = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }))

      for (const object of result.Contents ?? []) {
        bytes += object.Size ?? 0
        files += 1
      }

      continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined
    } while (continuationToken)

    return { bytes, files }
  } catch {
    // S3 no disponible o sin permisos para listar: se reporta 0 sin romper la vista.
    return { bytes: 0, files: 0 }
  }
}

export async function getEmpresaStorageUsageSummary(args: { empresaId: string }): Promise<EmpresaStorageUsageSummary> {
  const crm = await getCrmStorageUsageSummary({ empresaId: args.empresaId })
  const [backupsAgg, scans, uploads, s3] = await Promise.all([
    prisma.empresaBackup.aggregate({
      where: { empresaId: args.empresaId },
      _sum: { bytes: true },
      _count: true,
    }),
    getScansBytesForEmpresa(args.empresaId),
    getUploadsBytesForEmpresa(args.empresaId),
    getS3BytesForEmpresa(args.empresaId),
  ])

  const breakdown: EmpresaStorageBreakdown = {
    crm: crm.usedBytes,
    uploads: uploads.bytes,
    scans: scans.bytes,
    backups: backupsAgg._sum.bytes ?? 0,
    s3: s3.bytes,
  }

  const usedBytes = breakdown.crm + breakdown.uploads + breakdown.scans + breakdown.backups + breakdown.s3

  return {
    totalBytes: crm.totalBytes,
    usedBytes,
    freeBytes: Math.max(crm.totalBytes - usedBytes, 0),
    filesCount: crm.filesCount + uploads.files + scans.files + s3.files + (backupsAgg._count ?? 0),
    foldersCount: crm.foldersCount,
    lastUploadedAt: crm.lastUploadedAt,
    breakdown,
  }
}

export type EmpresaStorageOwnerEntry = {
  userId: string
  name: string
  usedBytes: number
  filesCount: number
}

export async function getEmpresaStorageUsageByOwner(args: { empresaId: string }): Promise<EmpresaStorageOwnerEntry[]> {
  const entries = await getCrmStorageUsageByOwner({ empresaId: args.empresaId })
  const userIds = entries.map((entry) => entry.userId).filter((id) => id !== 'unassigned')

  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : []

  const nameById = new Map(users.map((user) => [user.id, user.name?.trim() || user.email || user.id]))

  return entries
    .map((entry) => ({
      userId: entry.userId,
      name: entry.userId === 'unassigned' ? 'Sin asignar' : nameById.get(entry.userId) ?? entry.userId,
      usedBytes: entry.usedBytes,
      filesCount: entry.filesCount,
    }))
    .sort((left, right) => right.usedBytes - left.usedBytes)
}
