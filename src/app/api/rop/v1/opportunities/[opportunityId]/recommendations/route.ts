import { NextResponse } from 'next/server'
import { generateRopOpportunityRecommendationsForUser } from '@/lib/rop'
import { requireRopAccess } from '@/lib/rop-access'

export const runtime = 'nodejs'

async function resolveUserAccess() {
  const access = await requireRopAccess('EXECUTE')
  if (!access.ok) return { error: access.response }
  return { userId: access.userId }
}

export async function POST(_: Request, props: { params: Promise<{ opportunityId: string }> }) {
  try {
    const context = await resolveUserAccess()
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