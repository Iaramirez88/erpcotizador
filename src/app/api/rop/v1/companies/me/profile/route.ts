import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getRopProfileForUser, upsertRopProfileForUser } from '@/lib/rop'

export const runtime = 'nodejs'

const profileSchema = z.object({
  brandName: z.string().trim().max(180).nullable().optional(),
  descriptionPublic: z.string().trim().max(4000).nullable().optional(),
  location: z.object({
    countryCode: z.string().trim().length(2),
    region: z.string().trim().max(120).nullable().optional(),
    city: z.string().trim().max(120).nullable().optional(),
  }),
  coverageScope: z.enum(['LOCAL', 'REGIONAL', 'NATIONAL', 'EXPORT']).nullable().optional(),
  visibilityLevel: z.enum(['PRIVATE', 'NETWORK', 'PUBLIC']),
  serviceSelections: z.array(z.object({
    serviceCatalogId: z.string().trim().min(1),
    publicTitle: z.string().trim().max(180).nullable().optional(),
    leadTimeHours: z.number().int().min(0).max(100000).nullable().optional(),
    minOrderValue: z.number().min(0).max(999999999).nullable().optional(),
  })).max(50),
})

async function resolveUserId() {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 }) }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return { error: NextResponse.json({ error: { code: 'INVALID_SESSION', message: 'Sesión inválida' } }, { status: 401 }) }

  return { userId }
}

export async function GET() {
  try {
    const context = await resolveUserId()
    if ('error' in context) return context.error

    const data = await getRopProfileForUser(context.userId)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'ROP_PROFILE_GET_FAILED',
          message: error instanceof Error ? error.message : 'No se pudo cargar el perfil operativo.',
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await resolveUserId()
    if ('error' in context) return context.error

    const body = await request.json().catch(() => null)
    const parsed = profileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_BODY',
            message: parsed.error.issues[0]?.message || 'Body inválido.',
          },
          meta: { version: 'v1', timestamp: new Date().toISOString() },
        },
        { status: 400 }
      )
    }

    const data = await upsertRopProfileForUser(context.userId, parsed.data)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar el perfil operativo.'
    const status = message.startsWith('INVALID_SERVICE_IDS:') ? 400 : 500

    return NextResponse.json(
      {
        error: {
          code: status === 400 ? 'INVALID_SERVICE_IDS' : 'ROP_PROFILE_PUT_FAILED',
          message,
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status }
    )
  }
}