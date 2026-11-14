import { NextResponse } from 'next/server'
import type { CrmLead } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess, type ApiCapabilityAccessOk } from '@/lib/api-rbac'
import { canAccessCrmRecord, resolveCrmRequestScope, type CrmRecordScope } from '@/lib/crm-scope'
import type { RbacV2CapabilityAction } from '@/lib/rbac-v2-catalog'

/**
 * Puerta única para rutas de detalle/acción sobre un lead:
 * capability + empresa + alcance por registro.
 */
export type CrmLeadAccessResult =
  | { ok: true; access: ApiCapabilityAccessOk; scope: CrmRecordScope; lead: CrmLead }
  | { ok: false; response: NextResponse }

export async function requireCrmLeadAccess(args: {
  leadId: string
  action: Extract<RbacV2CapabilityAction, 'READ' | 'UPDATE' | 'ASSIGN' | 'DELETE'>
}): Promise<CrmLeadAccessResult> {
  const access = await requireCapabilityAccess({
    domain: 'CAPTACION',
    subdomain: 'LEADS',
    action: args.action,
    scope: 'SEDE',
    allowLegacyFallback: false,
  })
  if (!access.ok) return { ok: false, response: access.response }

  const lead = await prisma.crmLead.findUnique({ where: { id: args.leadId } })
  if (!lead || lead.empresaId !== access.empresaId) {
    return { ok: false, response: NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 }) }
  }

  const scope = await resolveCrmRequestScope(access, { subdomain: 'LEADS', action: args.action })
  if (!canAccessCrmRecord(scope, 'lead', lead)) {
    return { ok: false, response: NextResponse.json({ error: 'Sin acceso a este lead' }, { status: 403 }) }
  }

  return { ok: true, access, scope, lead }
}
