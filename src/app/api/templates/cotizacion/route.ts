import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_COTIZACION_TEMPLATE, mergeCotizacionTemplateSettings } from '@/lib/cotizacion-template'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { isPlanOwnerForEmpresa } from '@/lib/plan-owner'

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
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

    const userId = await resolveUserIdFromSession(session)
    if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

    const empresaId = await requireEmpresaIdForUser(userId)
    const canManageEmpresaTemplate = await isPlanOwnerForEmpresa({ empresaId, userId })

    const empresaTemplate = await prisma.empresaCotizacionTemplate.findUnique({
      where: { empresaId },
      select: { settings: true, defaultSettings: true },
    })

    if (empresaTemplate) {
      const settings = mergeCotizacionTemplateSettings(empresaTemplate.settings ?? DEFAULT_COTIZACION_TEMPLATE)
      const rawDefaultSettings = empresaTemplate.defaultSettings
      const hasUserDefault = isPlainObject(rawDefaultSettings) && Object.keys(rawDefaultSettings).length > 0
      const defaultSettings = mergeCotizacionTemplateSettings(hasUserDefault ? rawDefaultSettings : DEFAULT_COTIZACION_TEMPLATE)

      return NextResponse.json({
        success: true,
        data: {
          settings,
          defaultSettings,
          meta: { scope: 'empresa', canEdit: canManageEmpresaTemplate },
        },
      })
    }

    const record = await prisma.cotizacionTemplate.findUnique({
      where: { userId },
      select: { settings: true, defaultSettings: true },
    })

    const settings = mergeCotizacionTemplateSettings(record?.settings ?? DEFAULT_COTIZACION_TEMPLATE)
    const rawDefaultSettings = record?.defaultSettings
    const hasUserDefault = isPlainObject(rawDefaultSettings) && Object.keys(rawDefaultSettings).length > 0
    const defaultSettings = mergeCotizacionTemplateSettings(hasUserDefault ? rawDefaultSettings : DEFAULT_COTIZACION_TEMPLATE)

    return NextResponse.json({
      success: true,
      data: { settings, defaultSettings, meta: { scope: 'usuario', canEdit: true } },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // P2021: table does not exist (migraciones pendientes)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021') {
      return NextResponse.json(
        {
          success: false,
          error: 'La base de datos no tiene las tablas de plantilla por empresa. Ejecuta las migraciones (prisma migrate).',
          details: process.env.NODE_ENV !== 'production' ? msg : undefined,
        },
        { status: 500 }
      )
    }

    // Si el Prisma Client está desactualizado, suele fallar con "... is not a function" o propiedades undefined.
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno al cargar la plantilla.',
        details: process.env.NODE_ENV !== 'production' ? msg : undefined,
      },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

    const userId = await resolveUserIdFromSession(session)
    if (!userId) return NextResponse.json({ success: false, error: 'Sesión inválida' }, { status: 401 })

    const empresaId = await requireEmpresaIdForUser(userId)
    const canManageEmpresaTemplate = await isPlanOwnerForEmpresa({ empresaId, userId })

    const existingEmpresaTemplate = await prisma.empresaCotizacionTemplate.findUnique({
      where: { empresaId },
      select: { id: true },
    })

    const body: unknown = await req.json().catch(() => null)
    if (!isPlainObject(body)) {
      return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
    }

    const incomingSettings = isPlainObject(body.settings) ? body.settings : (body.settings === undefined ? undefined : body)
    const incomingDefault = isPlainObject(body.defaultSettings) ? body.defaultSettings : undefined

    const settings = incomingSettings === undefined ? undefined : mergeCotizacionTemplateSettings(incomingSettings)
    const defaultSettings = incomingDefault === undefined ? undefined : mergeCotizacionTemplateSettings(incomingDefault)

    // Si existe una plantilla predeterminada por empresa, solo la cabeza (planOwnerUserId) puede modificarla.
    // Si el usuario es la cabeza, todos los cambios se guardan a nivel de empresa.
    if (existingEmpresaTemplate || canManageEmpresaTemplate) {
      if (!canManageEmpresaTemplate) {
        return NextResponse.json(
          { success: false, error: 'Solo el administrador principal puede modificar la plantilla predeterminada de la empresa.' },
          { status: 403 }
        )
      }

      const updatedEmpresa = await prisma.$transaction(async (tx) => {
        const upserted = await tx.empresaCotizacionTemplate.upsert({
          where: { empresaId },
          create: {
            empresaId,
            settings: settings ?? DEFAULT_COTIZACION_TEMPLATE,
            defaultSettings: defaultSettings ?? DEFAULT_COTIZACION_TEMPLATE,
          },
          update: {
            ...(settings !== undefined ? { settings } : {}),
            ...(defaultSettings !== undefined ? { defaultSettings } : {}),
          },
          select: { settings: true, defaultSettings: true },
        })

        if (settings !== undefined || defaultSettings !== undefined) {
          await tx.empresaCotizacionTemplateVersion.create({
            data: {
              empresaId,
              createdByUserId: userId,
              settings: (upserted.settings ?? DEFAULT_COTIZACION_TEMPLATE) as Prisma.InputJsonValue,
              defaultSettings: (upserted.defaultSettings ?? DEFAULT_COTIZACION_TEMPLATE) as Prisma.InputJsonValue,
            },
            select: { id: true },
          })
        }

        return upserted
      })

      return NextResponse.json({
        success: true,
        data: {
          settings: updatedEmpresa.settings,
          defaultSettings: updatedEmpresa.defaultSettings,
          meta: { scope: 'empresa', canEdit: true },
        },
      })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const upserted = await tx.cotizacionTemplate.upsert({
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

      // Snapshot para historial (solo cuando hay cambios)
      if (settings !== undefined || defaultSettings !== undefined) {
        await tx.cotizacionTemplateVersion.create({
          data: {
            userId,
            settings: (upserted.settings ?? DEFAULT_COTIZACION_TEMPLATE) as Prisma.InputJsonValue,
            defaultSettings: (upserted.defaultSettings ?? DEFAULT_COTIZACION_TEMPLATE) as Prisma.InputJsonValue,
          },
          select: { id: true },
        })
      }

      return upserted
    })

    return NextResponse.json({
      success: true,
      data: { settings: updated.settings, defaultSettings: updated.defaultSettings, meta: { scope: 'usuario', canEdit: true } },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021') {
      return NextResponse.json(
        {
          success: false,
          error: 'La base de datos no tiene las tablas de plantilla por empresa. Ejecuta las migraciones (prisma migrate).',
          details: process.env.NODE_ENV !== 'production' ? msg : undefined,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno al guardar la plantilla.',
        details: process.env.NODE_ENV !== 'production' ? msg : undefined,
      },
      { status: 500 }
    )
  }
}
