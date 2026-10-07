import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { getGanttPlanAccess } from '@/lib/gantt-plan-access'
import { requireWorkspaceTaskCapability } from '@/lib/task-workspace-api-access'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

const memberSelect = { id: true, userId: true, role: true, user: { select: { id: true, name: true, email: true, image: true } } } as const

export async function GET(_request: Request, context: Context) {
  const access = await requireWorkspaceTaskCapability({ action: 'READ', scope: 'SEDE' })
  if (!access.ok) return access.response
  const { id } = await context.params
  const planAccess = await getGanttPlanAccess(id, access.empresaId, access.userId)
  if (!planAccess?.canView) return NextResponse.json({ error: 'Plan Gantt no encontrado.' }, { status: 404 })
  const [members, users] = await Promise.all([
    prisma.crmGanttPlanMember.findMany({ where: { planId: id }, orderBy: { createdAt: 'asc' }, select: memberSelect }),
    prisma.user.findMany({ where: { empresaId: access.empresaId }, orderBy: [{ name: 'asc' }, { email: 'asc' }], select: { id: true, name: true, email: true, image: true } }),
  ])
  return NextResponse.json({ success: true, data: { members, users, canManage: planAccess.canEdit, currentUserId: access.userId } })
}

export async function POST(request: Request, context: Context) {
  const access = await requireWorkspaceTaskCapability({ action: 'UPDATE', scope: 'SEDE' })
  if (!access.ok) return access.response
  const { id } = await context.params
  const planAccess = await getGanttPlanAccess(id, access.empresaId, access.userId)
  if (!planAccess?.canEdit) return NextResponse.json({ error: 'No tienes permisos para invitar colaboradores.' }, { status: 403 })
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const userId = normalizeString(body?.userId)
  const user = await prisma.user.findFirst({ where: { id: userId, empresaId: access.empresaId }, select: { id: true } })
  if (!user || user.id === access.userId) return NextResponse.json({ error: 'Selecciona otro usuario de la empresa.' }, { status: 400 })
  const member = await prisma.crmGanttPlanMember.upsert({ where: { planId_userId: { planId: id, userId } }, update: { role: 'COMMENTER' }, create: { empresaId: access.empresaId, planId: id, userId, role: 'COMMENTER' }, select: memberSelect })
  return NextResponse.json({ success: true, data: member }, { status: 201 })
}

export async function DELETE(request: Request, context: Context) {
  const access = await requireWorkspaceTaskCapability({ action: 'UPDATE', scope: 'SEDE' })
  if (!access.ok) return access.response
  const { id } = await context.params
  const planAccess = await getGanttPlanAccess(id, access.empresaId, access.userId)
  if (!planAccess?.canEdit) return NextResponse.json({ error: 'No tienes permisos para retirar colaboradores.' }, { status: 403 })
  const userId = normalizeString(new URL(request.url).searchParams.get('userId'))
  await prisma.$transaction([
    prisma.crmGanttItemAssignment.deleteMany({ where: { userId, item: { planId: id } } }),
    prisma.crmGanttPlanMember.deleteMany({ where: { planId: id, userId } }),
  ])
  return NextResponse.json({ success: true })
}