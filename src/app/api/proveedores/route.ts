/**
 * API Route: Proveedores
 * GET /api/proveedores?search=&activo=
 * POST /api/proveedores
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { checkPlanLimit } from "@/lib/plan-limits"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.PROVEEDORES, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get("search") || "").trim()
    const activo = searchParams.get("activo")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { empresaId: access.empresaId }

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: "insensitive" as const } },
        { nit: { contains: search, mode: "insensitive" as const } },
        { telefono: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
      ]
    }

    if (activo !== null && activo !== undefined && activo !== "") {
      where.activo = activo === "true"
    }

    const proveedores = await prisma.proveedor.findMany({
      where,
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json({ success: true, data: proveedores })
  } catch (error) {
    console.error("Error al obtener proveedores:", error)
    return NextResponse.json({ error: "Error al obtener proveedores" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.PROVEEDORES, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const limit = await checkPlanLimit(empresaId, 'PROVEEDORES_MAX')
    if (!limit.ok) {
      return NextResponse.json(limit, { status: 402 })
    }

    const body = await request.json().catch(() => ({}))
    const {
      nombre,
      nit,
      telefono,
      direccion,
      email,
      contacto,
      ciudad,
      departamento,
      observaciones,
      activo,
    } = body || {}

    if (!nombre || !String(nombre).trim()) {
      return NextResponse.json({ error: "El nombre del proveedor es requerido" }, { status: 400 })
    }

    const proveedor = await prisma.proveedor.create({
      data: {
        nombre: String(nombre).trim(),
        nit: nit ? String(nit).trim() : null,
        telefono: telefono ? String(telefono).trim() : null,
        direccion: direccion ? String(direccion).trim() : null,
        email: email ? String(email).trim() : null,
        contacto: contacto ? String(contacto).trim() : null,
        ciudad: ciudad ? String(ciudad).trim() : null,
        departamento: departamento ? String(departamento).trim() : null,
        observaciones: observaciones ? String(observaciones) : null,
        activo: activo !== false,
        empresaId,
      },
    })

    return NextResponse.json({ success: true, data: proveedor }, { status: 201 })
  } catch (error) {
    console.error("Error al crear proveedor:", error)
    return NextResponse.json({ error: "Error al crear proveedor" }, { status: 500 })
  }
}
