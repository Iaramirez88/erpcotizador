import crypto from 'node:crypto'
import fs from 'fs/promises'
import path from 'path'

export type LitografiaAiPendingVectorizationRecord = {
  id: string
  empresaId: string
  actorUserId: string
  sourceFileName: string
  sourceMimeType: string
  sourceSizeBytes: number
  provider: 'Vectorizer.AI'
  outputFormat: 'svg'
  imageToken: string | null
  base64: string
  createdAt: string
}

const MAX_PENDING_AGE_MS = 1000 * 60 * 60 * 12

function getPendingFolder(empresaId: string) {
  return path.join(process.cwd(), '.runtime-data', 'litografia-ai-pending-vectorizations', empresaId)
}

function getPendingFilePath(empresaId: string, pendingId: string) {
  return path.join(getPendingFolder(empresaId), `${pendingId}.json`)
}

async function ensurePendingFolder(empresaId: string) {
  const folder = getPendingFolder(empresaId)
  await fs.mkdir(folder, { recursive: true })
  return folder
}

export async function createPendingLitografiaAiVectorization(args: Omit<LitografiaAiPendingVectorizationRecord, 'id' | 'createdAt'>) {
  const id = crypto.randomUUID()
  const record: LitografiaAiPendingVectorizationRecord = {
    id,
    createdAt: new Date().toISOString(),
    ...args,
  }

  await ensurePendingFolder(args.empresaId)
  await fs.writeFile(getPendingFilePath(args.empresaId, id), JSON.stringify(record, null, 2), 'utf8')
  return record
}

export async function readPendingLitografiaAiVectorization(args: { empresaId: string; pendingId: string }) {
  try {
    const raw = await fs.readFile(getPendingFilePath(args.empresaId, args.pendingId), 'utf8')
    const parsed = JSON.parse(raw) as LitografiaAiPendingVectorizationRecord
    const createdAt = new Date(parsed.createdAt)
    if (Number.isNaN(createdAt.getTime())) return null
    if (Date.now() - createdAt.getTime() > MAX_PENDING_AGE_MS) {
      await deletePendingLitografiaAiVectorization(args).catch(() => null)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function deletePendingLitografiaAiVectorization(args: { empresaId: string; pendingId: string }) {
  await fs.unlink(getPendingFilePath(args.empresaId, args.pendingId)).catch(() => null)
}