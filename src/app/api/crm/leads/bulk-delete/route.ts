import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { deleteCrmLeadsCascade } from '@/lib/crm-lead-delete'
import { canAccessCrmRecord, resolveCrmRequestScope } from '@/lib/crm-scope'

export const runtime = 'nodejs'

const MAX_BULK_DELETE = 500

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'LEADS',
      action: 'DELETE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as { ids?: unknown } | null
    const ids = Array.isArray(body?.ids)
      ? Array.from(
          new Set(
            body.ids
              .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
              .map((id) => id.trim())
          )
        )
      : []

    if (!ids.length) {
      return NextResponse.json({ error: 'No se indicaron leads para eliminar' }, { status: 400 })
    }
    if (ids.length > MAX_BULK_DELETE) {
      return NextResponse.json(
        { error: `Selecciona como máximo ${MAX_BULK_DELETE} leads por operación` },
        { status: 400 }
      )
    }

    const scope = await resolveCrmRequestScope(access, { subdomain: 'LEADS', action: 'DELETE' })

    // Solo se eliminan leads de la propia empresa y a los que el usuario tiene
    // alcance según sus grants. Nunca se tocan registros de otras empresas.
    const leads = await prisma.crmLead.findMany({
      where: { id: { in: ids }, empresaId: access.empresaId },
      select: { id: true, sedeId: true, ownerUserId: true, createdById: true, assignedByUserId: true },
    })

    const deletable = leads.filter((lead) => canAccessCrmRecord(scope, 'lead', lead))
    if (!deletable.length) {
      return NextResponse.json(
        { error: 'No tienes acceso a ninguno de los leads seleccionados' },
        { status: 403 }
      )
    }

    const deleted = await prisma.$transaction((tx) =>
      deleteCrmLeadsCascade(tx, {
        empresaId: access.empresaId,
        leadIds: deletable.map((lead) => lead.id),
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        deleted,
        skipped: leads.length - deletable.length,
      },
    })
  } catch (error) {
    console.error('Error eliminando leads CRM:', error)
    return NextResponse.json({ error: 'Error eliminando leads CRM' }, { status: 500 })
  }
}
