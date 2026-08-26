import { NextResponse } from 'next/server'
import { getRopHomeForUser } from '@/lib/rop'
import { requireRopReadAccess } from '@/lib/rop-access'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireRopReadAccess()
    if (!access.ok) return access.response

    const data = await getRopHomeForUser(access.userId)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'ROP_HOME_GET_FAILED',
          message: error instanceof Error ? error.message : 'No se pudo cargar la home de ROP.',
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status: 500 }
    )
  }
}