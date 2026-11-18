import { NextResponse } from 'next/server'
import { CrmLeadSource, CrmLeadStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { getBridgeKindFromSettings, getCrmOriginMeta } from '@/lib/crm-origin'
import { syncCrmLeadFollowUpTaskById } from '@/lib/crm-follow-up'
import { canAccessCrmRecord, resolveCrmRequestScope } from '@/lib/crm-scope'
import { loadLeadTimeline } from '@/lib/crm-timeline'
import {
  CrmLifecycleError,
  applyLeadLifecycleTransition,
  parseCrmLifecycleStatus,
} from '@/lib/crm-lifecycle'

async function assertLeadCapabilityAccess(args: {
  sedeId: string
  empresaId: string
  action: 'READ' | 'UPDATE'
}) {
  const sede = await prisma.sede.findUnique({ where: { id: args.sedeId }, select: { id: true, empresaId: true } })
  if (!sede || sede.empresaId !== args.empresaId) {
    return { response: NextResponse.json({ error: 'sedeId inválido' }, { status: 400 }) }
  }

  const access = await requireCapabilityAccess({
    domain: 'CAPTACION',
    subdomain: 'LEADS',
    action: args.action,
    scope: 'SEDE',
    sedeId: sede.id,
  })

  return access.ok ? null : { response: access.response }
}

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

function normalizePhone(value: unknown): string {
  return normalizeString(value).replace(/[^\d]+/g, '')
}

async function findConflictingLead(args: {
  empresaId: string
  documento?: string | null
  email?: string | null
  telefono?: string | null
  excludeLeadId?: string | null
}) {
  const documento = normalizeString(args.documento)
  const email = normalizeString(args.email).toLowerCase()
  const telefono = normalizePhone(args.telefono)
  const conditions: Array<Record<string, unknown>> = []

  if (documento) conditions.push({ documento })
  if (email) conditions.push({ email })
  if (telefono) {
    conditions.push({ telefono })
    conditions.push({ celular: telefono })
    if (telefono.length >= 8) {
      const suffix = telefono.slice(-10)
      conditions.push({ telefono: { endsWith: suffix } })
      conditions.push({ celular: { endsWith: suffix } })
    }
  }

  if (!conditions.length) return null

  return prisma.crmLead.findFirst({
    where: {
      empresaId: args.empresaId,
      ...(args.excludeLeadId ? { id: { not: args.excludeLeadId } } : {}),
      OR: conditions,
    },
    select: {
      id: true,
      nombre: true,
      documento: true,
      email: true,
      telefono: true,
      celular: true,
      status: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  })
}

async function ensureLeadAccess(args: {
  leadId: string
  empresaId: string
  action: 'READ' | 'UPDATE'
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
    const denied = await assertLeadCapabilityAccess({ sedeId: lead.sedeId, empresaId: args.empresaId, action: args.action })
    if (denied) return denied
  }

  return { lead }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'LEADS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const result = await ensureLeadAccess({ leadId: id, empresaId: access.empresaId, action: 'READ' })
    if ('response' in result) return result.response

    const scope = await resolveCrmRequestScope(access, { subdomain: 'LEADS', action: 'READ' })
    if (!canAccessCrmRecord(scope, 'lead', result.lead)) {
      return NextResponse.json({ error: 'Sin acceso a este lead' }, { status: 403 })
    }

    const latestConversation = result.lead.conversations[0]
    const origin = getCrmOriginMeta({
      provider: latestConversation?.channelConnection.provider,
      bridgeKind: getBridgeKindFromSettings(latestConversation?.channelConnection.settingsJson),
      source: result.lead.source,
    })

    const [detail, timeline] = await Promise.all([
      prisma.crmLead.findUnique({
        where: { id },
        select: {
          contact: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              email: true,
              telefono: true,
              celular: true,
              empresaNombre: true,
              documento: true,
              ciudad: true,
              status: true,
              consents: { select: { channel: true, status: true, source: true, grantedAt: true, revokedAt: true } },
            },
          },
          captures: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              captureType: true,
              formName: true,
              campaignName: true,
              serviceInterest: true,
              resourceLabel: true,
              isFirstTouch: true,
              scoreDelta: true,
              createdAt: true,
              channelConnection: { select: { name: true, provider: true } },
            },
          },
          scoreEvents: {
            orderBy: { occurredAt: 'desc' },
            take: 20,
            select: { id: true, eventType: true, points: true, dedupeKey: true, occurredAt: true },
          },
          opportunities: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { id: true, title: true, stage: true, expectedValue: true, createdAt: true, wonAt: true, lostAt: true },
          },
          tasks: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { id: true, title: true, status: true, dueAt: true, completedAt: true },
          },
          conversations: {
            orderBy: { lastMessageAt: 'desc' },
            take: 10,
            select: {
              id: true,
              status: true,
              firstInboundAt: true,
              lastMessageAt: true,
              directionLastMessage: true,
              channelConnection: { select: { name: true, provider: true } },
            },
          },
          sequenceEnrollments: {
            orderBy: { startedAt: 'desc' },
            take: 5,
            select: {
              id: true,
              status: true,
              currentStepOrder: true,
              nextRunAt: true,
              stoppedReason: true,
              sequence: { select: { id: true, name: true, status: true } },
            },
          },
        },
      }),
      loadLeadTimeline({
        client: prisma,
        empresaId: access.empresaId,
        leadId: id,
        contactId: result.lead.contactId,
        limit: 60,
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        ...result.lead,
        originKey: origin.key,
        originLabel: origin.label,
        detail,
        timeline,
        scope: scope.level,
      },
    })
  } catch (error) {
    console.error('Error al obtener lead CRM:', error)
    return NextResponse.json({ error: 'Error al obtener lead CRM' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'LEADS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const result = await ensureLeadAccess({ leadId: id, empresaId: access.empresaId, action: 'UPDATE' })
    if ('response' in result) return result.response

    const scope = await resolveCrmRequestScope(access, { subdomain: 'LEADS', action: 'UPDATE' })
    if (!canAccessCrmRecord(scope, 'lead', result.lead)) {
      return NextResponse.json({ error: 'Sin acceso a este lead' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const hasLifecycleStatus = Object.prototype.hasOwnProperty.call(body ?? {}, 'lifecycleStatus')
    const requestedLifecycle = hasLifecycleStatus ? parseCrmLifecycleStatus(body?.lifecycleStatus) : null

    if (hasLifecycleStatus && !requestedLifecycle) {
      return NextResponse.json({ error: 'lifecycleStatus inválido' }, { status: 400 })
    }

    if (requestedLifecycle) {
      try {
        const transitioned = await applyLeadLifecycleTransition({
          client: prisma,
          empresaId: access.empresaId,
          leadId: id,
          nextStatus: requestedLifecycle,
          actorUserId: access.userId,
          reason: normalizeString(body?.discardReason ?? body?.reason) || null,
        })

        return NextResponse.json({ success: true, data: transitioned })
      } catch (error) {
        if (error instanceof CrmLifecycleError) {
          return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.code === 'lead-not-found' ? 404 : 409 }
          )
        }
        throw error
      }
    }

    const nextSedeId = normalizeString(body?.sedeId)
    const nextOwnerUserId = normalizeString(body?.ownerUserId)
    const nombre = normalizeString(body?.nombre)
    const nextDocumento = Object.prototype.hasOwnProperty.call(body ?? {}, 'documento') ? normalizeString(body?.documento) : result.lead.documento || ''
    const nextEmail = Object.prototype.hasOwnProperty.call(body ?? {}, 'email') ? normalizeString(body?.email).toLowerCase() : result.lead.email || ''
    const nextTelefono = Object.prototype.hasOwnProperty.call(body ?? {}, 'telefono') ? normalizePhone(body?.telefono) : normalizePhone(result.lead.telefono)
    const nextCelular = Object.prototype.hasOwnProperty.call(body ?? {}, 'celular') ? normalizePhone(body?.celular) : normalizePhone(result.lead.celular)
    const status = Object.prototype.hasOwnProperty.call(body ?? {}, 'status') ? parseLeadStatus(body?.status) : undefined
    const source = Object.prototype.hasOwnProperty.call(body ?? {}, 'source') ? parseLeadSource(body?.source) : undefined

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'status') && !status) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'source') && !source) {
      return NextResponse.json({ error: 'source inválido' }, { status: 400 })
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'sedeId') && nextSedeId) {
      const denied = await assertLeadCapabilityAccess({ sedeId: nextSedeId, empresaId: access.empresaId, action: 'UPDATE' })
      if (denied) return denied.response
    }

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'ownerUserId') && nextOwnerUserId) {
      const owner = await prisma.user.findUnique({ where: { id: nextOwnerUserId }, select: { id: true, empresaId: true } })
      if (!owner || owner.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'ownerUserId inválido' }, { status: 400 })
      }
    }

    const conflictingLead = await findConflictingLead({
      empresaId: access.empresaId,
      documento: nextDocumento,
      email: nextEmail,
      telefono: nextTelefono || nextCelular,
      excludeLeadId: id,
    })
    if (conflictingLead) {
      return NextResponse.json({ error: `Ya existe un prospecto similar: ${conflictingLead.nombre}` }, { status: 409 })
    }

    const lead = await prisma.$transaction(async (tx) => {
      const updated = await tx.crmLead.update({
        where: { id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'nombre') ? { nombre: nombre || result.lead.nombre } : {}),
          ...(status ? { status } : {}),
          ...(source ? { source } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'empresaNombre') ? { empresaNombre: normalizeString(body?.empresaNombre) || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'documento') ? { documento: nextDocumento || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'email') ? { email: nextEmail || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'telefono') ? { telefono: nextTelefono || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'celular') ? { celular: nextCelular || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'direccion') ? { direccion: normalizeString(body?.direccion) || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'ciudad') ? { ciudad: normalizeString(body?.ciudad) || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'notes') ? { notes: normalizeString(body?.notes) || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'tags') ? { tags: parseTags(body?.tags) } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'serviceInterest')
            ? { serviceInterest: normalizeString(body?.serviceInterest) || null }
            : {}),
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

      await syncCrmLeadFollowUpTaskById({
        client: tx,
        empresaId: access.empresaId,
        actorUserId: access.userId,
        leadId: updated.id,
      })

      return updated
    })

    return NextResponse.json({ success: true, data: lead })
  } catch (error) {
    console.error('Error al actualizar lead CRM:', error)
    return NextResponse.json({ error: 'Error al actualizar lead CRM' }, { status: 500 })
  }
}