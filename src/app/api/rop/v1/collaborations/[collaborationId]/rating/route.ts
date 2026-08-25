import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { createRopRatingForUser } from '@/lib/rop'
import { resolveUserIdFromSession } from '@/lib/session-user'

export const runtime = 'nodejs'

const requestSchema = z.object({
  qualityScore: z.number().int().min(1).max(5),
  timelinessScore: z.number().int().min(1).max(5),
  communicationScore: z.number().int().min(1).max(5),
  commentPublic: z.string().trim().max(2000).nullable().optional(),
})

async function resolveUserId() {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 }) }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return { error: NextResponse.json({ error: { code: 'INVALID_SESSION', message: 'Sesión inválida' } }, { status: 401 }) }

  return { userId }
}

export async function POST(request: NextRequest, props: { params: Promise<{ collaborationId: string }> }) {
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

    const { collaborationId } = await props.params
    const data = await createRopRatingForUser(context.userId, collaborationId, parsed.data)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo registrar el rating.'
    const status = message.startsWith('ROP_COLLABORATION_') || message === 'ROP_RATING_UNDER_DISPUTE' ? 400 : 500

    return NextResponse.json(
      {
        error: {
          code: status === 400 ? 'ROP_RATING_INVALID' : 'ROP_RATING_POST_FAILED',
          message,
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status }
    )
  }
}