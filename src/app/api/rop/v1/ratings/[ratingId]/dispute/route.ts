import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { disputeRopRatingForUser } from '@/lib/rop'
import { requireRopAccess } from '@/lib/rop-access'

export const runtime = 'nodejs'

const requestSchema = z.object({
  reason: z.string().trim().max(2000).nullable().optional(),
})

async function resolveUserAccess() {
  const access = await requireRopAccess('UPDATE')
  if (!access.ok) return { error: access.response }
  return { userId: access.userId }
}

export async function POST(request: NextRequest, props: { params: Promise<{ ratingId: string }> }) {
  try {
    const context = await resolveUserAccess()
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

    const { ratingId } = await props.params
    const data = await disputeRopRatingForUser(context.userId, ratingId, parsed.data)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo registrar la disputa.'
    const status = message === 'ROP_RATING_NOT_FOUND' ? 404 : 500

    return NextResponse.json(
      {
        error: {
          code: status === 404 ? 'ROP_RATING_NOT_FOUND' : 'ROP_RATING_DISPUTE_FAILED',
          message,
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status }
    )
  }
}