import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { getBackupAccess, purgeEmpresaWorkspaceData, resolveBackupDangerZoneRecipient } from '@/lib/empresa-backups'
import { sha256Hex, timingSafeEqualHex } from '@/lib/auth-tokens'

export const runtime = 'nodejs'

type Body = {
  code?: unknown
  acceptedExport?: unknown
  acceptedIrreversible?: unknown
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const access = await getBackupAccess({ empresaId, userId: session.user.id })
  if (!access.isAdmin) {
    return NextResponse.json({ success: false, error: 'Solo un administrador puede ejecutar esta operación.' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as Body | null
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const acceptedExport = body?.acceptedExport === true
  const acceptedIrreversible = body?.acceptedIrreversible === true

  if (!acceptedExport || !acceptedIrreversible) {
    return NextResponse.json({ success: false, error: 'Debes aceptar las condiciones de exportación y eliminación irreversible.' }, { status: 400 })
  }

  if (!/^[0-9]{6}$/.test(code)) {
    return NextResponse.json({ success: false, error: 'Código inválido.' }, { status: 400 })
  }

  const recipient = await resolveBackupDangerZoneRecipient({ empresaId, fallbackUserId: session.user.id })
  if (!recipient?.email) {
    return NextResponse.json({ success: false, error: 'No se encontró el correo administrador para validar el código.' }, { status: 400 })
  }

  const now = new Date()
  await prisma.emailVerificationCode.deleteMany({
    where: {
      userId: recipient.userId,
      email: recipient.email,
      expiresAt: { lte: now },
    },
  })

  const latestCode = await prisma.emailVerificationCode.findFirst({
    where: {
      userId: recipient.userId,
      email: recipient.email,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
    select: { codeHash: true },
  })

  if (!latestCode || !timingSafeEqualHex(sha256Hex(code), latestCode.codeHash)) {
    return NextResponse.json({ success: false, error: 'Código inválido o expirado.' }, { status: 400 })
  }

  await prisma.emailVerificationCode.deleteMany({
    where: {
      userId: recipient.userId,
      email: recipient.email,
    },
  })

  const result = await purgeEmpresaWorkspaceData({ empresaId })

  return NextResponse.json({
    success: true,
    data: {
      message: 'La información asociada al workspace fue eliminada del programa.',
      deletedRows: result.deletedRows,
      deletedModels: result.deletedModels,
    },
  })
}
