export type WebFormPurpose = 'LEAD_CAPTURE' | 'INCENTIVE' | 'THANK_YOU_REDIRECT' | 'COUPON'

export type WebFormRewardType = 'PDF' | 'LINK'

export type WebFormRewardDeliveryMode = 'EMAIL' | 'WHATSAPP' | 'BOTH'

export type WebFormPurposeOption = {
  id: WebFormPurpose
  label: string
  shortLabel: string
  description: string
  outcome: string
}

export type WebFormPurposeFormState = {
  webFormPurpose: WebFormPurpose
  incentiveRewardType: WebFormRewardType
  incentiveRewardUrl: string
  incentiveRewardLabel: string
  incentiveDeliveryMode: WebFormRewardDeliveryMode
  incentiveEmailSubject: string
  incentiveEmailMessage: string
  incentiveWhatsAppMessage: string
  incentiveWhatsAppSupport: string
  incentiveThankYouMessage: string
  thankYouRedirectUrl: string
  thankYouRedirectDelay: string
  thankYouRedirectMessage: string
  couponEnabled: boolean
  couponCode: string
  couponLabel: string
  couponQueryParam: string
  couponMessage: string
  couponRedirectUrl: string
}

export type WebFormIncentiveConfig = {
  rewardType: WebFormRewardType
  rewardUrl: string
  rewardLabel: string
  deliveryMode: WebFormRewardDeliveryMode
  emailSubject: string
  emailMessage: string
  whatsAppMessage: string
  whatsAppSupport: string
  thankYouMessage: string
}

export type WebFormRedirectConfig = {
  url: string
  delaySeconds: number
  message: string
}

export type WebFormCouponConfig = {
  enabled: boolean
  code: string
  label: string
  queryParam: string
  message: string
  redirectUrl: string
}

export type WebFormPurposeConfig = {
  purpose: WebFormPurpose
  incentive: WebFormIncentiveConfig
  redirect: WebFormRedirectConfig
  coupon: WebFormCouponConfig
}

export const WEB_FORM_PURPOSE_OPTIONS: WebFormPurposeOption[] = [
  {
    id: 'LEAD_CAPTURE',
    label: 'Captura básica de leads',
    shortLabel: 'Más información',
    description: 'El visitante deja sus datos y el equipo comercial lo contacta. Sin entregables ni redirecciones.',
    outcome: 'Lead en el CRM + mensaje de gracias',
  },
  {
    id: 'INCENTIVE',
    label: 'Entrega de regalo (reciprocidad)',
    shortLabel: 'Regalo inmediato',
    description: 'Al enviar el formulario entregamos un PDF o un link de acceso por correo o WhatsApp.',
    outcome: 'Lead + recurso entregado automáticamente',
  },
  {
    id: 'THANK_YOU_REDIRECT',
    label: 'Thank you page',
    shortLabel: 'Redirección',
    description: 'Después de enviar, el visitante es redirigido a una página de agradecimiento o de oferta.',
    outcome: 'Lead + redirección a una URL específica',
  },
  {
    id: 'COUPON',
    label: 'Cupón de descuento',
    shortLabel: 'Cupón',
    description: 'El formulario entrega un cupón y cada lead queda etiquetado con ese código para filtrar la campaña.',
    outcome: 'Lead etiquetado con cupón + código visible',
  },
]

export const WEB_FORM_REWARD_TYPE_OPTIONS: Array<{ value: WebFormRewardType; label: string }> = [
  { value: 'PDF', label: 'PDF descargable' },
  { value: 'LINK', label: 'Link de acceso' },
]

export const WEB_FORM_REWARD_DELIVERY_OPTIONS: Array<{ value: WebFormRewardDeliveryMode; label: string; helper: string }> = [
  { value: 'EMAIL', label: 'Correo electrónico', helper: 'Se envía automáticamente al correo que deje el visitante.' },
  { value: 'WHATSAPP', label: 'WhatsApp', helper: 'Se envía al WhatsApp del visitante usando el canal de WhatsApp Cloud conectado.' },
  { value: 'BOTH', label: 'El visitante elige', helper: 'El formulario muestra la opción correo o WhatsApp y valida el dato correspondiente.' },
]

function normalizeString(value: unknown) {
  return String(value ?? '').trim()
}

function readString(settings: Record<string, unknown>, key: string, fallback: string) {
  const value = settings[key]
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readBoolean(settings: Record<string, unknown>, key: string, fallback: boolean) {
  return typeof settings[key] === 'boolean' ? settings[key] as boolean : fallback
}

export function normalizeWebFormPurpose(value: unknown): WebFormPurpose {
  const normalized = normalizeString(value).toUpperCase()
  if (normalized === 'INCENTIVE' || normalized === 'THANK_YOU_REDIRECT' || normalized === 'COUPON') {
    return normalized
  }
  return 'LEAD_CAPTURE'
}

export function normalizeWebFormRewardType(value: unknown): WebFormRewardType {
  return normalizeString(value).toUpperCase() === 'LINK' ? 'LINK' : 'PDF'
}

export function normalizeWebFormRewardDeliveryMode(value: unknown): WebFormRewardDeliveryMode {
  const normalized = normalizeString(value).toUpperCase()
  if (normalized === 'WHATSAPP' || normalized === 'BOTH') return normalized
  return 'EMAIL'
}

export function normalizeWebFormCouponCode(value: unknown) {
  return normalizeString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '')
    .slice(0, 40)
}

export function normalizeWebFormRedirectSeconds(value: unknown, fallback = 0) {
  const parsed = Number.parseInt(normalizeString(value).replace(/[^0-9]/g, ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, 0), 30)
}

export function getDefaultWebFormPurposeFormState(): WebFormPurposeFormState {
  return {
    webFormPurpose: 'LEAD_CAPTURE',
    incentiveRewardType: 'PDF',
    incentiveRewardUrl: '',
    incentiveRewardLabel: 'Descargar mi regalo',
    incentiveDeliveryMode: 'BOTH',
    incentiveEmailSubject: 'Tu regalo por completar el formulario',
    incentiveEmailMessage: 'Gracias por completar el formulario. Aquí tienes el recurso que te prometimos.',
    incentiveWhatsAppMessage: '¡Gracias por completar el formulario! Aquí tienes tu regalo:',
    incentiveWhatsAppSupport: '',
    incentiveThankYouMessage: '¡Listo! Enviamos tu regalo a {destino}.',
    thankYouRedirectUrl: '',
    thankYouRedirectDelay: '0',
    thankYouRedirectMessage: 'Te estamos redirigiendo a nuestra página de agradecimiento...',
    couponEnabled: false,
    couponCode: '',
    couponLabel: 'Cupón de descuento',
    couponQueryParam: 'cupon',
    couponMessage: 'Guarda este cupón y úsalo en tu próxima compra.',
    couponRedirectUrl: '',
  }
}

export function getWebFormPurposeFormState(settingsJson: unknown): WebFormPurposeFormState {
  const settings = settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson)
    ? settingsJson as Record<string, unknown>
    : {}
  const defaults = getDefaultWebFormPurposeFormState()

  return {
    webFormPurpose: normalizeWebFormPurpose(settings.webFormPurpose),
    incentiveRewardType: normalizeWebFormRewardType(settings.incentiveRewardType),
    incentiveRewardUrl: readString(settings, 'incentiveRewardUrl', defaults.incentiveRewardUrl),
    incentiveRewardLabel: readString(settings, 'incentiveRewardLabel', defaults.incentiveRewardLabel),
    incentiveDeliveryMode: normalizeWebFormRewardDeliveryMode(settings.incentiveDeliveryMode),
    incentiveEmailSubject: readString(settings, 'incentiveEmailSubject', defaults.incentiveEmailSubject),
    incentiveEmailMessage: readString(settings, 'incentiveEmailMessage', defaults.incentiveEmailMessage),
    incentiveWhatsAppMessage: readString(settings, 'incentiveWhatsAppMessage', defaults.incentiveWhatsAppMessage),
    incentiveWhatsAppSupport: readString(settings, 'incentiveWhatsAppSupport', defaults.incentiveWhatsAppSupport),
    incentiveThankYouMessage: readString(settings, 'incentiveThankYouMessage', defaults.incentiveThankYouMessage),
    thankYouRedirectUrl: readString(settings, 'thankYouRedirectUrl', defaults.thankYouRedirectUrl),
    thankYouRedirectDelay: String(normalizeWebFormRedirectSeconds(settings.thankYouRedirectDelay, 0)),
    thankYouRedirectMessage: readString(settings, 'thankYouRedirectMessage', defaults.thankYouRedirectMessage),
    couponEnabled: readBoolean(settings, 'couponEnabled', defaults.couponEnabled),
    couponCode: readString(settings, 'couponCode', defaults.couponCode),
    couponLabel: readString(settings, 'couponLabel', defaults.couponLabel),
    couponQueryParam: readString(settings, 'couponQueryParam', defaults.couponQueryParam),
    couponMessage: readString(settings, 'couponMessage', defaults.couponMessage),
    couponRedirectUrl: readString(settings, 'couponRedirectUrl', defaults.couponRedirectUrl),
  }
}

export function getWebFormPurposeConfig(settingsJson: unknown): WebFormPurposeConfig {
  const formState = getWebFormPurposeFormState(settingsJson)
  const purpose = formState.webFormPurpose

  return {
    purpose,
    incentive: {
      rewardType: formState.incentiveRewardType,
      rewardUrl: formState.incentiveRewardUrl,
      rewardLabel: formState.incentiveRewardLabel,
      deliveryMode: formState.incentiveDeliveryMode,
      emailSubject: formState.incentiveEmailSubject,
      emailMessage: formState.incentiveEmailMessage,
      whatsAppMessage: formState.incentiveWhatsAppMessage,
      whatsAppSupport: formState.incentiveWhatsAppSupport,
      thankYouMessage: formState.incentiveThankYouMessage,
    },
    redirect: {
      url: formState.thankYouRedirectUrl,
      delaySeconds: normalizeWebFormRedirectSeconds(formState.thankYouRedirectDelay, 0),
      message: formState.thankYouRedirectMessage,
    },
    coupon: {
      enabled: formState.couponEnabled || purpose === 'COUPON',
      code: normalizeWebFormCouponCode(formState.couponCode),
      label: formState.couponLabel,
      queryParam: formState.couponQueryParam,
      message: formState.couponMessage,
      redirectUrl: formState.couponRedirectUrl,
    },
  }
}

export function pickWebFormPurposeFormState(source: Partial<WebFormPurposeFormState> | null | undefined): WebFormPurposeFormState {
  const defaults = getDefaultWebFormPurposeFormState()
  const input = source ?? {}

  return {
    webFormPurpose: input.webFormPurpose ?? defaults.webFormPurpose,
    incentiveRewardType: input.incentiveRewardType ?? defaults.incentiveRewardType,
    incentiveRewardUrl: input.incentiveRewardUrl ?? defaults.incentiveRewardUrl,
    incentiveRewardLabel: input.incentiveRewardLabel ?? defaults.incentiveRewardLabel,
    incentiveDeliveryMode: input.incentiveDeliveryMode ?? defaults.incentiveDeliveryMode,
    incentiveEmailSubject: input.incentiveEmailSubject ?? defaults.incentiveEmailSubject,
    incentiveEmailMessage: input.incentiveEmailMessage ?? defaults.incentiveEmailMessage,
    incentiveWhatsAppMessage: input.incentiveWhatsAppMessage ?? defaults.incentiveWhatsAppMessage,
    incentiveWhatsAppSupport: input.incentiveWhatsAppSupport ?? defaults.incentiveWhatsAppSupport,
    incentiveThankYouMessage: input.incentiveThankYouMessage ?? defaults.incentiveThankYouMessage,
    thankYouRedirectUrl: input.thankYouRedirectUrl ?? defaults.thankYouRedirectUrl,
    thankYouRedirectDelay: input.thankYouRedirectDelay ?? defaults.thankYouRedirectDelay,
    thankYouRedirectMessage: input.thankYouRedirectMessage ?? defaults.thankYouRedirectMessage,
    couponEnabled: input.couponEnabled ?? defaults.couponEnabled,
    couponCode: input.couponCode ?? defaults.couponCode,
    couponLabel: input.couponLabel ?? defaults.couponLabel,
    couponQueryParam: input.couponQueryParam ?? defaults.couponQueryParam,
    couponMessage: input.couponMessage ?? defaults.couponMessage,
    couponRedirectUrl: input.couponRedirectUrl ?? defaults.couponRedirectUrl,
  }
}

export function getWebFormPurposeLabel(purpose: WebFormPurpose) {
  return WEB_FORM_PURPOSE_OPTIONS.find((item) => item.id === purpose)?.label ?? 'Captura básica de leads'
}

export function getWebFormPurposeShortLabel(purpose: WebFormPurpose) {
  return WEB_FORM_PURPOSE_OPTIONS.find((item) => item.id === purpose)?.shortLabel ?? 'Más información'
}

export function describeWebFormPurpose(config: WebFormPurposeConfig) {
  if (config.purpose === 'INCENTIVE') {
    const channel = config.incentive.deliveryMode === 'BOTH'
      ? 'correo o WhatsApp a elección'
      : config.incentive.deliveryMode === 'WHATSAPP'
        ? 'WhatsApp'
        : 'correo'
    return `Entrega ${config.incentive.rewardType === 'PDF' ? 'un PDF' : 'un link'} por ${channel}`
  }
  if (config.purpose === 'THANK_YOU_REDIRECT') {
    return config.redirect.url ? 'Redirige a thank you page' : 'Falta configurar la URL de redirección'
  }
  if (config.purpose === 'COUPON') {
    return config.coupon.code ? `Cupón ${config.coupon.code}` : 'Falta definir el código del cupón'
  }
  return 'Captura de datos y contacto comercial'
}
