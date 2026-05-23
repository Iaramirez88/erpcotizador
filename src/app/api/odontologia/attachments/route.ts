import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

const MAX_BYTES = 12 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

function sanitizeBaseName(filename: string) {
  const clean = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return clean || 'archivo'
}

function resolveAttachmentType(fileType: string): 'image' | 'document' | null {
  if (IMAGE_TYPES.has(fileType)) return 'image'
  if (DOCUMENT_TYPES.has(fileType)) return 'document'
  return null
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.CLIENTES, 'WRITE')
    if (!access.ok) return access.response

    const form = await request.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ ok: false, error: 'Body inválido (multipart/form-data requerido)' }, { status: 400 })
    }

    const file = form.get('file')
    const isUpload = !!file && typeof file === 'object' && typeof (file as { arrayBuffer?: unknown }).arrayBuffer === 'function'
    if (!isUpload) {
      return NextResponse.json({ ok: false, error: 'Falta archivo (campo: file)' }, { status: 400 })
    }

    const fileType = String((file as { type?: unknown }).type || '')
    const fileSize = Number((file as { size?: unknown }).size || 0)
    const originalName = String((file as { name?: unknown }).name || 'archivo')
    const attachmentType = resolveAttachmentType(fileType)

    if (!attachmentType) {
      return NextResponse.json({ ok: false, error: 'Formato no permitido. Usa imagen o PDF/documento común.' }, { status: 400 })
    }
    if (Number.isFinite(fileSize) && fileSize > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'Archivo demasiado grande (máx 12MB)' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const ext = path.extname(originalName)
    const safeBaseName = sanitizeBaseName(path.basename(originalName, ext))
    const relDir = path.posix.join('uploads', 'odontologia', access.empresaId, 'clinical-records')
    const absDir = path.join(process.cwd(), 'public', relDir)
    await fs.mkdir(absDir, { recursive: true })

    const filename = `${Date.now()}-${safeBaseName}${ext}`
    const absPath = path.join(absDir, filename)
    await fs.writeFile(absPath, bytes)

    return NextResponse.json({
      ok: true,
      data: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: originalName,
        url: `/${relDir}/${filename}`,
        type: attachmentType,
        mimeType: fileType || null,
        sizeBytes: Number.isFinite(fileSize) ? fileSize : null,
        uploadedAt: new Date().toISOString(),
        provider: 'UPLOAD',
        externalId: null,
      },
    })
  } catch (error) {
    console.error('POST /api/odontologia/attachments error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo subir el archivo clínico' }, { status: 500 })
  }
}