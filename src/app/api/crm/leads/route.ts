import { NextResponse } from 'next/server'
import { CrmLeadSource, CrmLeadStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { getBridgeKindFromSettings, getCrmOriginMeta } from '@/lib/crm-origin'
import { syncCrmLeadFollowUpTaskById } from '@/lib/crm-follow-up'

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
    conditions.push({ telefono: telefono })
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

async function assertLeadCapabilityAccess(args: {
  sedeId: string
  empresaId: string
  action: 'READ' | 'CREATE'
}) {
  const sede = await prisma.sede.findUnique({ where: { id: args.sedeId }, select: { id: true, empresaId: true } })
  if (!sede || sede.empresaId !== args.empresaId) {
    return NextResponse.json({ error: 'sedeId inválido' }, { status: 400 })
  }

  const access = await requireCapabilityAccess({
    domain: 'CAPTACION',
    subdomain: 'LEADS',
    action: args.action,
    scope: 'SEDE',
    sedeId: sede.id,
    allowLegacyFallback: false,
  })

  return access.ok ? null : access.response
}

export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'LEADS',
      action: 'READ',
      scope: 'SEDE',
      allowLegacyFallback: false,
    })
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = normalizeString(searchParams.get('search'))
    const sedeId = normalizeString(searchParams.get('sedeId'))
    const ownerUserId = normalizeString(searchParams.get('ownerUserId'))
    const status = parseLeadStatus(searchParams.get('status'))

    if (sedeId) {
      const denied = await assertLeadCapabilityAccess({ sedeId, empresaId: access.empresaId, action: 'READ' })
      if (denied) return denied
    }

    const leads = await prisma.crmLead.findMany({
      where: {
        empresaId: access.empresaId,
        ...(sedeId ? { sedeId } : {}),
        ...(ownerUserId ? { ownerUserId } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { nombre: { contains: search, mode: 'insensitive' } },
                { empresaNombre: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { documento: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastActivityAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        sede: { select: { id: true, nombre: true, codigo: true } },
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

    const data = leads.map((lead) => {
      const latestConversation = lead.conversations[0]
      const origin = getCrmOriginMeta({
        provider: latestConversation?.channelConnection.provider,
        bridgeKind: getBridgeKindFromSettings(latestConversation?.channelConnection.settingsJson),
        source: lead.source,
      })

      return {
        ...lead,
        originKey: origin.key,
        originLabel: origin.label,
      }
    })

    return NextResponse.json({ success: true, data })
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
      allowLegacyFallback: false,
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const nombre = normalizeString(body?.nombre)
    const sedeId = normalizeString(body?.sedeId)
    const ownerUserId = normalizeString(body?.ownerUserId)
    const status = parseLeadStatus(body?.status) ?? 'NEW'
    const source = parseLeadSource(body?.source) ?? 'OTRO'
    const documento = normalizeString(body?.documento)
    const email = normalizeString(body?.email).toLowerCase()
    const telefono = normalizePhone(body?.telefono)
    const celular = normalizePhone(body?.celular)

    if (!nombre) {
      return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
    }

    const conflictingLead = await findConflictingLead({
      empresaId: access.empresaId,
      documento,
      email,
      telefono: telefono || celular,
    })
    if (conflictingLead) {
      return NextResponse.json({ error: `Ya existe un prospecto similar: ${conflictingLead.nombre}` }, { status: 409 })
    }

    if (sedeId) {
      const denied = await assertLeadCapabilityAccess({ sedeId, empresaId: access.empresaId, action: 'CREATE' })
      if (denied) return denied
    }

    if (ownerUserId) {
      const owner = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { id: true, empresaId: true } })
      if (!owner || owner.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'ownerUserId inválido' }, { status: 400 })
      }
    }

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.crmLead.create({
        data: {
          empresaId: access.empresaId,
          sedeId: sedeId || null,
          status,
          source,
          nombre,
          empresaNombre: normalizeString(body?.empresaNombre) || null,
          documento: documento || null,
          email: email || null,
          telefono: telefono || null,
          celular: celular || null,
          direccion: normalizeString(body?.direccion) || null,
          ciudad: normalizeString(body?.ciudad) || null,
          tags: parseTags(body?.tags),
          notes: normalizeString(body?.notes) || null,
          ownerUserId: ownerUserId || null,
          createdById: access.userId,
        },
        include: {
          sede: { select: { id: true, nombre: true, codigo: true } },
          ownerUser: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      })

      await syncCrmLeadFollowUpTaskById({
        client: tx,
        empresaId: access.empresaId,
        actorUserId: access.userId,
        leadId: created.id,
      })

      return created
    })

    return NextResponse.json({ success: true, data: lead }, { status: 201 })
  } catch (error) {
    console.error('Error al crear lead CRM:', error)
    return NextResponse.json({ error: 'Error al crear lead CRM' }, { status: 500 })
  }
}