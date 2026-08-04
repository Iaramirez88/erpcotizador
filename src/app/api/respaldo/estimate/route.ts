import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { estimateBackup, getBackupAccess, type BackupModuleId } from '@/lib/empresa-backups'

export const runtime = 'nodejs'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeModuleIds(value: unknown): BackupModuleId[] {
  return Array.isArray(value)
    ? value.filter((item): item is BackupModuleId => typeof item === 'string')
    : []
}

function normalizeDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const access = await getBackupAccess({ empresaId, userId: session.user.id })
  if (!access.canExport) {
    return NextResponse.json({ success: false, error: 'No tienes permiso para estimar respaldos.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido.' }, { status: 400 })
  }

  const estimate = await estimateBackup({
    empresaId,
    moduleIds: normalizeModuleIds(body.moduleIds),
    range: {
      from: normalizeDate(body.from),
      to: normalizeDate(body.to),
    },
  })

  return NextResponse.json({ success: true, data: estimate })
}