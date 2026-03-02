import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomDigits, sha256Hex } from '@/lib/auth-tokens'
import { sendEmail } from '@/lib/email'
import { renderEmail, renderEmailCode } from '@/lib/email-template'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { email } = (body ?? {}) as { email?: unknown }

    if (typeof email !== 'string') {
      return NextResponse.json({ error: 'Email es requerido' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, emailVerified: true, empresa: { select: { nombre: true } } },
    })

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

    const empresaNombre = (user.empresa?.nombre ?? '').trim()
    const subject = empresaNombre
      ? `Código de verificación · ${empresaNombre} · Ordex`
      : 'Código de verificación · Ordex'

    const html = renderEmail({
      title: 'Verifica tu cuenta',
      preheader: `Tu código de verificación es ${code}.`,
      intro: 'Aquí tienes un nuevo código de verificación:',
      bodyHtml: `
        ${renderEmailCode(code, { size: 'lg' })}
        <p style="margin:0; color:#6B7280; font-size:12px;">Este código expira en 10 minutos.</p>
      `,
    })

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
