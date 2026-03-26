import { sanitizeJsonStrings } from '@/lib/utils'

export type EmailLeadAIResult = {
  capturePercent: number
  extractedData: {
    contact?: Record<string, unknown>
    request?: Record<string, unknown>
    semantic?: Record<string, unknown>
  }
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, '')
}

export async function analyzeEmailLead(params: {
  messageText?: string | null
  subject?: string | null
  fromName?: string | null
  fromAddress?: string | null
  phone?: string | null
  company?: string | null
  city?: string | null
  useLlm?: boolean
}): Promise<EmailLeadAIResult | null> {
  const text = String(params.messageText || '').trim()
  const subject = String(params.subject || '').trim()
  if (!text && !subject) return null

  const baseUrl = normalizeBaseUrl(process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8001')

  try {
    const resp = await fetch(`${baseUrl}/extract-email-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.OCR_SERVICE_API_KEY ? { 'X-Api-Key': process.env.OCR_SERVICE_API_KEY } : {}),
      },
      body: JSON.stringify({
        text,
        subject,
        fromName: params.fromName || '',
        fromAddress: params.fromAddress || '',
        phone: params.phone || '',
        company: params.company || '',
        city: params.city || '',
        use_llm: params.useLlm === false ? 'false' : 'true',
      }),
    })

    if (!resp.ok) {
      return null
    }

    const raw = (await resp.json().catch(() => null)) as EmailLeadAIResult | null
    if (!raw || typeof raw !== 'object') return null
    return sanitizeJsonStrings(raw)
  } catch {
    return null
  }
}