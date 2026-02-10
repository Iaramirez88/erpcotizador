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
import { ensureDefaultSedeForEmpresa } from "@/lib/rbac"

export async function POST(request: Request) {
  try {
    // Obtener datos del body
    const body: unknown = await request.json()
    const { name, email, password, empresaId, accessCode, sedeId } = (body ?? {}) as {
      name?: unknown
      email?: unknown
      password?: unknown
      empresaId?: unknown
      accessCode?: unknown
      sedeId?: unknown
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

    const requestedSedeId = typeof sedeId === 'string' ? sedeId.trim() : ''

    // Resolver empresa (entidad cabeza)
    const resolvedEmpresaId = typeof empresaId === 'string' ? empresaId.trim() : ''

    const empresa = resolvedEmpresaId
      ? await prisma.empresa.findUnique({
          where: { id: resolvedEmpresaId },
          select: { id: true, nombre: true, registrationCodeHash: true },
        })
      : null

    if (resolvedEmpresaId && !empresa?.id) {
      return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 400 })
    }

    if (empresa?.registrationCodeHash) {
      const code = typeof accessCode === 'string' ? accessCode.trim() : ''
      if (!code) {
        return NextResponse.json({ error: 'Código de acceso requerido' }, { status: 400 })
      }

      const okEmpresa = await bcrypt.compare(code, empresa.registrationCodeHash)
      if (!okEmpresa) {
        // Fallback: código de invitación por email (admin).
        const invite = await prisma.registrationInvite.findFirst({
          where: {
            empresaId: empresa.id,
            email: normalizedEmail,
            consumedAt: null,
            expiresAt: { gt: new Date() },
            codeHash: sha256Hex(code),
          },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        })

        if (!invite?.id) {
          return NextResponse.json({ error: 'Código de acceso inválido' }, { status: 403 })
        }

        await prisma.registrationInvite.update({
          where: { id: invite.id },
          data: { consumedAt: new Date() },
        })
      }
    }

    // Verificar si el email ya está registrado
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email ya está registrado" },
        { status: 409 }
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
        role: "USER", // Rol por defecto
        empresaId: empresa?.id ?? null,
      }
    })

    // Si no eligió entidad, creamos su espacio personal (Empresa propia).
    let empresaFinal = empresa
    if (!empresaFinal) {
      const personalNit = `PERS-${user.id}`
      const personalNombre = `Espacio personal (${normalizedEmail})`

      const created = await prisma.empresa.upsert({
        where: { nit: personalNit },
        create: {
          nombre: personalNombre,
          nit: personalNit,
          email: normalizedEmail,
          planTier: 'BASIC',
          billingCycle: 'MONTHLY',
          planValidUntil: null,
        },
        update: {},
        select: { id: true, nombre: true, registrationCodeHash: true },
      })

      await prisma.user.update({ where: { id: user.id }, data: { empresaId: created.id } })
      empresaFinal = created
    }

    // Asegurar sede/membresía inicial (para RBAC por sede)
    await ensureDefaultSedeForEmpresa(empresaFinal.id, user.id)

    // Si llega sedeId (por invitación), asociar también a esa sede (si pertenece a la entidad)
    if (requestedSedeId) {
      const sede = await prisma.sede.findUnique({ where: { id: requestedSedeId }, select: { id: true, empresaId: true } })
      if (sede?.id && sede.empresaId === empresaFinal.id) {
        const existing = await prisma.sedeMembership.findUnique({
          where: { sedeId_userId: { sedeId: sede.id, userId: user.id } },
          select: { id: true },
        })
        if (!existing?.id) {
          await prisma.sedeMembership.create({
            data: { sedeId: sede.id, userId: user.id, role: 'READER' },
          })
        }
      }
    }

    // Generar y guardar código de verificación
    const code = randomDigits(6)
    const codeHash = sha256Hex(code)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 min

    await prisma.emailVerificationCode.create({
      data: {
        userId: user.id,
        email: normalizedEmail,
        codeHash,
        expiresAt,
      },
    })

    // Enviar correo de verificación
    const subject = `Código de verificación - ${empresaFinal.nombre}`
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5">
        <h2>Verifica tu cuenta (${empresaFinal.nombre})</h2>
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
