import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { ensureWorkspaceCodeForEmpresa } from '@/lib/workspace-code'

export const runtime = 'nodejs'

export async function POST() {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const sede = await prisma.sede.findUnique({ where: { id: access.sedeId }, select: { empresaId: true } })
  const empresaId = sede?.empresaId
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const codePlain = await ensureWorkspaceCodeForEmpresa(empresaId)

  return NextResponse.json({ ok: true, code: codePlain })
}
