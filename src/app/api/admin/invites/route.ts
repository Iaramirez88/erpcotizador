import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa, getOrCreateDefaultEmpresa } from '@/lib/rbac'
import { randomDigits, sha256Hex } from '@/lib/auth-tokens'
import { sendEmail } from '@/lib/email'

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

  const empresa = await getOrCreateDefaultEmpresa()
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
    if (existingUser.empresaId && existingUser.empresaId !== empresa.id) {
      return NextResponse.json({ error: 'Este email ya pertenece a otra entidad' }, { status: 409 })
    }

    if (sedeForInvite?.id) {
      await prisma.sedeMembership.upsert({
        where: { sedeId_userId: { sedeId: sedeForInvite.id, userId: existingUser.id } },
        create: { sedeId: sedeForInvite.id, userId: existingUser.id, role: 'READER' },
        update: {},
      })
    }

    const subject = `Acceso a ${empresa.nombre}`
    const baseUrl = getBaseUrl(request)
    const loginUrl = baseUrl ? new URL('/auth/login', baseUrl).toString() : '/auth/login'
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5">
        <h2>Acceso a ${empresa.nombre}</h2>
        <p>Este correo ya tiene una cuenta registrada.</p>
        <p>Puedes iniciar sesión aquí:</p>
        <p><a href="${loginUrl}">Iniciar sesión</a></p>
      </div>
    `

    const send = await sendEmail({ to: email, subject, html })
    if (!send.ok) {
      return NextResponse.json({ error: send.error }, { status: send.status })
    }

    return NextResponse.json({ success: true, message: 'Usuario ya existe. Correo enviado.' })
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

  const subject = `Código de acceso - ${empresa.nombre}`
  const baseUrl = getBaseUrl(request)
  const registerUrlObj = baseUrl ? new URL('/auth/register', baseUrl) : new URL('http://localhost/auth/register')
  registerUrlObj.searchParams.set('empresaId', empresa.id)
  if (sedeForInvite?.id) {
    registerUrlObj.searchParams.set('sedeId', sedeForInvite.id)
  }
  registerUrlObj.searchParams.set('email', email)
  const registerUrl = baseUrl
    ? registerUrlObj.toString()
    : `/auth/register?empresaId=${encodeURIComponent(empresa.id)}&email=${encodeURIComponent(email)}`
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5">
      <h2>Invitación a ${empresa.nombre}</h2>
      <p>Usa este código para crear tu cuenta:</p>
      <p style="font-size: 24px; letter-spacing: 4px"><b>${code}</b></p>
      <p>Este código expira en 7 días.</p>
      <p>Registro: <a href="${registerUrl}">${registerUrl}</a></p>
    </div>
  `

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
