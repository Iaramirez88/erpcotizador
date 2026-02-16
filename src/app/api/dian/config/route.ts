import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import type { ModuleKey, Prisma } from '@prisma/client'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function GET() {
  const access = await requireApiAccess('POS' as ModuleKey, 'READ')
  if (!access.ok) return access.response

  const empresa = await prisma.empresa.findUnique({
    where: { id: access.empresaId },
    select: { id: true, dianSettings: true },
  })

  return NextResponse.json({ ok: true, data: empresa?.dianSettings ?? {} })
}

export async function PUT(req: NextRequest) {
  const access = await requireApiAccess('POS' as ModuleKey, 'WRITE')
  if (!access.ok) return access.response

  const body = (await req.json().catch(() => ({}))) as unknown
  if (!isRecord(body) || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }

  const settings = body as Prisma.InputJsonObject

  const updated = await prisma.empresa.update({
    where: { id: access.empresaId },
    data: { dianSettings: settings },
    select: { dianSettings: true },
  })

  return NextResponse.json({ ok: true, data: updated.dianSettings })
}
