"use client"

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  WEB_FORM_PURPOSE_OPTIONS,
  WEB_FORM_REWARD_DELIVERY_OPTIONS,
  WEB_FORM_REWARD_TYPE_OPTIONS,
  normalizeWebFormCouponCode,
  type WebFormPurposeFormState,
} from '@/lib/crm-web-form-purpose'

type Props = {
  form: WebFormPurposeFormState
  patchForm: (patch: Partial<WebFormPurposeFormState>) => void
  onOpenFields?: () => void
}

export function CrmIntegrationsWebFormPurposeSection(props: Props) {
  const { form, patchForm, onOpenFields } = props
  const purpose = form.webFormPurpose

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-sky-200 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.16),transparent_38%),linear-gradient(180deg,#f8fbff,#ffffff)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Finalidad del formulario</p>
        <p className="mt-2 text-lg font-semibold text-slate-950">¿Qué debe pasar cuando alguien envía este formulario?</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          La finalidad define qué recibe el visitante después de enviar y qué queda registrado en el CRM. Todos los formularios permiten crear campos personalizados.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {WEB_FORM_PURPOSE_OPTIONS.map((option) => {
            const selected = purpose === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => patchForm({
                  webFormPurpose: option.id,
                  couponEnabled: option.id === 'COUPON' ? true : form.couponEnabled,
                })}
                aria-pressed={selected}
                className={selected
                  ? 'rounded-2xl border-2 border-sky-500 bg-white p-4 text-left shadow-[0_16px_40px_-28px_rgba(2,132,199,.7)]'
                  : 'rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:shadow-sm'}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">{option.label}</p>
                  {selected ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700">Activa</span> : null}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{option.description}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-700">{option.outcome}</p>
              </button>
            )
          })}
        </div>
      </div>

      {purpose === 'INCENTIVE' ? (
        <div className="space-y-4 rounded-[24px] border border-emerald-200 bg-emerald-50/40 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Regalo por reciprocidad</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Configura el PDF o link y el canal por el que se entregará automáticamente.</p>
          </div>

          {!form.incentiveRewardUrl.trim() ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
              Falta la URL pública del PDF o del link de acceso. Sin ella el formulario captura el lead pero no puede entregar el regalo.
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Tipo de regalo</Label>
              <Select value={form.incentiveRewardType} onValueChange={(value) => patchForm({ incentiveRewardType: value as WebFormPurposeFormState['incentiveRewardType'] })}>
                <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEB_FORM_REWARD_TYPE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Canal de entrega</Label>
              <Select value={form.incentiveDeliveryMode} onValueChange={(value) => patchForm({ incentiveDeliveryMode: value as WebFormPurposeFormState['incentiveDeliveryMode'] })}>
                <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEB_FORM_REWARD_DELIVERY_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-slate-500">
                {WEB_FORM_REWARD_DELIVERY_OPTIONS.find((item) => item.value === form.incentiveDeliveryMode)?.helper}
              </p>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>URL del PDF o link de acceso</Label>
              <Input value={form.incentiveRewardUrl} onChange={(e) => patchForm({ incentiveRewardUrl: e.target.value })} className="h-11 rounded-xl bg-white" placeholder="https://tu-dominio.com/recursos/guia.pdf" />
              <p className="text-xs leading-5 text-slate-500">Acepta URLs absolutas o rutas relativas de este mismo dominio, por ejemplo /recursos/guia.pdf.</p>
            </div>
            <div className="grid gap-2">
              <Label>Texto del botón del regalo</Label>
              <Input value={form.incentiveRewardLabel} onChange={(e) => patchForm({ incentiveRewardLabel: e.target.value })} className="h-11 rounded-xl bg-white" />
            </div>
            <div className="grid gap-2">
              <Label>WhatsApp de soporte (opcional)</Label>
              <Input value={form.incentiveWhatsAppSupport} onChange={(e) => patchForm({ incentiveWhatsAppSupport: e.target.value })} className="h-11 rounded-xl bg-white" placeholder="+57 300 000 0000" />
              <p className="text-xs leading-5 text-slate-500">Si la entrega automática falla, el visitante puede reclamar el regalo por este WhatsApp.</p>
            </div>
          </div>
        </div>
      ) : null}

      {purpose === 'INCENTIVE' ? (
        <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Mensajes de entrega</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Personaliza lo que recibe el visitante por correo y por WhatsApp.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label>Asunto del correo</Label>
              <Input value={form.incentiveEmailSubject} onChange={(e) => patchForm({ incentiveEmailSubject: e.target.value })} className="h-11 rounded-xl bg-white" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Mensaje del correo</Label>
              <Textarea value={form.incentiveEmailMessage} onChange={(e) => patchForm({ incentiveEmailMessage: e.target.value })} rows={2} className="rounded-2xl bg-white" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Mensaje de WhatsApp</Label>
              <Textarea value={form.incentiveWhatsAppMessage} onChange={(e) => patchForm({ incentiveWhatsAppMessage: e.target.value })} rows={2} className="rounded-2xl bg-white" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Mensaje de gracias</Label>
              <Input value={form.incentiveThankYouMessage} onChange={(e) => patchForm({ incentiveThankYouMessage: e.target.value })} className="h-11 rounded-xl bg-white" />
              <p className="text-xs leading-5 text-slate-500">Usa {'{destino}'} para que el sistema escriba “tu correo” o “tu WhatsApp”.</p>
            </div>
          </div>
        </div>
      ) : null}

      {purpose === 'THANK_YOU_REDIRECT' ? (
        <div className="space-y-4 rounded-[24px] border border-violet-200 bg-violet-50/40 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Redirección a thank you page</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Después de capturar el lead el visitante sale hacia la URL que definas.</p>
          </div>
          {!form.thankYouRedirectUrl.trim() ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
              Falta la URL de destino. Sin ella el formulario solo muestra el mensaje de gracias.
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label>URL de la thank you page</Label>
              <Input value={form.thankYouRedirectUrl} onChange={(e) => patchForm({ thankYouRedirectUrl: e.target.value })} className="h-11 rounded-xl bg-white" placeholder="https://tu-dominio.com/gracias" />
              <p className="text-xs leading-5 text-slate-500">También puedes usar una ruta relativa como /gracias.</p>
            </div>
            <div className="grid gap-2">
              <Label>Espera antes de redirigir (segundos)</Label>
              <Input value={form.thankYouRedirectDelay} onChange={(e) => patchForm({ thankYouRedirectDelay: e.target.value.replace(/[^0-9]/g, '') })} className="h-11 rounded-xl bg-white" placeholder="0" />
              <p className="text-xs leading-5 text-slate-500">0 redirige de inmediato. Máximo 30 segundos.</p>
            </div>
            <div className="grid gap-2">
              <Label>Mensaje mientras redirige</Label>
              <Input value={form.thankYouRedirectMessage} onChange={(e) => patchForm({ thankYouRedirectMessage: e.target.value })} className="h-11 rounded-xl bg-white" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 rounded-[24px] border border-amber-200 bg-amber-50/40 p-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Cupón de descuento y atribución</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Cada lead queda etiquetado con el código para filtrar la campaña desde el CRM.</p>
          </div>
          <Switch checked={form.couponEnabled} onCheckedChange={(checked) => patchForm({ couponEnabled: checked })} />
        </div>

        {form.couponEnabled ? (
          <>
            {!normalizeWebFormCouponCode(form.couponCode) ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
                Define el código que verá el visitante. También puedes enviarlo por URL con el parámetro configurado abajo.
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Código del cupón</Label>
                <Input value={form.couponCode} onChange={(e) => patchForm({ couponCode: normalizeWebFormCouponCode(e.target.value) })} className="h-11 rounded-xl bg-white" placeholder="BIENVENIDO10" maxLength={40} />
              </div>
              <div className="grid gap-2">
                <Label>Etiqueta visible</Label>
                <Input value={form.couponLabel} onChange={(e) => patchForm({ couponLabel: e.target.value })} className="h-11 rounded-xl bg-white" placeholder="Cupón de descuento" />
              </div>
              <div className="grid gap-2">
                <Label>Parámetro de URL</Label>
                <Input value={form.couponQueryParam} onChange={(e) => patchForm({ couponQueryParam: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })} className="h-11 rounded-xl bg-white" placeholder="cupon" />
                <p className="text-xs leading-5 text-slate-500">Ejemplo: ?cupon=BIENVENIDO10 aplica el código automáticamente.</p>
              </div>
              <div className="grid gap-2">
                <Label>Redirección opcional</Label>
                <Input value={form.couponRedirectUrl} onChange={(e) => patchForm({ couponRedirectUrl: e.target.value })} className="h-11 rounded-xl bg-white" placeholder="https://tu-dominio.com/promo" />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Mensaje del cupón</Label>
                <Input value={form.couponMessage} onChange={(e) => patchForm({ couponMessage: e.target.value })} className="h-11 rounded-xl bg-white" />
              </div>
            </div>
          </>
        ) : null}
      </div>

      {onOpenFields ? (
        <div className="flex flex-col gap-3 rounded-[24px] border border-dashed border-sky-300 bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Campos personalizados para este formulario</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Agrega cualquier dato extra que necesites capturar. Funciona con las cuatro finalidades y queda disponible en el CRM.</p>
          </div>
          <Button type="button" variant="outline" className="rounded-xl border-sky-200 bg-white text-sky-800 hover:bg-sky-50" onClick={onOpenFields}>
            Abrir constructor de campos
          </Button>
        </div>
      ) : null}
    </div>
  )
}
