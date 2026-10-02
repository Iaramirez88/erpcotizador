import fs from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { canAccessHelpTicket } from '@/lib/help-tickets'

export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
])

function sanitizeBaseName(filename: string) {
  return filename.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'archivo'
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCapabilityAccess({ domain: 'OPERACIONES', subdomain: 'HELP_TICKETS', action: 'CREATE', scope: 'SEDE' })
    if (!access.ok) return access.response

    const { id } = await context.params
    const ticket = await prisma.helpTicket.findUnique({ where: { id } })
    if (!ticket || !canAccessHelpTicket(access, ticket)) return NextResponse.json({ success: false, error: 'Ticket no encontrado.' }, { status: 404 })

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!file || typeof file !== 'object' || typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== 'function') {
      return NextResponse.json({ success: false, error: 'Falta el archivo.' }, { status: 400 })
    }

    const upload = file as File
    if (!ALLOWED_TYPES.has(upload.type)) return NextResponse.json({ success: false, error: 'Formato no permitido.' }, { status: 400 })
    if (upload.size > MAX_BYTES) return NextResponse.json({ success: false, error: 'El archivo supera 8 MB.' }, { status: 400 })

    const extension = path.extname(upload.name)
    const baseName = sanitizeBaseName(path.basename(upload.name, extension))
    const relativeDirectory = path.posix.join('uploads', 'help-tickets', ticket.id)
    const absoluteDirectory = path.join(process.cwd(), 'public', relativeDirectory)
    await fs.mkdir(absoluteDirectory, { recursive: true })

    const filename = `${Date.now()}-${baseName}${extension}`
    await fs.writeFile(path.join(absoluteDirectory, filename), Buffer.from(await upload.arrayBuffer()))

    return NextResponse.json({
      success: true,
      data: {
        name: upload.name,
        url: `/${relativeDirectory}/${filename}`,
        type: upload.type.startsWith('image/') ? 'image' : 'document',
        mimeType: upload.type,
        sizeBytes: upload.size,
      },
    })
  } catch (error) {
    console.error('Error subiendo adjunto de soporte:', error)
    return NextResponse.json({ success: false, error: 'No se pudo subir el archivo.' }, { status: 500 })
  }
}
