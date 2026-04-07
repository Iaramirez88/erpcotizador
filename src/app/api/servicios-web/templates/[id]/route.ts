import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import { mergeWebsiteServiceMessageTemplate, serializeWebsiteServiceMessageTemplate } from '@/lib/website-service-reminders'

export const runtime = 'nodejs'

function isMissingTableError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: unknown }).code : null
  return code === 'P2021'
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function hasTemplateDelegate(client: unknown) {
  const delegate = (client as { websiteServiceMessageTemplate?: unknown } | null | undefined)?.websiteServiceMessageTemplate
  return !!delegate && typeof (delegate as { findFirst?: unknown }).findFirst === 'function'
}

function getRuntimeNotReadyMessage() {
  return 'El servidor aún no cargó el modelo de plantillas automáticas. Reinicia el servidor de desarrollo y aplica la migración pendiente.'
}

async function requireWebsiteServicesAccess() {
  const session = await auth()
  if (!session?.user) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 }) }
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Sesión inválida' }, { status: 401 }) }
  }

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess || !access.empresaId) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Prohibido' }, { status: 403 }) }
  }

  return { ok: true as const, userId, access }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireWebsiteServicesAccess()
  if (!guard.ok) return guard.response

  if (!hasTemplateDelegate(prisma)) {
    return NextResponse.json({ ok: false, error: getRuntimeNotReadyMessage() }, { status: 503 })
  }

  try {
    const { id } = await context.params
    const existing = await prisma.websiteServiceMessageTemplate.findFirst({
      where: { id, empresaId: guard.access.empresaId },
    })

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Plantilla no encontrada.' }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const data = mergeWebsiteServiceMessageTemplate(body)

    const updated = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.websiteServiceMessageTemplate.updateMany({
          where: {
            empresaId: guard.access.empresaId,
            serviceKind: data.serviceKind,
            triggerKind: data.triggerKind,
            id: { not: id },
          },
          data: { isDefault: false },
        })
      }

      return tx.websiteServiceMessageTemplate.update({
        where: { id },
        data,
      })
    })

    return NextResponse.json({ ok: true, template: serializeWebsiteServiceMessageTemplate(updated) })
  } catch (error) {
    const message = isMissingTableError(error)
      ? 'La base de datos todavía no tiene la tabla de plantillas automáticas. Aplica la migración pendiente.'
      : getErrorMessage(error, 'No se pudo actualizar la plantilla automática.')
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireWebsiteServicesAccess()
  if (!guard.ok) return guard.response

  if (!hasTemplateDelegate(prisma)) {
    return NextResponse.json({ ok: false, error: getRuntimeNotReadyMessage() }, { status: 503 })
  }

  try {
    const { id } = await context.params
    const existing = await prisma.websiteServiceMessageTemplate.findFirst({
      where: { id, empresaId: guard.access.empresaId },
    })

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Plantilla no encontrada.' }, { status: 404 })
    }

    await prisma.websiteServiceMessageTemplate.delete({ where: { id } })

    return NextResponse.json({ ok: true, deletedId: id })
  } catch (error) {
    const message = isMissingTableError(error)
      ? 'La base de datos todavía no tiene la tabla de plantillas automáticas. Aplica la migración pendiente.'
      : getErrorMessage(error, 'No se pudo eliminar la plantilla automática.')
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}