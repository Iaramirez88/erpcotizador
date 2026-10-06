import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

function isPrivateAddress(address: string) {
  if (isIP(address) === 4) {
    const parts = address.split('.').map(Number)
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
  }
  const normalized = address.toLowerCase()
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') || normalized.startsWith('::ffff:192.168.')
}

export async function assertPublicHttpUrl(value: string) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Solo se permiten URLs públicas HTTP o HTTPS.')
  }
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.local') || (isIP(hostname) !== 0 && isPrivateAddress(hostname))) {
    throw new Error('No se permiten direcciones privadas.')
  }
  const addresses = await lookup(hostname, { all: true })
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('La URL no resuelve a una dirección pública válida.')
  }
  return url
}

async function readLimitedText(response: Response, maxBytes: number) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new Error(`La respuesta supera el límite de ${Math.round(maxBytes / 1000)} KB.`)
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

export async function fetchPublicHtml(initialUrl: string, options?: { userAgent?: string; maxBytes?: number; timeoutMs?: number }) {
  let current = await assertPublicHttpUrl(initialUrl)
  const startedAt = Date.now()
  for (let redirect = 0; redirect < 5; redirect += 1) {
    const response = await fetch(current, {
      headers: { 'User-Agent': options?.userAgent || 'SGDigital-PublicCrawler/1.0', Accept: 'text/html,application/xhtml+xml,text/plain' },
      redirect: 'manual',
      signal: AbortSignal.timeout(options?.timeoutMs || 15_000),
      cache: 'no-store',
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) throw new Error(`La URL ${current.hostname} devolvió una redirección inválida.`)
      current = await assertPublicHttpUrl(new URL(location, current).toString())
      continue
    }
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain') && !contentType.includes('application/xml') && !contentType.includes('text/xml')) {
      throw new Error(`La URL ${current.hostname} no contiene texto analizable.`)
    }
    return {
      url: current.toString(),
      statusCode: response.status,
      contentType,
      responseTimeMs: Date.now() - startedAt,
      headers: response.headers,
      html: await readLimitedText(response, options?.maxBytes || 1_000_000),
    }
  }
  throw new Error('La URL excedió el máximo de redirecciones.')
}