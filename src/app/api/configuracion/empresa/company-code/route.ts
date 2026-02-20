import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function randomCodePart(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function POST() {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const sede = await prisma.sede.findUnique({ where: { id: access.sedeId }, select: { empresaId: true } })
  const empresaId = sede?.empresaId
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const codePlain = `EMP-${empresaId}-${randomCodePart(8)}`
  const codeHash = await bcrypt.hash(codePlain, 12)

  await prisma.empresa.update({ where: { id: empresaId }, data: { registrationCodeHash: codeHash }, select: { id: true } })

  return NextResponse.json({ ok: true, code: codePlain })
}
