import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import { mergeWebsiteServiceReminderSettings } from '@/lib/website-service-reminders'

export const runtime = 'nodejs'

function normalizeString(value: unknown) {
  const normalized = String(value ?? '').trim()
  return normalized || null
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

  const record = await prisma.websiteServiceReminderSetting.findUnique({
    where: { empresaId: guard.access.empresaId },
    select: {
      daysBefore: true,
      emailSubjectTemplate: true,
      emailBodyTemplate: true,
      whatsappTemplate: true,
      isEmailEnabled: true,
      isWhatsAppEnabled: true,
    },
  })

  return NextResponse.json({
    ok: true,
    settings: mergeWebsiteServiceReminderSettings(record),
  })
}

export async function PUT(req: NextRequest) {
  const guard = await requireWebsiteServicesAccess()
  if (!guard.ok) return guard.response

  const body = await req.json().catch(() => null)
  const settings = mergeWebsiteServiceReminderSettings({
    daysBefore: 30,
    emailSubjectTemplate: normalizeString(body?.emailSubjectTemplate) ?? undefined,
    emailBodyTemplate: normalizeString(body?.emailBodyTemplate) ?? undefined,
    whatsappTemplate: normalizeString(body?.whatsappTemplate) ?? undefined,
    isEmailEnabled: typeof body?.isEmailEnabled === 'boolean' ? body.isEmailEnabled : undefined,
    isWhatsAppEnabled: typeof body?.isWhatsAppEnabled === 'boolean' ? body.isWhatsAppEnabled : undefined,
  })

  const saved = await prisma.websiteServiceReminderSetting.upsert({
    where: { empresaId: guard.access.empresaId },
    update: settings,
    create: {
      empresaId: guard.access.empresaId,
      ...settings,
    },
    select: {
      daysBefore: true,
      emailSubjectTemplate: true,
      emailBodyTemplate: true,
      whatsappTemplate: true,
      isEmailEnabled: true,
      isWhatsAppEnabled: true,
    },
  })

  return NextResponse.json({ ok: true, settings: saved })
}