import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateRopOpportunityRecommendationsForUser } from '@/lib/rop'
import { resolveUserIdFromSession } from '@/lib/session-user'

export const runtime = 'nodejs'

async function resolveUserId() {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 }) }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return { error: NextResponse.json({ error: { code: 'INVALID_SESSION', message: 'Sesión inválida' } }, { status: 401 }) }

  return { userId }
}

export async function POST(_: Request, props: { params: Promise<{ opportunityId: string }> }) {
  try {
    const context = await resolveUserId()
    if ('error' in context) return context.error

    const { opportunityId } = await props.params
    const data = await generateRopOpportunityRecommendationsForUser(context.userId, opportunityId)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo recalcular el shortlist.'
    const status = message.startsWith('ROP_OPPORTUNITY_NOT_FOUND') ? 404 : 500

    return NextResponse.json(
      {
        error: {
          code: status === 404 ? 'ROP_OPPORTUNITY_NOT_FOUND' : 'ROP_RECOMMENDATIONS_POST_FAILED',
          message,
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status }
    )
  }
}