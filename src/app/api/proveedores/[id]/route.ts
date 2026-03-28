/**
 * API Route: Proveedor por ID
 * GET /api/proveedores/:id
 * PATCH /api/proveedores/:id
 * DELETE /api/proveedores/:id
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.PROVEEDORES, 'READ')
    if (!access.ok) return access.response

    const { id } = await context.params
    const empresaId = access.empresaId
    const proveedor = await prisma.proveedor.findUnique({ where: { id } })
    if (!proveedor) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    if (proveedor.empresaId !== empresaId) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })

    return NextResponse.json({ success: true, data: proveedor })
  } catch (error) {
    console.error("Error al obtener proveedor:", error)
    return NextResponse.json({ error: "Error al obtener proveedor" }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.PROVEEDORES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const empresaId = access.empresaId
    const body = await request.json().catch(() => ({}))

    const existing = await prisma.proveedor.findUnique({
      where: { id },
      select: { id: true, empresaId: true },
    })

    if (!existing || existing.empresaId !== empresaId) {
      return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    }

    const proveedor = await prisma.proveedor.update({
      where: { id },
      data: {
        nombre: body?.nombre !== undefined ? String(body.nombre).trim() : undefined,
        nit: body?.nit !== undefined ? (body.nit ? String(body.nit).trim() : null) : undefined,
        telefono: body?.telefono !== undefined ? (body.telefono ? String(body.telefono).trim() : null) : undefined,
        direccion: body?.direccion !== undefined ? (body.direccion ? String(body.direccion).trim() : null) : undefined,
        email: body?.email !== undefined ? (body.email ? String(body.email).trim() : null) : undefined,
        contacto: body?.contacto !== undefined ? (body.contacto ? String(body.contacto).trim() : null) : undefined,
        ciudad: body?.ciudad !== undefined ? (body.ciudad ? String(body.ciudad).trim() : null) : undefined,
        departamento: body?.departamento !== undefined ? (body.departamento ? String(body.departamento).trim() : null) : undefined,
        observaciones: body?.observaciones !== undefined ? (body.observaciones ? String(body.observaciones) : null) : undefined,
        activo: body?.activo !== undefined ? Boolean(body.activo) : undefined,
      },
    })

    return NextResponse.json({ success: true, data: proveedor })
  } catch (error) {
    console.error("Error al actualizar proveedor:", error)
    return NextResponse.json({ error: "Error al actualizar proveedor" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.PROVEEDORES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const empresaId = access.empresaId

    const existing = await prisma.proveedor.findUnique({
      where: { id },
      select: { id: true, empresaId: true },
    })

    if (!existing || existing.empresaId !== empresaId) {
      return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })
    }

    await prisma.proveedor.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar proveedor:", error)
    return NextResponse.json({ error: "Error al eliminar proveedor" }, { status: 500 })
  }
}
