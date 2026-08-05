"use client"

import type { Dispatch, SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type WebFormConfigSection = 'base' | 'styles' | 'fields' | 'variables' | 'size' | 'texts' | 'terms' | 'technical'
type WebFormCustomFieldType = 'input' | 'textarea' | 'phone' | 'email' | 'select' | 'check' | 'file'

type WebFormCustomField = {
  id: string
  label: string
  key: string
  type: WebFormCustomFieldType
  options: string[]
  placeholder: string
  helpText: string
  defaultValue: string
  required: boolean
  fullWidth: boolean
}

type WebFormVariable = {
  id: string
  label: string
  key: string
  source: 'query' | 'static'
  queryParam: string
  value: string
}

type WebFormSectionsForm = {
  accentColor: string
  formCtaColor: string
  formCtaTextColor: string
  pageBackgroundColor: string
  backgroundColor: string
  formLabelColor: string
  formInputBorderColor: string
  formInputBackgroundColor: string
  formInputTextColor: string
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
  webFormCustomFields: WebFormCustomField[]
  webFormVariables: WebFormVariable[]
  iframeHeight: string
  formFontSize: string
  formCardRadius: string
  formInputRadius: string
  formFieldSpacing: string
  formPadding: string
  formTitle: string
  formDescription: string
  submitCtaLabel: string
  fontFamily: string
  formSuccessMessage: string
  termsEnabled: boolean
  termsRequired: boolean
  termsLabel: string
  termsLinkText: string
  termsLinkUrl: string
  publicEmbedEnabled: boolean
  allowedDomains: string
}

type WizardWebFormState = WebFormSectionsForm & {
  name: string
  provider: string
  status: string
  testingToken: string
  formSelector: string
  bridgeKind: string
  bookingNotifyByEmail: boolean
  bookingNotifyByWhatsApp: boolean
  outgoingWebhookUrl: string
}

type Props<TForm extends WebFormSectionsForm, TWizardForm extends WizardWebFormState> = {
  kind: 'wizard' | 'builder'
  section: WebFormConfigSection
  setSection: (section: WebFormConfigSection) => void
  form: TForm
  patchForm: (patch: Partial<TForm>) => void
  addField: (type: WebFormCustomFieldType) => void
  updateField: (id: string, patch: Partial<WebFormCustomField>) => void
  removeField: (id: string) => void
  addVariable: () => void
  updateVariable: (id: string, patch: Partial<WebFormVariable>) => void
  removeVariable: (id: string) => void
  normalizePixelValue: (value: string, fallback: string) => string
  getWebFormFieldTypeLabel: (type: WebFormCustomFieldType) => string
  customFieldTypeOptions: Array<{ value: WebFormCustomFieldType; label: string }>
  sectionOptions: Array<{ id: WebFormConfigSection; label: string }>
  wizardForm?: TWizardForm
  setWizardForm?: Dispatch<SetStateAction<TWizardForm>>
  makeDemoToken?: () => string
  channelStatusOptions?: string[]
  isOutgoingWebhookBridge?: (kind: string) => boolean
}

export function CrmIntegrationsWebFormSections<TForm extends WebFormSectionsForm, TWizardForm extends WizardWebFormState>(props: Props<TForm, TWizardForm>) {
  const isWizard = props.kind === 'wizard'
  const wizardForm = props.wizardForm
  const setWizardForm = props.setWizardForm

  return (
    <Tabs value={props.section} onValueChange={(value) => props.setSection(value as WebFormConfigSection)} className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <TabsList className="inline-flex h-auto min-w-max flex-nowrap rounded-2xl border border-slate-200 bg-slate-50 p-1 md:flex-wrap">
          {props.sectionOptions.map((item) => (
            <TabsTrigger key={item.id} value={item.id} className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {isWizard && wizardForm && setWizardForm && props.makeDemoToken && props.channelStatusOptions && props.isOutgoingWebhookBridge ? (
        <TabsContent value="base" className="space-y-4">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-900">Identidad del canal</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Define cómo quedará identificado el canal dentro del CRM antes de configurar su captura.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label>Nombre del canal</Label>
                  <Input value={wizardForm.name} onChange={(e) => setWizardForm((prev) => ({ ...prev, name: e.target.value }))} className="h-11 rounded-xl bg-white" />
                </div>
                <div className="grid gap-2">
                  <Label>Proveedor técnico</Label>
                  <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
                    {wizardForm.provider}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Estado inicial</Label>
                  <Select value={wizardForm.status} onValueChange={(value) => setWizardForm((prev) => ({ ...prev, status: value }))}>
                    <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {props.channelStatusOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-900">Conexión y acceso</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Aquí defines token, modo de captura y el puente técnico con el que entrarán los leads.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label>Token de prueba / verificación</Label>
                  <div className="flex gap-2">
                    <Input value={wizardForm.testingToken} onChange={(e) => setWizardForm((prev) => ({ ...prev, testingToken: e.target.value }))} className="h-11 rounded-xl bg-white" />
                    <Button type="button" variant="outline" className="rounded-xl bg-white" onClick={() => setWizardForm((prev) => ({ ...prev, testingToken: props.makeDemoToken!() }))}>Regenerar</Button>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">Se usa para pruebas seguras, verificación y bridges demo.</p>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Selector del formulario legacy</Label>
                  <Input value={wizardForm.formSelector} onChange={(e) => setWizardForm((prev) => ({ ...prev, formSelector: e.target.value }))} className="h-11 rounded-xl bg-white" placeholder="#lead-form" />
                  <p className="text-xs leading-5 text-slate-500">Se conserva para sitios que ya tienen su propio formulario. El modo recomendado ahora es iframe público hospedado por SGDigital.</p>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Tipo de bridge</Label>
                  <Select value={wizardForm.bridgeKind} onValueChange={(value) => setWizardForm((prev) => ({ ...prev, bridgeKind: value }))}>
                    <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERIC">GENERIC</SelectItem>
                      <SelectItem value="BOOKING">BOOKING</SelectItem>
                      <SelectItem value="GMAIL">GMAIL</SelectItem>
                      <SelectItem value="OUTLOOK">OUTLOOK</SelectItem>
                      <SelectItem value="GOOGLE_SHEETS">GOOGLE_SHEETS</SelectItem>
                      <SelectItem value="GOOGLE_CALENDAR">GOOGLE_CALENDAR</SelectItem>
                      <SelectItem value="MICROSOFT_365_CALENDAR">MICROSOFT_365_CALENDAR</SelectItem>
                      <SelectItem value="SLACK">SLACK</SelectItem>
                      <SelectItem value="TEAMS">TEAMS</SelectItem>
                      <SelectItem value="META_LEAD_ADS">META_LEAD_ADS</SelectItem>
                      <SelectItem value="EXTERNAL_FORM">EXTERNAL_FORM</SelectItem>
                      <SelectItem value="TIKTOK">TIKTOK</SelectItem>
                      <SelectItem value="YOUTUBE">YOUTUBE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {wizardForm.bridgeKind === 'BOOKING' ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Confirmaciones al usuario</Label>
                    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                      <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                        <span>Enviar correo al agendar</span>
                        <Switch checked={wizardForm.bookingNotifyByEmail} onCheckedChange={(checked) => setWizardForm((prev) => ({ ...prev, bookingNotifyByEmail: checked }))} />
                      </label>
                      <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                        <span>Enviar WhatsApp al agendar</span>
                        <Switch checked={wizardForm.bookingNotifyByWhatsApp} onCheckedChange={(checked) => setWizardForm((prev) => ({ ...prev, bookingNotifyByWhatsApp: checked }))} />
                      </label>
                    </div>
                    <p className="text-xs leading-5 text-slate-500">Estas opciones disparan confirmación al usuario cuando la cita entra por el iframe o por el API.</p>
                  </div>
                ) : null}
                {props.isOutgoingWebhookBridge(wizardForm.bridgeKind) ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Webhook saliente</Label>
                    <Input value={wizardForm.outgoingWebhookUrl} onChange={(e) => setWizardForm((prev) => ({ ...prev, outgoingWebhookUrl: e.target.value }))} className="h-11 rounded-xl bg-white" placeholder={wizardForm.bridgeKind === 'SLACK' ? 'https://hooks.slack.com/services/...' : wizardForm.bridgeKind === 'TEAMS' ? 'https://...webhook.office.com/...' : 'https://tu-automatizacion.com/webhooks/calendar'} />
                    <p className="text-xs leading-5 text-slate-500">Slack y Teams reciben alertas internas. Google Calendar y Microsoft 365 Calendar reciben tareas o citas del CRM cuando tienen fecha programada.</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </TabsContent>
      ) : null}

      <TabsContent value="styles" className="space-y-4">
        <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="text-sm font-semibold text-slate-900">Dirección visual</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Define colores base, look del contenedor y contraste de inputs y CTA.</p>
          </div>
          <div className="grid gap-2"><Label>Color de acento</Label><Input value={props.form.accentColor} onChange={(e) => props.patchForm({ accentColor: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Color CTA</Label><Input value={props.form.formCtaColor} onChange={(e) => props.patchForm({ formCtaColor: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Texto CTA</Label><Input value={props.form.formCtaTextColor} onChange={(e) => props.patchForm({ formCtaTextColor: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Fondo general</Label><Input value={props.form.pageBackgroundColor} onChange={(e) => props.patchForm({ pageBackgroundColor: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Fondo interno</Label><Input value={props.form.backgroundColor} onChange={(e) => props.patchForm({ backgroundColor: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Color labels</Label><Input value={props.form.formLabelColor} onChange={(e) => props.patchForm({ formLabelColor: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Color borde inputs</Label><Input value={props.form.formInputBorderColor} onChange={(e) => props.patchForm({ formInputBorderColor: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Fondo inputs</Label><Input value={props.form.formInputBackgroundColor} onChange={(e) => props.patchForm({ formInputBackgroundColor: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Texto inputs</Label><Input value={props.form.formInputTextColor} onChange={(e) => props.patchForm({ formInputTextColor: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
        </div>
      </TabsContent>

      <TabsContent value="fields" className="space-y-4">
        <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { key: 'showNameField', label: 'Nombre' },
            { key: 'showEmailField', label: 'Correo' },
            { key: 'showPhoneField', label: 'Teléfono' },
            { key: 'showCompanyField', label: 'Empresa' },
            { key: 'showCityField', label: 'Ciudad' },
            { key: 'showProductField', label: 'Producto' },
            { key: 'showMessageField', label: 'Mensaje' },
          ].map((field) => (
            <div key={field.key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{field.label}</p>
                <p className="text-xs text-slate-500">Mostrar en el formulario</p>
              </div>
              <Switch checked={Boolean(props.form[field.key as keyof WebFormSectionsForm])} onCheckedChange={(checked) => props.patchForm({ [field.key]: checked } as Partial<TForm>)} />
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2"><Label>Label nombre</Label><Input value={props.form.nameLabel} onChange={(e) => props.patchForm({ nameLabel: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Placeholder nombre</Label><Input value={props.form.namePlaceholder} onChange={(e) => props.patchForm({ namePlaceholder: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Label correo</Label><Input value={props.form.emailLabel} onChange={(e) => props.patchForm({ emailLabel: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Placeholder correo</Label><Input value={props.form.emailPlaceholder} onChange={(e) => props.patchForm({ emailPlaceholder: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Label teléfono</Label><Input value={props.form.phoneLabel} onChange={(e) => props.patchForm({ phoneLabel: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Placeholder teléfono</Label><Input value={props.form.phonePlaceholder} onChange={(e) => props.patchForm({ phonePlaceholder: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Label empresa</Label><Input value={props.form.companyLabel} onChange={(e) => props.patchForm({ companyLabel: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Placeholder empresa</Label><Input value={props.form.companyPlaceholder} onChange={(e) => props.patchForm({ companyPlaceholder: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Label ciudad</Label><Input value={props.form.cityLabel} onChange={(e) => props.patchForm({ cityLabel: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Placeholder ciudad</Label><Input value={props.form.cityPlaceholder} onChange={(e) => props.patchForm({ cityPlaceholder: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Label producto</Label><Input value={props.form.productLabel} onChange={(e) => props.patchForm({ productLabel: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Placeholder producto</Label><Input value={props.form.productPlaceholder} onChange={(e) => props.patchForm({ productPlaceholder: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Label mensaje</Label><Input value={props.form.messageLabel} onChange={(e) => props.patchForm({ messageLabel: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Placeholder mensaje</Label><Input value={props.form.messagePlaceholder} onChange={(e) => props.patchForm({ messagePlaceholder: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Campos personalizados</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Agrega campos extra tipo input, textarea, phone, email, select, check o file.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {props.customFieldTypeOptions.map((item) => (
                <Button key={item.value} type="button" variant="outline" className="rounded-xl" onClick={() => props.addField(item.value)}>
                  + {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {props.form.webFormCustomFields.length ? props.form.webFormCustomFields.map((field) => (
              <div key={field.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{field.label || 'Campo personalizado'}</p>
                    <p className="text-xs text-slate-500">{props.getWebFormFieldTypeLabel(field.type)} · key {field.key}</p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => props.removeField(field.id)}>
                    Eliminar campo
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2"><Label>Label</Label><Input value={field.label} onChange={(e) => props.updateField(field.id, { label: e.target.value })} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Key interna</Label><Input value={field.key} onChange={(e) => props.updateField(field.id, { key: e.target.value })} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2">
                    <Label>Tipo</Label>
                    <Select value={field.type} onValueChange={(value) => props.updateField(field.id, { type: value as WebFormCustomFieldType, options: value === 'select' ? (field.options.length ? field.options : ['Opción 1', 'Opción 2']) : [], fullWidth: value === 'textarea' || value === 'file' ? true : field.fullWidth })}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {props.customFieldTypeOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Texto guía / placeholder</Label><Input value={field.placeholder} onChange={(e) => props.updateField(field.id, { placeholder: e.target.value })} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2 md:col-span-2"><Label>Ayuda</Label><Input value={field.helpText} onChange={(e) => props.updateField(field.id, { helpText: e.target.value })} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Valor por defecto</Label><Input value={field.defaultValue} onChange={(e) => props.updateField(field.id, { defaultValue: e.target.value })} className="h-11 rounded-xl" /></div>
                  {field.type === 'select' ? <div className="grid gap-2"><Label>Opciones</Label><Input value={field.options.join(', ')} onChange={(e) => props.updateField(field.id, { options: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} className="h-11 rounded-xl" placeholder="Opción 1, Opción 2" /></div> : null}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Campo obligatorio</p>
                      <p className="text-xs text-slate-500">Exige completarlo antes de enviar.</p>
                    </div>
                    <Switch checked={field.required} onCheckedChange={(checked) => props.updateField(field.id, { required: checked })} />
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Ancho completo</p>
                      <p className="text-xs text-slate-500">Ocupa toda la fila en el formulario.</p>
                    </div>
                    <Switch checked={field.fullWidth} onCheckedChange={(checked) => props.updateField(field.id, { fullWidth: checked })} />
                  </div>
                </div>
              </div>
            )) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">Aún no hay campos personalizados. Usa los botones superiores para agregarlos.</div>}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="variables" className="space-y-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Variables ocultas</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Sirven para pasar UTMs, campañas o valores fijos sin mostrarlos al usuario.</p>
            </div>
            <Button type="button" className="rounded-xl" onClick={() => props.addVariable()}>
              Agregar variable
            </Button>
          </div>

          <div className="mt-4 space-y-4">
            {props.form.webFormVariables.length ? props.form.webFormVariables.map((variable) => (
              <div key={variable.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{variable.label || 'Variable oculta'}</p>
                    <p className="text-xs text-slate-500">{variable.source === 'query' ? 'Tomada de la URL' : 'Valor estático'} · key {variable.key}</p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => props.removeVariable(variable.id)}>
                    Eliminar variable
                  </Button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2"><Label>Label</Label><Input value={variable.label} onChange={(e) => props.updateVariable(variable.id, { label: e.target.value })} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Key interna</Label><Input value={variable.key} onChange={(e) => props.updateVariable(variable.id, { key: e.target.value })} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2">
                    <Label>Origen</Label>
                    <Select value={variable.source} onValueChange={(value) => props.updateVariable(variable.id, { source: value as WebFormVariable['source'] })}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="query">Query param</SelectItem>
                        <SelectItem value="static">Valor estático</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {variable.source === 'query' ? <div className="grid gap-2"><Label>Nombre del query param</Label><Input value={variable.queryParam} onChange={(e) => props.updateVariable(variable.id, { queryParam: e.target.value })} className="h-11 rounded-xl" placeholder="utm_source" /></div> : <div className="grid gap-2"><Label>Valor fijo</Label><Input value={variable.value} onChange={(e) => props.updateVariable(variable.id, { value: e.target.value })} className="h-11 rounded-xl" /></div>}
                </div>
              </div>
            )) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">No hay variables ocultas configuradas todavía.</div>}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="size" className="space-y-4">
        <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
          <div className="grid gap-2"><Label>Altura del iframe</Label><Input value={props.form.iframeHeight} onChange={(e) => props.patchForm({ iframeHeight: props.normalizePixelValue(e.target.value, '840') } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Tamaño base</Label><Input value={props.form.formFontSize} onChange={(e) => props.patchForm({ formFontSize: props.normalizePixelValue(e.target.value, '14') } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Radio tarjeta</Label><Input value={props.form.formCardRadius} onChange={(e) => props.patchForm({ formCardRadius: props.normalizePixelValue(e.target.value, '28') } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Radio inputs</Label><Input value={props.form.formInputRadius} onChange={(e) => props.patchForm({ formInputRadius: props.normalizePixelValue(e.target.value, '16') } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Espaciado entre campos</Label><Input value={props.form.formFieldSpacing} onChange={(e) => props.patchForm({ formFieldSpacing: props.normalizePixelValue(e.target.value, '14') } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Padding interno</Label><Input value={props.form.formPadding} onChange={(e) => props.patchForm({ formPadding: props.normalizePixelValue(e.target.value, '24') } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
        </div>
      </TabsContent>

      <TabsContent value="texts" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2"><Label>Título del formulario</Label><Input value={props.form.formTitle} onChange={(e) => props.patchForm({ formTitle: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Descripción comercial</Label><Textarea value={props.form.formDescription} onChange={(e) => props.patchForm({ formDescription: e.target.value } as Partial<TForm>)} rows={3} className="rounded-2xl" /></div>
          <div className="grid gap-2"><Label>Texto del CTA</Label><Input value={props.form.submitCtaLabel} onChange={(e) => props.patchForm({ submitCtaLabel: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Fuente CSS</Label><Input value={props.form.fontFamily} onChange={(e) => props.patchForm({ fontFamily: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Mensaje de éxito</Label><Textarea value={props.form.formSuccessMessage} onChange={(e) => props.patchForm({ formSuccessMessage: e.target.value } as Partial<TForm>)} rows={3} className="rounded-2xl" /></div>
        </div>
      </TabsContent>

      <TabsContent value="terms" className="space-y-4">
        <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Mostrar aceptación de términos</p>
              <p className="text-xs text-slate-500">Añade checkbox de autorización o tratamiento de datos.</p>
            </div>
            <Switch checked={props.form.termsEnabled} onCheckedChange={(checked) => props.patchForm({ termsEnabled: checked } as Partial<TForm>)} />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Requerir aceptación</p>
              <p className="text-xs text-slate-500">Bloquea el envío si el usuario no acepta.</p>
            </div>
            <Switch checked={props.form.termsRequired} onCheckedChange={(checked) => props.patchForm({ termsRequired: checked } as Partial<TForm>)} disabled={!props.form.termsEnabled} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>Texto principal</Label><Textarea value={props.form.termsLabel} onChange={(e) => props.patchForm({ termsLabel: e.target.value } as Partial<TForm>)} rows={2} className="rounded-2xl" disabled={!props.form.termsEnabled} /></div>
            <div className="grid gap-2"><Label>Texto del enlace</Label><Input value={props.form.termsLinkText} onChange={(e) => props.patchForm({ termsLinkText: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" disabled={!props.form.termsEnabled} /></div>
            <div className="grid gap-2"><Label>URL de términos</Label><Input value={props.form.termsLinkUrl} onChange={(e) => props.patchForm({ termsLinkUrl: e.target.value } as Partial<TForm>)} className="h-11 rounded-xl" placeholder="https://..." disabled={!props.form.termsEnabled} /></div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="technical" className="space-y-4">
        <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Publicar formulario por iframe</p>
              <p className="text-xs text-slate-500">Expone URL pública e iframe para el sitio del cliente.</p>
            </div>
            <Switch checked={props.form.publicEmbedEnabled} onCheckedChange={(checked) => props.patchForm({ publicEmbedEnabled: checked } as Partial<TForm>)} />
          </div>
          <div className="grid gap-2">
            <Label>Dominios permitidos</Label>
            <Textarea value={props.form.allowedDomains} onChange={(e) => props.patchForm({ allowedDomains: e.target.value } as Partial<TForm>)} rows={3} className="rounded-2xl" placeholder="cliente.com, demo.cliente.com" />
          </div>
          {isWizard && wizardForm && setWizardForm ? (
            <div className="grid gap-2">
              <Label>Selector del formulario legacy</Label>
              <Input value={wizardForm.formSelector} onChange={(e) => setWizardForm((current) => ({ ...current, formSelector: e.target.value }))} className="h-11 rounded-xl" placeholder="#lead-form" />
            </div>
          ) : null}
        </div>
      </TabsContent>
    </Tabs>
  )
}