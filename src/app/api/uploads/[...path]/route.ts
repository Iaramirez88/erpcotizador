import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess } from '@/lib/crm'
import { canUserAccessWorkspace, getAccessibleTaskWorkspace } from '@/lib/crm-task-workspaces'
import { getCrmFileItemByPath, getCrmFilesRootAbsolutePath } from '@/lib/crm-files'
import { requireWorkspaceTaskCapability } from '@/lib/task-workspace-api-access'

export const runtime = 'nodejs'

function contentTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    case '.pdf':
      return 'application/pdf'
    case '.txt':
      return 'text/plain; charset=utf-8'
    case '.csv':
      return 'text/csv; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.ogg':
      return 'audio/ogg'
    case '.m4a':
      return 'audio/mp4'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    case '.doc':
      return 'application/msword'
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case '.xls':
      return 'application/vnd.ms-excel'
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case '.ppt':
      return 'application/vnd.ms-powerpoint'
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    case '.zip':
      return 'application/zip'
    default:
      return 'application/octet-stream'
  }
}

function isSafePathSegment(seg: string): boolean {
  if (!seg) return false
  if (seg === '.' || seg === '..') return false
  if (seg.includes('\\')) return false
  if (seg.includes('\u0000')) return false
  return true
}

async function resolveProtectedUploadPath(parts: string[]) {
  if (parts[0] === 'crm-tasks' && parts[1] && parts.length >= 3) {
    const access = await requireWorkspaceTaskCapability({ action: 'READ', scope: 'SEDE' })
    if (!access.ok) return access.response

    const task = await prisma.crmTask.findUnique({
      where: { id: parts[1] },
      include: { workspace: true },
    })

    if (!task || task.empresaId !== access.empresaId) {
      return new NextResponse('Not found', { status: 404, headers: { 'X-SG-Uploads': 'api' } })
    }

    if (task.workspaceId) {
      const workspace = await getAccessibleTaskWorkspace(prisma, {
        workspaceId: task.workspaceId,
        empresaId: access.empresaId,
        userId: access.userId,
      })
      if (!workspace || !canUserAccessWorkspace(workspace, access.userId, 'view')) {
        return new NextResponse('Forbidden', { status: 403, headers: { 'X-SG-Uploads': 'api' } })
      }
    }

    if (task.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: task.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    return path.join(process.cwd(), 'public', 'uploads', ...parts)
  }

  if (parts[0] === 'internal-chat' && parts[1] && parts.length >= 3) {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const thread = await prisma.internalChatThread.findUnique({
      where: { id: parts[1] },
      include: { participants: true },
    })

    if (!thread || thread.empresaId !== access.empresaId) {
      return new NextResponse('Not found', { status: 404, headers: { 'X-SG-Uploads': 'api' } })
    }

    const canAccess = thread.participants.some((participant) => participant.userId === access.userId)
    if (!canAccess) {
      return new NextResponse('Forbidden', { status: 403, headers: { 'X-SG-Uploads': 'api' } })
    }

    return path.join(process.cwd(), 'public', 'uploads', ...parts)
  }

  if (parts[0] === 'crm-files' && parts[1] && parts.length >= 3) {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const empresaId = parts[1]
    if (empresaId !== access.empresaId) {
      return new NextResponse('Not found', { status: 404, headers: { 'X-SG-Uploads': 'api' } })
    }

    const entryPath = parts.slice(2).join('/')
    try {
      const item = await getCrmFileItemByPath({ empresaId, entryPath, currentUserId: access.userId })
      if (item.type === 'folder') {
        return new NextResponse('Not found', { status: 404, headers: { 'X-SG-Uploads': 'api' } })
      }
    } catch {
      return new NextResponse('Forbidden', { status: 403, headers: { 'X-SG-Uploads': 'api' } })
    }

    return path.join(getCrmFilesRootAbsolutePath(empresaId), ...parts.slice(2))
  }

  if (parts[0] === 'odontologia' && parts[1] && parts.length >= 3) {
    const access = await requireApiAccess(ModuleKey.CLIENTES, 'READ')
    if (!access.ok) return access.response

    const empresaId = parts[1]
    if (empresaId !== access.empresaId) {
      return new NextResponse('Not found', { status: 404, headers: { 'X-SG-Uploads': 'api' } })
    }

    return path.join(process.cwd(), 'public', 'uploads', ...parts)
  }

  return null
}

async function serve(parts: string[]) {
  if (!Array.isArray(parts) || parts.length === 0 || !parts.every((p) => isSafePathSegment(p))) {
    return new NextResponse('Not found', { status: 404, headers: { 'X-SG-Uploads': 'api' } })
  }

  const protectedPathOrResponse = await resolveProtectedUploadPath(parts)
  if (protectedPathOrResponse instanceof NextResponse) return protectedPathOrResponse

  const isProtected = typeof protectedPathOrResponse === 'string'
  const absPath = protectedPathOrResponse || path.join(process.cwd(), 'public', 'uploads', ...parts)

  try {
    const bytes = await fs.readFile(absPath)
    const ext = path.extname(absPath)

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentTypeFromExt(ext),
        'Cache-Control': isProtected ? 'private, no-store' : 'public, max-age=31536000, immutable',
        'X-SG-Uploads': 'api',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404, headers: { 'X-SG-Uploads': 'api' } })
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params
  return serve(parts)
}

export async function HEAD(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params
  const resp = await serve(parts)
  return new NextResponse(null, { status: resp.status, headers: resp.headers })
}
