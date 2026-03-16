import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  assertCrmSedeAccess,
  normalizeString,
  parseOptionalDate,
  parseTaskPriority,
  parseTaskStatus,
} from '@/lib/crm'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = normalizeString(searchParams.get('search'))
    const leadId = normalizeString(searchParams.get('leadId'))
    const opportunityId = normalizeString(searchParams.get('opportunityId'))
    const clienteId = normalizeString(searchParams.get('clienteId'))
    const assignedToUserId = normalizeString(searchParams.get('assignedToUserId'))
    const sedeId = normalizeString(searchParams.get('sedeId'))
    const status = parseTaskStatus(searchParams.get('status'))

    if (sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    const rows = await prisma.crmTask.findMany({
      where: {
        empresaId: access.empresaId,
        ...(leadId ? { leadId } : {}),
        ...(opportunityId ? { opportunityId } : {}),
        ...(clienteId ? { clienteId } : {}),
        ...(assignedToUserId ? { assignedToUserId } : {}),
        ...(sedeId ? { sedeId } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { lead: { nombre: { contains: search, mode: 'insensitive' } } },
                { opportunity: { title: { contains: search, mode: 'insensitive' } } },
                { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, nombre: true } },
        opportunity: { select: { id: true, title: true, stage: true } },
        cliente: { select: { id: true, nombre: true, documento: true } },
      },
    })

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('Error listando tareas CRM:', error)
    return NextResponse.json({ error: 'Error listando tareas CRM' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const title = normalizeString(body?.title)
    const description = normalizeString(body?.description)
    const leadId = normalizeString(body?.leadId)
    const opportunityId = normalizeString(body?.opportunityId)
    const clienteId = normalizeString(body?.clienteId)
    const assignedToUserId = normalizeString(body?.assignedToUserId)
    const explicitSedeId = normalizeString(body?.sedeId)
    const status = parseTaskStatus(body?.status) ?? 'OPEN'
    const priority = parseTaskPriority(body?.priority) ?? 'NORMAL'
    const dueAt = parseOptionalDate(body?.dueAt)

    if (!title) return NextResponse.json({ error: 'title es requerido' }, { status: 400 })
    if (!leadId && !opportunityId && !clienteId) {
      return NextResponse.json({ error: 'leadId, opportunityId o clienteId es requerido' }, { status: 400 })
    }
    if (dueAt === undefined) return NextResponse.json({ error: 'dueAt inválido' }, { status: 400 })

    const lead = leadId
      ? await prisma.crmLead.findUnique({ where: { id: leadId }, select: { id: true, empresaId: true, sedeId: true } })
      : null
    if (leadId && (!lead || lead.empresaId !== access.empresaId)) {
      return NextResponse.json({ error: 'leadId inválido' }, { status: 400 })
    }

    const opportunity = opportunityId
      ? await prisma.crmOpportunity.findUnique({ where: { id: opportunityId }, select: { id: true, empresaId: true, sedeId: true, leadId: true, clienteId: true } })
      : null
    if (opportunityId && (!opportunity || opportunity.empresaId !== access.empresaId)) {
      return NextResponse.json({ error: 'opportunityId inválido' }, { status: 400 })
    }

    const cliente = clienteId
      ? await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, empresaId: true, sedeId: true } })
      : null
    if (clienteId && (!cliente || cliente.empresaId !== access.empresaId)) {
      return NextResponse.json({ error: 'clienteId inválido' }, { status: 400 })
    }

    if (assignedToUserId) {
      const user = await prisma.user.findUnique({ where: { id: assignedToUserId }, select: { id: true, empresaId: true } })
      if (!user || user.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'assignedToUserId inválido' }, { status: 400 })
      }
    }

    const finalSedeId = explicitSedeId || lead?.sedeId || opportunity?.sedeId || cliente?.sedeId || ''
    if (finalSedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: finalSedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const row = await prisma.crmTask.create({
      data: {
        empresaId: access.empresaId,
        sedeId: finalSedeId || null,
        title,
        description: description || null,
        status,
        priority,
        dueAt: dueAt ?? null,
        leadId: leadId || opportunity?.leadId || null,
        opportunityId: opportunityId || null,
        clienteId: clienteId || opportunity?.clienteId || null,
        assignedToUserId: assignedToUserId || null,
        createdById: access.userId,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, nombre: true } },
        opportunity: { select: { id: true, title: true, stage: true } },
        cliente: { select: { id: true, nombre: true, documento: true } },
      },
    })

    return NextResponse.json({ success: true, data: row }, { status: 201 })
  } catch (error) {
    console.error('Error creando tarea CRM:', error)
    return NextResponse.json({ error: 'Error creando tarea CRM' }, { status: 500 })
  }
}