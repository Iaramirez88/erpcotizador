import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa, requireEmpresaIdForUser } from '@/lib/rbac'
import { randomDigits, sha256Hex } from '@/lib/auth-tokens'
import { sendEmail } from '@/lib/email'
import { escapeHtml, renderEmail, renderEmailCode, renderEmailLink } from '@/lib/email-template'
import { checkPlanLimit } from '@/lib/plan-limits'
import { ensureWorkspaceCodeForEmpresa } from '@/lib/workspace-code'
import { syncEnabledVerticalGrantsForUser } from '@/lib/company-preset-sync'

export const runtime = 'nodejs'

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function getBaseUrl(request: Request): string {
  const envUrl =
    process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL

  if (typeof envUrl === 'string' && envUrl.trim()) return normalizeBaseUrl(envUrl)

  // Fallback: derivar de headers (Caddy/Nginx suelen setear x-forwarded-*)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  if (host) return normalizeBaseUrl(`${proto}://${host}`)

  // Último recurso: origin del request
  try {
    return normalizeBaseUrl(new URL(request.url).origin)
  } catch {
    return ''
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { email?: unknown; sedeId?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const requestedSedeId = typeof body?.sedeId === 'string' ? body.sedeId.trim() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true, nombre: true } })
  if (!empresa) return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })

  const defaultSede = await ensureDefaultSedeForEmpresa(empresa.id, session.user.id)

  const selectedSede = requestedSedeId
    ? await prisma.sede.findUnique({ where: { id: requestedSedeId }, select: { id: true, empresaId: true } })
    : null

  const sedeForInvite = selectedSede?.id && selectedSede.empresaId === empresa.id ? selectedSede : null

  const isSystemAdmin = session.user.role === 'ADMIN'
  const anyAdmin = await prisma.sedeMembership.findFirst({
    where: {
      userId: session.user.id,
      sede: { empresaId: empresa.id },
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { id: true },
  })

  if (!isSystemAdmin && !anyAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, empresaId: true },
  })

  // Si ya existe el usuario, solo informamos por correo.
  if (existingUser?.id) {
    const alreadyMember = await prisma.sedeMembership.findFirst({
      where: { userId: existingUser.id, sede: { empresaId: empresa.id } },
      select: { id: true },
    })

    // Si el usuario aún no pertenece a esta empresa, validar límite antes de moverlo o asignarle sede.
    if (!alreadyMember && existingUser.empresaId !== empresa.id) {
      const limit = await checkPlanLimit(empresa.id, 'USUARIOS_MAX')
      if (!limit.ok) {
        return NextResponse.json(limit, { status: 402 })
      }
    }

    if (existingUser.empresaId && existingUser.empresaId !== empresa.id) {
      // Permitimos mover desde el espacio personal (PERS-<userId>) hacia esta empresa.
      const currentEmpresa = await prisma.empresa.findUnique({
        where: { id: existingUser.empresaId },
        select: { id: true, nit: true },
      })
      const isPersonal = currentEmpresa?.nit === `PERS-${existingUser.id}`
      if (!isPersonal) {
        return NextResponse.json({ error: 'Este email ya pertenece a otra entidad' }, { status: 409 })
      }

      await prisma.user.update({ where: { id: existingUser.id }, data: { empresaId: empresa.id } })
      await ensureDefaultSedeForEmpresa(empresa.id, existingUser.id)
    }

    if (sedeForInvite?.id) {
      await prisma.sedeMembership.upsert({
        where: { sedeId_userId: { sedeId: sedeForInvite.id, userId: existingUser.id } },
        create: { sedeId: sedeForInvite.id, userId: existingUser.id, role: 'READER' },
        update: {},
      })
    }

    await syncEnabledVerticalGrantsForUser({
      empresaId: empresa.id,
      userId: existingUser.id,
      grantedByUserId: session.user.id,
    })

    const subject = `Acceso · ${empresa.nombre} · Ordex`
    const baseUrl = getBaseUrl(request)
    const loginUrl = baseUrl ? new URL('/auth/login', baseUrl).toString() : '/auth/login'

    const html = renderEmail({
      title: `Acceso a ${empresa.nombre}`,
      preheader: `Ya tienes cuenta. Inicia sesión para acceder a ${empresa.nombre}.`,
      intro: 'Este correo ya tiene una cuenta registrada.',
      bodyHtml: `
        <p style="margin:0 0 12px; color:#374151;">Puedes iniciar sesión para acceder a <b>${escapeHtml(empresa.nombre)}</b>.</p>
        <p style="margin:0; color:#374151;">Si el botón no funciona, abre este enlace: ${renderEmailLink(loginUrl)}</p>
      `,
      cta: { label: 'Iniciar sesión', href: loginUrl },
    })

    const send = await sendEmail({ to: email, subject, html })
    if (!send.ok) {
      return NextResponse.json({ error: send.error }, { status: send.status })
    }

    return NextResponse.json({ success: true, message: 'Usuario ya existe. Correo enviado.' })
  }

  // Nuevo usuario (no existe todavía): validar límite de usuarios antes de crear la invitación.
  const limit = await checkPlanLimit(empresa.id, 'USUARIOS_MAX')
  if (!limit.ok) {
    return NextResponse.json(limit, { status: 402 })
  }

  // Crear invitación con código de 6 dígitos
  const code = randomDigits(6)
  const codeHash = sha256Hex(code)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.registrationInvite.create({
    data: {
      empresaId: empresa.id,
      email,
      codeHash,
      expiresAt,
    },
  })

  const subject = `Invitación · ${empresa.nombre} · Ordex`
  const baseUrl = getBaseUrl(request)
  const workspaceCode = await ensureWorkspaceCodeForEmpresa(empresa.id)
  const registerUrlObj = baseUrl ? new URL('/rop/unirse', baseUrl) : new URL('http://localhost/rop/unirse')
  registerUrlObj.searchParams.set('empresaId', workspaceCode)
  if (sedeForInvite?.id) {
    registerUrlObj.searchParams.set('sedeId', sedeForInvite.id)
  }
  registerUrlObj.searchParams.set('email', email)
  const registerUrl = baseUrl
    ? registerUrlObj.toString()
    : `/rop/unirse?empresaId=${encodeURIComponent(workspaceCode)}&email=${encodeURIComponent(email)}`

  const html = renderEmail({
    title: `Invitación a ${empresa.nombre}`,
    preheader: `Tu código de acceso es ${code}.`,
    intro: 'Usa este código para crear tu cuenta:',
    bodyHtml: `
      ${renderEmailCode(code, { size: 'lg' })}
      <p style="margin:0 0 12px; color:#374151;">Abre el portal de acceso y pega este código en el campo <b>“Código de acceso”</b>.</p>
      <p style="margin:0 0 12px; color:#374151;">Registro: ${renderEmailLink(registerUrl, 'Abrir registro')}</p>
      <p style="margin:0; color:#6B7280; font-size:12px;">Este código expira en 7 días.</p>
    `,
    cta: { label: 'Abrir portal de acceso', href: registerUrl },
  })

  const send = await sendEmail({ to: email, subject, html })
  if (!send.ok) {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        {
          success: true,
          message: 'Invitación creada. No se pudo enviar el correo (modo dev).',
          debugCode: code,
          emailError: send.error,
        },
        { status: 201 }
      )
    }

    return NextResponse.json({ error: send.error }, { status: send.status })
  }

  return NextResponse.json({ success: true, message: 'Invitación enviada.' }, { status: 201 })
}
