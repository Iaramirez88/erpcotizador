import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getRopHomeForUser } from '@/lib/rop'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })
    }

    const userId = await resolveUserIdFromSession(session)
    if (!userId) {
      return NextResponse.json({ error: { code: 'INVALID_SESSION', message: 'Sesión inválida' } }, { status: 401 })
    }

    const data = await getRopHomeForUser(userId)
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