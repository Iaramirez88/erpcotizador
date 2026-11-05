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
import { provisionDefaultAdminAccessForNewUser, syncEnabledVerticalGrantsForUser } from "@/lib/company-preset-sync"
import { buildPersonalNit, normalizeAccountEmail, resolvePersonalTrialFields } from "@/lib/trial-policy"

function normalizeWorkspaceCode(code: string): string | null {
  const normalized = code.trim().toUpperCase()
  if (!/^WS-[A-Z0-9]+$/i.test(normalized)) return null
  return normalized
}

/**
 * Crea el espacio personal del usuario recién registrado.
 *
 * El NIT se deriva del `userId` (`PERS-<userId>`) para que todo el sistema reconozca el
 * espacio personal igual que en `requireEmpresaIdForUser()`, y el trial solo se otorga la
 * primera vez por persona (`resolvePersonalTrialFields`).
 */
async function createPersonalEmpresaForUser(
  tx: Prisma.TransactionClient,
  args: { userId: string; nombre: string; email: string }
) {
  const trial = await resolvePersonalTrialFields({ userId: args.userId, email: args.email })

  return tx.empresa.create({
    data: {
      nombre: args.nombre.trim() || 'Cuenta personal',
      nit: buildPersonalNit(args.userId),
      email: args.email,
      workspaceCode: generateWorkspaceCode(),
      registrationCodeHash: null,
      planOwnerUserId: args.userId,
      planTier: 'BASIC',
      billingCycle: 'MONTHLY',
      planValidUntil: null,
      onboardingStatus: 'PENDING',
      onboardingData: {},
      dashboardConfig: {},
      ...trial,
    },
    select: { id: true, nombre: true, registrationCodeHash: true },
  })
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

    const normalizedEmail = normalizeAccountEmail(email)

    // Verificar si el email ya está registrado. Un mismo correo es siempre la misma
    // persona: se reutiliza la cuenta (y su historial) en lugar de crear una nueva.
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, emailVerified: true },
    })

    if (existingUser) {
      return NextResponse.json(
        {
          error: existingUser.emailVerified
            ? "Este correo ya tiene una cuenta. Inicia sesión con ese correo para recuperar tu historial (si olvidaste la contraseña, usa “Olvidé mi contraseña”)."
            : "Este correo ya tiene una cuenta creada y pendiente de verificación. Ve a “Verificar cuenta” para activarla y conservar tu historial.",
          code: 'EMAIL_ALREADY_REGISTERED',
          canResendVerification: !existingUser.emailVerified,
        },
        { status: 409 }
      )
    }

    const requestedSedeId = typeof sedeId === 'string' ? sedeId.trim() : ''

    // Resolver empresa (entidad cabeza). Si no llega empresaId, creamos una cuenta personal.
    const rawEmpresaId = typeof empresaId === 'string' ? empresaId.trim() : ''

    const derivedAccessCode = typeof accessCode === 'string' ? accessCode.trim() : ''
    const workspaceCode = rawEmpresaId ? normalizeWorkspaceCode(rawEmpresaId) : null

    const resolvedEmpresaId = workspaceCode ? '' : rawEmpresaId

    // Solo se resuelve la empresa destino. Si no llega, el espacio personal se crea después
    // del usuario para que su NIT sea `PERS-<userId>` (misma convención en todo el sistema).
    const empresa = workspaceCode
      ? await prisma.empresa.findUnique({
          where: { workspaceCode },
          select: { id: true, nombre: true, registrationCodeHash: true },
        })
      : resolvedEmpresaId
      ? await prisma.empresa.findUnique({
          where: { id: resolvedEmpresaId },
          select: { id: true, nombre: true, registrationCodeHash: true },
        })
      : null

    if ((workspaceCode || resolvedEmpresaId) && !empresa?.id) {
      return NextResponse.json({ error: 'Entidad no encontrada' }, { status: 400 })
    }

    if (empresa?.id) {
      const userLimit = await checkPlanLimit(empresa.id, 'USUARIOS_MAX')
      if (!userLimit.ok) {
        return NextResponse.json(userLimit, { status: 402 })
      }
    }

    if (resolvedEmpresaId && !workspaceCode && empresa?.registrationCodeHash) {
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

    // Crear usuario + espacio (empresa destino o personal) en una sola transacción: si algo
    // falla no quedan empresas huérfanas ni trials fantasma.
    const { user, empresaFinal, personalEmpresaCreated } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          password: hashedPassword,
          role: isSuperAdminEmail(normalizedEmail) ? "ADMIN" : "USER",
          empresaId: empresa?.id ?? null,
        },
      })

      const targetEmpresa = empresa?.id
        ? empresa
        : await createPersonalEmpresaForUser(tx, {
            userId: createdUser.id,
            nombre: name,
            email: normalizedEmail,
          })

      if (createdUser.empresaId !== targetEmpresa.id) {
        await tx.user.update({
          where: { id: createdUser.id },
          data: { empresaId: targetEmpresa.id },
          select: { id: true },
        })
      }

      // Si la empresa aún no tiene owner de planes, asignar al primer usuario que se registra.
      await tx.empresa.updateMany({
        where: { id: targetEmpresa.id, planOwnerUserId: null },
        data: { planOwnerUserId: createdUser.id },
      })

      return {
        user: { ...createdUser, empresaId: targetEmpresa.id },
        empresaFinal: targetEmpresa,
        personalEmpresaCreated: !empresa?.id,
      }
    })

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
            data: { sedeId: sede.id, userId: user.id, role: 'ADMIN' },
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

    await provisionDefaultAdminAccessForNewUser({
      empresaId: empresaFinal.id,
      userId: user.id,
      grantedByUserId: user.id,
    })

    await syncEnabledVerticalGrantsForUser({
      empresaId: empresaFinal.id,
      userId: user.id,
      grantedByUserId: user.id,
    })

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
          actionUrl: '/dashboard/perfil',
          actionLabel: 'Completar perfil',
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

      // En producción: si no se envía el correo, revertimos el registro para evitar cuentas
      // bloqueadas y tampoco dejamos la empresa personal (ni su trial) como residuo.
      await prisma.user.delete({ where: { id: user.id } })
      if (personalEmpresaCreated) {
        await prisma.empresa.delete({ where: { id: empresaFinal.id } }).catch(() => null)
      }
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
