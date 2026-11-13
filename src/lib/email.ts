import { Resend } from 'resend'

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

type SendEmailArgs = {
  to: string | string[]
  subject: string
  html: string
  fromName?: string
  replyTo?: string
}

function resolveFromAddress(fromName?: string) {
  const baseFrom = process.env.EMAIL_FROM || 'Ordex <onboarding@resend.dev>'
  const name = (fromName || '').trim()
  if (!name) return baseFrom

  const match = /<([^>]+)>/.exec(baseFrom)
  if (match) return `${name} <${match[1]}>`
  if (/^[^\s@]+@[^\s@]+$/.test(baseFrom)) return `${name} <${baseFrom}>`
  return baseFrom
}

export async function sendEmail(args: SendEmailArgs) {
  const resend = getResendClient()
  if (!resend) {
    return {
      ok: false as const,
      status: 500,
      error: 'Email no configurado (falta RESEND_API_KEY).',
    }
  }

  const from = resolveFromAddress(args.fromName)

  const { data, error } = await resend.emails.send({
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
    ...(args.replyTo ? { reply_to: args.replyTo } : {}),
  })

  if (error) {
    const statusCode =
      typeof (error as unknown as { statusCode?: unknown }).statusCode === 'number'
        ? (error as unknown as { statusCode: number }).statusCode
        : 500
    const message =
      typeof (error as unknown as { message?: unknown }).message === 'string'
        ? (error as unknown as { message: string }).message
        : 'Error al enviar el correo'

    return { ok: false as const, status: statusCode, error: message }
  }

  return { ok: true as const, id: data?.id }
}
