import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { AccessLevel, ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

const MODULES: ModuleKey[] = [
  'DASHBOARD',
  'COTIZADOR',
  'COTIZACIONES',
  'CLIENTES',
  'MATERIALES',
  'INVENTARIO',
  'REMISIONES',
  'POS',
  'PROVEEDORES',
  'COMPRAS',
  'ORDENES',
  'ESCANEOS',
  'REPORTES',
  'NOTIFICACIONES',
  'CONFIG',
]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body: unknown = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const sedeId = typeof body.sedeId === 'string' ? body.sedeId.trim() : ''
  const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : ''
  const moduleKey = typeof body.module === 'string' ? (body.module.trim() as ModuleKey) : null
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : null

  if (!sedeId || !targetUserId || !moduleKey || enabled === null) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
  }
  if (!MODULES.includes(moduleKey)) {
    return NextResponse.json({ success: false, error: 'Módulo inválido' }, { status: 400 })
  }

  const empresaId = await requireEmpresaIdForUser(session.user.id)

  const sede = await prisma.sede.findUnique({
    where: { id: sedeId },
    select: { id: true, empresaId: true, nombre: true },
  })
  if (!sede || sede.empresaId !== empresaId) {
    return NextResponse.json({ success: false, error: 'Sede inválida' }, { status: 400 })
  }

  const requesterIsSystemAdmin = session.user.role === 'ADMIN'
  const requesterMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId, userId: session.user.id } },
    select: { role: true },
  })

  const requesterIsSedeAdmin = requesterMembership?.role === 'ADMIN' || requesterMembership?.role === 'MANAGER'
  if (!requesterIsSystemAdmin && !requesterIsSedeAdmin) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, name: true },
  })
  if (!targetUser) {
    return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
  }

  const targetMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId, userId: targetUser.id } },
    select: { id: true },
  })
  if (!targetMembership?.id) {
    return NextResponse.json({ success: false, error: 'El usuario no pertenece a esta sede' }, { status: 400 })
  }

  const level: AccessLevel = enabled ? 'READ' : 'NONE'

  const updated = await prisma.userModuleAccess.upsert({
    where: { sedeId_userId_module: { sedeId, userId: targetUser.id, module: moduleKey } },
    create: { sedeId, userId: targetUser.id, module: moduleKey, level },
    update: { level },
    select: { id: true, level: true },
  })

  await prisma.notification.create({
    data: {
      userId: targetUser.id,
      type: 'INFO',
      title: 'Permisos actualizados',
      body: `Se ${enabled ? 'habilitó' : 'deshabilitó'} el módulo ${moduleKey} en la sede ${sede.nombre}.`,
      sedeId: sedeId,
      empresaId,
    },
  })

  return NextResponse.json({ success: true, data: { level: updated.level } })
}
