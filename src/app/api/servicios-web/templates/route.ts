import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import {
  DEFAULT_WEBSITE_SERVICE_TEMPLATE_META,
  mergeWebsiteServiceMessageTemplate,
  mergeWebsiteServiceReminderSettings,
  serializeWebsiteServiceMessageTemplate,
} from '@/lib/website-service-reminders'

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
  return !!delegate && typeof (delegate as { findMany?: unknown }).findMany === 'function'
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

export async function GET() {
  const guard = await requireWebsiteServicesAccess()
  if (!guard.ok) return guard.response

  if (!hasTemplateDelegate(prisma)) {
    const legacy = await prisma.websiteServiceReminderSetting.findUnique({
      where: { empresaId: guard.access.empresaId },
      select: {
        daysBefore: true,
        emailSubjectTemplate: true,
        emailBodyTemplate: true,
        whatsappTemplate: true,
        isEmailEnabled: true,
        isWhatsAppEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    }).catch(() => null)

    if (!legacy) {
      return NextResponse.json({ ok: true, templates: [], defaults: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META, migrationPending: true, runtimePending: true })
    }

    const settings = mergeWebsiteServiceReminderSettings(legacy)
    return NextResponse.json({
      ok: true,
      migrationPending: true,
      runtimePending: true,
      templates: [
        {
          id: 'legacy-default',
          nombre: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.nombre,
          descripcion: 'Plantilla temporal cargada mientras el runtime termina de reconocer el nuevo modelo.',
          serviceKind: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.serviceKind,
          triggerKind: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.triggerKind,
          daysBefore: settings.daysBefore,
          emailSubjectTemplate: settings.emailSubjectTemplate,
          emailBodyTemplate: settings.emailBodyTemplate,
          whatsappTemplate: settings.whatsappTemplate,
          isEmailEnabled: settings.isEmailEnabled,
          isWhatsAppEnabled: settings.isWhatsAppEnabled,
          isActive: true,
          isDefault: true,
          createdAt: legacy.createdAt.toISOString(),
          updatedAt: legacy.updatedAt.toISOString(),
        },
      ],
      defaults: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META,
    })
  }

  try {
    const templates = await prisma.websiteServiceMessageTemplate.findMany({
      where: { empresaId: guard.access.empresaId },
      orderBy: [{ isDefault: 'desc' }, { isActive: 'desc' }, { updatedAt: 'desc' }],
    })

    return NextResponse.json({
      ok: true,
      templates: templates.map((template) => serializeWebsiteServiceMessageTemplate(template)),
      defaults: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META,
    })
  } catch (error) {
    if (!isMissingTableError(error)) {
      return NextResponse.json({ ok: false, error: getErrorMessage(error, 'No se pudieron cargar las plantillas automáticas.') }, { status: 500 })
    }

    const legacy = await prisma.websiteServiceReminderSetting.findUnique({
      where: { empresaId: guard.access.empresaId },
      select: {
        daysBefore: true,
        emailSubjectTemplate: true,
        emailBodyTemplate: true,
        whatsappTemplate: true,
        isEmailEnabled: true,
        isWhatsAppEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    }).catch(() => null)

    if (!legacy) {
      return NextResponse.json({ ok: true, templates: [], defaults: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META, migrationPending: true })
    }

    const settings = mergeWebsiteServiceReminderSettings(legacy)

    return NextResponse.json({
      ok: true,
      migrationPending: true,
      templates: [
        {
          id: 'legacy-default',
          nombre: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.nombre,
          descripcion: 'Plantilla temporal cargada desde la configuración anterior mientras se aplica la migración.',
          serviceKind: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.serviceKind,
          triggerKind: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.triggerKind,
          daysBefore: settings.daysBefore,
          emailSubjectTemplate: settings.emailSubjectTemplate,
          emailBodyTemplate: settings.emailBodyTemplate,
          whatsappTemplate: settings.whatsappTemplate,
          isEmailEnabled: settings.isEmailEnabled,
          isWhatsAppEnabled: settings.isWhatsAppEnabled,
          isActive: true,
          isDefault: true,
          createdAt: legacy.createdAt.toISOString(),
          updatedAt: legacy.updatedAt.toISOString(),
        },
      ],
      defaults: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META,
    })
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireWebsiteServicesAccess()
  if (!guard.ok) return guard.response

  if (!hasTemplateDelegate(prisma)) {
    return NextResponse.json({ ok: false, error: getRuntimeNotReadyMessage() }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  const data = mergeWebsiteServiceMessageTemplate(body)
  if (!data.nombre) {
    return NextResponse.json({ ok: false, error: 'El nombre de la plantilla es obligatorio.' }, { status: 400 })
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.websiteServiceMessageTemplate.updateMany({
          where: { empresaId: guard.access.empresaId, serviceKind: data.serviceKind, triggerKind: data.triggerKind },
          data: { isDefault: false },
        })
      }

      return tx.websiteServiceMessageTemplate.create({
        data: {
          empresaId: guard.access.empresaId,
          ...data,
        },
      })
    })

    return NextResponse.json({ ok: true, template: serializeWebsiteServiceMessageTemplate(created) })
  } catch (error) {
    const message = isMissingTableError(error)
      ? 'La base de datos todavía no tiene la tabla de plantillas automáticas. Aplica la migración pendiente.'
      : getErrorMessage(error, 'No se pudo crear la plantilla automática.')
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}