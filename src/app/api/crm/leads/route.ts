import { NextResponse } from 'next/server'
import type { CrmLeadLifecycleStatus, CrmLeadScoreBand, CrmLeadSource, CrmLeadStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { getCrmOriginMeta } from '@/lib/crm-origin'
import { normalizeString } from '@/lib/crm'
import { buildCrmScopeWhere, resolveCrmRequestScope } from '@/lib/crm-scope'
import { ensureLeadCaptureIdentity, recordLeadCapture } from '@/lib/crm-lead-capture'

export const runtime = 'nodejs'

const CRM_LEAD_STATUSES: CrmLeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'LOST', 'CONVERTED']
const CRM_LEAD_SOURCES: CrmLeadSource[] = [
  'WEB',
  'REFERIDO',
  'WHATSAPP',
  'LLAMADA',
  'IMPORT',
  'OTRO',
  'GOOGLE_ADS',
  'META_ADS',
  'LANDING_PAGE',
  'API',
  'EVENTO',
  'ORGANICO',
]
const LIFECYCLE_STATUSES: CrmLeadLifecycleStatus[] = [
  'NEW',
  'PENDING_REVIEW',
  'NURTURING',
  'QUALIFIED',
  'SALES_ASSIGNED',
  'CONVERTED',
  'DISCARDED',
  'DO_NOT_CONTACT',
]
const SCORE_BANDS: CrmLeadScoreBand[] = ['COLD', 'WARM', 'HOT']

const VIEW_STATUSES: Record<string, CrmLeadLifecycleStatus[]> = {
  new: ['NEW'],
  pending: ['NEW', 'PENDING_REVIEW'],
  nurturing: ['NURTURING'],
  qualified: ['QUALIFIED'],
  assigned: ['SALES_ASSIGNED'],
  converted: ['CONVERTED'],
  discarded: ['DISCARDED'],
  do_not_contact: ['DO_NOT_CONTACT'],
}

function parseList(value: string | null): string[] {
  return normalizeString(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseDate(value: string | null): Date | null {
  const raw = normalizeString(value)
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseInteger(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(normalizeString(value), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function normalizePhone(value: unknown): string {
  return normalizeString(value).replace(/[^\d]+/g, '')
}

function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map((item) => normalizeString(item)).filter(Boolean)))
}

async function assertSedeInCompany(sedeId: string, empresaId: string) {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { id: true, empresaId: true } })
  return Boolean(sede && sede.empresaId === empresaId)
}


export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'LEADS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const scope = await resolveCrmRequestScope(access, { subdomain: 'LEADS', action: 'READ' })

    const page = parseInteger(searchParams.get('page'), 1, 1, 100000)
    const pageSize = parseInteger(searchParams.get('pageSize'), 25, 1, 100)
    const q = normalizeString(searchParams.get('q') ?? searchParams.get('search'))
    const view = normalizeString(searchParams.get('view')).toLowerCase()
    const lifecycleStatuses = parseList(searchParams.get('lifecycleStatus'))
      .map((item) => item.toUpperCase() as CrmLeadLifecycleStatus)
      .filter((item) => LIFECYCLE_STATUSES.includes(item))
    const statuses = parseList(searchParams.get('status'))
      .map((item) => item.toUpperCase() as CrmLeadStatus)
      .filter((item) => CRM_LEAD_STATUSES.includes(item))
    const sources = parseList(searchParams.get('source'))
      .map((item) => item.toUpperCase() as CrmLeadSource)
      .filter((item) => CRM_LEAD_SOURCES.includes(item))
    const scoreBands = parseList(searchParams.get('scoreBand'))
      .map((item) => item.toUpperCase() as CrmLeadScoreBand)
      .filter((item) => SCORE_BANDS.includes(item))

    const sourceKey = normalizeString(searchParams.get('sourceKey'))
    const formId = normalizeString(searchParams.get('formId'))
    const campaignName = normalizeString(searchParams.get('campaignName'))
    const serviceInterest = normalizeString(searchParams.get('serviceInterest'))
    const ownerUserId = normalizeString(searchParams.get('ownerUserId'))
    const sedeId = normalizeString(searchParams.get('sedeId'))
    const unassigned = normalizeString(searchParams.get('unassigned')) === '1'
    const minScore = Number.parseInt(normalizeString(searchParams.get('minScore')), 10)
    const createdFrom = parseDate(searchParams.get('createdFrom'))
    const createdTo = parseDate(searchParams.get('createdTo'))
    const lastActivityFrom = parseDate(searchParams.get('lastActivityFrom'))
    const lastActivityTo = parseDate(searchParams.get('lastActivityTo'))

    const sortKey = normalizeString(searchParams.get('sort')) || 'lastActivityAt'
    const sortDir: Prisma.SortOrder = normalizeString(searchParams.get('dir')) === 'asc' ? 'asc' : 'desc'

    if (sedeId && !(await assertSedeInCompany(sedeId, access.empresaId))) {
      return NextResponse.json({ error: 'sedeId inválido' }, { status: 400 })
    }

    const baseAnd: Prisma.CrmLeadWhereInput[] = [
      { empresaId: access.empresaId },
      buildCrmScopeWhere(scope, 'lead') as Prisma.CrmLeadWhereInput,
    ]

    if (q) {
      baseAnd.push({
        OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { empresaNombre: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { documento: { contains: q, mode: 'insensitive' } },
        ],
      })
    }
    if (statuses.length) baseAnd.push({ status: { in: statuses } })
    if (sources.length) baseAnd.push({ source: { in: sources } })
    if (sourceKey) baseAnd.push({ sourceKey })
    if (formId) baseAnd.push({ formId })
    if (campaignName) baseAnd.push({ campaignName: { contains: campaignName, mode: 'insensitive' } })
    if (serviceInterest) baseAnd.push({ serviceInterest: { contains: serviceInterest, mode: 'insensitive' } })
    if (ownerUserId) baseAnd.push({ ownerUserId })
    if (sedeId) baseAnd.push({ sedeId })
    if (Number.isFinite(minScore)) baseAnd.push({ score: { gte: minScore } })
    if (scoreBands.length) baseAnd.push({ scoreBand: { in: scoreBands } })
    if (createdFrom) baseAnd.push({ createdAt: { gte: createdFrom } })
    if (createdTo) baseAnd.push({ createdAt: { lte: createdTo } })
    if (lastActivityFrom) baseAnd.push({ lastActivityAt: { gte: lastActivityFrom } })
    if (lastActivityTo) baseAnd.push({ lastActivityAt: { lte: lastActivityTo } })
    if (unassigned) baseAnd.push({ ownerUserId: null })

    const lifecycleFilter =
      lifecycleStatuses.length > 0
        ? lifecycleStatuses
        : view && VIEW_STATUSES[view]
          ? VIEW_STATUSES[view]
          : null

    const and = [...baseAnd]
    if (lifecycleFilter) and.push({ lifecycleStatus: { in: lifecycleFilter } })

    const where: Prisma.CrmLeadWhereInput = { AND: and }
    const baseWhere: Prisma.CrmLeadWhereInput = { AND: baseAnd }

    const orderBy: Prisma.CrmLeadOrderByWithRelationInput[] =
      sortKey === 'score'
        ? [{ score: sortDir }, { createdAt: 'desc' }]
        : sortKey === 'createdAt'
          ? [{ createdAt: sortDir }]
          : sortKey === 'lastCaptureAt'
            ? [{ lastCaptureAt: { sort: sortDir, nulls: 'last' } }, { createdAt: 'desc' }]
            : sortKey === 'nombre'
              ? [{ nombre: sortDir }]
              : [{ lastActivityAt: { sort: sortDir, nulls: 'last' } }, { createdAt: 'desc' }]

    const [total, rows, grouped, unassignedCount] = await Promise.all([
      prisma.crmLead.count({ where }),
      prisma.crmLead.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          nombre: true,
          empresaNombre: true,
          email: true,
          telefono: true,
          celular: true,
          status: true,
          source: true,
          sourceKey: true,
          sourceLabel: true,
          lifecycleStatus: true,
          score: true,
          scoreBand: true,
          serviceInterest: true,
          campaignName: true,
          formName: true,
          ownerUserId: true,
          sedeId: true,
          contactId: true,
          assignedAt: true,
          createdAt: true,
          lastActivityAt: true,
          lastCaptureAt: true,
          ownerUser: { select: { id: true, name: true, email: true } },
          contact: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true, celular: true } },
          _count: { select: { captures: true, conversations: true, opportunities: true, tasks: true } },
        },
      }),
      prisma.crmLead.groupBy({
        by: ['lifecycleStatus'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.crmLead.count({ where: { AND: [...baseAnd, { ownerUserId: null }] } }),
    ])

    const data = rows.map((lead) => {
      const origin = getCrmOriginMeta({ source: lead.source })
      return {
        ...lead,
        originKey: lead.sourceKey || origin.key,
        originLabel: lead.sourceLabel || origin.label,
      }
    })

    const byStatus: Record<string, number> = {}
    for (const status of LIFECYCLE_STATUSES) byStatus[status] = 0
    for (const row of grouped) byStatus[row.lifecycleStatus] = row._count._all

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      facets: {
        byStatus,
        all: Object.values(byStatus).reduce((sum, value) => sum + value, 0),
        unassigned: unassignedCount,
        scope: scope.level,
      },
    })
  } catch (error) {
    console.error('Error al listar leads CRM:', error)
    return NextResponse.json({ error: 'Error al listar leads CRM' }, { status: 500 })
  }
}


export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'LEADS',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const nombre = normalizeString(body?.nombre)
    const empresaNombre = normalizeString(body?.empresaNombre)
    const email = normalizeString(body?.email).toLowerCase()
    const phone = normalizePhone(body?.telefono || body?.celular)
    const document = normalizeString(body?.documento)
    const ciudad = normalizeString(body?.ciudad)
    const notes = normalizeString(body?.notes)
    const sedeId = normalizeString(body?.sedeId)
    const ownerUserId = normalizeString(body?.ownerUserId)
    const channelConnectionId = normalizeString(body?.channelConnectionId)
    const sourceRaw = normalizeString(body?.source).toUpperCase() as CrmLeadSource
    const source = CRM_LEAD_SOURCES.includes(sourceRaw) ? sourceRaw : 'OTRO'
    const tags = parseTags(body?.tags)
    const serviceInterest = normalizeString(body?.serviceInterest)
    const formId = normalizeString(body?.formId)
    const formName = normalizeString(body?.formName)
    const campaignName = normalizeString(body?.campaignName)

    if (!nombre && !email && !phone) {
      return NextResponse.json({ error: 'Se requiere nombre, email o teléfono' }, { status: 400 })
    }

    if (sedeId && !(await assertSedeInCompany(sedeId, access.empresaId))) {
      return NextResponse.json({ error: 'sedeId inválido' }, { status: 400 })
    }

    if (ownerUserId) {
      const owner = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { id: true, empresaId: true } })
      if (!owner || owner.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'ownerUserId inválido' }, { status: 400 })
      }
    }

    if (channelConnectionId) {
      const channel = await prisma.crmChannelConnection.findFirst({
        where: { id: channelConnectionId, empresaId: access.empresaId },
        select: { id: true },
      })
      if (!channel) {
        return NextResponse.json({ error: 'channelConnectionId inválido' }, { status: 400 })
      }
    }

    const eventAt = new Date()
    const origin = {
      sourceKey: 'MANUAL',
      sourceLabel: 'Captura manual',
      serviceInterest: serviceInterest || null,
      formId: formId || null,
      formName: formName || null,
      campaignName: campaignName || null,
    }

    const result = await prisma.$transaction(async (tx) => {
      if (channelConnectionId) {
        return recordLeadCapture({
          client: tx,
          empresaId: access.empresaId,
          sedeId: sedeId || null,
          createdById: access.userId,
          ownerUserId: ownerUserId || null,
          channelConnectionId,
          captureType: 'MANUAL_IMPORT',
          activityType: 'NOTE',
          eventAt,
          nombre,
          empresaNombre,
          email,
          phone,
          document,
          ciudad,
          messageText: notes,
          tags,
          source,
          origin,
          rawPayloadJson: (body ?? {}) as Prisma.InputJsonValue,
          normalizedDataJson: {
            nombre,
            empresaNombre,
            email,
            phone,
            document,
            ciudad,
            notes,
            serviceInterest,
            formId,
            formName,
            campaignName,
          } as Prisma.InputJsonValue,
        })
      }

      const identity = await ensureLeadCaptureIdentity({
        client: tx,
        empresaId: access.empresaId,
        sedeId: sedeId || null,
        createdById: access.userId,
        ownerUserId: ownerUserId || null,
        nombre,
        empresaNombre,
        email,
        phone,
        document,
        ciudad,
        notes,
        tags,
        source,
        origin,
        eventAt,
      })

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: sedeId || null,
          type: 'NOTE',
          summary: 'Lead creado manualmente',
          details: notes || null,
          leadId: identity.lead.id,
          contactId: identity.contact.id,
          occurredAt: eventAt,
          eventKey: `manual:${identity.lead.id}:${eventAt.getTime()}`,
          createdById: access.userId,
        },
      })

      return identity
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          lead: result.lead,
          contact: result.contact,
          capture: 'capture' in result ? result.capture : null,
          dedupe: { lead: result.leadDedupe, contact: result.contactDedupe },
          assignment: 'assignment' in result ? result.assignment : null,
          score: result.lead.score,
          scoreBand: result.lead.scoreBand,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error al crear lead CRM:', error)
    return NextResponse.json({ error: 'Error al crear lead CRM' }, { status: 500 })
  }
}

