import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import path from 'path'
import fs from 'fs/promises'

export const runtime = 'nodejs'

const MAX_BYTES = 256 * 1024 // 256KB

function getExtFromMime(mime: string): string {
  const m = (mime || '').toLowerCase()
  if (m === 'image/jpeg' || m === 'image/jpg') return '.jpg'
  if (m === 'image/png') return '.png'
  return ''
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params

    const material = await prisma.material.findUnique({ where: { id }, select: { id: true } })
    if (!material) {
      return NextResponse.json({ success: false, error: 'Material no encontrado' }, { status: 404 })
    }

    const form = await request.formData().catch(() => null)
    if (!form) {
      return NextResponse.json({ success: false, error: 'Body inválido (multipart/form-data requerido)' }, { status: 400 })
    }

    const file = form.get('file')
    const isUpload =
      !!file &&
      typeof file === 'object' &&
      typeof (file as { arrayBuffer?: unknown }).arrayBuffer === 'function'

    if (!isUpload) {
      return NextResponse.json({ success: false, error: 'Falta archivo (campo: file)' }, { status: 400 })
    }

    const fileType = String((file as { type?: unknown }).type || '')
    const fileSize = Number((file as { size?: unknown }).size || 0)

    if (fileType !== 'image/jpeg' && fileType !== 'image/jpg' && fileType !== 'image/png') {
      return NextResponse.json({ success: false, error: 'Formato no permitido. Usa JPG o PNG.' }, { status: 400 })
    }

    if (Number.isFinite(fileSize) && fileSize > MAX_BYTES) {
      return NextResponse.json({ success: false, error: 'Imagen demasiado grande (máx 256KB)' }, { status: 400 })
    }

    const safeExt = getExtFromMime(fileType)

    const bytes = Buffer.from(await file.arrayBuffer())

    const relDir = path.posix.join('uploads', 'materiales', id)
    const absDir = path.join(process.cwd(), 'public', relDir)
    await fs.mkdir(absDir, { recursive: true })

    const filename = `${Date.now()}${safeExt}`
    const absPath = path.join(absDir, filename)
    await fs.writeFile(absPath, bytes)

    // Verificación defensiva: evita guardar una URL si el archivo no quedó en disco
    await fs.stat(absPath)

    const publicUrl = `/${relDir}/${filename}`

    // Nota: si el servidor dev está cacheando un Prisma Client viejo, `material.update({ imagenUrl })`
    // puede fallar con "Unknown argument imagenUrl". Este SQL evita ese bloqueo y funciona con la columna.
    await prisma.$executeRaw`
      UPDATE "materiales"
      SET "imagenUrl" = ${publicUrl}
      WHERE "id" = ${id}
    `

    return NextResponse.json({ success: true, data: { imagenUrl: publicUrl } }, { status: 200 })
  } catch (error) {
    console.error('Error al subir imagen de material:', error)
    const detail =
      process.env.NODE_ENV !== 'production'
        ? (error instanceof Error ? error.message : String(error))
        : undefined
    return NextResponse.json({ success: false, error: 'Error al subir imagen', detail }, { status: 500 })
  }
}
