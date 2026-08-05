"use client"

import type { Dispatch, SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type ChatbotWizardSection = 'base' | 'brand' | 'launcher' | 'copy'

type WizardChatbotForm = {
  name: string
  provider: string
  status: string
  testingToken: string
  allowedDomains: string
  publicEmbedEnabled: boolean
  chatbotTitle: string
  assistantName: string
  chatbotPrompt: string
  iframeHeight: string
  fontFamily: string
  accentColor: string
  pageBackgroundColor: string
  backgroundColor: string
  headerBadgeLabel: string
  statusBadgeLabel: string
  chatShellRadius: string
  messageBubbleRadius: string
  panelShadowPreset: string
  floatingLauncherEnabled: boolean
  launcherStartsCollapsed: boolean
  launcherLabel: string
  launcherIcon: string
  launcherPosition: string
  launcherPlacement: string
  launcherSize: string
  launcherOffsetX: string
  launcherOffsetY: string
  backdropZIndex: string
  panelZIndex: string
  launcherZIndex: string
  showProductField: boolean
  nameLabel: string
  namePlaceholder: string
  emailLabel: string
  emailPlaceholder: string
  phoneLabel: string
  phonePlaceholder: string
  productLabel: string
  productPlaceholder: string
  messageLabel: string
  messagePlaceholder: string
}

type Props<TForm extends WizardChatbotForm> = {
  section: ChatbotWizardSection
  setSection: (section: ChatbotWizardSection) => void
  form: TForm
  setForm: Dispatch<SetStateAction<TForm>>
  sectionOptions: Array<{ id: ChatbotWizardSection; label: string }>
  channelStatusOptions: string[]
  makeDemoToken: () => string
  normalizePixelValue: (value: string, fallback: string) => string
  normalizeZIndexValue: (value: string, fallback: string) => string
}

export function CrmIntegrationsChatbotWizardSections<TForm extends WizardChatbotForm>(props: Props<TForm>) {
  const { form, setForm } = props

  return (
    <Tabs value={props.section} onValueChange={(value) => props.setSection(value as ChatbotWizardSection)} className="space-y-4">
      <div className="overflow-x-auto pb-1">
        <TabsList className="inline-flex h-auto min-w-max flex-nowrap rounded-2xl border border-slate-200 bg-slate-50 p-1 md:flex-wrap">
          {props.sectionOptions.map((item) => (
            <TabsTrigger key={item.id} value={item.id} className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="base" className="space-y-4">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-900">Identidad del canal</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Define cómo aparecerá el chatbot dentro del CRM y con qué estado arranca.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2">
                <Label>Nombre del canal</Label>
                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} className="h-11 rounded-xl bg-white" />
              </div>
              <div className="grid gap-2">
                <Label>Proveedor técnico</Label>
                <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">{form.provider}</div>
              </div>
              <div className="grid gap-2">
                <Label>Estado inicial</Label>
                <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
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
              <p className="mt-1 text-xs leading-5 text-slate-500">Controla el token de pruebas, la URL pública del iframe y las restricciones por dominio.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2">
                <Label>Token de prueba / verificación</Label>
                <div className="flex gap-2">
                  <Input value={form.testingToken} onChange={(e) => setForm((prev) => ({ ...prev, testingToken: e.target.value }))} className="h-11 rounded-xl bg-white" />
                  <Button type="button" variant="outline" className="rounded-xl bg-white" onClick={() => setForm((prev) => ({ ...prev, testingToken: props.makeDemoToken() }))}>Regenerar</Button>
                </div>
                <p className="text-xs leading-5 text-slate-500">Se usa para pruebas seguras, verificación y bridges demo.</p>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Dominios permitidos</Label>
                <Textarea value={form.allowedDomains} onChange={(e) => setForm((prev) => ({ ...prev, allowedDomains: e.target.value }))} rows={3} className="rounded-2xl bg-white" placeholder="cliente.com, demo.cliente.com" />
              </div>
              <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Publicar iframe sin token</p>
                  <p className="text-xs text-slate-500">Recomendado para la demo controlada del cliente.</p>
                </div>
                <Switch checked={form.publicEmbedEnabled} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, publicEmbedEnabled: checked }))} />
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="brand" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2"><Label>Título visible del chatbot</Label><Input value={form.chatbotTitle} onChange={(e) => setForm((prev) => ({ ...prev, chatbotTitle: e.target.value }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Nombre del asistente</Label><Input value={form.assistantName} onChange={(e) => setForm((prev) => ({ ...prev, assistantName: e.target.value }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Prompt inicial</Label><Textarea value={form.chatbotPrompt} onChange={(e) => setForm((prev) => ({ ...prev, chatbotPrompt: e.target.value }))} rows={4} className="rounded-2xl" /></div>
          <div className="grid gap-2"><Label>Altura del iframe</Label><Input value={form.iframeHeight} onChange={(e) => setForm((prev) => ({ ...prev, iframeHeight: e.target.value }))} className="h-11 rounded-xl" placeholder="720" /></div>
          <div className="grid gap-2"><Label>Fuente CSS</Label><Input value={form.fontFamily} onChange={(e) => setForm((prev) => ({ ...prev, fontFamily: e.target.value }))} className="h-11 rounded-xl" placeholder="ui-sans-serif, system-ui, sans-serif" /></div>
          <div className="grid gap-2"><Label>Color de acento</Label><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2"><input type="color" value={form.accentColor} onChange={(e) => setForm((prev) => ({ ...prev, accentColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar color de acento" /><div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: form.accentColor }} /><Input value={form.accentColor} onChange={(e) => setForm((prev) => ({ ...prev, accentColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="#1d4ed8" /></div></div>
          <div className="grid gap-2"><Label>Color de fondo general</Label><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2"><input type="color" value={form.pageBackgroundColor} onChange={(e) => setForm((prev) => ({ ...prev, pageBackgroundColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar color de fondo general" /><div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: form.pageBackgroundColor }} /><Input value={form.pageBackgroundColor} onChange={(e) => setForm((prev) => ({ ...prev, pageBackgroundColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="#eef5ff" /></div></div>
          <div className="grid gap-2"><Label>Color de fondo interno</Label><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2"><input type="color" value={form.backgroundColor} onChange={(e) => setForm((prev) => ({ ...prev, backgroundColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar color de fondo interno" /><div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: form.backgroundColor }} /><Input value={form.backgroundColor} onChange={(e) => setForm((prev) => ({ ...prev, backgroundColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="#f8fbff" /></div></div>
          <div className="grid gap-2"><Label>Etiqueta superior</Label><Input value={form.headerBadgeLabel} onChange={(e) => setForm((prev) => ({ ...prev, headerBadgeLabel: e.target.value }))} className="h-11 rounded-xl" placeholder="Chatbot CRM" /></div>
          <div className="grid gap-2"><Label>Estado del asistente</Label><Input value={form.statusBadgeLabel} onChange={(e) => setForm((prev) => ({ ...prev, statusBadgeLabel: e.target.value }))} className="h-11 rounded-xl" placeholder="En linea" /></div>
          <div className="grid gap-2"><Label>Radio del panel</Label><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"><Input value={form.chatShellRadius} onChange={(e) => setForm((prev) => ({ ...prev, chatShellRadius: props.normalizePixelValue(e.target.value, '30') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="30" /><span className="text-xs font-medium text-slate-500">px</span></div></div>
          <div className="grid gap-2"><Label>Radio de burbujas</Label><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"><Input value={form.messageBubbleRadius} onChange={(e) => setForm((prev) => ({ ...prev, messageBubbleRadius: props.normalizePixelValue(e.target.value, '22') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="22" /><span className="text-xs font-medium text-slate-500">px</span></div></div>
          <div className="grid gap-2 md:col-span-2"><Label>Sombra del panel</Label><Select value={form.panelShadowPreset} onValueChange={(value) => setForm((prev) => ({ ...prev, panelShadowPreset: value }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="soft">Suave</SelectItem><SelectItem value="medium">Media</SelectItem><SelectItem value="strong">Fuerte</SelectItem></SelectContent></Select></div>
        </div>
      </TabsContent>

      <TabsContent value="launcher" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Habilitar launcher flotante</p>
              <p className="text-xs text-slate-500">Controla si se genera y se usa el botón flotante además del iframe público.</p>
            </div>
            <Switch checked={form.floatingLauncherEnabled} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, floatingLauncherEnabled: checked }))} />
          </div>
          <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Abrir panel al cargar</p>
              <p className="text-xs text-slate-500">Si se desactiva, el widget inicia colapsado y muestra solo el launcher.</p>
            </div>
            <Switch checked={!form.launcherStartsCollapsed} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, launcherStartsCollapsed: !checked }))} disabled={!form.floatingLauncherEnabled} />
          </div>
          <div className="grid gap-2"><Label>Texto del launcher flotante</Label><Input value={form.launcherLabel} onChange={(e) => setForm((prev) => ({ ...prev, launcherLabel: e.target.value }))} className="h-11 rounded-xl" placeholder="Abrir asesor virtual" /></div>
          <div className="grid gap-2"><Label>Icono del launcher</Label><Select value={form.launcherIcon} onValueChange={(value) => setForm((prev) => ({ ...prev, launcherIcon: value }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bot">bot</SelectItem><SelectItem value="message-circle">message-circle</SelectItem><SelectItem value="sparkles">sparkles</SelectItem></SelectContent></Select></div>
          <div className="grid gap-2"><Label>Alineación horizontal</Label><Select value={form.launcherPosition} onValueChange={(value) => setForm((prev) => ({ ...prev, launcherPosition: value }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="right">Derecha</SelectItem><SelectItem value="center">Centro</SelectItem><SelectItem value="left">Izquierda</SelectItem></SelectContent></Select></div>
          <div className="grid gap-2"><Label>Tipo de posición</Label><Select value={form.launcherPlacement} onValueChange={(value) => setForm((prev) => ({ ...prev, launcherPlacement: value }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="absolute">Absolute</SelectItem></SelectContent></Select></div>
          <div className="grid gap-2"><Label>Tamaño del launcher</Label><Select value={form.launcherSize} onValueChange={(value) => setForm((prev) => ({ ...prev, launcherSize: value }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Compacto</SelectItem><SelectItem value="standard">Estándar</SelectItem><SelectItem value="large">Grande</SelectItem></SelectContent></Select></div>
          <div className="grid gap-2"><Label>Offset horizontal</Label><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"><Input value={form.launcherOffsetX} onChange={(e) => setForm((prev) => ({ ...prev, launcherOffsetX: props.normalizePixelValue(e.target.value, '60') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="60" /><span className="text-xs font-medium text-slate-500">px</span></div></div>
          <div className="grid gap-2"><Label>Offset vertical</Label><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"><Input value={form.launcherOffsetY} onChange={(e) => setForm((prev) => ({ ...prev, launcherOffsetY: props.normalizePixelValue(e.target.value, '60') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="60" /><span className="text-xs font-medium text-slate-500">px</span></div></div>
          <div className="grid gap-2"><Label>Z-index overlay</Label><Input value={form.backdropZIndex} onChange={(e) => setForm((prev) => ({ ...prev, backdropZIndex: props.normalizeZIndexValue(e.target.value, '2147483645') }))} className="h-11 rounded-xl" placeholder="2147483645" /></div>
          <div className="grid gap-2"><Label>Z-index panel</Label><Input value={form.panelZIndex} onChange={(e) => setForm((prev) => ({ ...prev, panelZIndex: props.normalizeZIndexValue(e.target.value, '2147483646') }))} className="h-11 rounded-xl" placeholder="2147483646" /></div>
          <div className="grid gap-2"><Label>Z-index launcher</Label><Input value={form.launcherZIndex} onChange={(e) => setForm((prev) => ({ ...prev, launcherZIndex: props.normalizeZIndexValue(e.target.value, '2147483647') }))} className="h-11 rounded-xl" placeholder="2147483647" /></div>
        </div>
      </TabsContent>

      <TabsContent value="copy" className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Solicitar producto en la captura inicial</p>
              <p className="text-xs text-slate-500">Permite que el bot consulte inventario y responda con referencia, precio y disponibilidad.</p>
            </div>
            <Switch checked={form.showProductField} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, showProductField: checked }))} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2"><Label>Label nombre</Label><Input value={form.nameLabel} onChange={(e) => setForm((prev) => ({ ...prev, nameLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Placeholder nombre</Label><Input value={form.namePlaceholder} onChange={(e) => setForm((prev) => ({ ...prev, namePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Label correo</Label><Input value={form.emailLabel} onChange={(e) => setForm((prev) => ({ ...prev, emailLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Placeholder correo</Label><Input value={form.emailPlaceholder} onChange={(e) => setForm((prev) => ({ ...prev, emailPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Label teléfono</Label><Input value={form.phoneLabel} onChange={(e) => setForm((prev) => ({ ...prev, phoneLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Placeholder teléfono</Label><Input value={form.phonePlaceholder} onChange={(e) => setForm((prev) => ({ ...prev, phonePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Label producto</Label><Input value={form.productLabel} onChange={(e) => setForm((prev) => ({ ...prev, productLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Placeholder producto</Label><Input value={form.productPlaceholder} onChange={(e) => setForm((prev) => ({ ...prev, productPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Label mensaje</Label><Input value={form.messageLabel} onChange={(e) => setForm((prev) => ({ ...prev, messageLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Placeholder mensaje</Label><Input value={form.messagePlaceholder} onChange={(e) => setForm((prev) => ({ ...prev, messagePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}