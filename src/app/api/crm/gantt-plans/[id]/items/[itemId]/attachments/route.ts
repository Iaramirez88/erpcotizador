import fs from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getGanttPlanAccess } from '@/lib/gantt-plan-access'
import { normalizeTaskAttachments, type TaskAttachment } from '@/lib/crm-task-workspaces'
import { requireWorkspaceTaskCapability } from '@/lib/task-workspace-api-access'

export const runtime = 'nodejs'
const MAX_BYTES = 12 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
type Context = { params: Promise<{ id: string; itemId: string }> }

function safeName(value: string) {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'evidencia'
}

async function accessibleItem(planId: string, itemId: string, empresaId: string, userId: string, permission: 'comment' | 'edit' = 'comment') {
  const access = await getGanttPlanAccess(planId, empresaId, userId)
  if (!access || (permission === 'edit' ? !access.canEdit : !access.canComment)) return null
  return prisma.crmGanttItem.findFirst({ where: { id: itemId, planId }, select: { id: true, attachmentsJson: true } })
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const access = await requireWorkspaceTaskCapability({ action: 'READ', scope: 'SEDE' })
    if (!access.ok) return access.response
    const { id, itemId } = await context.params
    const item = await accessibleItem(id, itemId, access.empresaId, access.userId)
    if (!item) return NextResponse.json({ error: 'No tienes permisos para adjuntar evidencias.' }, { status: 403 })
    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Selecciona una imagen.' }, { status: 400 })
    if (!IMAGE_TYPES.has(file.type)) return NextResponse.json({ error: 'Usa una imagen JPG, PNG, WEBP o GIF.' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'La imagen supera el límite de 12 MB.' }, { status: 400 })
    const extension = path.extname(file.name).toLowerCase() || `.${file.type.split('/')[1] || 'jpg'}`
    const directory = path.join(process.cwd(), 'public', 'uploads', 'crm-gantt', itemId)
    await fs.mkdir(directory, { recursive: true })
    const filename = `${Date.now()}-${safeName(path.basename(file.name, path.extname(file.name)))}${extension}`
    await fs.writeFile(path.join(directory, filename), Buffer.from(await file.arrayBuffer()))
    const attachment: TaskAttachment = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: file.name, url: `/uploads/crm-gantt/${itemId}/${filename}`, type: 'image', mimeType: file.type, sizeBytes: file.size, uploadedAt: new Date().toISOString(), provider: 'UPLOAD', externalId: null }
    const attachments = [...normalizeTaskAttachments(item.attachmentsJson), attachment]
    await prisma.crmGanttItem.update({ where: { id: itemId }, data: { attachmentsJson: attachments as unknown as Prisma.InputJsonValue } })
    return NextResponse.json({ success: true, data: attachment }, { status: 201 })
  } catch (error) {
    console.error('Error adjuntando evidencia Gantt:', error)
    return NextResponse.json({ error: 'No se pudo guardar la evidencia.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const access = await requireWorkspaceTaskCapability({ action: 'READ', scope: 'SEDE' })
  if (!access.ok) return access.response
  const { id, itemId } = await context.params
  const item = await accessibleItem(id, itemId, access.empresaId, access.userId, 'edit')
  if (!item) return NextResponse.json({ error: 'No tienes permisos para eliminar evidencias.' }, { status: 403 })
  const attachmentId = new URL(request.url).searchParams.get('attachmentId') || ''
  const current = normalizeTaskAttachments(item.attachmentsJson)
  const removed = current.find((attachment) => attachment.id === attachmentId)
  const attachments = current.filter((attachment) => attachment.id !== attachmentId)
  await prisma.crmGanttItem.update({ where: { id: itemId }, data: { attachmentsJson: attachments as unknown as Prisma.InputJsonValue } })
  if (removed?.provider === 'UPLOAD' && removed.url.startsWith(`/uploads/crm-gantt/${itemId}/`)) {
    await fs.unlink(path.join(process.cwd(), 'public', removed.url.replace(/^\//, ''))).catch(() => undefined)
  }
  return NextResponse.json({ success: true })
}