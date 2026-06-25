import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { subscribeToRealtimeNotifications, type RealtimeNotificationPayload } from '@/lib/notification-realtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const encoder = new TextEncoder()

function serializeSseMessage(event: string, payload: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const userId = session.user.id

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(serializeSseMessage(event, payload))
      }

      send('ready', { ok: true })

      const unsubscribe = subscribeToRealtimeNotifications(userId, (payload: RealtimeNotificationPayload) => {
        send('notification', payload)
      })

      const heartbeatId = setInterval(() => {
        controller.enqueue(encoder.encode(': keep-alive\n\n'))
      }, 25000)

      const cleanup = () => {
        clearInterval(heartbeatId)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // already closed
        }
      }

      request.signal.addEventListener('abort', cleanup)
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}