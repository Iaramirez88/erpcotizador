import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { createRopInvitationsForUser } from '@/lib/rop'
import { resolveUserIdFromSession } from '@/lib/session-user'

export const runtime = 'nodejs'

const requestSchema = z.object({
  recipientCompanyIds: z.array(z.string().trim().min(1)).min(1).max(20),
  messagePublic: z.string().trim().max(4000).nullable().optional(),
  shareBudget: z.boolean().optional(),
  shareAttachments: z.boolean().optional(),
  expiresAt: z.string().trim().min(1).nullable().optional(),
})

async function resolveUserId() {
  const session = await auth()
  if (!session?.user) return { error: NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 }) }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) return { error: NextResponse.json({ error: { code: 'INVALID_SESSION', message: 'Sesión inválida' } }, { status: 401 }) }

  return { userId }
}

export async function POST(request: NextRequest, props: { params: Promise<{ opportunityId: string }> }) {
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

    const { opportunityId } = await props.params
    const data = await createRopInvitationsForUser(context.userId, opportunityId, parsed.data)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron crear las invitaciones.'
    const status = message.startsWith('INVALID_') ? 400 : message === 'ROP_OPPORTUNITY_NOT_FOUND' ? 404 : 500

    return NextResponse.json(
      {
        error: {
          code: status === 400 ? 'ROP_INVITATION_INVALID' : status === 404 ? 'ROP_OPPORTUNITY_NOT_FOUND' : 'ROP_INVITATION_POST_FAILED',
          message,
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status }
    )
  }
}