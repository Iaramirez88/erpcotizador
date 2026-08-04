import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { getBackupAccess, importEmpresaBackup } from '@/lib/empresa-backups'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const access = await getBackupAccess({ empresaId, userId: session.user.id })
  if (!access.canImport) {
    return NextResponse.json({ success: false, error: 'Solo administradores o usuarios autorizados pueden restaurar respaldos.' }, { status: 403 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'Archivo requerido.' }, { status: 400 })
  }

  if (!file.name.toLowerCase().endsWith('.sql')) {
    return NextResponse.json({ success: false, error: 'Por ahora solo se admite restaurar respaldos SQL generados por SGDigital.' }, { status: 400 })
  }

  const sqlContent = Buffer.from(await file.arrayBuffer()).toString('utf8')
  const restored = await importEmpresaBackup({ empresaId, userId: session.user.id, sqlContent })
  return NextResponse.json({ success: true, data: restored })
}