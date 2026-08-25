import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { moderateRopRating } from '@/lib/rop'
import { isSuperAdminEmail } from '@/lib/super-admin'

export const runtime = 'nodejs'

const requestSchema = z.object({
  moderationStatus: z.enum(['PUBLISHED', 'HIDDEN']),
  note: z.string().trim().max(2000).nullable().optional(),
})

export async function POST(request: NextRequest, props: { params: Promise<{ ratingId: string }> }) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })
    }

    if (!isSuperAdminEmail(session.user.email)) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Solo superadmin puede moderar ratings ROP.' } }, { status: 403 })
    }

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
    const data = await moderateRopRating({ ratingId, ...parsed.data })
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo moderar el rating.'
    const status = message === 'ROP_RATING_NOT_FOUND' ? 404 : 500

    return NextResponse.json(
      {
        error: {
          code: status === 404 ? 'ROP_RATING_NOT_FOUND' : 'ROP_RATING_MODERATION_FAILED',
          message,
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status }
    )
  }
}