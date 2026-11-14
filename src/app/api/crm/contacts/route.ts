import { NextResponse } from 'next/server'
import { AccessLevel, type CrmContactStatus, type Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'
import { buildCrmScopeWhere, resolveCrmRequestScope } from '@/lib/crm-scope'
import { normalizeContactEmail, normalizePhoneForStorage } from '@/lib/crm-contact-identity'

export const runtime = 'nodejs'

const CONTACT_STATUSES: CrmContactStatus[] = ['ACTIVE', 'INACTIVE', 'DO_NOT_CONTACT']

function parseInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(normalizeString(value), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

async function resolveContactTarget(args: {
  empresaId: string
  leadId?: string
  clienteId?: string
}) {
  const leadId = normalizeString(args.leadId)
  const clienteId = normalizeString(args.clienteId)

  if (leadId && clienteId) {
    return { error: 'leadId y clienteId no pueden enviarse juntos', status: 400 as const }
  }

  if (leadId) {
    const lead = await prisma.crmLead.findUnique({
      where: { id: leadId },
      select: { id: true, empresaId: true, sedeId: true, nombre: true },
    })
    if (!lead || lead.empresaId !== args.empresaId) {
      return { error: 'leadId inválido', status: 400 as const }
    }
    return { lead, cliente: null, sedeId: lead.sedeId }
  }

  if (clienteId) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, empresaId: true, sedeId: true, nombre: true },
    })
    if (!cliente || cliente.empresaId !== args.empresaId) {
      return { error: 'clienteId inválido', status: 400 as const }
    }
    return { lead: null, cliente, sedeId: cliente.sedeId }
  }

  return { lead: null, cliente: null, sedeId: null }
}

export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CONTACTS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const leadId = normalizeString(searchParams.get('leadId'))
    const clienteId = normalizeString(searchParams.get('clienteId'))
    const search = normalizeString(searchParams.get('search') ?? searchParams.get('q'))
    const statusFilter = normalizeString(searchParams.get('status')).toUpperCase() as CrmContactStatus
    const ownerUserId = normalizeString(searchParams.get('ownerUserId'))
    const sedeId = normalizeString(searchParams.get('sedeId'))
    const hasLead = normalizeString(searchParams.get('hasLead'))
    const page = parseInteger(searchParams.get('page'), 1, 1, 100000)
    const pageSize = parseInteger(searchParams.get('pageSize'), 25, 1, 100)

    const target = await resolveContactTarget({ empresaId: access.empresaId, leadId, clienteId })
    if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status })

    if (target.sedeId) {
      const denied = await assertCrmSedeAccess({
        sedeId: target.sedeId,
        empresaId: access.empresaId,
        userId: access.userId,
        minLevel: AccessLevel.READ,
      })
      if (denied) return denied
    }

    // Modo compatibilidad: contactos de un lead o cliente (sin paginar).
    if (leadId || clienteId) {
      const rows = await prisma.crmContact.findMany({
        where: {
          empresaId: access.empresaId,
          ...(leadId ? { leadId } : {}),
          ...(clienteId ? { clienteId } : {}),
          ...(search
            ? {
                OR: [
                  { nombre: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                  { telefono: { contains: search, mode: 'insensitive' } },
                  { celular: { contains: search, mode: 'insensitive' } },
                  { cargo: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          lead: { select: { id: true, nombre: true } },
          cliente: { select: { id: true, nombre: true, documento: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      })

      return NextResponse.json({ success: true, data: rows })
    }

    const scope = await resolveCrmRequestScope(access, { subdomain: 'CONTACTS', action: 'READ' })
    const and: Prisma.CrmContactWhereInput[] = [
      { empresaId: access.empresaId },
      { mergedIntoId: null },
      buildCrmScopeWhere(scope, 'contact') as Prisma.CrmContactWhereInput,
    ]

    if (search) {
      and.push({
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { apellido: { contains: search, mode: 'insensitive' } },
          { empresaNombre: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { documento: { contains: search, mode: 'insensitive' } },
        ],
      })
    }
    if (CONTACT_STATUSES.includes(statusFilter)) and.push({ status: statusFilter })
    if (ownerUserId) and.push({ ownerUserId })
    if (sedeId) and.push({ sedeId })
    if (hasLead === '1') and.push({ leads: { some: {} } })
    if (hasLead === '0') and.push({ leads: { none: {} } })

    const where: Prisma.CrmContactWhereInput = { AND: and }

    const [total, rows, grouped] = await Promise.all([
      prisma.crmContact.count({ where }),
      prisma.crmContact.findMany({
        where,
        orderBy: [{ lastInteractionAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
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
          sourceKey: true,
          sourceLabel: true,
          ownerUserId: true,
          lastInteractionAt: true,
          createdAt: true,
          isPrimary: true,
          ownerUser: { select: { id: true, name: true, email: true } },
          _count: { select: { leads: true, captures: true, conversations: true, opportunities: true } },
        },
      }),
      prisma.crmContact.groupBy({ by: ['status'], where, _count: { _all: true } }),
    ])

    const byStatus: Record<string, number> = { ACTIVE: 0, INACTIVE: 0, DO_NOT_CONTACT: 0 }
    for (const row of grouped) byStatus[row.status] = row._count._all

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      facets: { byStatus, all: total, scope: scope.level },
    })
  } catch (error) {
    console.error('Error listando contactos CRM:', error)
    return NextResponse.json({ error: 'Error listando contactos CRM' }, { status: 500 })
  }
}


export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CONTACTS',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const nombre = normalizeString(body?.nombre)
    const apellido = normalizeString(body?.apellido)
    const email = normalizeString(body?.email)
    const telefono = normalizeString(body?.telefono)
    const celular = normalizeString(body?.celular)
    const cargo = normalizeString(body?.cargo)
    const notes = normalizeString(body?.notes)
    const empresaNombre = normalizeString(body?.empresaNombre)
    const documento = normalizeString(body?.documento)
    const ciudad = normalizeString(body?.ciudad)
    const departamento = normalizeString(body?.departamento)
    const pais = normalizeString(body?.pais)
    const sitioWeb = normalizeString(body?.sitioWeb)
    const sourceKey = normalizeString(body?.sourceKey)
    const sourceLabel = normalizeString(body?.sourceLabel)
    const sedeId = normalizeString(body?.sedeId)
    const ownerUserId = normalizeString(body?.ownerUserId)
    const isPrimary = Boolean(body?.isPrimary)
    const leadId = normalizeString(body?.leadId)
    const clienteId = normalizeString(body?.clienteId)
    const tags = Array.isArray(body?.tags)
      ? Array.from(new Set(body.tags.map((item) => normalizeString(item)).filter(Boolean)))
      : []

    if (!nombre && !email && !telefono && !celular) {
      return NextResponse.json({ error: 'Se requiere nombre, email o teléfono' }, { status: 400 })
    }

    const target = await resolveContactTarget({ empresaId: access.empresaId, leadId, clienteId })
    if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status })

    if (target.sedeId) {
      const denied = await assertCrmSedeAccess({
        sedeId: target.sedeId,
        empresaId: access.empresaId,
        userId: access.userId,
        minLevel: AccessLevel.WRITE,
      })
      if (denied) return denied
    }

    if (sedeId) {
      const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
      if (!sede || sede.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'sedeId inválido' }, { status: 400 })
      }
    }

    if (ownerUserId) {
      const owner = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { empresaId: true } })
      if (!owner || owner.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'ownerUserId inválido' }, { status: 400 })
      }
    }

    const emailNormalized = normalizeContactEmail(email) || null
    if (emailNormalized) {
      const duplicate = await prisma.crmContact.findFirst({
        where: { empresaId: access.empresaId, emailNormalized },
        select: { id: true, nombre: true },
      })
      if (duplicate) {
        return NextResponse.json(
          {
            error: `Ya existe un contacto con ese correo: ${duplicate.nombre}`,
            duplicateContactId: duplicate.id,
          },
          { status: 409 }
        )
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.crmContact.updateMany({
          where: {
            empresaId: access.empresaId,
            ...(leadId ? { leadId } : {}),
            ...(clienteId ? { clienteId } : {}),
          },
          data: { isPrimary: false },
        })
      }

      return tx.crmContact.create({
        data: {
          empresaId: access.empresaId,
          sedeId: sedeId || target.sedeId || null,
          leadId: target.lead?.id || null,
          clienteId: target.cliente?.id || null,
          nombre: nombre || email || telefono || 'Contacto sin nombre',
          apellido: apellido || null,
          email: email || null,
          emailNormalized,
          telefono: telefono || null,
          celular: celular || null,
          phoneNormalized: normalizePhoneForStorage(celular || telefono) || null,
          cargo: cargo || null,
          notes: notes || null,
          empresaNombre: empresaNombre || null,
          documento: documento || null,
          ciudad: ciudad || null,
          departamento: departamento || null,
          pais: pais || null,
          sitioWeb: sitioWeb || null,
          tags,
          sourceKey: sourceKey || 'MANUAL',
          sourceLabel: sourceLabel || 'Contacto manual',
          ownerUserId: ownerUserId || null,
          isPrimary,
          createdById: access.userId,
        },
        include: {
          lead: { select: { id: true, nombre: true } },
          cliente: { select: { id: true, nombre: true, documento: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      })
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creando contacto CRM:', error)
    return NextResponse.json({ error: 'Error creando contacto CRM' }, { status: 500 })
  }
}

