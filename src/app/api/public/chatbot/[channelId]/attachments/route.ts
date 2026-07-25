import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractHostFromUrl, getPublicChatbotSettings, isChatbotDomainAllowed } from '@/lib/crm-public-chatbot'
import { getReferrerHost, getRequestHost } from '@/lib/crm-public-chatbot-server'

export const runtime = 'nodejs'

const MAX_BYTES = 12 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
])

type RouteContext = {
  params: Promise<{ channelId: string }>
}

function sanitizeBaseName(filename: string) {
  const clean = filename
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return clean || 'archivo'
}

function resolveAttachmentType(fileType: string) {
  if (IMAGE_TYPES.has(fileType)) return 'image' as const
  if (DOCUMENT_TYPES.has(fileType)) return 'document' as const
  return null
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { channelId } = await context.params
    const form = await request.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ success: false, error: 'Body inválido (multipart/form-data requerido).' }, { status: 400 })
    }

    const channel = await prisma.crmChannelConnection.findUnique({
      where: { id: channelId },
      select: { id: true, provider: true, status: true, settingsJson: true },
    })

    if (!channel || channel.provider !== 'WEB_CHATBOT' || !['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ success: false, error: 'Canal chatbot no disponible.' }, { status: 404 })
    }

    const settings = getPublicChatbotSettings(channel.settingsJson)
    if (!settings.publicEmbedEnabled) {
      return NextResponse.json({ success: false, error: 'Embed público deshabilitado.' }, { status: 403 })
    }

    const requestHost = await getRequestHost()
    const referrerHost = await getReferrerHost()
    const rawParentReferrer = String(form.get('parentReferrer') || '')
    const parentHost = referrerHost === requestHost ? extractHostFromUrl(rawParentReferrer) : referrerHost
    if (!isChatbotDomainAllowed({ allowedDomains: settings.allowedDomains, candidateHost: parentHost || requestHost, appHost: requestHost })) {
      return NextResponse.json({ success: false, error: 'Dominio no autorizado para este chatbot.' }, { status: 403 })
    }

    const file = form.get('file')
    const isUpload = !!file && typeof file === 'object' && typeof (file as { arrayBuffer?: unknown }).arrayBuffer === 'function'
    if (!isUpload) {
      return NextResponse.json({ success: false, error: 'Falta archivo (campo: file).' }, { status: 400 })
    }

    const fileType = String((file as { type?: unknown }).type || '')
    const fileSize = Number((file as { size?: unknown }).size || 0)
    const originalName = String((file as { name?: unknown }).name || 'archivo')
    const attachmentType = resolveAttachmentType(fileType)

    if (!attachmentType) {
      return NextResponse.json({ success: false, error: 'Formato no permitido. Usa imagen, PDF, Office, CSV o TXT.' }, { status: 400 })
    }
    if (Number.isFinite(fileSize) && fileSize > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Archivo demasiado grande (máx 12MB).' }, { status: 400 })
    }

    const ext = path.extname(originalName)
    const safeBaseName = sanitizeBaseName(path.basename(originalName, ext))
    const bytes = Buffer.from(await file.arrayBuffer())
    const relDir = path.posix.join('uploads', 'public-chatbot', channel.id)
    const absDir = path.join(process.cwd(), 'public', relDir)
    await fs.mkdir(absDir, { recursive: true })

    const filename = `${Date.now()}-${safeBaseName}${ext}`
    const absPath = path.join(absDir, filename)
    await fs.writeFile(absPath, bytes)

    return NextResponse.json({
      success: true,
      data: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: originalName,
        url: `/${relDir}/${filename}`,
        type: attachmentType,
        mimeType: fileType || null,
        sizeBytes: Number.isFinite(fileSize) ? fileSize : null,
        uploadedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error subiendo adjunto del chatbot público:', error)
    return NextResponse.json({ success: false, error: 'No se pudo subir el archivo.' }, { status: 500 })
  }
}