import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { getBackupAccess, resolveBackupDangerZoneRecipient } from '@/lib/empresa-backups'
import { randomDigits, sha256Hex } from '@/lib/auth-tokens'
import { sendEmail } from '@/lib/email'
import { renderEmail, renderEmailCode } from '@/lib/email-template'

export const runtime = 'nodejs'

function maskEmail(value: string): string {
  const [localPart, domainPart = ''] = value.split('@')
  if (!localPart || !domainPart) return value
  const safeLocal = localPart.length <= 2
    ? `${localPart.charAt(0)}*`
    : `${localPart.slice(0, 2)}${'*'.repeat(Math.max(2, localPart.length - 2))}`
  return `${safeLocal}@${domainPart}`
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const access = await getBackupAccess({ empresaId, userId: session.user.id })
  if (!access.isAdmin) {
    return NextResponse.json({ success: false, error: 'Solo un administrador puede iniciar esta operación.' }, { status: 403 })
  }

  const recipient = await resolveBackupDangerZoneRecipient({ empresaId, fallbackUserId: session.user.id })
  if (!recipient?.email) {
    return NextResponse.json({ success: false, error: 'No se encontró un correo administrador para enviar el código.' }, { status: 400 })
  }

  const code = randomDigits(6)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.emailVerificationCode.deleteMany({
    where: {
      userId: recipient.userId,
      email: recipient.email,
    },
  })

  await prisma.emailVerificationCode.create({
    data: {
      userId: recipient.userId,
      email: recipient.email,
      codeHash: sha256Hex(code),
      expiresAt,
    },
  })

  const subject = 'Código de seguridad · zona de peligro · respaldo'
  const html = renderEmail({
    title: 'Confirma el retiro y borrado de información',
    preheader: `Tu código de seguridad es ${code}.`,
    intro: 'Se solicitó exportar y eliminar de forma irreversible la información del workspace.',
    bodyHtml: `
      <p style="margin:0 0 12px; color:#374151;">Usa este código solo si autorizas la descarga final y la eliminación irreversible de la información asociada a la empresa.</p>
      ${renderEmailCode(code, { size: 'lg' })}
      <p style="margin:12px 0 0; color:#6B7280; font-size:12px;">Este código expira en 10 minutos y no tiene vuelta atrás.</p>
    `,
    footerNote: recipient.name ? `Administrador: ${recipient.name}` : 'Administrador del workspace',
  })

  const send = await sendEmail({ to: recipient.email, subject, html })
  if (!send.ok) {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No se pudo enviar el correo en desarrollo. Usa el código dev para continuar.',
          maskedEmail: maskEmail(recipient.email),
          debugCode: code,
        },
      })
    }

    return NextResponse.json({ success: false, error: send.error }, { status: send.status })
  }

  return NextResponse.json({
    success: true,
    data: {
      message: `Código enviado al administrador (${maskEmail(recipient.email)}).`,
      maskedEmail: maskEmail(recipient.email),
    },
  })
}
