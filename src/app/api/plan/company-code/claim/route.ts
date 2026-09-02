import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa } from '@/lib/rbac'
import { syncEnabledVerticalGrantsForUser } from '@/lib/company-preset-sync'

export const runtime = 'nodejs'

type ClaimBody = {
  code?: unknown
}

function normalizeWorkspaceCode(code: string): string | null {
  const normalized = code.trim().toUpperCase()
  if (!/^WS-[A-Z0-9]+$/i.test(normalized)) return null
  return normalized
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as ClaimBody
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) return NextResponse.json({ ok: false, error: 'Código requerido' }, { status: 400 })

  const userId = session.user.id
  const workspaceCode = normalizeWorkspaceCode(code)
  if (!workspaceCode) return NextResponse.json({ ok: false, error: 'Usa un código WS-... válido' }, { status: 400 })

  const empresa = await prisma.empresa.findUnique({
    where: { workspaceCode },
    select: { id: true },
  })

  if (!empresa?.id) {
    return NextResponse.json({ ok: false, error: 'Código inválido' }, { status: 403 })
  }

  await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } })
  await ensureDefaultSedeForEmpresa(empresa.id, userId)
  await syncEnabledVerticalGrantsForUser({
    empresaId: empresa.id,
    userId,
    grantedByUserId: userId,
  })

  return NextResponse.json({ ok: true })
}
