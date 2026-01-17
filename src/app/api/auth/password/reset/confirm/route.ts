import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sha256Hex } from '@/lib/auth-tokens'
import { validatePassword } from '@/lib/password-policy'

type PasswordResetTokenDelegate = {
  deleteMany: (args: unknown) => unknown
  findUnique: (args: unknown) => unknown
}

function getPasswordResetTokenDelegate(): PasswordResetTokenDelegate | null {
  const delegate = (prisma as unknown as Record<string, unknown>)[
    'passwordResetToken'
  ] as PasswordResetTokenDelegate | undefined
  if (!delegate) return null
  if (typeof delegate.deleteMany !== 'function') return null
  if (typeof delegate.findUnique !== 'function') return null
  return delegate
}

export async function POST(request: Request) {
  try {
    const passwordResetToken = getPasswordResetTokenDelegate()

    const body: unknown = await request.json()
    const { token, password } = (body ?? {}) as { token?: unknown; password?: unknown }

    if (typeof token !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'Token y contraseña son requeridos' }, { status: 400 })
    }

    const normalizedToken = token.trim()
    if (!/^[0-9a-f]+$/i.test(normalizedToken) || normalizedToken.length < 32) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const now = new Date()
    const tokenHash = sha256Hex(normalizedToken)

    let stored: { userId: string; expiresAt: Date } | null = null

    if (passwordResetToken) {
      // Limpieza suave de tokens expirados
      await passwordResetToken.deleteMany({ where: { expiresAt: { lte: now } } })

      stored = (await passwordResetToken.findUnique({ where: { tokenHash } })) as
        | { userId: string; expiresAt: Date }
        | null
    } else {
      // Fallback robusto cuando el servidor aún corre con un Prisma Client viejo.
      try {
        await prisma.$executeRaw`
          DELETE FROM "password_reset_tokens" WHERE "expiresAt" <= ${now}
        `

        const rows = (await prisma.$queryRaw`
          SELECT "userId", "expiresAt"
          FROM "password_reset_tokens"
          WHERE "tokenHash" = ${tokenHash}
          LIMIT 1
        `) as Array<{ userId: string; expiresAt: Date }>

        stored = rows.length > 0 ? rows[0] : null
      } catch (e: unknown) {
        console.error('Fallback SQL password_reset_tokens (confirm) falló:', e)
        return NextResponse.json(
          {
            error:
              'No se pudo validar el token. Verifica que la migración `20260114180000_auth_verification_reset` esté aplicada y reinicia el servidor.',
          },
          { status: 500 }
        )
      }
    }
    if (!stored || stored.expiresAt <= now) {
      return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.user.update({ where: { id: stored.userId }, data: { password: hashedPassword } })

    if (passwordResetToken) {
      await passwordResetToken.deleteMany({ where: { userId: stored.userId } })
    } else {
      try {
        await prisma.$executeRaw`
          DELETE FROM "password_reset_tokens" WHERE "userId" = ${stored.userId}
        `
      } catch (e: unknown) {
        console.error('Fallback SQL delete password_reset_tokens falló:', e)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('Error confirmando reset:', error)
    return NextResponse.json({ error: 'Error al restablecer la contraseña' }, { status: 500 })
  }
}
