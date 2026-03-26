"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LucideIcon } from 'lucide-react'
import { Activity, BarChart3, Bot, Facebook, Globe, Goal, Instagram, Mail, MessageCircle, Sparkles, Target, TrendingUp } from 'lucide-react'
import { ErpPageHero, ErpSectionHeading } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  getDefaultChatbotFlowStages,
  getDefaultChatbotQuickActions,
  normalizeChatbotFlowStages,
  normalizeChatbotQuickActions,
  type ChatbotFlowNextField,
  type ChatbotFlowResponseMatchMode,
  type ChatbotFlowResponseOption,
  type ChatbotFlowStage,
  type ChatbotQuickAction,
} from '@/lib/crm-chatbot-flow'
import {
  buildChatbotEmbedUrl,
  buildChatbotIframeSnippet,
  buildChatbotSnippet,
  buildGmailAppsScriptSnippet,
  buildOutlookPayloadExample,
  buildWebFormEmbedUrl,
  buildWebFormIframeSnippet,
  buildWebFormSnippet,
  buildWebhookPayloadExample,
  getChannelProviderLabel,
  makeDemoToken,
  type CrmBridgeKind,
  type CrmChannelProvider,
} from '@/lib/crm-integration-assets'

type ChannelStatus = 'DRAFT' | 'TESTING' | 'ACTIVE' | 'DISABLED' | 'ERROR'

type ChannelConnection = {
  id: string
  name: string
  provider: CrmChannelProvider
  status: ChannelStatus
  verifyTokenPreview?: string | null
  settingsJson?: Record<string, unknown> | null
  externalAccountId?: string | null
  externalPageId?: string | null
  externalPhoneNumberId?: string | null
  lastWebhookAt?: string | null
  lastErrorAt?: string | null
  lastErrorMessage?: string | null
  updatedAt: string
  createdAt: string
  _count?: { conversations: number; captures: number }
}

type MetaPageAsset = {
  pageId: string
  pageName: string
  instagramAccountId?: string | null
  instagramUsername?: string | null
  instagramName?: string | null
}

type MetaWhatsAppAsset = {
  businessId: string
  businessName: string
  wabaId: string
  wabaName: string
  phoneNumberId: string
  displayPhoneNumber?: string | null
  verifiedName?: string | null
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

type TemplatePreset = {
  key: string
  name: string
  provider: CrmChannelProvider
  bridgeKind?: CrmBridgeKind
  description: string
  connectionModel: string
  readiness: string
  focus: string
}

type WizardStep = 'template' | 'config' | 'review'
type ChatbotPreviewMode = 'floating' | 'compact' | 'expanded'
type ChatbotPreviewViewport = 'desktop' | 'mobile'
type CrmWorkspaceView = 'operations' | 'metrics'
type LauncherPosition = 'right' | 'left'
type LauncherSize = 'compact' | 'standard' | 'large'
type PanelShadowPreset = 'soft' | 'medium' | 'strong'
type ChatbotBuilderSection = 'brand' | 'flow' | 'launcher' | 'copy'

type ChatbotCanvasNode = {
  stage: ChatbotFlowStage
  x: number
  y: number
  width: number
  height: number
}

type ChatbotCanvasConnection = {
  id: string
  fromStageId: string
  toStageId: string
  label: string
  path: string
}

type ChannelGoalTargets = {
  operational: string
  captures: string
  conversations: string
}

type ReadinessItem = {
  label: string
  done: boolean
  hint: string
}

type WebFormBuilderState = Pick<ChannelFormState,
  'publicEmbedEnabled'
  | 'iframeHeight'
  | 'allowedDomains'
  | 'accentColor'
  | 'pageBackgroundColor'
  | 'backgroundColor'
  | 'fontFamily'
  | 'formTitle'
  | 'formDescription'
  | 'submitCtaLabel'
  | 'formSuccessMessage'
  | 'formCardRadius'
  | 'formInputRadius'
  | 'formFieldSpacing'
  | 'formPadding'
  | 'formFontSize'
  | 'formLabelColor'
  | 'formInputTextColor'
  | 'formInputBackgroundColor'
  | 'formInputBorderColor'
  | 'formCtaColor'
  | 'formCtaTextColor'
  | 'showNameField'
  | 'showEmailField'
  | 'showPhoneField'
  | 'showCompanyField'
  | 'showCityField'
  | 'showProductField'
  | 'showMessageField'
  | 'nameLabel'
  | 'namePlaceholder'
  | 'emailLabel'
  | 'emailPlaceholder'
  | 'phoneLabel'
  | 'phonePlaceholder'
  | 'companyLabel'
  | 'companyPlaceholder'
  | 'cityLabel'
  | 'cityPlaceholder'
  | 'productLabel'
  | 'productPlaceholder'
  | 'messageLabel'
  | 'messagePlaceholder'
>

type ChatbotBuilderState = Pick<ChannelFormState,
  'chatbotTitle'
  | 'chatbotPrompt'
  | 'assistantName'
  | 'publicEmbedEnabled'
  | 'iframeHeight'
  | 'allowedDomains'
  | 'accentColor'
  | 'pageBackgroundColor'
  | 'backgroundColor'
  | 'fontFamily'
  | 'floatingLauncherEnabled'
  | 'launcherLabel'
  | 'launcherIcon'
  | 'launcherPosition'
  | 'launcherSize'
  | 'headerBadgeLabel'
  | 'statusBadgeLabel'
  | 'chatShellRadius'
  | 'messageBubbleRadius'
  | 'panelShadowPreset'
  | 'showProductField'
  | 'productLabel'
  | 'productPlaceholder'
  | 'messageLabel'
  | 'messagePlaceholder'
  | 'quickActions'
  | 'flowStages'
>

type ChatbotFlowStageId = ChannelFormState['flowStages'][number]['id']

function getInitialChannelForm() {
  return {
    templateKey: 'web-form',
    name: 'Formulario Web Principal',
    provider: 'WEB_FORM' as CrmChannelProvider,
    status: 'TESTING' as ChannelStatus,
    testingToken: makeDemoToken(),
    bridgeKind: 'GENERIC' as CrmBridgeKind,
    externalAccountId: '',
    externalPageId: '',
    externalPhoneNumberId: '',
    whatsappAccessToken: '',
    whatsappApiVersion: 'v23.0',
    formSelector: '#lead-form',
    chatbotTitle: 'Asesor virtual SGDigital',
    chatbotPrompt: 'Cuéntanos tu proyecto y te contactamos.',
    assistantName: 'Asesor virtual SGDigital',
    publicEmbedEnabled: true,
    iframeHeight: '720',
    allowedDomains: '',
    accentColor: '#1d4ed8',
    pageBackgroundColor: '#eef5ff',
    backgroundColor: '#ffffff',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    floatingLauncherEnabled: true,
    launcherLabel: 'Abrir asesor virtual',
    launcherIcon: 'bot',
    launcherPosition: 'right' as LauncherPosition,
    launcherSize: 'standard' as LauncherSize,
    headerBadgeLabel: 'Chatbot CRM',
    statusBadgeLabel: 'En linea',
    chatShellRadius: '30',
    messageBubbleRadius: '22',
    panelShadowPreset: 'medium' as PanelShadowPreset,
    formTitle: 'Solicita tu cotización',
    formDescription: 'Completa el formulario y nuestro equipo comercial te contactará.',
    submitCtaLabel: 'Enviar solicitud',
    formSuccessMessage: 'Gracias. Ya recibimos tu solicitud y la estamos enviando al CRM.',
    formCardRadius: '28',
    formInputRadius: '16',
    formFieldSpacing: '14',
    formPadding: '24',
    formFontSize: '14',
    formLabelColor: '#0f172a',
    formInputTextColor: '#0f172a',
    formInputBackgroundColor: '#ffffff',
    formInputBorderColor: '#cbd5e1',
    formCtaColor: '#1d4ed8',
    formCtaTextColor: '#ffffff',
    showNameField: true,
    showEmailField: true,
    showPhoneField: true,
    showCompanyField: false,
    showCityField: false,
    showProductField: true,
    quickActions: getDefaultChatbotQuickActions(),
    flowStages: getDefaultChatbotFlowStages(),
    showMessageField: true,
    nameLabel: 'Nombre',
    namePlaceholder: 'Tu nombre',
    emailLabel: 'Correo',
    emailPlaceholder: 'tu@correo.com',
    phoneLabel: 'Teléfono o WhatsApp',
    phonePlaceholder: '300 000 0000',
    companyLabel: 'Empresa',
    companyPlaceholder: 'Nombre de la empresa',
    cityLabel: 'Ciudad',
    cityPlaceholder: 'Ciudad o sede',
    productLabel: 'Producto',
    productPlaceholder: '¿Qué producto necesitas?',
    messageLabel: 'Mensaje',
    messagePlaceholder: 'Cuéntanos qué necesitas y para cuándo.',
  }
}

type ChannelFormState = ReturnType<typeof getInitialChannelForm>

const CHANNEL_STATUS_OPTIONS: ChannelStatus[] = ['DRAFT', 'TESTING', 'ACTIVE', 'DISABLED', 'ERROR']

const TEMPLATE_PRESETS: TemplatePreset[] = [
  { key: 'web-form', name: 'Formulario Web', provider: 'WEB_FORM', description: 'Captura leads desde un iframe profesional o desde formularios existentes en landings.', connectionModel: 'Iframe + script', readiness: 'Operativo hoy', focus: 'Captura de formularios y campañas' },
  { key: 'web-chatbot', name: 'Chatbot Web', provider: 'WEB_CHATBOT', description: 'Chat embebible por iframe con hilo en tiempo real dentro del CRM.', connectionModel: 'Iframe publico', readiness: 'Operativo hoy', focus: 'Conversación, handoff y lead capture' },
  { key: 'whatsapp-cloud', name: 'WhatsApp Cloud', provider: 'WHATSAPP_CLOUD', description: 'Webhook listo para pruebas y conexión oficial.', connectionModel: 'Webhook nativo', readiness: 'Demo avanzada', focus: 'Inbox y mensajes inbound' },
  { key: 'facebook-page', name: 'Facebook / Messenger', provider: 'FACEBOOK_PAGE', description: 'Inbox social vía webhook para mensajes de páginas Meta.', connectionModel: 'Webhook nativo', readiness: 'Demo avanzada', focus: 'Social inbox y conversaciones' },
  { key: 'instagram-dm', name: 'Instagram DM', provider: 'INSTAGRAM_DM', description: 'Captura mensajes de Instagram y llévalos al inbox del CRM.', connectionModel: 'Webhook nativo', readiness: 'Demo avanzada', focus: 'DMs y campañas de performance' },
  { key: 'gmail-bridge', name: 'Gmail Inbox Bridge', provider: 'WEB_FORM', bridgeKind: 'GMAIL', description: 'Apps Script para empujar correos comerciales al inbox omnicanal.', connectionModel: 'Bridge Apps Script', readiness: 'Operativo hoy', focus: 'Correos de prospectos a CRM' },
  { key: 'outlook-bridge', name: 'Outlook Inbox Bridge', provider: 'WEB_FORM', bridgeKind: 'OUTLOOK', description: 'Bridge operativo para Power Automate y Microsoft 365.', connectionModel: 'Bridge Power Automate', readiness: 'Operativo hoy', focus: 'Inbox comercial de Microsoft' },
  { key: 'tiktok-bridge', name: 'TikTok Lead Bridge', provider: 'WEB_FORM', bridgeKind: 'TIKTOK', description: 'Usa Make/Zapier o webhook para llevar leads al CRM.', connectionModel: 'Bridge automation', readiness: 'Demo guiada', focus: 'Lead Ads y formularios externos' },
  { key: 'youtube-bridge', name: 'YouTube Lead Bridge', provider: 'WEB_FORM', bridgeKind: 'YOUTUBE', description: 'Bridge para formularios, comentarios o capturas desde campañas.', connectionModel: 'Bridge automation', readiness: 'Demo guiada', focus: 'Captura desde video y campañas' },
]

const MANAGED_CHANNEL_SETTING_KEYS = new Set([
  'testingToken',
  'bridgeKind',
  'whatsappAccessToken',
  'whatsappApiVersion',
  'formSelector',
  'chatbotTitle',
  'chatbotPrompt',
  'assistantName',
  'publicEmbedEnabled',
  'iframeHeight',
  'allowedDomains',
  'accentColor',
  'pageBackgroundColor',
  'backgroundColor',
  'fontFamily',
  'floatingLauncherEnabled',
  'launcherLabel',
  'launcherIcon',
  'launcherPosition',
  'launcherSize',
  'headerBadgeLabel',
  'statusBadgeLabel',
  'chatShellRadius',
  'messageBubbleRadius',
  'panelShadowPreset',
  'chatbotCustomCss',
  'formTitle',
  'formDescription',
  'submitCtaLabel',
  'formSuccessMessage',
  'formCardRadius',
  'formInputRadius',
  'formFieldSpacing',
  'formPadding',
  'formFontSize',
  'formLabelColor',
  'formInputTextColor',
  'formInputBackgroundColor',
  'formInputBorderColor',
  'formCtaColor',
  'formCtaTextColor',
  'showNameField',
  'showEmailField',
  'showPhoneField',
  'showCompanyField',
  'showCityField',
  'showProductField',
  'showMessageField',
  'nameLabel',
  'namePlaceholder',
  'emailLabel',
  'emailPlaceholder',
  'phoneLabel',
  'phonePlaceholder',
  'companyLabel',
  'companyPlaceholder',
  'cityLabel',
  'cityPlaceholder',
  'productLabel',
  'productPlaceholder',
  'messageLabel',
  'messagePlaceholder',
  'quickActions',
  'flowStages',
  'allowHumanHandoff',
])

function requestJson<T>(url: string, init?: RequestInit): Promise<JsonResponse<T>> {
  return fetch(url, init).then((res) => res.json().catch(() => ({}))) as Promise<JsonResponse<T>>
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('es-CO', {
    notation: 'compact',
    maximumFractionDigits: value >= 100 ? 0 : 1,
  }).format(value)
}

function getProviderChartColor(provider: CrmChannelProvider) {
  switch (provider) {
    case 'WEB_FORM':
      return '#0ea5e9'
    case 'WEB_CHATBOT':
      return '#10b981'
    case 'WHATSAPP_CLOUD':
    case 'WHATSAPP_SANDBOX':
      return '#22c55e'
    case 'FACEBOOK_PAGE':
    case 'MESSENGER':
      return '#2563eb'
    case 'INSTAGRAM_DM':
      return '#f97316'
    default:
      return '#64748b'
  }
}

function getTemplatePresetIcon(preset: TemplatePreset): LucideIcon {
  if (preset.provider === 'WHATSAPP_CLOUD' || preset.provider === 'WHATSAPP_SANDBOX') return MessageCircle
  if (preset.provider === 'INSTAGRAM_DM') return Instagram
  if (preset.provider === 'FACEBOOK_PAGE' || preset.provider === 'MESSENGER') return Facebook
  if (preset.provider === 'WEB_CHATBOT') return Bot
  if (preset.bridgeKind === 'GMAIL' || preset.bridgeKind === 'OUTLOOK') return Mail
  return Globe
}

function getTemplatePresetSurface(preset: TemplatePreset) {
  if (preset.provider === 'WHATSAPP_CLOUD' || preset.provider === 'WHATSAPP_SANDBOX') {
    return {
      card: 'border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.92),rgba(255,255,255,0.98))]',
      selected: 'border-emerald-300 bg-emerald-50/90 ring-2 ring-emerald-200',
      iconWrap: 'border-emerald-200 bg-emerald-100 text-emerald-700',
      pill: 'bg-emerald-100 text-emerald-700',
      accent: 'text-emerald-800',
    }
  }

  if (preset.provider === 'INSTAGRAM_DM') {
    return {
      card: 'border-fuchsia-200 bg-[linear-gradient(180deg,rgba(253,244,255,0.92),rgba(255,255,255,0.98))]',
      selected: 'border-fuchsia-300 bg-fuchsia-50/90 ring-2 ring-fuchsia-200',
      iconWrap: 'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700',
      pill: 'bg-fuchsia-100 text-fuchsia-700',
      accent: 'text-fuchsia-800',
    }
  }

  if (preset.provider === 'FACEBOOK_PAGE' || preset.provider === 'MESSENGER') {
    return {
      card: 'border-blue-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.92),rgba(255,255,255,0.98))]',
      selected: 'border-blue-300 bg-blue-50/90 ring-2 ring-blue-200',
      iconWrap: 'border-blue-200 bg-blue-100 text-blue-700',
      pill: 'bg-blue-100 text-blue-700',
      accent: 'text-blue-800',
    }
  }

  if (preset.provider === 'WEB_CHATBOT') {
    return {
      card: 'border-violet-200 bg-[linear-gradient(180deg,rgba(245,243,255,0.92),rgba(255,255,255,0.98))]',
      selected: 'border-violet-300 bg-violet-50/90 ring-2 ring-violet-200',
      iconWrap: 'border-violet-200 bg-violet-100 text-violet-700',
      pill: 'bg-violet-100 text-violet-700',
      accent: 'text-violet-800',
    }
  }

  if (preset.bridgeKind === 'GMAIL' || preset.bridgeKind === 'OUTLOOK') {
    return {
      card: 'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.92),rgba(255,255,255,0.98))]',
      selected: 'border-amber-300 bg-amber-50/90 ring-2 ring-amber-200',
      iconWrap: 'border-amber-200 bg-amber-100 text-amber-700',
      pill: 'bg-amber-100 text-amber-700',
      accent: 'text-amber-800',
    }
  }

  return {
    card: 'border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,0.92),rgba(255,255,255,0.98))]',
    selected: 'border-sky-300 bg-sky-50/90 ring-2 ring-sky-200',
    iconWrap: 'border-sky-200 bg-sky-100 text-sky-700',
    pill: 'bg-sky-100 text-sky-700',
    accent: 'text-sky-800',
  }
}

function getTokenFromSettings(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.testingToken === 'string' ? settingsJson.testingToken : ''
}

function getBridgeKind(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.bridgeKind === 'string' ? settingsJson.bridgeKind : ''
}

function getFormSelector(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.formSelector === 'string' ? settingsJson.formSelector : '#lead-form'
}

function getWhatsAppAccessToken(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.whatsappAccessToken === 'string' ? settingsJson.whatsappAccessToken : ''
}

function getWhatsAppApiVersion(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.whatsappApiVersion === 'string' ? settingsJson.whatsappApiVersion : 'v23.0'
}

function getChatbotTitle(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.chatbotTitle === 'string' ? settingsJson.chatbotTitle : 'Asesor virtual SGDigital'
}

function getChatbotPrompt(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.chatbotPrompt === 'string' ? settingsJson.chatbotPrompt : 'Cuéntanos tu proyecto y te contactamos.'
}

function getAssistantName(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.assistantName === 'string' ? settingsJson.assistantName : 'Asesor virtual SGDigital'
}

function getIframeHeight(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.iframeHeight === 'string' ? settingsJson.iframeHeight : '720'
}

function getAccentColor(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.accentColor === 'string' ? settingsJson.accentColor : '#1d4ed8'
}

function getAllowedDomains(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.allowedDomains === 'string' ? settingsJson.allowedDomains : ''
}

function getBackgroundColor(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.backgroundColor === 'string' ? settingsJson.backgroundColor : '#f8fbff'
}

function getPageBackgroundColor(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.pageBackgroundColor === 'string' ? settingsJson.pageBackgroundColor : '#eef5ff'
}

function getFontFamily(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.fontFamily === 'string' ? settingsJson.fontFamily : 'ui-sans-serif, system-ui, sans-serif'
}

function getFloatingLauncherEnabled(settingsJson: Record<string, unknown> | null | undefined) {
  return settingsJson?.floatingLauncherEnabled !== false
}

function getLauncherLabel(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.launcherLabel === 'string' ? settingsJson.launcherLabel : 'Abrir asesor virtual'
}

function getLauncherIcon(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.launcherIcon === 'string' ? settingsJson.launcherIcon : 'bot'
}

function getLauncherPosition(settingsJson: Record<string, unknown> | null | undefined): LauncherPosition {
  return settingsJson?.launcherPosition === 'left' ? 'left' : 'right'
}

function getLauncherSize(settingsJson: Record<string, unknown> | null | undefined): LauncherSize {
  if (settingsJson?.launcherSize === 'compact') return 'compact'
  if (settingsJson?.launcherSize === 'large') return 'large'
  return 'standard'
}

function getHeaderBadgeLabel(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.headerBadgeLabel === 'string' && settingsJson.headerBadgeLabel.trim() ? settingsJson.headerBadgeLabel : 'Chatbot CRM'
}

function getStatusBadgeLabel(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.statusBadgeLabel === 'string' && settingsJson.statusBadgeLabel.trim() ? settingsJson.statusBadgeLabel : 'En linea'
}

function getChatShellRadius(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.chatShellRadius === 'string' && settingsJson.chatShellRadius.trim() ? settingsJson.chatShellRadius : '30'
}

function getMessageBubbleRadius(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.messageBubbleRadius === 'string' && settingsJson.messageBubbleRadius.trim() ? settingsJson.messageBubbleRadius : '22'
}

function getPanelShadowPreset(settingsJson: Record<string, unknown> | null | undefined): PanelShadowPreset {
  if (settingsJson?.panelShadowPreset === 'soft') return 'soft'
  if (settingsJson?.panelShadowPreset === 'strong') return 'strong'
  return 'medium'
}

function getChatbotCustomCss(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.chatbotCustomCss === 'string' ? settingsJson.chatbotCustomCss : ''
}

function getShowProductField(settingsJson: Record<string, unknown> | null | undefined) {
  return settingsJson?.showProductField !== false
}

function getBooleanSetting(settingsJson: Record<string, unknown> | null | undefined, key: string, fallback = false) {
  return typeof settingsJson?.[key] === 'boolean' ? settingsJson[key] as boolean : fallback
}

function getSettingText(settingsJson: Record<string, unknown> | null | undefined, key: string, fallback: string) {
  return typeof settingsJson?.[key] === 'string' ? settingsJson[key] as string : fallback
}

function getLauncherPreviewIcon(icon: string) {
  if (icon === 'sparkles') return '✦'
  if (icon === 'message-circle') return '◔'
  if (icon === 'bot') return '🤖'
  return '◔'
}

function getPublicEmbedEnabled(settingsJson: Record<string, unknown> | null | undefined) {
  return settingsJson?.publicEmbedEnabled !== false
}

function normalizePixelValue(rawValue: string, fallback: string) {
  const digits = rawValue.replace(/[^0-9]/g, '')
  return digits || fallback
}

function renderWebFormPreview(builderState: WebFormBuilderState, options?: {
  maxWidthClassName?: string
  outerPaddingClassName?: string
  titleClassName?: string
  messageMinHeight?: number
}) {
  const maxWidthClassName = options?.maxWidthClassName ?? 'max-w-3xl'
  const outerPaddingClassName = options?.outerPaddingClassName ?? 'p-5'
  const titleClassName = options?.titleClassName ?? 'text-xl'
  const messageMinHeight = options?.messageMinHeight ?? 120

  return (
    <div className="overflow-hidden rounded-[24px] border border-sky-200 shadow-sm" style={{ background: `radial-gradient(circle at top, rgba(14,165,233,.16), transparent 34%), linear-gradient(180deg, ${builderState.pageBackgroundColor} 0%, ${builderState.backgroundColor} 100%)` }}>
      <div className={`mx-auto ${maxWidthClassName} ${outerPaddingClassName}`} style={{ fontFamily: builderState.fontFamily }}>
        <div className="border border-slate-200 bg-white shadow-[0_28px_70px_-34px_rgba(15,23,42,.32)]" style={{ borderRadius: `${normalizePixelValue(builderState.formCardRadius, '28')}px`, padding: `${normalizePixelValue(builderState.formPadding, '24')}px`, backgroundColor: builderState.backgroundColor }}>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: builderState.accentColor, boxShadow: `0 0 0 6px ${builderState.accentColor}22` }} />
            <div>
              <p className={`${titleClassName} font-semibold text-slate-950`}>{builderState.formTitle}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{builderState.formDescription}</p>
            </div>
          </div>
          <div className="mt-5 grid" style={{ gap: `${normalizePixelValue(builderState.formFieldSpacing, '14')}px`, fontSize: `${normalizePixelValue(builderState.formFontSize, '14')}px` }}>
            {builderState.showNameField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: builderState.formLabelColor }}>{builderState.nameLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(builderState.formInputRadius, '16')}px`, border: `1px solid ${builderState.formInputBorderColor}`, backgroundColor: builderState.formInputBackgroundColor, color: builderState.formInputTextColor }}>{builderState.namePlaceholder}</div></div> : null}
            <div className="grid gap-3 md:grid-cols-2">
              {builderState.showEmailField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: builderState.formLabelColor }}>{builderState.emailLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(builderState.formInputRadius, '16')}px`, border: `1px solid ${builderState.formInputBorderColor}`, backgroundColor: builderState.formInputBackgroundColor, color: builderState.formInputTextColor }}>{builderState.emailPlaceholder}</div></div> : null}
              {builderState.showPhoneField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: builderState.formLabelColor }}>{builderState.phoneLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(builderState.formInputRadius, '16')}px`, border: `1px solid ${builderState.formInputBorderColor}`, backgroundColor: builderState.formInputBackgroundColor, color: builderState.formInputTextColor }}>{builderState.phonePlaceholder}</div></div> : null}
            </div>
            {(builderState.showCompanyField || builderState.showCityField) ? <div className="grid gap-3 md:grid-cols-2">{builderState.showCompanyField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: builderState.formLabelColor }}>{builderState.companyLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(builderState.formInputRadius, '16')}px`, border: `1px solid ${builderState.formInputBorderColor}`, backgroundColor: builderState.formInputBackgroundColor, color: builderState.formInputTextColor }}>{builderState.companyPlaceholder}</div></div> : null}{builderState.showCityField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: builderState.formLabelColor }}>{builderState.cityLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(builderState.formInputRadius, '16')}px`, border: `1px solid ${builderState.formInputBorderColor}`, backgroundColor: builderState.formInputBackgroundColor, color: builderState.formInputTextColor }}>{builderState.cityPlaceholder}</div></div> : null}</div> : null}
            {builderState.showProductField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: builderState.formLabelColor }}>{builderState.productLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(builderState.formInputRadius, '16')}px`, border: `1px solid ${builderState.formInputBorderColor}`, backgroundColor: builderState.formInputBackgroundColor, color: builderState.formInputTextColor }}>{builderState.productPlaceholder}</div></div> : null}
            {builderState.showMessageField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: builderState.formLabelColor }}>{builderState.messageLabel}</p><div className="px-4 py-3" style={{ minHeight: messageMinHeight, borderRadius: `${normalizePixelValue(builderState.formInputRadius, '16')}px`, border: `1px solid ${builderState.formInputBorderColor}`, backgroundColor: builderState.formInputBackgroundColor, color: builderState.formInputTextColor }}>{builderState.messagePlaceholder}</div></div> : null}
            <div className="px-4 py-3 text-center text-sm font-semibold" style={{ borderRadius: `${normalizePixelValue(builderState.formInputRadius, '16')}px`, background: `linear-gradient(135deg, ${builderState.formCtaColor}, ${builderState.accentColor})`, color: builderState.formCtaTextColor }}>{builderState.submitCtaLabel}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function renderChatbotPreview(builderState: ChatbotBuilderState, options?: {
  mode?: ChatbotPreviewMode
  viewport?: ChatbotPreviewViewport
  minHeight?: number
}) {
  const mode = options?.mode ?? 'expanded'
  const viewport = options?.viewport ?? 'desktop'
  const minHeight = options?.minHeight ?? (viewport === 'mobile' ? 500 : 420)
  const launcherMetrics = getLauncherPreviewMetrics(builderState.launcherSize)
  const panelShadow = getPanelShadowValue(builderState.panelShadowPreset)
  const previewOffset = 60
  const welcomeStage = builderState.flowStages.find((item) => item.id === 'welcome') ?? builderState.flowStages[0] ?? null
  const catalogStage = builderState.flowStages.find((item) => item.id === 'catalog') ?? builderState.flowStages[1] ?? welcomeStage
  const welcomeActions = builderState.quickActions.filter((item) => welcomeStage?.quickActionIds.includes(item.id) && item.enabled)
  const welcomeResponses = welcomeStage?.responseOptions ?? []

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-emerald-200 p-3 shadow-sm" style={{ background: `radial-gradient(circle at top, rgba(16,185,129,0.12), transparent 30%), linear-gradient(180deg, ${builderState.pageBackgroundColor} 0%, ${builderState.pageBackgroundColor} 55%, ${builderState.backgroundColor} 100%)`, minHeight }}>
      <div className="flex h-full px-3 pb-20 pt-4" style={{ justifyContent: builderState.launcherPosition === 'left' ? 'flex-start' : 'flex-end' }}>
        <div className="relative flex min-h-full w-full items-end" style={{ maxWidth: viewport === 'mobile' ? 340 : 420, fontFamily: builderState.fontFamily }}>
          {mode === 'expanded' ? (
            <div className="overflow-hidden border border-slate-200 bg-white" style={{ marginTop: 24, marginLeft: builderState.launcherPosition === 'left' ? 0 : 'auto', marginRight: builderState.launcherPosition === 'left' ? 'auto' : 0, borderRadius: `${normalizePixelValue(builderState.chatShellRadius, '30')}px`, boxShadow: panelShadow }}>
              <div className="px-4 py-4 text-white" style={{ background: `linear-gradient(135deg, #0f172a, ${builderState.accentColor})` }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100">{builderState.headerBadgeLabel}</p>
                    <p className="mt-1 text-base font-semibold">{builderState.chatbotTitle}</p>
                  </div>
                  <div className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">{builderState.statusBadgeLabel}</div>
                </div>
              </div>
              <div className="space-y-3 px-4 py-4" style={{ backgroundColor: builderState.backgroundColor }}>
                {welcomeStage ? (
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Etapa activa</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{welcomeStage.title}</p>
                      </div>
                      <div className={`rounded-full bg-gradient-to-r ${getFlowStageAccent(welcomeStage.id)} px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white`}>{getFlowStageNextFieldLabel(welcomeStage.nextField)}</div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{welcomeStage.description}</p>
                  </div>
                ) : null}
                <div className="max-w-[84%] border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-700 shadow-sm" style={{ borderRadius: `${normalizePixelValue(builderState.messageBubbleRadius, '22')}px` }}>{welcomeStage?.prompt || builderState.chatbotPrompt}</div>
                {welcomeResponses.length ? (
                  <div className="flex max-w-[92%] flex-wrap gap-2">
                    {welcomeResponses.map((option) => (
                      <div key={option.id} className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-semibold text-violet-900 shadow-sm">
                        <div>{option.label}</div>
                        <div className="mt-0.5 text-[10px] font-medium opacity-75">Salta a {builderState.flowStages.find((stage) => stage.id === option.targetStageId)?.title || option.targetStageId}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {builderState.showProductField ? <div className="max-w-[84%] border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-700 shadow-sm" style={{ borderRadius: `${normalizePixelValue(builderState.messageBubbleRadius, '22')}px` }}>También puedo tomar producto y contexto inicial para enrutar mejor el lead.</div> : null}
                <div className="ml-auto max-w-[78%] px-4 py-3 text-xs leading-5 text-white shadow-sm" style={{ backgroundColor: builderState.accentColor, borderRadius: `${normalizePixelValue(builderState.messageBubbleRadius, '22')}px` }}>Hola, necesito ayuda para una nueva cotización.</div>
                <div className="max-w-[84%] border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-700 shadow-sm" style={{ borderRadius: `${normalizePixelValue(builderState.messageBubbleRadius, '22')}px` }}>{catalogStage?.prompt || `Perfecto. Soy ${builderState.assistantName} y te ayudo a capturar lo necesario.`}</div>
              </div>
              <div className="border-t border-slate-100 bg-white px-4 py-4">
                <div className="grid gap-2">
                  {welcomeActions.length ? (
                    <div className="flex flex-wrap gap-2">
                      {welcomeActions.map((action) => (
                        <div key={action.id} className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold shadow-sm ${getQuickActionTone(action.kind)}`}>
                          <div>{action.label}</div>
                          <div className="mt-0.5 text-[10px] font-medium opacity-80">{action.kind === 'catalog' ? 'Explora catálogo' : action.kind === 'stock' ? 'Consulta inventario' : action.kind === 'human' ? 'Escala al equipo' : 'Acción rápida'}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {builderState.showProductField ? <div className="rounded-2xl border border-slate-200 px-3 py-2 text-xs text-slate-400">{builderState.productLabel}: {builderState.productPlaceholder}</div> : null}
                  <div className="rounded-2xl border border-slate-200 px-3 py-3 text-xs text-slate-400">{builderState.messageLabel}: {builderState.messagePlaceholder}</div>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold text-white" style={{ backgroundColor: builderState.accentColor }}>Responder</div>
                    <div className="rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600">Asesor humano</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {builderState.floatingLauncherEnabled ? (
            <div className="absolute z-10" style={{ bottom: previewOffset, left: builderState.launcherPosition === 'left' ? previewOffset : undefined, right: builderState.launcherPosition === 'right' ? previewOffset : undefined, maxWidth: `calc(100% - ${previewOffset * 2}px)` }}>
              <div className="flex max-w-full items-center justify-center whitespace-nowrap text-white shadow-[0_18px_44px_-26px_rgba(15,23,42,0.55)]" style={{ backgroundColor: builderState.accentColor, borderRadius: launcherMetrics.buttonRadius, padding: launcherMetrics.buttonPadding, height: launcherMetrics.buttonHeight, gap: mode === 'compact' ? '0' : launcherMetrics.buttonGap, minWidth: mode === 'compact' ? launcherMetrics.buttonHeight : undefined, fontSize: launcherMetrics.fontSize, fontWeight: 700 }}>
                <span style={{ fontSize: launcherMetrics.iconSize, lineHeight: 1 }}>{getLauncherPreviewIcon(builderState.launcherIcon)}</span>
                {mode !== 'compact' && launcherMetrics.labelVisible ? <span>{builderState.launcherLabel}</span> : null}
              </div>
            </div>
          ) : <div className="absolute bottom-0 rounded-full border border-dashed border-slate-300 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-500">Launcher flotante desactivado</div>}
        </div>
      </div>
    </div>
  )
}

function getPanelShadowValue(preset: PanelShadowPreset) {
  if (preset === 'soft') return '0 18px 44px -30px rgba(15,23,42,0.26)'
  if (preset === 'strong') return '0 34px 90px -36px rgba(15,23,42,0.46)'
  return '0 24px 60px -36px rgba(15,23,42,0.36)'
}

function buildFriendlyChatbotCustomCss(args: {
  chatShellRadius: string
  messageBubbleRadius: string
  panelShadowPreset: PanelShadowPreset
}) {
  const shellRadius = normalizePixelValue(args.chatShellRadius, '30')
  const bubbleRadius = normalizePixelValue(args.messageBubbleRadius, '22')
  const panelShadow = getPanelShadowValue(args.panelShadowPreset)

  return [
    `.sgd-chatbot-shell{border-radius:${shellRadius}px;box-shadow:${panelShadow};}`,
    `.sgd-preview-panel{border-radius:${shellRadius}px;box-shadow:${panelShadow};}`,
    `.sgd-chatbot-bubble-assistant,.sgd-chatbot-bubble-user,.sgd-chatbot-bubble-system{border-radius:${bubbleRadius}px;}`,
  ].join('\n')
}

function getLauncherPreviewMetrics(size: LauncherSize) {
  if (size === 'compact') {
    return {
      buttonPadding: '0 16px',
      buttonHeight: '56px',
      buttonRadius: '999px',
      buttonGap: '0',
      iconSize: '20px',
      labelVisible: false,
      fontSize: '14px',
    }
  }

  if (size === 'large') {
    return {
      buttonPadding: '0 24px',
      buttonHeight: '66px',
      buttonRadius: '999px',
      buttonGap: '12px',
      iconSize: '22px',
      labelVisible: true,
      fontSize: '15px',
    }
  }

  return {
    buttonPadding: '0 20px',
    buttonHeight: '60px',
    buttonRadius: '999px',
    buttonGap: '10px',
    iconSize: '20px',
    labelVisible: true,
    fontSize: '14px',
  }
}

function getEndpoint(baseUrl: string, channel: ChannelConnection | null) {
  if (!channel) return ''
  if (channel.provider === 'WEB_FORM') {
    const settings = (channel.settingsJson as Record<string, unknown> | null | undefined) ?? null
    const bridgeKind = getBridgeKind(settings)
    return bridgeKind && bridgeKind !== 'GENERIC' ? `${baseUrl}/api/crm/captures/bridge` : `${baseUrl}/api/crm/captures/web-form`
  }
  if (channel.provider === 'WEB_CHATBOT') return `${baseUrl}/api/crm/captures/chatbot`
  if (usesMetaProvider(channel.provider)) return `${baseUrl}/api/webhooks/meta`
  return `${baseUrl}/api/crm/channels/${channel.id}/webhook`
}

function channelTone(provider: CrmChannelProvider, bridgeKind: string) {
  if (provider === 'WEB_CHATBOT') return 'border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,.92),rgba(255,255,255,.98))]'
  if (provider === 'WEB_FORM' && (bridgeKind === 'GMAIL' || bridgeKind === 'OUTLOOK')) return 'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,.95),rgba(255,255,255,.98))]'
  if (provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX') return 'border-emerald-200 bg-[linear-gradient(180deg,rgba(220,252,231,.95),rgba(255,255,255,.98))]'
  return 'border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,.96),rgba(255,255,255,.98))]'
}

function providerSummary(provider: CrmChannelProvider, bridgeKind: CrmBridgeKind) {
  if (provider === 'WEB_CHATBOT') return 'Canal conversacional embebible por iframe con captura en tiempo real.'
  if (provider === 'WEB_FORM' && bridgeKind === 'GENERIC') return 'Canal de captura vía formularios y landings con tracking comercial.'
  if (provider === 'WEB_FORM') return 'Bridge operativo para automatizaciones externas y fuentes no nativas.'
  return 'Canal omnicanal basado en webhook para inbox y mensajería inbound.'
}

function usesMetaProvider(provider: CrmChannelProvider) {
  return provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX' || provider === 'FACEBOOK_PAGE' || provider === 'MESSENGER' || provider === 'INSTAGRAM_DM'
}

function getMetaConnectionState(settingsJson: Record<string, unknown> | null | undefined) {
  return {
    connectedUserName: typeof settingsJson?.metaConnectedUserName === 'string' ? settingsJson.metaConnectedUserName : '',
    connectedAt: typeof settingsJson?.metaConnectedAt === 'string' ? settingsJson.metaConnectedAt : '',
    lastSyncAt: typeof settingsJson?.metaLastSyncAt === 'string' ? settingsJson.metaLastSyncAt : '',
    tokenExpiresAt: typeof settingsJson?.metaTokenExpiresAt === 'string' ? settingsJson.metaTokenExpiresAt : '',
    selectedPageId: typeof settingsJson?.metaSelectedPageId === 'string' ? settingsJson.metaSelectedPageId : '',
    selectedInstagramAccountId: typeof settingsJson?.metaSelectedInstagramAccountId === 'string' ? settingsJson.metaSelectedInstagramAccountId : '',
    selectedPhoneNumberId: typeof settingsJson?.metaSelectedPhoneNumberId === 'string' ? settingsJson.metaSelectedPhoneNumberId : '',
    pages: Array.isArray(settingsJson?.metaPages) ? settingsJson.metaPages as MetaPageAsset[] : [],
    whatsappAssets: Array.isArray(settingsJson?.metaWhatsAppAssets) ? settingsJson.metaWhatsAppAssets as MetaWhatsAppAsset[] : [],
    hasConnection: Boolean(settingsJson?.metaAccessTokenEncrypted || settingsJson?.metaConnectedAt),
  }
}

function getChannelReadiness(channel: ChannelConnection, baseUrl: string) {
  const settings = (channel.settingsJson as Record<string, unknown> | null | undefined) ?? null
  const token = getTokenFromSettings(settings)
  const bridgeKind = getBridgeKind(settings)
  const isChatbot = channel.provider === 'WEB_CHATBOT'
  const isPublicWebForm = channel.provider === 'WEB_FORM' && bridgeKind === 'GENERIC'
  const isWebhook = channel.provider !== 'WEB_FORM' && channel.provider !== 'WEB_CHATBOT'
  const isMeta = usesMetaProvider(channel.provider)
  const publicEmbed = getPublicEmbedEnabled(settings)
  const allowedDomains = getAllowedDomains(settings)
  const hasExternalId = Boolean(channel.externalAccountId || channel.externalPageId || channel.externalPhoneNumberId)
  const hasMetaConnection = !isMeta || Boolean(settings?.metaAccessTokenEncrypted || settings?.metaConnectedAt)
  const hasWhatsAppCredentials = channel.provider !== 'WHATSAPP_CLOUD' && channel.provider !== 'WHATSAPP_SANDBOX'
    ? true
    : Boolean(getWhatsAppAccessToken(settings))

  const configured: ReadinessItem[] = [
    { label: 'Base configurada', done: Boolean(channel.name && channel.provider), hint: 'Nombre y proveedor definidos.' },
    { label: 'Token listo', done: Boolean(token || channel.verifyTokenPreview), hint: 'Token de pruebas o verificación disponible.' },
    { label: 'Ruta operativa', done: Boolean(getEndpoint(baseUrl, channel)), hint: 'Endpoint o webhook listo para usarse.' },
  ]

  const demo: ReadinessItem[] = [
    { label: 'Listo para demo', done: channel.status === 'TESTING' || channel.status === 'ACTIVE', hint: 'El canal debe estar en TESTING o ACTIVE.' },
    { label: 'Preview comercial', done: isChatbot ? Boolean(buildChatbotEmbedUrl(baseUrl, channel.id)) : isPublicWebForm ? Boolean(buildWebFormEmbedUrl(baseUrl, channel.id)) : true, hint: 'Debe existir forma visible de mostrar la integración.' },
    { label: 'Fuente de demo', done: !isWebhook || hasExternalId || bridgeKind !== 'GENERIC', hint: 'Webhook o IDs externos mínimos para una demo guiada.' },
  ]

  const production: ReadinessItem[] = [
    { label: 'Estado productivo', done: channel.status === 'ACTIVE', hint: 'Para producción el canal debe estar activo.' },
    { label: 'Dominio endurecido', done: (!isChatbot && !isPublicWebForm) || !publicEmbed || Boolean(allowedDomains.trim()), hint: 'Los embeds públicos deberían restringirse por dominios.' },
    { label: 'Conexión Meta', done: hasMetaConnection, hint: 'WhatsApp, Messenger e Instagram deben quedar enlazados por OAuth real.' },
    { label: 'Identificadores externos', done: !isWebhook || hasExternalId, hint: 'Meta o proveedor externo debe quedar identificado.' },
    { label: 'Credenciales proveedor', done: hasWhatsAppCredentials, hint: 'WhatsApp Cloud requiere access token para enviar desde el inbox.' },
  ]

  return { configured, demo, production }
}

function getWebFormBuilderState(settingsJson: Record<string, unknown> | null | undefined): WebFormBuilderState {
  return {
    publicEmbedEnabled: getPublicEmbedEnabled(settingsJson),
    iframeHeight: getIframeHeight(settingsJson),
    allowedDomains: getAllowedDomains(settingsJson),
    accentColor: getAccentColor(settingsJson),
    pageBackgroundColor: getPageBackgroundColor(settingsJson),
    backgroundColor: getBackgroundColor(settingsJson),
    fontFamily: getFontFamily(settingsJson),
    formTitle: getSettingText(settingsJson, 'formTitle', 'Solicita tu cotización'),
    formDescription: getSettingText(settingsJson, 'formDescription', 'Completa el formulario y nuestro equipo comercial te contactará.'),
    submitCtaLabel: getSettingText(settingsJson, 'submitCtaLabel', 'Enviar solicitud'),
    formSuccessMessage: getSettingText(settingsJson, 'formSuccessMessage', 'Gracias. Ya recibimos tu solicitud y la estamos enviando al CRM.'),
    formCardRadius: getSettingText(settingsJson, 'formCardRadius', '28'),
    formInputRadius: getSettingText(settingsJson, 'formInputRadius', '16'),
    formFieldSpacing: getSettingText(settingsJson, 'formFieldSpacing', '14'),
    formPadding: getSettingText(settingsJson, 'formPadding', '24'),
    formFontSize: getSettingText(settingsJson, 'formFontSize', '14'),
    formLabelColor: getSettingText(settingsJson, 'formLabelColor', '#0f172a'),
    formInputTextColor: getSettingText(settingsJson, 'formInputTextColor', '#0f172a'),
    formInputBackgroundColor: getSettingText(settingsJson, 'formInputBackgroundColor', '#ffffff'),
    formInputBorderColor: getSettingText(settingsJson, 'formInputBorderColor', '#cbd5e1'),
    formCtaColor: getSettingText(settingsJson, 'formCtaColor', getAccentColor(settingsJson)),
    formCtaTextColor: getSettingText(settingsJson, 'formCtaTextColor', '#ffffff'),
    showNameField: getBooleanSetting(settingsJson, 'showNameField', true),
    showEmailField: getBooleanSetting(settingsJson, 'showEmailField', true),
    showPhoneField: getBooleanSetting(settingsJson, 'showPhoneField', true),
    showCompanyField: getBooleanSetting(settingsJson, 'showCompanyField', false),
    showCityField: getBooleanSetting(settingsJson, 'showCityField', false),
    showProductField: getShowProductField(settingsJson),
    showMessageField: getBooleanSetting(settingsJson, 'showMessageField', true),
    nameLabel: getSettingText(settingsJson, 'nameLabel', 'Nombre'),
    namePlaceholder: getSettingText(settingsJson, 'namePlaceholder', 'Tu nombre'),
    emailLabel: getSettingText(settingsJson, 'emailLabel', 'Correo'),
    emailPlaceholder: getSettingText(settingsJson, 'emailPlaceholder', 'tu@correo.com'),
    phoneLabel: getSettingText(settingsJson, 'phoneLabel', 'Teléfono o WhatsApp'),
    phonePlaceholder: getSettingText(settingsJson, 'phonePlaceholder', '300 000 0000'),
    companyLabel: getSettingText(settingsJson, 'companyLabel', 'Empresa'),
    companyPlaceholder: getSettingText(settingsJson, 'companyPlaceholder', 'Nombre de la empresa'),
    cityLabel: getSettingText(settingsJson, 'cityLabel', 'Ciudad'),
    cityPlaceholder: getSettingText(settingsJson, 'cityPlaceholder', 'Ciudad o sede'),
    productLabel: getSettingText(settingsJson, 'productLabel', 'Producto'),
    productPlaceholder: getSettingText(settingsJson, 'productPlaceholder', '¿Qué producto necesitas?'),
    messageLabel: getSettingText(settingsJson, 'messageLabel', 'Mensaje'),
    messagePlaceholder: getSettingText(settingsJson, 'messagePlaceholder', 'Cuéntanos qué necesitas y para cuándo.'),
  }
}

function getChatbotBuilderState(settingsJson: Record<string, unknown> | null | undefined): ChatbotBuilderState {
  return {
    chatbotTitle: getChatbotTitle(settingsJson),
    chatbotPrompt: getChatbotPrompt(settingsJson),
    assistantName: getAssistantName(settingsJson),
    publicEmbedEnabled: getPublicEmbedEnabled(settingsJson),
    iframeHeight: getIframeHeight(settingsJson),
    allowedDomains: getAllowedDomains(settingsJson),
    accentColor: getAccentColor(settingsJson),
    pageBackgroundColor: getPageBackgroundColor(settingsJson),
    backgroundColor: getBackgroundColor(settingsJson),
    fontFamily: getFontFamily(settingsJson),
    floatingLauncherEnabled: getFloatingLauncherEnabled(settingsJson),
    launcherLabel: getLauncherLabel(settingsJson),
    launcherIcon: getLauncherIcon(settingsJson),
    launcherPosition: getLauncherPosition(settingsJson),
    launcherSize: getLauncherSize(settingsJson),
    headerBadgeLabel: getHeaderBadgeLabel(settingsJson),
    statusBadgeLabel: getStatusBadgeLabel(settingsJson),
    chatShellRadius: getChatShellRadius(settingsJson),
    messageBubbleRadius: getMessageBubbleRadius(settingsJson),
    panelShadowPreset: getPanelShadowPreset(settingsJson),
    showProductField: getShowProductField(settingsJson),
    productLabel: getSettingText(settingsJson, 'productLabel', 'Producto'),
    productPlaceholder: getSettingText(settingsJson, 'productPlaceholder', '¿Qué producto necesitas?'),
    messageLabel: getSettingText(settingsJson, 'messageLabel', 'Mensaje'),
    messagePlaceholder: getSettingText(settingsJson, 'messagePlaceholder', 'Cuéntanos qué necesitas y para cuándo.'),
    quickActions: normalizeChatbotQuickActions(settingsJson?.quickActions),
    flowStages: normalizeChatbotFlowStages(settingsJson?.flowStages),
  }
}

function getFlowStageAccent(stageId: string) {
  if (stageId === 'welcome') return 'from-sky-500 to-cyan-400'
  if (stageId === 'catalog') return 'from-emerald-500 to-lime-400'
  if (stageId === 'qualification') return 'from-amber-500 to-orange-400'
  return 'from-slate-700 to-slate-500'
}

function getFlowStageNextFieldLabel(nextField: ChatbotFlowNextField) {
  if (nextField === 'name') return 'Pide nombre'
  if (nextField === 'email') return 'Pide correo'
  if (nextField === 'phone') return 'Pide teléfono'
  if (nextField === 'product') return 'Pide producto'
  if (nextField === 'quantity') return 'Pide cantidad'
  return 'Cierre / handoff'
}

function getQuickActionTone(kind: ChatbotQuickAction['kind']) {
  if (kind === 'catalog') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (kind === 'stock') return 'border-sky-200 bg-sky-50 text-sky-800'
  if (kind === 'human') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

const PROTECTED_CHATBOT_STAGE_IDS = new Set(['welcome', 'catalog', 'qualification', 'handoff'])

function createChatbotStageId(stages: ChatbotFlowStage[]) {
  let index = stages.length + 1
  let candidate = `stage-${index}`
  while (stages.some((stage) => stage.id === candidate)) {
    index += 1
    candidate = `stage-${index}`
  }
  return candidate
}

function getResponseMatchModeLabel(mode: ChatbotFlowResponseMatchMode) {
  return mode === 'exact' ? 'Coincidencia exacta' : 'Coincidencia por palabras'
}

function buildChatbotCanvasModel(stages: ChatbotFlowStage[]) {
  const nodeWidth = 268
  const nodeHeight = 152
  const colGap = 110
  const rowGap = 72
  const padding = 24
  const nodes: ChatbotCanvasNode[] = stages.map((stage, index) => {
    const row = Math.floor(index / 2)
    const isRightColumn = index % 2 === 1
    const x = padding + (isRightColumn ? nodeWidth + colGap : 0)
    const y = padding + row * (nodeHeight + rowGap)
    return { stage, x, y, width: nodeWidth, height: nodeHeight }
  })

  const nodeMap = new Map(nodes.map((node) => [node.stage.id, node]))
  const connections: ChatbotCanvasConnection[] = []

  nodes.forEach((node) => {
    node.stage.responseOptions.forEach((option, optionIndex) => {
      const targetNode = nodeMap.get(option.targetStageId)
      if (!targetNode) return

      const startX = node.x + node.width
      const startY = node.y + 56 + Math.min(optionIndex, 3) * 18
      const endX = targetNode.x
      const endY = targetNode.y + targetNode.height / 2

      if (node.stage.id === targetNode.stage.id) {
        const loopX = startX + 44
        const loopY = startY - 32
        connections.push({
          id: `${node.stage.id}-${option.id}`,
          fromStageId: node.stage.id,
          toStageId: targetNode.stage.id,
          label: option.label,
          path: `M ${startX} ${startY} C ${loopX} ${startY}, ${loopX} ${loopY}, ${startX - 10} ${loopY} C ${startX - 54} ${loopY}, ${startX - 54} ${startY + 28}, ${startX} ${startY + 28}`,
        })
        return
      }

      const delta = Math.max(60, Math.abs(endX - startX) / 2)
      connections.push({
        id: `${node.stage.id}-${option.id}`,
        fromStageId: node.stage.id,
        toStageId: targetNode.stage.id,
        label: option.label,
        path: `M ${startX} ${startY} C ${startX + delta} ${startY}, ${endX - delta} ${endY}, ${endX} ${endY}`,
      })
    })
  })

  const maxY = nodes.length ? Math.max(...nodes.map((node) => node.y + node.height)) : 0
  return {
    width: padding * 2 + nodeWidth * 2 + colGap,
    height: maxY + padding,
    nodes,
    connections,
  }
}

export function CrmIntegrationsClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null)
  const [updatingChannelId, setUpdatingChannelId] = useState<string | null>(null)
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<ChannelConnection | null>(null)
  const [channels, setChannels] = useState<ChannelConnection[]>([])
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>('template')
  const [workspaceView, setWorkspaceView] = useState<CrmWorkspaceView>('operations')
  const [metricsExpanded, setMetricsExpanded] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [copiedKey, setCopiedKey] = useState('')
  const [activeAssetTab, setActiveAssetTab] = useState('overview')
  const [goalTargets, setGoalTargets] = useState<ChannelGoalTargets>({ operational: '', captures: '', conversations: '' })
  const [createForm, setCreateForm] = useState<ChannelFormState>(getInitialChannelForm())
  const [chatbotBuilderDraft, setChatbotBuilderDraft] = useState<ChatbotBuilderState>(getChatbotBuilderState(null))
  const [chatbotBuilderModalOpen, setChatbotBuilderModalOpen] = useState(false)
  const [savingChatbotBuilder, setSavingChatbotBuilder] = useState(false)
  const [chatbotBuilderPreviewMode, setChatbotBuilderPreviewMode] = useState<ChatbotPreviewMode>('expanded')
  const [chatbotBuilderPreviewViewport, setChatbotBuilderPreviewViewport] = useState<ChatbotPreviewViewport>('desktop')
  const [chatbotBuilderSection, setChatbotBuilderSection] = useState<ChatbotBuilderSection>('flow')
  const [selectedChatbotStageId, setSelectedChatbotStageId] = useState<ChatbotFlowStageId>('welcome')
  const [webFormBuilderDraft, setWebFormBuilderDraft] = useState<WebFormBuilderState>(getWebFormBuilderState(null))
  const [webFormBuilderModalOpen, setWebFormBuilderModalOpen] = useState(false)
  const [savingWebFormBuilder, setSavingWebFormBuilder] = useState(false)
  const [metaSelectionDraft, setMetaSelectionDraft] = useState({ selectedPageId: '', selectedInstagramAccountId: '', selectedPhoneNumberId: '' })
  const [floatingPreviewOpen, setFloatingPreviewOpen] = useState(false)
  const [wizardChatPreviewMode, setWizardChatPreviewMode] = useState<ChatbotPreviewMode>('floating')
  const [wizardChatPreviewViewport, setWizardChatPreviewViewport] = useState<ChatbotPreviewViewport>('desktop')

  const loadChannels = useCallback(async () => {
    setLoading(true)
    try {
      const json = await requestJson<ChannelConnection[]>('/api/crm/channels')
      const rows = Array.isArray(json.data) ? json.data : []
      setChannels(rows)
      setSelectedChannelId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
      const storedGoalTargets = window.localStorage.getItem('crm-integrations-goals')
      if (storedGoalTargets) {
        try {
          const parsed = JSON.parse(storedGoalTargets) as Partial<ChannelGoalTargets>
          setGoalTargets({
            operational: typeof parsed.operational === 'string' ? parsed.operational : '',
            captures: typeof parsed.captures === 'string' ? parsed.captures : '',
            conversations: typeof parsed.conversations === 'string' ? parsed.conversations : '',
          })
        } catch {
          window.localStorage.removeItem('crm-integrations-goals')
        }
      }
    }
    void loadChannels()
  }, [loadChannels])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('crm-integrations-goals', JSON.stringify(goalTargets))
  }, [goalTargets])

  useEffect(() => {
    if (!copiedKey) return
    const timeout = window.setTimeout(() => setCopiedKey(''), 1800)
    return () => window.clearTimeout(timeout)
  }, [copiedKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const search = new URLSearchParams(window.location.search)
    const channelId = search.get('channelId')
    const metaStatus = search.get('meta')
    const message = search.get('message')

    if (channelId) {
      setSelectedChannelId(channelId)
    }

    if (metaStatus === 'connected') {
      window.history.replaceState({}, '', window.location.pathname)
    } else if (metaStatus === 'error') {
      alert(message || 'No se pudo completar la conexión con Meta.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const selectedChannel = useMemo(() => channels.find((item) => item.id === selectedChannelId) ?? null, [channels, selectedChannelId])
  const createPreset = useMemo(() => TEMPLATE_PRESETS.find((item) => item.key === createForm.templateKey) ?? TEMPLATE_PRESETS[0], [createForm.templateKey])
  const createIsChatbot = createForm.provider === 'WEB_CHATBOT'
  const createIsBridge = createForm.provider === 'WEB_FORM' && createForm.bridgeKind !== 'GENERIC'
  const createIsPublicWebForm = createForm.provider === 'WEB_FORM' && createForm.bridgeKind === 'GENERIC'
  const createUsesWebhook = createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' || createForm.provider === 'FACEBOOK_PAGE' || createForm.provider === 'MESSENGER' || createForm.provider === 'INSTAGRAM_DM'
  const wizardLauncherMetrics = useMemo(() => getLauncherPreviewMetrics(createForm.launcherSize), [createForm.launcherSize])
  const derivedChatbotCustomCss = useMemo(() => buildFriendlyChatbotCustomCss({ chatShellRadius: createForm.chatShellRadius, messageBubbleRadius: createForm.messageBubbleRadius, panelShadowPreset: createForm.panelShadowPreset }), [createForm.chatShellRadius, createForm.messageBubbleRadius, createForm.panelShadowPreset])

  const stats = useMemo(() => {
    return {
      active: channels.filter((item) => item.status === 'ACTIVE').length,
      testing: channels.filter((item) => item.status === 'TESTING').length,
      captures: channels.reduce((sum, item) => sum + (item._count?.captures ?? 0), 0),
      conversations: channels.reduce((sum, item) => sum + (item._count?.conversations ?? 0), 0),
    }
  }, [channels])

  const channelAnalytics = useMemo(() => {
    const totalChannels = channels.length || 1
    const sortedByVolume = [...channels]
      .sort((left, right) => ((right._count?.captures ?? 0) + (right._count?.conversations ?? 0)) - ((left._count?.captures ?? 0) + (left._count?.conversations ?? 0)))

    const performance = sortedByVolume.slice(0, 6).map((channel) => {
      const bridgeKind = getBridgeKind((channel.settingsJson as Record<string, unknown> | null | undefined) ?? null)
      return {
        id: channel.id,
        name: channel.name.length > 18 ? `${channel.name.slice(0, 18)}…` : channel.name,
        fullName: channel.name,
        provider: getChannelProviderLabel(channel.provider, bridgeKind),
        captures: channel._count?.captures ?? 0,
        conversations: channel._count?.conversations ?? 0,
        color: getProviderChartColor(channel.provider),
      }
    })

    const distribution = Object.values(channels.reduce<Record<string, { label: string; value: number; color: string }>>((accumulator, channel) => {
      const bridgeKind = getBridgeKind((channel.settingsJson as Record<string, unknown> | null | undefined) ?? null)
      const key = `${channel.provider}:${bridgeKind || 'GENERIC'}`
      if (!accumulator[key]) {
        accumulator[key] = {
          label: getChannelProviderLabel(channel.provider, bridgeKind),
          value: 0,
          color: getProviderChartColor(channel.provider),
        }
      }
      accumulator[key].value += 1
      return accumulator
    }, {})).sort((left, right) => right.value - left.value)

    const lastSixMonths = Array.from({ length: 6 }, (_, index) => {
      const base = new Date()
      const month = new Date(base.getFullYear(), base.getMonth() - (5 - index), 1)
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
      return {
        key,
        label: month.toLocaleDateString('es-CO', { month: 'short' }),
        captures: 0,
        conversations: 0,
        channels: 0,
      }
    })

    const monthMap = new Map(lastSixMonths.map((item) => [item.key, item]))
    channels.forEach((channel) => {
      const referenceDate = channel.lastWebhookAt || channel.updatedAt || channel.createdAt
      const date = new Date(referenceDate)
      if (Number.isNaN(date.getTime())) return
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const bucket = monthMap.get(key)
      if (!bucket) return
      bucket.captures += channel._count?.captures ?? 0
      bucket.conversations += channel._count?.conversations ?? 0
      bucket.channels += 1
    })

    const readiness = channels.reduce((accumulator, channel) => {
      const summary = getChannelReadiness(channel, baseUrl)
      const configuredDone = summary.configured.filter((item) => item.done).length === summary.configured.length
      const demoDone = summary.demo.filter((item) => item.done).length === summary.demo.length
      const productionDone = summary.production.filter((item) => item.done).length === summary.production.length

      if (configuredDone) accumulator.configured += 1
      if (demoDone) accumulator.demo += 1
      if (productionDone) accumulator.production += 1
      return accumulator
    }, { configured: 0, demo: 0, production: 0 })

    const totalCaptures = channels.reduce((sum, item) => sum + (item._count?.captures ?? 0), 0)
    const totalConversations = channels.reduce((sum, item) => sum + (item._count?.conversations ?? 0), 0)
    const activationRate = Math.round(((stats.active + stats.testing) / totalChannels) * 100)
    const productionRate = Math.round((readiness.production / totalChannels) * 100)
    const channelGoalDefault = Math.max(4, Math.ceil(totalChannels / 4) * 4)
    const captureGoalDefault = Math.max(20, Math.ceil(totalCaptures / 25) * 25)
    const conversationGoalDefault = Math.max(20, Math.ceil(totalConversations / 25) * 25)
    const channelGoal = Math.max(1, Number(goalTargets.operational.replace(/[^0-9]/g, '')) || channelGoalDefault)
    const captureGoal = Math.max(1, Number(goalTargets.captures.replace(/[^0-9]/g, '')) || captureGoalDefault)
    const conversationGoal = Math.max(1, Number(goalTargets.conversations.replace(/[^0-9]/g, '')) || conversationGoalDefault)

    return {
      performance,
      distribution,
      timeline: lastSixMonths,
      defaultTargets: {
        operational: channelGoalDefault,
        captures: captureGoalDefault,
        conversations: conversationGoalDefault,
      },
      goals: [
        {
          label: 'Canales operativos',
          value: stats.active + stats.testing,
          target: channelGoal,
          progress: Math.min(100, Math.round(((stats.active + stats.testing) / channelGoal) * 100)),
          caption: `${stats.active} activos y ${stats.testing} en testing`,
          icon: Goal,
          accent: 'from-sky-500 to-cyan-400',
        },
        {
          label: 'Capturas del ecosistema',
          value: totalCaptures,
          target: captureGoal,
          progress: Math.min(100, Math.round((totalCaptures / captureGoal) * 100)),
          caption: `${formatCompactNumber(totalCaptures)} leads ya entraron al CRM`,
          icon: TrendingUp,
          accent: 'from-emerald-500 to-lime-400',
        },
        {
          label: 'Conversaciones trazadas',
          value: totalConversations,
          target: conversationGoal,
          progress: Math.min(100, Math.round((totalConversations / conversationGoal) * 100)),
          caption: `${formatCompactNumber(totalConversations)} hilos comerciales vinculados`,
          icon: Activity,
          accent: 'from-amber-500 to-orange-400',
        },
      ],
      scorecards: {
        activationRate,
        productionRate,
        configured: readiness.configured,
        demo: readiness.demo,
        production: readiness.production,
      },
    }
  }, [baseUrl, channels, goalTargets.captures, goalTargets.conversations, goalTargets.operational, stats.active, stats.testing])

  const endpoint = getEndpoint(baseUrl, selectedChannel)
  const selectedSettings = (selectedChannel?.settingsJson as Record<string, unknown> | null | undefined) ?? null
  const selectedToken = getTokenFromSettings(selectedSettings)
  const selectedBridgeKind = getBridgeKind(selectedSettings)
  const selectedChatbotEmbedUrl = selectedChannel?.provider === 'WEB_CHATBOT' ? buildChatbotEmbedUrl(baseUrl, selectedChannel.id) : ''
  const selectedWebFormEmbedUrl = selectedChannel?.provider === 'WEB_FORM' && selectedBridgeKind === 'GENERIC' ? buildWebFormEmbedUrl(baseUrl, selectedChannel.id) : ''
  const selectedChatbotTitle = getChatbotTitle(selectedSettings)
  const selectedChatbotPrompt = getChatbotPrompt(selectedSettings)
  const selectedChatbotAssistant = getAssistantName(selectedSettings)
  const selectedChatbotAccent = getAccentColor(selectedSettings)
  const selectedReadiness = useMemo(() => selectedChannel ? getChannelReadiness(selectedChannel, baseUrl) : null, [baseUrl, selectedChannel])
  const selectedMeta = useMemo(() => getMetaConnectionState(selectedSettings), [selectedSettings])
  const selectedIsChatbot = selectedChannel?.provider === 'WEB_CHATBOT'
  const selectedIsPublicWebForm = selectedChannel?.provider === 'WEB_FORM' && selectedBridgeKind === 'GENERIC'
  const selectedChatbotFlowStage = useMemo(() => chatbotBuilderDraft.flowStages.find((item) => item.id === selectedChatbotStageId) ?? chatbotBuilderDraft.flowStages[0] ?? null, [chatbotBuilderDraft.flowStages, selectedChatbotStageId])
  const chatbotCanvasModel = useMemo(() => buildChatbotCanvasModel(chatbotBuilderDraft.flowStages), [chatbotBuilderDraft.flowStages])

  useEffect(() => {
    setMetaSelectionDraft({
      selectedPageId: selectedMeta.selectedPageId || selectedChannel?.externalPageId || '',
      selectedInstagramAccountId: selectedMeta.selectedInstagramAccountId || selectedChannel?.externalAccountId || '',
      selectedPhoneNumberId: selectedMeta.selectedPhoneNumberId || selectedChannel?.externalPhoneNumberId || '',
    })
  }, [selectedChannel?.externalAccountId, selectedChannel?.externalPageId, selectedChannel?.externalPhoneNumberId, selectedMeta.selectedInstagramAccountId, selectedMeta.selectedPageId, selectedMeta.selectedPhoneNumberId])

  useEffect(() => {
    setChatbotBuilderDraft(getChatbotBuilderState(selectedSettings))
  }, [selectedChannelId, selectedSettings])

  useEffect(() => {
    setSelectedChatbotStageId((current) => chatbotBuilderDraft.flowStages.some((item) => item.id === current) ? current : chatbotBuilderDraft.flowStages[0]?.id ?? 'welcome')
  }, [chatbotBuilderDraft.flowStages])

  useEffect(() => {
    if (!selectedIsChatbot) {
      setChatbotBuilderModalOpen(false)
    }
  }, [selectedIsChatbot])

  useEffect(() => {
    setWebFormBuilderDraft(getWebFormBuilderState(selectedSettings))
  }, [selectedChannelId, selectedSettings])

  useEffect(() => {
    if (!selectedIsPublicWebForm) {
      setWebFormBuilderModalOpen(false)
    }
  }, [selectedIsPublicWebForm])

  const snippets = useMemo(() => {
    if (!selectedChannel || !baseUrl) return null

    const token = selectedToken || '<TOKEN>'
    return {
      webForm: buildWebFormSnippet({
        baseUrl,
        channelId: selectedChannel.id,
        token,
        selector: getFormSelector(selectedSettings),
      }),
      webFormIframe: buildWebFormIframeSnippet({
        baseUrl,
        channelId: selectedChannel.id,
        height: getIframeHeight(selectedSettings),
      }),
      webFormEmbedUrl: buildWebFormEmbedUrl(baseUrl, selectedChannel.id),
      chatbot: buildChatbotSnippet({
        baseUrl,
        channelId: selectedChannel.id,
        token,
        title: getChatbotTitle(selectedSettings),
        prompt: getChatbotPrompt(selectedSettings),
        accentColor: getAccentColor(selectedSettings),
        backgroundColor: getBackgroundColor(selectedSettings),
        launcherLabel: getLauncherLabel(selectedSettings),
        launcherIcon: getLauncherIcon(selectedSettings),
        launcherPosition: getLauncherPosition(selectedSettings),
        launcherSize: getLauncherSize(selectedSettings),
        customCss: getChatbotCustomCss(selectedSettings),
      }),
      chatbotIframe: buildChatbotIframeSnippet({
        baseUrl,
        channelId: selectedChannel.id,
        height: getIframeHeight(selectedSettings),
        floatingLauncherEnabled: getFloatingLauncherEnabled(selectedSettings),
      }),
      chatbotEmbedUrl: buildChatbotEmbedUrl(baseUrl, selectedChannel.id),
      gmail: buildGmailAppsScriptSnippet({
        baseUrl,
        channelId: selectedChannel.id,
        token,
      }),
      outlook: buildOutlookPayloadExample(baseUrl, selectedChannel.id, token),
      webhook: buildWebhookPayloadExample(selectedChannel.provider),
    }
  }, [baseUrl, selectedChannel, selectedSettings, selectedToken])

  function applyTemplate(templateKey: string) {
    const preset = TEMPLATE_PRESETS.find((item) => item.key === templateKey)
    if (!preset) return
    setCreateForm((prev) => ({
      ...prev,
      templateKey,
      name: preset.name,
      provider: preset.provider,
      bridgeKind: preset.bridgeKind ?? 'GENERIC',
      testingToken: prev.testingToken || makeDemoToken(),
      publicEmbedEnabled: preset.provider === 'WEB_CHATBOT' || (preset.provider === 'WEB_FORM' && !preset.bridgeKind),
    }))
    setWizardStep('config')
  }

  function openCreateWizard() {
    setEditingChannelId(null)
    setCreateForm(getInitialChannelForm())
    setWizardChatPreviewMode('floating')
    setWizardChatPreviewViewport('desktop')
    setWizardStep('template')
    setCreateOpen(true)
  }

  function openEditWizard(channel: ChannelConnection) {
    const settings = (channel.settingsJson as Record<string, unknown> | null | undefined) ?? null
    const bridgeKind = getBridgeKind(settings) as CrmBridgeKind
    const templateMatch = TEMPLATE_PRESETS.find((preset) => preset.provider === channel.provider && (preset.bridgeKind ?? 'GENERIC') === (bridgeKind || 'GENERIC'))

    setEditingChannelId(channel.id)
    setCreateForm({
      templateKey: templateMatch?.key ?? (channel.provider === 'WEB_CHATBOT' ? 'web-chatbot' : 'web-form'),
      name: channel.name,
      provider: channel.provider,
      status: channel.status,
      testingToken: getTokenFromSettings(settings) || '',
      bridgeKind: (bridgeKind || 'GENERIC') as CrmBridgeKind,
      externalAccountId: channel.externalAccountId || '',
      externalPageId: channel.externalPageId || '',
      externalPhoneNumberId: channel.externalPhoneNumberId || '',
      whatsappAccessToken: getWhatsAppAccessToken(settings),
      whatsappApiVersion: getWhatsAppApiVersion(settings),
      formSelector: getFormSelector(settings),
      chatbotTitle: getChatbotTitle(settings),
      chatbotPrompt: getChatbotPrompt(settings),
      assistantName: getAssistantName(settings),
      publicEmbedEnabled: getPublicEmbedEnabled(settings),
      iframeHeight: getIframeHeight(settings),
      allowedDomains: getAllowedDomains(settings),
      accentColor: getAccentColor(settings),
      pageBackgroundColor: getPageBackgroundColor(settings),
      backgroundColor: getBackgroundColor(settings),
      fontFamily: getFontFamily(settings),
      floatingLauncherEnabled: getFloatingLauncherEnabled(settings),
      launcherLabel: getLauncherLabel(settings),
      launcherIcon: getLauncherIcon(settings),
      launcherPosition: getLauncherPosition(settings),
      launcherSize: getLauncherSize(settings),
      headerBadgeLabel: getHeaderBadgeLabel(settings),
      statusBadgeLabel: getStatusBadgeLabel(settings),
      chatShellRadius: getChatShellRadius(settings),
      messageBubbleRadius: getMessageBubbleRadius(settings),
      panelShadowPreset: getPanelShadowPreset(settings),
      formTitle: getSettingText(settings, 'formTitle', 'Solicita tu cotización'),
      formDescription: getSettingText(settings, 'formDescription', 'Completa el formulario y nuestro equipo comercial te contactará.'),
      submitCtaLabel: getSettingText(settings, 'submitCtaLabel', 'Enviar solicitud'),
      formSuccessMessage: getSettingText(settings, 'formSuccessMessage', 'Gracias. Ya recibimos tu solicitud y la estamos enviando al CRM.'),
      formCardRadius: getSettingText(settings, 'formCardRadius', '28'),
      formInputRadius: getSettingText(settings, 'formInputRadius', '16'),
      formFieldSpacing: getSettingText(settings, 'formFieldSpacing', '14'),
      formPadding: getSettingText(settings, 'formPadding', '24'),
      formFontSize: getSettingText(settings, 'formFontSize', '14'),
      formLabelColor: getSettingText(settings, 'formLabelColor', '#0f172a'),
      formInputTextColor: getSettingText(settings, 'formInputTextColor', '#0f172a'),
      formInputBackgroundColor: getSettingText(settings, 'formInputBackgroundColor', '#ffffff'),
      formInputBorderColor: getSettingText(settings, 'formInputBorderColor', '#cbd5e1'),
      formCtaColor: getSettingText(settings, 'formCtaColor', getAccentColor(settings)),
      formCtaTextColor: getSettingText(settings, 'formCtaTextColor', '#ffffff'),
      showNameField: getBooleanSetting(settings, 'showNameField', true),
      showEmailField: getBooleanSetting(settings, 'showEmailField', true),
      showPhoneField: getBooleanSetting(settings, 'showPhoneField', true),
      showCompanyField: getBooleanSetting(settings, 'showCompanyField', false),
      showCityField: getBooleanSetting(settings, 'showCityField', false),
      showProductField: getShowProductField(settings),
      quickActions: normalizeChatbotQuickActions(settings?.quickActions),
      flowStages: normalizeChatbotFlowStages(settings?.flowStages),
      showMessageField: getBooleanSetting(settings, 'showMessageField', true),
      nameLabel: getSettingText(settings, 'nameLabel', 'Nombre'),
      namePlaceholder: getSettingText(settings, 'namePlaceholder', 'Tu nombre'),
      emailLabel: getSettingText(settings, 'emailLabel', 'Correo'),
      emailPlaceholder: getSettingText(settings, 'emailPlaceholder', 'tu@correo.com'),
      phoneLabel: getSettingText(settings, 'phoneLabel', 'Teléfono o WhatsApp'),
      phonePlaceholder: getSettingText(settings, 'phonePlaceholder', '300 000 0000'),
      companyLabel: getSettingText(settings, 'companyLabel', 'Empresa'),
      companyPlaceholder: getSettingText(settings, 'companyPlaceholder', 'Nombre de la empresa'),
      cityLabel: getSettingText(settings, 'cityLabel', 'Ciudad'),
      cityPlaceholder: getSettingText(settings, 'cityPlaceholder', 'Ciudad o sede'),
      productLabel: getSettingText(settings, 'productLabel', 'Producto'),
      productPlaceholder: getSettingText(settings, 'productPlaceholder', '¿Qué producto necesitas?'),
      messageLabel: getSettingText(settings, 'messageLabel', 'Mensaje'),
      messagePlaceholder: getSettingText(settings, 'messagePlaceholder', 'Cuéntanos qué necesitas y para cuándo.'),
    })
    setWizardChatPreviewMode('floating')
    setWizardChatPreviewViewport('desktop')
    setWizardStep('config')
    setCreateOpen(true)
  }

  async function copyText(key: string, value: string) {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
  }

  async function syncMeta(channelId: string, selection?: { externalAccountId?: string; externalPageId?: string; externalPhoneNumberId?: string }) {
    setUpdatingChannelId(channelId)
    try {
      const json = await requestJson<ChannelConnection>(`/api/crm/channels/${channelId}/meta/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selection ?? {}),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo sincronizar Meta.')
        return
      }
      await loadChannels()
      setSelectedChannelId(channelId)
    } finally {
      setUpdatingChannelId(null)
    }
  }

  async function applyMetaSelection(channel: ChannelConnection) {
    const selection = channel.provider === 'WHATSAPP_CLOUD' || channel.provider === 'WHATSAPP_SANDBOX'
      ? { externalPhoneNumberId: metaSelectionDraft.selectedPhoneNumberId }
      : channel.provider === 'INSTAGRAM_DM'
        ? {
            externalPageId: metaSelectionDraft.selectedPageId,
            externalAccountId: metaSelectionDraft.selectedInstagramAccountId,
          }
        : { externalPageId: metaSelectionDraft.selectedPageId }

    await syncMeta(channel.id, selection)
  }

  async function disconnectMeta(channelId: string) {
    setUpdatingChannelId(channelId)
    try {
      const json = await requestJson<ChannelConnection>(`/api/crm/channels/${channelId}/meta/disconnect`, { method: 'POST' })
      if (!json.success) {
        alert(json.error || 'No se pudo desconectar Meta.')
        return
      }
      await loadChannels()
      setSelectedChannelId(channelId)
    } finally {
      setUpdatingChannelId(null)
    }
  }

  async function saveChannel() {
    if (!createForm.name.trim()) {
      alert('El nombre del canal es requerido.')
      return
    }

    setSaving(true)
    try {
      const settingsJson = {
        testingToken: createForm.testingToken,
        bridgeKind: createForm.bridgeKind,
        whatsappAccessToken: createForm.whatsappAccessToken,
        whatsappApiVersion: createForm.whatsappApiVersion,
        formSelector: createForm.formSelector,
        chatbotTitle: createForm.chatbotTitle,
        chatbotPrompt: createForm.chatbotPrompt,
        assistantName: createForm.assistantName,
        publicEmbedEnabled: createForm.publicEmbedEnabled,
        iframeHeight: createForm.iframeHeight,
        allowedDomains: createForm.allowedDomains,
        accentColor: createForm.accentColor,
        pageBackgroundColor: createForm.pageBackgroundColor,
        backgroundColor: createForm.backgroundColor,
        fontFamily: createForm.fontFamily,
        floatingLauncherEnabled: createForm.floatingLauncherEnabled,
        launcherLabel: createForm.launcherLabel,
        launcherIcon: createForm.launcherIcon,
        launcherPosition: createForm.launcherPosition,
        launcherSize: createForm.launcherSize,
        headerBadgeLabel: createForm.headerBadgeLabel,
        statusBadgeLabel: createForm.statusBadgeLabel,
        chatShellRadius: normalizePixelValue(createForm.chatShellRadius, '30'),
        messageBubbleRadius: normalizePixelValue(createForm.messageBubbleRadius, '22'),
        panelShadowPreset: createForm.panelShadowPreset,
        chatbotCustomCss: derivedChatbotCustomCss,
        formTitle: createForm.formTitle,
        formDescription: createForm.formDescription,
        submitCtaLabel: createForm.submitCtaLabel,
        formSuccessMessage: createForm.formSuccessMessage,
        formCardRadius: normalizePixelValue(createForm.formCardRadius, '28'),
        formInputRadius: normalizePixelValue(createForm.formInputRadius, '16'),
        formFieldSpacing: normalizePixelValue(createForm.formFieldSpacing, '14'),
        formPadding: normalizePixelValue(createForm.formPadding, '24'),
        formFontSize: normalizePixelValue(createForm.formFontSize, '14'),
        formLabelColor: createForm.formLabelColor,
        formInputTextColor: createForm.formInputTextColor,
        formInputBackgroundColor: createForm.formInputBackgroundColor,
        formInputBorderColor: createForm.formInputBorderColor,
        formCtaColor: createForm.formCtaColor,
        formCtaTextColor: createForm.formCtaTextColor,
        showNameField: createForm.showNameField,
        showEmailField: createForm.showEmailField,
        showPhoneField: createForm.showPhoneField,
        showCompanyField: createForm.showCompanyField,
        showCityField: createForm.showCityField,
        showProductField: createForm.showProductField,
        quickActions: createForm.quickActions,
        flowStages: createForm.flowStages,
        showMessageField: createForm.showMessageField,
        nameLabel: createForm.nameLabel,
        namePlaceholder: createForm.namePlaceholder,
        emailLabel: createForm.emailLabel,
        emailPlaceholder: createForm.emailPlaceholder,
        phoneLabel: createForm.phoneLabel,
        phonePlaceholder: createForm.phonePlaceholder,
        companyLabel: createForm.companyLabel,
        companyPlaceholder: createForm.companyPlaceholder,
        cityLabel: createForm.cityLabel,
        cityPlaceholder: createForm.cityPlaceholder,
        productLabel: createForm.productLabel,
        productPlaceholder: createForm.productPlaceholder,
        messageLabel: createForm.messageLabel,
        messagePlaceholder: createForm.messagePlaceholder,
        allowHumanHandoff: true,
      }

      const isEditing = Boolean(editingChannelId)
      const json = await requestJson<ChannelConnection>(isEditing ? `/api/crm/channels/${editingChannelId}` : '/api/crm/channels', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          provider: createForm.provider,
          status: createForm.status,
          verifyToken: createForm.testingToken,
          externalAccountId: createForm.externalAccountId,
          externalPageId: createForm.externalPageId,
          externalPhoneNumberId: createForm.externalPhoneNumberId,
          settingsJson,
        }),
      })

      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo crear el canal.')
        return
      }

      setCreateOpen(false)
      setEditingChannelId(null)
      setWizardStep('template')
      setWizardChatPreviewMode('floating')
      setWizardChatPreviewViewport('desktop')
      setActiveAssetTab(json.data.provider === 'WEB_CHATBOT' ? 'chatbot' : json.data.provider === 'WEB_FORM' ? 'form' : 'overview')
      setCreateForm(getInitialChannelForm())
      await loadChannels()
      setSelectedChannelId(json.data.id)
    } finally {
      setSaving(false)
    }
  }

  async function updateChannelStatus(channelId: string, status: ChannelStatus) {
    setUpdatingChannelId(channelId)
    try {
      const json = await requestJson<ChannelConnection>(`/api/crm/channels/${channelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!json.success) {
        alert(json.error || 'No se pudo actualizar el canal.')
        return
      }
      await loadChannels()
    } finally {
      setUpdatingChannelId(null)
    }
  }

  async function deleteChannel(channelId: string) {
    setDeletingChannelId(channelId)
    try {
      const json = await requestJson(`/api/crm/channels/${channelId}`, { method: 'DELETE' })
      if (!json.success) {
        alert(json.error || 'No se pudo eliminar el canal.')
        return
      }
      setDeleteCandidate(null)
      await loadChannels()
    } finally {
      setDeletingChannelId(null)
    }
  }

  function updateChatbotStage(stageId: ChatbotFlowStageId, patch: Partial<ChatbotFlowStage>) {
    setChatbotBuilderDraft((current) => ({
      ...current,
      flowStages: current.flowStages.map((stage) => stage.id === stageId ? { ...stage, ...patch } : stage),
    }))
  }

  function addChatbotStage() {
    const nextStageId = createChatbotStageId(chatbotBuilderDraft.flowStages)
    setChatbotBuilderDraft((current) => ({
      ...current,
      flowStages: [
        ...current.flowStages,
        {
          id: nextStageId,
          title: 'Nueva etapa',
          description: 'Define qué objetivo cumple esta etapa dentro del flujo.',
          prompt: 'Escribe aquí la pregunta o mensaje que activará esta etapa.',
          nextField: 'none',
          quickActionIds: [],
          responseOptions: [],
        },
      ],
    }))
    setSelectedChatbotStageId(nextStageId)
  }

  function deleteChatbotStage(stageId: ChatbotFlowStageId) {
    if (PROTECTED_CHATBOT_STAGE_IDS.has(stageId)) return

    const fallbackStageId = chatbotBuilderDraft.flowStages.find((stage) => stage.id !== stageId)?.id ?? 'welcome'
    setChatbotBuilderDraft((current) => ({
      ...current,
      flowStages: current.flowStages
        .filter((stage) => stage.id !== stageId)
        .map((stage) => ({
          ...stage,
          responseOptions: stage.responseOptions.map((option) => option.targetStageId === stageId ? { ...option, targetStageId: fallbackStageId } : option),
        })),
    }))
    setSelectedChatbotStageId(fallbackStageId)
  }

  function moveChatbotStage(stageId: ChatbotFlowStageId, direction: -1 | 1) {
    setChatbotBuilderDraft((current) => {
      const index = current.flowStages.findIndex((stage) => stage.id === stageId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.flowStages.length) return current
      const stages = [...current.flowStages]
      const [stage] = stages.splice(index, 1)
      stages.splice(nextIndex, 0, stage)
      return { ...current, flowStages: stages }
    })
  }

  function toggleChatbotStageQuickAction(stageId: ChatbotFlowStageId, actionId: string, enabled: boolean) {
    setChatbotBuilderDraft((current) => ({
      ...current,
      flowStages: current.flowStages.map((stage) => {
        if (stage.id !== stageId) return stage
        return {
          ...stage,
          quickActionIds: enabled
            ? Array.from(new Set([...stage.quickActionIds, actionId]))
            : stage.quickActionIds.filter((item) => item !== actionId),
        }
      }),
    }))
  }

  function addChatbotResponseOption(stageId: ChatbotFlowStageId) {
    const selectedStage = chatbotBuilderDraft.flowStages.find((stage) => stage.id === stageId)
    if (!selectedStage) return

    let nextOptionIndex = selectedStage.responseOptions.length + 1
    let nextOptionId = `${stageId}-option-${nextOptionIndex}`
    while (selectedStage.responseOptions.some((option) => option.id === nextOptionId)) {
      nextOptionIndex += 1
      nextOptionId = `${stageId}-option-${nextOptionIndex}`
    }

    setChatbotBuilderDraft((current) => ({
      ...current,
      flowStages: current.flowStages.map((stage) => {
        if (stage.id !== stageId) return stage
        return {
          ...stage,
          responseOptions: [
            ...stage.responseOptions,
            {
              id: nextOptionId,
              label: 'Nueva respuesta',
              userMessage: 'Quiero continuar por esta ruta.',
              assistantReply: 'Perfecto. Continúo por esta ruta del flujo.',
              matchMode: 'contains',
              matchValue: 'continuar, seguir, siguiente',
              targetStageId: stage.id,
            },
          ],
        }
      }),
    }))
  }

  function updateChatbotResponseOption(stageId: ChatbotFlowStageId, optionId: string, patch: Partial<ChatbotFlowResponseOption>) {
    setChatbotBuilderDraft((current) => ({
      ...current,
      flowStages: current.flowStages.map((stage) => {
        if (stage.id !== stageId) return stage
        return {
          ...stage,
          responseOptions: stage.responseOptions.map((option) => option.id === optionId ? { ...option, ...patch } : option),
        }
      }),
    }))
  }

  function removeChatbotResponseOption(stageId: ChatbotFlowStageId, optionId: string) {
    setChatbotBuilderDraft((current) => ({
      ...current,
      flowStages: current.flowStages.map((stage) => {
        if (stage.id !== stageId) return stage
        return {
          ...stage,
          responseOptions: stage.responseOptions.filter((option) => option.id !== optionId),
        }
      }),
    }))
  }

  function updateChatbotQuickAction(actionId: string, patch: Partial<ChatbotQuickAction>) {
    setChatbotBuilderDraft((current) => ({
      ...current,
      quickActions: current.quickActions.map((action) => action.id === actionId ? { ...action, ...patch } : action),
    }))
  }

  async function saveSelectedChatbotBuilder() {
    if (!selectedChannel || !selectedIsChatbot) return

    setSavingChatbotBuilder(true)
    try {
      const mergedSettings = {
        ...(selectedSettings ?? {}),
        ...chatbotBuilderDraft,
        iframeHeight: normalizePixelValue(chatbotBuilderDraft.iframeHeight, '720'),
        chatShellRadius: normalizePixelValue(chatbotBuilderDraft.chatShellRadius, '30'),
        messageBubbleRadius: normalizePixelValue(chatbotBuilderDraft.messageBubbleRadius, '22'),
        chatbotCustomCss: buildFriendlyChatbotCustomCss({
          chatShellRadius: chatbotBuilderDraft.chatShellRadius,
          messageBubbleRadius: chatbotBuilderDraft.messageBubbleRadius,
          panelShadowPreset: chatbotBuilderDraft.panelShadowPreset,
        }),
      }

      const json = await requestJson<ChannelConnection>(`/api/crm/channels/${selectedChannel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settingsJson: mergedSettings }),
      })

      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo guardar el constructor del chatbot.')
        return
      }

      await loadChannels()
      setSelectedChannelId(json.data.id)
    } finally {
      setSavingChatbotBuilder(false)
    }
  }

  async function saveSelectedWebFormBuilder() {
    if (!selectedChannel || !selectedIsPublicWebForm) return

    setSavingWebFormBuilder(true)
    try {
      const mergedSettings = {
        ...(selectedSettings ?? {}),
        ...webFormBuilderDraft,
        iframeHeight: normalizePixelValue(webFormBuilderDraft.iframeHeight, '840'),
        formCardRadius: normalizePixelValue(webFormBuilderDraft.formCardRadius, '28'),
        formInputRadius: normalizePixelValue(webFormBuilderDraft.formInputRadius, '16'),
        formFieldSpacing: normalizePixelValue(webFormBuilderDraft.formFieldSpacing, '14'),
        formPadding: normalizePixelValue(webFormBuilderDraft.formPadding, '24'),
        formFontSize: normalizePixelValue(webFormBuilderDraft.formFontSize, '14'),
      }

      const json = await requestJson<ChannelConnection>(`/api/crm/channels/${selectedChannel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settingsJson: mergedSettings }),
      })

      if (!json.success || !json.data) {
        alert(json.error || 'No se pudo guardar el constructor del formulario.')
        return
      }

      await loadChannels()
      setSelectedChannelId(json.data.id)
    } finally {
      setSavingWebFormBuilder(false)
    }
  }

  const wizardPreview = useMemo(() => {
    const endpointPreview = createForm.provider === 'WEB_CHATBOT'
      ? `${baseUrl || 'https://tu-dominio.com'}/chatbot/<canal>`
      : createForm.provider === 'WEB_FORM'
        ? `${baseUrl || 'https://tu-dominio.com'}/api/crm/captures/web-form`
        : usesMetaProvider(createForm.provider)
          ? `${baseUrl || 'https://tu-dominio.com'}/api/webhooks/meta`
        : `${baseUrl || 'https://tu-dominio.com'}/api/crm/channels/<canal>/webhook`

    const configured = [
      { label: 'Plantilla elegida', done: Boolean(createForm.templateKey), hint: 'Base visual y técnica definida.' },
      { label: 'Nombre y token', done: Boolean(createForm.name.trim() && createForm.testingToken.trim()), hint: 'Datos mínimos para operar.' },
      { label: 'Canal listo', done: createForm.status === 'TESTING' || createForm.status === 'ACTIVE', hint: 'Recomendado para demo.' },
    ]

    const demo = [
      { label: 'Demo navegable', done: (createForm.provider !== 'WEB_CHATBOT' && !createIsPublicWebForm) || createForm.publicEmbedEnabled, hint: 'El canal embebible debe poder abrirse en iframe.' },
      { label: 'Fuente visible', done: createForm.provider !== 'WEB_FORM' || Boolean(createForm.formSelector || createForm.bridgeKind), hint: 'Origen del lead definido.' },
      { label: 'Mensaje comercial', done: createForm.provider === 'WEB_CHATBOT' ? Boolean(createForm.chatbotPrompt.trim()) : createIsPublicWebForm ? Boolean(createForm.formTitle.trim() && createForm.submitCtaLabel.trim()) : true, hint: 'Texto presentable para el usuario final.' },
    ]

    const production = [
      { label: 'Estado ACTIVE', done: createForm.status === 'ACTIVE', hint: 'Solo necesario para producción.' },
      { label: 'Restricciones', done: (!createIsPublicWebForm && createForm.provider !== 'WEB_CHATBOT') || !createForm.publicEmbedEnabled || Boolean(createForm.allowedDomains.trim()), hint: 'Dominios permitidos sugeridos.' },
      { label: 'IDs externos', done: !createUsesWebhook || Boolean(createForm.externalAccountId.trim() || createForm.externalPageId.trim()), hint: 'Meta o proveedor identificado.' },
    ]

    return {
      endpointPreview,
      configured,
      demo,
      production,
      iframeUrl: createForm.provider === 'WEB_CHATBOT' ? `${baseUrl || 'https://tu-dominio.com'}/chatbot/<canal-generado>` : createIsPublicWebForm ? `${baseUrl || 'https://tu-dominio.com'}/form/<canal-generado>` : '',
    }
  }, [baseUrl, createForm, createIsPublicWebForm, createUsesWebhook])

  const selectedAssetTabs = useMemo(() => {
    if (!selectedChannel) return ['overview']
    const bridgeKind = selectedBridgeKind
    if (selectedChannel.provider === 'WEB_CHATBOT') return ['overview', 'chatbot', 'bridge']
    if (selectedChannel.provider === 'WEB_FORM' && (bridgeKind === 'GMAIL' || bridgeKind === 'OUTLOOK' || bridgeKind === 'TIKTOK' || bridgeKind === 'YOUTUBE')) {
      return ['overview', 'bridge', 'form']
    }
    if (selectedChannel.provider === 'WEB_FORM') return ['overview', 'form', 'bridge']
    return ['overview', 'webhook', 'bridge']
  }, [selectedBridgeKind, selectedChannel])

  useEffect(() => {
    if (!selectedAssetTabs.includes(activeAssetTab)) {
      setActiveAssetTab(selectedAssetTabs[0] || 'overview')
    }
  }, [activeAssetTab, selectedAssetTabs])

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Integraciones' },
        ]}
        eyebrow="CRM Omnicanal"
        title="Centro de integraciones y captura de leads"
        description="Activa canales, genera scripts para formularios y chatbot, y monta bridges operativos para correo y redes sin duplicar módulos del ERP. Todo termina en leads, conversaciones y oportunidades del CRM existente."
        actions={
          <>
            <Button variant="outline" className="rounded-2xl border-slate-200 bg-white/85" onClick={() => void loadChannels()}>
              Refrescar
            </Button>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/85">
              <Link href="/dashboard/crm/conversations">Abrir bandeja omnicanal</Link>
            </Button>
            <Button className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={openCreateWizard}>
              Nuevo canal
            </Button>
          </>
        }
        stats={[
          { label: 'Canales activos', value: stats.active, hint: 'Producción lista para recibir leads', tone: 'teal' },
          { label: 'Canales en pruebas', value: stats.testing, hint: 'Sandbox, testing y demo controlada', tone: 'amber' },
          { label: 'Capturas registradas', value: stats.captures, hint: 'Leads creados desde integraciones', tone: 'sky' },
          { label: 'Conversaciones vinculadas', value: stats.conversations, hint: 'Hilos generados en el inbox CRM', tone: 'neutral' },
        ]}
      />

      <Tabs value={workspaceView} onValueChange={(value) => setWorkspaceView(value as CrmWorkspaceView)} className="space-y-5">
        <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white/90 p-3 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.34)] md:flex-row md:items-center md:justify-between">
          <TabsList className="grid h-auto grid-cols-2 rounded-[22px] border border-slate-200 bg-slate-50 p-1">
            <TabsTrigger value="operations" className="rounded-[18px] px-5 py-2.5 data-[state=active]:bg-white">Operación</TabsTrigger>
            <TabsTrigger value="metrics" className="rounded-[18px] px-5 py-2.5 data-[state=active]:bg-white">Métricas y metas</TabsTrigger>
          </TabsList>
          <p className="px-2 text-sm text-slate-500">
            {workspaceView === 'operations'
              ? 'Vista compacta para administrar canales, assets y configuraciones sin ocupar espacio extra.'
              : 'Panel ejecutivo para revisar rendimiento y definir objetivos comerciales por canal.'}
          </p>
        </div>

        <TabsContent value="metrics" className="space-y-5">
          <Card className="overflow-hidden rounded-[30px] border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] shadow-[0_28px_80px_-46px_rgba(2,132,199,0.45)]">
            <CardContent className="p-6 md:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Inteligencia omnicanal
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">Métricas, metas y tendencias</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                      Este espacio concentra el tablero ejecutivo. Lo dejamos aparte para que la operación diaria siga ligera y aquí puedas abrir el análisis sólo cuando lo necesites.
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="rounded-2xl border-slate-200 bg-white/85" onClick={() => setMetricsExpanded((current) => !current)}>
                  {metricsExpanded ? 'Colapsar dashboard' : 'Expandir dashboard'}
                </Button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Activación</span>
                    <Target className="h-4 w-4 text-sky-500" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.activationRate}%</p>
                  <p className="mt-1 text-sm text-slate-600">Canales activos o en testing sobre el total.</p>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Producción</span>
                    <Goal className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.productionRate}%</p>
                  <p className="mt-1 text-sm text-slate-600">Canales listos para salir a operación real.</p>
                </div>
                <div className="rounded-[22px] border border-cyan-200 bg-[linear-gradient(135deg,#0f172a,#0b4a6f)] p-4 text-white shadow-[0_24px_50px_-34px_rgba(15,23,42,0.7)]">
                  <div className="flex items-center justify-between text-cyan-100">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Momentum</span>
                    <TrendingUp className="h-4 w-4 text-cyan-300" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold">{formatCompactNumber(stats.captures + stats.conversations)}</p>
                  <p className="mt-1 text-sm text-cyan-50/90">Interacciones totales trazadas desde integraciones.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="rounded-[30px] border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] text-slate-950 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.22)]">
              <CardHeader className="pb-4">
                <CardTitle className="text-slate-950">Metas configurables</CardTitle>
                <CardDescription className="text-slate-600">Puedes sobreescribir los objetivos sugeridos y el progreso se recalcula al instante.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium text-slate-700">Meta de canales operativos</Label>
                    <Input value={goalTargets.operational} onChange={(event) => setGoalTargets((current) => ({ ...current, operational: event.target.value.replace(/[^0-9]/g, '') }))} placeholder={String(channelAnalytics.defaultTargets.operational)} className="rounded-2xl border-slate-300 bg-white text-slate-950 placeholder:text-slate-500" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium text-slate-700">Meta de capturas</Label>
                    <Input value={goalTargets.captures} onChange={(event) => setGoalTargets((current) => ({ ...current, captures: event.target.value.replace(/[^0-9]/g, '') }))} placeholder={String(channelAnalytics.defaultTargets.captures)} className="rounded-2xl border-slate-300 bg-white text-slate-950 placeholder:text-slate-500" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium text-slate-700">Meta de conversaciones</Label>
                    <Input value={goalTargets.conversations} onChange={(event) => setGoalTargets((current) => ({ ...current, conversations: event.target.value.replace(/[^0-9]/g, '') }))} placeholder={String(channelAnalytics.defaultTargets.conversations)} className="rounded-2xl border-slate-300 bg-white text-slate-950 placeholder:text-slate-500" />
                  </div>
                </div>

                <div className="space-y-4">
                  {channelAnalytics.goals.map((goal) => {
                    const Icon = goal.icon
                    return (
                      <div key={goal.label} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-950">{goal.label}</p>
                            <p className="text-sm text-slate-600">{goal.caption}</p>
                          </div>
                          <div className={`rounded-2xl bg-gradient-to-br ${goal.accent} p-3 text-white shadow-lg`}>
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="mt-4 flex items-end justify-between gap-3">
                          <div>
                            <p className="text-2xl font-semibold text-slate-950">{formatCompactNumber(goal.value)}</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Meta {formatCompactNumber(goal.target)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-semibold text-slate-950">{goal.progress}%</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Cumplido</p>
                          </div>
                        </div>
                        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
                          <div className={`h-full rounded-full bg-gradient-to-r ${goal.accent} transition-all duration-700`} style={{ width: `${goal.progress}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-5">
              {metricsExpanded ? (
                <>
                  <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                    <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
                      <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <CardTitle>Canales con mayor impacto</CardTitle>
                          <CardDescription>Comparativo de capturas y conversaciones por canal en la capa comercial.</CardDescription>
                        </div>
                        <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                          Top {Math.max(1, channelAnalytics.performance.length)}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 md:p-6">
                        <div className="h-[340px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={channelAnalytics.performance} barGap={10}>
                              <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" vertical={false} />
                              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                              <Tooltip
                                cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null
                                  const item = payload[0]?.payload as { fullName: string; provider: string; captures: number; conversations: number } | undefined
                                  if (!item) return null
                                  return (
                                    <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl">
                                      <p className="text-sm font-semibold text-slate-950">{item.fullName}</p>
                                      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.provider}</p>
                                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                                        <p>Capturas: <span className="font-semibold text-slate-950">{item.captures}</span></p>
                                        <p>Conversaciones: <span className="font-semibold text-slate-950">{item.conversations}</span></p>
                                      </div>
                                    </div>
                                  )
                                }}
                              />
                              <Bar dataKey="captures" name="Capturas" radius={[10, 10, 0, 0]} fill="#0ea5e9" />
                              <Bar dataKey="conversations" name="Conversaciones" radius={[10, 10, 0, 0]} fill="#0f172a" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {channelAnalytics.performance.length === 0 ? (
                          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                            Crea canales para empezar a ver comparativos de rendimiento en tiempo real.
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
                      <CardHeader className="border-b border-slate-100 pb-5">
                        <CardTitle>Mix de canales</CardTitle>
                        <CardDescription>Distribución por origen para detectar concentración y diversificación del stack.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 p-4 md:p-6">
                        <div className="h-[260px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={channelAnalytics.distribution.length > 0 ? channelAnalytics.distribution : [{ label: 'Sin canales', value: 1, color: '#cbd5e1' }]}
                                dataKey="value"
                                nameKey="label"
                                innerRadius={62}
                                outerRadius={92}
                                paddingAngle={4}
                                stroke="none"
                              >
                                {(channelAnalytics.distribution.length > 0 ? channelAnalytics.distribution : [{ label: 'Sin canales', value: 1, color: '#cbd5e1' }]).map((entry) => (
                                  <Cell key={entry.label} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload?.length) return null
                                  const item = payload[0]?.payload as { label: string; value: number } | undefined
                                  if (!item) return null
                                  return (
                                    <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl">
                                      <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                                      <p className="text-sm text-slate-600">{item.value} canal(es)</p>
                                    </div>
                                  )
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-3">
                          {(channelAnalytics.distribution.length > 0 ? channelAnalytics.distribution : [{ label: 'Sin canales', value: 0, color: '#cbd5e1' }]).map((entry) => (
                            <div key={entry.label} className="flex items-center justify-between rounded-[20px] border border-slate-100 bg-slate-50/80 px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-sm font-medium text-slate-700">{entry.label}</span>
                              </div>
                              <span className="text-sm font-semibold text-slate-950">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
                    <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <CardTitle>Ritmo de actividad por mes</CardTitle>
                        <CardDescription>Lectura temporal con base en última actividad o actualización de cada canal.</CardDescription>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        Últimos 6 meses
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6">
                      <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={channelAnalytics.timeline}>
                            <defs>
                              <linearGradient id="crmCapturesGradient" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.95} />
                                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.2} />
                              </linearGradient>
                              <linearGradient id="crmConversationsGradient" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#f97316" stopOpacity={0.95} />
                                <stop offset="100%" stopColor="#f97316" stopOpacity={0.2} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                            <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                const captures = Number(payload.find((item) => item.dataKey === 'captures')?.value ?? 0)
                                const conversations = Number(payload.find((item) => item.dataKey === 'conversations')?.value ?? 0)
                                const channelsInMonth = Number((payload[0]?.payload as { channels?: number } | undefined)?.channels ?? 0)
                                return (
                                  <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl">
                                    <p className="text-sm font-semibold text-slate-950">{label}</p>
                                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                                      <p>Capturas: <span className="font-semibold text-slate-950">{captures}</span></p>
                                      <p>Conversaciones: <span className="font-semibold text-slate-950">{conversations}</span></p>
                                      <p>Canales con actividad: <span className="font-semibold text-slate-950">{channelsInMonth}</span></p>
                                    </div>
                                  </div>
                                )
                              }}
                            />
                            <Line type="monotone" dataKey="captures" name="Capturas" stroke="url(#crmCapturesGradient)" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9' }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="conversations" name="Conversaciones" stroke="url(#crmConversationsGradient)" strokeWidth={3} dot={{ r: 4, fill: '#f97316' }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
                  <CardHeader>
                    <CardTitle className="text-slate-950">Dashboard colapsado</CardTitle>
                    <CardDescription className="text-slate-600">Expándelo cuando quieras revisar gráficos, tendencias y distribución por canal.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Configurados</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.configured}</p>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Demo-ready</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.demo}</p>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Go-live</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.production}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      <TabsContent value="operations" className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle>Canales configurados</CardTitle>
            <CardDescription>Selecciona un canal para ver assets, webhooks y bridges listos para copiar.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[72vh] space-y-3 overflow-y-auto p-4 md:p-5 xl:max-h-[calc(100vh-19rem)]">
            {loading ? <p className="text-sm text-muted-foreground">Cargando canales...</p> : null}
            {!loading && channels.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-500">
                Aún no hay canales. Crea uno desde plantilla y el CRM quedará listo para demo inmediata.
              </div>
            ) : null}

            {channels.map((channel) => {
              const isActive = channel.id === selectedChannelId
              const settings = (channel.settingsJson as Record<string, unknown> | null | undefined) ?? null
              const bridgeKind = getBridgeKind(settings)
              const providerLabel = getChannelProviderLabel(channel.provider, bridgeKind)

              return (
                <div
                  key={channel.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedChannelId(channel.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedChannelId(channel.id)
                    }
                  }}
                  className={isActive ? `w-full cursor-pointer rounded-[26px] border p-4 text-left shadow-sm ring-2 ring-sky-300 ${channelTone(channel.provider, bridgeKind)}` : `w-full cursor-pointer rounded-[26px] border p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md ${channelTone(channel.provider, bridgeKind)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{providerLabel}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">{channel.name}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{providerSummary(channel.provider, bridgeKind as CrmBridgeKind)}</p>
                    </div>
                    <span className="rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{channel.status}</span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Capturas</span>
                      <span className="font-semibold text-slate-900">{channel._count?.captures ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Conversaciones</span>
                      <span className="font-semibold text-slate-900">{channel._count?.conversations ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Último webhook</span>
                      <span className="font-medium text-slate-900">{formatDate(channel.lastWebhookAt)}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="grid gap-1.5">
                      <Label className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Estado</Label>
                      <Select value={channel.status} onValueChange={(value) => void updateChannelStatus(channel.id, value as ChannelStatus)} disabled={updatingChannelId === channel.id}>
                        <SelectTrigger className="h-10 rounded-xl border-white/70 bg-white/90"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHANNEL_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl border-white/70 bg-white/90"
                      onClick={(event) => {
                        event.stopPropagation()
                        void copyText(`endpoint-${channel.id}`, getEndpoint(baseUrl, channel))
                      }}
                    >
                      {copiedKey === `endpoint-${channel.id}` ? 'Copiado' : 'Copiar endpoint'}
                    </Button>
                  </div>

                  {channel.lastErrorMessage ? (
                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs text-rose-700">
                      {channel.lastErrorMessage}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {selectedChannel ? (
            <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
              <CardHeader className="border-b border-slate-100 pb-4">
                <CardTitle>Vista previa del canal</CardTitle>
                <CardDescription>Resumen ejecutivo, readiness y accesos rápidos del canal seleccionado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-4 md:p-5">
                <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className={`rounded-[26px] border p-5 ${channelTone(selectedChannel.provider, selectedBridgeKind)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{getChannelProviderLabel(selectedChannel.provider, selectedBridgeKind)}</p>
                        <h3 className="mt-2 text-2xl font-semibold text-slate-950">{selectedChannel.name}</h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{providerSummary(selectedChannel.provider, selectedBridgeKind as CrmBridgeKind)}</p>
                      </div>
                      <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{selectedChannel.status}</span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/70 bg-white/85 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Capturas</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{selectedChannel._count?.captures ?? 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/85 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Conversaciones</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{selectedChannel._count?.conversations ?? 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/85 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Último webhook</p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">{formatDate(selectedChannel.lastWebhookAt)}</p>
                      </div>
                    </div>

                    {selectedChannel.provider === 'WEB_CHATBOT' && selectedChatbotEmbedUrl ? (
                      <div className="mt-5 rounded-2xl border border-emerald-200 bg-white/85 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Preview del chatbot real</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">Este preview representa el iframe y el launcher con la configuración actual del canal.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button className="rounded-xl" onClick={() => setChatbotBuilderModalOpen(true)}>
                              Editar constructor
                            </Button>
                            <Button className="rounded-xl" variant="outline" onClick={() => void copyText('preview-chatbot-url', selectedChatbotEmbedUrl)}>
                              {copiedKey === 'preview-chatbot-url' ? 'Copiado' : 'Copiar URL'}
                            </Button>
                            <Button asChild className="rounded-xl" variant="outline"><Link href={selectedChatbotEmbedUrl}>Abrir demo</Link></Button>
                          </div>
                        </div>
                        <div className="mt-4">
                          {renderChatbotPreview(chatbotBuilderDraft, { mode: 'expanded', viewport: 'desktop', minHeight: 360 })}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button className="rounded-xl" variant="outline" onClick={() => void copyText('preview-chatbot-iframe', snippets?.chatbotIframe || '')}>
                            {copiedKey === 'preview-chatbot-iframe' ? 'Copiado' : 'Copiar iframe'}
                          </Button>
                          <Button asChild className="rounded-xl" variant="outline"><Link href="/dashboard/crm/chatbot">Ver panel chatbot</Link></Button>
                        </div>
                      </div>
                    ) : null}

                    {selectedIsPublicWebForm && selectedWebFormEmbedUrl ? (
                      <div className="mt-5 rounded-2xl border border-sky-200 bg-white/85 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Preview del formulario web real</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">Este preview se construye con la configuración actual del canal y refleja cómo se verá el iframe embebido.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button className="rounded-xl" onClick={() => setWebFormBuilderModalOpen(true)}>
                              Editar constructor
                            </Button>
                            <Button className="rounded-xl" variant="outline" onClick={() => void copyText('preview-web-form-url', selectedWebFormEmbedUrl)}>
                              {copiedKey === 'preview-web-form-url' ? 'Copiado' : 'Copiar URL'}
                            </Button>
                            <Button asChild className="rounded-xl" variant="outline"><Link href={selectedWebFormEmbedUrl}>Abrir demo</Link></Button>
                          </div>
                        </div>
                        <div className="mt-4">
                          {renderWebFormPreview(webFormBuilderDraft)}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Checklist de readiness</p>
                      {selectedReadiness ? (
                        <div className="mt-4 space-y-4">
                          {[
                            { title: 'Configurado', items: selectedReadiness.configured },
                            { title: 'Listo para demo', items: selectedReadiness.demo },
                            { title: 'Listo para producción', items: selectedReadiness.production },
                          ].map((group) => (
                            <div key={group.title} className="space-y-2">
                              <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                              {group.items.map((item) => (
                                <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                                  <span className={item.done ? 'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700' : 'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700'}>{item.done ? 'OK' : '!'}</span>
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">{item.label}</p>
                                    <p className="text-xs leading-5 text-slate-500">{item.hint}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Gestión del canal</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => openEditWizard(selectedChannel)}>
                          Editar canal
                        </Button>
                        <Button variant="outline" className="rounded-xl" onClick={() => void copyText('selected-endpoint', endpoint)}>
                          {copiedKey === 'selected-endpoint' ? 'Copiado' : 'Copiar endpoint'}
                        </Button>
                        {selectedChannel.provider === 'WEB_CHATBOT' ? <Button asChild variant="outline" className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"><Link href="/dashboard/crm/chatbot">Panel chatbot</Link></Button> : null}
                        {selectedChannel.provider === 'WEB_CHATBOT' && selectedChatbotEmbedUrl ? <Button asChild variant="outline" className="rounded-xl"><Link href={selectedChatbotEmbedUrl}>Ver iframe</Link></Button> : null}
                        {usesMetaProvider(selectedChannel.provider) ? <Button asChild variant="outline" className="rounded-xl border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"><Link href={`/api/crm/channels/${selectedChannel.id}/meta/connect`}>{selectedMeta.hasConnection ? 'Reconectar Meta' : 'Conectar con Meta'}</Link></Button> : null}
                        {usesMetaProvider(selectedChannel.provider) ? <Button variant="outline" className="rounded-xl" onClick={() => void syncMeta(selectedChannel.id)} disabled={updatingChannelId === selectedChannel.id || !selectedMeta.hasConnection}>{updatingChannelId === selectedChannel.id ? 'Sincronizando...' : 'Sincronizar Meta'}</Button> : null}
                        {usesMetaProvider(selectedChannel.provider) ? <Button variant="outline" className="rounded-xl border-amber-200 text-amber-800 hover:bg-amber-50" onClick={() => void disconnectMeta(selectedChannel.id)} disabled={updatingChannelId === selectedChannel.id || !selectedMeta.hasConnection}>Desconectar Meta</Button> : null}
                        <Button variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setDeleteCandidate(selectedChannel)} disabled={deletingChannelId === selectedChannel.id}>
                          {deletingChannelId === selectedChannel.id ? 'Eliminando...' : 'Eliminar canal'}
                        </Button>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">Solo se eliminan canales sin conversaciones ni capturas. Si ya hubo actividad, deben desactivarse.</p>
                    </div>

                    {usesMetaProvider(selectedChannel.provider) ? (
                      <div className="rounded-[26px] border border-sky-200 bg-sky-50/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Conexión real con Meta</p>
                        {selectedMeta.hasConnection ? (
                          <div className="mt-4 space-y-3 text-sm text-slate-700">
                            <p><span className="font-semibold text-slate-900">Cuenta conectada:</span> {selectedMeta.connectedUserName || 'Meta conectada'}</p>
                            <p><span className="font-semibold text-slate-900">Conectado:</span> {formatDate(selectedMeta.connectedAt)}</p>
                            <p><span className="font-semibold text-slate-900">Última sincronización:</span> {formatDate(selectedMeta.lastSyncAt)}</p>
                            <p><span className="font-semibold text-slate-900">Expira token:</span> {formatDate(selectedMeta.tokenExpiresAt)}</p>
                            {selectedChannel.provider === 'WHATSAPP_CLOUD' || selectedChannel.provider === 'WHATSAPP_SANDBOX' ? (
                              <div className="grid gap-2 rounded-2xl border border-sky-200 bg-white/70 p-3">
                                <Label>Número sincronizado</Label>
                                <Select value={metaSelectionDraft.selectedPhoneNumberId || '__none__'} onValueChange={(value) => setMetaSelectionDraft((current) => ({ ...current, selectedPhoneNumberId: value === '__none__' ? '' : value }))}>
                                  <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Selecciona un número</SelectItem>
                                    {selectedMeta.whatsappAssets.map((item) => (
                                      <SelectItem key={item.phoneNumberId} value={item.phoneNumberId}>
                                        {item.displayPhoneNumber || item.phoneNumberId} · {item.wabaName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button className="rounded-xl" variant="outline" onClick={() => void applyMetaSelection(selectedChannel)} disabled={updatingChannelId === selectedChannel.id || !metaSelectionDraft.selectedPhoneNumberId}>
                                  Aplicar número activo
                                </Button>
                              </div>
                            ) : null}
                            {selectedChannel.provider === 'FACEBOOK_PAGE' || selectedChannel.provider === 'MESSENGER' ? (
                              <div className="grid gap-2 rounded-2xl border border-sky-200 bg-white/70 p-3">
                                <Label>Página sincronizada</Label>
                                <Select value={metaSelectionDraft.selectedPageId || '__none__'} onValueChange={(value) => setMetaSelectionDraft((current) => ({ ...current, selectedPageId: value === '__none__' ? '' : value }))}>
                                  <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Selecciona una página</SelectItem>
                                    {selectedMeta.pages.map((item) => (
                                      <SelectItem key={item.pageId} value={item.pageId}>{item.pageName}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button className="rounded-xl" variant="outline" onClick={() => void applyMetaSelection(selectedChannel)} disabled={updatingChannelId === selectedChannel.id || !metaSelectionDraft.selectedPageId}>
                                  Aplicar página activa
                                </Button>
                              </div>
                            ) : null}
                            {selectedChannel.provider === 'INSTAGRAM_DM' ? (
                              <div className="grid gap-2 rounded-2xl border border-sky-200 bg-white/70 p-3">
                                <Label>Cuenta de Instagram sincronizada</Label>
                                <Select value={metaSelectionDraft.selectedInstagramAccountId || '__none__'} onValueChange={(value) => {
                                  const nextValue = value === '__none__' ? '' : value
                                  const relatedPage = selectedMeta.pages.find((item) => item.instagramAccountId === nextValue)
                                  setMetaSelectionDraft((current) => ({
                                    ...current,
                                    selectedInstagramAccountId: nextValue,
                                    selectedPageId: relatedPage?.pageId || current.selectedPageId,
                                  }))
                                }}>
                                  <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Selecciona una cuenta</SelectItem>
                                    {selectedMeta.pages.filter((item) => item.instagramAccountId).map((item) => (
                                      <SelectItem key={item.instagramAccountId} value={item.instagramAccountId || item.pageId}>
                                        @{item.instagramUsername || item.instagramName || item.instagramAccountId}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button className="rounded-xl" variant="outline" onClick={() => void applyMetaSelection(selectedChannel)} disabled={updatingChannelId === selectedChannel.id || !metaSelectionDraft.selectedInstagramAccountId}>
                                  Aplicar cuenta activa
                                </Button>
                              </div>
                            ) : null}
                            {selectedChannel.provider === 'WHATSAPP_CLOUD' || selectedChannel.provider === 'WHATSAPP_SANDBOX' ? (
                              <p><span className="font-semibold text-slate-900">Número activo:</span> {selectedMeta.whatsappAssets.find((item) => item.phoneNumberId === selectedChannel.externalPhoneNumberId)?.displayPhoneNumber || selectedChannel.externalPhoneNumberId || 'Sin número asociado'}</p>
                            ) : null}
                            {selectedChannel.provider === 'FACEBOOK_PAGE' || selectedChannel.provider === 'MESSENGER' ? (
                              <p><span className="font-semibold text-slate-900">Página activa:</span> {selectedMeta.pages.find((item) => item.pageId === selectedChannel.externalPageId)?.pageName || selectedChannel.externalPageId || 'Sin página asociada'}</p>
                            ) : null}
                            {selectedChannel.provider === 'INSTAGRAM_DM' ? (
                              <p><span className="font-semibold text-slate-900">Instagram activo:</span> {selectedMeta.pages.find((item) => item.instagramAccountId === selectedChannel.externalAccountId)?.instagramUsername || selectedChannel.externalAccountId || 'Sin cuenta asociada'}</p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-slate-700">Este canal ya puede enlazarse con Meta usando OAuth real desde el CRM. Al conectar, el sistema sincroniza páginas, cuentas de Instagram y assets de WhatsApp para dejar el canal operativo con IDs reales.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle>Studio de assets</CardTitle>
              <CardDescription>
                {selectedChannel
                  ? `Canal activo: ${selectedChannel.name}. Desde aquí copias scripts, payloads, tokens y URLs para formularios, chatbot, correo y social.`
                  : 'Selecciona un canal para ver el setup operativo.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              {!selectedChannel || !snippets ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
                  Elige un canal a la izquierda. El sistema te mostrará automáticamente el endpoint correcto, el token de pruebas y los scripts listos para pegar.
                </div>
              ) : (
                <Tabs value={activeAssetTab} onValueChange={setActiveAssetTab} className="space-y-4">
                  <div className="overflow-x-auto pb-1">
                    <TabsList className="inline-flex h-auto min-w-max flex-nowrap rounded-2xl border border-slate-200 bg-slate-50 p-1 md:flex-wrap">
                    {selectedAssetTabs.includes('overview') ? <TabsTrigger value="overview" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Resumen</TabsTrigger> : null}
                    {selectedAssetTabs.includes('form') ? <TabsTrigger value="form" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Formulario</TabsTrigger> : null}
                    {selectedAssetTabs.includes('chatbot') ? <TabsTrigger value="chatbot" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Chatbot</TabsTrigger> : null}
                    {selectedAssetTabs.includes('webhook') ? <TabsTrigger value="webhook" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Webhook social</TabsTrigger> : null}
                    {selectedAssetTabs.includes('bridge') ? <TabsTrigger value="bridge" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Bridges</TabsTrigger> : null}
                    </TabsList>
                  </div>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Endpoint</p>
                        <p className="mt-2 break-all text-sm font-medium text-slate-900">{endpoint}</p>
                        <Button variant="outline" className="mt-3 rounded-xl" onClick={() => void copyText('endpoint-main', endpoint)}>
                          {copiedKey === 'endpoint-main' ? 'Copiado' : 'Copiar endpoint'}
                        </Button>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Token demo</p>
                        <p className="mt-2 break-all text-sm font-medium text-slate-900">{selectedToken || selectedChannel.verifyTokenPreview || 'Configura testingToken en el canal'}</p>
                        <Button variant="outline" className="mt-3 rounded-xl" onClick={() => void copyText('token-main', selectedToken)} disabled={!selectedToken}>
                          {copiedKey === 'token-main' ? 'Copiado' : 'Copiar token'}
                        </Button>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Destino operativo</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">Leads, conversaciones y oportunidades del CRM existente</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button asChild variant="outline" className="rounded-xl"><Link href="/dashboard/crm">Ver pipeline</Link></Button>
                          <Button asChild variant="outline" className="rounded-xl"><Link href="/dashboard/crm/conversations">Abrir inbox</Link></Button>
                          {selectedChannel.provider === 'WEB_CHATBOT' && selectedChatbotEmbedUrl ? <Button asChild variant="outline" className="rounded-xl"><Link href={selectedChatbotEmbedUrl}>Abrir demo iframe</Link></Button> : null}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                        <p className="font-semibold">Google / Outlook</p>
                        <p className="mt-2 leading-6">Quedaron listos como bridge demo sin duplicar módulos. El correo llega a una automatización externa, y esa automatización empuja el prospecto al endpoint del CRM usando este mismo canal.</p>
                      </div>
                      <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-900">
                        <p className="font-semibold">Meta / WhatsApp / Instagram</p>
                        <p className="mt-2 leading-6">Ahora puedes conectar Meta directamente desde el CRM por OAuth real, elegir el activo exacto del canal y operar WhatsApp, Messenger e Instagram sobre el mismo inbox comercial.</p>
                      </div>
                    </div>

                    {selectedChannel.provider === 'WEB_CHATBOT' ? (
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                          <p className="font-semibold">Iframe público</p>
                          <p className="mt-2 leading-6">{getPublicEmbedEnabled(selectedSettings) ? 'Habilitado para una demo controlada sin token en el frontend.' : 'Deshabilitado. Este canal sigue protegido por token.'}</p>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Asistente visible</p>
                          <p className="mt-2 leading-6">{getAssistantName(selectedSettings)} con color {getAccentColor(selectedSettings)} y fondo {getBackgroundColor(selectedSettings)}.</p>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Launcher flotante</p>
                          <p className="mt-2 leading-6">{getFloatingLauncherEnabled(selectedSettings) ? `Activo con etiqueta ${getLauncherLabel(selectedSettings)}.` : 'Desactivado desde configuración.'}</p>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Dominios previstos</p>
                          <p className="mt-2 leading-6">{getAllowedDomains(selectedSettings) || 'Sin restricción declarada todavía para la demo.'}</p>
                        </div>
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="form" className="space-y-4">
                    <ErpSectionHeading title="Formulario web embebible" description="Modo recomendado: URL pública e iframe listo para pegar, con fallback legacy por selector." />
                    {selectedIsPublicWebForm ? (
                      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                        <Card className="rounded-3xl border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fbff)]">
                          <CardHeader>
                            <CardTitle className="text-base">Constructor visual en modal</CardTitle>
                            <CardDescription>Abre un espacio dedicado para editar el formulario sin perderte en la pantalla principal. Cada cambio se refleja en tiempo real.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-sm font-semibold text-slate-900">Qué vas a editar</p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">Texto comercial, colores, radios, espaciados, campos visibles, labels, placeholders y dominios del iframe.</p>
                            </div>
                            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Campos activos</p>
                                <p className="mt-2 font-medium text-slate-900">{[
                                  webFormBuilderDraft.showNameField && 'Nombre',
                                  webFormBuilderDraft.showEmailField && 'Correo',
                                  webFormBuilderDraft.showPhoneField && 'Teléfono',
                                  webFormBuilderDraft.showCompanyField && 'Empresa',
                                  webFormBuilderDraft.showCityField && 'Ciudad',
                                  webFormBuilderDraft.showProductField && 'Producto',
                                  webFormBuilderDraft.showMessageField && 'Mensaje',
                                ].filter(Boolean).join(' · ') || 'Sin campos visibles'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Presentación</p>
                                <p className="mt-2 font-medium text-slate-900">{normalizePixelValue(webFormBuilderDraft.formFontSize, '14')}px · radio {normalizePixelValue(webFormBuilderDraft.formInputRadius, '16')}px · gap {normalizePixelValue(webFormBuilderDraft.formFieldSpacing, '14')}px</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button className="rounded-xl" onClick={() => setWebFormBuilderModalOpen(true)}>
                                Abrir editor del formulario
                              </Button>
                              <Button variant="outline" className="rounded-xl" onClick={() => void copyText('form-builder-url', selectedWebFormEmbedUrl || snippets.webFormEmbedUrl)}>
                                {copiedKey === 'form-builder-url' ? 'Copiado' : 'Copiar URL pública'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="rounded-3xl border-sky-200 bg-sky-50/40">
                          <CardHeader>
                            <CardTitle className="text-base">Preview del canal</CardTitle>
                            <CardDescription>Vista rápida del iframe actual. Para editar, usa el modal dedicado.</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {renderWebFormPreview(webFormBuilderDraft, { maxWidthClassName: 'max-w-xl', outerPaddingClassName: 'p-4', titleClassName: 'text-lg', messageMinHeight: 112 })}
                          </CardContent>
                        </Card>
                      </div>
                    ) : null}
                    {selectedBridgeKind === 'GENERIC' ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="rounded-3xl border-slate-200">
                          <CardHeader>
                            <CardTitle className="text-base">URL pública del formulario</CardTitle>
                            <CardDescription>Ábrela directamente o úsala como fuente del iframe.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Textarea value={selectedWebFormEmbedUrl || snippets.webFormEmbedUrl} readOnly rows={3} className="font-mono text-xs" />
                            <div className="flex flex-wrap gap-2">
                              <Button className="rounded-xl" onClick={() => void copyText('form-url', selectedWebFormEmbedUrl || snippets.webFormEmbedUrl)}>
                                {copiedKey === 'form-url' ? 'Copiado' : 'Copiar URL'}
                              </Button>
                              <Button asChild variant="outline" className="rounded-xl">
                                <Link href={selectedWebFormEmbedUrl || snippets.webFormEmbedUrl}>Abrir demo</Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="rounded-3xl border-slate-200">
                          <CardHeader>
                            <CardTitle className="text-base">Iframe listo para pegar</CardTitle>
                            <CardDescription>Embed recomendado para integrarlo en cualquier sitio web.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Textarea value={snippets.webFormIframe} readOnly rows={9} className="font-mono text-xs" />
                            <Button className="rounded-xl" onClick={() => void copyText('snippet-web-form-iframe', snippets.webFormIframe)}>
                              {copiedKey === 'snippet-web-form-iframe' ? 'Iframe copiado' : 'Copiar iframe'}
                            </Button>
                          </CardContent>
                        </Card>
                        <Card className="rounded-3xl border-slate-200 lg:col-span-2">
                          <CardHeader>
                            <CardTitle className="text-base">Snippet legacy por selector</CardTitle>
                            <CardDescription>Úsalo si el cliente ya tiene su propio formulario en el DOM.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Textarea value={snippets.webForm} readOnly rows={16} className="font-mono text-xs" />
                            <div className="flex flex-wrap gap-2">
                              <Button className="rounded-xl" onClick={() => void copyText('snippet-web-form', snippets.webForm)}>
                                {copiedKey === 'snippet-web-form' ? 'Snippet copiado' : 'Copiar snippet'}
                              </Button>
                              <Button variant="outline" className="rounded-xl" onClick={() => void copyText('token-form', selectedToken)} disabled={!selectedToken}>
                                Copiar token
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <Card className="rounded-3xl border-slate-200">
                        <CardHeader>
                          <CardTitle className="text-base">Snippet para integración manual</CardTitle>
                          <CardDescription>Este canal usa bridge externo y no expone formulario público por iframe.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Textarea value={snippets.webForm} readOnly rows={18} className="font-mono text-xs" />
                          <div className="flex flex-wrap gap-2">
                            <Button className="rounded-xl" onClick={() => void copyText('snippet-web-form', snippets.webForm)}>
                              {copiedKey === 'snippet-web-form' ? 'Snippet copiado' : 'Copiar snippet'}
                            </Button>
                            <Button variant="outline" className="rounded-xl" onClick={() => void copyText('token-form', selectedToken)} disabled={!selectedToken}>
                              Copiar token
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="chatbot" className="space-y-4">
                    <ErpSectionHeading title="Chatbot embebible por iframe" description="Demo funcional para insertar en un sitio web y ver mensajes entrar al inbox del CRM casi en tiempo real." />
                    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                      <Card className="rounded-3xl border-slate-200 bg-[linear-gradient(180deg,#fff,#f6fffb)]">
                        <CardHeader>
                          <CardTitle className="text-base">Constructor visual en modal</CardTitle>
                          <CardDescription>Abre un editor dedicado para ajustar el chatbot sin perder el contexto de integración.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-semibold text-slate-900">Qué vas a editar</p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">Título, nombre del asistente, prompt, colores, launcher, dominios, radios, sombra y campos iniciales del composer.</p>
                          </div>
                          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Asistente</p>
                              <p className="mt-2 font-medium text-slate-900">{chatbotBuilderDraft.assistantName} · {chatbotBuilderDraft.statusBadgeLabel}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Launcher</p>
                              <p className="mt-2 font-medium text-slate-900">{chatbotBuilderDraft.floatingLauncherEnabled ? `${chatbotBuilderDraft.launcherPosition} · ${chatbotBuilderDraft.launcherSize}` : 'Desactivado'}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button className="rounded-xl" onClick={() => setChatbotBuilderModalOpen(true)}>
                              Abrir editor del chatbot
                            </Button>
                            <Button variant="outline" className="rounded-xl" onClick={() => void copyText('chatbot-builder-url', snippets.chatbotEmbedUrl)}>
                              {copiedKey === 'chatbot-builder-url' ? 'Copiado' : 'Copiar URL pública'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="rounded-3xl border-emerald-200 bg-emerald-50/40">
                        <CardHeader>
                          <CardTitle className="text-base">Preview del canal</CardTitle>
                          <CardDescription>Vista rápida del iframe actual. Para editar, usa el modal dedicado.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {renderChatbotPreview(chatbotBuilderDraft, { mode: 'expanded', viewport: 'desktop', minHeight: 360 })}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card className="rounded-3xl border-slate-200">
                        <CardHeader>
                          <CardTitle className="text-base">URL publica del chatbot</CardTitle>
                          <CardDescription>Usa esta ruta en un iframe o abrela directa para demo guiada.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Textarea value={snippets.chatbotEmbedUrl} readOnly rows={3} className="font-mono text-xs" />
                          <div className="flex flex-wrap gap-2">
                            <Button className="rounded-xl" onClick={() => void copyText('chatbot-url', snippets.chatbotEmbedUrl)}>
                              {copiedKey === 'chatbot-url' ? 'Copiado' : 'Copiar URL'}
                            </Button>
                            <Button asChild variant="outline" className="rounded-xl">
                              <Link href={snippets.chatbotEmbedUrl}>Abrir demo</Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="rounded-3xl border-slate-200">
                        <CardHeader>
                          <CardTitle className="text-base">Iframe listo para pegar</CardTitle>
                          <CardDescription>Snippet recomendado para la página web del cliente.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Textarea value={snippets.chatbotIframe} readOnly rows={10} className="font-mono text-xs" />
                          <Button className="rounded-xl" onClick={() => void copyText('snippet-chatbot-iframe', snippets.chatbotIframe)}>
                            {copiedKey === 'snippet-chatbot-iframe' ? 'Snippet copiado' : 'Copiar iframe'}
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="rounded-3xl border-slate-200">
                      <CardHeader>
                        <CardTitle className="text-base">Widget flotante alternativo</CardTitle>
                        <CardDescription>Opción secundaria si el cliente prefiere botón flotante en lugar de iframe.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#ffffff)] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Preview del launcher</p>
                              <p className="text-xs leading-5 text-slate-500">Simula la entrada del icono y el despliegue del panel flotante.</p>
                            </div>
                            <Button variant="outline" className="rounded-xl" onClick={() => setFloatingPreviewOpen((current) => !current)} disabled={!getFloatingLauncherEnabled(selectedSettings)}>
                              {floatingPreviewOpen ? 'Cerrar preview' : 'Abrir preview'}
                            </Button>
                          </div>
                          <div className="relative mt-4 min-h-[260px] overflow-hidden rounded-[24px] border border-slate-200 p-4" style={{ backgroundColor: getPageBackgroundColor(selectedSettings) }}>
                            <div className={floatingPreviewOpen ? 'absolute inset-0 bg-slate-950/10 backdrop-blur-[2px] transition-opacity duration-300 opacity-100' : 'absolute inset-0 bg-slate-950/10 backdrop-blur-[2px] transition-opacity duration-300 opacity-0 pointer-events-none'} />
                            <div className={floatingPreviewOpen ? 'absolute bottom-24 right-4 w-[280px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_-30px_rgba(15,23,42,.45)] transition-all duration-300 ease-out opacity-100 translate-y-0 scale-100' : 'absolute bottom-24 right-4 w-[280px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_-30px_rgba(15,23,42,.45)] transition-all duration-300 ease-out opacity-0 translate-y-4 scale-95 pointer-events-none'}>
                              <div className="flex items-center justify-between px-4 py-3 text-white" style={{ background: `linear-gradient(135deg, #0f172a, ${getAccentColor(selectedSettings)})` }}>
                                <div>
                                  <p className="text-sm font-semibold">{selectedChatbotTitle}</p>
                                  <p className="text-[11px] text-white/80">{selectedChatbotAssistant}</p>
                                </div>
                                <button type="button" className="rounded-full bg-white/15 px-2 py-1 text-xs">×</button>
                              </div>
                              <div className="space-y-3 p-4" style={{ backgroundColor: getBackgroundColor(selectedSettings) }}>
                                <div className="max-w-[82%] rounded-2xl rounded-tl-md bg-white px-3 py-2 text-xs text-slate-700 shadow-sm">
                                  Hola. Soy {selectedChatbotAssistant}. Te puedo ayudar con tu cotización.
                                </div>
                                <div className="ml-auto max-w-[74%] rounded-2xl rounded-tr-md px-3 py-2 text-xs text-white shadow-sm" style={{ backgroundColor: getAccentColor(selectedSettings) }}>
                                  Quiero información de un producto.
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className={floatingPreviewOpen ? 'absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,.22)] transition-all duration-300 ease-out translate-y-0 scale-100' : 'absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,.22)] transition-all duration-500 ease-out translate-y-0 scale-100'}
                              style={{ backgroundColor: getAccentColor(selectedSettings) }}
                              onClick={() => setFloatingPreviewOpen((current) => !current)}
                              disabled={!getFloatingLauncherEnabled(selectedSettings)}
                            >
                              <span>{getLauncherPreviewIcon(getLauncherIcon(selectedSettings))}</span>
                              <span>{getLauncherLabel(selectedSettings)}</span>
                            </button>
                          </div>
                        </div>
                        <Textarea value={getFloatingLauncherEnabled(selectedSettings) ? snippets.chatbot : 'Launcher flotante desactivado en la configuración del canal.'} readOnly rows={18} className="font-mono text-xs" />
                        <Button className="rounded-xl" onClick={() => void copyText('snippet-chatbot', snippets.chatbot)} disabled={!getFloatingLauncherEnabled(selectedSettings)}>
                          {copiedKey === 'snippet-chatbot' ? 'Snippet copiado' : 'Copiar widget'}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="webhook" className="space-y-4">
                    <ErpSectionHeading title="Webhook para social y mensajería" description="Usa esta URL en Meta, WhatsApp o Instagram y envía el payload con el token del canal." />
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Card className="rounded-3xl border-slate-200">
                        <CardHeader>
                          <CardTitle className="text-base">URL de webhook</CardTitle>
                          <CardDescription>GET para verificación y POST para inbound.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Textarea value={endpoint} readOnly rows={3} className="font-mono text-xs" />
                          <Button className="rounded-xl" onClick={() => void copyText('webhook-endpoint', endpoint)}>
                            {copiedKey === 'webhook-endpoint' ? 'Copiado' : 'Copiar webhook'}
                          </Button>
                        </CardContent>
                      </Card>
                      <Card className="rounded-3xl border-slate-200">
                        <CardHeader>
                          <CardTitle className="text-base">Payload ejemplo</CardTitle>
                          <CardDescription>Formato soportado por el webhook omnicanal actual.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Textarea value={snippets.webhook} readOnly rows={12} className="font-mono text-xs" />
                          <Button className="rounded-xl" onClick={() => void copyText('webhook-payload', snippets.webhook)}>
                            {copiedKey === 'webhook-payload' ? 'Copiado' : 'Copiar payload'}
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="bridge" className="space-y-4">
                    <ErpSectionHeading title="Bridges de correo y adquisición" description="Snippets y payloads listos para Gmail, Outlook y otras fuentes sin integración nativa." />
                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card className="rounded-3xl border-amber-200 bg-amber-50/60">
                        <CardHeader>
                          <CardTitle className="text-base">Google Apps Script para Gmail</CardTitle>
                          <CardDescription>Etiqueta correos de prospectos en Gmail y envíalos directo al inbox omnicanal.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Textarea value={snippets.gmail} readOnly rows={16} className="font-mono text-xs" />
                          <Button className="rounded-xl" onClick={() => void copyText('bridge-gmail', snippets.gmail)}>
                            {copiedKey === 'bridge-gmail' ? 'Copiado' : 'Copiar Apps Script'}
                          </Button>
                        </CardContent>
                      </Card>
                      <Card className="rounded-3xl border-sky-200 bg-sky-50/60">
                        <CardHeader>
                          <CardTitle className="text-base">Payload para Outlook / Power Automate</CardTitle>
                          <CardDescription>Úsalo en una acción HTTP hacia el bridge CRM después de detectar correos de prospectos.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Textarea value={snippets.outlook} readOnly rows={16} className="font-mono text-xs" />
                          <Button className="rounded-xl" onClick={() => void copyText('bridge-outlook', snippets.outlook)}>
                            {copiedKey === 'bridge-outlook' ? 'Copiado' : 'Copiar body'}
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4 text-sm text-slate-600">
                        <p className="font-semibold text-slate-900">TikTok y YouTube</p>
                        <p className="mt-2 leading-6">Para TikTok Lead Ads, formularios de creators o capturas desde YouTube, usa el mismo endpoint de bridge vía Make, Zapier, n8n o una función serverless. Así los leads entran a la misma estructura CRM sin crear otro módulo.</p>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4 text-sm text-slate-600">
                        <p className="font-semibold text-slate-900">Siguiente fase enterprise</p>
                        <p className="mt-2 leading-6">Cuando tengamos credenciales productivas, esta base queda lista para OAuth con Google/Microsoft Graph, Meta webhooks oficiales, automatización de assignment, SLAs y handoff bot-humano.</p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </TabsContent>
      </Tabs>

      <Dialog open={chatbotBuilderModalOpen} onOpenChange={setChatbotBuilderModalOpen}>
        <DialogContent className="h-[92vh] max-h-[92vh] max-w-7xl overflow-hidden rounded-[30px] border-emerald-200 bg-white/98 p-0 shadow-[0_28px_80px_-42px_rgba(16,185,129,0.28)]">
          <div className="grid h-full min-h-0 gap-0 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="min-h-0 overflow-y-auto border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.16),transparent_30%),linear-gradient(180deg,#f6fffb,#ffffff)] p-6 xl:border-b-0 xl:border-r">
              <DialogHeader>
                <DialogTitle>Editor visual del chatbot</DialogTitle>
                <DialogDescription>Configura el iframe y el launcher desde un modal dedicado. Cada cambio se refleja en el preview en tiempo real.</DialogDescription>
              </DialogHeader>

              <div className="mt-5 space-y-4 pr-1">
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'flow', label: 'Flujo' },
                    { value: 'brand', label: 'Marca' },
                    { value: 'launcher', label: 'Launcher' },
                    { value: 'copy', label: 'Copy' },
                  ].map((section) => (
                    <button
                      key={section.value}
                      type="button"
                      onClick={() => setChatbotBuilderSection(section.value as ChatbotBuilderSection)}
                      className={chatbotBuilderSection === section.value ? 'rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600'}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>

                {chatbotBuilderSection === 'flow' ? (
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Canvas del flujo</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">Vista tipo nodos para entender de inmediato cómo una respuesta lleva a otra etapa.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-800">Rama por respuesta</span>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">Nodo activo</span>
                        </div>
                      </div>

                      <div className="mt-4 overflow-auto rounded-[22px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.08),transparent_28%),linear-gradient(180deg,#f8fffc,#ffffff)] p-3">
                        <div className="relative" style={{ width: chatbotCanvasModel.width, height: chatbotCanvasModel.height }}>
                          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${chatbotCanvasModel.width} ${chatbotCanvasModel.height}`} fill="none">
                            {chatbotCanvasModel.connections.map((connection) => {
                              const isSelected = connection.fromStageId === selectedChatbotStageId
                              return (
                                <g key={connection.id}>
                                  <path d={connection.path} stroke={isSelected ? '#7c3aed' : '#94a3b8'} strokeWidth={isSelected ? 2.5 : 1.6} strokeDasharray={isSelected ? '0' : '6 6'} strokeLinecap="round" />
                                </g>
                              )
                            })}
                          </svg>

                          {chatbotCanvasModel.nodes.map((node, index) => {
                            const isSelected = node.stage.id === selectedChatbotStageId
                            return (
                              <button
                                key={node.stage.id}
                                type="button"
                                onClick={() => setSelectedChatbotStageId(node.stage.id as ChatbotFlowStageId)}
                                className={isSelected ? 'absolute rounded-[24px] border border-emerald-300 bg-emerald-50/95 p-4 text-left shadow-[0_18px_46px_-28px_rgba(16,185,129,.45)]' : 'absolute rounded-[24px] border border-slate-200 bg-white/95 p-4 text-left shadow-[0_16px_40px_-30px_rgba(15,23,42,.24)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-28px_rgba(15,23,42,.28)]'}
                                style={{ left: node.x, top: node.y, width: node.width, minHeight: node.height }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Nodo {index + 1}</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900">{node.stage.title}</p>
                                  </div>
                                  <span className={`rounded-full bg-gradient-to-r ${getFlowStageAccent(node.stage.id)} px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white`}>
                                    {getFlowStageNextFieldLabel(node.stage.nextField)}
                                  </span>
                                </div>
                                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{node.stage.prompt}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{node.stage.responseOptions.length} ramas</span>
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{node.stage.quickActionIds.length} quick actions</span>
                                </div>
                                {node.stage.responseOptions.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {node.stage.responseOptions.slice(0, 3).map((option) => (
                                      <span key={option.id} className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-800">
                                        {option.label}
                                      </span>
                                    ))}
                                    {node.stage.responseOptions.length > 3 ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">+{node.stage.responseOptions.length - 3}</span> : null}
                                  </div>
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Lista estructurada de etapas</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">Además del canvas, aquí puedes reordenar nodos, revisar ramas y crear etapas nuevas.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={addChatbotStage}>Agregar etapa</Button>
                          <div className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">SendPulse-style</div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {chatbotBuilderDraft.flowStages.map((stage, index) => {
                          const stageActions = chatbotBuilderDraft.quickActions.filter((action) => stage.quickActionIds.includes(action.id) && action.enabled)
                          return (
                            <div
                              key={stage.id}
                              onClick={() => setSelectedChatbotStageId(stage.id as ChatbotFlowStageId)}
                              className={selectedChatbotStageId === stage.id ? 'cursor-pointer rounded-[24px] border border-emerald-300 bg-emerald-50/80 p-4 text-left shadow-sm' : 'cursor-pointer rounded-[24px] border border-slate-200 bg-white p-4 text-left'}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  setSelectedChatbotStageId(stage.id as ChatbotFlowStageId)
                                }
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Etapa {index + 1}</p>
                                  <p className="mt-1 text-sm font-semibold text-slate-900">{stage.title}</p>
                                </div>
                                <div className={`rounded-full bg-gradient-to-r ${getFlowStageAccent(stage.id)} px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white`}>{getFlowStageNextFieldLabel(stage.nextField)}</div>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-slate-600">{stage.description}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {stageActions.map((action) => <span key={action.id} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{action.label}</span>)}
                                {stage.responseOptions.map((option) => <span key={option.id} className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-800">{option.label}</span>)}
                              </div>
                              <div className="mt-3 flex gap-2">
                                <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={(event) => { event.stopPropagation(); moveChatbotStage(stage.id as ChatbotFlowStageId, -1) }} disabled={index === 0}>Subir</Button>
                                <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={(event) => { event.stopPropagation(); moveChatbotStage(stage.id as ChatbotFlowStageId, 1) }} disabled={index === chatbotBuilderDraft.flowStages.length - 1}>Bajar</Button>
                                {!PROTECTED_CHATBOT_STAGE_IDS.has(stage.id) ? <Button type="button" variant="outline" className="h-8 rounded-xl border-rose-200 px-3 text-xs text-rose-700" onClick={(event) => { event.stopPropagation(); deleteChatbotStage(stage.id as ChatbotFlowStageId) }}>Eliminar</Button> : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {selectedChatbotFlowStage ? (
                      <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Editor de etapa</p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">Ajusta la pregunta, el objetivo, las ramas posibles y las acciones visibles en esta etapa.</p>
                          </div>
                          <div className={`rounded-full bg-gradient-to-r ${getFlowStageAccent(selectedChatbotFlowStage.id)} px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white`}>{selectedChatbotFlowStage.title}</div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2"><Label>Título</Label><Input value={selectedChatbotFlowStage.title} onChange={(e) => updateChatbotStage(selectedChatbotFlowStage.id as ChatbotFlowStageId, { title: e.target.value })} className="h-11 rounded-xl" /></div>
                          <div className="grid gap-2"><Label>Siguiente paso esperado</Label><Select value={selectedChatbotFlowStage.nextField} onValueChange={(value) => updateChatbotStage(selectedChatbotFlowStage.id as ChatbotFlowStageId, { nextField: value as ChatbotFlowNextField })}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Nombre</SelectItem><SelectItem value="email">Correo</SelectItem><SelectItem value="phone">Teléfono</SelectItem><SelectItem value="product">Producto</SelectItem><SelectItem value="quantity">Cantidad</SelectItem><SelectItem value="none">Cierre</SelectItem></SelectContent></Select></div>
                          <div className="grid gap-2 md:col-span-2"><Label>Descripción operativa</Label><Textarea value={selectedChatbotFlowStage.description} onChange={(e) => updateChatbotStage(selectedChatbotFlowStage.id as ChatbotFlowStageId, { description: e.target.value })} rows={2} className="rounded-2xl" /></div>
                          <div className="grid gap-2 md:col-span-2"><Label>Prompt de etapa</Label><Textarea value={selectedChatbotFlowStage.prompt} onChange={(e) => updateChatbotStage(selectedChatbotFlowStage.id as ChatbotFlowStageId, { prompt: e.target.value })} rows={4} className="rounded-2xl" /></div>
                        </div>

                        <div className="mt-4 grid gap-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Respuestas que abren ramas</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">Cada respuesta puede mostrarse como botón y también activar una rama si el usuario escribe palabras similares.</p>
                            </div>
                            <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => addChatbotResponseOption(selectedChatbotFlowStage.id as ChatbotFlowStageId)}>Agregar respuesta</Button>
                          </div>

                          {selectedChatbotFlowStage.responseOptions.length ? selectedChatbotFlowStage.responseOptions.map((option) => (
                            <div key={option.id} className="rounded-[22px] border border-violet-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                                  <p className="text-xs text-slate-500">ID técnico: {option.id}</p>
                                </div>
                                <Button type="button" variant="outline" className="h-8 rounded-xl border-rose-200 px-3 text-xs text-rose-700" onClick={() => removeChatbotResponseOption(selectedChatbotFlowStage.id as ChatbotFlowStageId, option.id)}>Eliminar</Button>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div className="grid gap-2"><Label>Etiqueta visible</Label><Input value={option.label} onChange={(e) => updateChatbotResponseOption(selectedChatbotFlowStage.id as ChatbotFlowStageId, option.id, { label: e.target.value })} className="h-11 rounded-xl" /></div>
                                <div className="grid gap-2"><Label>Mensaje que enviará</Label><Input value={option.userMessage} onChange={(e) => updateChatbotResponseOption(selectedChatbotFlowStage.id as ChatbotFlowStageId, option.id, { userMessage: e.target.value })} className="h-11 rounded-xl" /></div>
                                <div className="grid gap-2"><Label>Cómo hace match</Label><Select value={option.matchMode} onValueChange={(value) => updateChatbotResponseOption(selectedChatbotFlowStage.id as ChatbotFlowStageId, option.id, { matchMode: value as ChatbotFlowResponseMatchMode })}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contains">Contiene palabras</SelectItem><SelectItem value="exact">Coincidencia exacta</SelectItem></SelectContent></Select></div>
                                <div className="grid gap-2"><Label>Etapa destino</Label><Select value={option.targetStageId} onValueChange={(value) => updateChatbotResponseOption(selectedChatbotFlowStage.id as ChatbotFlowStageId, option.id, { targetStageId: value })}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{chatbotBuilderDraft.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}</SelectContent></Select></div>
                                <div className="grid gap-2 md:col-span-2"><Label>Palabras o frases que disparan esta rama</Label><Textarea value={option.matchValue} onChange={(e) => updateChatbotResponseOption(selectedChatbotFlowStage.id as ChatbotFlowStageId, option.id, { matchValue: e.target.value })} rows={2} className="rounded-2xl" placeholder="Ej: cotizar, precio, necesito comprar" /></div>
                                <div className="grid gap-2 md:col-span-2"><Label>Respuesta del bot al tomar esta rama</Label><Textarea value={option.assistantReply} onChange={(e) => updateChatbotResponseOption(selectedChatbotFlowStage.id as ChatbotFlowStageId, option.id, { assistantReply: e.target.value })} rows={3} className="rounded-2xl" /></div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-800">{getResponseMatchModeLabel(option.matchMode)}</span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">Destino: {chatbotBuilderDraft.flowStages.find((stage) => stage.id === option.targetStageId)?.title || option.targetStageId}</span>
                              </div>
                            </div>
                          )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">Esta etapa todavía no tiene respuestas guiadas. Agrégalas para construir ramas concretas como en SendPulse.</div>}
                        </div>

                        <div className="mt-4 grid gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Botones rápidos visibles</p>
                          {chatbotBuilderDraft.quickActions.map((action) => (
                            <div key={action.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                                <p className="text-xs text-slate-500">{action.message}</p>
                              </div>
                              <Switch checked={selectedChatbotFlowStage.quickActionIds.includes(action.id) && action.enabled} onCheckedChange={(checked) => toggleChatbotStageQuickAction(selectedChatbotFlowStage.id as ChatbotFlowStageId, action.id, checked)} disabled={!action.enabled} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                      <p className="text-sm font-semibold text-slate-900">Biblioteca de quick actions</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Define la etiqueta y el mensaje que cada botón enviará al flujo automático.</p>
                      <div className="mt-4 grid gap-3">
                        {chatbotBuilderDraft.quickActions.map((action) => (
                          <div key={action.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{action.kind === 'human' ? 'Escalamiento humano' : action.kind === 'stock' ? 'Consulta de stock' : action.kind === 'catalog' ? 'Explorar catálogo' : 'Mensaje libre'}</p>
                                <p className="text-xs text-slate-500">ID técnico: {action.id}</p>
                              </div>
                              <Switch checked={action.enabled} onCheckedChange={(checked) => updateChatbotQuickAction(action.id, { enabled: checked })} />
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div className="grid gap-2"><Label>Etiqueta</Label><Input value={action.label} onChange={(e) => updateChatbotQuickAction(action.id, { label: e.target.value })} className="h-11 rounded-xl" /></div>
                              <div className="grid gap-2"><Label>Mensaje que envía</Label><Input value={action.message} onChange={(e) => updateChatbotQuickAction(action.id, { message: e.target.value })} className="h-11 rounded-xl" /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {chatbotBuilderSection === 'brand' ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="grid gap-2 md:col-span-2"><Label>Título del chatbot</Label><Input value={chatbotBuilderDraft.chatbotTitle} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, chatbotTitle: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2 md:col-span-2"><Label>Nombre del asistente</Label><Input value={chatbotBuilderDraft.assistantName} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, assistantName: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2 md:col-span-2"><Label>Prompt inicial legacy</Label><Textarea value={chatbotBuilderDraft.chatbotPrompt} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, chatbotPrompt: e.target.value }))} rows={3} className="rounded-2xl" /></div>
                      <div className="grid gap-2"><Label>Altura iframe</Label><Input value={chatbotBuilderDraft.iframeHeight} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, iframeHeight: normalizePixelValue(e.target.value, '720') }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Fuente CSS</Label><Input value={chatbotBuilderDraft.fontFamily} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, fontFamily: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2 md:col-span-2"><Label>Dominios permitidos</Label><Textarea value={chatbotBuilderDraft.allowedDomains} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, allowedDomains: e.target.value }))} rows={2} className="rounded-2xl" placeholder="cliente.com, demo.cliente.com" /></div>
                    </div>

                    <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
                      <div className="grid gap-2"><Label>Color acento</Label><Input value={chatbotBuilderDraft.accentColor} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, accentColor: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Fondo general</Label><Input value={chatbotBuilderDraft.pageBackgroundColor} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, pageBackgroundColor: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Fondo interno</Label><Input value={chatbotBuilderDraft.backgroundColor} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, backgroundColor: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Etiqueta superior</Label><Input value={chatbotBuilderDraft.headerBadgeLabel} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, headerBadgeLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Estado del asistente</Label><Input value={chatbotBuilderDraft.statusBadgeLabel} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, statusBadgeLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Radio del panel</Label><Input value={chatbotBuilderDraft.chatShellRadius} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, chatShellRadius: normalizePixelValue(e.target.value, '30') }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Radio de burbujas</Label><Input value={chatbotBuilderDraft.messageBubbleRadius} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, messageBubbleRadius: normalizePixelValue(e.target.value, '22') }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Sombra del panel</Label><Select value={chatbotBuilderDraft.panelShadowPreset} onValueChange={(value) => setChatbotBuilderDraft((current) => ({ ...current, panelShadowPreset: value as PanelShadowPreset }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="soft">Suave</SelectItem><SelectItem value="medium">Media</SelectItem><SelectItem value="strong">Fuerte</SelectItem></SelectContent></Select></div>
                    </div>
                  </>
                ) : null}

                {chatbotBuilderSection === 'launcher' ? (
                  <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Launcher flotante</p>
                        <p className="text-xs text-slate-500">Activa o desactiva el botón flotante</p>
                      </div>
                      <Switch checked={chatbotBuilderDraft.floatingLauncherEnabled} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, floatingLauncherEnabled: checked }))} />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Solicitar producto</p>
                        <p className="text-xs text-slate-500">Muestra el campo rápido en el composer</p>
                      </div>
                      <Switch checked={chatbotBuilderDraft.showProductField} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, showProductField: checked }))} />
                    </div>
                    <div className="grid gap-2"><Label>Texto launcher</Label><Input value={chatbotBuilderDraft.launcherLabel} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, launcherLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                    <div className="grid gap-2"><Label>Icono launcher</Label><Select value={chatbotBuilderDraft.launcherIcon} onValueChange={(value) => setChatbotBuilderDraft((current) => ({ ...current, launcherIcon: value }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bot">bot</SelectItem><SelectItem value="message-circle">message-circle</SelectItem><SelectItem value="sparkles">sparkles</SelectItem></SelectContent></Select></div>
                    <div className="grid gap-2"><Label>Posición launcher</Label><Select value={chatbotBuilderDraft.launcherPosition} onValueChange={(value) => setChatbotBuilderDraft((current) => ({ ...current, launcherPosition: value as LauncherPosition }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="right">Derecha</SelectItem><SelectItem value="left">Izquierda</SelectItem></SelectContent></Select></div>
                    <div className="grid gap-2"><Label>Tamaño launcher</Label><Select value={chatbotBuilderDraft.launcherSize} onValueChange={(value) => setChatbotBuilderDraft((current) => ({ ...current, launcherSize: value as LauncherSize }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Compacto</SelectItem><SelectItem value="standard">Estándar</SelectItem><SelectItem value="large">Grande</SelectItem></SelectContent></Select></div>
                  </div>
                ) : null}

                {chatbotBuilderSection === 'copy' ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2"><Label>Label producto</Label><Input value={chatbotBuilderDraft.productLabel} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, productLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                    <div className="grid gap-2"><Label>Placeholder producto</Label><Input value={chatbotBuilderDraft.productPlaceholder} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, productPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                    <div className="grid gap-2 md:col-span-2"><Label>Label mensaje</Label><Input value={chatbotBuilderDraft.messageLabel} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, messageLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                    <div className="grid gap-2 md:col-span-2"><Label>Placeholder mensaje</Label><Input value={chatbotBuilderDraft.messagePlaceholder} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, messagePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff,#f6fffb)] p-6">
              <div className="rounded-[26px] border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Preview en vivo</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Puedes alternar entre launcher compacto, launcher visible o panel abierto, y también entre desktop y mobile.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[{ value: 'floating', label: 'Launcher' }, { value: 'compact', label: 'Compacto' }, { value: 'expanded', label: 'Abierto' }].map((mode) => (
                      <button key={mode.value} type="button" onClick={() => setChatbotBuilderPreviewMode(mode.value as ChatbotPreviewMode)} className={chatbotBuilderPreviewMode === mode.value ? 'rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600'}>{mode.label}</button>
                    ))}
                    {[{ value: 'desktop', label: 'Desktop' }, { value: 'mobile', label: 'Mobile' }].map((viewport) => (
                      <button key={viewport.value} type="button" onClick={() => setChatbotBuilderPreviewViewport(viewport.value as ChatbotPreviewViewport)} className={chatbotBuilderPreviewViewport === viewport.value ? 'rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600'}>{viewport.label}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                {renderChatbotPreview(chatbotBuilderDraft, { mode: chatbotBuilderPreviewMode, viewport: chatbotBuilderPreviewViewport })}
              </div>
              <DialogFooter className="mt-5 border-t border-slate-100 pt-5">
                <Button variant="outline" className="rounded-xl" onClick={() => setChatbotBuilderDraft(getChatbotBuilderState(selectedSettings))} disabled={savingChatbotBuilder}>
                  Revertir
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setChatbotBuilderModalOpen(false)} disabled={savingChatbotBuilder}>
                  Cerrar
                </Button>
                <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => void saveSelectedChatbotBuilder()} disabled={savingChatbotBuilder}>
                  {savingChatbotBuilder ? 'Guardando...' : 'Guardar constructor'}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={webFormBuilderModalOpen} onOpenChange={setWebFormBuilderModalOpen}>
        <DialogContent className="h-[92vh] max-h-[92vh] max-w-7xl overflow-hidden rounded-[30px] border-sky-200 bg-white/98 p-0 shadow-[0_28px_80px_-42px_rgba(14,165,233,0.35)]">
          <div className="grid h-full min-h-0 gap-0 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="min-h-0 overflow-y-auto border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.18),transparent_30%),linear-gradient(180deg,#f8fbff,#ffffff)] p-6 xl:border-b-0 xl:border-r">
              <DialogHeader>
                <DialogTitle>Editor visual del formulario web</DialogTitle>
                <DialogDescription>El usuario edita en un modal dedicado y cada ajuste se refleja al instante en el preview del iframe.</DialogDescription>
              </DialogHeader>

              <div className="mt-5 space-y-4 pr-1">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2 md:col-span-2"><Label>Título</Label><Input value={webFormBuilderDraft.formTitle} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, formTitle: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2 md:col-span-2"><Label>Descripción</Label><Textarea value={webFormBuilderDraft.formDescription} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, formDescription: e.target.value }))} rows={3} className="rounded-2xl" /></div>
                  <div className="grid gap-2"><Label>CTA</Label><Input value={webFormBuilderDraft.submitCtaLabel} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, submitCtaLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Altura iframe</Label><Input value={webFormBuilderDraft.iframeHeight} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, iframeHeight: normalizePixelValue(e.target.value, '840') }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2 md:col-span-2"><Label>Mensaje de éxito</Label><Textarea value={webFormBuilderDraft.formSuccessMessage} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, formSuccessMessage: e.target.value }))} rows={2} className="rounded-2xl" /></div>
                  <div className="grid gap-2 md:col-span-2"><Label>Dominios permitidos</Label><Textarea value={webFormBuilderDraft.allowedDomains} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, allowedDomains: e.target.value }))} rows={2} className="rounded-2xl" placeholder="cliente.com, demo.cliente.com" /></div>
                </div>

                <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
                  <div className="grid gap-2"><Label>Color acento</Label><Input value={webFormBuilderDraft.accentColor} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, accentColor: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Color CTA</Label><Input value={webFormBuilderDraft.formCtaColor} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, formCtaColor: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Fondo general</Label><Input value={webFormBuilderDraft.pageBackgroundColor} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, pageBackgroundColor: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Fondo interno</Label><Input value={webFormBuilderDraft.backgroundColor} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, backgroundColor: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Radio tarjeta</Label><Input value={webFormBuilderDraft.formCardRadius} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, formCardRadius: normalizePixelValue(e.target.value, '28') }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Radio inputs</Label><Input value={webFormBuilderDraft.formInputRadius} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, formInputRadius: normalizePixelValue(e.target.value, '16') }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Espaciado</Label><Input value={webFormBuilderDraft.formFieldSpacing} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, formFieldSpacing: normalizePixelValue(e.target.value, '14') }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Padding interno</Label><Input value={webFormBuilderDraft.formPadding} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, formPadding: normalizePixelValue(e.target.value, '24') }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Tamaño fuente</Label><Input value={webFormBuilderDraft.formFontSize} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, formFontSize: normalizePixelValue(e.target.value, '14') }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Fuente CSS</Label><Input value={webFormBuilderDraft.fontFamily} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, fontFamily: e.target.value }))} className="h-11 rounded-xl" /></div>
                </div>

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
                    <div key={field.key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2">
                      <span className="text-sm font-medium text-slate-900">{field.label}</span>
                      <Switch checked={Boolean(webFormBuilderDraft[field.key as keyof WebFormBuilderState])} onCheckedChange={(checked) => setWebFormBuilderDraft((current) => ({ ...current, [field.key]: checked }))} />
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2"><Label>Label nombre</Label><Input value={webFormBuilderDraft.nameLabel} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, nameLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Placeholder nombre</Label><Input value={webFormBuilderDraft.namePlaceholder} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, namePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Label correo</Label><Input value={webFormBuilderDraft.emailLabel} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, emailLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Placeholder correo</Label><Input value={webFormBuilderDraft.emailPlaceholder} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, emailPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Label teléfono</Label><Input value={webFormBuilderDraft.phoneLabel} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, phoneLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Placeholder teléfono</Label><Input value={webFormBuilderDraft.phonePlaceholder} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, phonePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Label empresa</Label><Input value={webFormBuilderDraft.companyLabel} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, companyLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Placeholder empresa</Label><Input value={webFormBuilderDraft.companyPlaceholder} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, companyPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Label ciudad</Label><Input value={webFormBuilderDraft.cityLabel} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, cityLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Placeholder ciudad</Label><Input value={webFormBuilderDraft.cityPlaceholder} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, cityPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Label producto</Label><Input value={webFormBuilderDraft.productLabel} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, productLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Placeholder producto</Label><Input value={webFormBuilderDraft.productPlaceholder} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, productPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2 md:col-span-2"><Label>Label mensaje</Label><Input value={webFormBuilderDraft.messageLabel} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, messageLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2 md:col-span-2"><Label>Placeholder mensaje</Label><Input value={webFormBuilderDraft.messagePlaceholder} onChange={(e) => setWebFormBuilderDraft((current) => ({ ...current, messagePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-6">
              <div className="rounded-[26px] border border-sky-200 bg-sky-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Preview en vivo</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">Lo que ves aquí es la versión real que quedará disponible en la URL pública y en el iframe del canal.</p>
              </div>
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                {renderWebFormPreview(webFormBuilderDraft, { maxWidthClassName: 'max-w-2xl', outerPaddingClassName: 'p-4', titleClassName: 'text-lg', messageMinHeight: 112 })}
              </div>
              <DialogFooter className="mt-5 border-t border-slate-100 pt-5">
                <Button variant="outline" className="rounded-xl" onClick={() => setWebFormBuilderDraft(getWebFormBuilderState(selectedSettings))} disabled={savingWebFormBuilder}>
                  Revertir
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setWebFormBuilderModalOpen(false)} disabled={savingWebFormBuilder}>
                  Cerrar
                </Button>
                <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => void saveSelectedWebFormBuilder()} disabled={savingWebFormBuilder}>
                  {savingWebFormBuilder ? 'Guardando...' : 'Guardar constructor'}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="h-[92vh] max-h-[92vh] max-w-5xl overflow-hidden rounded-[30px] border-slate-200 bg-white/98 p-0 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.45)]">
          <div className="grid h-full min-h-0 gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="min-h-0 overflow-y-auto border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.18),transparent_32%),linear-gradient(180deg,#f8fbff,#ffffff)] p-6 lg:border-b-0 lg:border-r">
              <DialogHeader>
                <DialogTitle>{editingChannelId ? 'Editar canal omnicanal' : 'Nuevo canal omnicanal'}</DialogTitle>
                <DialogDescription>{editingChannelId ? 'Ajusta configuración, demo e iframe desde el mismo wizard sin perder el contexto del canal.' : 'Wizard por pasos para dejar el canal listo, con preview comercial y checklist antes de crearlo.'}</DialogDescription>
              </DialogHeader>

              <div className="mt-4 overflow-x-auto pb-1">
                <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
                {[
                  { id: 'template', label: '1. Plantilla' },
                  { id: 'config', label: '2. Configuración' },
                  { id: 'review', label: '3. Revisión' },
                ].map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setWizardStep(step.id as WizardStep)}
                    className={wizardStep === step.id ? 'rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700' : 'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600'}
                  >
                    {step.label}
                  </button>
                ))}
                </div>
              </div>

              {wizardStep === 'template' ? (
                <div className="mt-5 space-y-3 pr-1">
                  {TEMPLATE_PRESETS.map((preset) => (
                    (() => {
                      const Icon = getTemplatePresetIcon(preset)
                      const surface = getTemplatePresetSurface(preset)
                      const selected = createForm.templateKey === preset.key

                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => applyTemplate(preset.key)}
                          className={selected
                            ? `rounded-[26px] p-3.5 text-left shadow-sm transition-shadow ${surface.card} ${surface.selected}`
                            : `rounded-[26px] p-3.5 text-left shadow-sm transition-shadow hover:shadow-md ${surface.card}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${surface.iconWrap}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[15px] font-semibold leading-5 text-slate-950">{preset.name}</p>
                                <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] ${surface.pill}`}>{preset.connectionModel}</span>
                              </div>
                              <p className="mt-1.5 text-[13px] leading-5 text-slate-600">{preset.description}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className={`text-[11px] font-semibold ${surface.accent}`}>{preset.focus}</span>
                                <span className="text-[11px] text-slate-500">{preset.readiness}</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      )
                    })()
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vista previa lateral</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950">{createForm.name || createPreset.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{createPreset.description}</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Endpoint estimado</p>
                      <p className="mt-2 break-all text-sm font-medium text-slate-900">{wizardPreview.endpointPreview}</p>
                    </div>
                    {createForm.provider === 'WEB_CHATBOT' ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-700">Iframe visible al crear</p>
                        <p className="mt-2 text-sm leading-6 text-emerald-900">{wizardPreview.iframeUrl}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700">
                            <span className="h-3.5 w-3.5 rounded-full border border-slate-200" style={{ backgroundColor: createForm.accentColor }} />
                            <span>Acento {createForm.accentColor}</span>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700">
                            <span className="h-3.5 w-3.5 rounded-full border border-slate-200" style={{ backgroundColor: createForm.pageBackgroundColor }} />
                            <span>Fondo general {createForm.pageBackgroundColor}</span>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700">
                            <span className="h-3.5 w-3.5 rounded-full border border-slate-200" style={{ backgroundColor: createForm.backgroundColor }} />
                            <span>Fondo interno {createForm.backgroundColor}</span>
                          </div>
                        </div>
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-white/80 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                              {[
                                { value: 'floating', label: 'Boton flotante' },
                                { value: 'compact', label: 'Compactado' },
                                { value: 'expanded', label: 'Desplegado' },
                              ].map((mode) => (
                                <button
                                  key={mode.value}
                                  type="button"
                                  onClick={() => setWizardChatPreviewMode(mode.value as ChatbotPreviewMode)}
                                  className={wizardChatPreviewMode === mode.value ? 'rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600'}
                                >
                                  {mode.label}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              {[
                                { value: 'desktop', label: 'Desktop' },
                                { value: 'mobile', label: 'Mobile' },
                              ].map((viewport) => (
                                <button
                                  key={viewport.value}
                                  type="button"
                                  onClick={() => setWizardChatPreviewViewport(viewport.value as ChatbotPreviewViewport)}
                                  className={wizardChatPreviewViewport === viewport.value ? 'rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600'}
                                >
                                  {viewport.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="relative mt-3 overflow-hidden rounded-[26px] border border-emerald-200 p-3 shadow-sm" style={{ background: `radial-gradient(circle at top, rgba(14,165,233,0.14), transparent 32%), linear-gradient(180deg, ${createForm.pageBackgroundColor} 0%, ${createForm.pageBackgroundColor} 55%, ${createForm.backgroundColor} 100%)`, minHeight: wizardChatPreviewViewport === 'mobile' ? 500 : 420 }}>
                            {derivedChatbotCustomCss.trim() ? <style>{derivedChatbotCustomCss}</style> : null}
                            <div className="flex h-full px-3 pb-20 pt-4" style={{ justifyContent: createForm.launcherPosition === 'left' ? 'flex-start' : 'flex-end' }}>
                              <div className="sgd-preview-root relative flex min-h-full w-full items-end" style={{ maxWidth: wizardChatPreviewViewport === 'mobile' ? 340 : 420, fontFamily: createForm.fontFamily }}>
                                {wizardChatPreviewMode === 'expanded' ? (
                                  <div className="sgd-preview-panel overflow-hidden border border-slate-200 bg-white" style={{ marginTop: 24, marginLeft: createForm.launcherPosition === 'left' ? 0 : 'auto', marginRight: createForm.launcherPosition === 'left' ? 'auto' : 0, borderRadius: `${normalizePixelValue(createForm.chatShellRadius, '30')}px`, boxShadow: getPanelShadowValue(createForm.panelShadowPreset) }}>
                                    <div className="sgd-preview-panel-header px-4 py-4 text-white" style={{ background: `linear-gradient(135deg, #0f172a, ${createForm.accentColor})` }}>
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-100">{createForm.headerBadgeLabel}</p>
                                          <p className="mt-1 text-base font-semibold">{createForm.chatbotTitle}</p>
                                        </div>
                                        <div className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">{createForm.statusBadgeLabel}</div>
                                      </div>
                                    </div>
                                    <div className="sgd-preview-messages space-y-3 px-4 py-4" style={{ backgroundColor: createForm.backgroundColor }}>
                                      <div className="max-w-[84%] border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-700 shadow-sm" style={{ borderRadius: `${normalizePixelValue(createForm.messageBubbleRadius, '22')}px` }}>{createForm.chatbotPrompt}</div>
                                      {createForm.showProductField ? <div className="max-w-[84%] border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-700 shadow-sm" style={{ borderRadius: `${normalizePixelValue(createForm.messageBubbleRadius, '22')}px` }}>Tambien puedo pedir producto y cantidad para revisar inventario.</div> : null}
                                      <div className="ml-auto max-w-[78%] px-4 py-3 text-xs leading-5 text-white shadow-sm" style={{ backgroundColor: createForm.accentColor, borderRadius: `${normalizePixelValue(createForm.messageBubbleRadius, '22')}px` }}>Necesito una propuesta comercial para mi marca.</div>
                                    </div>
                                    <div className="sgd-preview-composer border-t border-slate-100 bg-white px-4 py-4">
                                      <div className="grid gap-2">
                                        {createForm.showProductField ? <div className="rounded-2xl border border-slate-200 px-3 py-2 text-xs text-slate-400">{createForm.productLabel}: {createForm.productPlaceholder}</div> : null}
                                        <div className="rounded-2xl border border-slate-200 px-3 py-3 text-xs text-slate-400">{createForm.messageLabel}: {createForm.messagePlaceholder}</div>
                                        <div className="flex gap-2">
                                          <div className="flex-1 rounded-xl px-3 py-2 text-center text-xs font-semibold text-white" style={{ backgroundColor: createForm.accentColor }}>Responder</div>
                                          <div className="rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600">Asesor humano</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}

                                {createForm.floatingLauncherEnabled ? (
                                  <div className="sgd-preview-launcher absolute z-10" style={{ bottom: 60, left: createForm.launcherPosition === 'left' ? 60 : undefined, right: createForm.launcherPosition === 'right' ? 60 : undefined, maxWidth: 'calc(100% - 120px)' }}>
                                    <div className="flex max-w-full items-center justify-center whitespace-nowrap text-white shadow-[0_18px_44px_-26px_rgba(15,23,42,0.55)]" style={{ backgroundColor: createForm.accentColor, borderRadius: wizardLauncherMetrics.buttonRadius, padding: wizardLauncherMetrics.buttonPadding, height: wizardLauncherMetrics.buttonHeight, gap: wizardChatPreviewMode === 'compact' ? '0' : wizardLauncherMetrics.buttonGap, minWidth: wizardChatPreviewMode === 'compact' ? wizardLauncherMetrics.buttonHeight : undefined, fontSize: wizardLauncherMetrics.fontSize, fontWeight: 700 }}>
                                      <span style={{ fontSize: wizardLauncherMetrics.iconSize, lineHeight: 1 }}>{getLauncherPreviewIcon(createForm.launcherIcon)}</span>
                                      {wizardChatPreviewMode !== 'compact' && wizardLauncherMetrics.labelVisible ? <span>{createForm.launcherLabel}</span> : null}
                                    </div>
                                  </div>
                                ) : <div className="absolute bottom-0 rounded-full border border-dashed border-slate-300 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-500">Launcher flotante desactivado</div>}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2">
                              <p className="font-semibold text-slate-900">Launcher</p>
                              <p className="mt-1">{createForm.launcherPosition === 'left' ? 'Izquierda' : 'Derecha'} · {createForm.launcherSize}</p>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2">
                              <p className="font-semibold text-slate-900">Estado</p>
                              <p className="mt-1">{wizardChatPreviewMode === 'expanded' ? 'Panel abierto' : wizardChatPreviewMode === 'compact' ? 'Launcher compacto' : 'Launcher visible'}</p>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2">
                              <p className="font-semibold text-slate-900">Extensión</p>
                              <p className="mt-1">Radio {normalizePixelValue(createForm.chatShellRadius, '30')}px · Sombra {createForm.panelShadowPreset}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {createIsPublicWebForm ? (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-sky-700">Iframe visible al crear</p>
                        <p className="mt-2 text-sm leading-6 text-sky-900">{wizardPreview.iframeUrl}</p>
                        <div className="mt-3 flex gap-2">
                          {[
                            { value: 'desktop', label: 'Desktop' },
                            { value: 'mobile', label: 'Mobile' },
                          ].map((viewport) => (
                            <button
                              key={viewport.value}
                              type="button"
                              onClick={() => setWizardChatPreviewViewport(viewport.value as ChatbotPreviewViewport)}
                              className={wizardChatPreviewViewport === viewport.value ? 'rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600'}
                            >
                              {viewport.label}
                            </button>
                          ))}
                        </div>
                        <div className="mt-4 overflow-hidden rounded-[26px] border border-sky-200 p-4 shadow-sm" style={{ background: `radial-gradient(circle at top, rgba(14,165,233,0.16), transparent 34%), linear-gradient(180deg, ${createForm.pageBackgroundColor} 0%, ${createForm.backgroundColor} 100%)` }}>
                          <div className="mx-auto" style={{ maxWidth: wizardChatPreviewViewport === 'mobile' ? 340 : 620, fontFamily: createForm.fontFamily }}>
                            <div className="border border-slate-200 bg-white shadow-[0_28px_70px_-34px_rgba(15,23,42,.32)]" style={{ borderRadius: `${normalizePixelValue(createForm.formCardRadius, '28')}px`, padding: `${normalizePixelValue(createForm.formPadding, '24')}px`, backgroundColor: createForm.backgroundColor }}>
                              <div className="flex items-center gap-3">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: createForm.accentColor, boxShadow: `0 0 0 6px ${createForm.accentColor}22` }} />
                                <div>
                                  <p className="text-lg font-semibold text-slate-950">{createForm.formTitle}</p>
                                  <p className="mt-1 text-sm leading-6 text-slate-500">{createForm.formDescription}</p>
                                </div>
                              </div>
                              <div className="mt-5 grid" style={{ gap: `${normalizePixelValue(createForm.formFieldSpacing, '14')}px`, fontSize: `${normalizePixelValue(createForm.formFontSize, '14')}px` }}>
                                {createForm.showNameField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: createForm.formLabelColor }}>{createForm.nameLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(createForm.formInputRadius, '16')}px`, border: `1px solid ${createForm.formInputBorderColor}`, backgroundColor: createForm.formInputBackgroundColor, color: createForm.formInputTextColor }}>{createForm.namePlaceholder}</div></div> : null}
                                <div className="grid gap-3 md:grid-cols-2">
                                  {createForm.showEmailField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: createForm.formLabelColor }}>{createForm.emailLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(createForm.formInputRadius, '16')}px`, border: `1px solid ${createForm.formInputBorderColor}`, backgroundColor: createForm.formInputBackgroundColor, color: createForm.formInputTextColor }}>{createForm.emailPlaceholder}</div></div> : null}
                                  {createForm.showPhoneField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: createForm.formLabelColor }}>{createForm.phoneLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(createForm.formInputRadius, '16')}px`, border: `1px solid ${createForm.formInputBorderColor}`, backgroundColor: createForm.formInputBackgroundColor, color: createForm.formInputTextColor }}>{createForm.phonePlaceholder}</div></div> : null}
                                </div>
                                {(createForm.showCompanyField || createForm.showCityField) ? <div className="grid gap-3 md:grid-cols-2">{createForm.showCompanyField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: createForm.formLabelColor }}>{createForm.companyLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(createForm.formInputRadius, '16')}px`, border: `1px solid ${createForm.formInputBorderColor}`, backgroundColor: createForm.formInputBackgroundColor, color: createForm.formInputTextColor }}>{createForm.companyPlaceholder}</div></div> : null}{createForm.showCityField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: createForm.formLabelColor }}>{createForm.cityLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(createForm.formInputRadius, '16')}px`, border: `1px solid ${createForm.formInputBorderColor}`, backgroundColor: createForm.formInputBackgroundColor, color: createForm.formInputTextColor }}>{createForm.cityPlaceholder}</div></div> : null}</div> : null}
                                {createForm.showProductField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: createForm.formLabelColor }}>{createForm.productLabel}</p><div className="px-4 py-3" style={{ borderRadius: `${normalizePixelValue(createForm.formInputRadius, '16')}px`, border: `1px solid ${createForm.formInputBorderColor}`, backgroundColor: createForm.formInputBackgroundColor, color: createForm.formInputTextColor }}>{createForm.productPlaceholder}</div></div> : null}
                                {createForm.showMessageField ? <div className="grid gap-2"><p className="text-xs font-semibold" style={{ color: createForm.formLabelColor }}>{createForm.messageLabel}</p><div className="px-4 py-3" style={{ minHeight: 112, borderRadius: `${normalizePixelValue(createForm.formInputRadius, '16')}px`, border: `1px solid ${createForm.formInputBorderColor}`, backgroundColor: createForm.formInputBackgroundColor, color: createForm.formInputTextColor }}>{createForm.messagePlaceholder}</div></div> : null}
                                <div className="px-4 py-3 text-center text-sm font-semibold" style={{ borderRadius: `${normalizePixelValue(createForm.formInputRadius, '16')}px`, background: `linear-gradient(135deg, ${createForm.formCtaColor}, ${createForm.accentColor})`, color: createForm.formCtaTextColor }}>{createForm.submitCtaLabel}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2"><p className="font-semibold text-slate-900">Campos activos</p><p className="mt-1">{[createForm.showNameField && 'Nombre', createForm.showEmailField && 'Correo', createForm.showPhoneField && 'Teléfono', createForm.showCompanyField && 'Empresa', createForm.showCityField && 'Ciudad', createForm.showProductField && 'Producto', createForm.showMessageField && 'Mensaje'].filter(Boolean).join(' · ')}</p></div>
                          <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2"><p className="font-semibold text-slate-900">Tipografía</p><p className="mt-1">{normalizePixelValue(createForm.formFontSize, '14')}px · {createForm.fontFamily}</p></div>
                          <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2"><p className="font-semibold text-slate-900">Forma</p><p className="mt-1">Radio {normalizePixelValue(createForm.formInputRadius, '16')}px · Gap {normalizePixelValue(createForm.formFieldSpacing, '14')}px</p></div>
                        </div>
                      </div>
                    ) : null}
                    {[{ title: 'Configurado', items: wizardPreview.configured }, { title: 'Demo', items: wizardPreview.demo }, { title: 'Producción', items: wizardPreview.production }].map((group) => (
                      <div key={group.title}>
                        <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                        <div className="mt-2 space-y-2">
                          {group.items.map((item) => (
                            <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                              <span className={item.done ? 'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700' : 'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700'}>{item.done ? 'OK' : '!'}</span>
                              <div>
                                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                                <p className="text-xs text-slate-500">{item.hint}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden p-6">
              <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#fbfdff,#ffffff)] p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">{createPreset.connectionModel}</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">{createPreset.readiness}</span>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{createPreset.name}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{createPreset.description}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Objetivo del canal</p>
                <p className="mt-1 text-sm text-slate-700">{createPreset.focus}</p>
              </div>

              <div className="mt-5 flex-1 overflow-y-auto pr-1">
                {wizardStep === 'config' ? (
                <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2 md:col-span-2">
                  <Label>Nombre del canal</Label>
                  <Input value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} className="h-11 rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label>Proveedor técnico</Label>
                  <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
                    {createForm.provider}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Estado inicial</Label>
                  <Select value={createForm.status} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, status: value as ChannelStatus }))}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNEL_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Token de prueba / verificación</Label>
                  <div className="flex gap-2">
                    <Input value={createForm.testingToken} onChange={(e) => setCreateForm((prev) => ({ ...prev, testingToken: e.target.value }))} className="h-11 rounded-xl" />
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCreateForm((prev) => ({ ...prev, testingToken: makeDemoToken() }))}>Regenerar</Button>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">Se usa para pruebas seguras, verificación y bridges demo.</p>
                </div>
                {createUsesWebhook ? (
                  <>
                    {usesMetaProvider(createForm.provider) ? (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-900 md:col-span-2">
                        <p className="font-semibold">Conexión Meta en esta versión</p>
                        <p className="mt-2 leading-6">
                          Este canal ya soporta OAuth real con Meta, callback seguro, sincronización de páginas, cuentas de Instagram y assets de WhatsApp.
                          Además, el inbox puede operar salida productiva en WhatsApp Cloud y salida básica por Meta Send API en Messenger e Instagram cuando el canal ya quedó sincronizado.
                        </p>
                        <p className="mt-2 leading-6">
                          Si el cliente todavía no autoriza OAuth, puedes seguir cargando manualmente Account ID, Page ID o Phone Number ID, token de verificación y, para WhatsApp Cloud, Access Token.
                        </p>
                      </div>
                    ) : null}
                    <div className="grid gap-2">
                      <Label>{createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' ? 'Business Account ID' : 'Account ID'}</Label>
                      <Input value={createForm.externalAccountId} onChange={(e) => setCreateForm((prev) => ({ ...prev, externalAccountId: e.target.value }))} className="h-11 rounded-xl" placeholder="Cuenta conectada" />
                    </div>
                    <div className="grid gap-2">
                      <Label>{createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' ? 'Phone Number ID' : 'Page ID / Inbox ID'}</Label>
                      <Input
                        value={createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' ? createForm.externalPhoneNumberId : createForm.externalPageId}
                        onChange={(e) => setCreateForm((prev) => ({
                          ...prev,
                          ...(createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX'
                            ? { externalPhoneNumberId: e.target.value }
                            : { externalPageId: e.target.value }),
                        }))}
                        className="h-11 rounded-xl"
                        placeholder="Identificador del canal"
                      />
                    </div>
                    {createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' ? (
                      <>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Access Token Cloud API</Label>
                          <Input value={createForm.whatsappAccessToken} onChange={(e) => setCreateForm((prev) => ({ ...prev, whatsappAccessToken: e.target.value }))} className="h-11 rounded-xl" placeholder="EAAG..." />
                          <p className="text-xs leading-5 text-slate-500">Si lo dejas vacío, el inbox seguirá operando en modo demo local para mensajes salientes.</p>
                        </div>
                        <div className="grid gap-2">
                          <Label>Versión Graph API</Label>
                          <Input value={createForm.whatsappApiVersion} onChange={(e) => setCreateForm((prev) => ({ ...prev, whatsappApiVersion: e.target.value }))} className="h-11 rounded-xl" placeholder="v23.0" />
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}

                {!createIsBridge && createForm.provider === 'WEB_FORM' ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Selector del formulario legacy</Label>
                    <Input value={createForm.formSelector} onChange={(e) => setCreateForm((prev) => ({ ...prev, formSelector: e.target.value }))} className="h-11 rounded-xl" placeholder="#lead-form" />
                    <p className="text-xs leading-5 text-slate-500">Se conserva para sitios que ya tienen su propio formulario. El modo recomendado ahora es iframe público hospedado por SGDigital.</p>
                  </div>
                ) : null}

                {createForm.provider === 'WEB_FORM' ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Tipo de bridge</Label>
                    <Select value={createForm.bridgeKind} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, bridgeKind: value as CrmBridgeKind }))}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERIC">GENERIC</SelectItem>
                        <SelectItem value="GMAIL">GMAIL</SelectItem>
                        <SelectItem value="OUTLOOK">OUTLOOK</SelectItem>
                        <SelectItem value="TIKTOK">TIKTOK</SelectItem>
                        <SelectItem value="YOUTUBE">YOUTUBE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {createIsPublicWebForm ? (
                  <>
                    <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Publicar formulario por iframe</p>
                        <p className="text-xs text-slate-500">Genera una URL pública y un iframe listo para pegar en el sitio del cliente.</p>
                      </div>
                      <Switch checked={createForm.publicEmbedEnabled} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, publicEmbedEnabled: checked }))} />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Título del formulario</Label>
                      <Input value={createForm.formTitle} onChange={(e) => setCreateForm((prev) => ({ ...prev, formTitle: e.target.value }))} className="h-11 rounded-xl" />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Descripción comercial</Label>
                      <Textarea value={createForm.formDescription} onChange={(e) => setCreateForm((prev) => ({ ...prev, formDescription: e.target.value }))} rows={3} className="rounded-2xl" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Altura del iframe</Label>
                      <Input value={createForm.iframeHeight} onChange={(e) => setCreateForm((prev) => ({ ...prev, iframeHeight: normalizePixelValue(e.target.value, '840') }))} className="h-11 rounded-xl" placeholder="840" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Texto del CTA</Label>
                      <Input value={createForm.submitCtaLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, submitCtaLabel: e.target.value }))} className="h-11 rounded-xl" />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Mensaje de éxito</Label>
                      <Textarea value={createForm.formSuccessMessage} onChange={(e) => setCreateForm((prev) => ({ ...prev, formSuccessMessage: e.target.value }))} rows={2} className="rounded-2xl" />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Dominios permitidos</Label>
                      <Textarea value={createForm.allowedDomains} onChange={(e) => setCreateForm((prev) => ({ ...prev, allowedDomains: e.target.value }))} rows={3} className="rounded-2xl" placeholder="cliente.com, demo.cliente.com" />
                    </div>
                    <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:col-span-2 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <p className="text-sm font-semibold text-slate-900">Estilo visual del formulario</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Ajusta look, radios, spacing, tipografía y CTA sin escribir código.</p>
                      </div>
                      <div className="grid gap-2">
                        <Label>Color de acento</Label>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <input type="color" value={createForm.accentColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, accentColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar color de acento" />
                          <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.accentColor }} />
                          <Input value={createForm.accentColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, accentColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Color CTA</Label>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <input type="color" value={createForm.formCtaColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formCtaColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar color CTA" />
                          <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.formCtaColor }} />
                          <Input value={createForm.formCtaColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formCtaColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Fondo general</Label>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <input type="color" value={createForm.pageBackgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, pageBackgroundColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar fondo general" />
                          <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.pageBackgroundColor }} />
                          <Input value={createForm.pageBackgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, pageBackgroundColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Fondo interno</Label>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <input type="color" value={createForm.backgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, backgroundColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar fondo interno" />
                          <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.backgroundColor }} />
                          <Input value={createForm.backgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, backgroundColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Color labels</Label>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <input type="color" value={createForm.formLabelColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formLabelColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar color labels" />
                          <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.formLabelColor }} />
                          <Input value={createForm.formLabelColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formLabelColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Color borde inputs</Label>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <input type="color" value={createForm.formInputBorderColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formInputBorderColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar borde inputs" />
                          <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.formInputBorderColor }} />
                          <Input value={createForm.formInputBorderColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formInputBorderColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Fondo inputs</Label>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <input type="color" value={createForm.formInputBackgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formInputBackgroundColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar fondo inputs" />
                          <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.formInputBackgroundColor }} />
                          <Input value={createForm.formInputBackgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formInputBackgroundColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Texto inputs</Label>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <input type="color" value={createForm.formInputTextColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formInputTextColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar texto inputs" />
                          <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.formInputTextColor }} />
                          <Input value={createForm.formInputTextColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formInputTextColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Texto CTA</Label>
                        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <input type="color" value={createForm.formCtaTextColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formCtaTextColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar texto CTA" />
                          <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.formCtaTextColor }} />
                          <Input value={createForm.formCtaTextColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, formCtaTextColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Fuente CSS</Label>
                        <Input value={createForm.fontFamily} onChange={(e) => setCreateForm((prev) => ({ ...prev, fontFamily: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Tamaño base</Label>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <Input value={createForm.formFontSize} onChange={(e) => setCreateForm((prev) => ({ ...prev, formFontSize: normalizePixelValue(e.target.value, '14') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                          <span className="text-xs font-medium text-slate-500">px</span>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Radio tarjeta</Label>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <Input value={createForm.formCardRadius} onChange={(e) => setCreateForm((prev) => ({ ...prev, formCardRadius: normalizePixelValue(e.target.value, '28') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                          <span className="text-xs font-medium text-slate-500">px</span>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Radio inputs</Label>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <Input value={createForm.formInputRadius} onChange={(e) => setCreateForm((prev) => ({ ...prev, formInputRadius: normalizePixelValue(e.target.value, '16') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                          <span className="text-xs font-medium text-slate-500">px</span>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Espaciado entre campos</Label>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <Input value={createForm.formFieldSpacing} onChange={(e) => setCreateForm((prev) => ({ ...prev, formFieldSpacing: normalizePixelValue(e.target.value, '14') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                          <span className="text-xs font-medium text-slate-500">px</span>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Padding interno</Label>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <Input value={createForm.formPadding} onChange={(e) => setCreateForm((prev) => ({ ...prev, formPadding: normalizePixelValue(e.target.value, '24') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" />
                          <span className="text-xs font-medium text-slate-500">px</span>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:col-span-2 md:grid-cols-2 xl:grid-cols-3">
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
                          <Switch checked={Boolean(createForm[field.key as keyof ChannelFormState])} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, [field.key]: checked }))} />
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                      <div className="grid gap-2"><Label>Label nombre</Label><Input value={createForm.nameLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, nameLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Placeholder nombre</Label><Input value={createForm.namePlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, namePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Label correo</Label><Input value={createForm.emailLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, emailLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Placeholder correo</Label><Input value={createForm.emailPlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, emailPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Label teléfono</Label><Input value={createForm.phoneLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, phoneLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Placeholder teléfono</Label><Input value={createForm.phonePlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, phonePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Label empresa</Label><Input value={createForm.companyLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, companyLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Placeholder empresa</Label><Input value={createForm.companyPlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, companyPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Label ciudad</Label><Input value={createForm.cityLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, cityLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Placeholder ciudad</Label><Input value={createForm.cityPlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, cityPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Label producto</Label><Input value={createForm.productLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, productLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Placeholder producto</Label><Input value={createForm.productPlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, productPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Label mensaje</Label><Input value={createForm.messageLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, messageLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Placeholder mensaje</Label><Input value={createForm.messagePlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, messagePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                    </div>
                  </>
                ) : null}

                {createIsChatbot ? (
                  <>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Título visible del chatbot</Label>
                      <Input value={createForm.chatbotTitle} onChange={(e) => setCreateForm((prev) => ({ ...prev, chatbotTitle: e.target.value }))} className="h-11 rounded-xl" />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Nombre del asistente</Label>
                      <Input value={createForm.assistantName} onChange={(e) => setCreateForm((prev) => ({ ...prev, assistantName: e.target.value }))} className="h-11 rounded-xl" />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Prompt inicial</Label>
                      <Textarea value={createForm.chatbotPrompt} onChange={(e) => setCreateForm((prev) => ({ ...prev, chatbotPrompt: e.target.value }))} rows={4} className="rounded-2xl" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Altura del iframe</Label>
                      <Input value={createForm.iframeHeight} onChange={(e) => setCreateForm((prev) => ({ ...prev, iframeHeight: e.target.value }))} className="h-11 rounded-xl" placeholder="720" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Color de acento</Label>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                        <input
                          type="color"
                          value={createForm.accentColor}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, accentColor: e.target.value }))}
                          className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                          aria-label="Seleccionar color de acento"
                        />
                        <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.accentColor }} />
                        <Input value={createForm.accentColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, accentColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="#1d4ed8" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Color de fondo general</Label>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                        <input
                          type="color"
                          value={createForm.pageBackgroundColor}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, pageBackgroundColor: e.target.value }))}
                          className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                          aria-label="Seleccionar color de fondo general"
                        />
                        <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.pageBackgroundColor }} />
                        <Input value={createForm.pageBackgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, pageBackgroundColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="#eef5ff" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Color de fondo interno</Label>
                      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                        <input
                          type="color"
                          value={createForm.backgroundColor}
                          onChange={(e) => setCreateForm((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                          className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                          aria-label="Seleccionar color de fondo interno"
                        />
                        <div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.backgroundColor }} />
                        <Input value={createForm.backgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, backgroundColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="#f8fbff" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Fuente CSS</Label>
                      <Input value={createForm.fontFamily} onChange={(e) => setCreateForm((prev) => ({ ...prev, fontFamily: e.target.value }))} className="h-11 rounded-xl" placeholder="ui-sans-serif, system-ui, sans-serif" />
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Habilitar launcher flotante</p>
                        <p className="text-xs text-slate-500">Controla si se genera y se usa el botón flotante además del iframe público.</p>
                      </div>
                      <Switch checked={createForm.floatingLauncherEnabled} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, floatingLauncherEnabled: checked }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Texto del launcher flotante</Label>
                      <Input value={createForm.launcherLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, launcherLabel: e.target.value }))} className="h-11 rounded-xl" placeholder="Abrir asesor virtual" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Icono del launcher</Label>
                      <Select value={createForm.launcherIcon} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, launcherIcon: value }))}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bot">bot</SelectItem>
                          <SelectItem value="message-circle">message-circle</SelectItem>
                          <SelectItem value="sparkles">sparkles</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Posición del launcher</Label>
                      <Select value={createForm.launcherPosition} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, launcherPosition: value as LauncherPosition }))}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="right">Derecha</SelectItem>
                          <SelectItem value="left">Izquierda</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Tamaño del launcher</Label>
                      <Select value={createForm.launcherSize} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, launcherSize: value as LauncherSize }))}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compact">Compacto</SelectItem>
                          <SelectItem value="standard">Estándar</SelectItem>
                          <SelectItem value="large">Grande</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Dominios permitidos</Label>
                      <Textarea value={createForm.allowedDomains} onChange={(e) => setCreateForm((prev) => ({ ...prev, allowedDomains: e.target.value }))} rows={3} className="rounded-2xl" placeholder="cliente.com, demo.cliente.com" />
                    </div>
                    <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:col-span-2 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <p className="text-sm font-semibold text-slate-900">Estilos avanzados fáciles</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Ajusta apariencia del panel con valores simples, sin escribir CSS ni JSON.</p>
                      </div>
                      <div className="grid gap-2">
                        <Label>Etiqueta superior</Label>
                        <Input value={createForm.headerBadgeLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, headerBadgeLabel: e.target.value }))} className="h-11 rounded-xl" placeholder="Chatbot CRM" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Estado del asistente</Label>
                        <Input value={createForm.statusBadgeLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, statusBadgeLabel: e.target.value }))} className="h-11 rounded-xl" placeholder="En linea" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Radio del panel</Label>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <Input value={createForm.chatShellRadius} onChange={(e) => setCreateForm((prev) => ({ ...prev, chatShellRadius: normalizePixelValue(e.target.value, '30') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="30" />
                          <span className="text-xs font-medium text-slate-500">px</span>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label>Radio de burbujas</Label>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                          <Input value={createForm.messageBubbleRadius} onChange={(e) => setCreateForm((prev) => ({ ...prev, messageBubbleRadius: normalizePixelValue(e.target.value, '22') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="22" />
                          <span className="text-xs font-medium text-slate-500">px</span>
                        </div>
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label>Sombra del panel</Label>
                        <Select value={createForm.panelShadowPreset} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, panelShadowPreset: value as PanelShadowPreset }))}>
                          <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="soft">Suave</SelectItem>
                            <SelectItem value="medium">Media</SelectItem>
                            <SelectItem value="strong">Fuerte</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Solicitar producto en la captura inicial</p>
                        <p className="text-xs text-slate-500">Permite que el bot consulte inventario y responda con referencia, precio y disponibilidad.</p>
                      </div>
                      <Switch checked={createForm.showProductField} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, showProductField: checked }))} />
                    </div>
                    <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Label nombre</Label>
                        <Input value={createForm.nameLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, nameLabel: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Placeholder nombre</Label>
                        <Input value={createForm.namePlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, namePlaceholder: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Label correo</Label>
                        <Input value={createForm.emailLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, emailLabel: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Placeholder correo</Label>
                        <Input value={createForm.emailPlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, emailPlaceholder: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Label teléfono</Label>
                        <Input value={createForm.phoneLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, phoneLabel: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Placeholder teléfono</Label>
                        <Input value={createForm.phonePlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, phonePlaceholder: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Label producto</Label>
                        <Input value={createForm.productLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, productLabel: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Placeholder producto</Label>
                        <Input value={createForm.productPlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, productPlaceholder: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Label mensaje</Label>
                        <Input value={createForm.messageLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, messageLabel: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Placeholder mensaje</Label>
                        <Input value={createForm.messagePlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, messagePlaceholder: e.target.value }))} className="h-11 rounded-xl" />
                      </div>
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Publicar iframe sin token</p>
                        <p className="text-xs text-slate-500">Recomendado para la demo controlada del cliente.</p>
                      </div>
                      <Switch checked={createForm.publicEmbedEnabled} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, publicEmbedEnabled: checked }))} />
                    </div>
                  </>
                ) : null}
                </div>
                ) : wizardStep === 'review' ? (
                  <div className="space-y-4">
                    <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resumen final</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Canal</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{createForm.name || createPreset.name}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Proveedor</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{createForm.provider}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:col-span-2">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Endpoint o ruta</p>
                          <p className="mt-2 break-all text-sm font-semibold text-slate-900">{wizardPreview.endpointPreview}</p>
                        </div>
                        {createForm.provider === 'WEB_CHATBOT' ? (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 sm:col-span-2">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-700">Iframe del chatbot</p>
                            <p className="mt-2 break-all text-sm font-semibold text-emerald-900">{wizardPreview.iframeUrl}</p>
                            <p className="mt-2 text-xs text-emerald-800">Se habilita automáticamente al crear el canal y luego también queda visible en la vista previa lateral del canal.</p>
                          </div>
                        ) : null}
                        {createIsPublicWebForm ? (
                          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3 sm:col-span-2">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-sky-700">Iframe del formulario</p>
                            <p className="mt-2 break-all text-sm font-semibold text-sky-900">{wizardPreview.iframeUrl}</p>
                            <p className="mt-2 text-xs text-sky-800">Quedará disponible al crear el canal para copiar la URL pública o el iframe desde la pestaña Formulario.</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[26px] border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
                    Elige una plantilla a la izquierda para continuar con la configuración.
                  </div>
                )}
              </div>

              <DialogFooter className="mt-5 border-t border-slate-100 pt-5">
                <Button variant="outline" className="rounded-xl" onClick={() => setWizardStep(wizardStep === 'review' ? 'config' : 'template')} disabled={saving || wizardStep === 'template'}>Atrás</Button>
                {wizardStep !== 'review' ? <Button variant="outline" className="rounded-xl" onClick={() => setWizardStep(wizardStep === 'template' ? 'config' : 'review')} disabled={saving}>{wizardStep === 'template' ? 'Continuar' : 'Revisar canal'}</Button> : null}
                <Button variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)} disabled={saving}>Cancelar</Button>
                <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => void saveChannel()} disabled={saving || wizardStep !== 'review'}>
                  {saving ? (editingChannelId ? 'Guardando...' : 'Creando...') : (editingChannelId ? 'Guardar cambios' : 'Crear canal')}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteCandidate)} onOpenChange={(open) => { if (!open && !deletingChannelId) setDeleteCandidate(null) }}>
        <DialogContent className="max-w-lg rounded-[30px] border-rose-200 bg-white p-0 shadow-[0_28px_80px_-42px_rgba(244,63,94,0.35)]">
          <div className="rounded-t-[30px] bg-[radial-gradient(circle_at_top_left,rgba(251,113,133,.18),transparent_40%),linear-gradient(180deg,#fff1f2,#ffffff)] p-6">
            <DialogHeader>
              <DialogTitle>Eliminar canal configurado</DialogTitle>
              <DialogDescription>Esta acción solo funciona si el canal aún no tiene conversaciones ni capturas asociadas.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 p-6 pt-4">
            <div className="rounded-[24px] border border-rose-200 bg-rose-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">Canal seleccionado</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{deleteCandidate?.name}</p>
              <p className="mt-1 text-sm text-slate-600">{deleteCandidate ? getChannelProviderLabel(deleteCandidate.provider, getBridgeKind((deleteCandidate.settingsJson as Record<string, unknown> | null | undefined) ?? null)) : ''}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">Si ya hubo actividad, el backend bloqueará la eliminación para proteger el histórico comercial.</p>
            </div>
            <DialogFooter className="border-t border-slate-100 pt-4">
              <Button variant="outline" className="rounded-xl" onClick={() => setDeleteCandidate(null)} disabled={Boolean(deletingChannelId)}>
                Cancelar
              </Button>
              <Button
                className="rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                onClick={() => deleteCandidate ? void deleteChannel(deleteCandidate.id) : undefined}
                disabled={Boolean(deletingChannelId)}
              >
                {deletingChannelId ? 'Eliminando...' : 'Confirmar eliminación'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}