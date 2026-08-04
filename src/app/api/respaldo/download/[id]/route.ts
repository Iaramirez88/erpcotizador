import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { getBackupAccess, readBackupFile } from '@/lib/empresa-backups'

export const runtime = 'nodejs'

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const access = await getBackupAccess({ empresaId, userId: session.user.id })
  if (!access.canExport) {
    return NextResponse.json({ success: false, error: 'No tienes permiso para descargar respaldos.' }, { status: 403 })
  }

  const { id } = await ctx.params
  const file = await readBackupFile(empresaId, id)
  if (!file) {
    return NextResponse.json({ success: false, error: 'Respaldo no encontrado.' }, { status: 404 })
  }

  return new NextResponse(file.buffer, {
    status: 200,
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Content-Length': String(file.buffer.byteLength),
      'Cache-Control': 'no-store',
    },
  })
}