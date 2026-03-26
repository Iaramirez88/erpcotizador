import { handleMetaOAuthCallback } from '@/lib/crm-meta-oauth'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params

  return handleMetaOAuthCallback({
    request,
    redirectUri: new URL(request.url).origin + new URL(request.url).pathname,
    legacyChannelId: id,
    sourceLabel: 'callback-legacy',
  })
}