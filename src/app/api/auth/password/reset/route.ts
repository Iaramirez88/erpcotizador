import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomToken, sha256Hex } from '@/lib/auth-tokens'
import { sendEmail } from '@/lib/email'

type PasswordResetTokenDelegate = {
  deleteMany: (args: unknown) => unknown
  create: (args: unknown) => unknown
}

function getPasswordResetTokenDelegate(): PasswordResetTokenDelegate | null {
  const delegate = (prisma as unknown as Record<string, unknown>)[
    'passwordResetToken'
  ] as PasswordResetTokenDelegate | undefined
  if (!delegate) return null
  if (typeof delegate.deleteMany !== 'function') return null
  if (typeof delegate.create !== 'function') return null
  return delegate
}

export async function POST(request: Request) {
  try {
    const passwordResetToken = getPasswordResetTokenDelegate()

    const body: unknown = await request.json()
    const { email } = (body ?? {}) as { email?: unknown }

    if (typeof email !== 'string') {
      return NextResponse.json({ error: 'Email es requerido' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    // Respuesta genérica para evitar enumeración
    if (!user) {
      return NextResponse.json({ ok: true, message: 'Si tu cuenta existe, enviaremos un correo con instrucciones.' })
    }

    const token = randomToken(32)
    const tokenHash = sha256Hex(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    if (passwordResetToken) {
      await passwordResetToken.deleteMany({ where: { userId: user.id } })
      await passwordResetToken.create({
        data: {
          userId: user.id,
          email: normalizedEmail,
          tokenHash,
          expiresAt,
        },
      })
    } else {
      // Fallback robusto cuando el servidor aún corre con un Prisma Client viejo.
      const id = randomToken(12)
      const createdAt = new Date()

      try {
        await prisma.$executeRaw`
          DELETE FROM "password_reset_tokens" WHERE "userId" = ${user.id}
        `
        await prisma.$executeRaw`
          INSERT INTO "password_reset_tokens" ("id", "userId", "email", "tokenHash", "expiresAt", "createdAt")
          VALUES (${id}, ${user.id}, ${normalizedEmail}, ${tokenHash}, ${expiresAt}, ${createdAt})
        `
      } catch (e: unknown) {
        console.error('Fallback SQL password_reset_tokens falló:', e)
        return NextResponse.json(
          {
            error:
              'No se pudo crear el token de restablecimiento. Verifica que la migración `20260114180000_auth_verification_reset` esté aplicada y reinicia el servidor.',
          },
          { status: 500 }
        )
      }
    }

    const origin = new URL(request.url).origin
    const resetUrl = `${origin}/auth/reset-password?token=${encodeURIComponent(token)}`

    const subject = 'Restablecer contraseña - SGDigital'
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5">
        <h2>Restablecimiento de contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p><a href="${resetUrl}">Haz clic aquí para restablecerla</a></p>
        <p>Si no fuiste tú, puedes ignorar este correo.</p>
        <p>Este enlace expira en 1 hora.</p>
      </div>
    `

    const send = await sendEmail({ to: normalizedEmail, subject, html })

    if (!send.ok) {
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({
          ok: true,
          message: 'No se pudo enviar el correo (modo dev). Usa el link dev para continuar.',
          debugResetUrl: resetUrl,
          emailError: send.error,
        })
      }

      return NextResponse.json({ error: 'No se pudo enviar el correo de restablecimiento. Intenta nuevamente.' }, { status: 500 })
    }

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        ok: true,
        message: 'Si tu cuenta existe, enviaremos un correo con instrucciones.',
        debugResetUrl: resetUrl,
        emailId: send.id,
      })
    }

    return NextResponse.json({ ok: true, message: 'Si tu cuenta existe, enviaremos un correo con instrucciones.' })
  } catch (error: unknown) {
    console.error('Error solicitando reset:', error)
    return NextResponse.json({ error: 'Error al solicitar el restablecimiento' }, { status: 500 })
  }
}
