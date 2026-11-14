import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

/**
 * Fusiona un contacto duplicado en el contacto canónico (`id`).
 * Mueve leads, capturas, conversaciones, oportunidades y actividades, y deja
 * auditoría con `mergedIntoId`. No se borra el origen (trazabilidad).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CONTACTS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id: targetId } = await context.params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const sourceId = normalizeString(body?.sourceContactId ?? body?.mergedContactId)

    if (!sourceId) {
      return NextResponse.json({ error: 'sourceContactId es requerido' }, { status: 400 })
    }
    if (sourceId === targetId) {
      return NextResponse.json({ error: 'No se puede fusionar un contacto consigo mismo' }, { status: 400 })
    }

    const [target, source] = await Promise.all([
      prisma.crmContact.findUnique({ where: { id: targetId } }),
      prisma.crmContact.findUnique({ where: { id: sourceId } }),
    ])

    if (!target || target.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Contacto destino no encontrado' }, { status: 404 })
    }
    if (!source || source.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Contacto origen no encontrado' }, { status: 404 })
    }
    if (source.mergedIntoId) {
      return NextResponse.json({ error: 'El contacto origen ya fue fusionado' }, { status: 409 })
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.crmLead.updateMany({ where: { contactId: source.id }, data: { contactId: target.id } })
      await tx.crmLeadCapture.updateMany({ where: { contactId: source.id }, data: { contactId: target.id } })
      await tx.crmConversation.updateMany({ where: { contactId: source.id }, data: { contactId: target.id } })
      await tx.crmOpportunity.updateMany({ where: { contactId: source.id }, data: { contactId: target.id } })
      await tx.crmActivity.updateMany({ where: { contactId: source.id }, data: { contactId: target.id } })

      const merged = await tx.crmContact.update({
        where: { id: source.id },
        data: {
          mergedIntoId: target.id,
          status: 'INACTIVE',
          leadId: null,
          clienteId: source.clienteId && !target.clienteId ? source.clienteId : null,
        },
      })

      const canonical = await tx.crmContact.update({
        where: { id: target.id },
        data: {
          apellido: target.apellido || source.apellido,
          email: target.email || source.email,
          emailNormalized: target.emailNormalized || source.emailNormalized,
          telefono: target.telefono || source.telefono,
          celular: target.celular || source.celular,
          phoneNormalized: target.phoneNormalized || source.phoneNormalized,
          empresaNombre: target.empresaNombre || source.empresaNombre,
          documento: target.documento || source.documento,
          ciudad: target.ciudad || source.ciudad,
          departamento: target.departamento || source.departamento,
          pais: target.pais || source.pais,
          sitioWeb: target.sitioWeb || source.sitioWeb,
          cargo: target.cargo || source.cargo,
          clienteId: target.clienteId || source.clienteId,
          tags: Array.from(new Set([...(target.tags ?? []), ...(source.tags ?? [])])).slice(0, 40),
          lastInteractionAt:
            target.lastInteractionAt && source.lastInteractionAt
              ? target.lastInteractionAt > source.lastInteractionAt
                ? target.lastInteractionAt
                : source.lastInteractionAt
              : target.lastInteractionAt || source.lastInteractionAt,
        },
      })

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: canonical.sedeId,
          type: 'OTHER',
          summary: `Contactos fusionados: ${source.nombre} → ${canonical.nombre}`,
          details: `Origen ${source.id} · Destino ${canonical.id}`,
          contactId: canonical.id,
          eventKey: `merge:${source.id}:${canonical.id}`,
          metadataJson: { sourceContactId: source.id, targetContactId: canonical.id },
          createdById: access.userId,
        },
      })

      return { canonical, merged }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error fusionando contactos CRM:', error)
    return NextResponse.json({ error: 'Error fusionando contactos CRM' }, { status: 500 })
  }
}
