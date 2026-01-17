/**
 * API Route: Registro de nuevos usuarios
 * POST /api/auth/register
 * 
 * Crea un nuevo usuario en la base de datos
 * Encripta la contraseña antes de guardarla
 */

import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { validatePassword } from "@/lib/password-policy"
import { randomDigits, sha256Hex } from "@/lib/auth-tokens"
import { sendEmail } from "@/lib/email"

type EmailVerificationCodeDelegate = {
  create: (args: unknown) => unknown
}

export async function POST(request: Request) {
  try {
    const emailVerificationCode = (prisma as unknown as { emailVerificationCode?: EmailVerificationCodeDelegate })
      .emailVerificationCode
    if (!emailVerificationCode) {
      return NextResponse.json(
        {
          error:
            'Modelo Prisma EmailVerificationCode no disponible. Ejecuta `npx prisma generate` y reinicia el servidor.',
        },
        { status: 500 }
      )
    }

    // Obtener datos del body
    const body: unknown = await request.json()
    const { name, email, password } = (body ?? {}) as {
      name?: unknown
      email?: unknown
      password?: unknown
    }

    // Validar datos requeridos
    if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string") {
      return NextResponse.json(
        { error: "Todos los campos son requeridos" },
        { status: 400 }
      )
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Verificar si el email ya está registrado
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email ya está registrado" },
        { status: 400 }
      )
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 12)

    // Crear usuario (por defecto queda sin verificar)
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: "USER" // Rol por defecto
      }
    })

    // Generar y guardar código de verificación
    const code = randomDigits(6)
    const codeHash = sha256Hex(code)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    await emailVerificationCode.create({
      data: {
        userId: user.id,
        email: normalizedEmail,
        codeHash,
        expiresAt,
      },
    })

    // Enviar correo de verificación
    const subject = "Código de verificación - SGDigital"
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
        const { password: _passwordDev, ...userWithoutPasswordDev } = user
        void _passwordDev
        return NextResponse.json(
          {
            success: true,
            message: "Usuario creado. No se pudo enviar el código por email (modo dev).",
            user: userWithoutPasswordDev,
            debugCode: code,
            emailError: send.error,
          },
          { status: 201 }
        )
      }

      // En producción: si no se envía el correo, revertimos el registro para evitar cuentas bloqueadas.
      await prisma.user.delete({ where: { id: user.id } })
      return NextResponse.json(
        { error: "No se pudo enviar el código de verificación. Intenta nuevamente." },
        { status: 500 }
      )
    }

    // Retornar usuario sin la contraseña
    const { password: _password, ...userWithoutPassword } = user
    void _password

    return NextResponse.json(
      {
        success: true,
        message: "Usuario creado exitosamente. Revisa tu correo para verificar tu cuenta.",
        user: userWithoutPassword,
      },
      { status: 201 }
    )

  } catch (error: unknown) {
    console.error("Error en registro:", error)
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    )
  }
}
