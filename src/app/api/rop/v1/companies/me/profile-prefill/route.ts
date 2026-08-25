import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getRopProfilePrefillForUser } from '@/lib/rop'

export const runtime = 'nodejs'

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