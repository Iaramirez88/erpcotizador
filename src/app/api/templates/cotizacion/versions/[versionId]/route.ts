import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_COTIZACION_TEMPLATE, mergeCotizacionTemplateSettings } from '@/lib/cotizacion-template'
import { requireEmpresaIdForUser } from '@/lib/rbac'

export const runtime = 'nodejs'

async function resolveUserIdFromSession(session: { user?: { id?: string; email?: string | null } }) {
  if (session.user?.id) {
    const userById = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } })
    if (userById?.id) return userById.id
  }
  const email = session.user?.email
  if (!email) return null
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ versionId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const empresaId = await requireEmpresaIdForUser(userId)

  const { versionId } = await context.params
  if (!versionId) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })

  const record = await prisma.empresaCotizacionTemplateVersion.findFirst({
    where: { id: versionId, empresaId },
    select: { settings: true, defaultSettings: true, createdAt: true },
  })

  if (!record) return NextResponse.json({ success: false, error: 'No encontrada' }, { status: 404 })

  const settings = mergeCotizacionTemplateSettings(record.settings ?? DEFAULT_COTIZACION_TEMPLATE)
  const defaultSettings = mergeCotizacionTemplateSettings(record.defaultSettings ?? DEFAULT_COTIZACION_TEMPLATE)

  return NextResponse.json({ success: true, data: { id: versionId, createdAt: record.createdAt, settings, defaultSettings } })
}
