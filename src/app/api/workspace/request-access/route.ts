import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { escapeHtml, renderEmail, renderEmailCode } from '@/lib/email-template'

export const runtime = 'nodejs'

type Body = {
  empresaId?: unknown
  workspaceCode?: unknown
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as Body
  const empresaIdFromBody = typeof body.empresaId === 'string' ? body.empresaId.trim() : ''
  const workspaceCode = typeof body.workspaceCode === 'string' ? body.workspaceCode.trim().toUpperCase() : ''
  if (!empresaIdFromBody && !workspaceCode) {
    return NextResponse.json({ ok: false, error: 'Código o ID de espacio de trabajo requerido' }, { status: 400 })
  }

  const requester = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true },
  })

  if (!requester?.id) return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 404 })

  const empresa = workspaceCode
    ? await prisma.empresa.findUnique({ where: { workspaceCode }, select: { id: true, nombre: true, email: true, workspaceCode: true } })
    : await prisma.empresa.findUnique({ where: { id: empresaIdFromBody }, select: { id: true, nombre: true, email: true, workspaceCode: true } })
  if (!empresa?.id) return NextResponse.json({ ok: false, error: 'Espacio de trabajo no encontrado' }, { status: 404 })

  const admins = await prisma.sedeMembership.findMany({
    where: {
      sede: { empresaId: empresa.id },
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { user: { select: { email: true } } },
  })

  const recipients = Array.from(
    new Set(
      admins
        .map((a) => (a.user.email || '').trim().toLowerCase())
        .filter((email) => email && email.includes('@'))
    )
  )

  // Fallback: si no hay admins por sedes, usamos el email de la empresa.
  if (!recipients.length && empresa.email) {
    const e = empresa.email.trim().toLowerCase()
    if (e && e.includes('@')) recipients.push(e)
  }

  if (!recipients.length) {
    return NextResponse.json(
      { ok: false, error: 'No hay administradores configurados para este espacio de trabajo.' },
      { status: 409 }
    )
  }

  const requesterEmail = (requester.email || '').trim().toLowerCase()
  const requesterName = (requester.name || '').trim()

  const subject = `Solicitud de acceso · ${empresa.nombre} · Ordex`
  const who = requesterName ? `${requesterName} (${requesterEmail})` : requesterEmail

  const html = renderEmail({
    title: 'Solicitud de acceso',
    preheader: `${who} solicitó acceso a ${empresa.nombre}.`,
    intro: `${who} solicitó acceso al espacio de trabajo ${empresa.nombre}.`,
    bodyHtml: `
      <p style="margin:0 0 12px; color:#374151;">Si deseas permitir el ingreso, comparte el <b>código de empresa</b> o envía una invitación desde el panel (Configuración → Usuarios).</p>
      ${empresa.workspaceCode ? renderEmailCode(empresa.workspaceCode, { size: 'md' }) : ''}
      <p style="margin:0; color:#6B7280; font-size:12px;">Espacio: <b>${escapeHtml(empresa.nombre)}</b> · ID: ${escapeHtml(empresa.id)}</p>
    `,
  })

  for (const to of recipients) {
    const send = await sendEmail({ to, subject, html })
    if (!send.ok) {
      return NextResponse.json({ ok: false, error: send.error }, { status: send.status })
    }
  }

  return NextResponse.json({ ok: true })
}
