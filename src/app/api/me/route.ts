import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveSedeForUser, getEffectiveAccessMap, NAV_MODULES } from '@/lib/rbac'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { isPlanOwnerForEmpresa } from '@/lib/plan-owner'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import { randomDigits, sha256Hex } from '@/lib/auth-tokens'
import { sendEmail } from '@/lib/email'
import { renderEmail, renderEmailCode } from '@/lib/email-template'
import { EXTERNAL_DASHBOARD_SCOPE_COOKIE, isModuleAllowedForExternalDashboardScope } from '@/lib/external-dashboard-scope'

export const runtime = 'nodejs'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const cookieStore = await cookies()
  const externalDashboardScope = cookieStore.get(EXTERNAL_DASHBOARD_SCOPE_COOKIE)?.value ?? null

  const [user, websiteServicesAccess] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        empresaId: true,
        telefono: true,
        cargo: true,
        sedeDefaultId: true,
        sedeDefault: { select: { id: true, nombre: true, codigo: true } },
        createdAt: true,
        updatedAt: true,
      },
    }),
    getWebsiteServicesAccessForUser(userId),
  ])

  // Para UI: incluir acceso efectivo (por sede) a CONFIG
  let configAccess: AccessLevel = 'NONE'
  let ordersAccess: AccessLevel = 'NONE'
  let materialsAccess: AccessLevel = 'NONE'
  let accessMap: Partial<Record<ModuleKey, AccessLevel>> = {}
  let canManageCustomProductRequests = false
  try {
    const sede = await getActiveSedeForUser(userId)
    const [nextAccessMap, membership] = await Promise.all([
      getEffectiveAccessMap({ userId, sedeId: sede.id, modules: NAV_MODULES }),
      prisma.sedeMembership.findUnique({
        where: { sedeId_userId: { sedeId: sede.id, userId } },
        select: { role: true },
      }),
    ])
    accessMap = nextAccessMap
    configAccess = nextAccessMap.CONFIG ?? 'NONE'
    ordersAccess = nextAccessMap.ORDENES ?? 'NONE'
    materialsAccess = nextAccessMap.MATERIALES ?? 'NONE'
    canManageCustomProductRequests = membership?.role === 'ADMIN' || membership?.role === 'MANAGER'
  } catch {
    // si algo falla (sede no resuelta, etc), dejamos NONE
  }

  const order: Record<AccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2, ADMIN: 3 }
  const externalScopedAccessMap = externalDashboardScope
    ? Object.fromEntries(
        Object.entries(accessMap).filter(([moduleKey]) => isModuleAllowedForExternalDashboardScope({ moduleKey, scope: externalDashboardScope }))
      ) as Partial<Record<ModuleKey, AccessLevel>>
    : accessMap
  const canConfigWrite = !externalDashboardScope && order[configAccess] >= order.WRITE
  const canDeleteOrders = !externalDashboardScope && order[ordersAccess] >= order.ADMIN

  const empresaId = user?.empresaId ?? null
  const isSystemSuperAdmin = isSuperAdminEmail(user?.email)
  const isPlanOwner = Boolean(empresaId && user?.id ? await isPlanOwnerForEmpresa({ empresaId, userId: user.id }) : false)
  const canManageBilling = !externalDashboardScope && (isSystemSuperAdmin || isPlanOwner)

  return NextResponse.json({
    success: true,
    data: user
      ? {
          ...user,
          access: externalScopedAccessMap,
          canConfigWrite,
          canDeleteOrders,
          canManageCustomProductRequests: !externalDashboardScope && canManageCustomProductRequests,
          empresaId,
          isPlanOwner: !externalDashboardScope && isPlanOwner,
          canManageBilling,
          canAccessWebsiteServices: !externalDashboardScope && websiteServicesAccess.canAccess,
          canManageWebsiteServicesAssignments: !externalDashboardScope && websiteServicesAccess.canManageAssignments,
        }
      : null,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      empresaId: true,
      empresa: { select: { nombre: true } },
      sedeDefaultId: true,
      globalAccess: { select: { level: true } },
    },
  })
  if (!currentUser?.id) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : undefined
  if (name !== undefined && name.length > 80) {
    return NextResponse.json({ success: false, error: 'Nombre demasiado largo.' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined
  if (email !== undefined) {
    if (!email) {
      return NextResponse.json({ success: false, error: 'El correo no puede quedar vacío.' }, { status: 400 })
    }
    if (email.length > 190 || !isValidEmail(email)) {
      return NextResponse.json({ success: false, error: 'Correo inválido.' }, { status: 400 })
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: userId },
      },
      select: { id: true },
    })
    if (existingUser?.id) {
      return NextResponse.json({ success: false, error: 'Ese correo ya está en uso por otro usuario.' }, { status: 400 })
    }
  }

  const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : undefined
  if (telefono !== undefined && telefono.length > 40) {
    return NextResponse.json({ success: false, error: 'Teléfono demasiado largo.' }, { status: 400 })
  }

  const cargo = typeof body.cargo === 'string' ? body.cargo.trim() : undefined
  if (cargo !== undefined && cargo.length > 80) {
    return NextResponse.json({ success: false, error: 'Cargo demasiado largo.' }, { status: 400 })
  }

  const sedeDefaultIdRaw = typeof body.sedeDefaultId === 'string' ? body.sedeDefaultId.trim() : undefined
  const sedeDefaultId = sedeDefaultIdRaw === undefined ? undefined : (sedeDefaultIdRaw || null)

  let selectedSedeBelongsToEmpresa = false

  if (sedeDefaultId !== undefined && sedeDefaultId !== null) {
    const sede = await prisma.sede.findUnique({
      where: { id: sedeDefaultId },
      select: { id: true, empresaId: true },
    })
    if (!sede?.id || sede.empresaId !== currentUser.empresaId) {
      return NextResponse.json({ success: false, error: 'La sede seleccionada no es válida para tu empresa.' }, { status: 400 })
    }
    selectedSedeBelongsToEmpresa = true

    const membership = await prisma.sedeMembership.findUnique({
      where: { sedeId_userId: { sedeId: sedeDefaultId, userId } },
      select: { id: true },
    })
    const isCurrentBrokenDefault = currentUser.sedeDefaultId === sedeDefaultId
    if (!membership?.id && !isCurrentBrokenDefault) {
      return NextResponse.json({ success: false, error: 'La sede seleccionada no está asignada a tu usuario.' }, { status: 400 })
    }
  }

  const emailChanged = typeof email === 'string' && email !== currentUser.email
  const verificationCode = emailChanged ? randomDigits(6) : null
  const verificationCodeHash = verificationCode ? sha256Hex(verificationCode) : null
  const verificationExpiresAt = verificationCode ? new Date(Date.now() + 10 * 60 * 1000) : null

  const updated = await prisma.$transaction(async (tx) => {
    if (selectedSedeBelongsToEmpresa && sedeDefaultId && currentUser.sedeDefaultId === sedeDefaultId) {
      await tx.sedeMembership.upsert({
        where: { sedeId_userId: { sedeId: sedeDefaultId, userId } },
        create: { sedeId: sedeDefaultId, userId, role: currentUser.globalAccess?.level === 'ADMIN' ? 'ADMIN' : currentUser.globalAccess?.level === 'WRITE' ? 'MEMBER' : 'READER' },
        update: {},
      })
    }

    if (emailChanged) {
      await tx.emailVerificationCode.deleteMany({ where: { userId } })
      await tx.emailVerificationCode.create({
        data: {
          userId,
          email: email!,
          codeHash: verificationCodeHash!,
          expiresAt: verificationExpiresAt!,
        },
      })
    }

    return tx.user.update({
      where: { id: userId },
      data: {
        name: name === '' ? null : name,
        email: email === undefined ? undefined : email,
        emailVerified: emailChanged ? null : undefined,
        telefono: telefono === undefined ? undefined : (telefono === '' ? null : telefono),
        cargo: cargo === undefined ? undefined : (cargo === '' ? null : cargo),
        sedeDefaultId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        telefono: true,
        cargo: true,
        sedeDefaultId: true,
        sedeDefault: { select: { id: true, nombre: true, codigo: true } },
        updatedAt: true,
      },
    })
  })

  let message = 'Cambios guardados.'
  let emailDeliveryWarning: string | null = null

  if (emailChanged && verificationCode) {
    const empresaNombre = (currentUser.empresa?.nombre ?? '').trim()
    const subject = empresaNombre
      ? `Código de verificación · ${empresaNombre} · Ordex`
      : 'Código de verificación · Ordex'

    const html = renderEmail({
      title: 'Verifica tu nuevo correo',
      preheader: `Tu código de verificación es ${verificationCode}.`,
      intro: 'Actualizaste tu correo de acceso. Usa este código para verificar la nueva dirección:',
      bodyHtml: `
        ${renderEmailCode(verificationCode, { size: 'lg' })}
        <p style="margin:0; color:#6B7280; font-size:12px;">Este código expira en 10 minutos.</p>
      `,
    })

    const send = await sendEmail({ to: email, subject, html })
    if (!send.ok) {
      emailDeliveryWarning = process.env.NODE_ENV !== 'production'
        ? `No se pudo enviar el correo en modo dev. Usa el flujo de reenvío si lo necesitas.`
        : 'No se pudo enviar el código de verificación de inmediato. Usa reenvío de verificación desde el login si hace falta.'
      message = 'Perfil guardado, pero tu nuevo correo quedó pendiente de verificación.'
    } else {
      message = 'Perfil guardado. Verifica tu nuevo correo con el código enviado.'
    }
  }

  return NextResponse.json({ success: true, data: updated, message, emailVerificationRequired: emailChanged, emailDeliveryWarning })
}
