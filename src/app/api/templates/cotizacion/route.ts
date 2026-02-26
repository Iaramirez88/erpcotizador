import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_COTIZACION_TEMPLATE, mergeCotizacionTemplateSettings } from '@/lib/cotizacion-template'

export const runtime = 'nodejs'

async function resolveUserIdFromSession(session: { user?: { id?: string; email?: string | null } }) {
  if (session.user?.id) {
    const userById = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true } })
    if (userById?.id) return userById.id
  }
  const email = session.user?.email
  if (!email) return null
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  return user?.id ?? null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const record = await prisma.cotizacionTemplate.findUnique({
    where: { userId },
    select: { settings: true, defaultSettings: true },
  })

  const settings = mergeCotizacionTemplateSettings(record?.settings ?? DEFAULT_COTIZACION_TEMPLATE)
  const rawDefaultSettings = record?.defaultSettings
  const hasUserDefault = isPlainObject(rawDefaultSettings) && Object.keys(rawDefaultSettings).length > 0
  const defaultSettings = mergeCotizacionTemplateSettings(hasUserDefault ? rawDefaultSettings : DEFAULT_COTIZACION_TEMPLATE)

  return NextResponse.json({ success: true, data: { settings, defaultSettings } })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const body: unknown = await req.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const incomingSettings = isPlainObject(body.settings) ? body.settings : (body.settings === undefined ? undefined : body)
  const incomingDefault = isPlainObject(body.defaultSettings) ? body.defaultSettings : undefined

  const settings = incomingSettings === undefined ? undefined : mergeCotizacionTemplateSettings(incomingSettings)
  const defaultSettings = incomingDefault === undefined ? undefined : mergeCotizacionTemplateSettings(incomingDefault)

  const updated = await prisma.cotizacionTemplate.upsert({
    where: { userId },
    create: {
      userId,
      settings: settings ?? DEFAULT_COTIZACION_TEMPLATE,
      defaultSettings: defaultSettings ?? DEFAULT_COTIZACION_TEMPLATE,
    },
    update: {
      ...(settings !== undefined ? { settings } : {}),
      ...(defaultSettings !== undefined ? { defaultSettings } : {}),
    },
    select: { settings: true, defaultSettings: true },
  })

  return NextResponse.json({ success: true, data: { settings: updated.settings, defaultSettings: updated.defaultSettings } })
}
