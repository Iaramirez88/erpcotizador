import { NextRequest, NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { createCrmFolder, deleteCrmEntry, getCrmFilesSnapshot, moveCrmEntry, renameCrmEntry, updateCrmEntrySharing, uploadCrmFiles } from '@/lib/crm-files'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'FILES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const pathParam = request.nextUrl.searchParams.get('path')
    const bypassAccessControl = access.isSystemSuperAdmin || access.membershipRole === 'ADMIN'
    const snapshot = await getCrmFilesSnapshot({ empresaId: access.empresaId, currentPath: pathParam, currentUserId: access.userId, bypassAccessControl })
    return NextResponse.json({ success: true, data: snapshot })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: detail }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'FILES',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData().catch(() => null)
      if (!form) {
        return NextResponse.json({ success: false, error: 'Body inválido para upload.' }, { status: 400 })
      }

      const currentPath = String(form.get('path') || '')
      const allFiles = form
        .getAll('files')
        .filter((item): item is File => item instanceof File)

      if (!allFiles.length) {
        const single = form.get('file')
        if (single instanceof File) allFiles.push(single)
      }

      if (!allFiles.length) {
        return NextResponse.json({ success: false, error: 'Adjunta al menos un archivo.' }, { status: 400 })
      }

      const uploaded = await uploadCrmFiles({
        empresaId: access.empresaId,
        currentPath,
        currentUserId: access.userId,
        actor: { userId: access.userId, label: access.session.user.name || access.session.user.email || 'Usuario interno' },
        files: await Promise.all(allFiles.map(async (file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          bytes: Buffer.from(await file.arrayBuffer()),
        }))),
      })

      return NextResponse.json({ success: true, data: uploaded })
    }

    const body = (await request.json().catch(() => null)) as { action?: string; path?: string; name?: string; sharedWithUserIds?: string[] } | null
    if (body?.action !== 'create-folder') {
      return NextResponse.json({ success: false, error: 'Acción no soportada.' }, { status: 400 })
    }

    const folder = await createCrmFolder({
      empresaId: access.empresaId,
      currentPath: body.path,
      currentUserId: access.userId,
      name: String(body.name || ''),
      sharedWithUserIds: Array.isArray(body.sharedWithUserIds) ? body.sharedWithUserIds.map((item) => String(item || '')) : [],
      actor: { userId: access.userId, label: access.session.user.name || access.session.user.email || 'Usuario interno' },
    })
    return NextResponse.json({ success: true, data: folder })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: detail }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'FILES',
      action: 'DELETE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as { path?: string } | null
    const targetPath = String(body?.path || '')
    if (!targetPath.trim()) {
      return NextResponse.json({ success: false, error: 'Indica el archivo o carpeta a eliminar.' }, { status: 400 })
    }

    const result = await deleteCrmEntry({ empresaId: access.empresaId, entryPath: targetPath, currentUserId: access.userId })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: detail }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'FILES',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as {
      action?: string
      path?: string
      newName?: string
      targetDirectoryPath?: string
      sharedWithUserIds?: string[]
    } | null

    const targetPath = String(body?.path || '')
    if (!targetPath.trim()) {
      return NextResponse.json({ success: false, error: 'Indica el archivo o carpeta a modificar.' }, { status: 400 })
    }

    if (body?.action === 'rename') {
      const renamed = await renameCrmEntry({
        empresaId: access.empresaId,
        entryPath: targetPath,
        currentUserId: access.userId,
        newName: String(body.newName || ''),
        actor: { userId: access.userId, label: access.session.user.name || access.session.user.email || 'Usuario interno' },
      })
      return NextResponse.json({ success: true, data: renamed })
    }

    if (body?.action === 'move') {
      const moved = await moveCrmEntry({
        empresaId: access.empresaId,
        entryPath: targetPath,
        targetDirectoryPath: String(body.targetDirectoryPath || ''),
        currentUserId: access.userId,
        actor: { userId: access.userId, label: access.session.user.name || access.session.user.email || 'Usuario interno' },
      })
      return NextResponse.json({ success: true, data: moved })
    }

    if (body?.action === 'share') {
      const shared = await updateCrmEntrySharing({
        empresaId: access.empresaId,
        entryPath: targetPath,
        currentUserId: access.userId,
        sharedWithUserIds: Array.isArray(body.sharedWithUserIds) ? body.sharedWithUserIds.map((item) => String(item || '')) : [],
        actor: { userId: access.userId, label: access.session.user.name || access.session.user.email || 'Usuario interno' },
      })
      return NextResponse.json({ success: true, data: shared })
    }

    return NextResponse.json({ success: false, error: 'Acción no soportada.' }, { status: 400 })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: detail }, { status: 400 })
  }
}