import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

function asString(value: unknown) {
  return String(value ?? "").trim()
}

function asNumber(value: unknown, fallback = 0) {
  const num = typeof value === "number" ? value : Number(String(value ?? "").trim())
  return Number.isFinite(num) ? num : fallback
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

  const items = await prisma.litografiaPrintSize.findMany({
    where: { empresaId },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    select: { id: true, key: true, nombre: true, widthCm: true, heightCm: true, activo: true, updatedAt: true },
  })

  return NextResponse.json({ ok: true, data: items })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONFIG, "WRITE")
  if (!access.ok) return access.response

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: "Empresa no encontrada" }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const key = asString(body.key)
  const nombre = asString(body.nombre)
  const widthCm = Math.max(0, asNumber(body.widthCm, 0))
  const heightCm = Math.max(0, asNumber(body.heightCm, 0))
  const activo = body.activo === undefined ? true : Boolean(body.activo)

  if (!key) return NextResponse.json({ ok: false, error: "código es requerido" }, { status: 400 })
  if (!nombre) return NextResponse.json({ ok: false, error: "nombre es requerido" }, { status: 400 })
  if (!(widthCm > 0) || !(heightCm > 0)) {
    return NextResponse.json({ ok: false, error: "widthCm y heightCm deben ser > 0" }, { status: 400 })
  }

  try {
    const created = await prisma.litografiaPrintSize.create({
      data: { empresaId, key, nombre, widthCm, heightCm, activo },
      select: { id: true, key: true, nombre: true, widthCm: true, heightCm: true, activo: true, updatedAt: true },
    })
    return NextResponse.json({ ok: true, data: created })
  } catch {
    return NextResponse.json({ ok: false, error: "Error al crear tamaño" }, { status: 500 })
  }
}
