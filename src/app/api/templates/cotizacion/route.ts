import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_COTIZACION_TEMPLATE, mergeCotizacionTemplateSettings } from '@/lib/cotizacion-template'

export const runtime = 'nodejs'

type CotizacionTemplateDelegate = {
  findUnique: (args: {
    where: { userId: string }
    select: { settings: true }
  }) => Promise<{ settings: unknown } | null>
  upsert: (args: {
    where: { userId: string }
    create: { userId: string; settings: unknown }
    update: { settings: unknown }
    select: { settings: true }
  }) => Promise<{ settings: unknown }>
}

function cotizacionTemplate(): CotizacionTemplateDelegate | null {
  const delegate = (prisma as unknown as { cotizacionTemplate?: { findUnique?: unknown; upsert?: unknown } })
    .cotizacionTemplate
  if (!delegate) return null
  if (typeof delegate.findUnique !== 'function') return null
  if (typeof delegate.upsert !== 'function') return null
  return delegate as CotizacionTemplateDelegate
}

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

  const delegate = cotizacionTemplate()
  if (!delegate) {
    return NextResponse.json(
      {
        success: false,
        error:
          'El servidor no tiene el modelo CotizacionTemplate disponible. Ejecuta `npx prisma generate` y reinicia `npm run dev` (y aplica migraciones si faltan).',
      },
      { status: 500 }
    )
  }

  const record = await delegate.findUnique({ where: { userId }, select: { settings: true } })
  const settings = mergeCotizacionTemplateSettings(record?.settings ?? DEFAULT_COTIZACION_TEMPLATE)

  return NextResponse.json({ success: true, data: { settings } })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

  const delegate = cotizacionTemplate()
  if (!delegate) {
    return NextResponse.json(
      {
        success: false,
        error:
          'El servidor no tiene el modelo CotizacionTemplate disponible. Ejecuta `npx prisma generate` y reinicia `npm run dev` (y aplica migraciones si faltan).',
      },
      { status: 500 }
    )
  }

  const body: unknown = await req.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const incoming = isPlainObject(body.settings) ? body.settings : body
  const settings = mergeCotizacionTemplateSettings(incoming)

  const updated = await delegate.upsert({
    where: { userId },
    create: {
      userId,
      settings,
    },
    update: {
      settings,
    },
    select: { settings: true },
  })

  return NextResponse.json({ success: true, data: { settings: updated.settings } })
}
