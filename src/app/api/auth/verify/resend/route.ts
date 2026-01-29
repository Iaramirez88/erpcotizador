import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomDigits, sha256Hex } from '@/lib/auth-tokens'
import { sendEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { email } = (body ?? {}) as { email?: unknown }

    if (typeof email !== 'string') {
      return NextResponse.json({ error: 'Email es requerido' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })

    // Respuesta genérica para evitar enumeración
    if (!user) {
      return NextResponse.json({ ok: true, message: 'Si tu cuenta existe, enviaremos un nuevo código.' })
    }

    if (user.emailVerified) {
      return NextResponse.json({ ok: true, message: 'Tu cuenta ya está verificada.' })
    }

    const code = randomDigits(6)
    const codeHash = sha256Hex(code)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    await prisma.emailVerificationCode.deleteMany({ where: { userId: user.id } })
    await prisma.emailVerificationCode.create({
      data: {
        userId: user.id,
        email: normalizedEmail,
        codeHash,
        expiresAt,
      },
    })

    const subject = 'Código de verificación - SGDigital'
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5">
        <h2>Verifica tu cuenta</h2>
        <p>Tu código de verificación es:</p>
        <p style="font-size: 24px; letter-spacing: 4px"><b>${code}</b></p>
        <p>Este código expira en 10 minutos.</p>
      </div>
    `

    const send = await sendEmail({ to: normalizedEmail, subject, html })

    if (!send.ok) {
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({
          ok: true,
          message: 'No se pudo enviar el correo (modo dev). Usa el código dev para continuar.',
          debugCode: code,
          emailError: send.error,
        })
      }

      return NextResponse.json({ error: 'No se pudo enviar el código de verificación. Intenta nuevamente.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'Código reenviado. Revisa tu correo.' })
  } catch (error: unknown) {
    console.error('Error reenviando código:', error)
    return NextResponse.json({ error: 'Error al reenviar el código' }, { status: 500 })
  }
}
