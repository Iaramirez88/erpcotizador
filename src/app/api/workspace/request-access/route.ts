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
    select: { userId: true, user: { select: { email: true } } },
  })

  const recipientUserIds = Array.from(new Set(admins.map((a) => a.userId).filter(Boolean)))

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

  // Registrar solicitud pendiente (evita duplicados PENDING por usuario+empresa)
  const existingRequest = await prisma.workspaceAccessRequest.findFirst({
    where: {
      empresaId: empresa.id,
      requesterUserId: requester.id,
      status: 'PENDING',
    },
    select: { id: true },
  })

  if (!existingRequest?.id) {
    await prisma.workspaceAccessRequest.create({
      data: {
        empresaId: empresa.id,
        requesterUserId: requester.id,
        workspaceCode: empresa.workspaceCode || workspaceCode || null,
        status: 'PENDING',
      },
      select: { id: true },
    })
  }

  // Notificación in-app para admins/manager (más rápido que email).
  if (recipientUserIds.length) {
    await prisma.notification.createMany({
      data: recipientUserIds.map((userId) => ({
        userId,
        empresaId: empresa.id,
        type: 'WARNING',
        title: 'Solicitud de acceso',
        body: `${who} solicitó acceso a ${empresa.nombre}. Ve a Configuración → Usuarios para invitarlo o asignarle permisos.`,
      })),
      skipDuplicates: false,
    })
  }

  const html = renderEmail({
    title: 'Solicitud de acceso',
    preheader: `${who} solicitó acceso a ${empresa.nombre}.`,
    intro: `${who} solicitó acceso al espacio de trabajo ${empresa.nombre}.`,
    bodyHtml: `
      <p style="margin:0 0 12px; color:#374151;">Si deseas permitir el ingreso, envía una invitación desde el panel (Configuración → Usuarios). Si aplica, también puedes compartir el <b>código de espacio (WS-...)</b>.</p>
      ${empresa.workspaceCode ? renderEmailCode(empresa.workspaceCode, { size: 'md' }) : ''}
      <p style="margin:0; color:#6B7280; font-size:12px;">Espacio: <b>${escapeHtml(empresa.nombre)}</b></p>
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
