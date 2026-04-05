import { headers } from 'next/headers'
import { extractHostFromUrl } from '@/lib/crm-public-chatbot'

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

export async function getRequestHost() {
  const requestHeaders = await headers()
  return normalizeHost(requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
}

export async function getReferrerHost() {
  const requestHeaders = await headers()
  return extractHostFromUrl(requestHeaders.get('referer'))
}