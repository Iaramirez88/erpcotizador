export type EmailCta = {
  label: string
  href: string
}

export type RenderEmailArgs = {
  title: string
  preheader?: string
  intro?: string
  bodyHtml?: string
  cta?: EmailCta
  footerNote?: string
}

export function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function renderEmailCode(code: string, opts?: { size?: 'md' | 'lg' }): string {
  const size = opts?.size ?? 'lg'
  const fontSize = size === 'lg' ? '24px' : '16px'
  const letterSpacing = size === 'lg' ? '6px' : '1px'
  return `
    <div style="margin: 16px 0 18px; text-align:center;">
      <div style="display:inline-block; padding: 14px 16px; border-radius: 12px; border: 1px solid #E5E7EB; background: #F9FAFB; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: ${fontSize}; letter-spacing: ${letterSpacing}; color: #111827;">
        <b>${escapeHtml(code)}</b>
      </div>
    </div>
  `
}

export function renderEmailButton(cta: EmailCta): string {
  return `
    <div style="margin: 18px 0 0; text-align:center;">
      <a href="${cta.href}" style="display:inline-block; background:#2563EB; color:#FFFFFF; text-decoration:none; padding: 12px 18px; border-radius: 10px; font-weight: 600; font-family: Arial, sans-serif;">
        ${escapeHtml(cta.label)}
      </a>
    </div>
  `
}

export function renderEmailLink(href: string, label?: string): string {
  const safeLabel = label ? escapeHtml(label) : escapeHtml(href)
  return `<a href="${href}" style="color:#2563EB; text-decoration:underline;">${safeLabel}</a>`
}

export function renderEmail(args: RenderEmailArgs): string {
  const brandName = 'Ordex'
  const preheader = args.preheader
    ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(args.preheader)}</div>`
    : ''

  const intro = args.intro ? `<p style="margin: 0 0 12px; color:#374151;">${escapeHtml(args.intro)}</p>` : ''
  const body = args.bodyHtml ?? ''
  const cta = args.cta ? renderEmailButton(args.cta) : ''
  const footerNote = args.footerNote
    ? `<p style="margin: 18px 0 0; color:#6B7280; font-size:12px;">${escapeHtml(args.footerNote)}</p>`
    : ''

  // Template estilo "card" centrada (compatible con clientes de correo clásicos)
  return `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(args.title)}</title>
  </head>
  <body style="margin:0; padding:0; background:#F3F4F6;">
    ${preheader}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F3F4F6; padding: 24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px; max-width: 600px; background:#FFFFFF; border:1px solid #E5E7EB; border-radius: 16px; overflow:hidden;">
            <tr>
              <td style="padding: 18px 20px; background:#FFFFFF; border-bottom: 1px solid #E5E7EB;">
                <div style="font-family: Arial, sans-serif; font-size: 18px; font-weight: 700; color:#111827;">${brandName}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 22px 20px 20px; font-family: Arial, sans-serif;">
                <h2 style="margin:0 0 10px; font-size: 22px; line-height: 1.25; color:#111827;">${escapeHtml(args.title)}</h2>
                ${intro}
                <div style="color:#111827; font-size: 14px; line-height: 1.55;">
                  ${body}
                </div>
                ${cta}
                ${footerNote}
              </td>
            </tr>
            <tr>
              <td style="padding: 14px 20px; background:#F9FAFB; border-top: 1px solid #E5E7EB; font-family: Arial, sans-serif; color:#6B7280; font-size: 12px;">
                Este correo fue enviado automáticamente. Si no esperabas este mensaje, puedes ignorarlo.
              </td>
            </tr>
          </table>
          <div style="width:600px; max-width: 600px; font-family: Arial, sans-serif; color:#9CA3AF; font-size: 11px; text-align:center; margin-top: 10px;">
            ${brandName}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
