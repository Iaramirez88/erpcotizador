import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa } from '@/lib/rbac'

export const runtime = 'nodejs'

type ClaimBody = {
  code?: unknown
}

function extractEmpresaIdFromCode(code: string): string | null {
  // Formato recomendado: EMP-<empresaId>-<random>
  // Esto permite verificar en O(1) sin escanear todas las empresas.
  const m = /^EMP-([a-z0-9]+)-/i.exec(code.trim())
  return m?.[1] ?? null
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as ClaimBody
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  if (!code) return NextResponse.json({ ok: false, error: 'Código requerido' }, { status: 400 })

  const userId = session.user.id

  // 1) Intento rápido por formato EMP-<empresaId>-...
  const hintedEmpresaId = extractEmpresaIdFromCode(code)
  if (hintedEmpresaId) {
    const empresa = await prisma.empresa.findUnique({
      where: { id: hintedEmpresaId },
      select: { id: true, registrationCodeHash: true },
    })

    if (!empresa?.id || !empresa.registrationCodeHash) {
      return NextResponse.json({ ok: false, error: 'Código inválido' }, { status: 403 })
    }

    const ok = await bcrypt.compare(code, empresa.registrationCodeHash)
    if (!ok) return NextResponse.json({ ok: false, error: 'Código inválido' }, { status: 403 })

    await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } })
    await ensureDefaultSedeForEmpresa(empresa.id, userId)

    return NextResponse.json({ ok: true })
  }

  // 2) Fallback: si el código no trae empresaId, escaneamos empresas con hash.
  // Esto es más costoso, pero mantiene compatibilidad con códigos antiguos.
  const empresas = await prisma.empresa.findMany({
    where: { registrationCodeHash: { not: null } },
    select: { id: true, registrationCodeHash: true },
  })

  for (const empresa of empresas) {
    if (!empresa.registrationCodeHash) continue
    // bcrypt.compare es async; lo hacemos secuencial para evitar picos de CPU.
    const ok = await bcrypt.compare(code, empresa.registrationCodeHash)
    if (!ok) continue

    await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } })
    await ensureDefaultSedeForEmpresa(empresa.id, userId)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: 'Código inválido' }, { status: 403 })
}
