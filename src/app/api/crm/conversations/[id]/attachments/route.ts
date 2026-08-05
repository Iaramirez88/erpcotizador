import fs from 'fs/promises'
import path from 'path'
import { AccessLevel } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess } from '@/lib/crm'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4'])
const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
])

function sanitizeBaseName(filename: string) {
  const clean = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return clean || 'archivo'
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'INBOX',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const conversation = await prisma.crmConversation.findUnique({
      where: { id },
      select: { id: true, empresaId: true, sedeId: true },
    })

    if (!conversation || conversation.empresaId !== access.empresaId) {
      return NextResponse.json({ success: false, error: 'Conversación no encontrada' }, { status: 404 })
    }

    if (conversation.sedeId) {
      const denied = await assertCrmSedeAccess({
        sedeId: conversation.sedeId,
        empresaId: access.empresaId,
        userId: access.userId,
        minLevel: AccessLevel.WRITE,
      })
      if (denied) return denied
    }

    const form = await request.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ success: false, error: 'Body inválido (multipart/form-data requerido)' }, { status: 400 })
    }

    const file = form.get('file')
    const isUpload = !!file && typeof file === 'object' && typeof (file as { arrayBuffer?: unknown }).arrayBuffer === 'function'

    if (!isUpload) {
      return NextResponse.json({ success: false, error: 'Falta archivo (campo: file)' }, { status: 400 })
    }

    const fileType = String((file as { type?: unknown }).type || '')
    const fileSize = Number((file as { size?: unknown }).size || 0)
    const originalName = String((file as { name?: unknown }).name || 'archivo')

    if (!IMAGE_TYPES.has(fileType) && !AUDIO_TYPES.has(fileType) && !DOCUMENT_TYPES.has(fileType)) {
      return NextResponse.json({ success: false, error: 'Formato no permitido. Usa imagen, audio o documento común.' }, { status: 400 })
    }
    if (Number.isFinite(fileSize) && fileSize > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Archivo demasiado grande (máx 8MB)' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const ext = path.extname(originalName) || (
      fileType === 'image/jpeg' ? '.jpg'
        : fileType === 'image/png' ? '.png'
          : fileType === 'audio/mpeg' || fileType === 'audio/mp3' ? '.mp3'
            : fileType === 'audio/ogg' ? '.ogg'
              : fileType === 'audio/wav' ? '.wav'
                : fileType === 'audio/webm' ? '.webm'
                  : fileType === 'audio/mp4' ? '.m4a'
                    : ''
    )
    const safeBaseName = sanitizeBaseName(path.basename(originalName, path.extname(originalName)))
    const relDir = path.posix.join('uploads', 'crm-conversations', id)
    const absDir = path.join(process.cwd(), 'public', relDir)
    await fs.mkdir(absDir, { recursive: true })

    const filename = `${Date.now()}-${safeBaseName}${ext}`
    const absPath = path.join(absDir, filename)
    await fs.writeFile(absPath, bytes)
    await fs.stat(absPath)

    const publicUrl = `/${relDir}/${filename}`
    return NextResponse.json({
      success: true,
      data: {
        name: originalName,
        url: publicUrl,
        type: IMAGE_TYPES.has(fileType) ? 'image' : AUDIO_TYPES.has(fileType) ? 'audio' : 'document',
        mimeType: fileType || null,
        sizeBytes: Number.isFinite(fileSize) ? fileSize : null,
      },
    })
  } catch (error) {
    console.error('Error subiendo adjunto de conversación CRM:', error)
    const detail = process.env.NODE_ENV !== 'production'
      ? (error instanceof Error ? error.message : String(error))
      : undefined
    return NextResponse.json({ success: false, error: 'Error subiendo adjunto', detail }, { status: 500 })
  }
}