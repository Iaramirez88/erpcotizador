import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

type ConfigDropdownItemDelegateCompat = {
  findUnique: (args: unknown) => Promise<{ id: string; dropdown: { empresaId: string } } | null>
  update: (args: unknown) => Promise<unknown>
  delete: (args: unknown) => Promise<unknown>
}

const prismaCompat = prisma as unknown as {
  configDropdownItem: ConfigDropdownItemDelegateCompat
}

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function asInt(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(num)) return fallback
  return Math.trunc(num)
}

function toValue(value: string) {
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

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ itemId: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const { itemId } = await ctx.params
  if (!itemId) return NextResponse.json({ ok: false, error: 'itemId requerido' }, { status: 400 })

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const existing = await prismaCompat.configDropdownItem.findUnique({
    where: { id: itemId },
    select: { id: true, dropdown: { select: { empresaId: true } } },
  })
  if (!existing || existing.dropdown.empresaId !== empresaId) {
    return NextResponse.json({ ok: false, error: 'Opción no encontrada' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const patch: Record<string, unknown> = {}

  if (body.label !== undefined) {
    const label = asString(body.label)
    if (!label) return NextResponse.json({ ok: false, error: 'label inválido' }, { status: 400 })
    patch.label = label
  }

  if (body.value !== undefined) {
    const value = toValue(asString(body.value))
    if (!value) return NextResponse.json({ ok: false, error: 'value inválido' }, { status: 400 })
    patch.value = value
  }

  if (body.sortOrder !== undefined) {
    patch.sortOrder = asInt(body.sortOrder, 0)
  }

  if (body.activo !== undefined) {
    patch.activo = Boolean(body.activo)
  }

  if (body.meta !== undefined) {
    patch.meta = body.meta && typeof body.meta === 'object' ? body.meta : {}
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: true, data: { id: itemId } })
  }

  try {
    const updated = await prismaCompat.configDropdownItem.update({
      where: { id: itemId },
      data: patch,
      select: { id: true, dropdownId: true, label: true, value: true, meta: true, sortOrder: true, activo: true, updatedAt: true },
    })

    return NextResponse.json({ ok: true, data: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al actualizar opción' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ itemId: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const { itemId } = await ctx.params
  if (!itemId) return NextResponse.json({ ok: false, error: 'itemId requerido' }, { status: 400 })

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const existing = await prismaCompat.configDropdownItem.findUnique({
    where: { id: itemId },
    select: { id: true, dropdown: { select: { empresaId: true } } },
  })
  if (!existing || existing.dropdown.empresaId !== empresaId) {
    return NextResponse.json({ ok: false, error: 'Opción no encontrada' }, { status: 404 })
  }

  await prismaCompat.configDropdownItem.delete({ where: { id: itemId } })

  return NextResponse.json({ ok: true })
}
