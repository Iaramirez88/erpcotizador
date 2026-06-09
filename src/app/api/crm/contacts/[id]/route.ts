import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'

export const runtime = 'nodejs'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CONTACTS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await prisma.crmContact.findUnique({
      where: { id },
      select: {
        id: true,
        empresaId: true,
        sedeId: true,
        leadId: true,
        clienteId: true,
        nombre: true,
      },
    })

    if (!current || current.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
    }

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const nombre = normalizeString(body?.nombre)
    const email = normalizeString(body?.email)
    const telefono = normalizeString(body?.telefono)
    const celular = normalizeString(body?.celular)
    const cargo = normalizeString(body?.cargo)
    const notes = normalizeString(body?.notes)
    const isPrimary = Object.prototype.hasOwnProperty.call(body ?? {}, 'isPrimary') ? Boolean(body?.isPrimary) : undefined

    const updated = await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.crmContact.updateMany({
          where: {
            empresaId: access.empresaId,
            id: { not: current.id },
            ...(current.leadId ? { leadId: current.leadId } : {}),
            ...(current.clienteId ? { clienteId: current.clienteId } : {}),
          },
          data: { isPrimary: false },
        })
      }

      return tx.crmContact.update({
        where: { id: current.id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'nombre') ? { nombre: nombre || current.nombre } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'email') ? { email: email || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'telefono') ? { telefono: telefono || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'celular') ? { celular: celular || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'cargo') ? { cargo: cargo || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'notes') ? { notes: notes || null } : {}),
          ...(isPrimary !== undefined ? { isPrimary } : {}),
        },
        include: {
          lead: { select: { id: true, nombre: true } },
          cliente: { select: { id: true, nombre: true, documento: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      })
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error actualizando contacto CRM:', error)
    return NextResponse.json({ error: 'Error actualizando contacto CRM' }, { status: 500 })
  }
}