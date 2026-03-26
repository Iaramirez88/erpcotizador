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

async function assertSedeAccess(args: { sedeId: string; empresaId: string; userId: string; minLevel: AccessLevel }) {
  const sede = await prisma.sede.findUnique({ where: { id: args.sedeId }, select: { id: true, empresaId: true } })
  if (!sede || sede.empresaId !== args.empresaId) {
    return NextResponse.json({ error: 'sedeId inválido' }, { status: 400 })
  }

  try {
    await requireSedeAccess({ userId: args.userId, sedeId: sede.id, module: ModuleKey.CRM, minLevel: args.minLevel })
    return null
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
    }
    throw error
  }
}

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = normalizeString(searchParams.get('search'))
    const sedeId = normalizeString(searchParams.get('sedeId'))
    const ownerUserId = normalizeString(searchParams.get('ownerUserId'))
    const status = parseLeadStatus(searchParams.get('status'))

    if (sedeId) {
      const denied = await assertSedeAccess({ sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
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
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const nombre = normalizeString(body?.nombre)
    const sedeId = normalizeString(body?.sedeId)
    const ownerUserId = normalizeString(body?.ownerUserId)
    const status = parseLeadStatus(body?.status) ?? 'NEW'
    const source = parseLeadSource(body?.source) ?? 'OTRO'

    if (!nombre) {
      return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
    }

    if (sedeId) {
      const denied = await assertSedeAccess({ sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    if (ownerUserId) {
      const owner = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { id: true, empresaId: true } })
      if (!owner || owner.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'ownerUserId inválido' }, { status: 400 })
      }
    }

    const lead = await prisma.crmLead.create({
      data: {
        empresaId: access.empresaId,
        sedeId: sedeId || null,
        status,
        source,
        nombre,
        empresaNombre: normalizeString(body?.empresaNombre) || null,
        documento: normalizeString(body?.documento) || null,
        email: normalizeString(body?.email) || null,
        telefono: normalizeString(body?.telefono) || null,
        celular: normalizeString(body?.celular) || null,
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

    return NextResponse.json({ success: true, data: lead }, { status: 201 })
  } catch (error) {
    console.error('Error al crear lead CRM:', error)
    return NextResponse.json({ error: 'Error al crear lead CRM' }, { status: 500 })
  }
}