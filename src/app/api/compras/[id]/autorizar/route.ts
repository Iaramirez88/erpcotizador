/**
 * POST /api/compras/:id/autorizar
 * Body: { autorizado: boolean }
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCapabilityAccess } from "@/lib/api-rbac"
import { postReferenceToAccounting, voidReferenceAccounting } from "@/lib/accounting/auto-post"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'RECURSOS',
      subdomain: 'PURCHASES',
      action: 'APPROVE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = await request.json().catch(() => ({}))

    const autorizado = Boolean(body?.autorizado)

    const compra = await prisma.compra.update({
      where: { id },
      data: {
        autorizado,
        autorizadoAt: autorizado ? new Date() : null,
        autorizadoById: autorizado ? String(access.userId) : null,
      },
    })

    if (autorizado) {
      await postReferenceToAccounting({
        empresaId: compra.empresaId,
        userId: access.userId,
        referenceType: 'COMPRA',
        referenceId: compra.id,
      })
    } else {
      await voidReferenceAccounting({
        empresaId: compra.empresaId,
        referenceType: 'COMPRA',
        referenceId: compra.id,
        reason: 'Autorización retirada',
      })
    }

    return NextResponse.json({ success: true, data: compra })
  } catch (error) {
    console.error("Error al autorizar compra:", error)
    return NextResponse.json({ error: "Error al autorizar compra" }, { status: 500 })
  }
}
