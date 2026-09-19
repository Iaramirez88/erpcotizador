import fs from 'fs/promises'
import path from 'path'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const MAX_BYTES = 2 * 1024 * 1024
const extensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const { id } = await context.params
  const offering = await prisma.payrollBenefitOffering.findFirst({
    where: { id, empresaId: access.empresaId },
    select: { id: true, metadata: true },
  })
  if (!offering) return NextResponse.json({ ok: false, error: 'Oferta de beneficio no encontrada' }, { status: 404 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Selecciona una imagen válida.' }, { status: 400 })
  }

  const extension = extensions[file.type]
  if (!extension) {
    return NextResponse.json({ ok: false, error: 'Formato no permitido. Usa JPG, PNG o WebP.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'La imagen supera el máximo de 2 MB.' }, { status: 400 })
  }

  const relativeDirectory = path.posix.join('uploads', 'nomina', 'beneficios', id)
  const absoluteDirectory = path.join(process.cwd(), 'public', relativeDirectory)
  await fs.mkdir(absoluteDirectory, { recursive: true })

  const filename = `${Date.now()}${extension}`
  await fs.writeFile(path.join(absoluteDirectory, filename), Buffer.from(await file.arrayBuffer()))
  const imageUrl = `/${relativeDirectory}/${filename}`
  const metadata = offering.metadata && typeof offering.metadata === 'object' && !Array.isArray(offering.metadata)
    ? offering.metadata as Record<string, unknown>
    : {}

  await prisma.payrollBenefitOffering.update({
    where: { id },
    data: { metadata: { ...metadata, imageUrl } },
  })

  return NextResponse.json({ ok: true, data: { imageUrl } })
}