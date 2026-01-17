import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

async function resolveUserIdFromSession(session: { user?: { id?: string; email?: string | null } }) {
  if (session.user?.id) {
    const userById = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } })
    if (userById?.id) return userById.id
  }
  const email = session.user?.email
  if (!email) return null
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

function approxBytesFromDataUrl(dataUrl: string) {
  // aprox: base64 length * 3/4. suficiente para limitar payloads.
  const idx = dataUrl.indexOf('base64,')
  if (idx === -1) return dataUrl.length
  const base64 = dataUrl.slice(idx + 'base64,'.length)
  return Math.floor((base64.length * 3) / 4)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  if (!isPlainObject(body) || typeof body.image !== 'string') {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const image = body.image.trim()
  if (!image.startsWith('data:image/')) {
    return NextResponse.json({ success: false, error: 'Formato de imagen inválido.' }, { status: 400 })
  }

  const maxBytes = 700 * 1024
  if (approxBytesFromDataUrl(image) > maxBytes) {
    return NextResponse.json({ success: false, error: 'La imagen excede 700KB.' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { image },
    select: { id: true, image: true, updatedAt: true },
  })

  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { image: null },
    select: { id: true, image: true, updatedAt: true },
  })

  return NextResponse.json({ success: true, data: updated })
}
