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
import { isSuperAdminEmail } from "@/lib/super-admin"
import { generateWorkspaceCode } from "@/lib/workspace-code"
import { checkPlanLimit } from "@/lib/plan-limits"
import { renderEmail, renderEmailCode } from "@/lib/email-template"
import { Prisma } from "@prisma/client"

function parseEmpresaIdFromEmpCode(code: string): string | null {
  const raw = code.trim()
  if (!raw) return null
  const up = raw.toUpperCase()
  if (!up.startsWith('EMP-')) return null
  const parts = raw.split('-')
  const empresaId = (parts[1] ?? '').trim()
  return empresaId || null
}

async function createPersonalEmpresa(args: { nombre: string; email: string }) {
  // Empresa personal habilita paywall/trial (nit inicia con PERS-)
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const nit = `PERS-${randomDigits(10)}`
      const created = await prisma.empresa.create({
        data: {
          nombre: args.nombre.trim() || 'Cuenta personal',
          nit,
          email: args.email,
          workspaceCode: generateWorkspaceCode(),
          registrationCodeHash: null,
        },
        select: { id: true, nombre: true, registrationCodeHash: true },
      })
      return created
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue
      }
      throw error
    }
  }

  throw new Error('PERSONAL_EMPRESA_CREATE_FAILED')
}

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

    const requestedSedeId = typeof sedeId === 'string' ? sedeId.trim() : ''

    // Resolver empresa (entidad cabeza). Si no llega empresaId, creamos una cuenta personal.
    const rawEmpresaId = typeof empresaId === 'string' ? empresaId.trim() : ''

    // Compat: si llega el código EMP-... en el campo empresaId, derivamos el ID y usamos el mismo string como código.
    let derivedAccessCode = typeof accessCode === 'string' ? accessCode.trim() : ''
    const parsedFromEmp = rawEmpresaId ? parseEmpresaIdFromEmpCode(rawEmpresaId) : null

    const resolvedEmpresaId = parsedFromEmp ?? rawEmpresaId
    if (parsedFromEmp && !derivedAccessCode) {
      derivedAccessCode = rawEmpresaId
    }

    const empresa = resolvedEmpresaId
      ? await prisma.empresa.findUnique({
          where: { id: resolvedEmpresaId },
          select: { id: true, nombre: true, registrationCodeHash: true },
        })
      : await createPersonalEmpresa({ nombre: name, email: normalizedEmail })

    if (!empresa?.id) {
      return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 400 })
    }

    const userLimit = await checkPlanLimit(empresa.id, 'USUARIOS_MAX')
    if (!userLimit.ok) {
      return NextResponse.json(userLimit, { status: 402 })
    }

    if (resolvedEmpresaId && empresa?.registrationCodeHash) {
      const code = derivedAccessCode
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

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 12)

    // Crear usuario (por defecto queda sin verificar)
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: isSuperAdminEmail(normalizedEmail) ? "ADMIN" : "USER",
        empresaId: empresa.id,
      }
    })

    // Si la empresa aún no tiene owner de planes, asignar al primer usuario que se registra.
    await prisma.empresa.updateMany({
      where: { id: empresa.id, planOwnerUserId: null },
      data: { planOwnerUserId: user.id },
    })

    const empresaFinal = empresa

    // Asegurar sede/membresía inicial (para RBAC por sede)
    const defaultSede = await ensureDefaultSedeForEmpresa(empresaFinal.id, user.id)

    // Si llega sedeId (por invitación), asociar también a esa sede (si pertenece a la entidad)
    let preferredSedeId: string | null = defaultSede?.id ?? null
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

        preferredSedeId = sede.id
      }
    }

    // Guardar sede por defecto en el perfil (para PDFs y cotización)
    if (preferredSedeId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { sedeDefaultId: preferredSedeId },
        select: { id: true },
      })
    }

    // Notificar al usuario si le faltan datos clave para cotizar.
    if (!user.telefono || !user.cargo || !preferredSedeId) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'WARNING',
          title: 'Completa tu perfil para empezar a cotizar',
          body: 'Te recomendamos completar Teléfono, Cargo y Sede por defecto en “Mi perfil” para que tus cotizaciones salgan completas.',
          sedeId: preferredSedeId,
          empresaId: empresaFinal.id,
        },
      })
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
    const subject = `Código de verificación · ${empresaFinal.nombre} · Ordex`

    const html = renderEmail({
      title: `Verifica tu cuenta (${empresaFinal.nombre})`,
      preheader: `Tu código de verificación es ${code}.`,
      intro: `Tu cuenta en ${empresaFinal.nombre} está casi lista.`,
      bodyHtml: `
        <p style="margin:0 0 12px; color:#374151;">Tu código de verificación es:</p>
        ${renderEmailCode(code, { size: 'lg' })}
        <p style="margin:0; color:#6B7280; font-size:12px;">Este código expira en 10 minutos.</p>
      `,
      footerNote: `Si no creaste esta cuenta, ignora este correo.`,
    })

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
