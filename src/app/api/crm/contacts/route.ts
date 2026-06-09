import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'

export const runtime = 'nodejs'

async function resolveContactTarget(args: {
  empresaId: string
  leadId?: string
  clienteId?: string
}) {
  const leadId = normalizeString(args.leadId)
  const clienteId = normalizeString(args.clienteId)

  if ((leadId ? 1 : 0) + (clienteId ? 1 : 0) !== 1) {
    return { error: 'leadId o clienteId es requerido, pero no ambos', status: 400 as const }
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

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, empresaId: true, sedeId: true, nombre: true },
  })
  if (!cliente || cliente.empresaId !== args.empresaId) {
    return { error: 'clienteId inválido', status: 400 as const }
  }
  return { lead: null, cliente, sedeId: cliente.sedeId }
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
    const search = normalizeString(searchParams.get('search'))
    const target = await resolveContactTarget({ empresaId: access.empresaId, leadId, clienteId })
    if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status })

    if (target.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: target.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

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
    const email = normalizeString(body?.email)
    const telefono = normalizeString(body?.telefono)
    const celular = normalizeString(body?.celular)
    const cargo = normalizeString(body?.cargo)
    const notes = normalizeString(body?.notes)
    const isPrimary = Boolean(body?.isPrimary)
    const leadId = normalizeString(body?.leadId)
    const clienteId = normalizeString(body?.clienteId)

    if (!nombre) return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })

    const target = await resolveContactTarget({ empresaId: access.empresaId, leadId, clienteId })
    if ('error' in target) return NextResponse.json({ error: target.error }, { status: target.status })

    if (target.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: target.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
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
          sedeId: target.sedeId || null,
          leadId: target.lead?.id || null,
          clienteId: target.cliente?.id || null,
          nombre,
          email: email || null,
          telefono: telefono || null,
          celular: celular || null,
          cargo: cargo || null,
          notes: notes || null,
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