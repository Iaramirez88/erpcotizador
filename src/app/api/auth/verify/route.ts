import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sha256Hex, timingSafeEqualHex } from '@/lib/auth-tokens'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { email, code } = (body ?? {}) as { email?: unknown; code?: unknown }

    if (typeof email !== 'string' || typeof code !== 'string') {
      return NextResponse.json({ error: 'Email y código son requeridos' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedCode = code.trim()

    if (!/^[0-9]{6}$/.test(normalizedCode)) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
    }

    if (user.emailVerified) {
      return NextResponse.json({ ok: true, verified: true })
    }

    const now = new Date()

    // Limpieza suave de códigos expirados del usuario
    await prisma.emailVerificationCode.deleteMany({
      where: { userId: user.id, expiresAt: { lte: now } },
    })

    const lastCode = await prisma.emailVerificationCode.findFirst({
      where: { userId: user.id, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: { codeHash: true },
    })

    if (!lastCode) {
      return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 400 })
    }

    const inputHash = sha256Hex(normalizedCode)
    const ok = timingSafeEqualHex(inputHash, lastCode.codeHash)

    if (!ok) {
      return NextResponse.json({ error: 'Código inválido o expirado' }, { status: 400 })
    }

    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: now } })
    await prisma.emailVerificationCode.deleteMany({ where: { userId: user.id } })

    return NextResponse.json({ ok: true, verified: true })
  } catch (error: unknown) {
    console.error('Error verificando email:', error)
    return NextResponse.json({ error: 'Error al verificar el código' }, { status: 500 })
  }
}
