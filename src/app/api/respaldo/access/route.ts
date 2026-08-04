import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { getBackupAccess, upsertBackupAccessGrant } from '@/lib/empresa-backups'

export const runtime = 'nodejs'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const access = await getBackupAccess({ empresaId, userId: session.user.id })
  if (!access.isAdmin) {
    return NextResponse.json({ success: false, error: 'Solo administradores pueden gestionar permisos de respaldo.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido.' }, { status: 400 })
  }

  const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const enabled = Boolean(body.enabled)
  const allowImport = Boolean(body.allowImport)

  if (!targetUserId) {
    return NextResponse.json({ success: false, error: 'userId es requerido.' }, { status: 400 })
  }

  const result = await upsertBackupAccessGrant({
    empresaId,
    userId: targetUserId,
    enabled,
    allowImport,
  })

  return NextResponse.json({ success: true, data: result })
}