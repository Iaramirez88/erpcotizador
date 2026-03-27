import { NextRequest, NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess } from '@/lib/crm'
import { linkCrmEntryToEntity, listCrmLinkedEntries, unlinkCrmEntryFromEntity, type CrmFileEntityType } from '@/lib/crm-files'
import { prisma } from '@/lib/prisma'

function parseEntityType(value: unknown): CrmFileEntityType | null {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return raw === 'TASK' || raw === 'LEAD' || raw === 'OPPORTUNITY' ? raw : null
}

async function validateEntityAccess(args: {
  entityType: CrmFileEntityType
  entityId: string
  empresaId: string
  userId: string
  minLevel: AccessLevel
}) {
  if (args.entityType === 'TASK') {
    const task = await prisma.crmTask.findUnique({ where: { id: args.entityId }, select: { id: true, empresaId: true, sedeId: true } })
    if (!task || task.empresaId !== args.empresaId) {
      return NextResponse.json({ success: false, error: 'La tarea indicada no existe.' }, { status: 404 })
    }
    if (task.sedeId) {
      const accessResponse = await assertCrmSedeAccess({ sedeId: task.sedeId, empresaId: args.empresaId, userId: args.userId, minLevel: args.minLevel })
      if (accessResponse) return accessResponse
    }
    return null
  }

  if (args.entityType === 'LEAD') {
    const lead = await prisma.crmLead.findUnique({ where: { id: args.entityId }, select: { id: true, empresaId: true, sedeId: true } })
    if (!lead || lead.empresaId !== args.empresaId) {
      return NextResponse.json({ success: false, error: 'El lead indicado no existe.' }, { status: 404 })
    }
    if (lead.sedeId) {
      const accessResponse = await assertCrmSedeAccess({ sedeId: lead.sedeId, empresaId: args.empresaId, userId: args.userId, minLevel: args.minLevel })
      if (accessResponse) return accessResponse
    }
    return null
  }

  const opportunity = await prisma.crmOpportunity.findUnique({ where: { id: args.entityId }, select: { id: true, empresaId: true, sedeId: true } })
  if (!opportunity || opportunity.empresaId !== args.empresaId) {
    return NextResponse.json({ success: false, error: 'La oportunidad indicada no existe.' }, { status: 404 })
  }
  if (opportunity.sedeId) {
    const accessResponse = await assertCrmSedeAccess({ sedeId: opportunity.sedeId, empresaId: args.empresaId, userId: args.userId, minLevel: args.minLevel })
    if (accessResponse) return accessResponse
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const entityType = parseEntityType(request.nextUrl.searchParams.get('entityType'))
    const entityId = String(request.nextUrl.searchParams.get('entityId') || '').trim()
    if (!entityType || !entityId) {
      return NextResponse.json({ success: false, error: 'Indica entityType y entityId.' }, { status: 400 })
    }

    const accessResponse = await validateEntityAccess({ entityType, entityId, empresaId: access.empresaId, userId: access.userId, minLevel: 'READ' })
    if (accessResponse) return accessResponse

    const items = await listCrmLinkedEntries({ empresaId: access.empresaId, entityType, entityId, currentUserId: access.userId })
    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: detail }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as { entityType?: unknown; entityId?: unknown; path?: unknown } | null
    const entityType = parseEntityType(body?.entityType)
    const entityId = String(body?.entityId || '').trim()
    const entryPath = String(body?.path || '').trim()
    if (!entityType || !entityId || !entryPath) {
      return NextResponse.json({ success: false, error: 'Indica entityType, entityId y path.' }, { status: 400 })
    }

    const accessResponse = await validateEntityAccess({ entityType, entityId, empresaId: access.empresaId, userId: access.userId, minLevel: 'WRITE' })
    if (accessResponse) return accessResponse

    const item = await linkCrmEntryToEntity({
      empresaId: access.empresaId,
      entityType,
      entityId,
      entryPath,
      actor: { userId: access.userId, label: access.session.user.name || access.session.user.email || 'Usuario interno' },
    })
    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: detail }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as { entityType?: unknown; entityId?: unknown; path?: unknown } | null
    const entityType = parseEntityType(body?.entityType)
    const entityId = String(body?.entityId || '').trim()
    const entryPath = String(body?.path || '').trim()
    if (!entityType || !entityId || !entryPath) {
      return NextResponse.json({ success: false, error: 'Indica entityType, entityId y path.' }, { status: 400 })
    }

    const accessResponse = await validateEntityAccess({ entityType, entityId, empresaId: access.empresaId, userId: access.userId, minLevel: 'WRITE' })
    if (accessResponse) return accessResponse

    const item = await unlinkCrmEntryFromEntity({
      empresaId: access.empresaId,
      entityType,
      entityId,
      entryPath,
      actor: { userId: access.userId, label: access.session.user.name || access.session.user.email || 'Usuario interno' },
    })
    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: detail }, { status: 400 })
  }
}