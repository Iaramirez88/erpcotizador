"use client"

import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { WebsiteTurnstile } from '@/components/website-builder/website-turnstile'
import type { WebFormPurposeConfig } from '@/lib/crm-web-form-purpose'
import type { WebFormCustomField, WebFormVariable } from '@/lib/crm-web-form-schema'
import { sanitizeWebsiteLinkHref } from '@/lib/website-embed'

type PublicWebFormEmbedProps = {
  channelId: string
  purposeSettings: WebFormPurposeConfig
  title: string
  description: string
  submitLabel: string
  successMessage: string
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

type CustomFieldValue = string | boolean | Array<{ name: string; size: number; type: string }>

type SubmissionResult = {
  coupon: { code: string; label: string; message: string } | null
  reward: {
    type: string
    label: string
    url: string
    delivery: string
    status: string
    message: string
    supportUrl: string | null
  } | null
  redirect: { url: string; delaySeconds: number; message: string } | null
}

function normalizeCoupon(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]+/g, '').slice(0, 40)
}

function openRedirect(url: string) {
  if (typeof window === 'undefined' || !url) return

  try {
    if (window.top && window.top !== window.self) {
      window.top.location.assign(url)
      return
    }
  } catch {
    // El iframe es cross-origin: se intenta avisar al padre y se navega dentro del iframe.
  }

  try {
    window.parent?.postMessage({ type: 'crm-web-form:redirect', url }, '*')
  } catch {
    // Sin acceso al padre: se usa la navegación local como respaldo.
  }
  window.location.assign(url)
}

type FormState = {
  nombre: string
  email: string
  telefono: string
  empresaNombre: string
  ciudad: string
  producto: string
  mensaje: string
}

const initialState: FormState = {
  nombre: '',
  email: '',
  telefono: '',
  empresaNombre: '',
  ciudad: '',
  producto: '',
  mensaje: '',
}

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || ''

export function CrmPublicWebFormEmbed(props: PublicWebFormEmbedProps) {
  const [formState, setFormState] = useState<FormState>(initialState)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, CustomFieldValue>>(() => Object.fromEntries(props.customFields.map((field) => [field.key, field.type === 'check' ? field.defaultValue === 'true' : field.defaultValue || ''])))
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [formStartedAt, setFormStartedAt] = useState(() => Date.now())
  const [turnstileToken, setTurnstileToken] = useState('')
  const [challengeVersion, setChallengeVersion] = useState(0)
  const [result, setResult] = useState<SubmissionResult | null>(null)
  const [couponCode, setCouponCode] = useState(() => normalizeCoupon(props.purposeSettings.coupon.code))
  const [rewardDelivery, setRewardDelivery] = useState<'EMAIL' | 'WHATSAPP'>(() => (
    props.purposeSettings.incentive.deliveryMode === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL'
  ))

  const purpose = props.purposeSettings.purpose
  const incentive = props.purposeSettings.incentive
  const couponSettings = props.purposeSettings.coupon
  const incentiveActive = purpose === 'INCENTIVE'
  const couponActive = couponSettings.enabled
  const requiresEmailDelivery = incentiveActive && (incentive.deliveryMode === 'EMAIL' || incentive.deliveryMode === 'BOTH')
  const requiresWhatsAppDelivery = incentiveActive && (incentive.deliveryMode === 'WHATSAPP' || incentive.deliveryMode === 'BOTH')
  const showEmailField = props.showEmailField || requiresEmailDelivery
  const showPhoneField = props.showPhoneField || requiresWhatsAppDelivery
  const successHeadline = result?.reward
    ? incentive.thankYouMessage.replace('{destino}', result.reward.delivery === 'WHATSAPP' ? 'tu WhatsApp' : 'tu correo')
    : props.successMessage

  useEffect(() => {
    if (typeof window === 'undefined' || !couponActive) return
    const params = new URLSearchParams(window.location.search)
    const paramName = couponSettings.queryParam || 'cupon'
    const fromQuery = normalizeCoupon(params.get(paramName) || params.get('coupon') || params.get('coupon_code') || '')
    if (fromQuery) setCouponCode(fromQuery)
  }, [couponActive, couponSettings.queryParam])

  useEffect(() => {
    if (!result?.redirect?.url) return
    const redirectUrl = result.redirect.url
    const timer = window.setTimeout(() => openRedirect(redirectUrl), Math.max(0, result.redirect.delaySeconds) * 1000)
    return () => window.clearTimeout(timer)
  }, [result])

  const shellStyle = useMemo(() => ({
    background: `radial-gradient(circle at top, rgba(59,130,246,.12), transparent 34%), linear-gradient(180deg, ${props.pageBackgroundColor} 0%, ${props.backgroundColor} 100%)`,
    fontFamily: props.fontFamily,
    fontSize: `${props.fontSize}px`,
    color: props.labelColor,
    minHeight: '100vh',
    padding: '18px',
  }), [props.backgroundColor, props.fontFamily, props.fontSize, props.labelColor, props.pageBackgroundColor])

  const cardStyle = useMemo(() => ({
    backgroundColor: props.backgroundColor,
    borderRadius: `${props.formCardRadius}px`,
    padding: `${props.formPadding}px`,
    boxShadow: '0 28px 70px -34px rgba(15,23,42,.32)',
    border: '1px solid rgba(148,163,184,.26)',
  }), [props.backgroundColor, props.formCardRadius, props.formPadding])

  const inputStyle = useMemo(() => ({
    borderRadius: `${props.inputRadius}px`,
    backgroundColor: props.inputBackgroundColor,
    color: props.inputTextColor,
    border: `1px solid ${props.inputBorderColor}`,
    padding: '12px 14px',
    outline: 'none',
    width: '100%',
  }), [props.inputBackgroundColor, props.inputBorderColor, props.inputRadius, props.inputTextColor])

  const fieldGap = `${props.fieldSpacing}px`
  const hiddenVariables = useMemo(() => {
    if (typeof window === 'undefined') return []
    const params = new URLSearchParams(window.location.search)
    return props.variables.map((variable) => ({
      key: variable.key,
      label: variable.label,
      value: variable.source === 'query' ? params.get(variable.queryParam || variable.key) || '' : variable.value,
    }))
  }, [props.variables])

  function resetCustomFields() {
    setCustomFieldValues(Object.fromEntries(props.customFields.map((field) => [field.key, field.type === 'check' ? field.defaultValue === 'true' : field.defaultValue || ''])))
  }

  function handleFileChange(field: WebFormCustomField, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).map((file) => ({ name: file.name, size: file.size, type: file.type }))
    setCustomFieldValues((current) => ({ ...current, [field.key]: files }))
  }

  function validateCustomFields() {
    for (const field of props.customFields) {
      if (!field.required) continue
      const value = customFieldValues[field.key]
      if (field.type === 'check') {
        if (!value) return `Debes completar el campo ${field.label}.`
        continue
      }
      if (field.type === 'file') {
        if (!Array.isArray(value) || !value.length) return `Debes adjuntar ${field.label}.`
        continue
      }
      if (!String(value ?? '').trim()) return `Debes completar el campo ${field.label}.`
    }
    if (props.termsEnabled && props.termsRequired && !termsAccepted) {
      return 'Debes aceptar los términos antes de enviar el formulario.'
    }
    return ''
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (!formState.nombre.trim() && !formState.email.trim() && !formState.telefono.trim()) {
      setErrorMessage('Incluye al menos nombre, correo o teléfono para capturar el lead.')
      return
    }
    if (incentiveActive && rewardDelivery === 'EMAIL' && !formState.email.trim()) {
      setErrorMessage('Déjanos tu correo electrónico para enviarte el regalo.')
      return
    }
    if (incentiveActive && rewardDelivery === 'WHATSAPP' && !formState.telefono.trim()) {
      setErrorMessage('Déjanos tu número de WhatsApp para enviarte el regalo.')
      return
    }

    const customFieldError = validateCustomFields()
    if (customFieldError) {
      setErrorMessage(customFieldError)
      return
    }
    if (turnstileSiteKey && !turnstileToken) {
      setErrorMessage('Completa la verificación de seguridad.')
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setSuccess(false)
    setResult(null)

    try {
      const parentReferrer = document.referrer || ''
      const trackingUrl = new URL(parentReferrer || window.location.href)
      const response = await fetch('/api/crm/captures/web-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: props.channelId,
          purpose,
          rewardDelivery: incentiveActive ? rewardDelivery : '',
          couponCode: couponActive ? normalizeCoupon(couponCode) : '',
          ...formState,
          customFields: props.customFields.map((field) => ({
            id: field.id,
            key: field.key,
            label: field.label,
            type: field.type,
            value: customFieldValues[field.key] ?? '',
          })),
          variables: hiddenVariables,
          termsAccepted,
          website,
          formStartedAt,
          turnstileToken,
          landingPageUrl: parentReferrer || window.location.href,
          referrerUrl: parentReferrer,
          utmSource: trackingUrl.searchParams.get('utm_source') || '',
          utmMedium: trackingUrl.searchParams.get('utm_medium') || '',
          utmCampaign: trackingUrl.searchParams.get('utm_campaign') || '',
          utmContent: trackingUrl.searchParams.get('utm_content') || '',
          utmTerm: trackingUrl.searchParams.get('utm_term') || '',
          gclid: trackingUrl.searchParams.get('gclid') || '',
          payload: {
            source: 'iframe-web-form',
            userAgent: navigator.userAgent,
            embedUrl: window.location.href,
            customFields: props.customFields.map((field) => ({
              key: field.key,
              label: field.label,
              type: field.type,
              value: customFieldValues[field.key] ?? '',
            })),
            variables: hiddenVariables,
            termsAccepted,
            purpose,
            couponCode: couponActive ? normalizeCoupon(couponCode) : '',
            rewardDelivery: incentiveActive ? rewardDelivery : '',
          },
        }),
      })

      const json = await response.json().catch(() => ({})) as {
        error?: string
        data?: {
          coupon?: SubmissionResult['coupon']
          reward?: SubmissionResult['reward']
          redirect?: SubmissionResult['redirect']
        }
      }
      if (!response.ok) {
        throw new Error(json.error || 'No se pudo enviar el formulario')
      }

      setFormState(initialState)
      resetCustomFields()
      setTermsAccepted(false)
      setWebsite('')
      setFormStartedAt(Date.now())
      setTurnstileToken('')
      setChallengeVersion((current) => current + 1)
      setResult({
        coupon: json.data?.coupon ?? null,
        reward: json.data?.reward ?? null,
        redirect: json.data?.redirect ?? null,
      })
      setSuccess(true)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo enviar el formulario')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={shellStyle}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: props.accentColor, boxShadow: `0 0 0 6px ${props.accentColor}22` }} />
            <div>
              <div style={{ fontSize: `calc(${props.fontSize}px + 10px)`, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>{props.title}</div>
              <div style={{ marginTop: 6, color: '#475569', lineHeight: 1.6 }}>{props.description}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: fieldGap }}>
            {props.showNameField ? (
              <label style={{ display: 'grid', gap: 8, color: props.labelColor, fontWeight: 600 }}>
                <span>{props.nameLabel}</span>
                <input maxLength={160} value={formState.nombre} onChange={(event) => setFormState((current) => ({ ...current, nombre: event.target.value }))} placeholder={props.namePlaceholder} style={inputStyle} />
              </label>
            ) : null}

            <div style={{ display: 'grid', gap: fieldGap, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {showEmailField ? (
                <label style={{ display: 'grid', gap: 8, color: props.labelColor, fontWeight: 600 }}>
                  <span>{props.emailLabel}</span>
                  <input type="email" maxLength={320} value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} placeholder={props.emailPlaceholder} style={inputStyle} />
                </label>
              ) : null}
              {showPhoneField ? (
                <label style={{ display: 'grid', gap: 8, color: props.labelColor, fontWeight: 600 }}>
                  <span>{props.phoneLabel}</span>
                  <input maxLength={40} value={formState.telefono} onChange={(event) => setFormState((current) => ({ ...current, telefono: event.target.value }))} placeholder={props.phonePlaceholder} style={inputStyle} />
                </label>
              ) : null}
            </div>

            {(props.showCompanyField || props.showCityField) ? (
              <div style={{ display: 'grid', gap: fieldGap, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {props.showCompanyField ? (
                  <label style={{ display: 'grid', gap: 8, color: props.labelColor, fontWeight: 600 }}>
                    <span>{props.companyLabel}</span>
                    <input value={formState.empresaNombre} onChange={(event) => setFormState((current) => ({ ...current, empresaNombre: event.target.value }))} placeholder={props.companyPlaceholder} style={inputStyle} />
                  </label>
                ) : null}
                {props.showCityField ? (
                  <label style={{ display: 'grid', gap: 8, color: props.labelColor, fontWeight: 600 }}>
                    <span>{props.cityLabel}</span>
                    <input value={formState.ciudad} onChange={(event) => setFormState((current) => ({ ...current, ciudad: event.target.value }))} placeholder={props.cityPlaceholder} style={inputStyle} />
                  </label>
                ) : null}
              </div>
            ) : null}

            {props.showProductField ? (
              <label style={{ display: 'grid', gap: 8, color: props.labelColor, fontWeight: 600 }}>
                <span>{props.productLabel}</span>
                <input value={formState.producto} onChange={(event) => setFormState((current) => ({ ...current, producto: event.target.value }))} placeholder={props.productPlaceholder} style={inputStyle} />
              </label>
            ) : null}

            {props.showMessageField ? (
              <label style={{ display: 'grid', gap: 8, color: props.labelColor, fontWeight: 600 }}>
                <span>{props.messageLabel}</span>
                <textarea maxLength={5000} value={formState.mensaje} onChange={(event) => setFormState((current) => ({ ...current, mensaje: event.target.value }))} placeholder={props.messagePlaceholder} rows={5} style={{ ...inputStyle, resize: 'vertical', minHeight: 132 }} />
              </label>
            ) : null}

            {props.customFields.length ? (
              <div style={{ display: 'grid', gap: fieldGap, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {props.customFields.map((field) => {
                  const wrapperStyle = {
                    display: 'grid',
                    gap: 8,
                    color: props.labelColor,
                    fontWeight: 600,
                    gridColumn: field.fullWidth ? '1 / -1' : undefined,
                  } as const
                  const value = customFieldValues[field.key]
                  return (
                    <label key={field.id} style={wrapperStyle}>
                      <span>{field.label}{field.required ? ' *' : ''}</span>
                      {field.type === 'textarea' ? (
                        <textarea value={String(value ?? '')} onChange={(event) => setCustomFieldValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} rows={4} style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }} />
                      ) : field.type === 'select' ? (
                        <select value={String(value ?? '')} onChange={(event) => setCustomFieldValues((current) => ({ ...current, [field.key]: event.target.value }))} style={inputStyle}>
                          <option value="">Selecciona una opción</option>
                          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : field.type === 'radio' ? (
                        <span style={{ ...inputStyle, display: 'grid', gap: 8 }}>
                          {(field.options.length ? field.options : ['Opción 1']).map((option) => (
                            <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, color: props.inputTextColor }}>
                              <input
                                type="radio"
                                name={`field-${field.key}`}
                                checked={String(value ?? '') === option}
                                onChange={() => setCustomFieldValues((current) => ({ ...current, [field.key]: option }))}
                              />
                              {option}
                            </label>
                          ))}
                        </span>
                      ) : field.type === 'check' ? (
                        <span style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input type="checkbox" checked={Boolean(value)} onChange={(event) => setCustomFieldValues((current) => ({ ...current, [field.key]: event.target.checked }))} />
                          <span style={{ color: props.inputTextColor, fontWeight: 500 }}>{field.placeholder || field.helpText || 'Aceptar'}</span>
                        </span>
                      ) : field.type === 'file' ? (
                        <span style={{ display: 'grid', gap: 8 }}>
                          <input type="file" multiple onChange={(event) => handleFileChange(field, event)} style={inputStyle} />
                          {Array.isArray(value) && value.length ? <span style={{ color: '#475569', fontSize: 12 }}>{value.map((file) => file.name).join(', ')}</span> : null}
                        </span>
                      ) : (
                        <input
                          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
                          value={String(value ?? '')}
                          onChange={(event) => setCustomFieldValues((current) => ({ ...current, [field.key]: event.target.value }))}
                          placeholder={field.placeholder}
                          style={inputStyle}
                        />
                      )}
                      {field.helpText ? <span style={{ color: '#64748b', fontWeight: 500, fontSize: 12, lineHeight: 1.5 }}>{field.helpText}</span> : null}
                    </label>
                  )
                })}
              </div>
            ) : null}

            {incentiveActive && !success ? (
              <div style={{ display: 'grid', gap: 10, border: '1px solid rgba(148,163,184,.32)', borderRadius: 18, padding: '12px 14px', backgroundColor: 'rgba(255,255,255,.85)' }}>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>{incentive.rewardLabel || 'Tu regalo'}</span>
                <span style={{ color: '#475569', fontWeight: 500, fontSize: 12, lineHeight: 1.5 }}>
                  {incentive.deliveryMode === 'BOTH'
                    ? '¿Dónde quieres recibirlo?'
                    : incentive.deliveryMode === 'WHATSAPP'
                      ? 'Te lo enviaremos por WhatsApp cuando envíes el formulario.'
                      : 'Te lo enviaremos por correo cuando envíes el formulario.'}
                </span>
                {incentive.deliveryMode === 'BOTH' ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {[
                      { value: 'EMAIL' as const, label: 'Correo electrónico' },
                      { value: 'WHATSAPP' as const, label: 'WhatsApp' },
                    ].map((option) => (
                      <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: 8, color: props.labelColor, fontWeight: 600 }}>
                        <input type="radio" name="rewardDelivery" checked={rewardDelivery === option.value} onChange={() => setRewardDelivery(option.value)} />
                        {option.label}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {couponActive ? (
              <label style={{ display: 'grid', gap: 8, color: props.labelColor, fontWeight: 600 }}>
                <span>{couponSettings.label || 'Cupón de descuento'}</span>
                <input maxLength={40} value={couponCode} onChange={(event) => setCouponCode(normalizeCoupon(event.target.value))} placeholder="Código de cupón" style={inputStyle} />
                {couponSettings.message ? <span style={{ color: '#64748b', fontWeight: 500, fontSize: 12, lineHeight: 1.5 }}>{couponSettings.message}</span> : null}
              </label>
            ) : null}

            {props.termsEnabled ? (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: props.labelColor, fontWeight: 600, border: '1px solid rgba(148,163,184,.26)', borderRadius: 18, padding: '12px 14px', backgroundColor: 'rgba(255,255,255,.8)' }}>
                <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} style={{ marginTop: 3 }} />
                <span style={{ color: '#334155', fontWeight: 500, lineHeight: 1.5 }}>
                  {props.termsLabel}
                  {props.termsRequired ? ' *' : ''}
                  {props.termsLinkUrl ? (
                    <>
                      {' '}
                      <a href={sanitizeWebsiteLinkHref(props.termsLinkUrl)} target="_blank" rel="noreferrer" style={{ color: props.accentColor, fontWeight: 700 }}>
                        {props.termsLinkText}
                      </a>
                    </>
                  ) : null}
                </span>
              </label>
            ) : null}

            <div style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
              <label>Sitio web<input name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
            </div>
            {turnstileSiteKey ? <WebsiteTurnstile key={challengeVersion} siteKey={turnstileSiteKey} onTokenChange={setTurnstileToken} /> : null}

            {errorMessage ? <div style={{ borderRadius: 18, border: '1px solid #fecaca', backgroundColor: '#fff1f2', color: '#991b1b', padding: '12px 14px', lineHeight: 1.5 }}>{errorMessage}</div> : null}
            {success ? (
              <div style={{ display: 'grid', gap: 12, borderRadius: 18, border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', color: '#166534', padding: '14px' }}>
                <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.5 }}>{successHeadline}</p>

                {result?.coupon ? (
                  <div style={{ display: 'grid', gap: 6, borderRadius: 14, border: '1px dashed #86efac', backgroundColor: '#ffffff', padding: '12px' }}>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.09em', color: '#15803d', fontWeight: 700 }}>{result.coupon.label}</span>
                    <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '.12em', color: '#14532d' }}>{result.coupon.code}</span>
                    {result.coupon.message ? <span style={{ color: '#166534', fontSize: 12, lineHeight: 1.5 }}>{result.coupon.message}</span> : null}
                    <button
                      type="button"
                      onClick={() => { void navigator.clipboard.writeText(result.coupon?.code ?? '').catch(() => {}) }}
                      style={{ justifySelf: 'start', border: '1px solid #86efac', borderRadius: 999, backgroundColor: '#ffffff', color: '#15803d', fontWeight: 700, padding: '6px 12px', cursor: 'pointer' }}
                    >
                      Copiar cupón
                    </button>
                  </div>
                ) : null}

                {result?.reward ? (
                  <div style={{ display: 'grid', gap: 8, borderRadius: 14, border: '1px solid #bbf7d0', backgroundColor: '#ffffff', padding: '12px' }}>
                    <span style={{ fontWeight: 700 }}>{result.reward.status === 'SENT' ? 'Regalo enviado' : 'Tu regalo está listo'}</span>
                    <span style={{ color: '#166534', fontSize: 13, lineHeight: 1.5 }}>{result.reward.message}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {result.reward.supportUrl ? (
                        <a
                          href={result.reward.supportUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', borderRadius: `${props.inputRadius}px`, border: '1px solid #86efac', backgroundColor: '#ffffff', color: '#15803d', fontWeight: 700, padding: '10px 14px', textDecoration: 'none' }}
                        >
                          Reclamar por WhatsApp
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {result?.redirect ? (
                  <div style={{ display: 'grid', gap: 8, borderRadius: 14, border: '1px solid #bbf7d0', backgroundColor: '#ffffff', padding: '12px' }}>
                    <span style={{ color: '#166534', fontSize: 13, lineHeight: 1.5 }}>{result.redirect.message || 'Te estamos redirigiendo...'}</span>
                    <a href={result.redirect.url} target="_top" rel="noreferrer" style={{ color: props.accentColor, fontWeight: 700 }}>
                      Continuar ahora
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!success ? (
              <button type="submit" disabled={submitting} style={{ border: 0, borderRadius: `${props.inputRadius}px`, background: `linear-gradient(135deg, ${props.ctaColor}, ${props.accentColor})`, color: props.ctaTextColor, fontWeight: 800, padding: '14px 18px', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.82 : 1 }}>
                {submitting ? 'Enviando...' : props.submitLabel}
              </button>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  )
}
