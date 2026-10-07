import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { getGanttPlanAccess } from '@/lib/gantt-plan-access'
import { requireWorkspaceTaskCapability } from '@/lib/task-workspace-api-access'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string; itemId: string }> }

const userSelect = { id: true, name: true, email: true, image: true } as const

async function itemExists(planId: string, itemId: string) {
  return prisma.crmGanttItem.findFirst({ where: { id: itemId, planId }, select: { id: true, title: true, attachmentsJson: true } })
}

export async function GET(_request: Request, context: Context) {
  const access = await requireWorkspaceTaskCapability({ action: 'READ', scope: 'SEDE' })
  if (!access.ok) return access.response
  const { id, itemId } = await context.params
  const planAccess = await getGanttPlanAccess(id, access.empresaId, access.userId)
  if (!planAccess?.canView) return NextResponse.json({ error: 'Actividad no encontrada.' }, { status: 404 })
  const item = await itemExists(id, itemId)
  if (!item) return NextResponse.json({ error: 'Actividad no encontrada.' }, { status: 404 })
  await prisma.crmGanttItemRead.upsert({ where: { itemId_userId: { itemId, userId: access.userId } }, update: { lastReadAt: new Date() }, create: { itemId, userId: access.userId } })
  const [comments, assignments, plan] = await Promise.all([
    prisma.crmGanttItemComment.findMany({ where: { itemId }, orderBy: { createdAt: 'asc' }, include: { author: { select: userSelect } } }),
    prisma.crmGanttItemAssignment.findMany({ where: { itemId }, orderBy: { createdAt: 'asc' }, include: { user: { select: userSelect } } }),
    prisma.crmGanttPlan.findUnique({ where: { id }, select: { createdBy: { select: userSelect }, members: { include: { user: { select: userSelect } } } } }),
  ])
  const availableUsers = [plan?.createdBy, ...(plan?.members.map((member) => member.user) || [])].filter((user): user is NonNullable<typeof user> => Boolean(user)).filter((user, index, all) => all.findIndex((candidate) => candidate.id === user.id) === index)
  return NextResponse.json({ success: true, data: { comments: comments.map((comment) => ({ ...comment, isCurrentUser: comment.authorUserId === access.userId })), assignments, attachments: item.attachmentsJson, availableUsers, canComment: planAccess.canComment, canEdit: planAccess.canEdit } })
}

export async function POST(request: Request, context: Context) {
  const access = await requireWorkspaceTaskCapability({ action: 'READ', scope: 'SEDE' })
  if (!access.ok) return access.response
  const { id, itemId } = await context.params
  const planAccess = await getGanttPlanAccess(id, access.empresaId, access.userId)
  if (!planAccess?.canComment || !await itemExists(id, itemId)) return NextResponse.json({ error: 'No tienes permisos para comentar.' }, { status: 403 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const message = normalizeString(body?.message).slice(0, 10_000)
  if (!message) return NextResponse.json({ error: 'Escribe una nota.' }, { status: 400 })
  const comment = await prisma.crmGanttItemComment.create({ data: { itemId, authorUserId: access.userId, message }, include: { author: { select: userSelect } } })
  await prisma.crmGanttItemRead.upsert({ where: { itemId_userId: { itemId, userId: access.userId } }, update: { lastReadAt: new Date() }, create: { itemId, userId: access.userId } })
  return NextResponse.json({ success: true, data: { ...comment, isCurrentUser: true } }, { status: 201 })
}

export async function PATCH(request: Request, context: Context) {
  const access = await requireWorkspaceTaskCapability({ action: 'UPDATE', scope: 'SEDE' })
  if (!access.ok) return access.response
  const { id, itemId } = await context.params
  const planAccess = await getGanttPlanAccess(id, access.empresaId, access.userId)
  if (!planAccess?.canEdit || !await itemExists(id, itemId)) return NextResponse.json({ error: 'No tienes permisos para asignar colaboradores.' }, { status: 403 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const requested = Array.isArray(body?.userIds) ? [...new Set(body.userIds.map(normalizeString).filter(Boolean))] : []
  const allowed = await prisma.crmGanttPlan.findUnique({ where: { id }, select: { createdById: true, members: { select: { userId: true } } } })
  const allowedIds = new Set([allowed?.createdById || '', ...(allowed?.members.map((member) => member.userId) || [])])
  const userIds = requested.filter((userId) => allowedIds.has(userId))
  await prisma.$transaction(async (tx) => {
    await tx.crmGanttItemAssignment.deleteMany({ where: { itemId } })
    if (userIds.length) await tx.crmGanttItemAssignment.createMany({ data: userIds.map((userId) => ({ itemId, userId })) })
  })
  const assignments = await prisma.crmGanttItemAssignment.findMany({ where: { itemId }, orderBy: { createdAt: 'asc' }, include: { user: { select: userSelect } } })
  return NextResponse.json({ success: true, data: assignments })
}