import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getRopCapacityForUser, upsertRopCapacityForUser } from '@/lib/rop'

export const runtime = 'nodejs'

const requestSchema = z.object({
  items: z.array(z.object({
    companyServiceId: z.string().trim().min(1),
    availableQuantity: z.number().min(0),
    reservedQuantity: z.number().min(0).nullable().optional(),
    status: z.enum(['AVAILABLE', 'LIMITED', 'SATURATED', 'OFFLINE']),
    availableFrom: z.string().trim().min(1),
    availableUntil: z.string().trim().min(1),
    slaHours: z.number().int().min(0).max(100000).nullable().optional(),
    sourceType: z.enum(['MANUAL', 'ERP_EVENT', 'API']),
  })).max(100),
})

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

    const data = await getRopCapacityForUser(context.userId)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'ROP_CAPACITY_GET_FAILED',
          message: error instanceof Error ? error.message : 'No se pudo cargar la capacidad.',
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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

    const data = await upsertRopCapacityForUser(context.userId, parsed.data)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar la capacidad.'
    const status = message.startsWith('INVALID_') ? 400 : 500

    return NextResponse.json(
      {
        error: {
          code: status === 400 ? 'ROP_CAPACITY_INVALID' : 'ROP_CAPACITY_PUT_FAILED',
          message,
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status }
    )
  }
}