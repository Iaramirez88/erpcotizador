import { headers } from 'next/headers'
import {
  normalizeWebFormCustomFields,
  normalizeWebFormVariables,
  type WebFormCustomField,
  type WebFormVariable,
} from '@/lib/crm-web-form-schema'

export type PublicWebFormSettings = {
  publicEmbedEnabled: boolean
  allowedDomains: string[]
  iframeHeight: string
  accentColor: string
  pageBackgroundColor: string
  backgroundColor: string
  fontFamily: string
  fontSize: string
  labelColor: string
  inputTextColor: string
  inputBackgroundColor: string
  inputBorderColor: string
  ctaColor: string
  ctaTextColor: string
  formTitle: string
  formDescription: string
  submitCtaLabel: string
  successMessage: string
  formCardRadius: string
  inputRadius: string
  fieldSpacing: string
  formPadding: string
  showNameField: boolean
  showEmailField: boolean
  showPhoneField: boolean
  showCompanyField: boolean
  showCityField: boolean
  showProductField: boolean
  showMessageField: boolean
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  companyLabel: string
  companyPlaceholder: string
  cityLabel: string
  cityPlaceholder: string
  productLabel: string
  productPlaceholder: string
  messageLabel: string
  messagePlaceholder: string
  customFields: WebFormCustomField[]
  variables: WebFormVariable[]
  termsEnabled: boolean
  termsRequired: boolean
  termsLabel: string
  termsLinkText: string
  termsLinkUrl: string
}

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
}

function matchesAllowedHost(host: string, allowedHost: string) {
  if (!allowedHost) return false
  if (host === allowedHost) return true
  return host.endsWith(`.${allowedHost}`)
}

function getStringSetting(settings: Record<string, unknown>, key: string, fallback: string) {
  return typeof settings[key] === 'string' && settings[key]?.toString().trim() ? settings[key] as string : fallback
}

function getBooleanSetting(settings: Record<string, unknown>, key: string, fallback: boolean) {
  return typeof settings[key] === 'boolean' ? settings[key] as boolean : fallback
}

function getPixelSetting(settings: Record<string, unknown>, key: string, fallback: string) {
  const rawValue = getStringSetting(settings, key, fallback)
  const digits = rawValue.replace(/[^0-9]/g, '')
  return digits || fallback
}

export function getPublicWebFormSettings(settingsJson: unknown): PublicWebFormSettings {
  const settings = settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson)
    ? settingsJson as Record<string, unknown>
    : {}

  const rawAllowedDomains = getStringSetting(settings, 'allowedDomains', '')
  const allowedDomains = rawAllowedDomains
    .split(/[\n,;]+/)
    .map((value) => normalizeHost(value))
    .filter(Boolean)

  return {
    publicEmbedEnabled: getBooleanSetting(settings, 'publicEmbedEnabled', true),
    allowedDomains,
    iframeHeight: getPixelSetting(settings, 'iframeHeight', '840'),
    accentColor: getStringSetting(settings, 'accentColor', '#1d4ed8'),
    pageBackgroundColor: getStringSetting(settings, 'pageBackgroundColor', '#eef5ff'),
    backgroundColor: getStringSetting(settings, 'backgroundColor', '#ffffff'),
    fontFamily: getStringSetting(settings, 'fontFamily', 'ui-sans-serif, system-ui, sans-serif'),
    fontSize: getPixelSetting(settings, 'formFontSize', '14'),
    labelColor: getStringSetting(settings, 'formLabelColor', '#0f172a'),
    inputTextColor: getStringSetting(settings, 'formInputTextColor', '#0f172a'),
    inputBackgroundColor: getStringSetting(settings, 'formInputBackgroundColor', '#ffffff'),
    inputBorderColor: getStringSetting(settings, 'formInputBorderColor', '#cbd5e1'),
    ctaColor: getStringSetting(settings, 'formCtaColor', getStringSetting(settings, 'accentColor', '#1d4ed8')),
    ctaTextColor: getStringSetting(settings, 'formCtaTextColor', '#ffffff'),
    formTitle: getStringSetting(settings, 'formTitle', 'Solicita tu cotización'),
    formDescription: getStringSetting(settings, 'formDescription', 'Completa el formulario y nuestro equipo comercial te contactará.'),
    submitCtaLabel: getStringSetting(settings, 'submitCtaLabel', 'Enviar solicitud'),
    successMessage: getStringSetting(settings, 'formSuccessMessage', 'Gracias. Ya recibimos tu solicitud y la estamos enviando al CRM.'),
    formCardRadius: getPixelSetting(settings, 'formCardRadius', '28'),
    inputRadius: getPixelSetting(settings, 'formInputRadius', '16'),
    fieldSpacing: getPixelSetting(settings, 'formFieldSpacing', '14'),
    formPadding: getPixelSetting(settings, 'formPadding', '24'),
    showNameField: getBooleanSetting(settings, 'showNameField', true),
    showEmailField: getBooleanSetting(settings, 'showEmailField', true),
    showPhoneField: getBooleanSetting(settings, 'showPhoneField', true),
    showCompanyField: getBooleanSetting(settings, 'showCompanyField', false),
    showCityField: getBooleanSetting(settings, 'showCityField', false),
    showProductField: getBooleanSetting(settings, 'showProductField', true),
    showMessageField: getBooleanSetting(settings, 'showMessageField', true),
    nameLabel: getStringSetting(settings, 'nameLabel', 'Nombre'),
    namePlaceholder: getStringSetting(settings, 'namePlaceholder', 'Tu nombre'),
    emailLabel: getStringSetting(settings, 'emailLabel', 'Correo'),
    emailPlaceholder: getStringSetting(settings, 'emailPlaceholder', 'tu@correo.com'),
    phoneLabel: getStringSetting(settings, 'phoneLabel', 'Teléfono o WhatsApp'),
    phonePlaceholder: getStringSetting(settings, 'phonePlaceholder', '300 000 0000'),
    companyLabel: getStringSetting(settings, 'companyLabel', 'Empresa'),
    companyPlaceholder: getStringSetting(settings, 'companyPlaceholder', 'Nombre de la empresa'),
    cityLabel: getStringSetting(settings, 'cityLabel', 'Ciudad'),
    cityPlaceholder: getStringSetting(settings, 'cityPlaceholder', 'Ciudad o sede'),
    productLabel: getStringSetting(settings, 'productLabel', 'Producto'),
    productPlaceholder: getStringSetting(settings, 'productPlaceholder', '¿Qué producto necesitas?'),
    messageLabel: getStringSetting(settings, 'messageLabel', 'Mensaje'),
    messagePlaceholder: getStringSetting(settings, 'messagePlaceholder', 'Cuéntanos qué necesitas y para cuándo.'),
    customFields: normalizeWebFormCustomFields(settings.webFormCustomFields),
    variables: normalizeWebFormVariables(settings.webFormVariables),
    termsEnabled: getBooleanSetting(settings, 'termsEnabled', false),
    termsRequired: getBooleanSetting(settings, 'termsRequired', true),
    termsLabel: getStringSetting(settings, 'termsLabel', 'Acepto el tratamiento de datos personales.'),
    termsLinkText: getStringSetting(settings, 'termsLinkText', 'Leer términos'),
    termsLinkUrl: getStringSetting(settings, 'termsLinkUrl', ''),
  }
}

export function extractHostFromUrl(rawValue: string | null | undefined) {
  if (!rawValue) return ''
  try {
    return normalizeHost(new URL(rawValue).host)
  } catch {
    return normalizeHost(rawValue)
  }
}

export function isPublicWebFormDomainAllowed(args: {
  allowedDomains: string[]
  candidateHost?: string | null
}) {
  const candidateHost = normalizeHost(args.candidateHost || '')
  if (!args.allowedDomains.length) return true
  if (!candidateHost) return false

  return args.allowedDomains.some((allowedHost) => matchesAllowedHost(candidateHost, allowedHost))
}

export async function getRequestHost() {
  const requestHeaders = await headers()
  return normalizeHost(requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '')
}

export async function getReferrerHost() {
  const requestHeaders = await headers()
  return extractHostFromUrl(requestHeaders.get('referer'))
}