"use client"

import type { Dispatch, SetStateAction } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

type ChatbotBuilderSection = 'brand' | 'launcher' | 'copy'
type PanelShadowPreset = 'soft' | 'medium' | 'strong'
type LauncherPosition = 'left' | 'center' | 'right'
type LauncherPlacement = 'fixed' | 'absolute'
type LauncherSize = 'compact' | 'standard' | 'large'
type PublicChatbotResetConversationUnit = 'minutes' | 'hours' | 'days'
type ChatbotInactivityAction = 'restart' | 'close'
type ChatbotInactivityUnit = 'minutes' | 'hours' | 'days'

type PreChatFormPreset = {
  value: string
  label: string
  title: string
  description: string
  submitLabel: string
  showNameField: boolean
  showEmailField: boolean
  showPhoneField: boolean
  requireName: boolean
  requireEmail: boolean
  requirePhone: boolean
  requireContactMethod: boolean
  showDepartmentField: boolean
  departmentLabel: string
  departmentPlaceholder: string
  departmentOptions: Array<{ label: string }>
}

type ChatbotBuilderDraft = {
  chatbotTitle: string
  assistantName: string
  chatbotPrompt: string
  iframeHeight: string
  fontFamily: string
  allowedDomains: string
  accentColor: string
  pageBackgroundColor: string
  backgroundColor: string
  headerBadgeLabel: string
  statusBadgeLabel: string
  chatShellRadius: string
  messageBubbleRadius: string
  panelShadowPreset: PanelShadowPreset
  floatingLauncherEnabled: boolean
  launcherStartsCollapsed: boolean
  showProductField: boolean
  launcherLabel: string
  launcherIcon: string
  launcherPosition: LauncherPosition
  launcherPlacement: LauncherPlacement
  launcherSize: LauncherSize
  launcherOffsetX: string
  launcherOffsetY: string
  backdropZIndex: string
  panelZIndex: string
  launcherZIndex: string
  productLabel: string
  productPlaceholder: string
  messageLabel: string
  messagePlaceholder: string
  preChatFormEnabled: boolean
  chatResetConversationAfterValue: string
  chatResetConversationAfterUnit: PublicChatbotResetConversationUnit
  chatResetConversationAfterAction: ChatbotInactivityAction
  preChatFormTemplate: string
  preChatFormInactivityEnabled: boolean
  preChatFormInactivityValue: string
  preChatFormInactivityUnit: ChatbotInactivityUnit
  preChatFormInactivityAction: ChatbotInactivityAction
  preChatFormTitle: string
  preChatFormDescription: string
  preChatFormSubmitLabel: string
  preChatFormShowNameField: boolean
  preChatFormRequireName: boolean
  preChatFormShowEmailField: boolean
  preChatFormRequireEmail: boolean
  preChatFormShowPhoneField: boolean
  preChatFormRequirePhone: boolean
  preChatFormRequireContactMethod: boolean
  preChatFormShowDepartmentField: boolean
  preChatFormDepartmentLabel: string
  preChatFormDepartmentPlaceholder: string
  preChatFormDepartmentOptions: string
  termsEnabled: boolean
  termsLabel: string
  termsLinkText: string
  termsLinkUrl: string
}

export function CrmIntegrationsChatbotBuilderSections<TDraft extends ChatbotBuilderDraft>(props: {
  section: ChatbotBuilderSection
  draft: TDraft
  setDraft: Dispatch<SetStateAction<TDraft>>
  normalizePixelValue: (value: string, fallback: string) => string
  normalizeZIndexValue: (value: string, fallback: string) => string
  getPreChatFormPreset: (value: string) => PreChatFormPreset
  getPreChatFormPresets: () => PreChatFormPreset[]
}) {
  const { section, draft, setDraft, normalizePixelValue, normalizeZIndexValue, getPreChatFormPreset, getPreChatFormPresets } = props

  if (section === 'brand') {
    return (
      <>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2 md:col-span-2"><Label>Título del chatbot</Label><Input value={draft.chatbotTitle} onChange={(e) => setDraft((current) => ({ ...current, chatbotTitle: e.target.value }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Nombre del asistente</Label><Input value={draft.assistantName} onChange={(e) => setDraft((current) => ({ ...current, assistantName: e.target.value }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Prompt inicial legacy</Label><Textarea value={draft.chatbotPrompt} onChange={(e) => setDraft((current) => ({ ...current, chatbotPrompt: e.target.value }))} rows={3} className="rounded-2xl" /></div>
          <div className="grid gap-2"><Label>Altura iframe</Label><Input value={draft.iframeHeight} onChange={(e) => setDraft((current) => ({ ...current, iframeHeight: normalizePixelValue(e.target.value, '720') }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Fuente CSS</Label><Input value={draft.fontFamily} onChange={(e) => setDraft((current) => ({ ...current, fontFamily: e.target.value }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2 md:col-span-2"><Label>Dominios permitidos</Label><Textarea value={draft.allowedDomains} onChange={(e) => setDraft((current) => ({ ...current, allowedDomains: e.target.value }))} rows={2} className="rounded-2xl" placeholder="cliente.com, demo.cliente.com" /></div>
        </div>

        <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
          <div className="grid gap-2"><Label>Color acento</Label><Input value={draft.accentColor} onChange={(e) => setDraft((current) => ({ ...current, accentColor: e.target.value }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Fondo general</Label><Input value={draft.pageBackgroundColor} onChange={(e) => setDraft((current) => ({ ...current, pageBackgroundColor: e.target.value }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Fondo interno</Label><Input value={draft.backgroundColor} onChange={(e) => setDraft((current) => ({ ...current, backgroundColor: e.target.value }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Etiqueta superior</Label><Input value={draft.headerBadgeLabel} onChange={(e) => setDraft((current) => ({ ...current, headerBadgeLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Estado del asistente</Label><Input value={draft.statusBadgeLabel} onChange={(e) => setDraft((current) => ({ ...current, statusBadgeLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Radio del panel</Label><Input value={draft.chatShellRadius} onChange={(e) => setDraft((current) => ({ ...current, chatShellRadius: normalizePixelValue(e.target.value, '30') }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Radio de burbujas</Label><Input value={draft.messageBubbleRadius} onChange={(e) => setDraft((current) => ({ ...current, messageBubbleRadius: normalizePixelValue(e.target.value, '22') }))} className="h-11 rounded-xl" /></div>
          <div className="grid gap-2"><Label>Sombra del panel</Label><Select value={draft.panelShadowPreset} onValueChange={(value) => setDraft((current) => ({ ...current, panelShadowPreset: value as PanelShadowPreset }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="soft">Suave</SelectItem><SelectItem value="medium">Media</SelectItem><SelectItem value="strong">Fuerte</SelectItem></SelectContent></Select></div>
        </div>
      </>
    )
  }

  if (section === 'launcher') {
    return (
      <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Launcher flotante</p>
            <p className="text-xs text-slate-500">Activa o desactiva el botón flotante</p>
          </div>
          <Switch checked={draft.floatingLauncherEnabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, floatingLauncherEnabled: checked }))} />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Abrir panel al cargar</p>
            <p className="text-xs text-slate-500">Si se apaga, el widget inicia colapsado y solo deja visible el launcher</p>
          </div>
          <Switch checked={!draft.launcherStartsCollapsed} onCheckedChange={(checked) => setDraft((current) => ({ ...current, launcherStartsCollapsed: !checked }))} disabled={!draft.floatingLauncherEnabled} />
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Solicitar producto</p>
            <p className="text-xs text-slate-500">Muestra el campo rápido en el composer</p>
          </div>
          <Switch checked={draft.showProductField} onCheckedChange={(checked) => setDraft((current) => ({ ...current, showProductField: checked }))} />
        </div>
        <div className="grid gap-2"><Label>Texto launcher</Label><Input value={draft.launcherLabel} onChange={(e) => setDraft((current) => ({ ...current, launcherLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
        <div className="grid gap-2"><Label>Icono launcher</Label><Select value={draft.launcherIcon} onValueChange={(value) => setDraft((current) => ({ ...current, launcherIcon: value }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bot">bot</SelectItem><SelectItem value="message-circle">message-circle</SelectItem><SelectItem value="sparkles">sparkles</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label>Alineación launcher</Label><Select value={draft.launcherPosition} onValueChange={(value) => setDraft((current) => ({ ...current, launcherPosition: value as LauncherPosition }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="right">Derecha</SelectItem><SelectItem value="center">Centro</SelectItem><SelectItem value="left">Izquierda</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label>Tipo posición</Label><Select value={draft.launcherPlacement} onValueChange={(value) => setDraft((current) => ({ ...current, launcherPlacement: value as LauncherPlacement }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="absolute">Absolute</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label>Tamaño launcher</Label><Select value={draft.launcherSize} onValueChange={(value) => setDraft((current) => ({ ...current, launcherSize: value as LauncherSize }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Compacto</SelectItem><SelectItem value="standard">Estándar</SelectItem><SelectItem value="large">Grande</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label>Offset horizontal</Label><Input value={draft.launcherOffsetX} onChange={(e) => setDraft((current) => ({ ...current, launcherOffsetX: normalizePixelValue(e.target.value, '60') }))} className="h-11 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>Offset vertical</Label><Input value={draft.launcherOffsetY} onChange={(e) => setDraft((current) => ({ ...current, launcherOffsetY: normalizePixelValue(e.target.value, '60') }))} className="h-11 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>Z-index overlay</Label><Input value={draft.backdropZIndex} onChange={(e) => setDraft((current) => ({ ...current, backdropZIndex: normalizeZIndexValue(e.target.value, '2147483645') }))} className="h-11 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>Z-index panel</Label><Input value={draft.panelZIndex} onChange={(e) => setDraft((current) => ({ ...current, panelZIndex: normalizeZIndexValue(e.target.value, '2147483646') }))} className="h-11 rounded-xl bg-white" /></div>
        <div className="grid gap-2"><Label>Z-index launcher</Label><Input value={draft.launcherZIndex} onChange={(e) => setDraft((current) => ({ ...current, launcherZIndex: normalizeZIndexValue(e.target.value, '2147483647') }))} className="h-11 rounded-xl bg-white" /></div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-2"><Label>Label producto</Label><Input value={draft.productLabel} onChange={(e) => setDraft((current) => ({ ...current, productLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
        <div className="grid gap-2"><Label>Placeholder producto</Label><Input value={draft.productPlaceholder} onChange={(e) => setDraft((current) => ({ ...current, productPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
        <div className="grid gap-2 md:col-span-2"><Label>Label mensaje</Label><Input value={draft.messageLabel} onChange={(e) => setDraft((current) => ({ ...current, messageLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
        <div className="grid gap-2 md:col-span-2"><Label>Placeholder mensaje</Label><Input value={draft.messagePlaceholder} onChange={(e) => setDraft((current) => ({ ...current, messagePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
      </div>

      <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Formulario previo al chat</p>
            <p className="text-xs text-slate-500">Pide datos y área antes de abrir la conversación del visitante.</p>
          </div>
          <Switch checked={draft.preChatFormEnabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, preChatFormEnabled: checked }))} />
        </div>
        <div className="grid gap-2">
          <Label>Reiniciar conversación después de</Label>
          <Input value={draft.chatResetConversationAfterValue} onChange={(e) => setDraft((current) => ({ ...current, chatResetConversationAfterValue: e.target.value.replace(/[^0-9]/g, '') || '1' }))} className="h-11 rounded-xl" />
        </div>
        <div className="grid gap-2">
          <Label>Unidad</Label>
          <Select value={draft.chatResetConversationAfterUnit} onValueChange={(value) => setDraft((current) => ({ ...current, chatResetConversationAfterUnit: value as PublicChatbotResetConversationUnit }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutes">Minutos</SelectItem><SelectItem value="hours">Horas</SelectItem><SelectItem value="days">Días</SelectItem></SelectContent></Select>
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label>Acción al vencer</Label>
          <Select value={draft.chatResetConversationAfterAction} onValueChange={(value) => setDraft((current) => ({ ...current, chatResetConversationAfterAction: value as ChatbotInactivityAction }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="restart">Volver al inicio</SelectItem><SelectItem value="close">Cerrar conversación</SelectItem></SelectContent></Select>
        </div>
        <div className="grid gap-2">
          <Label>Plantilla</Label>
          <Select value={draft.preChatFormTemplate} onValueChange={(value) => {
            const preset = getPreChatFormPreset(value)
            setDraft((current) => ({
              ...current,
              preChatFormTemplate: preset.value,
              preChatFormTitle: preset.title,
              preChatFormDescription: preset.description,
              preChatFormSubmitLabel: preset.submitLabel,
              preChatFormShowNameField: preset.showNameField,
              preChatFormShowEmailField: preset.showEmailField,
              preChatFormShowPhoneField: preset.showPhoneField,
              preChatFormRequireName: preset.requireName,
              preChatFormRequireEmail: preset.requireEmail,
              preChatFormRequirePhone: preset.requirePhone,
              preChatFormRequireContactMethod: preset.requireContactMethod,
              preChatFormShowDepartmentField: preset.showDepartmentField,
              preChatFormDepartmentLabel: preset.departmentLabel,
              preChatFormDepartmentPlaceholder: preset.departmentPlaceholder,
              preChatFormDepartmentOptions: preset.departmentOptions.map((item) => item.label).join('\n'),
            }))
          }}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{getPreChatFormPresets().map((preset) => <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="text-xs text-slate-500 md:col-span-2">Ejemplos: 5 minutos, 1 hora o 12 horas. Al vencer el tiempo, el visitante ve un hilo nuevo y el CRM puede seguir agrupando por correo o teléfono.</div>
        {draft.preChatFormEnabled ? (
          <>
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2 md:grid-cols-3">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 md:col-span-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Inactividad del formulario previo</p>
                  <p className="text-xs text-slate-500">Si el prospecto no termina esta plantilla, puedes reiniciarla o cerrar la conversación.</p>
                </div>
                <Switch checked={draft.preChatFormInactivityEnabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, preChatFormInactivityEnabled: checked }))} />
              </div>
              {draft.preChatFormInactivityEnabled ? (
                <>
                  <div className="grid gap-2">
                    <Label>Tiempo</Label>
                    <Input value={draft.preChatFormInactivityValue} onChange={(e) => setDraft((current) => ({ ...current, preChatFormInactivityValue: e.target.value.replace(/[^0-9]/g, '') || '1' }))} className="h-11 rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Unidad</Label>
                    <Select value={draft.preChatFormInactivityUnit} onValueChange={(value) => setDraft((current) => ({ ...current, preChatFormInactivityUnit: value as ChatbotInactivityUnit }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutes">Minutos</SelectItem><SelectItem value="hours">Horas</SelectItem><SelectItem value="days">Días</SelectItem></SelectContent></Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Al vencer</Label>
                    <Select value={draft.preChatFormInactivityAction} onValueChange={(value) => setDraft((current) => ({ ...current, preChatFormInactivityAction: value as ChatbotInactivityAction }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="restart">Volver al inicio</SelectItem><SelectItem value="close">Cerrar conversación</SelectItem></SelectContent></Select>
                  </div>
                </>
              ) : null}
            </div>
            <div className="grid gap-2 md:col-span-2"><Label>Título del formulario</Label><Input value={draft.preChatFormTitle} onChange={(e) => setDraft((current) => ({ ...current, preChatFormTitle: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Descripción</Label><Textarea value={draft.preChatFormDescription} onChange={(e) => setDraft((current) => ({ ...current, preChatFormDescription: e.target.value }))} rows={3} className="rounded-2xl" /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Texto del botón</Label><Input value={draft.preChatFormSubmitLabel} onChange={(e) => setDraft((current) => ({ ...current, preChatFormSubmitLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar nombre</span><Switch checked={draft.preChatFormShowNameField} onCheckedChange={(checked) => setDraft((current) => ({ ...current, preChatFormShowNameField: checked }))} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir nombre</span><Switch checked={draft.preChatFormRequireName} onCheckedChange={(checked) => setDraft((current) => ({ ...current, preChatFormRequireName: checked }))} disabled={!draft.preChatFormShowNameField} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar correo</span><Switch checked={draft.preChatFormShowEmailField} onCheckedChange={(checked) => setDraft((current) => ({ ...current, preChatFormShowEmailField: checked }))} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir correo</span><Switch checked={draft.preChatFormRequireEmail} onCheckedChange={(checked) => setDraft((current) => ({ ...current, preChatFormRequireEmail: checked }))} disabled={!draft.preChatFormShowEmailField} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar teléfono</span><Switch checked={draft.preChatFormShowPhoneField} onCheckedChange={(checked) => setDraft((current) => ({ ...current, preChatFormShowPhoneField: checked }))} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir teléfono</span><Switch checked={draft.preChatFormRequirePhone} onCheckedChange={(checked) => setDraft((current) => ({ ...current, preChatFormRequirePhone: checked }))} disabled={!draft.preChatFormShowPhoneField} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2"><span className="text-sm text-slate-700">Exigir al menos correo o teléfono</span><Switch checked={draft.preChatFormRequireContactMethod} onCheckedChange={(checked) => setDraft((current) => ({ ...current, preChatFormRequireContactMethod: checked }))} disabled={!draft.preChatFormShowEmailField && !draft.preChatFormShowPhoneField} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2"><span className="text-sm text-slate-700">Mostrar selector de departamento</span><Switch checked={draft.preChatFormShowDepartmentField} onCheckedChange={(checked) => setDraft((current) => ({ ...current, preChatFormShowDepartmentField: checked }))} /></div>
            {draft.preChatFormShowDepartmentField ? (
              <>
                <div className="grid gap-2"><Label>Label departamento</Label><Input value={draft.preChatFormDepartmentLabel} onChange={(e) => setDraft((current) => ({ ...current, preChatFormDepartmentLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                <div className="grid gap-2"><Label>Placeholder departamento</Label><Input value={draft.preChatFormDepartmentPlaceholder} onChange={(e) => setDraft((current) => ({ ...current, preChatFormDepartmentPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                <div className="grid gap-2 md:col-span-2"><Label>Opciones del departamento</Label><Textarea value={draft.preChatFormDepartmentOptions} onChange={(e) => setDraft((current) => ({ ...current, preChatFormDepartmentOptions: e.target.value }))} rows={4} className="rounded-2xl" placeholder="Ventas&#10;Soporte técnico&#10;Facturación" /></div>
              </>
            ) : null}
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2"><span className="text-sm text-slate-700">Mostrar nota legal</span><Switch checked={draft.termsEnabled} onCheckedChange={(checked) => setDraft((current) => ({ ...current, termsEnabled: checked }))} /></div>
            {draft.termsEnabled ? (
              <>
                <div className="grid gap-2 md:col-span-2"><Label>Texto legal</Label><Textarea value={draft.termsLabel} onChange={(e) => setDraft((current) => ({ ...current, termsLabel: e.target.value }))} rows={2} className="rounded-2xl" /></div>
                <div className="grid gap-2"><Label>Texto enlace</Label><Input value={draft.termsLinkText} onChange={(e) => setDraft((current) => ({ ...current, termsLinkText: e.target.value }))} className="h-11 rounded-xl" /></div>
                <div className="grid gap-2"><Label>URL política</Label><Input value={draft.termsLinkUrl} onChange={(e) => setDraft((current) => ({ ...current, termsLinkUrl: e.target.value }))} className="h-11 rounded-xl" placeholder="https://..." /></div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}