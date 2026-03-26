import { handleMetaOAuthCallback } from '@/lib/crm-meta-oauth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return handleMetaOAuthCallback({
    request,
    sourceLabel: 'callback-global',
  })
}