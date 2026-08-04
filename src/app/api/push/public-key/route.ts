import { NextResponse } from 'next/server'
import { getWebPushPublicKey, isWebPushEnabled } from '@/lib/notification-delivery'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    ok: true,
    enabled: isWebPushEnabled(),
    publicKey: getWebPushPublicKey(),
  })
}