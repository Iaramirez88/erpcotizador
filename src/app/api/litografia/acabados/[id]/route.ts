import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { LitografiaFinishGroup, ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

function asString(value: unknown) {
  return String(value ?? "").trim()
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === "number" ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function asBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value
  const s = String(value).trim().toLowerCase()
  if (["true", "1", "yes", "si"].includes(s)) return true
  if (["false", "0", "no"].includes(s)) return false
  return null
}

function asGrupo(value: unknown): LitografiaFinishGroup | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim().toUpperCase()
  if (!s) return null
  const allowed = new Set(["ACABADO", "PLASTIFICADO", "TROQUELADO", "CORTE"])
  return allowed.has(s) ? (s as LitografiaFinishGroup) : null
}

async function getEmpresaIdFromSedeId(sedeId: string): Promise<string | null> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONFIG, "WRITE")
  if (!access.ok) return access.response

  const { id } = await ctx.params
  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: "Empresa no encontrada" }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const patch: Record<string, unknown> = {}

  if (body.key !== undefined) {
    const key = asString(body.key)
    if (!key) return NextResponse.json({ ok: false, error: "key es requerido" }, { status: 400 })
    patch.key = key
  }

  if (body.nombre !== undefined) {
    const nombre = asString(body.nombre)
    if (!nombre) return NextResponse.json({ ok: false, error: "nombre es requerido" }, { status: 400 })
    patch.nombre = nombre
  }

  if (body.grupo !== undefined) {
    const grupo = asGrupo(body.grupo)
    if (grupo === null) return NextResponse.json({ ok: false, error: "grupo inválido" }, { status: 400 })
    patch.grupo = grupo
  }

  if (body.activo !== undefined) patch.activo = Boolean(body.activo)

  if (body.especial !== undefined) {
    const especial = asBoolean(body.especial)
    if (especial === null) return NextResponse.json({ ok: false, error: "especial inválido" }, { status: 400 })
    patch.especial = especial
  }

  if (body.valor !== undefined) {
    const valor = asNumber(body.valor)
    if (valor === null || valor < 0) return NextResponse.json({ ok: false, error: "valor inválido" }, { status: 400 })
    patch.valor = valor
  }

  try {
    const updated = await prisma.litografiaFinishOption.update({
      where: { id, empresaId },
      data: patch,
      select: { id: true, key: true, nombre: true, grupo: true, especial: true, valor: true, activo: true, updatedAt: true },
    })
    return NextResponse.json({ ok: true, data: updated })
  } catch {
    return NextResponse.json({ ok: false, error: "Error al actualizar acabado" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONFIG, "WRITE")
  if (!access.ok) return access.response

  const { id } = await ctx.params
  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: "Empresa no encontrada" }, { status: 404 })

  try {
    await prisma.litografiaFinishOption.delete({ where: { id, empresaId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: "Error al eliminar acabado" }, { status: 500 })
  }
}
