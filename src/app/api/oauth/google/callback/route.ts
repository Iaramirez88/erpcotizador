import { handleGoogleOAuthCallback } from '@/lib/google-oauth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return handleGoogleOAuthCallback(request)
}