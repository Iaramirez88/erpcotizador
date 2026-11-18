"use client"

import { Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  CRM_RESPONSE_EMAIL_VARIABLES,
  resolveCrmResponseEmailText,
  type CrmResponseEmailFormState,
} from '@/lib/crm-response-email'

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'outlook.es',
  'hotmail.com',
  'hotmail.es',
  'live.com',
  'live.com.mx',
  'msn.com',
  'yahoo.com',
  'yahoo.es',
  'yahoo.com.mx',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'gmx.com',
  'gmx.es',
  'zoho.com',
  'mail.com',
])

function isFreeEmailDomain(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+$/.test(normalized)) return false
  const domain = normalized.split('@')[1]
  return FREE_EMAIL_DOMAINS.has(domain)
}

type Props = {
  form: CrmResponseEmailFormState
  patchForm: (patch: Partial<CrmResponseEmailFormState>) => void
  mode: 'form' | 'booking'
}

export function CrmIntegrationsResponseEmailSection(props: Props) {
  const { form, patchForm, mode } = props

  function insertVariable(token: string) {
    patchForm({ responseEmailBody: `${form.responseEmailBody}${form.responseEmailBody.endsWith('\n') || !form.responseEmailBody ? '' : '\n'}${token}` })
  }

  const previewVariables = {
    nombre: 'María',
    fecha: 'viernes, 20 de marzo',
    hora: '09:30',
    servicio: 'Asesoría comercial',
    canal: 'Agenda Web',
    cupon: 'PROMO10',
    enlace: 'https://tudominio.com/regalo.pdf',
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-sky-200 bg-sky-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Correo de respuesta al usuario</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
                {mode === 'booking'
                  ? 'Este es el correo que recibe el visitante cuando agenda una cita. Personaliza diseño, asunto y textos.'
                  : 'Este es el correo que recibe el visitante después de enviar el formulario. Personaliza diseño, asunto y textos.'}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800">
            {form.responseEmailEnabled ? 'Activo' : 'Desactivado'}
            <Switch checked={form.responseEmailEnabled} onCheckedChange={(checked) => patchForm({ responseEmailEnabled: checked })} aria-label="Activar correo de respuesta" />
          </label>
        </div>
      </div>

      <div className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label>Nombre del remitente</Label>
          <Input value={form.responseEmailFromName} onChange={(event) => patchForm({ responseEmailFromName: event.target.value })} className="h-11 rounded-xl" placeholder="Equipo comercial" />
        </div>
        <div className="grid gap-2">
          <Label>Correo del remitente</Label>
          <Input value={form.responseEmailFromEmail} onChange={(event) => patchForm({ responseEmailFromEmail: event.target.value })} className="h-11 rounded-xl" placeholder="no-reply@tudominio.com" />
          {isFreeEmailDomain(form.responseEmailFromEmail) ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              Gmail, Outlook, Hotmail y Yahoo no se pueden usar como remitente (Resend no los permite). Déjalo vacío para usar el dominio de Ordex, o usa un dominio propio verificado en Resend.
            </p>
          ) : (
            <p className="text-xs text-slate-500">Si lo dejas vacío se usa el remitente global de Ordex. El dominio debe estar verificado en Resend para poder enviar.</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label>Responder a (reply-to)</Label>
          <Input value={form.responseEmailReplyTo} onChange={(event) => patchForm({ responseEmailReplyTo: event.target.value })} className="h-11 rounded-xl" placeholder="ventas@tudominio.com" />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Asunto</Label>
          <Input value={form.responseEmailSubject} onChange={(event) => patchForm({ responseEmailSubject: event.target.value })} className="h-11 rounded-xl" />
          <p className="text-xs text-slate-500">Vista previa: {resolveCrmResponseEmailText(form.responseEmailSubject, previewVariables)}</p>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Preheader (texto de vista previa)</Label>
          <Input value={form.responseEmailPreheader} onChange={(event) => patchForm({ responseEmailPreheader: event.target.value })} className="h-11 rounded-xl" />
        </div>
        <div className="grid gap-2">
          <Label>Título</Label>
          <Input value={form.responseEmailTitle} onChange={(event) => patchForm({ responseEmailTitle: event.target.value })} className="h-11 rounded-xl" />
        </div>
        <div className="grid gap-2">
          <Label>Texto de introducción</Label>
          <Input value={form.responseEmailIntro} onChange={(event) => patchForm({ responseEmailIntro: event.target.value })} className="h-11 rounded-xl" />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Cuerpo del correo</Label>
          <Textarea value={form.responseEmailBody} onChange={(event) => patchForm({ responseEmailBody: event.target.value })} rows={5} className="rounded-xl" />
          <div className="flex flex-wrap gap-1.5">
            {CRM_RESPONSE_EMAIL_VARIABLES.map((variable) => (
              <button
                key={variable.token}
                type="button"
                onClick={() => insertVariable(variable.token)}
                title={`Insertar ${variable.label}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700"
              >
                {variable.token}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Haz clic en una variable para agregarla al final del cuerpo.</p>
        </div>
        <div className="grid gap-2">
          <Label>Texto del botón (opcional)</Label>
          <Input value={form.responseEmailCtaLabel} onChange={(event) => patchForm({ responseEmailCtaLabel: event.target.value })} className="h-11 rounded-xl" placeholder="Ver mi regalo" />
        </div>
        <div className="grid gap-2">
          <Label>Enlace del botón</Label>
          <Input value={form.responseEmailCtaUrl} onChange={(event) => patchForm({ responseEmailCtaUrl: event.target.value })} className="h-11 rounded-xl" placeholder="https://..." />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Pie del correo</Label>
          <Textarea value={form.responseEmailFooter} onChange={(event) => patchForm({ responseEmailFooter: event.target.value })} rows={2} className="rounded-xl" />
        </div>
      </div>

      <div className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label>Marca</Label>
          <Input value={form.responseEmailBrandName} onChange={(event) => patchForm({ responseEmailBrandName: event.target.value })} className="h-11 rounded-xl" />
          <label className="mt-1 flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
            Mostrar marca
            <Switch checked={form.responseEmailShowBrand} onCheckedChange={(checked) => patchForm({ responseEmailShowBrand: checked })} aria-label="Mostrar marca en el correo" />
          </label>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Logo (URL pública opcional)</Label>
          <Input value={form.responseEmailLogoUrl} onChange={(event) => patchForm({ responseEmailLogoUrl: event.target.value })} className="h-11 rounded-xl" placeholder="https://tudominio.com/logo.png" />
        </div>
        <div className="grid gap-2">
          <Label>Color de acento</Label>
          <div className="flex gap-2">
            <Input value={form.responseEmailAccentColor} onChange={(event) => patchForm({ responseEmailAccentColor: event.target.value })} className="h-11 rounded-xl" />
            <input type="color" value={form.responseEmailAccentColor} onChange={(event) => patchForm({ responseEmailAccentColor: event.target.value })} className="h-11 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1" aria-label="Color de acento" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Fondo del correo</Label>
          <div className="flex gap-2">
            <Input value={form.responseEmailBackgroundColor} onChange={(event) => patchForm({ responseEmailBackgroundColor: event.target.value })} className="h-11 rounded-xl" />
            <input type="color" value={form.responseEmailBackgroundColor} onChange={(event) => patchForm({ responseEmailBackgroundColor: event.target.value })} className="h-11 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1" aria-label="Fondo del correo" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Fondo de la tarjeta</Label>
          <div className="flex gap-2">
            <Input value={form.responseEmailCardColor} onChange={(event) => patchForm({ responseEmailCardColor: event.target.value })} className="h-11 rounded-xl" />
            <input type="color" value={form.responseEmailCardColor} onChange={(event) => patchForm({ responseEmailCardColor: event.target.value })} className="h-11 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1" aria-label="Fondo de la tarjeta" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Color del texto</Label>
          <div className="flex gap-2">
            <Input value={form.responseEmailTextColor} onChange={(event) => patchForm({ responseEmailTextColor: event.target.value })} className="h-11 rounded-xl" />
            <input type="color" value={form.responseEmailTextColor} onChange={(event) => patchForm({ responseEmailTextColor: event.target.value })} className="h-11 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1" aria-label="Color del texto" />
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 p-4" style={{ backgroundColor: form.responseEmailBackgroundColor }}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vista previa</p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200" style={{ backgroundColor: form.responseEmailCardColor, color: form.responseEmailTextColor }}>
          {form.responseEmailShowBrand || form.responseEmailLogoUrl ? (
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold">{form.responseEmailBrandName || 'Marca'}</div>
          ) : null}
          <div className="space-y-2 px-4 py-4">
            <p className="text-lg font-semibold">{resolveCrmResponseEmailText(form.responseEmailTitle, previewVariables)}</p>
            <p className="text-sm">{resolveCrmResponseEmailText(form.responseEmailIntro, previewVariables)}</p>
            {form.responseEmailBody.trim() ? (
              <div className="whitespace-pre-line rounded-xl px-3 py-3 text-sm" style={{ backgroundColor: form.responseEmailBackgroundColor }}>
                {resolveCrmResponseEmailText(form.responseEmailBody, previewVariables)}
              </div>
            ) : null}
            {form.responseEmailCtaLabel && /^https?:\/\//i.test(resolveCrmResponseEmailText(form.responseEmailCtaUrl, previewVariables)) ? (
              <span className="inline-flex rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{ backgroundColor: form.responseEmailAccentColor }}>
                {resolveCrmResponseEmailText(form.responseEmailCtaLabel, previewVariables)}
              </span>
            ) : null}
          </div>
          {form.responseEmailFooter.trim() ? (
            <div className="border-t border-slate-100 px-4 py-3 text-xs" style={{ backgroundColor: form.responseEmailBackgroundColor }}>
              {resolveCrmResponseEmailText(form.responseEmailFooter, previewVariables)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}


