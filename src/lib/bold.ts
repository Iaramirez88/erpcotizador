import crypto from 'node:crypto'

export type BoldPaymentMethod = 'CREDIT_CARD' | 'PSE' | 'BOTON_BANCOLOMBIA' | 'NEQUI'

export type CreateBoldPaymentLinkInput = {
  reference: string
  amountCOP: number
  description?: string
  payerEmail?: string
  callbackUrl?: string
  expirationNanoseconds?: number
  paymentMethods?: BoldPaymentMethod[]
}

export type CreateBoldPaymentLinkResult = {
  paymentLinkId: string
  url: string
}

const BOLD_LINKS_BASE_URL = 'https://integrations.api.bold.co'

export async function createBoldPaymentLink(input: CreateBoldPaymentLinkInput): Promise<CreateBoldPaymentLinkResult> {
  const apiKey = process.env.BOLD_IDENTITY_KEY
  if (!apiKey) {
    throw new Error('BOLD_IDENTITY_KEY no configurada')
  }

  const body: Record<string, unknown> = {
    amount_type: 'CLOSE',
    amount: {
      currency: 'COP',
      total_amount: Math.round(input.amountCOP),
      tip_amount: 0,
      taxes: [],
    },
    reference: input.reference,
  }

  if (input.description) body.description = input.description
  if (input.payerEmail) body.payer_email = input.payerEmail
  if (input.expirationNanoseconds) body.expiration_date = input.expirationNanoseconds
  if (input.paymentMethods?.length) body.payment_methods = input.paymentMethods

  // Bold exige https:// para callback_url; en local normalmente no aplica.
  if (input.callbackUrl?.startsWith('https://')) {
    body.callback_url = input.callbackUrl
  }

  const res = await fetch(`${BOLD_LINKS_BASE_URL}/online/link/v1`, {
    method: 'POST',
    headers: {
      Authorization: `x-api-key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const json = (await res.json().catch(() => null)) as
    | { payload?: { payment_link?: string; url?: string }; errors?: unknown[] }
    | null

  if (!res.ok) {
    throw new Error(`Bold error (${res.status}): ${JSON.stringify(json)}`)
  }

  const paymentLinkId = json?.payload?.payment_link
  const url = json?.payload?.url
  if (!paymentLinkId || !url) {
    throw new Error('Respuesta inválida de Bold (sin payment_link/url)')
  }

  return { paymentLinkId, url }
}

export function verifyBoldWebhookSignature(params: { rawBody: Buffer; signatureHex: string | null; secret: string }): boolean {
  const { rawBody, signatureHex, secret } = params
  if (!signatureHex) return false

  const base64Body = rawBody.toString('utf8')
  const encoded = Buffer.from(base64Body, 'utf8').toString('base64')

  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('hex')

  const expectedBuf = Buffer.from(expected)
  const receivedBuf = Buffer.from(signatureHex)
  if (expectedBuf.length !== receivedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, receivedBuf)
}
