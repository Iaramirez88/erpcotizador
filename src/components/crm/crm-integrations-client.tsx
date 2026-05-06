"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { Activity, BarChart3, Bot, Download, Eye, Facebook, Globe, Goal, Instagram, Mail, MessageCircle, Sparkles, Target, TrendingUp, Upload } from 'lucide-react'
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
import {
  createWebFormEntityId,
  normalizeWebFormCustomFields,
  normalizeWebFormVariables,
  type WebFormCustomField,
  type WebFormCustomFieldType,
  type WebFormVariable,
} from '@/lib/crm-web-form-schema'

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
type CrmOperationsPanelView = 'preview' | 'readiness' | 'assets'
type LauncherPosition = 'right' | 'left'
type LauncherSize = 'compact' | 'standard' | 'large'
type PanelShadowPreset = 'soft' | 'medium' | 'strong'
type ChatbotBuilderSection = 'brand' | 'flow' | 'launcher' | 'copy'
type ChatbotWizardSection = 'base' | 'brand' | 'launcher' | 'copy'
type WebFormConfigSection = 'base' | 'styles' | 'fields' | 'variables' | 'size' | 'texts' | 'terms' | 'technical'

type GoogleSheetsActionState = {
  loadingPreview: boolean
  loadingImport: boolean
  previewResult: null | {
    csvUrl: string
    totalRows: number
    headers: string[]
    preview: Array<Record<string, unknown>>
  }
  importResult: null | {
    importedRows: number
    skippedRows: number
    opportunitiesCreated: number
    processedRows: number
  }
  error: string
}

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
  optionId: string
  label: string
  path: string
  labelX: number
  labelY: number
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

type MetaConnectionFeedback = {
  status: 'connected' | 'error'
  message: string
}

type MetaOnboardingState = 'idle' | 'waiting' | 'success' | 'error'

type MetaSelectionTarget = 'phone' | 'page' | 'instagram' | null

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
  | 'webFormCustomFields'
  | 'webFormVariables'
  | 'termsEnabled'
  | 'termsRequired'
  | 'termsLabel'
  | 'termsLinkText'
  | 'termsLinkUrl'
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

const WEB_FORM_SECTION_OPTIONS: Array<{ id: WebFormConfigSection; label: string }> = [
  { id: 'base', label: 'Base del canal' },
  { id: 'styles', label: 'Estilos' },
  { id: 'fields', label: 'Campos' },
  { id: 'variables', label: 'Variables' },
  { id: 'size', label: 'Tamaño' },
  { id: 'texts', label: 'Textos' },
  { id: 'terms', label: 'Términos' },
  { id: 'technical', label: 'Configuración técnica' },
]

const WEB_FORM_CUSTOM_FIELD_TYPE_OPTIONS: Array<{ value: WebFormCustomFieldType; label: string }> = [
  { value: 'input', label: 'Input' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Select' },
  { value: 'check', label: 'Check' },
  { value: 'file', label: 'File' },
]

const CHATBOT_WIZARD_SECTION_OPTIONS: Array<{ id: ChatbotWizardSection; label: string }> = [
  { id: 'base', label: 'Base del canal' },
  { id: 'brand', label: 'Marca y panel' },
  { id: 'launcher', label: 'Launcher' },
  { id: 'copy', label: 'Captura y copy' },
]

function getWebFormFieldTypeLabel(type: WebFormCustomFieldType) {
  return WEB_FORM_CUSTOM_FIELD_TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type
}

function getInitialChannelForm() {
  return {
    templateKey: 'web-form',
    name: 'Formulario Web Principal',
    provider: 'WEB_FORM' as CrmChannelProvider,
    status: 'TESTING' as ChannelStatus,
    testingToken: makeDemoToken(),
    bridgeKind: 'GENERIC' as CrmBridgeKind,
    googleSheetsSpreadsheetId: '',
    googleSheetsSheetName: 'Leads',
    googleSheetsPublishedCsvUrl: '',
    googleSheetsRowLimit: '200',
    googleSheetsImportMode: 'LEADS_ONLY' as 'LEADS_ONLY' | 'LEADS_AND_OPPORTUNITIES',
    googleSheetsOpportunityStage: 'QUALIFIED',
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
    webFormCustomFields: [] as WebFormCustomField[],
    webFormVariables: [] as WebFormVariable[],
    termsEnabled: false,
    termsRequired: true,
    termsLabel: 'Acepto el tratamiento de datos personales.',
    termsLinkText: 'Leer términos',
    termsLinkUrl: '',
  }
}

function getInitialGoogleSheetsActionState(): GoogleSheetsActionState {
  return {
    loadingPreview: false,
    loadingImport: false,
    previewResult: null,
    importResult: null,
    error: '',
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
  { key: 'google-sheets-bridge', name: 'Google Sheets Bridge', provider: 'WEB_FORM', bridgeKind: 'GOOGLE_SHEETS', description: 'Importa y exporta leads desde hojas comerciales sin crear otro módulo.', connectionModel: 'CSV bridge', readiness: 'Operativo hoy', focus: 'Backoffice comercial y campañas' },
  { key: 'tiktok-bridge', name: 'TikTok Lead Bridge', provider: 'WEB_FORM', bridgeKind: 'TIKTOK', description: 'Usa Make/Zapier o webhook para llevar leads al CRM.', connectionModel: 'Bridge automation', readiness: 'Demo guiada', focus: 'Lead Ads y formularios externos' },
  { key: 'youtube-bridge', name: 'YouTube Lead Bridge', provider: 'WEB_FORM', bridgeKind: 'YOUTUBE', description: 'Bridge para formularios, comentarios o capturas desde campañas.', connectionModel: 'Bridge automation', readiness: 'Demo guiada', focus: 'Captura desde video y campañas' },
]

const MANAGED_CHANNEL_SETTING_KEYS = new Set([
  'testingToken',
  'bridgeKind',
  'googleSheetsSpreadsheetId',
  'googleSheetsSheetName',
  'googleSheetsPublishedCsvUrl',
  'googleSheetsRowLimit',
  'googleSheetsImportMode',
  'googleSheetsOpportunityStage',
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
  'webFormCustomFields',
  'webFormVariables',
  'termsEnabled',
  'termsRequired',
  'termsLabel',
  'termsLinkText',
  'termsLinkUrl',
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
  if (preset.bridgeKind === 'GOOGLE_SHEETS') return BarChart3
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

  if (preset.bridgeKind === 'GOOGLE_SHEETS') {
    return {
      card: 'border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.92),rgba(255,255,255,0.98))]',
      selected: 'border-emerald-300 bg-emerald-50/90 ring-2 ring-emerald-200',
      iconWrap: 'border-emerald-200 bg-emerald-100 text-emerald-700',
      pill: 'bg-emerald-100 text-emerald-700',
      accent: 'text-emerald-800',
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

function getGoogleSheetsCsvUrl(settingsJson: Record<string, unknown> | null | undefined) {
  const publishedCsvUrl = typeof settingsJson?.googleSheetsPublishedCsvUrl === 'string'
    ? settingsJson.googleSheetsPublishedCsvUrl.trim()
    : ''
  if (publishedCsvUrl) return publishedCsvUrl

  const spreadsheetId = typeof settingsJson?.googleSheetsSpreadsheetId === 'string'
    ? settingsJson.googleSheetsSpreadsheetId.trim()
    : ''
  const sheetName = typeof settingsJson?.googleSheetsSheetName === 'string' && settingsJson.googleSheetsSheetName.trim()
    ? settingsJson.googleSheetsSheetName.trim()
    : 'Leads'

  if (!spreadsheetId) return ''

  const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/gviz/tq?tqx=out:csv`
  return sheetName ? `${base}&sheet=${encodeURIComponent(sheetName)}` : base
}

function getGoogleSheetsSpreadsheetId(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.googleSheetsSpreadsheetId === 'string' ? settingsJson.googleSheetsSpreadsheetId : ''
}

function getGoogleSheetsSheetName(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.googleSheetsSheetName === 'string' && settingsJson.googleSheetsSheetName.trim() ? settingsJson.googleSheetsSheetName : 'Leads'
}

function getGoogleSheetsPublishedCsvUrl(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.googleSheetsPublishedCsvUrl === 'string' ? settingsJson.googleSheetsPublishedCsvUrl : ''
}

function getGoogleSheetsRowLimit(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.googleSheetsRowLimit === 'string' && settingsJson.googleSheetsRowLimit.trim() ? settingsJson.googleSheetsRowLimit : '200'
}

function getGoogleSheetsImportMode(settingsJson: Record<string, unknown> | null | undefined) {
  return settingsJson?.googleSheetsImportMode === 'LEADS_AND_OPPORTUNITIES' ? 'LEADS_AND_OPPORTUNITIES' : 'LEADS_ONLY'
}

function getGoogleSheetsOpportunityStage(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.googleSheetsOpportunityStage === 'string' && settingsJson.googleSheetsOpportunityStage.trim() ? settingsJson.googleSheetsOpportunityStage : 'QUALIFIED'
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

function getWebFormCustomFieldPlaceholder(field: WebFormCustomField) {
  if (field.type === 'check') return field.defaultValue || 'Acepto esta opción'
  if (field.type === 'file') return field.defaultValue || 'Selecciona uno o más archivos'
  if (field.type === 'select') return field.defaultValue || field.options[0] || 'Selecciona una opción'
  return field.placeholder || field.defaultValue || 'Campo personalizado'
}

function renderWebFormCustomFieldPreview(field: WebFormCustomField, args: {
  borderColor: string
  backgroundColor: string
  textColor: string
  inputRadius: string
  labelColor: string
  messageMinHeight: number
}) {
  const inputClassName = field.fullWidth ? 'grid gap-2 md:col-span-2' : 'grid gap-2'
  const inputStyle = {
    borderRadius: `${normalizePixelValue(args.inputRadius, '16')}px`,
    border: `1px solid ${args.borderColor}`,
    backgroundColor: args.backgroundColor,
    color: args.textColor,
  }

  return (
    <div key={field.id} className={inputClassName}>
      <p className="text-xs font-semibold" style={{ color: args.labelColor }}>
        {field.label}
        {field.required ? ' *' : ''}
      </p>
      {field.type === 'textarea' ? (
        <div className="px-4 py-3" style={{ ...inputStyle, minHeight: args.messageMinHeight }}>{getWebFormCustomFieldPlaceholder(field)}</div>
      ) : field.type === 'check' ? (
        <div className="flex items-center gap-3 px-4 py-3" style={inputStyle}>
          <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-[11px] font-semibold text-slate-500">{field.defaultValue ? 'OK' : ''}</span>
          <span>{getWebFormCustomFieldPlaceholder(field)}</span>
        </div>
      ) : field.type === 'file' ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={inputStyle}>
          <span>{getWebFormCustomFieldPlaceholder(field)}</span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">Adjuntar</span>
        </div>
      ) : field.type === 'select' ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={inputStyle}>
          <span>{getWebFormCustomFieldPlaceholder(field)}</span>
          <span className="text-xs text-slate-400">{field.options.length} opciones</span>
        </div>
      ) : (
        <div className="px-4 py-3" style={inputStyle}>{getWebFormCustomFieldPlaceholder(field)}</div>
      )}
      {field.helpText ? <p className="text-[11px] leading-5 text-slate-500">{field.helpText}</p> : null}
    </div>
  )
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
            {builderState.webFormCustomFields.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {builderState.webFormCustomFields.map((field) => renderWebFormCustomFieldPreview(field, {
                  borderColor: builderState.formInputBorderColor,
                  backgroundColor: builderState.formInputBackgroundColor,
                  textColor: builderState.formInputTextColor,
                  inputRadius: builderState.formInputRadius,
                  labelColor: builderState.formLabelColor,
                  messageMinHeight,
                }))}
              </div>
            ) : null}
            {builderState.termsEnabled ? (
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
                <p className="font-medium text-slate-900">{builderState.termsLabel}{builderState.termsRequired ? ' *' : ''}</p>
                {builderState.termsLinkUrl ? <p className="mt-1 text-xs text-slate-500">{builderState.termsLinkText} · {builderState.termsLinkUrl}</p> : null}
              </div>
            ) : null}
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
    if (bridgeKind === 'GOOGLE_SHEETS') return `${baseUrl}/api/crm/channels/${channel.id}/google-sheets/import`
    return bridgeKind && bridgeKind !== 'GENERIC' ? `${baseUrl}/api/crm/captures/bridge` : `${baseUrl}/api/crm/captures/web-form`
  }
  if (channel.provider === 'WEB_CHATBOT') return `${baseUrl}/api/crm/captures/chatbot`
  if (usesMetaProvider(channel.provider)) return `${baseUrl}/api/webhooks/meta`
  return `${baseUrl}/api/crm/channels/${channel.id}/webhook`
}

function channelTone(provider: CrmChannelProvider, bridgeKind: string) {
  if (provider === 'WEB_CHATBOT') return 'border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,.92),rgba(255,255,255,.98))]'
  if (provider === 'WEB_FORM' && bridgeKind === 'GOOGLE_SHEETS') return 'border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,.95),rgba(255,255,255,.98))]'
  if (provider === 'WEB_FORM' && (bridgeKind === 'GMAIL' || bridgeKind === 'OUTLOOK')) return 'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,.95),rgba(255,255,255,.98))]'
  if (provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX') return 'border-emerald-200 bg-[linear-gradient(180deg,rgba(220,252,231,.95),rgba(255,255,255,.98))]'
  return 'border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,.96),rgba(255,255,255,.98))]'
}

function providerSummary(provider: CrmChannelProvider, bridgeKind: CrmBridgeKind) {
  if (provider === 'WEB_CHATBOT') return 'Canal conversacional embebible por iframe con captura en tiempo real.'
  if (provider === 'WEB_FORM' && bridgeKind === 'GENERIC') return 'Canal de captura vía formularios y landings con tracking comercial.'
  if (provider === 'WEB_FORM' && bridgeKind === 'GOOGLE_SHEETS') return 'Bridge manual para importar y exportar leads desde hojas comerciales ya operativas.'
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

function isPublicAppUrl(baseUrl: string) {
  return Boolean(baseUrl) && !/localhost|127\.0\.0\.1/i.test(baseUrl)
}

function hasManualMetaConfiguration(form: ChannelFormState) {
  return Boolean(
    form.externalAccountId.trim()
    || form.externalPageId.trim()
    || form.externalPhoneNumberId.trim()
    || form.whatsappAccessToken.trim()
    || form.whatsappApiVersion.trim() !== 'v23.0'
  )
}

function getMetaWizardChecklist(form: ChannelFormState, baseUrl: string): ReadinessItem[] {
  const isWhatsApp = form.provider === 'WHATSAPP_CLOUD' || form.provider === 'WHATSAPP_SANDBOX'

  return [
    {
      label: 'Canal en modo de prueba o activo',
      done: form.status === 'TESTING' || form.status === 'ACTIVE',
      hint: 'Meta y el webhook operan mejor cuando el canal ya quedó en TESTING o ACTIVE.',
    },
    {
      label: 'Token de verificación listo',
      done: Boolean(form.testingToken.trim()),
      hint: 'Úsalo para pruebas, validaciones iniciales y fallback de verificación por canal.',
    },
    {
      label: 'URL base detectada',
      done: Boolean(baseUrl),
      hint: isPublicAppUrl(baseUrl) ? 'La URL detectada parece pública y sirve como base para callback y webhook.' : 'Si vas a conectar clientes externos, cambia localhost por un dominio público en HTTPS.',
    },
    {
      label: isWhatsApp ? 'OAuth recomendado antes de credenciales manuales' : 'OAuth recomendado antes de IDs manuales',
      done: !hasManualMetaConfiguration(form),
      hint: isWhatsApp ? 'Primero conecta Meta; deja Business Account, Phone Number ID y Access Token manuales solo para casos especiales.' : 'Primero conecta Meta; deja Account ID o Page ID manuales solo como respaldo.',
    },
  ]
}

function getMetaSelectionGuide(channel: ChannelConnection, metaState: ReturnType<typeof getMetaConnectionState>) {
  if (channel.provider === 'WHATSAPP_CLOUD' || channel.provider === 'WHATSAPP_SANDBOX') {
    if (!metaState.whatsappAssets.length) {
      return {
        tone: 'amber' as const,
        title: 'Meta ya respondió, pero aún no hay números sincronizados',
        description: 'Pulsa Sincronizar Meta y confirma que la cuenta conectada sí tenga acceso al WhatsApp Business Account y al número correcto.',
      }
    }

    if (!metaState.selectedPhoneNumberId && !channel.externalPhoneNumberId) {
      return {
        tone: 'amber' as const,
        title: 'Falta elegir el número activo',
        description: 'La cuenta ya quedó conectada. El siguiente paso es seleccionar el número sincronizado y pulsar Aplicar número activo.',
      }
    }

    return {
      tone: 'emerald' as const,
      title: 'Número activo aplicado',
      description: 'El canal ya tiene un número seleccionado. Ahora solo falta validar webhook y hacer una prueba real de conversación.',
    }
  }

  if (channel.provider === 'INSTAGRAM_DM') {
    if (!metaState.pages.some((item) => item.instagramAccountId)) {
      return {
        tone: 'amber' as const,
        title: 'No se encontró una cuenta de Instagram sincronizada',
        description: 'Revisa permisos de Meta y vuelve a sincronizar para traer la cuenta de Instagram vinculada a la página correcta.',
      }
    }

    if (!metaState.selectedInstagramAccountId && !channel.externalAccountId) {
      return {
        tone: 'amber' as const,
        title: 'Falta elegir la cuenta activa',
        description: 'Selecciona la cuenta de Instagram sincronizada y pulsa Aplicar cuenta activa para terminar el enlace del canal.',
      }
    }

    return {
      tone: 'emerald' as const,
      title: 'Cuenta de Instagram aplicada',
      description: 'El canal ya quedó apuntando al activo correcto. Continúa con webhook y una prueba de DM real.',
    }
  }

  if (!metaState.pages.length) {
    return {
      tone: 'amber' as const,
      title: 'Meta ya respondió, pero aún no hay páginas sincronizadas',
      description: 'Pulsa Sincronizar Meta y confirma que la cuenta conectada sí tenga acceso a la página que quieres llevar al inbox.',
    }
  }

  if (!metaState.selectedPageId && !channel.externalPageId) {
    return {
      tone: 'amber' as const,
      title: 'Falta elegir la página activa',
      description: 'Selecciona la página sincronizada y pulsa Aplicar página activa para terminar el enlace del canal.',
    }
  }

  return {
    tone: 'emerald' as const,
    title: 'Página activa aplicada',
    description: 'El activo principal ya quedó seleccionado. Continúa con webhook y una prueba real desde Meta.',
  }
}

function getMetaOnboardingChecklist(channel: ChannelConnection, baseUrl: string): ReadinessItem[] {
  const settings = (channel.settingsJson as Record<string, unknown> | null | undefined) ?? null
  const token = getTokenFromSettings(settings)

  return [
    {
      label: 'Canal en TESTING o ACTIVE',
      done: channel.status === 'TESTING' || channel.status === 'ACTIVE',
      hint: 'El webhook y las pruebas reales operan mejor cuando el canal ya está listo para test controlado.',
    },
    {
      label: 'Token del canal disponible',
      done: Boolean(token || channel.verifyTokenPreview),
      hint: 'Sirve como respaldo para verificaciones y pruebas internas del canal.',
    },
    {
      label: 'Ruta base detectada',
      done: Boolean(baseUrl),
      hint: isPublicAppUrl(baseUrl) ? 'La URL actual parece pública y sirve bien para callback y webhook.' : 'Estás en localhost. Funciona para pruebas internas, pero no para onboarding externo de clientes.',
    },
  ]
}

function getMetaSelectionTarget(provider: CrmChannelProvider): MetaSelectionTarget {
  if (provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX') return 'phone'
  if (provider === 'INSTAGRAM_DM') return 'instagram'
  if (provider === 'FACEBOOK_PAGE' || provider === 'MESSENGER') return 'page'
  return null
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
    webFormCustomFields: normalizeWebFormCustomFields(settingsJson?.webFormCustomFields),
    webFormVariables: normalizeWebFormVariables(settingsJson?.webFormVariables),
    termsEnabled: getBooleanSetting(settingsJson, 'termsEnabled', false),
    termsRequired: getBooleanSetting(settingsJson, 'termsRequired', true),
    termsLabel: getSettingText(settingsJson, 'termsLabel', 'Acepto el tratamiento de datos personales.'),
    termsLinkText: getSettingText(settingsJson, 'termsLinkText', 'Leer términos'),
    termsLinkUrl: getSettingText(settingsJson, 'termsLinkUrl', ''),
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
  const columns = stages.length <= 4 ? 2 : 3
  const colGap = 92
  const rowGap = 72
  const padding = 24
  const nodes: ChatbotCanvasNode[] = stages.map((stage, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const x = padding + column * (nodeWidth + colGap)
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
          optionId: option.id,
          label: option.label,
          path: `M ${startX} ${startY} C ${loopX} ${startY}, ${loopX} ${loopY}, ${startX - 10} ${loopY} C ${startX - 54} ${loopY}, ${startX - 54} ${startY + 28}, ${startX} ${startY + 28}`,
          labelX: startX - 18,
          labelY: loopY - 16,
        })
        return
      }

      const delta = Math.max(60, Math.abs(endX - startX) / 2)
      connections.push({
        id: `${node.stage.id}-${option.id}`,
        fromStageId: node.stage.id,
        toStageId: targetNode.stage.id,
        optionId: option.id,
        label: option.label,
        path: `M ${startX} ${startY} C ${startX + delta} ${startY}, ${endX - delta} ${endY}, ${endX} ${endY}`,
        labelX: startX + (endX - startX) / 2,
        labelY: startY + (endY - startY) / 2 - 14,
      })
    })
  })

  const maxY = nodes.length ? Math.max(...nodes.map((node) => node.y + node.height)) : 0
  return {
    width: padding * 2 + nodeWidth * columns + colGap * Math.max(0, columns - 1),
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
  const [operationsPanelView, setOperationsPanelView] = useState<CrmOperationsPanelView>('preview')
  const [metricsExpanded, setMetricsExpanded] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [copiedKey, setCopiedKey] = useState('')
  const [activeAssetTab, setActiveAssetTab] = useState('overview')
  const [goalTargets, setGoalTargets] = useState<ChannelGoalTargets>({ operational: '', captures: '', conversations: '' })
  const [createForm, setCreateForm] = useState<ChannelFormState>(getInitialChannelForm())
  const [wizardMetaAdvancedOpen, setWizardMetaAdvancedOpen] = useState(false)
  const [metaConnectionFeedback, setMetaConnectionFeedback] = useState<MetaConnectionFeedback | null>(null)
  const [metaOnboardingOpen, setMetaOnboardingOpen] = useState(false)
  const [metaOnboardingState, setMetaOnboardingState] = useState<MetaOnboardingState>('idle')
  const [metaOnboardingMessage, setMetaOnboardingMessage] = useState('')
  const [metaSelectionFocusTarget, setMetaSelectionFocusTarget] = useState<MetaSelectionTarget>(null)
  const [chatbotBuilderDraft, setChatbotBuilderDraft] = useState<ChatbotBuilderState>(getChatbotBuilderState(null))
  const [chatbotBuilderModalOpen, setChatbotBuilderModalOpen] = useState(false)
  const [savingChatbotBuilder, setSavingChatbotBuilder] = useState(false)
  const [chatbotBuilderPreviewMode, setChatbotBuilderPreviewMode] = useState<ChatbotPreviewMode>('expanded')
  const [chatbotBuilderPreviewViewport, setChatbotBuilderPreviewViewport] = useState<ChatbotPreviewViewport>('desktop')
  const [chatbotBuilderSection, setChatbotBuilderSection] = useState<ChatbotBuilderSection>('flow')
  const [wizardChatbotSection, setWizardChatbotSection] = useState<ChatbotWizardSection>('base')
  const [selectedChatbotStageId, setSelectedChatbotStageId] = useState<ChatbotFlowStageId>('welcome')
  const [selectedChatbotConnectionId, setSelectedChatbotConnectionId] = useState<string | null>(null)
  const [webFormBuilderDraft, setWebFormBuilderDraft] = useState<WebFormBuilderState>(getWebFormBuilderState(null))
  const [webFormBuilderModalOpen, setWebFormBuilderModalOpen] = useState(false)
  const [savingWebFormBuilder, setSavingWebFormBuilder] = useState(false)
  const [webFormBuilderSection, setWebFormBuilderSection] = useState<WebFormConfigSection>('fields')
  const [wizardWebFormSection, setWizardWebFormSection] = useState<WebFormConfigSection>('base')
  const [metaSelectionDraft, setMetaSelectionDraft] = useState({ selectedPageId: '', selectedInstagramAccountId: '', selectedPhoneNumberId: '' })
  const [floatingPreviewOpen, setFloatingPreviewOpen] = useState(false)
  const [wizardChatPreviewMode, setWizardChatPreviewMode] = useState<ChatbotPreviewMode>('floating')
  const [wizardChatPreviewViewport, setWizardChatPreviewViewport] = useState<ChatbotPreviewViewport>('desktop')
  const [googleSheetsActions, setGoogleSheetsActions] = useState<GoogleSheetsActionState>(getInitialGoogleSheetsActionState())
  const metaPopupRef = useRef<Window | null>(null)
  const metaPopupIntervalRef = useRef<number | null>(null)
  const metaPhoneSelectionRef = useRef<HTMLDivElement | null>(null)
  const metaPageSelectionRef = useRef<HTMLDivElement | null>(null)
  const metaInstagramSelectionRef = useRef<HTMLDivElement | null>(null)

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
    return () => {
      if (metaPopupIntervalRef.current) {
        window.clearInterval(metaPopupIntervalRef.current)
      }
      metaPopupIntervalRef.current = null
      metaPopupRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!metaSelectionFocusTarget) return

    const target = metaSelectionFocusTarget === 'phone'
      ? metaPhoneSelectionRef.current
      : metaSelectionFocusTarget === 'page'
        ? metaPageSelectionRef.current
        : metaInstagramSelectionRef.current

    if (!target) return

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timeout = window.setTimeout(() => setMetaSelectionFocusTarget(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [metaSelectionFocusTarget, selectedChannelId])

  useEffect(() => {
    if (metaConnectionFeedback?.status !== 'connected' || metaSelectionFocusTarget) return
    const currentChannel = channels.find((item) => item.id === selectedChannelId) ?? null
    if (!currentChannel) return
    const target = getMetaSelectionTarget(currentChannel.provider)
    if (!target) return
    setMetaSelectionFocusTarget(target)
  }, [channels, metaConnectionFeedback?.status, metaSelectionFocusTarget, selectedChannelId])

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
      setMetaConnectionFeedback({
        status: 'connected',
        message: 'Meta quedó conectada. Revisa los activos sincronizados y aplica el número, página o cuenta correcta antes de pasar a producción.',
      })
      window.history.replaceState({}, '', window.location.pathname)
    } else if (metaStatus === 'error') {
      setMetaConnectionFeedback({
        status: 'error',
        message: message || 'No se pudo completar la conexión con Meta.',
      })
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
  const selectedGoogleSheetsCsvUrl = getGoogleSheetsCsvUrl(selectedSettings)
  const selectedChatbotEmbedUrl = selectedChannel?.provider === 'WEB_CHATBOT' ? buildChatbotEmbedUrl(baseUrl, selectedChannel.id) : ''
  const selectedWebFormEmbedUrl = selectedChannel?.provider === 'WEB_FORM' && selectedBridgeKind === 'GENERIC' ? buildWebFormEmbedUrl(baseUrl, selectedChannel.id) : ''
  const selectedChatbotTitle = getChatbotTitle(selectedSettings)
  const selectedChatbotPrompt = getChatbotPrompt(selectedSettings)
  const selectedChatbotAssistant = getAssistantName(selectedSettings)
  const selectedChatbotAccent = getAccentColor(selectedSettings)
  const selectedReadiness = useMemo(() => selectedChannel ? getChannelReadiness(selectedChannel, baseUrl) : null, [baseUrl, selectedChannel])
  const selectedMeta = useMemo(() => getMetaConnectionState(selectedSettings), [selectedSettings])
  const wizardMetaChecklist = useMemo(() => createUsesWebhook && usesMetaProvider(createForm.provider) ? getMetaWizardChecklist(createForm, baseUrl) : [], [baseUrl, createForm, createUsesWebhook])
  const selectedMetaGuide = useMemo(() => selectedChannel && usesMetaProvider(selectedChannel.provider) ? getMetaSelectionGuide(selectedChannel, selectedMeta) : null, [selectedChannel, selectedMeta])
  const selectedMetaOnboardingChecklist = useMemo(() => selectedChannel && usesMetaProvider(selectedChannel.provider) ? getMetaOnboardingChecklist(selectedChannel, baseUrl) : [], [baseUrl, selectedChannel])
  const operationsPanelSwitcher = selectedChannel ? (
    <div className="flex flex-col items-stretch gap-2 md:items-end">
      <div className="inline-flex h-auto items-center self-start rounded-[18px] border border-slate-200 bg-slate-50 p-1 md:self-auto">
        <button
          type="button"
          onClick={() => setOperationsPanelView('preview')}
          className={operationsPanelView === 'preview' ? 'rounded-[14px] bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm' : 'rounded-[14px] px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800'}
        >
          Vista previa
        </button>
        <button
          type="button"
          onClick={() => setOperationsPanelView('readiness')}
          className={operationsPanelView === 'readiness' ? 'rounded-[14px] bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm' : 'rounded-[14px] px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800'}
        >
          Readiness
        </button>
        <button
          type="button"
          onClick={() => setOperationsPanelView('assets')}
          className={operationsPanelView === 'assets' ? 'rounded-[14px] bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm' : 'rounded-[14px] px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800'}
        >
          Studio de assets
        </button>
      </div>
      <p className="px-1 text-[13px] text-slate-500 md:text-right">
        {operationsPanelView === 'preview'
          ? 'Muestra solo el resumen visual y los accesos rapidos del canal activo.'
          : operationsPanelView === 'readiness'
            ? 'Enfoca la revision de preparacion y pendientes antes de pasar a demo o produccion.'
            : 'Concentra snippets, URLs, tokens y payloads del canal activo en una sola vista dedicada.'}
      </p>
    </div>
  ) : null
  const selectedIsChatbot = selectedChannel?.provider === 'WEB_CHATBOT'
  const selectedIsPublicWebForm = selectedChannel?.provider === 'WEB_FORM' && selectedBridgeKind === 'GENERIC'
  const selectedIsGoogleSheetsBridge = selectedChannel?.provider === 'WEB_FORM' && selectedBridgeKind === 'GOOGLE_SHEETS'
  const selectedChatbotFlowStage = useMemo(() => chatbotBuilderDraft.flowStages.find((item) => item.id === selectedChatbotStageId) ?? chatbotBuilderDraft.flowStages[0] ?? null, [chatbotBuilderDraft.flowStages, selectedChatbotStageId])
  const chatbotCanvasModel = useMemo(() => buildChatbotCanvasModel(chatbotBuilderDraft.flowStages), [chatbotBuilderDraft.flowStages])
  const selectedChatbotConnection = useMemo(
    () => chatbotCanvasModel.connections.find((item) => item.id === selectedChatbotConnectionId) ?? null,
    [chatbotCanvasModel.connections, selectedChatbotConnectionId],
  )
  const selectedChatbotConnectionSourceStage = useMemo(
    () => selectedChatbotConnection ? chatbotBuilderDraft.flowStages.find((item) => item.id === selectedChatbotConnection.fromStageId) ?? null : null,
    [chatbotBuilderDraft.flowStages, selectedChatbotConnection],
  )
  const selectedChatbotConnectionOption = useMemo(
    () => selectedChatbotConnectionSourceStage?.responseOptions.find((item) => item.id === selectedChatbotConnection?.optionId) ?? null,
    [selectedChatbotConnection?.optionId, selectedChatbotConnectionSourceStage],
  )

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
    if (!selectedChatbotConnectionId) return
    if (!chatbotCanvasModel.connections.some((item) => item.id === selectedChatbotConnectionId)) {
      setSelectedChatbotConnectionId(null)
    }
  }, [chatbotCanvasModel.connections, selectedChatbotConnectionId])

  useEffect(() => {
    if (!selectedIsChatbot) {
      setChatbotBuilderModalOpen(false)
    }
  }, [selectedIsChatbot])

  useEffect(() => {
    setWebFormBuilderDraft(getWebFormBuilderState(selectedSettings))
  }, [selectedChannelId, selectedSettings])

  useEffect(() => {
    setGoogleSheetsActions(getInitialGoogleSheetsActionState())
  }, [selectedChannelId])

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
      googleSheetsPreview: `${baseUrl}/api/crm/channels/${selectedChannel.id}/google-sheets/preview`,
      googleSheetsImport: `${baseUrl}/api/crm/channels/${selectedChannel.id}/google-sheets/import`,
      googleSheetsExport: `${baseUrl}/api/crm/channels/${selectedChannel.id}/google-sheets/export`,
    }
  }, [baseUrl, selectedChannel, selectedSettings, selectedToken])

  function applyTemplate(templateKey: string) {
    const preset = TEMPLATE_PRESETS.find((item) => item.key === templateKey)
    if (!preset) return
    setWizardMetaAdvancedOpen(false)
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
    setWizardMetaAdvancedOpen(false)
    setWizardChatPreviewMode('floating')
    setWizardChatPreviewViewport('desktop')
    setWizardChatbotSection('base')
    setWizardWebFormSection('base')
    setWizardStep('template')
    setCreateOpen(true)
  }

  function openEditWizard(channel: ChannelConnection) {
    const settings = (channel.settingsJson as Record<string, unknown> | null | undefined) ?? null
    const bridgeKind = getBridgeKind(settings) as CrmBridgeKind
    const templateMatch = TEMPLATE_PRESETS.find((preset) => preset.provider === channel.provider && (preset.bridgeKind ?? 'GENERIC') === (bridgeKind || 'GENERIC'))

    setEditingChannelId(channel.id)
  setWizardMetaAdvancedOpen(Boolean(channel.externalAccountId || channel.externalPageId || channel.externalPhoneNumberId || getWhatsAppAccessToken(settings) || getWhatsAppApiVersion(settings) !== 'v23.0'))
    setCreateForm({
      templateKey: templateMatch?.key ?? (channel.provider === 'WEB_CHATBOT' ? 'web-chatbot' : 'web-form'),
      name: channel.name,
      provider: channel.provider,
      status: channel.status,
      testingToken: getTokenFromSettings(settings) || '',
      bridgeKind: (bridgeKind || 'GENERIC') as CrmBridgeKind,
      googleSheetsSpreadsheetId: getGoogleSheetsSpreadsheetId(settings),
      googleSheetsSheetName: getGoogleSheetsSheetName(settings),
      googleSheetsPublishedCsvUrl: getGoogleSheetsPublishedCsvUrl(settings),
      googleSheetsRowLimit: getGoogleSheetsRowLimit(settings),
      googleSheetsImportMode: getGoogleSheetsImportMode(settings),
      googleSheetsOpportunityStage: getGoogleSheetsOpportunityStage(settings),
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
      webFormCustomFields: normalizeWebFormCustomFields(settings?.webFormCustomFields),
      webFormVariables: normalizeWebFormVariables(settings?.webFormVariables),
      termsEnabled: getBooleanSetting(settings, 'termsEnabled', false),
      termsRequired: getBooleanSetting(settings, 'termsRequired', true),
      termsLabel: getSettingText(settings, 'termsLabel', 'Acepto el tratamiento de datos personales.'),
      termsLinkText: getSettingText(settings, 'termsLinkText', 'Leer términos'),
      termsLinkUrl: getSettingText(settings, 'termsLinkUrl', ''),
    })
    setWizardChatPreviewMode('floating')
    setWizardChatPreviewViewport('desktop')
    setWizardChatbotSection('base')
    setWizardWebFormSection('base')
    setWizardStep('config')
    setCreateOpen(true)
  }

  async function copyText(key: string, value: string) {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
  }

  async function runGoogleSheetsPreview() {
    if (!selectedChannel || !selectedIsGoogleSheetsBridge || !snippets) return

    setOperationsPanelView('preview')
    setGoogleSheetsActions((current) => ({
      ...current,
      loadingPreview: true,
      error: '',
    }))

    try {
      const json = await requestJson<{
        csvUrl: string
        totalRows: number
        headers: string[]
        preview: Array<Record<string, unknown>>
      }>(snippets.googleSheetsPreview)

      if (!json.success || !json.data) {
        setGoogleSheetsActions((current) => ({
          ...current,
          loadingPreview: false,
          error: json.error || 'No se pudo previsualizar la hoja.',
        }))
        return
      }

      setGoogleSheetsActions((current) => ({
        ...current,
        loadingPreview: false,
        error: '',
        previewResult: json.data ?? null,
      }))
    } catch {
      setGoogleSheetsActions((current) => ({
        ...current,
        loadingPreview: false,
        error: 'No se pudo previsualizar la hoja.',
      }))
    }
  }

  async function runGoogleSheetsImport() {
    if (!selectedChannel || !selectedIsGoogleSheetsBridge || !snippets) return

    setOperationsPanelView('preview')
    setGoogleSheetsActions((current) => ({
      ...current,
      loadingImport: true,
      error: '',
    }))

    try {
      const json = await requestJson<{
        importedRows: number
        skippedRows: number
        opportunitiesCreated: number
        processedRows: number
      }>(snippets.googleSheetsImport, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!json.success || !json.data) {
        setGoogleSheetsActions((current) => ({
          ...current,
          loadingImport: false,
          error: json.error || 'No se pudo importar la hoja.',
        }))
        return
      }

      setGoogleSheetsActions((current) => ({
        ...current,
        loadingImport: false,
        error: '',
        importResult: json.data ?? null,
      }))

      await loadChannels()
    } catch {
      setGoogleSheetsActions((current) => ({
        ...current,
        loadingImport: false,
        error: 'No se pudo importar la hoja.',
      }))
    }
  }

  function stopMetaPopupTracking() {
    if (metaPopupIntervalRef.current) {
      window.clearInterval(metaPopupIntervalRef.current)
    }
    metaPopupIntervalRef.current = null
    metaPopupRef.current = null
  }

  function openMetaOnboarding(channel: ChannelConnection) {
    setMetaOnboardingOpen(true)
    setMetaOnboardingState('idle')
    setMetaOnboardingMessage('')

    if (channel.status !== 'TESTING' && channel.status !== 'ACTIVE') {
      setMetaOnboardingState('error')
      setMetaOnboardingMessage('Pon el canal en TESTING o ACTIVE antes de iniciar la conexión guiada con Meta.')
      return
    }
  }

  async function launchMetaPopup(channel: ChannelConnection) {
    stopMetaPopupTracking()
    setMetaOnboardingState('waiting')
    setMetaOnboardingMessage('Esperando autorización en Meta. Completa el flujo en la ventana emergente y vuelve aquí.')

    const popup = window.open(`/api/crm/channels/${channel.id}/meta/connect`, 'sgdigital-meta-connect', 'popup=yes,width=720,height=820,left=120,top=80')
    if (!popup) {
      setMetaOnboardingState('error')
      setMetaOnboardingMessage('El navegador bloqueó la ventana emergente. Permite popups para continuar con Facebook.')
      setMetaConnectionFeedback({
        status: 'error',
        message: 'El navegador bloqueó la ventana emergente de Meta. Permite popups e intenta de nuevo.',
      })
      return
    }

    metaPopupRef.current = popup
    popup.focus()

    metaPopupIntervalRef.current = window.setInterval(async () => {
      const currentPopup = metaPopupRef.current
      if (!currentPopup) {
        stopMetaPopupTracking()
        return
      }

      if (currentPopup.closed) {
        stopMetaPopupTracking()
        setMetaOnboardingState('idle')
        setMetaOnboardingMessage('La ventana se cerró antes de devolver el resultado. Puedes volver a lanzarla cuando quieras.')
        return
      }

      try {
        const href = currentPopup.location.href
        if (!href || !href.startsWith(window.location.origin)) return

        const url = new URL(href)
        const metaStatus = url.searchParams.get('meta')
        const message = url.searchParams.get('message') || ''
        const channelId = url.searchParams.get('channelId') || channel.id

        if (url.pathname !== '/dashboard/crm/integraciones' || (metaStatus !== 'connected' && metaStatus !== 'error')) {
          return
        }

        currentPopup.close()
        stopMetaPopupTracking()

        if (metaStatus === 'connected') {
          setMetaOnboardingState('success')
          setMetaOnboardingMessage('Meta devolvió autorización y el canal ya se sincronizó. Revisa abajo si quedó autoaplicado el activo o si debes elegirlo manualmente.')
          setMetaConnectionFeedback({
            status: 'connected',
            message: 'Meta quedó conectada. Revisa los activos sincronizados y aplica el número, página o cuenta correcta antes de pasar a producción.',
          })
          await loadChannels()
          setSelectedChannelId(channelId)
          return
        }

        const errorMessage = message || 'No se pudo completar la conexión con Meta.'
        setMetaOnboardingState('error')
        setMetaOnboardingMessage(errorMessage)
        setMetaConnectionFeedback({ status: 'error', message: errorMessage })
      } catch {
        // Mientras el popup esté en dominio de Meta, leer location lanzará error cross-origin.
      }
    }, 700)
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
        setMetaConnectionFeedback({
          status: 'error',
          message: json.error || 'No se pudo sincronizar Meta.',
        })
        return
      }
      setMetaConnectionFeedback(null)
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
        setMetaConnectionFeedback({
          status: 'error',
          message: json.error || 'No se pudo desconectar Meta.',
        })
        return
      }
      setMetaConnectionFeedback(null)
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
        googleSheetsSpreadsheetId: createForm.googleSheetsSpreadsheetId,
        googleSheetsSheetName: createForm.googleSheetsSheetName,
        googleSheetsPublishedCsvUrl: createForm.googleSheetsPublishedCsvUrl,
        googleSheetsRowLimit: createForm.googleSheetsRowLimit,
        googleSheetsImportMode: createForm.googleSheetsImportMode,
        googleSheetsOpportunityStage: createForm.googleSheetsOpportunityStage,
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
        webFormCustomFields: createForm.webFormCustomFields,
        webFormVariables: createForm.webFormVariables,
        termsEnabled: createForm.termsEnabled,
        termsRequired: createForm.termsRequired,
        termsLabel: createForm.termsLabel,
        termsLinkText: createForm.termsLinkText,
        termsLinkUrl: createForm.termsLinkUrl,
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
    setSelectedChatbotConnectionId(null)
  }

  function addConnectedChatbotStage(sourceStageId: ChatbotFlowStageId, optionId: string) {
    const nextStageId = createChatbotStageId(chatbotBuilderDraft.flowStages)
    setChatbotBuilderDraft((current) => ({
      ...current,
      flowStages: [
        ...current.flowStages.map((stage) => {
          if (stage.id !== sourceStageId) return stage
          return {
            ...stage,
            responseOptions: stage.responseOptions.map((option) => option.id === optionId ? { ...option, targetStageId: nextStageId } : option),
          }
        }),
        {
          id: nextStageId,
          title: 'Nueva etapa conectada',
          description: 'Etapa creada desde una rama visual del flujo.',
          prompt: 'Escribe aquí el mensaje que continuará esta ruta del chatbot.',
          nextField: 'none',
          quickActionIds: [],
          responseOptions: [],
        },
      ],
    }))
    setSelectedChatbotStageId(nextStageId)
    setSelectedChatbotConnectionId(null)
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
    setSelectedChatbotConnectionId(null)
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
    setSelectedChatbotConnectionId(null)
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
    setSelectedChatbotConnectionId((current) => current === `${stageId}-${optionId}` ? null : current)
  }

  function updateChatbotQuickAction(actionId: string, patch: Partial<ChatbotQuickAction>) {
    setChatbotBuilderDraft((current) => ({
      ...current,
      quickActions: current.quickActions.map((action) => action.id === actionId ? { ...action, ...patch } : action),
    }))
  }

  function createEmptyWebFormCustomField(type: WebFormCustomFieldType = 'input'): WebFormCustomField {
    return {
      id: createWebFormEntityId('field'),
      key: `campo_${Date.now()}`,
      label: 'Campo personalizado',
      type,
      placeholder: '',
      helpText: '',
      required: false,
      options: type === 'select' ? ['Opción 1', 'Opción 2'] : [],
      defaultValue: '',
      fullWidth: type === 'textarea' || type === 'file',
    }
  }

  function createEmptyWebFormVariable(): WebFormVariable {
    return {
      id: createWebFormEntityId('variable'),
      key: `variable_${Date.now()}`,
      label: 'Variable oculta',
      source: 'query',
      value: '',
      queryParam: 'utm_source',
    }
  }

  function updateWizardWebFormField(fieldId: string, patch: Partial<WebFormCustomField>) {
    setCreateForm((current) => ({
      ...current,
      webFormCustomFields: current.webFormCustomFields.map((field) => field.id === fieldId ? { ...field, ...patch } : field),
    }))
  }

  function updateBuilderWebFormField(fieldId: string, patch: Partial<WebFormCustomField>) {
    setWebFormBuilderDraft((current) => ({
      ...current,
      webFormCustomFields: current.webFormCustomFields.map((field) => field.id === fieldId ? { ...field, ...patch } : field),
    }))
  }

  function updateWizardWebFormVariable(variableId: string, patch: Partial<WebFormVariable>) {
    setCreateForm((current) => ({
      ...current,
      webFormVariables: current.webFormVariables.map((variable) => variable.id === variableId ? { ...variable, ...patch } : variable),
    }))
  }

  function updateBuilderWebFormVariable(variableId: string, patch: Partial<WebFormVariable>) {
    setWebFormBuilderDraft((current) => ({
      ...current,
      webFormVariables: current.webFormVariables.map((variable) => variable.id === variableId ? { ...variable, ...patch } : variable),
    }))
  }

  function patchWizardWebForm(patch: Partial<WebFormBuilderState>) {
    setCreateForm((current) => ({ ...current, ...patch }))
  }

  function patchBuilderWebForm(patch: Partial<WebFormBuilderState>) {
    setWebFormBuilderDraft((current) => ({ ...current, ...patch }))
  }

  function addWizardWebFormField(type: WebFormCustomFieldType) {
    setCreateForm((current) => ({
      ...current,
      webFormCustomFields: [...current.webFormCustomFields, createEmptyWebFormCustomField(type)],
    }))
  }

  function addBuilderWebFormField(type: WebFormCustomFieldType) {
    setWebFormBuilderDraft((current) => ({
      ...current,
      webFormCustomFields: [...current.webFormCustomFields, createEmptyWebFormCustomField(type)],
    }))
  }

  function removeWizardWebFormField(fieldId: string) {
    setCreateForm((current) => ({
      ...current,
      webFormCustomFields: current.webFormCustomFields.filter((field) => field.id !== fieldId),
    }))
  }

  function removeBuilderWebFormField(fieldId: string) {
    setWebFormBuilderDraft((current) => ({
      ...current,
      webFormCustomFields: current.webFormCustomFields.filter((field) => field.id !== fieldId),
    }))
  }

  function addWizardWebFormVariable() {
    setCreateForm((current) => ({
      ...current,
      webFormVariables: [...current.webFormVariables, createEmptyWebFormVariable()],
    }))
  }

  function addBuilderWebFormVariable() {
    setWebFormBuilderDraft((current) => ({
      ...current,
      webFormVariables: [...current.webFormVariables, createEmptyWebFormVariable()],
    }))
  }

  function removeWizardWebFormVariable(variableId: string) {
    setCreateForm((current) => ({
      ...current,
      webFormVariables: current.webFormVariables.filter((variable) => variable.id !== variableId),
    }))
  }

  function removeBuilderWebFormVariable(variableId: string) {
    setWebFormBuilderDraft((current) => ({
      ...current,
      webFormVariables: current.webFormVariables.filter((variable) => variable.id !== variableId),
    }))
  }

  function renderWebFormConfigurationSections(kind: 'wizard' | 'builder') {
    const isWizard = kind === 'wizard'
    const form = isWizard ? createForm : webFormBuilderDraft
    const section = isWizard ? wizardWebFormSection : webFormBuilderSection
    const setSection = isWizard ? setWizardWebFormSection : setWebFormBuilderSection
    const patchForm = isWizard ? patchWizardWebForm : patchBuilderWebForm
    const addField = isWizard ? addWizardWebFormField : addBuilderWebFormField
    const updateField = isWizard ? updateWizardWebFormField : updateBuilderWebFormField
    const removeField = isWizard ? removeWizardWebFormField : removeBuilderWebFormField
    const addVariable = isWizard ? addWizardWebFormVariable : addBuilderWebFormVariable
    const updateVariable = isWizard ? updateWizardWebFormVariable : updateBuilderWebFormVariable
    const removeVariable = isWizard ? removeWizardWebFormVariable : removeBuilderWebFormVariable

    const sectionOptions = isWizard ? WEB_FORM_SECTION_OPTIONS : WEB_FORM_SECTION_OPTIONS.filter((item) => item.id !== 'base')

    return (
      <Tabs value={section} onValueChange={(value) => setSection(value as WebFormConfigSection)} className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto min-w-max flex-nowrap rounded-2xl border border-slate-200 bg-slate-50 p-1 md:flex-wrap">
            {sectionOptions.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {isWizard ? (
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
                    <Input value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} className="h-11 rounded-xl bg-white" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Proveedor técnico</Label>
                    <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
                      {createForm.provider}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Estado inicial</Label>
                    <Select value={createForm.status} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, status: value as ChannelStatus }))}>
                      <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHANNEL_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
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
                      <Input value={createForm.testingToken} onChange={(e) => setCreateForm((prev) => ({ ...prev, testingToken: e.target.value }))} className="h-11 rounded-xl bg-white" />
                      <Button type="button" variant="outline" className="rounded-xl bg-white" onClick={() => setCreateForm((prev) => ({ ...prev, testingToken: makeDemoToken() }))}>Regenerar</Button>
                    </div>
                    <p className="text-xs leading-5 text-slate-500">Se usa para pruebas seguras, verificación y bridges demo.</p>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Selector del formulario legacy</Label>
                    <Input value={createForm.formSelector} onChange={(e) => setCreateForm((prev) => ({ ...prev, formSelector: e.target.value }))} className="h-11 rounded-xl bg-white" placeholder="#lead-form" />
                    <p className="text-xs leading-5 text-slate-500">Se conserva para sitios que ya tienen su propio formulario. El modo recomendado ahora es iframe público hospedado por SGDigital.</p>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Tipo de bridge</Label>
                    <Select value={createForm.bridgeKind} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, bridgeKind: value as CrmBridgeKind }))}>
                      <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERIC">GENERIC</SelectItem>
                        <SelectItem value="GMAIL">GMAIL</SelectItem>
                        <SelectItem value="OUTLOOK">OUTLOOK</SelectItem>
                        <SelectItem value="GOOGLE_SHEETS">GOOGLE_SHEETS</SelectItem>
                        <SelectItem value="TIKTOK">TIKTOK</SelectItem>
                        <SelectItem value="YOUTUBE">YOUTUBE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
            <div className="grid gap-2"><Label>Color de acento</Label><Input value={form.accentColor} onChange={(e) => patchForm({ accentColor: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Color CTA</Label><Input value={form.formCtaColor} onChange={(e) => patchForm({ formCtaColor: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Texto CTA</Label><Input value={form.formCtaTextColor} onChange={(e) => patchForm({ formCtaTextColor: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Fondo general</Label><Input value={form.pageBackgroundColor} onChange={(e) => patchForm({ pageBackgroundColor: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Fondo interno</Label><Input value={form.backgroundColor} onChange={(e) => patchForm({ backgroundColor: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Color labels</Label><Input value={form.formLabelColor} onChange={(e) => patchForm({ formLabelColor: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Color borde inputs</Label><Input value={form.formInputBorderColor} onChange={(e) => patchForm({ formInputBorderColor: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Fondo inputs</Label><Input value={form.formInputBackgroundColor} onChange={(e) => patchForm({ formInputBackgroundColor: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Texto inputs</Label><Input value={form.formInputTextColor} onChange={(e) => patchForm({ formInputTextColor: e.target.value })} className="h-11 rounded-xl" /></div>
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
                <Switch checked={Boolean(form[field.key as keyof WebFormBuilderState])} onCheckedChange={(checked) => patchForm({ [field.key]: checked } as Partial<WebFormBuilderState>)} />
              </div>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2"><Label>Label nombre</Label><Input value={form.nameLabel} onChange={(e) => patchForm({ nameLabel: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Placeholder nombre</Label><Input value={form.namePlaceholder} onChange={(e) => patchForm({ namePlaceholder: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Label correo</Label><Input value={form.emailLabel} onChange={(e) => patchForm({ emailLabel: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Placeholder correo</Label><Input value={form.emailPlaceholder} onChange={(e) => patchForm({ emailPlaceholder: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Label teléfono</Label><Input value={form.phoneLabel} onChange={(e) => patchForm({ phoneLabel: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Placeholder teléfono</Label><Input value={form.phonePlaceholder} onChange={(e) => patchForm({ phonePlaceholder: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Label empresa</Label><Input value={form.companyLabel} onChange={(e) => patchForm({ companyLabel: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Placeholder empresa</Label><Input value={form.companyPlaceholder} onChange={(e) => patchForm({ companyPlaceholder: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Label ciudad</Label><Input value={form.cityLabel} onChange={(e) => patchForm({ cityLabel: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Placeholder ciudad</Label><Input value={form.cityPlaceholder} onChange={(e) => patchForm({ cityPlaceholder: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Label producto</Label><Input value={form.productLabel} onChange={(e) => patchForm({ productLabel: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Placeholder producto</Label><Input value={form.productPlaceholder} onChange={(e) => patchForm({ productPlaceholder: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Label mensaje</Label><Input value={form.messageLabel} onChange={(e) => patchForm({ messageLabel: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Placeholder mensaje</Label><Input value={form.messagePlaceholder} onChange={(e) => patchForm({ messagePlaceholder: e.target.value })} className="h-11 rounded-xl" /></div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Campos personalizados</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Agrega campos extra tipo input, textarea, phone, email, select, check o file.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEB_FORM_CUSTOM_FIELD_TYPE_OPTIONS.map((item) => (
                  <Button key={item.value} type="button" variant="outline" className="rounded-xl" onClick={() => addField(item.value)}>
                    + {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {form.webFormCustomFields.length ? form.webFormCustomFields.map((field) => (
                <div key={field.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{field.label || 'Campo personalizado'}</p>
                      <p className="text-xs text-slate-500">{getWebFormFieldTypeLabel(field.type)} · key {field.key}</p>
                    </div>
                    <Button type="button" variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => removeField(field.id)}>
                      Eliminar campo
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2"><Label>Label</Label><Input value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} className="h-11 rounded-xl" /></div>
                    <div className="grid gap-2"><Label>Key interna</Label><Input value={field.key} onChange={(e) => updateField(field.id, { key: e.target.value })} className="h-11 rounded-xl" /></div>
                    <div className="grid gap-2">
                      <Label>Tipo</Label>
                      <Select value={field.type} onValueChange={(value) => updateField(field.id, { type: value as WebFormCustomFieldType, options: value === 'select' ? (field.options.length ? field.options : ['Opción 1', 'Opción 2']) : [], fullWidth: value === 'textarea' || value === 'file' ? true : field.fullWidth })}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {WEB_FORM_CUSTOM_FIELD_TYPE_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2"><Label>Texto guía / placeholder</Label><Input value={field.placeholder} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} className="h-11 rounded-xl" /></div>
                    <div className="grid gap-2 md:col-span-2"><Label>Ayuda</Label><Input value={field.helpText} onChange={(e) => updateField(field.id, { helpText: e.target.value })} className="h-11 rounded-xl" /></div>
                    <div className="grid gap-2"><Label>Valor por defecto</Label><Input value={field.defaultValue} onChange={(e) => updateField(field.id, { defaultValue: e.target.value })} className="h-11 rounded-xl" /></div>
                    {field.type === 'select' ? <div className="grid gap-2"><Label>Opciones</Label><Input value={field.options.join(', ')} onChange={(e) => updateField(field.id, { options: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} className="h-11 rounded-xl" placeholder="Opción 1, Opción 2" /></div> : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Campo obligatorio</p>
                        <p className="text-xs text-slate-500">Exige completarlo antes de enviar.</p>
                      </div>
                      <Switch checked={field.required} onCheckedChange={(checked) => updateField(field.id, { required: checked })} />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Ancho completo</p>
                        <p className="text-xs text-slate-500">Ocupa toda la fila en el formulario.</p>
                      </div>
                      <Switch checked={field.fullWidth} onCheckedChange={(checked) => updateField(field.id, { fullWidth: checked })} />
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
              <Button type="button" className="rounded-xl" onClick={() => addVariable()}>
                Agregar variable
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {form.webFormVariables.length ? form.webFormVariables.map((variable) => (
                <div key={variable.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{variable.label || 'Variable oculta'}</p>
                      <p className="text-xs text-slate-500">{variable.source === 'query' ? 'Tomada de la URL' : 'Valor estático'} · key {variable.key}</p>
                    </div>
                    <Button type="button" variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => removeVariable(variable.id)}>
                      Eliminar variable
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="grid gap-2"><Label>Label</Label><Input value={variable.label} onChange={(e) => updateVariable(variable.id, { label: e.target.value })} className="h-11 rounded-xl" /></div>
                    <div className="grid gap-2"><Label>Key interna</Label><Input value={variable.key} onChange={(e) => updateVariable(variable.id, { key: e.target.value })} className="h-11 rounded-xl" /></div>
                    <div className="grid gap-2">
                      <Label>Origen</Label>
                      <Select value={variable.source} onValueChange={(value) => updateVariable(variable.id, { source: value as WebFormVariable['source'] })}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="query">Query param</SelectItem>
                          <SelectItem value="static">Valor estático</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {variable.source === 'query' ? <div className="grid gap-2"><Label>Nombre del query param</Label><Input value={variable.queryParam} onChange={(e) => updateVariable(variable.id, { queryParam: e.target.value })} className="h-11 rounded-xl" placeholder="utm_source" /></div> : <div className="grid gap-2"><Label>Valor fijo</Label><Input value={variable.value} onChange={(e) => updateVariable(variable.id, { value: e.target.value })} className="h-11 rounded-xl" /></div>}
                  </div>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">No hay variables ocultas configuradas todavía.</div>}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="size" className="space-y-4">
          <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
            <div className="grid gap-2"><Label>Altura del iframe</Label><Input value={form.iframeHeight} onChange={(e) => patchForm({ iframeHeight: normalizePixelValue(e.target.value, '840') })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Tamaño base</Label><Input value={form.formFontSize} onChange={(e) => patchForm({ formFontSize: normalizePixelValue(e.target.value, '14') })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Radio tarjeta</Label><Input value={form.formCardRadius} onChange={(e) => patchForm({ formCardRadius: normalizePixelValue(e.target.value, '28') })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Radio inputs</Label><Input value={form.formInputRadius} onChange={(e) => patchForm({ formInputRadius: normalizePixelValue(e.target.value, '16') })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Espaciado entre campos</Label><Input value={form.formFieldSpacing} onChange={(e) => patchForm({ formFieldSpacing: normalizePixelValue(e.target.value, '14') })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Padding interno</Label><Input value={form.formPadding} onChange={(e) => patchForm({ formPadding: normalizePixelValue(e.target.value, '24') })} className="h-11 rounded-xl" /></div>
          </div>
        </TabsContent>

        <TabsContent value="texts" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>Título del formulario</Label><Input value={form.formTitle} onChange={(e) => patchForm({ formTitle: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Descripción comercial</Label><Textarea value={form.formDescription} onChange={(e) => patchForm({ formDescription: e.target.value })} rows={3} className="rounded-2xl" /></div>
            <div className="grid gap-2"><Label>Texto del CTA</Label><Input value={form.submitCtaLabel} onChange={(e) => patchForm({ submitCtaLabel: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Fuente CSS</Label><Input value={form.fontFamily} onChange={(e) => patchForm({ fontFamily: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Mensaje de éxito</Label><Textarea value={form.formSuccessMessage} onChange={(e) => patchForm({ formSuccessMessage: e.target.value })} rows={3} className="rounded-2xl" /></div>
          </div>
        </TabsContent>

        <TabsContent value="terms" className="space-y-4">
          <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Mostrar aceptación de términos</p>
                <p className="text-xs text-slate-500">Añade checkbox de autorización o tratamiento de datos.</p>
              </div>
              <Switch checked={form.termsEnabled} onCheckedChange={(checked) => patchForm({ termsEnabled: checked })} />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Requerir aceptación</p>
                <p className="text-xs text-slate-500">Bloquea el envío si el usuario no acepta.</p>
              </div>
              <Switch checked={form.termsRequired} onCheckedChange={(checked) => patchForm({ termsRequired: checked })} disabled={!form.termsEnabled} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2 md:col-span-2"><Label>Texto principal</Label><Textarea value={form.termsLabel} onChange={(e) => patchForm({ termsLabel: e.target.value })} rows={2} className="rounded-2xl" disabled={!form.termsEnabled} /></div>
              <div className="grid gap-2"><Label>Texto del enlace</Label><Input value={form.termsLinkText} onChange={(e) => patchForm({ termsLinkText: e.target.value })} className="h-11 rounded-xl" disabled={!form.termsEnabled} /></div>
              <div className="grid gap-2"><Label>URL de términos</Label><Input value={form.termsLinkUrl} onChange={(e) => patchForm({ termsLinkUrl: e.target.value })} className="h-11 rounded-xl" placeholder="https://..." disabled={!form.termsEnabled} /></div>
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
              <Switch checked={form.publicEmbedEnabled} onCheckedChange={(checked) => patchForm({ publicEmbedEnabled: checked })} />
            </div>
            <div className="grid gap-2">
              <Label>Dominios permitidos</Label>
              <Textarea value={form.allowedDomains} onChange={(e) => patchForm({ allowedDomains: e.target.value })} rows={3} className="rounded-2xl" placeholder="cliente.com, demo.cliente.com" />
            </div>
            {isWizard ? (
              <div className="grid gap-2">
                <Label>Selector del formulario legacy</Label>
                <Input value={createForm.formSelector} onChange={(e) => setCreateForm((current) => ({ ...current, formSelector: e.target.value }))} className="h-11 rounded-xl" placeholder="#lead-form" />
              </div>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    )
  }

  function renderChatbotWizardConfigurationSections() {
    return (
      <Tabs value={wizardChatbotSection} onValueChange={(value) => setWizardChatbotSection(value as ChatbotWizardSection)} className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto min-w-max flex-nowrap rounded-2xl border border-slate-200 bg-slate-50 p-1 md:flex-wrap">
            {CHATBOT_WIZARD_SECTION_OPTIONS.map((item) => (
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
                  <Input value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} className="h-11 rounded-xl bg-white" />
                </div>
                <div className="grid gap-2">
                  <Label>Proveedor técnico</Label>
                  <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">{createForm.provider}</div>
                </div>
                <div className="grid gap-2">
                  <Label>Estado inicial</Label>
                  <Select value={createForm.status} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, status: value as ChannelStatus }))}>
                    <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNEL_STATUS_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
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
                    <Input value={createForm.testingToken} onChange={(e) => setCreateForm((prev) => ({ ...prev, testingToken: e.target.value }))} className="h-11 rounded-xl bg-white" />
                    <Button type="button" variant="outline" className="rounded-xl bg-white" onClick={() => setCreateForm((prev) => ({ ...prev, testingToken: makeDemoToken() }))}>Regenerar</Button>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">Se usa para pruebas seguras, verificación y bridges demo.</p>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Dominios permitidos</Label>
                  <Textarea value={createForm.allowedDomains} onChange={(e) => setCreateForm((prev) => ({ ...prev, allowedDomains: e.target.value }))} rows={3} className="rounded-2xl bg-white" placeholder="cliente.com, demo.cliente.com" />
                </div>
                <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Publicar iframe sin token</p>
                    <p className="text-xs text-slate-500">Recomendado para la demo controlada del cliente.</p>
                  </div>
                  <Switch checked={createForm.publicEmbedEnabled} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, publicEmbedEnabled: checked }))} />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="brand" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>Título visible del chatbot</Label><Input value={createForm.chatbotTitle} onChange={(e) => setCreateForm((prev) => ({ ...prev, chatbotTitle: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Nombre del asistente</Label><Input value={createForm.assistantName} onChange={(e) => setCreateForm((prev) => ({ ...prev, assistantName: e.target.value }))} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Prompt inicial</Label><Textarea value={createForm.chatbotPrompt} onChange={(e) => setCreateForm((prev) => ({ ...prev, chatbotPrompt: e.target.value }))} rows={4} className="rounded-2xl" /></div>
            <div className="grid gap-2"><Label>Altura del iframe</Label><Input value={createForm.iframeHeight} onChange={(e) => setCreateForm((prev) => ({ ...prev, iframeHeight: e.target.value }))} className="h-11 rounded-xl" placeholder="720" /></div>
            <div className="grid gap-2"><Label>Fuente CSS</Label><Input value={createForm.fontFamily} onChange={(e) => setCreateForm((prev) => ({ ...prev, fontFamily: e.target.value }))} className="h-11 rounded-xl" placeholder="ui-sans-serif, system-ui, sans-serif" /></div>
            <div className="grid gap-2"><Label>Color de acento</Label><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2"><input type="color" value={createForm.accentColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, accentColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar color de acento" /><div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.accentColor }} /><Input value={createForm.accentColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, accentColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="#1d4ed8" /></div></div>
            <div className="grid gap-2"><Label>Color de fondo general</Label><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2"><input type="color" value={createForm.pageBackgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, pageBackgroundColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar color de fondo general" /><div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.pageBackgroundColor }} /><Input value={createForm.pageBackgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, pageBackgroundColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="#eef5ff" /></div></div>
            <div className="grid gap-2"><Label>Color de fondo interno</Label><div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2"><input type="color" value={createForm.backgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, backgroundColor: e.target.value }))} className="h-10 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="Seleccionar color de fondo interno" /><div className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: createForm.backgroundColor }} /><Input value={createForm.backgroundColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, backgroundColor: e.target.value }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="#f8fbff" /></div></div>
            <div className="grid gap-2"><Label>Etiqueta superior</Label><Input value={createForm.headerBadgeLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, headerBadgeLabel: e.target.value }))} className="h-11 rounded-xl" placeholder="Chatbot CRM" /></div>
            <div className="grid gap-2"><Label>Estado del asistente</Label><Input value={createForm.statusBadgeLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, statusBadgeLabel: e.target.value }))} className="h-11 rounded-xl" placeholder="En linea" /></div>
            <div className="grid gap-2"><Label>Radio del panel</Label><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"><Input value={createForm.chatShellRadius} onChange={(e) => setCreateForm((prev) => ({ ...prev, chatShellRadius: normalizePixelValue(e.target.value, '30') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="30" /><span className="text-xs font-medium text-slate-500">px</span></div></div>
            <div className="grid gap-2"><Label>Radio de burbujas</Label><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"><Input value={createForm.messageBubbleRadius} onChange={(e) => setCreateForm((prev) => ({ ...prev, messageBubbleRadius: normalizePixelValue(e.target.value, '22') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="22" /><span className="text-xs font-medium text-slate-500">px</span></div></div>
            <div className="grid gap-2 md:col-span-2"><Label>Sombra del panel</Label><Select value={createForm.panelShadowPreset} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, panelShadowPreset: value as PanelShadowPreset }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="soft">Suave</SelectItem><SelectItem value="medium">Media</SelectItem><SelectItem value="strong">Fuerte</SelectItem></SelectContent></Select></div>
          </div>
        </TabsContent>

        <TabsContent value="launcher" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Habilitar launcher flotante</p>
                <p className="text-xs text-slate-500">Controla si se genera y se usa el botón flotante además del iframe público.</p>
              </div>
              <Switch checked={createForm.floatingLauncherEnabled} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, floatingLauncherEnabled: checked }))} />
            </div>
            <div className="grid gap-2"><Label>Texto del launcher flotante</Label><Input value={createForm.launcherLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, launcherLabel: e.target.value }))} className="h-11 rounded-xl" placeholder="Abrir asesor virtual" /></div>
            <div className="grid gap-2"><Label>Icono del launcher</Label><Select value={createForm.launcherIcon} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, launcherIcon: value }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bot">bot</SelectItem><SelectItem value="message-circle">message-circle</SelectItem><SelectItem value="sparkles">sparkles</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Posición del launcher</Label><Select value={createForm.launcherPosition} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, launcherPosition: value as LauncherPosition }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="right">Derecha</SelectItem><SelectItem value="left">Izquierda</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Tamaño del launcher</Label><Select value={createForm.launcherSize} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, launcherSize: value as LauncherSize }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Compacto</SelectItem><SelectItem value="standard">Estándar</SelectItem><SelectItem value="large">Grande</SelectItem></SelectContent></Select></div>
          </div>
        </TabsContent>

        <TabsContent value="copy" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Solicitar producto en la captura inicial</p>
                <p className="text-xs text-slate-500">Permite que el bot consulte inventario y responda con referencia, precio y disponibilidad.</p>
              </div>
              <Switch checked={createForm.showProductField} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, showProductField: checked }))} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2"><Label>Label nombre</Label><Input value={createForm.nameLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, nameLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
              <div className="grid gap-2"><Label>Placeholder nombre</Label><Input value={createForm.namePlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, namePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
              <div className="grid gap-2"><Label>Label correo</Label><Input value={createForm.emailLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, emailLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
              <div className="grid gap-2"><Label>Placeholder correo</Label><Input value={createForm.emailPlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, emailPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
              <div className="grid gap-2"><Label>Label teléfono</Label><Input value={createForm.phoneLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, phoneLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
              <div className="grid gap-2"><Label>Placeholder teléfono</Label><Input value={createForm.phonePlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, phonePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
              <div className="grid gap-2"><Label>Label producto</Label><Input value={createForm.productLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, productLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
              <div className="grid gap-2"><Label>Placeholder producto</Label><Input value={createForm.productPlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, productPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
              <div className="grid gap-2"><Label>Label mensaje</Label><Input value={createForm.messageLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, messageLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
              <div className="grid gap-2"><Label>Placeholder mensaje</Label><Input value={createForm.messagePlaceholder} onChange={(e) => setCreateForm((prev) => ({ ...prev, messagePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    )
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
        webFormCustomFields: webFormBuilderDraft.webFormCustomFields,
        webFormVariables: webFormBuilderDraft.webFormVariables,
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
          ? `${baseUrl || 'https://tu-dominio.com'}${createIsBridge ? '/api/crm/captures/bridge' : '/api/crm/captures/web-form'}`
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
    if (selectedChannel.provider === 'WEB_FORM' && bridgeKind === 'GOOGLE_SHEETS') {
      return ['overview', 'bridge']
    }
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
    <div className="space-y-4.5 pb-4">
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

      <Tabs value={workspaceView} onValueChange={(value) => setWorkspaceView(value as CrmWorkspaceView)} className="space-y-4">
        <div className="flex flex-col gap-2.5 rounded-[24px] border border-slate-200 bg-white/90 p-2.5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.28)] md:flex-row md:items-center md:justify-between">
          <TabsList className="grid h-auto grid-cols-2 rounded-[18px] border border-slate-200 bg-slate-50 p-1">
            <TabsTrigger value="operations" className="rounded-[14px] px-4 py-2 data-[state=active]:bg-white">Operación</TabsTrigger>
            <TabsTrigger value="metrics" className="rounded-[14px] px-4 py-2 data-[state=active]:bg-white">Métricas y metas</TabsTrigger>
          </TabsList>
          {workspaceView === 'metrics' ? (
            <p className="px-2 text-[13px] text-slate-500">
              Panel ejecutivo para revisar rendimiento y definir objetivos comerciales por canal.
            </p>
          ) : null}
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
      <TabsContent value="operations" className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="rounded-[24px] border-slate-200 bg-white/95 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.3)]">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle>Canales configurados</CardTitle>
            <CardDescription>Selecciona un canal para ver assets, webhooks y bridges listos para copiar.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[72vh] space-y-2.5 overflow-y-auto p-3 md:p-4 xl:max-h-[calc(100vh-19rem)]">
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
          {selectedChannel && operationsPanelView !== 'assets' ? (
            <Card className="rounded-[24px] border-slate-200 bg-white/95 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.3)]">
              <CardHeader className="border-b border-slate-100 pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>{operationsPanelView === 'preview' ? 'Vista previa del canal' : 'Checklist de readiness'}</CardTitle>
                    <CardDescription>
                      {operationsPanelView === 'preview'
                        ? 'Resumen ejecutivo y accesos rápidos del canal seleccionado.'
                        : 'Revisión operativa para validar si el canal ya está listo para demo o producción.'}
                    </CardDescription>
                  </div>
                  {operationsPanelSwitcher}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 md:p-5">
                {operationsPanelView === 'preview' ? (
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

                    {selectedIsGoogleSheetsBridge && snippets ? (
                      <div className="mt-5 rounded-2xl border border-emerald-200 bg-white/90 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Google Sheets operativo</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">Aquí mismo puedes validar la hoja, importar filas al CRM y descargar el CSV exportado del canal sin irte al studio técnico.</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button className="rounded-xl border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void runGoogleSheetsPreview()} disabled={googleSheetsActions.loadingPreview || googleSheetsActions.loadingImport}>
                              <Eye className="mr-2 h-4 w-4" />
                              {googleSheetsActions.loadingPreview ? 'Probando hoja...' : 'Probar preview'}
                            </Button>
                            <Button variant="outline" className="rounded-xl border-emerald-200 text-emerald-800 hover:bg-emerald-50" onClick={() => void runGoogleSheetsImport()} disabled={googleSheetsActions.loadingImport || googleSheetsActions.loadingPreview}>
                              <Upload className="mr-2 h-4 w-4" />
                              {googleSheetsActions.loadingImport ? 'Importando...' : 'Importar ahora'}
                            </Button>
                            <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white">
                              <Link href={snippets.googleSheetsExport}>
                                <Download className="mr-2 h-4 w-4" />
                                Exportar CSV
                              </Link>
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-700">Origen conectado</p>
                            <p className="mt-2 break-all text-sm font-semibold text-slate-950">{selectedGoogleSheetsCsvUrl || 'Configura URL CSV o spreadsheet ID'}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Último preview</p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">{googleSheetsActions.previewResult?.totalRows ?? '—'}</p>
                            <p className="mt-1 text-xs text-slate-500">filas detectadas en la hoja</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Última importación</p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">{googleSheetsActions.importResult?.importedRows ?? '—'}</p>
                            <p className="mt-1 text-xs text-slate-500">filas importadas al CRM</p>
                          </div>
                        </div>

                        {googleSheetsActions.error ? (
                          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                            {googleSheetsActions.error}
                          </div>
                        ) : null}

                        {googleSheetsActions.previewResult ? (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Preview cargado</p>
                                <p className="text-xs leading-5 text-slate-500">Headers: {googleSheetsActions.previewResult.headers.join(' · ') || 'sin headers detectados'}</p>
                              </div>
                              <Button variant="outline" className="rounded-xl" onClick={() => void copyText('google-sheets-preview-url', snippets.googleSheetsPreview)}>
                                {copiedKey === 'google-sheets-preview-url' ? 'Copiado' : 'Copiar endpoint preview'}
                              </Button>
                            </div>
                            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                              <table className="min-w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50 text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 font-semibold">Fila</th>
                                    <th className="px-3 py-2 font-semibold">Nombre</th>
                                    <th className="px-3 py-2 font-semibold">Email</th>
                                    <th className="px-3 py-2 font-semibold">Teléfono</th>
                                    <th className="px-3 py-2 font-semibold">Producto</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {googleSheetsActions.previewResult.preview.slice(0, 5).map((row, index) => (
                                    <tr key={`${String(row.rowNumber ?? index)}-${index}`} className="border-t border-slate-100">
                                      <td className="px-3 py-2 font-medium text-slate-900">{String(row.rowNumber ?? '—')}</td>
                                      <td className="px-3 py-2">{String(row.nombre ?? '—')}</td>
                                      <td className="px-3 py-2">{String(row.email ?? '—')}</td>
                                      <td className="px-3 py-2">{String(row.telefono ?? '—')}</td>
                                      <td className="px-3 py-2">{String(row.producto ?? '—')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ) : null}

                        {googleSheetsActions.importResult ? (
                          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                            <p className="text-sm font-semibold text-emerald-900">Importación ejecutada</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-4">
                              <div className="rounded-2xl border border-white/80 bg-white/85 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Procesadas</p><p className="mt-2 text-xl font-semibold text-slate-950">{googleSheetsActions.importResult.processedRows}</p></div>
                              <div className="rounded-2xl border border-white/80 bg-white/85 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Importadas</p><p className="mt-2 text-xl font-semibold text-slate-950">{googleSheetsActions.importResult.importedRows}</p></div>
                              <div className="rounded-2xl border border-white/80 bg-white/85 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Omitidas</p><p className="mt-2 text-xl font-semibold text-slate-950">{googleSheetsActions.importResult.skippedRows}</p></div>
                              <div className="rounded-2xl border border-white/80 bg-white/85 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Oportunidades</p><p className="mt-2 text-xl font-semibold text-slate-950">{googleSheetsActions.importResult.opportunitiesCreated}</p></div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                  <div className="space-y-4">
                    {operationsPanelView === 'readiness' ? (
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
                    ) : null}

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
                        {usesMetaProvider(selectedChannel.provider) ? <Button type="button" variant="outline" className="rounded-xl border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100" onClick={() => openMetaOnboarding(selectedChannel)}><Facebook className="mr-2 h-4 w-4" />{selectedMeta.hasConnection ? 'Reconectar con Facebook' : 'Continuar con Facebook'}</Button> : null}
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
                        <div className="mt-4 rounded-2xl border border-sky-200 bg-white/80 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Onboarding guiado</p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">Lanza el flujo en una ventana controlada, vuelve al panel automáticamente y termina aquí mismo la selección del activo.</p>
                            </div>
                            <Button type="button" className="rounded-xl bg-[#1877f2] text-white hover:bg-[#166fe0]" onClick={() => openMetaOnboarding(selectedChannel)}>
                              <Facebook className="mr-2 h-4 w-4" />
                              {selectedMeta.hasConnection ? 'Reconectar con Facebook' : 'Continuar con Facebook'}
                            </Button>
                          </div>
                          <div className="mt-4 grid gap-2">
                            {selectedMetaOnboardingChecklist.map((item) => (
                              <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                                <span className={item.done ? 'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700' : 'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700'}>{item.done ? 'OK' : '!'}</span>
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{item.label}</p>
                                  <p className="text-xs leading-5 text-slate-500">{item.hint}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        {metaConnectionFeedback ? (
                          <div className={metaConnectionFeedback.status === 'error' ? 'mt-4 flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-sm text-rose-900' : 'mt-4 flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-900'}>
                            <p>{metaConnectionFeedback.message}</p>
                            <Button type="button" variant="ghost" className={metaConnectionFeedback.status === 'error' ? 'h-auto rounded-lg px-2 py-1 text-xs text-rose-800 hover:bg-rose-100' : 'h-auto rounded-lg px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100'} onClick={() => setMetaConnectionFeedback(null)}>
                              Ocultar
                            </Button>
                          </div>
                        ) : null}
                        {selectedMeta.hasConnection ? (
                          <div className="mt-4 space-y-3 text-sm text-slate-700">
                            <p><span className="font-semibold text-slate-900">Cuenta conectada:</span> {selectedMeta.connectedUserName || 'Meta conectada'}</p>
                            <p><span className="font-semibold text-slate-900">Conectado:</span> {formatDate(selectedMeta.connectedAt)}</p>
                            <p><span className="font-semibold text-slate-900">Última sincronización:</span> {formatDate(selectedMeta.lastSyncAt)}</p>
                            <p><span className="font-semibold text-slate-900">Expira token:</span> {formatDate(selectedMeta.tokenExpiresAt)}</p>
                            {selectedMetaGuide ? (
                              <div className={selectedMetaGuide.tone === 'amber' ? 'rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-amber-900' : 'rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 text-emerald-900'}>
                                <p className="font-semibold">{selectedMetaGuide.title}</p>
                                <p className="mt-1 text-sm leading-6">{selectedMetaGuide.description}</p>
                              </div>
                            ) : null}
                            {selectedChannel.provider === 'WHATSAPP_CLOUD' || selectedChannel.provider === 'WHATSAPP_SANDBOX' ? (
                              <div ref={metaPhoneSelectionRef} className={metaSelectionFocusTarget === 'phone' ? 'grid gap-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-3 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] transition' : 'grid gap-2 rounded-2xl border border-sky-200 bg-white/70 p-3 transition'}>
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
                              <div ref={metaPageSelectionRef} className={metaSelectionFocusTarget === 'page' ? 'grid gap-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-3 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] transition' : 'grid gap-2 rounded-2xl border border-sky-200 bg-white/70 p-3 transition'}>
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
                              <div ref={metaInstagramSelectionRef} className={metaSelectionFocusTarget === 'instagram' ? 'grid gap-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-3 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] transition' : 'grid gap-2 rounded-2xl border border-sky-200 bg-white/70 p-3 transition'}>
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
              </CardContent>
            </Card>
          ) : null}

          {operationsPanelView === 'assets' ? (
          <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>Studio de assets</CardTitle>
                  <CardDescription>
                    {selectedChannel
                      ? `Canal activo: ${selectedChannel.name}. Desde aquí copias scripts, payloads, tokens y URLs para formularios, chatbot, correo y social.`
                      : 'Selecciona un canal para ver el setup operativo.'}
                  </CardDescription>
                </div>
                {operationsPanelSwitcher}
              </div>
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
                        <p className="font-semibold">Google / Outlook / Sheets</p>
                        <p className="mt-2 leading-6">Correo y hojas quedaron montados como bridges del mismo CRM. Así puedes importar, exportar o automatizar captación sin abrir otro módulo comercial paralelo.</p>
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
                      <Card className="rounded-3xl border-emerald-200 bg-emerald-50/60">
                        <CardHeader>
                          <CardTitle className="text-base">Google Sheets Bridge</CardTitle>
                          <CardDescription>Endpoints para preview, import y export sobre la hoja configurada en este canal.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm text-slate-700">
                          <div className="rounded-2xl border border-white/70 bg-white/85 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">CSV origen</p>
                            <p className="mt-2 break-all font-medium text-slate-900">{selectedGoogleSheetsCsvUrl || 'Configura URL CSV o Spreadsheet ID + pestaña en el canal'}</p>
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-xs uppercase tracking-[0.14em] text-slate-500">Preview</Label>
                            <Textarea value={snippets.googleSheetsPreview} readOnly rows={2} className="font-mono text-xs" />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-xs uppercase tracking-[0.14em] text-slate-500">Import</Label>
                            <Textarea value={snippets.googleSheetsImport} readOnly rows={2} className="font-mono text-xs" />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-xs uppercase tracking-[0.14em] text-slate-500">Export</Label>
                            <Textarea value={snippets.googleSheetsExport} readOnly rows={2} className="font-mono text-xs" />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button className="rounded-xl" onClick={() => void copyText('bridge-google-sheets-import', snippets.googleSheetsImport)}>
                              {copiedKey === 'bridge-google-sheets-import' ? 'Copiado' : 'Copiar import'}
                            </Button>
                            <Button variant="outline" className="rounded-xl" onClick={() => void copyText('bridge-google-sheets-export', snippets.googleSheetsExport)}>
                              {copiedKey === 'bridge-google-sheets-export' ? 'Copiado' : 'Copiar export'}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                        <p className="font-semibold">Google Sheets operativo</p>
                        <p className="mt-2 leading-6">La hoja entra por preview/import CSV y la salida vuelve a CSV del canal. Con eso ya puedes usar Google Sheets como backoffice comercial, checklist de ferias o consolidado manual de campañas.</p>
                      </div>
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
          ) : null}
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
                          <p className="mt-1 text-xs leading-5 text-slate-500">Ahora el mapa también sirve para editar ramas: selecciona una conexión para cambiar el destino, crear una etapa nueva conectada o quitar el vínculo.</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-800">Rama por respuesta</span>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">Nodo activo</span>
                          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-800">Conexión editable</span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-600">
                        <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">Haz clic en un nodo para editar su contenido</span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">Haz clic en una rama para editar a dónde termina la respuesta</span>
                        <Button type="button" variant="outline" className="h-7 rounded-xl px-2.5 text-[11px]" onClick={() => selectedChatbotFlowStage ? addChatbotResponseOption(selectedChatbotFlowStage.id as ChatbotFlowStageId) : null} disabled={!selectedChatbotFlowStage}>Agregar respuesta a la etapa activa</Button>
                      </div>

                      <div className="mt-4 overflow-auto rounded-[22px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.08),transparent_28%),linear-gradient(180deg,#f8fffc,#ffffff)] p-3">
                        <div className="relative" style={{ width: chatbotCanvasModel.width, height: chatbotCanvasModel.height }}>
                          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${chatbotCanvasModel.width} ${chatbotCanvasModel.height}`} fill="none">
                            {chatbotCanvasModel.connections.map((connection) => {
                              const isSelected = connection.id === selectedChatbotConnectionId
                              return (
                                <g key={connection.id}>
                                  <path d={connection.path} stroke={isSelected ? '#0ea5e9' : '#94a3b8'} strokeWidth={isSelected ? 3 : 1.6} strokeDasharray={isSelected ? '0' : '6 6'} strokeLinecap="round" />
                                </g>
                              )
                            })}
                          </svg>

                          {chatbotCanvasModel.connections.map((connection) => {
                            const isSelected = connection.id === selectedChatbotConnectionId
                            const targetTitle = chatbotBuilderDraft.flowStages.find((stage) => stage.id === connection.toStageId)?.title || connection.toStageId
                            return (
                              <button
                                key={`${connection.id}-label`}
                                type="button"
                                onClick={() => {
                                  setSelectedChatbotConnectionId(connection.id)
                                  setSelectedChatbotStageId(connection.fromStageId as ChatbotFlowStageId)
                                }}
                                className={isSelected ? 'absolute z-10 rounded-full border border-sky-300 bg-sky-100 px-2.5 py-1 text-[10px] font-semibold text-sky-800 shadow-sm' : 'absolute z-10 rounded-full border border-violet-200 bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50'}
                                style={{ left: connection.labelX, top: connection.labelY, transform: 'translate(-50%, -50%)' }}
                                title={`Editar rama hacia ${targetTitle}`}
                              >
                                {connection.label}
                              </button>
                            )
                          })}

                          {chatbotCanvasModel.nodes.map((node, index) => {
                            const isSelected = node.stage.id === selectedChatbotStageId
                            return (
                              <button
                                key={node.stage.id}
                                type="button"
                                onClick={() => {
                                  setSelectedChatbotStageId(node.stage.id as ChatbotFlowStageId)
                                  setSelectedChatbotConnectionId(null)
                                }}
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
                                  <div className="mt-3 space-y-1.5">
                                    {node.stage.responseOptions.slice(0, 3).map((option) => {
                                      const targetTitle = chatbotBuilderDraft.flowStages.find((stage) => stage.id === option.targetStageId)?.title || option.targetStageId
                                      return (
                                        <div key={option.id} className="flex items-center justify-between gap-2 rounded-2xl border border-violet-100 bg-violet-50/70 px-2.5 py-1.5 text-[10px] text-violet-900">
                                          <span className="font-semibold">{option.label}</span>
                                          <span className="truncate text-right text-violet-700">{targetTitle}</span>
                                        </div>
                                      )
                                    })}
                                    {node.stage.responseOptions.length > 3 ? <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">+{node.stage.responseOptions.length - 3} ramas más</span> : null}
                                  </div>
                                ) : null}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {selectedChatbotConnection && selectedChatbotConnectionSourceStage && selectedChatbotConnectionOption ? (
                        <div className="mt-4 rounded-[22px] border border-sky-200 bg-sky-50/80 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Rama seleccionada</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{selectedChatbotConnectionOption.label}</p>
                              <p className="mt-1 text-xs text-slate-600">Sale desde {selectedChatbotConnectionSourceStage.title} y actualmente termina en {chatbotBuilderDraft.flowStages.find((stage) => stage.id === selectedChatbotConnection.toStageId)?.title || selectedChatbotConnection.toStageId}.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => setSelectedChatbotStageId(selectedChatbotConnection.toStageId as ChatbotFlowStageId)}>
                                Ir al nodo destino
                              </Button>
                              <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => addConnectedChatbotStage(selectedChatbotConnection.fromStageId as ChatbotFlowStageId, selectedChatbotConnection.optionId)}>
                                Crear etapa y conectar
                              </Button>
                              <Button type="button" variant="outline" className="h-8 rounded-xl border-rose-200 px-3 text-xs text-rose-700" onClick={() => removeChatbotResponseOption(selectedChatbotConnection.fromStageId as ChatbotFlowStageId, selectedChatbotConnection.optionId)}>
                                Quitar vínculo
                              </Button>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div className="grid gap-2">
                              <Label>La respuesta termina en</Label>
                              <Select value={selectedChatbotConnection.toStageId} onValueChange={(value) => updateChatbotResponseOption(selectedChatbotConnection.fromStageId as ChatbotFlowStageId, selectedChatbotConnection.optionId, { targetStageId: value })}>
                                <SelectTrigger className="h-11 rounded-xl bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {chatbotBuilderDraft.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label>Match de esta lógica</Label>
                              <Select value={selectedChatbotConnectionOption.matchMode} onValueChange={(value) => updateChatbotResponseOption(selectedChatbotConnection.fromStageId as ChatbotFlowStageId, selectedChatbotConnection.optionId, { matchMode: value as ChatbotFlowResponseMatchMode })}>
                                <SelectTrigger className="h-11 rounded-xl bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="contains">Contiene palabras</SelectItem>
                                  <SelectItem value="exact">Coincidencia exacta</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2 md:col-span-2">
                              <Label>Frases que activan esta rama</Label>
                              <Textarea value={selectedChatbotConnectionOption.matchValue} onChange={(event) => updateChatbotResponseOption(selectedChatbotConnection.fromStageId as ChatbotFlowStageId, selectedChatbotConnection.optionId, { matchValue: event.target.value })} rows={2} className="rounded-2xl bg-white" />
                            </div>
                          </div>
                        </div>
                      ) : null}
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

              <div className="mt-5 pr-1">
                {renderWebFormConfigurationSections('builder')}
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
        <DialogContent className="h-[92vh] max-h-[92vh] w-[97vw] max-w-[1560px] overflow-hidden rounded-[30px] border-slate-200 bg-white/98 p-0 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.45)]">
          <div className={wizardStep === 'template' ? 'h-full min-h-0' : 'grid h-full min-h-0 gap-0 lg:grid-cols-[0.9fr_1.1fr]'}>
            <div className={wizardStep === 'template' ? 'min-h-0 h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.18),transparent_32%),linear-gradient(180deg,#f8fbff,#ffffff)] p-6' : 'min-h-0 overflow-y-auto border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.18),transparent_32%),linear-gradient(180deg,#f8fbff,#ffffff)] p-6 lg:border-b-0 lg:border-r'}>
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
                <div className="mt-5 space-y-4 pr-1">
                  <div className="rounded-[26px] border border-slate-200 bg-white/85 p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Paso 1 · Elige el tipo de canal</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-950">Elige cómo quieres captar tus leads.</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Selecciona un canal para continuar.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                            ? `h-full rounded-[26px] p-3.5 text-left shadow-sm transition-shadow ${surface.card} ${surface.selected}`
                            : `h-full rounded-[26px] p-3.5 text-left shadow-sm transition-shadow hover:shadow-md ${surface.card}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${surface.iconWrap}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-semibold leading-5 text-slate-950">{preset.name}</p>
                              <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] ${surface.pill}`}>{preset.connectionModel}</span>
                            </div>
                          </div>
                        </button>
                      )
                    })()
                  ))}
                  </div>
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
                        <div className="mt-4">
                          {renderWebFormPreview(createForm, { maxWidthClassName: wizardChatPreviewViewport === 'mobile' ? 'max-w-[340px]' : 'max-w-xl', outerPaddingClassName: 'p-4', titleClassName: 'text-lg', messageMinHeight: 112 })}
                        </div>
                        <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2"><p className="font-semibold text-slate-900">Campos activos</p><p className="mt-1">{[createForm.showNameField && 'Nombre', createForm.showEmailField && 'Correo', createForm.showPhoneField && 'Teléfono', createForm.showCompanyField && 'Empresa', createForm.showCityField && 'Ciudad', createForm.showProductField && 'Producto', createForm.showMessageField && 'Mensaje', createForm.webFormCustomFields.length ? `${createForm.webFormCustomFields.length} personalizados` : ''].filter(Boolean).join(' · ')}</p></div>
                          <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2"><p className="font-semibold text-slate-900">Tipografía</p><p className="mt-1">{normalizePixelValue(createForm.formFontSize, '14')}px · {createForm.fontFamily}</p></div>
                          <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2"><p className="font-semibold text-slate-900">Forma</p><p className="mt-1">Radio {normalizePixelValue(createForm.formInputRadius, '16')}px · Gap {normalizePixelValue(createForm.formFieldSpacing, '14')}px{createForm.termsEnabled ? ' · términos activos' : ''}</p></div>
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

            {wizardStep !== 'template' ? <div className="flex min-h-0 flex-col overflow-hidden p-6">
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
                {!createIsPublicWebForm && !createIsChatbot ? (
                  <>
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
                  </>
                ) : null}
                {createUsesWebhook ? (
                  <>
                    {usesMetaProvider(createForm.provider) ? (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-900 md:col-span-2">
                        <p className="font-semibold">Conexión Meta recomendada para este canal</p>
                        <p className="mt-2 leading-6">
                          Primero crea el canal y usa OAuth con Meta. Después selecciona el número, página o cuenta sincronizada desde el panel del canal. La configuración manual queda solo como respaldo.
                        </p>
                        <div className="mt-4 grid gap-2">
                          {wizardMetaChecklist.map((item) => (
                            <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-white/80 px-3 py-2">
                              <span className={item.done ? 'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700' : 'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700'}>{item.done ? 'OK' : '!'}</span>
                              <div>
                                <p className="font-medium text-slate-900">{item.label}</p>
                                <p className="text-xs leading-5 text-slate-600">{item.hint}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Button type="button" variant="outline" className="rounded-xl border-sky-200 bg-white text-sky-800 hover:bg-sky-100" onClick={() => setWizardMetaAdvancedOpen((current) => !current)}>
                            {wizardMetaAdvancedOpen ? 'Ocultar configuración manual avanzada' : 'Mostrar configuración manual avanzada'}
                          </Button>
                          <p className="text-xs leading-5 text-slate-600">Úsala solo si el cliente aún no autoriza OAuth o si necesitas cargar un identificador puntual para una prueba controlada.</p>
                        </div>
                      </div>
                    ) : null}
                    {(!usesMetaProvider(createForm.provider) || wizardMetaAdvancedOpen) ? (
                      <>
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
                  </>
                ) : null}

                {!createIsPublicWebForm && !createIsBridge && createForm.provider === 'WEB_FORM' ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Selector del formulario legacy</Label>
                    <Input value={createForm.formSelector} onChange={(e) => setCreateForm((prev) => ({ ...prev, formSelector: e.target.value }))} className="h-11 rounded-xl" placeholder="#lead-form" />
                    <p className="text-xs leading-5 text-slate-500">Se conserva para sitios que ya tienen su propio formulario. El modo recomendado ahora es iframe público hospedado por SGDigital.</p>
                  </div>
                ) : null}

                {!createIsPublicWebForm && createForm.provider === 'WEB_FORM' ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Tipo de bridge</Label>
                    <Select value={createForm.bridgeKind} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, bridgeKind: value as CrmBridgeKind }))}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERIC">GENERIC</SelectItem>
                        <SelectItem value="GMAIL">GMAIL</SelectItem>
                        <SelectItem value="OUTLOOK">OUTLOOK</SelectItem>
                            <SelectItem value="GOOGLE_SHEETS">GOOGLE_SHEETS</SelectItem>
                        <SelectItem value="TIKTOK">TIKTOK</SelectItem>
                        <SelectItem value="YOUTUBE">YOUTUBE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {createForm.provider === 'WEB_FORM' && createForm.bridgeKind === 'GOOGLE_SHEETS' ? (
                  <>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>URL CSV publicada</Label>
                      <Input value={createForm.googleSheetsPublishedCsvUrl} onChange={(e) => setCreateForm((prev) => ({ ...prev, googleSheetsPublishedCsvUrl: e.target.value }))} className="h-11 rounded-xl" placeholder="https://docs.google.com/spreadsheets/d/.../gviz/tq?tqx=out:csv" />
                      <p className="text-xs leading-5 text-slate-500">Si la hoja está publicada o compartida por link CSV, esta es la vía más directa para preview, import y export operativos.</p>
                    </div>
                    <div className="grid gap-2">
                      <Label>Spreadsheet ID</Label>
                      <Input value={createForm.googleSheetsSpreadsheetId} onChange={(e) => setCreateForm((prev) => ({ ...prev, googleSheetsSpreadsheetId: e.target.value }))} className="h-11 rounded-xl" placeholder="1AbC..." />
                    </div>
                    <div className="grid gap-2">
                      <Label>Nombre de pestaña</Label>
                      <Input value={createForm.googleSheetsSheetName} onChange={(e) => setCreateForm((prev) => ({ ...prev, googleSheetsSheetName: e.target.value }))} className="h-11 rounded-xl" placeholder="Leads" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Límite por importación</Label>
                      <Input value={createForm.googleSheetsRowLimit} onChange={(e) => setCreateForm((prev) => ({ ...prev, googleSheetsRowLimit: e.target.value.replace(/[^0-9]/g, '') || '200' }))} className="h-11 rounded-xl" placeholder="200" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Modo de importación</Label>
                      <Select value={createForm.googleSheetsImportMode} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, googleSheetsImportMode: value as 'LEADS_ONLY' | 'LEADS_AND_OPPORTUNITIES' }))}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LEADS_ONLY">Solo leads</SelectItem>
                          <SelectItem value="LEADS_AND_OPPORTUNITIES">Leads y oportunidades</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {createForm.googleSheetsImportMode === 'LEADS_AND_OPPORTUNITIES' ? (
                      <div className="grid gap-2">
                        <Label>Etapa inicial de oportunidad</Label>
                        <Select value={createForm.googleSheetsOpportunityStage} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, googleSheetsOpportunityStage: value }))}>
                          <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NEW">NEW</SelectItem>
                            <SelectItem value="QUALIFIED">QUALIFIED</SelectItem>
                            <SelectItem value="PROPOSAL">PROPOSAL</SelectItem>
                            <SelectItem value="NEGOTIATION">NEGOTIATION</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900 md:col-span-2">
                      <p className="font-semibold">Primer slice operativo</p>
                      <p className="mt-2 leading-6">Este bridge ya deja lista la previsualización de filas, la importación al CRM y la exportación CSV del propio canal. OAuth y service account quedan para la fase enterprise, pero el flujo comercial ya puede operar hoy.</p>
                    </div>
                  </>
                ) : null}

                {createIsPublicWebForm ? <div className="md:col-span-2">{renderWebFormConfigurationSections('wizard')}</div> : null}

                {createIsChatbot ? <div className="md:col-span-2">{renderChatbotWizardConfigurationSections()}</div> : null}
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
                        {usesMetaProvider(createForm.provider) ? (
                          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3 sm:col-span-2">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-sky-700">Siguiente paso después de crear</p>
                            <p className="mt-2 text-sm font-semibold text-sky-900">Conecta Meta y aplica el activo sincronizado</p>
                            <p className="mt-2 text-xs leading-5 text-sky-800">Después de guardar el canal, usa Conectar con Meta. Cuando vuelvas, selecciona el número, página o cuenta correcta desde el bloque Conexión real con Meta.</p>
                          </div>
                        ) : null}
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
                <Button variant="outline" className="rounded-xl" onClick={() => setWizardStep(wizardStep === 'review' ? 'config' : 'template')} disabled={saving}>Atrás</Button>
                {wizardStep !== 'review' ? <Button variant="outline" className="rounded-xl" onClick={() => setWizardStep('review')} disabled={saving}>Revisar canal</Button> : null}
                <Button variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)} disabled={saving}>Cancelar</Button>
                <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => void saveChannel()} disabled={saving || wizardStep !== 'review'}>
                  {saving ? (editingChannelId ? 'Guardando...' : 'Creando...') : (editingChannelId ? 'Guardar cambios' : 'Crear canal')}
                </Button>
              </DialogFooter>
            </div> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={metaOnboardingOpen} onOpenChange={(open) => {
        setMetaOnboardingOpen(open)
        if (!open && metaOnboardingState !== 'waiting') {
          setMetaOnboardingState('idle')
          setMetaOnboardingMessage('')
        }
      }}>
        <DialogContent className="max-w-2xl rounded-[30px] border-sky-200 bg-white p-0 shadow-[0_28px_80px_-42px_rgba(14,165,233,0.32)]">
          <div className="rounded-t-[30px] bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,.18),transparent_40%),linear-gradient(180deg,#eff6ff,#ffffff)] p-6">
            <DialogHeader>
              <DialogTitle>Onboarding guiado de Meta</DialogTitle>
              <DialogDescription>Conecta el canal sin salir del contexto del CRM y vuelve al panel para confirmar el activo sincronizado.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-5 p-6 pt-4">
            {selectedChannel && usesMetaProvider(selectedChannel.provider) ? (
              <>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Canal</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{selectedChannel.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{getChannelProviderLabel(selectedChannel.provider, selectedBridgeKind as CrmBridgeKind)}</p>
                </div>

                <div className="grid gap-2">
                  {selectedMetaOnboardingChecklist.map((item) => (
                    <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                      <span className={item.done ? 'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700' : 'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-700'}>{item.done ? 'OK' : '!'}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.label}</p>
                        <p className="text-xs leading-5 text-slate-500">{item.hint}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-[24px] border border-sky-200 bg-sky-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Ruta guiada</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p>1. Valida las condiciones previas del canal.</p>
                    <p>2. Pulsa Continuar con Facebook para abrir Meta en una ventana controlada.</p>
                    <p>3. Autoriza el acceso y espera el regreso automático al CRM.</p>
                    <p>4. Si Meta devuelve varios activos, selecciónalos abajo en el bloque Conexión real con Meta.</p>
                  </div>
                </div>

                {metaOnboardingMessage ? (
                  <div className={metaOnboardingState === 'error' ? 'rounded-[24px] border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-900' : metaOnboardingState === 'success' ? 'rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900' : 'rounded-[24px] border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-900'}>
                    {metaOnboardingMessage}
                  </div>
                ) : null}

                <DialogFooter className="border-t border-slate-100 pt-4">
                  <Button variant="outline" className="rounded-xl" onClick={() => setMetaOnboardingOpen(false)} disabled={metaOnboardingState === 'waiting'}>
                    {metaOnboardingState === 'success' ? 'Cerrar' : 'Cancelar'}
                  </Button>
                  <Button type="button" className="rounded-xl bg-[#1877f2] text-white hover:bg-[#166fe0]" onClick={() => void launchMetaPopup(selectedChannel)} disabled={metaOnboardingState === 'waiting'}>
                    <Facebook className="mr-2 h-4 w-4" />
                    {metaOnboardingState === 'waiting' ? 'Esperando autorización...' : selectedMeta.hasConnection ? 'Reconectar con Facebook' : 'Continuar con Facebook'}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                Selecciona primero un canal Meta para iniciar este onboarding.
              </div>
            )}
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