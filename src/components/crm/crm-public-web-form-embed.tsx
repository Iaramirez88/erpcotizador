"use client"

import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { WebFormCustomField, WebFormVariable } from '@/lib/crm-web-form-schema'

type PublicWebFormEmbedProps = {
  channelId: string
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

export function CrmPublicWebFormEmbed(props: PublicWebFormEmbedProps) {
  const [formState, setFormState] = useState<FormState>(initialState)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, CustomFieldValue>>(() => Object.fromEntries(props.customFields.map((field) => [field.key, field.type === 'check' ? field.defaultValue === 'true' : field.defaultValue || ''])))
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

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

    const customFieldError = validateCustomFields()
    if (customFieldError) {
      setErrorMessage(customFieldError)
      return
    }

    setSubmitting(true)
    setErrorMessage('')
    setSuccess(false)

    try {
      const parentReferrer = document.referrer || ''
      const response = await fetch('/api/crm/captures/web-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: props.channelId,
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
          landingPageUrl: parentReferrer || window.location.href,
          referrerUrl: parentReferrer,
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
          },
        }),
      })

      const json = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) {
        throw new Error(json.error || 'No se pudo enviar el formulario')
      }

      setFormState(initialState)
      resetCustomFields()
      setTermsAccepted(false)
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
                <input value={formState.nombre} onChange={(event) => setFormState((current) => ({ ...current, nombre: event.target.value }))} placeholder={props.namePlaceholder} style={inputStyle} />
              </label>
            ) : null}

            <div style={{ display: 'grid', gap: fieldGap, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {props.showEmailField ? (
                <label style={{ display: 'grid', gap: 8, color: props.labelColor, fontWeight: 600 }}>
                  <span>{props.emailLabel}</span>
                  <input type="email" value={formState.email} onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))} placeholder={props.emailPlaceholder} style={inputStyle} />
                </label>
              ) : null}
              {props.showPhoneField ? (
                <label style={{ display: 'grid', gap: 8, color: props.labelColor, fontWeight: 600 }}>
                  <span>{props.phoneLabel}</span>
                  <input value={formState.telefono} onChange={(event) => setFormState((current) => ({ ...current, telefono: event.target.value }))} placeholder={props.phonePlaceholder} style={inputStyle} />
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
                <textarea value={formState.mensaje} onChange={(event) => setFormState((current) => ({ ...current, mensaje: event.target.value }))} placeholder={props.messagePlaceholder} rows={5} style={{ ...inputStyle, resize: 'vertical', minHeight: 132 }} />
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
                        <input type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'} value={String(value ?? '')} onChange={(event) => setCustomFieldValues((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} style={inputStyle} />
                      )}
                      {field.helpText ? <span style={{ color: '#64748b', fontWeight: 500, fontSize: 12, lineHeight: 1.5 }}>{field.helpText}</span> : null}
                    </label>
                  )
                })}
              </div>
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
                      <a href={props.termsLinkUrl} target="_blank" rel="noreferrer" style={{ color: props.accentColor, fontWeight: 700 }}>
                        {props.termsLinkText}
                      </a>
                    </>
                  ) : null}
                </span>
              </label>
            ) : null}

            {errorMessage ? <div style={{ borderRadius: 18, border: '1px solid #fecaca', backgroundColor: '#fff1f2', color: '#991b1b', padding: '12px 14px', lineHeight: 1.5 }}>{errorMessage}</div> : null}
            {success ? <div style={{ borderRadius: 18, border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', color: '#166534', padding: '12px 14px', lineHeight: 1.5 }}>{props.successMessage}</div> : null}

            <button type="submit" disabled={submitting} style={{ border: 0, borderRadius: `${props.inputRadius}px`, background: `linear-gradient(135deg, ${props.ctaColor}, ${props.accentColor})`, color: props.ctaTextColor, fontWeight: 800, padding: '14px 18px', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.82 : 1 }}>
              {submitting ? 'Enviando...' : props.submitLabel}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}