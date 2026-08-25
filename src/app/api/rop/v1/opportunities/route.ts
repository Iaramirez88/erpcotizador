import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { createRopOpportunityForUser } from '@/lib/rop'
import { resolveUserIdFromSession } from '@/lib/session-user'

export const runtime = 'nodejs'

const requestSchema = z.object({
  title: z.string().trim().min(5).max(180),
  descriptionPublic: z.string().trim().max(4000).nullable().optional(),
  requirementsPrivate: z.string().trim().max(8000).nullable().optional(),
  categoryId: z.string().trim().min(1),
  subcategoryId: z.string().trim().min(1),
  serviceCatalogId: z.string().trim().min(1),
  location: z.object({
    countryCode: z.string().trim().length(2),
    region: z.string().trim().max(120).nullable().optional(),
    city: z.string().trim().max(120).nullable().optional(),
  }),
  expectedQuantity: z.number().min(0).max(999999999).nullable().optional(),
  dueAt: z.string().trim().min(1).nullable().optional(),
  visibilityLevel: z.enum(['PRIVATE', 'CLUSTER', 'NETWORK']),
  sourceType: z.enum(['MANUAL', 'CRM', 'PURCHASE', 'OPS_SIGNAL', 'API']),
  sourceRef: z.string().trim().max(180).nullable().optional(),
})

async function resolveUserId() {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 }) }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return { error: NextResponse.json({ error: { code: 'INVALID_SESSION', message: 'Sesión inválida' } }, { status: 401 }) }

  return { userId }
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveUserId()
    if ('error' in context) return context.error

    const body = await request.json().catch(() => null)
    const parsed = requestSchema.safeParse(body)
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

    const data = await createRopOpportunityForUser(context.userId, parsed.data)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo publicar la necesidad.'
    const status = message.startsWith('INVALID_') ? 400 : 500

    return NextResponse.json(
      {
        error: {
          code: status === 400 ? 'ROP_OPPORTUNITY_INVALID' : 'ROP_OPPORTUNITY_POST_FAILED',
          message,
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status }
    )
  }
}