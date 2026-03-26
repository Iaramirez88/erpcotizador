import { NextResponse } from 'next/server'
import { AccessLevel, CrmLeadSource, CrmLeadStatus, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { getBridgeKindFromSettings, getCrmOriginMeta } from '@/lib/crm-origin'
import { requireSedeAccess } from '@/lib/rbac'

export const runtime = 'nodejs'

const CRM_LEAD_STATUSES: CrmLeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'LOST', 'CONVERTED']
const CRM_LEAD_SOURCES: CrmLeadSource[] = ['WEB', 'REFERIDO', 'WHATSAPP', 'LLAMADA', 'IMPORT', 'OTRO']

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function parseLeadStatus(value: unknown): CrmLeadStatus | null {
  const raw = normalizeString(value).toUpperCase() as CrmLeadStatus
  return CRM_LEAD_STATUSES.includes(raw) ? raw : null
}

function parseLeadSource(value: unknown): CrmLeadSource | null {
  const raw = normalizeString(value).toUpperCase() as CrmLeadSource
  return CRM_LEAD_SOURCES.includes(raw) ? raw : null
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => normalizeString(item)).filter(Boolean)))
}

async function ensureLeadAccess(args: {
  leadId: string
  empresaId: string
  userId: string
  minLevel: AccessLevel
}) {
  const lead = await prisma.crmLead.findUnique({
    where: { id: args.leadId },
    include: {
      sede: { select: { id: true, empresaId: true, nombre: true, codigo: true } },
      ownerUser: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      convertedCliente: { select: { id: true, nombre: true, documento: true } },
      conversations: {
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: 1,
        select: {
          channelConnection: {
            select: { provider: true, settingsJson: true },
          },
        },
      },
      _count: { select: { opportunities: true, activities: true, tasks: true } },
    },
  })

  if (!lead || lead.empresaId !== args.empresaId) {
    return { response: NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 }) }
  }

  if (lead.sedeId) {
    try {
      await requireSedeAccess({ userId: args.userId, sedeId: lead.sedeId, module: ModuleKey.CRM, minLevel: args.minLevel })
    } catch (error) {
      if (error instanceof Error && error.message === 'FORBIDDEN') {
        return { response: NextResponse.json({ error: 'Prohibido' }, { status: 403 }) }
      }
      throw error
    }
  }

  return { lead }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const { id } = await context.params
    const result = await ensureLeadAccess({ leadId: id, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
    if ('response' in result) return result.response

    const latestConversation = result.lead.conversations[0]
    const origin = getCrmOriginMeta({
      provider: latestConversation?.channelConnection.provider,
      bridgeKind: getBridgeKindFromSettings(latestConversation?.channelConnection.settingsJson),
      source: result.lead.source,
    })

    return NextResponse.json({ success: true, data: { ...result.lead, originKey: origin.key, originLabel: origin.label } })
  } catch (error) {
    console.error('Error al obtener lead CRM:', error)
    return NextResponse.json({ error: 'Error al obtener lead CRM' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const result = await ensureLeadAccess({ leadId: id, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
    if ('response' in result) return result.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const nextSedeId = normalizeString(body?.sedeId)
    const nextOwnerUserId = normalizeString(body?.ownerUserId)
    const nombre = normalizeString(body?.nombre)
    const status = Object.prototype.hasOwnProperty.call(body ?? {}, 'status') ? parseLeadStatus(body?.status) : undefined
    const source = Object.prototype.hasOwnProperty.call(body ?? {}, 'source') ? parseLeadSource(body?.source) : undefined

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'status') && !status) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'source') && !source) {
      return NextResponse.json({ error: 'source inválido' }, { status: 400 })
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'sedeId') && nextSedeId) {
      const sede = await prisma.sede.findUnique({ where: { id: nextSedeId }, select: { id: true, empresaId: true } })
      if (!sede || sede.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'sedeId inválido' }, { status: 400 })
      }
      try {
        await requireSedeAccess({ userId: access.userId, sedeId: sede.id, module: ModuleKey.CRM, minLevel: AccessLevel.WRITE })
      } catch (error) {
        if (error instanceof Error && error.message === 'FORBIDDEN') {
          return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
        }
        throw error
      }
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'ownerUserId') && nextOwnerUserId) {
      const owner = await prisma.user.findUnique({ where: { id: nextOwnerUserId }, select: { id: true, empresaId: true } })
      if (!owner || owner.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'ownerUserId inválido' }, { status: 400 })
      }
    }

    const lead = await prisma.crmLead.update({
      where: { id },
      data: {
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'nombre') ? { nombre: nombre || result.lead.nombre } : {}),
        ...(status ? { status } : {}),
        ...(source ? { source } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'empresaNombre') ? { empresaNombre: normalizeString(body?.empresaNombre) || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'documento') ? { documento: normalizeString(body?.documento) || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'email') ? { email: normalizeString(body?.email) || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'telefono') ? { telefono: normalizeString(body?.telefono) || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'celular') ? { celular: normalizeString(body?.celular) || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'direccion') ? { direccion: normalizeString(body?.direccion) || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'ciudad') ? { ciudad: normalizeString(body?.ciudad) || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'notes') ? { notes: normalizeString(body?.notes) || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'tags') ? { tags: parseTags(body?.tags) } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'sedeId') ? { sedeId: nextSedeId || null } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'ownerUserId') ? { ownerUserId: nextOwnerUserId || null } : {}),
      },
      include: {
        sede: { select: { id: true, nombre: true, codigo: true } },
        ownerUser: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        convertedCliente: { select: { id: true, nombre: true, documento: true } },
        _count: { select: { opportunities: true, activities: true, tasks: true } },
      },
    })

    return NextResponse.json({ success: true, data: lead })
  } catch (error) {
    console.error('Error al actualizar lead CRM:', error)
    return NextResponse.json({ error: 'Error al actualizar lead CRM' }, { status: 500 })
  }
}