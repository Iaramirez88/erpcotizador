import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { auth } from '@/lib/auth'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import { createWebsiteServiceFieldId, type WebsiteServiceAttachmentType } from '@/lib/website-service-fields'

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
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed',
])

function sanitizeBaseName(filename: string) {
  const clean = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return clean || 'archivo'
}

function resolveAttachmentType(fileType: string): WebsiteServiceAttachmentType | null {
  if (IMAGE_TYPES.has(fileType)) return 'image'
  if (DOCUMENT_TYPES.has(fileType)) return 'document'
  return null
}

async function requireWebsiteServicesAccess() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 }) }
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Sesión inválida' }, { status: 401 }) }
  }

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess || !access.empresaId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Prohibido' }, { status: 403 }) }
  }

  return { ok: true as const, userId, access }
}

export async function POST(request: NextRequest) {
  const guard = await requireWebsiteServicesAccess()
  if (!guard.ok) return guard.response

  try {
    const form = await request.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ ok: false, error: 'Body inválido (multipart/form-data requerido).' }, { status: 400 })
    }

    const file = form.get('file')
    const isUpload = !!file && typeof file === 'object' && typeof (file as { arrayBuffer?: unknown }).arrayBuffer === 'function'
    if (!isUpload) {
      return NextResponse.json({ ok: false, error: 'Falta archivo (campo: file).' }, { status: 400 })
    }

    const fileType = String((file as { type?: unknown }).type || '')
    const fileSize = Number((file as { size?: unknown }).size || 0)
    const originalName = String((file as { name?: unknown }).name || 'archivo')
    const attachmentType = resolveAttachmentType(fileType)

    if (!attachmentType) {
      return NextResponse.json({ ok: false, error: 'Formato no permitido. Usa imagen, PDF, Office, CSV, TXT o comprimidos comunes.' }, { status: 400 })
    }
    if (Number.isFinite(fileSize) && fileSize > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'Archivo demasiado grande (máx 12MB).' }, { status: 400 })
    }

    const ext = path.extname(originalName)
    const safeBaseName = sanitizeBaseName(path.basename(originalName, ext))
    const bytes = Buffer.from(await file.arrayBuffer())
    const relDir = path.posix.join('uploads', 'website-services', guard.access.empresaId)
    const absDir = path.join(process.cwd(), 'public', relDir)
    await fs.mkdir(absDir, { recursive: true })

    const filename = `${Date.now()}-${safeBaseName}${ext}`
    const absPath = path.join(absDir, filename)
    await fs.writeFile(absPath, bytes)

    return NextResponse.json({
      ok: true,
      data: {
        id: createWebsiteServiceFieldId('attachment'),
        name: originalName,
        url: `/${relDir}/${filename}`,
        type: attachmentType,
        mimeType: fileType || null,
        sizeBytes: Number.isFinite(fileSize) ? fileSize : null,
        uploadedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error subiendo archivo de servicio web:', error)
    const detail = process.env.NODE_ENV !== 'production'
      ? (error instanceof Error ? error.message : String(error))
      : undefined
    return NextResponse.json({ ok: false, error: 'Error subiendo archivo', detail }, { status: 500 })
  }
}