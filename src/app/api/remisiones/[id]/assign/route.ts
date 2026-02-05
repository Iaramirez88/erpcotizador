import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import type { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

type Body = { userId?: unknown }

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('REMISIONES' as ModuleKey, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = (await request.json().catch(() => ({}))) as Body
    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 })
    }

    const sede = await prisma.sede.findUnique({ where: { id: access.sedeId }, select: { id: true, empresaId: true } })
    if (!sede) return NextResponse.json({ error: 'Sede no encontrada' }, { status: 404 })

    const membership = await prisma.sedeMembership.findUnique({
      where: { sedeId_userId: { sedeId: access.sedeId, userId } },
      select: { id: true },
    })
    if (!membership) {
      return NextResponse.json({ error: 'El usuario no pertenece a esta sede' }, { status: 400 })
    }

    const before = await prisma.remision.findFirst({
      where: { id, sedeId: access.sedeId, empresaId: sede.empresaId },
      select: { id: true, numero: true },
    })

    if (!before) {
      return NextResponse.json({ error: 'Remisión no encontrada' }, { status: 404 })
    }

    const updated = await prisma.remision.update({
      where: { id: before.id },
      data: {
        assignedTo: { connect: { id: userId } },
        assignedAt: new Date(),
      },
      select: {
        id: true,
        numero: true,
        assignedAt: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    })

    if (userId !== access.userId) {
      await prisma.notification.create({
        data: {
          userId,
          empresaId: sede.empresaId,
          sedeId: access.sedeId,
          type: 'INFO',
          title: `Te asignaron la remisión ${updated.numero}`,
          body: `Se te asignó la remisión ${updated.numero}.`,
        },
      })
    }

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    console.error('Error asignando remisión:', error)
    return NextResponse.json({ error: 'Error al asignar remisión' }, { status: 500 })
  }
}
