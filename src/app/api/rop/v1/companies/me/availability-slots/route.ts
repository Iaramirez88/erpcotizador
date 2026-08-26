import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { upsertRopAvailabilitySlotsForUser } from '@/lib/rop'
import { requireRopAccess } from '@/lib/rop-access'

export const runtime = 'nodejs'

const requestSchema = z.object({
  items: z.array(z.object({
    companyServiceId: z.string().trim().min(1),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    specificDate: z.string().trim().min(1).nullable().optional(),
    startTime: z.string().trim().min(1).nullable().optional(),
    endTime: z.string().trim().min(1).nullable().optional(),
    slotStatus: z.enum(['OPEN', 'BLOCKED', 'RESERVED']),
    recurrenceRule: z.string().trim().max(180).nullable().optional(),
  })).max(200),
})

async function resolveUserAccess() {
  const access = await requireRopAccess('UPDATE')
  if (!access.ok) return { error: access.response }
  return { userId: access.userId }
}

export async function PUT(request: NextRequest) {
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

    await upsertRopAvailabilitySlotsForUser(context.userId, parsed.data)
    return NextResponse.json({ data: { ok: true }, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron guardar los slots.'
    const status = message.startsWith('INVALID_') ? 400 : 500

    return NextResponse.json(
      {
        error: {
          code: status === 400 ? 'ROP_AVAILABILITY_INVALID' : 'ROP_AVAILABILITY_PUT_FAILED',
          message,
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status }
    )
  }
}