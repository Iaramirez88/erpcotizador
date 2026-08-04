import { NextResponse } from 'next/server'
import { EmpresaBackupFormat } from '@prisma/client'
import { auth } from '@/lib/auth'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import {
  createEmpresaBackup,
  ensureMonthlyAutomaticBackup,
  getBackupAccess,
  listBackupAccessUsers,
  listBackupModules,
  listEmpresaBackups,
  type BackupModuleId,
} from '@/lib/empresa-backups'

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

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const access = await getBackupAccess({ empresaId, userId: session.user.id })

  if (!access.canExport && !access.canImport) {
    return NextResponse.json({ success: false, error: 'No tienes acceso al módulo de respaldo.' }, { status: 403 })
  }

  await ensureMonthlyAutomaticBackup({ empresaId })

  const [backups, accessUsers] = await Promise.all([
    listEmpresaBackups(empresaId),
    access.isAdmin ? listBackupAccessUsers(empresaId) : Promise.resolve([]),
  ])

  return NextResponse.json({
    success: true,
    data: {
      modules: listBackupModules(),
      access,
      backups,
      accessUsers,
    },
  })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const access = await getBackupAccess({ empresaId, userId: session.user.id })

  if (!access.canExport) {
    return NextResponse.json({ success: false, error: 'No tienes permiso para crear respaldos.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido.' }, { status: 400 })
  }

  const format = body.format === 'XLSX' ? EmpresaBackupFormat.XLSX : EmpresaBackupFormat.SQL
  const moduleIds = normalizeModuleIds(body.moduleIds)
  const from = normalizeDate(body.from)
  const to = normalizeDate(body.to)
  const label = typeof body.label === 'string' ? body.label.trim() : ''

  const backup = await createEmpresaBackup({
    empresaId,
    userId: session.user.id,
    moduleIds,
    format,
    triggerSource: 'MANUAL',
    range: { from, to },
    label: label || undefined,
  })

  return NextResponse.json({ success: true, data: backup })
}