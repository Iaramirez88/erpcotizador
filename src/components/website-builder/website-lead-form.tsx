'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

type Props = {
  channelId?: string
  channelToken?: string
  product?: string
  buttonLabel?: string
  successMessage?: string
  showPhone?: boolean
  accentColor?: string
  isEditing?: boolean
}

const initialForm = { nombre: '', email: '', telefono: '', mensaje: '' }

export function WebsiteLeadForm({ channelId, channelToken, product, buttonLabel, successMessage, showPhone, accentColor, isEditing }: Props) {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isEditing || submitting) return
    if (!channelId?.trim() || !channelToken?.trim()) {
      setError('Este formulario aún no está conectado a un canal CRM.')
      return
    }
    if (!form.nombre.trim() && !form.email.trim() && !form.telefono.trim()) {
      setError('Incluye al menos nombre, correo o teléfono.')
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess(false)
    try {
      const params = new URLSearchParams(window.location.search)
      const response = await fetch('/api/crm/captures/web-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-crm-channel-token': channelToken.trim() },
        body: JSON.stringify({
          channelId: channelId.trim(),
          nombre: form.nombre,
          email: form.email,
          telefono: form.telefono,
          producto: product || '',
          mensaje: form.mensaje,
          landingPageUrl: window.location.href,
          referrerUrl: document.referrer || '',
          utmSource: params.get('utm_source') || '',
          utmMedium: params.get('utm_medium') || '',
          utmCampaign: params.get('utm_campaign') || '',
          utmContent: params.get('utm_content') || '',
          utmTerm: params.get('utm_term') || '',
          payload: { source: 'website-builder', pageUrl: window.location.href },
        }),
      })
      const json = await response.json().catch(() => ({})) as { error?: string; success?: boolean }
      if (!response.ok || !json.success) throw new Error(json.error || 'No se pudo enviar la solicitud.')
      setForm(initialForm)
      setSuccess(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo enviar la solicitud.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-950 shadow-sm" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-medium">Nombre<input name="nombre" value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} className="h-11 rounded-md border border-slate-300 px-3 font-normal" placeholder="Tu nombre" /></label>
      <label className="grid gap-2 text-sm font-medium">Correo<input name="email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="h-11 rounded-md border border-slate-300 px-3 font-normal" placeholder="correo@empresa.com" /></label>
      {showPhone ? <label className="grid gap-2 text-sm font-medium">Teléfono<input name="telefono" type="tel" value={form.telefono} onChange={(event) => setForm((current) => ({ ...current, telefono: event.target.value }))} className="h-11 rounded-md border border-slate-300 px-3 font-normal" placeholder="Número de contacto" /></label> : null}
      <label className="grid gap-2 text-sm font-medium">Mensaje<textarea name="mensaje" value={form.mensaje} onChange={(event) => setForm((current) => ({ ...current, mensaje: event.target.value }))} className="min-h-28 rounded-md border border-slate-300 p-3 font-normal" placeholder="¿Cómo podemos ayudarte?" /></label>
      {isEditing && (!channelId || !channelToken) ? <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />Configura el ID y token de un canal Formulario Web para recibir leads.</div> : null}
      {error ? <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}
      {success ? <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{successMessage || 'Gracias. Recibimos tu solicitud.'}</div> : null}
      <button type="submit" disabled={submitting || isEditing} className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70" style={{ backgroundColor: accentColor || '#2563eb' }}>
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isEditing ? 'Vista previa del formulario' : submitting ? 'Enviando...' : buttonLabel || 'Enviar'}
      </button>
    </form>
  )
}
