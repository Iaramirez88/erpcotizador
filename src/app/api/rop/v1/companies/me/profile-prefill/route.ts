import { NextResponse } from 'next/server'
import { getRopProfilePrefillForUser } from '@/lib/rop'
import { requireRopReadAccess } from '@/lib/rop-access'

export const runtime = 'nodejs'

async function resolveUserAccess() {
  const access = await requireRopReadAccess()
  if (!access.ok) return { error: access.response }
  return { userId: access.userId }
}

export async function GET() {
  try {
    const context = await resolveUserAccess()
    if ('error' in context) return context.error

    const data = await getRopProfilePrefillForUser(context.userId)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'ROP_PROFILE_PREFILL_GET_FAILED',
          message: error instanceof Error ? error.message : 'No se pudo cargar el prellenado ERP para ROP.',
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status: 500 }
    )
  }
}