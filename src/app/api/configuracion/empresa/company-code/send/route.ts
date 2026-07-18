import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { sendEmail } from '@/lib/email'
import { escapeHtml, renderEmail, renderEmailCode, renderEmailLink } from '@/lib/email-template'
import { ensureWorkspaceCodeForEmpresa } from '@/lib/workspace-code'

export const runtime = 'nodejs'

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function getBaseUrl(request: Request): string {
  const envUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL
  if (typeof envUrl === 'string' && envUrl.trim()) return normalizeBaseUrl(envUrl)

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  if (host) return normalizeBaseUrl(`${proto}://${host}`)

  try {
    return normalizeBaseUrl(new URL(request.url).origin)
  } catch {
    return ''
  }
}

type Body = {
  email?: unknown
}

export async function POST(request: Request) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Body | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Email inválido' }, { status: 400 })
  }

  const sede = await prisma.sede.findUnique({ where: { id: access.sedeId }, select: { empresaId: true } })
  const empresaId = sede?.empresaId
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true, nombre: true } })
  if (!empresa?.id) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const codePlain = await ensureWorkspaceCodeForEmpresa(empresaId)

  const baseUrl = getBaseUrl(request)
  const registerUrlObj = baseUrl ? new URL('/auth/register', baseUrl) : null
  if (registerUrlObj) {
    registerUrlObj.searchParams.set('empresaId', codePlain)
    registerUrlObj.searchParams.set('email', email)
  }

  const registerUrl = registerUrlObj
    ? registerUrlObj.toString()
    : `/auth/register?empresaId=${encodeURIComponent(codePlain)}&email=${encodeURIComponent(email)}`

  const subject = `Código de espacio · ${empresa.nombre} · Ordex`

  const html = renderEmail({
    title: `Acceso a ${empresa.nombre}`,
    preheader: 'Código de espacio para registrarte o unirte al espacio de trabajo.',
    intro: `Usa este código WS para registrarte o unirte a ${empresa.nombre}:`,
    bodyHtml: `
      ${renderEmailCode(codePlain, { size: 'md' })}
      <p style="margin:0 0 12px; color:#374151;">Registro: ${renderEmailLink(registerUrl, 'Abrir registro')}</p>
      <p style="margin:0; color:#6B7280; font-size:12px;">Importante: este es el código único del espacio para compartir acceso.</p>
    `,
    cta: { label: 'Crear cuenta', href: registerUrl },
    footerNote: `Espacio: ${escapeHtml(empresa.nombre)}`,
  })

  const send = await sendEmail({ to: email, subject, html })
  if (!send.ok) {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { ok: true, message: 'No se pudo enviar el correo (modo dev).', debugCode: codePlain, emailError: send.error },
        { status: 201 }
      )
    }
    return NextResponse.json({ ok: false, error: send.error }, { status: send.status })
  }

  return NextResponse.json({ ok: true })
}
