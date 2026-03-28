function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function isLocalBaseUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)
  } catch {
    return false
  }
}

export function getRequestBaseUrl(request: Request): string {
  const envUrl =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL

  if (typeof envUrl === 'string' && envUrl.trim()) {
    const normalizedEnvUrl = normalizeBaseUrl(envUrl)
    if (!isLocalBaseUrl(normalizedEnvUrl)) return normalizedEnvUrl
  }

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  if (host) return normalizeBaseUrl(`${proto}://${host}`)

  try {
    return normalizeBaseUrl(new URL(request.url).origin)
  } catch {
    return ''
  }
}
