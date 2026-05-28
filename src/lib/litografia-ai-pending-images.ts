import crypto from 'node:crypto'
import fs from 'fs/promises'
import path from 'path'

export type LitografiaAiPendingImageRecord = {
  id: string
  empresaId: string
  prompt: string
  revisedPrompt: string | null
  size: '1024x1024' | '1024x1536' | '1536x1024'
  quality: 'low' | 'medium' | 'high' | 'auto'
  provider: string
  model: string
  mimeType: 'image/png'
  base64: string
  createdAt: string
}

const MAX_PENDING_AGE_MS = 1000 * 60 * 60 * 12

function getPendingFolder(empresaId: string) {
  return path.join(process.cwd(), '.runtime-data', 'litografia-ai-pending-images', empresaId)
}

function getPendingFilePath(empresaId: string, pendingId: string) {
  return path.join(getPendingFolder(empresaId), `${pendingId}.json`)
}

async function ensurePendingFolder(empresaId: string) {
  const folder = getPendingFolder(empresaId)
  await fs.mkdir(folder, { recursive: true })
  return folder
}

export async function createPendingLitografiaAiImage(args: Omit<LitografiaAiPendingImageRecord, 'id' | 'createdAt'>) {
  const id = crypto.randomUUID()
  const record: LitografiaAiPendingImageRecord = {
    id,
    createdAt: new Date().toISOString(),
    ...args,
  }

  await ensurePendingFolder(args.empresaId)
  await fs.writeFile(getPendingFilePath(args.empresaId, id), JSON.stringify(record, null, 2), 'utf8')
  return record
}

export async function readPendingLitografiaAiImage(args: { empresaId: string; pendingId: string }) {
  try {
    const raw = await fs.readFile(getPendingFilePath(args.empresaId, args.pendingId), 'utf8')
    const parsed = JSON.parse(raw) as LitografiaAiPendingImageRecord
    const createdAt = new Date(parsed.createdAt)
    if (Number.isNaN(createdAt.getTime())) return null
    if (Date.now() - createdAt.getTime() > MAX_PENDING_AGE_MS) {
      await deletePendingLitografiaAiImage(args).catch(() => null)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export async function deletePendingLitografiaAiImage(args: { empresaId: string; pendingId: string }) {
  await fs.unlink(getPendingFilePath(args.empresaId, args.pendingId)).catch(() => null)
}