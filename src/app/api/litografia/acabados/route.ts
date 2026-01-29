import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

function asString(value: unknown) {
  return String(value ?? "").trim()
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === "number" ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function toFinishKeyFromNombre(nombre: string) {
  return nombre
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "")
}

async function getEmpresaIdFromSedeId(sedeId: string): Promise<string | null> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.COTIZADOR, "READ")
  if (!access.ok) return access.response

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: "Empresa no encontrada" }, { status: 404 })

  const items = await prisma.litografiaFinishOption.findMany({
    where: { empresaId },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    select: { id: true, key: true, nombre: true, valor: true, activo: true, updatedAt: true },
  })

  return NextResponse.json({ ok: true, data: items })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONFIG, "WRITE")
  if (!access.ok) return access.response

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: "Empresa no encontrada" }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const nombre = asString(body.nombre)
  const key = asString(body.key) || toFinishKeyFromNombre(nombre)
  const valor = asNumber(body.valor)
  const activo = body.activo === undefined ? true : Boolean(body.activo)

  if (!nombre) return NextResponse.json({ ok: false, error: "nombre es requerido" }, { status: 400 })
  if (!key) return NextResponse.json({ ok: false, error: "nombre es requerido" }, { status: 400 })
  if (valor !== null && valor < 0) return NextResponse.json({ ok: false, error: "valor inválido" }, { status: 400 })

  try {
    const created = await prisma.litografiaFinishOption.create({
      data: { empresaId, key, nombre, valor: valor ?? 0, activo },
      select: { id: true, key: true, nombre: true, valor: true, activo: true, updatedAt: true },
    })
    return NextResponse.json({ ok: true, data: created })
  } catch {
    return NextResponse.json({ ok: false, error: "Error al crear acabado" }, { status: 500 })
  }
}
