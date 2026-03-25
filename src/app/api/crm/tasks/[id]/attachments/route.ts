import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess } from '@/lib/crm'
import { canUserAccessWorkspace, getAccessibleTaskWorkspace } from '@/lib/crm-task-workspaces'

export const runtime = 'nodejs'

const MAX_BYTES = 12 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/mp4'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
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
])

function sanitizeBaseName(filename: string): string {
  const clean = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return clean || 'archivo'
}

function resolveAttachmentType(fileType: string): 'image' | 'audio' | 'video' | 'document' | null {
  if (IMAGE_TYPES.has(fileType)) return 'image'
  if (AUDIO_TYPES.has(fileType)) return 'audio'
  if (VIDEO_TYPES.has(fileType)) return 'video'
  if (DOCUMENT_TYPES.has(fileType)) return 'document'
  return null
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const task = await prisma.crmTask.findUnique({
      where: { id },
      include: { workspace: { include: { members: true } } },
    })

    if (!task || task.empresaId !== access.empresaId) {
      return NextResponse.json({ success: false, error: 'Tarea no encontrada' }, { status: 404 })
    }

    if (task.workspaceId) {
      const workspace = await getAccessibleTaskWorkspace(prisma, { workspaceId: task.workspaceId, empresaId: access.empresaId, userId: access.userId })
      if (!workspace || !canUserAccessWorkspace(workspace, access.userId, 'edit')) {
        return NextResponse.json({ success: false, error: 'No tienes permisos para adjuntar archivos en esta tarea.' }, { status: 403 })
      }
    }

    if (task.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: task.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
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
    const attachmentType = resolveAttachmentType(fileType)

    if (!attachmentType) {
      return NextResponse.json({ success: false, error: 'Formato no permitido. Usa imagen, audio, video o documento común.' }, { status: 400 })
    }
    if (Number.isFinite(fileSize) && fileSize > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Archivo demasiado grande (máx 12MB)' }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const ext = path.extname(originalName)
    const safeBaseName = sanitizeBaseName(path.basename(originalName, ext))
    const relDir = path.posix.join('uploads', 'crm-tasks', id)
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
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: originalName,
        url: publicUrl,
        type: attachmentType,
        mimeType: fileType || null,
        sizeBytes: Number.isFinite(fileSize) ? fileSize : null,
        uploadedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error subiendo adjunto de tarea CRM:', error)
    const detail = process.env.NODE_ENV !== 'production'
      ? (error instanceof Error ? error.message : String(error))
      : undefined
    return NextResponse.json({ success: false, error: 'Error subiendo adjunto', detail }, { status: 500 })
  }
}