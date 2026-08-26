import { NextResponse } from 'next/server'
import { getRopOpportunityDetailForUser } from '@/lib/rop'
import { requireRopReadAccess } from '@/lib/rop-access'

export const runtime = 'nodejs'

async function resolveUserAccess() {
  const access = await requireRopReadAccess()
  if (!access.ok) return { error: access.response }
  return { userId: access.userId }
}

export async function GET(_: Request, props: { params: Promise<{ opportunityId: string }> }) {
  try {
    const context = await resolveUserAccess()
    if ('error' in context) return context.error

    const { opportunityId } = await props.params
    const data = await getRopOpportunityDetailForUser(context.userId, opportunityId)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar la necesidad.'
    const status = message === 'ROP_OPPORTUNITY_NOT_FOUND' ? 404 : 500

    return NextResponse.json(
      {
        error: {
          code: status === 404 ? 'ROP_OPPORTUNITY_NOT_FOUND' : 'ROP_OPPORTUNITY_GET_FAILED',
          message,
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status }
    )
  }
}