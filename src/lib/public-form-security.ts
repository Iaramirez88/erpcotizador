import { createHash } from 'crypto'
import Redis from 'ioredis'
import { prisma } from '@/lib/prisma'

const MAX_FORM_BODY_BYTES = 32 * 1024
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

type RateLimitRule = {
  scope: string
  identifier: string
  limit: number
  windowSeconds: number
}

type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
}

type MemoryCounter = {
  count: number
  expiresAt: number
}

const memoryCounters = new Map<string, MemoryCounter>()
let redisClient: Redis | null = null

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '')
}

function getAllowedTurnstileHostnames() {
  const configured = process.env.TURNSTILE_ALLOWED_HOSTS?.split(/[,;\s]+/) ?? []
  const websiteBaseDomain = process.env.NEXT_PUBLIC_WEBSITE_BASE_DOMAIN || ''
  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || ''
  return [...configured, websiteBaseDomain, appUrl].map(normalizeHostname).filter(Boolean)
}

async function isAllowedTurnstileHostname(hostname: string) {
  const normalized = normalizeHostname(hostname)
  const allowedHostnames = getAllowedTurnstileHostnames()
  if (!normalized) return false
  if (allowedHostnames.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`))) {
    return true
  }

  const customDomain = await prisma.websiteProjectDomain.findFirst({
    where: {
      hostname: normalized,
      status: 'ACTIVE',
      websiteProject: { status: 'PUBLISHED' },
    },
    select: { id: true },
  })
  return Boolean(customDomain)
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function hashIdentifier(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 32)
}

function getRedisClient() {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (!redisUrl) return null
  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      enableReadyCheck: true,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    })
    redisClient.on('error', () => undefined)
  }
  return redisClient
}

async function consumeRedisRule(rule: RateLimitRule): Promise<RateLimitResult> {
  const client = getRedisClient()
  if (!client) throw new Error('Redis no configurado')
  if (client.status === 'wait') await client.connect()

  const windowId = Math.floor(Date.now() / (rule.windowSeconds * 1000))
  const key = `public-form-rate:${rule.scope}:${hashIdentifier(rule.identifier)}:${windowId}`
  const result = await client.multi().incr(key).expire(key, rule.windowSeconds + 5).exec()
  const count = Number(result?.[0]?.[1] ?? 0)
  const retryAfterSeconds = rule.windowSeconds - Math.floor((Date.now() / 1000) % rule.windowSeconds)
  return { allowed: count <= rule.limit, retryAfterSeconds }
}

function consumeMemoryRule(rule: RateLimitRule): RateLimitResult {
  const now = Date.now()
  const windowMs = rule.windowSeconds * 1000
  const windowId = Math.floor(now / windowMs)
  const key = `${rule.scope}:${hashIdentifier(rule.identifier)}:${windowId}`
  const current = memoryCounters.get(key)
  const counter = current && current.expiresAt > now
    ? { count: current.count + 1, expiresAt: current.expiresAt }
    : { count: 1, expiresAt: (windowId + 1) * windowMs }

  memoryCounters.set(key, counter)
  if (memoryCounters.size > 5000) {
    for (const [storedKey, stored] of memoryCounters) {
      if (stored.expiresAt <= now) memoryCounters.delete(storedKey)
    }
  }

  return {
    allowed: counter.count <= rule.limit,
    retryAfterSeconds: Math.max(1, Math.ceil((counter.expiresAt - now) / 1000)),
  }
}

async function consumeRateLimitRule(rule: RateLimitRule) {
  try {
    return await consumeRedisRule(rule)
  } catch {
    return consumeMemoryRule(rule)
  }
}

export function getPublicRequestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export function hasOversizedPublicFormBody(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || 0)
  return Number.isFinite(contentLength) && contentLength > MAX_FORM_BODY_BYTES
}

function parsePublicFormJson(rawBody: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawBody) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

export async function readPublicFormJson(request: Request) {
  if (!request.body) return { body: null, tooLarge: false }
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let totalBytes = 0
  let rawBody = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > MAX_FORM_BODY_BYTES) {
      await reader.cancel().catch(() => undefined)
      return { body: null, tooLarge: true }
    }
    rawBody += decoder.decode(value, { stream: true })
  }

  rawBody += decoder.decode()
  return { body: parsePublicFormJson(rawBody), tooLarge: false }
}

export async function enforcePublicFormRateLimit(args: { request: Request; channelId: string }) {
  const ip = getPublicRequestIp(args.request)
  const minuteLimit = positiveInteger(process.env.PUBLIC_FORM_RATE_LIMIT_PER_MINUTE, 5)
  const hourLimit = positiveInteger(process.env.PUBLIC_FORM_RATE_LIMIT_PER_HOUR, 30)
  const channelDailyLimit = positiveInteger(process.env.PUBLIC_FORM_RATE_LIMIT_CHANNEL_DAILY, 2000)
  const rules: RateLimitRule[] = [
    { scope: 'ip-minute', identifier: `${ip}:${args.channelId}`, limit: minuteLimit, windowSeconds: 60 },
    { scope: 'ip-hour', identifier: `${ip}:${args.channelId}`, limit: hourLimit, windowSeconds: 3600 },
    { scope: 'channel-day', identifier: args.channelId, limit: channelDailyLimit, windowSeconds: 86400 },
  ]

  for (const rule of rules) {
    const result = await consumeRateLimitRule(rule)
    if (!result.allowed) return result
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

export async function enforcePublicActionRateLimit(args: {
  request: Request
  scope: string
  identifier: string
  limit: number
  windowSeconds: number
}) {
  return consumeRateLimitRule({
    scope: args.scope,
    identifier: `${getPublicRequestIp(args.request)}:${args.identifier}`,
    limit: args.limit,
    windowSeconds: args.windowSeconds,
  })
}

export async function verifyTurnstileToken(args: { token: string; request: Request }) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return { configured: false, success: true }
  if (!args.token) return { configured: true, success: false }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret,
      response: args.token,
      remoteip: getPublicRequestIp(args.request),
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null)

  if (!response?.ok) return { configured: true, success: false }
  const payload = await response.json().catch(() => null) as { success?: boolean; hostname?: string } | null
  return {
    configured: true,
    success: payload?.success === true && await isAllowedTurnstileHostname(payload.hostname || ''),
  }
}

export function isLikelyAutomatedSubmission(body: Record<string, unknown>) {
  if (String(body.website ?? '').trim()) return true
  const startedAt = Number(body.formStartedAt)
  if (!Number.isFinite(startedAt) || startedAt <= 0) return false
  const elapsedMs = Date.now() - startedAt
  return elapsedMs < 1500 || elapsedMs > 24 * 60 * 60 * 1000
}

export function boundedFormString(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength)
}

export function isValidPublicFormEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isSafePublicHttpUrl(value: string) {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}
