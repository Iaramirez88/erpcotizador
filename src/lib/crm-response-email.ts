import { escapeHtml } from '@/lib/email-template'

export type CrmResponseEmailVariables = {
  nombre?: string
  email?: string
  telefono?: string
  fecha?: string
  hora?: string
  servicio?: string
  canal?: string
  cupon?: string
  enlace?: string
  empresa?: string
}

export type CrmResponseEmailSettings = {
  enabled: boolean
  fromName: string
  replyTo: string
  subject: string
  preheader: string
  title: string
  intro: string
  bodyText: string
  ctaLabel: string
  ctaUrl: string
  footerNote: string
  accentColor: string
  backgroundColor: string
  cardColor: string
  textColor: string
  logoUrl: string
  brandName: string
  showBrand: boolean
}

export type CrmResponseEmailFormState = {
  responseEmailEnabled: boolean
  responseEmailFromName: string
  responseEmailReplyTo: string
  responseEmailSubject: string
  responseEmailPreheader: string
  responseEmailTitle: string
  responseEmailIntro: string
  responseEmailBody: string
  responseEmailCtaLabel: string
  responseEmailCtaUrl: string
  responseEmailFooter: string
  responseEmailAccentColor: string
  responseEmailBackgroundColor: string
  responseEmailCardColor: string
  responseEmailTextColor: string
  responseEmailLogoUrl: string
  responseEmailBrandName: string
  responseEmailShowBrand: boolean
}

export const CRM_RESPONSE_EMAIL_VARIABLES = [
  { token: '{{nombre}}', label: 'Nombre del contacto' },
  { token: '{{email}}', label: 'Correo del contacto' },
  { token: '{{telefono}}', label: 'Teléfono del contacto' },
  { token: '{{fecha}}', label: 'Fecha (cita o registro)' },
  { token: '{{hora}}', label: 'Hora de la cita' },
  { token: '{{servicio}}', label: 'Servicio o producto' },
  { token: '{{canal}}', label: 'Nombre del canal' },
  { token: '{{cupon}}', label: 'Cupón entregado' },
  { token: '{{enlace}}', label: 'Enlace de regalo o descarga' },
]

function normalizeString(value: unknown) {
  return String(value ?? '').trim()
}

function getSetting(settings: Record<string, unknown>, key: string, fallback: string) {
  const value = normalizeString(settings[key])
  return value || fallback
}

function getBool(settings: Record<string, unknown>, key: string, fallback: boolean) {
  return typeof settings[key] === 'boolean' ? settings[key] as boolean : fallback
}

export function getCrmResponseEmailSettings(settingsJson: unknown): CrmResponseEmailSettings {
  const settings = settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson)
    ? settingsJson as Record<string, unknown>
    : {}

  return {
    enabled: getBool(settings, 'responseEmailEnabled', true),
    fromName: getSetting(settings, 'responseEmailFromName', ''),
    replyTo: getSetting(settings, 'responseEmailReplyTo', ''),
    subject: getSetting(settings, 'responseEmailSubject', 'Recibimos tu solicitud · {{canal}}'),
    preheader: getSetting(settings, 'responseEmailPreheader', 'Tu solicitud quedó registrada y ya está en manos de nuestro equipo.'),
    title: getSetting(settings, 'responseEmailTitle', '¡Gracias, {{nombre}}!'),
    intro: getSetting(settings, 'responseEmailIntro', 'Ya registramos tus datos. Un asesor se pondrá en contacto contigo muy pronto.'),
    bodyText: getSetting(settings, 'responseEmailBody', 'Fecha: {{fecha}}\nServicio: {{servicio}}\nCupón: {{cupon}}'),
    ctaLabel: getSetting(settings, 'responseEmailCtaLabel', ''),
    ctaUrl: getSetting(settings, 'responseEmailCtaUrl', ''),
    footerNote: getSetting(settings, 'responseEmailFooter', 'Si necesitas ajustar algo, responde este correo y te ayudamos.'),
    accentColor: getSetting(settings, 'responseEmailAccentColor', '#1d4ed8'),
    backgroundColor: getSetting(settings, 'responseEmailBackgroundColor', '#f3f4f6'),
    cardColor: getSetting(settings, 'responseEmailCardColor', '#ffffff'),
    textColor: getSetting(settings, 'responseEmailTextColor', '#111827'),
    logoUrl: getSetting(settings, 'responseEmailLogoUrl', ''),
    brandName: getSetting(settings, 'responseEmailBrandName', 'Ordex'),
    showBrand: getBool(settings, 'responseEmailShowBrand', true),
  }
}

export function getDefaultCrmResponseEmailFormState(): CrmResponseEmailFormState {
  const defaults = getCrmResponseEmailSettings(null)
  return {
    responseEmailEnabled: defaults.enabled,
    responseEmailFromName: '',
    responseEmailReplyTo: '',
    responseEmailSubject: defaults.subject,
    responseEmailPreheader: defaults.preheader,
    responseEmailTitle: defaults.title,
    responseEmailIntro: defaults.intro,
    responseEmailBody: defaults.bodyText,
    responseEmailCtaLabel: '',
    responseEmailCtaUrl: '',
    responseEmailFooter: defaults.footerNote,
    responseEmailAccentColor: defaults.accentColor,
    responseEmailBackgroundColor: defaults.backgroundColor,
    responseEmailCardColor: defaults.cardColor,
    responseEmailTextColor: defaults.textColor,
    responseEmailLogoUrl: '',
    responseEmailBrandName: defaults.brandName,
    responseEmailShowBrand: true,
  }
}

export function getCrmResponseEmailFormState(settingsJson: unknown): CrmResponseEmailFormState {
  const settings = getCrmResponseEmailSettings(settingsJson)
  return {
    responseEmailEnabled: settings.enabled,
    responseEmailFromName: settings.fromName,
    responseEmailReplyTo: settings.replyTo,
    responseEmailSubject: settings.subject,
    responseEmailPreheader: settings.preheader,
    responseEmailTitle: settings.title,
    responseEmailIntro: settings.intro,
    responseEmailBody: settings.bodyText,
    responseEmailCtaLabel: settings.ctaLabel,
    responseEmailCtaUrl: settings.ctaUrl,
    responseEmailFooter: settings.footerNote,
    responseEmailAccentColor: settings.accentColor,
    responseEmailBackgroundColor: settings.backgroundColor,
    responseEmailCardColor: settings.cardColor,
    responseEmailTextColor: settings.textColor,
    responseEmailLogoUrl: settings.logoUrl,
    responseEmailBrandName: settings.brandName,
    responseEmailShowBrand: settings.showBrand,
  }
}

export function pickCrmResponseEmailFormState(source: Partial<CrmResponseEmailFormState> | null | undefined): CrmResponseEmailFormState {
  const defaults = getDefaultCrmResponseEmailFormState()
  const input = source ?? {}
  return {
    responseEmailEnabled: typeof input.responseEmailEnabled === 'boolean' ? input.responseEmailEnabled : defaults.responseEmailEnabled,
    responseEmailFromName: normalizeString(input.responseEmailFromName),
    responseEmailReplyTo: normalizeString(input.responseEmailReplyTo),
    responseEmailSubject: normalizeString(input.responseEmailSubject) || defaults.responseEmailSubject,
    responseEmailPreheader: normalizeString(input.responseEmailPreheader) || defaults.responseEmailPreheader,
    responseEmailTitle: normalizeString(input.responseEmailTitle) || defaults.responseEmailTitle,
    responseEmailIntro: normalizeString(input.responseEmailIntro) || defaults.responseEmailIntro,
    responseEmailBody: typeof input.responseEmailBody === 'string' ? input.responseEmailBody : defaults.responseEmailBody,
    responseEmailCtaLabel: normalizeString(input.responseEmailCtaLabel),
    responseEmailCtaUrl: normalizeString(input.responseEmailCtaUrl),
    responseEmailFooter: normalizeString(input.responseEmailFooter) || defaults.responseEmailFooter,
    responseEmailAccentColor: normalizeString(input.responseEmailAccentColor) || defaults.responseEmailAccentColor,
    responseEmailBackgroundColor: normalizeString(input.responseEmailBackgroundColor) || defaults.responseEmailBackgroundColor,
    responseEmailCardColor: normalizeString(input.responseEmailCardColor) || defaults.responseEmailCardColor,
    responseEmailTextColor: normalizeString(input.responseEmailTextColor) || defaults.responseEmailTextColor,
    responseEmailLogoUrl: normalizeString(input.responseEmailLogoUrl),
    responseEmailBrandName: normalizeString(input.responseEmailBrandName) || defaults.responseEmailBrandName,
    responseEmailShowBrand: typeof input.responseEmailShowBrand === 'boolean' ? input.responseEmailShowBrand : defaults.responseEmailShowBrand,
  }
}

export function serializeCrmResponseEmailFormState(state: CrmResponseEmailFormState) {
  return pickCrmResponseEmailFormState(state)
}

export function resolveCrmResponseEmailText(template: string, variables: CrmResponseEmailVariables) {
  const normalized = {
    nombre: variables.nombre?.trim() || 'cliente',
    email: variables.email?.trim() || '',
    telefono: variables.telefono?.trim() || '',
    fecha: variables.fecha?.trim() || '',
    hora: variables.hora?.trim() || '',
    servicio: variables.servicio?.trim() || '',
    canal: variables.canal?.trim() || '',
    cupon: variables.cupon?.trim() || '',
    enlace: variables.enlace?.trim() || '',
    empresa: variables.empresa?.trim() || '',
  }

  return template.replace(/\{\{\s*(nombre|email|telefono|fecha|hora|servicio|canal|cupon|enlace|empresa)\s*\}\}/gi, (_match, key: string) => {
    return normalized[key.toLowerCase() as keyof typeof normalized] || ''
  })
}

function renderEmailTextLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 8px;">${escapeHtml(line)}</p>`)
    .join('')
}

export function renderCrmResponseEmail(args: {
  settings: CrmResponseEmailSettings
  variables: CrmResponseEmailVariables
}) {
  const { settings, variables } = args
  const subject = resolveCrmResponseEmailText(settings.subject, variables) || 'Recibimos tu solicitud'
  const preheader = resolveCrmResponseEmailText(settings.preheader, variables)
  const title = resolveCrmResponseEmailText(settings.title, variables)
  const intro = resolveCrmResponseEmailText(settings.intro, variables)
  const body = resolveCrmResponseEmailText(settings.bodyText, variables)
  const footer = resolveCrmResponseEmailText(settings.footerNote, variables)
  const ctaLabel = resolveCrmResponseEmailText(settings.ctaLabel, variables)
  const ctaUrl = resolveCrmResponseEmailText(settings.ctaUrl, variables)

  const brandBlock = settings.logoUrl
    ? `<img src="${escapeHtml(settings.logoUrl)}" alt="${escapeHtml(settings.brandName)}" style="max-height:42px; max-width:180px; display:block;" />`
    : `<div style="font-family:Arial, sans-serif; font-size:18px; font-weight:700; color:${escapeHtml(settings.textColor)};">${escapeHtml(settings.brandName)}</div>`

  const header = (settings.showBrand || settings.logoUrl)
    ? `<tr><td style="padding:18px 22px; background:${escapeHtml(settings.cardColor)}; border-bottom:1px solid rgba(15,23,42,0.08);">${brandBlock}</td></tr>`
    : ''

  const bodyBlock = body.trim()
    ? `<div style="margin-top:16px; padding:14px 16px; border-radius:12px; background:${escapeHtml(settings.backgroundColor)}; color:${escapeHtml(settings.textColor)}; font-size:14px; line-height:1.6;">${renderEmailTextLines(body)}</div>`
    : ''

  const cta = ctaLabel && /^https?:\/\//i.test(ctaUrl)
    ? `<div style="margin-top:20px;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block; background:${escapeHtml(settings.accentColor)}; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:10px; font-weight:600; font-family:Arial, sans-serif;">${escapeHtml(ctaLabel)}</a></div>`
    : ''

  const preheaderBlock = preheader
    ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}</div>`
    : ''

  const footerBlock = footer.trim()
    ? `<tr><td style="padding:16px 22px; background:${escapeHtml(settings.backgroundColor)}; border-top:1px solid rgba(15,23,42,0.08); font-family:Arial, sans-serif; color:#6b7280; font-size:12px; line-height:1.6;">${renderEmailTextLines(footer)}</td></tr>`
    : ''

  const html = `<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0; padding:0; background:${escapeHtml(settings.backgroundColor)};">
    ${preheaderBlock}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${escapeHtml(settings.backgroundColor)}; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px; max-width:600px; background:${escapeHtml(settings.cardColor)}; border-radius:16px; overflow:hidden; border:1px solid rgba(15,23,42,0.08);">
            ${header}
            <tr>
              <td style="padding:24px 22px; font-family:Arial, sans-serif; color:${escapeHtml(settings.textColor)};">
                <h1 style="margin:0 0 12px; font-size:22px; line-height:1.3; color:${escapeHtml(settings.textColor)};">${escapeHtml(title)}</h1>
                <p style="margin:0; font-size:14px; line-height:1.6; color:${escapeHtml(settings.textColor)};">${escapeHtml(intro)}</p>
                ${bodyBlock}
                ${cta}
              </td>
            </tr>
            ${footerBlock}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [subject, title, intro, body, ctaLabel ? `${ctaLabel}: ${ctaUrl}` : '', footer]
    .filter((line) => line && line.trim())
    .join('\n\n')

  return { subject, html, text }
}
