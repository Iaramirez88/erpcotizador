import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

type ConfigDropdownDelegateCompat = {
  findUnique: (args: unknown) => Promise<{ id: string; empresaId: string } | null>
  update: (args: unknown) => Promise<unknown>
  delete: (args: unknown) => Promise<unknown>
}

const prismaCompat = prisma as unknown as {
  configDropdown: ConfigDropdownDelegateCompat
}

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function toKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '')
}

async function getEmpresaIdFromSedeId(sedeId: string): Promise<string | null> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 })

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const existing = await prismaCompat.configDropdown.findUnique({ where: { id }, select: { id: true, empresaId: true } })
  if (!existing || existing.empresaId !== empresaId) {
    return NextResponse.json({ ok: false, error: 'Dropdown no encontrado' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const patch: Record<string, unknown> = {}

  if (body.nombre !== undefined) {
    const nombre = asString(body.nombre)
    if (!nombre) return NextResponse.json({ ok: false, error: 'nombre inválido' }, { status: 400 })
    patch.nombre = nombre
  }

  if (body.key !== undefined) {
    const key = toKey(asString(body.key))
    if (!key) return NextResponse.json({ ok: false, error: 'key inválida' }, { status: 400 })
    patch.key = key
  }

  if (body.descripcion !== undefined) {
    patch.descripcion = asString(body.descripcion) || null
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: true, data: { id } })
  }

  try {
    const updated = await prismaCompat.configDropdown.update({
      where: { id },
      data: patch,
      select: { id: true, key: true, nombre: true, descripcion: true, updatedAt: true },
    })

    return NextResponse.json({ ok: true, data: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al actualizar dropdown' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 })

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const existing = await prismaCompat.configDropdown.findUnique({ where: { id }, select: { id: true, empresaId: true } })
  if (!existing || existing.empresaId !== empresaId) {
    return NextResponse.json({ ok: false, error: 'Dropdown no encontrado' }, { status: 404 })
  }

  await prismaCompat.configDropdown.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
