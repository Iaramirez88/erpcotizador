"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react'
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
import { Activity, BarChart3, Bot, Copy, Download, Eye, Facebook, Globe, Goal, Instagram, Mail, MessageCircle, Sparkles, Target, TrendingUp, Upload } from 'lucide-react'
import { useI18n } from '@/components/providers/i18n-provider'
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
  getChatbotStudioSettings,
  getDefaultChatbotAutomationFlowFromSettings,
  mergeChatbotDefaultFlowSettings,
} from '@/lib/crm-chatbot-studio'
import {
  getPublicChatbotPreChatFormPreset,
  getPublicChatbotPreChatFormPresets,
  getPublicChatbotSettings,
  type PublicChatbotResetConversationUnit,
} from '@/lib/crm-public-chatbot'
import { type ChatbotInactivityAction, type ChatbotInactivityUnit } from '@/lib/crm-chatbot-inactivity'
import {
  buildBookingEmbedUrl,
  buildBookingIframeSnippet,
  buildBookingSnippet,
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

type WhatsAppConnectionMode = 'CRM_ONLY' | 'HYBRID_CRM_PHONE'

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
  outboundMessagingStats?: {
    config?: {
      perChannelDaily?: number | null
      perChannelMonthly?: number | null
      perEmpresaDaily?: number | null
      perEmpresaMonthly?: number | null
    } | null
    usage?: {
      perChannelDaily: number
      perChannelMonthly: number
      perEmpresaDaily: number
      perEmpresaMonthly: number
    } | null
    meters?: Array<{
      key: string
      label: string
      limit: number
      used: number
      percentage: number
    }>
  }
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

type BrandLogoProps = { className?: string }

function GmailLogo({ className }: BrandLogoProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect x="6" y="10" width="36" height="28" rx="6" fill="#fff" />
      <path d="M10 16.5V34a2 2 0 0 0 2 2h5V22.6L24 28l7-5.4V36h5a2 2 0 0 0 2-2V16.5l-14 10.8-14-10.8Z" fill="#EA4335" />
      <path d="M10 16.5 24 27.3 38 16.5V14a2 2 0 0 0-2-2h-2.3L24 19.2 14.3 12H12a2 2 0 0 0-2 2v2.5Z" fill="#4285F4" />
      <path d="M10 16.5V34a2 2 0 0 0 2 2h2.5V18.5L10 16.5Z" fill="#34A853" />
      <path d="M38 16.5V34a2 2 0 0 1-2 2h-2.5V18.5L38 16.5Z" fill="#FBBC04" />
    </svg>
  )
}

function OutlookLogo({ className }: BrandLogoProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <path d="M18 10h18a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H18V10Z" fill="#0A64C9" />
      <path d="M18 14h18v20H18V14Z" fill="#1173D4" />
      <path d="M18 18l9 7 9-7" stroke="#D9ECFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 14.5 22 12v24L8 33.5V14.5Z" fill="#0F5FB9" />
      <circle cx="15.5" cy="24" r="5.3" fill="#fff" />
      <circle cx="15.5" cy="24" r="2.8" fill="#0F5FB9" />
    </svg>
  )
}

function GoogleSheetsLogo({ className }: BrandLogoProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <path d="M14 6h14l10 10v22a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4Z" fill="#0F9D58" />
      <path d="M28 6v10h10" fill="#2BB673" />
      <path d="M17 19h14M17 25h14M17 31h14M22 16v18" stroke="#E8F5E9" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

function GoogleCalendarLogo({ className }: BrandLogoProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect x="8" y="10" width="32" height="30" rx="6" fill="#4285F4" />
      <rect x="8" y="10" width="32" height="8" rx="6" fill="#1A73E8" />
      <path d="M16 6v8M32 6v8" stroke="#DCEBFF" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 24c-4 0-7 3-7 7h14c0-4-3-7-7-7Zm0 0a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="#fff" />
    </svg>
  )
}

function MicrosoftLogo({ className }: BrandLogoProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect x="8" y="8" width="14" height="14" fill="#F25022" />
      <rect x="26" y="8" width="14" height="14" fill="#7FBA00" />
      <rect x="8" y="26" width="14" height="14" fill="#00A4EF" />
      <rect x="26" y="26" width="14" height="14" fill="#FFB900" />
    </svg>
  )
}

function SlackLogo({ className }: BrandLogoProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <path d="M18.4 7.5a4.4 4.4 0 1 0-8.8 0v8.9a4.4 4.4 0 0 0 8.8 0V7.5Z" fill="#E01E5A" />
      <path d="M22 18.4a4.4 4.4 0 0 0 0-8.8h-8.9a4.4 4.4 0 1 0 0 8.8H22Z" fill="#E01E5A" />
      <path d="M40.5 18.4a4.4 4.4 0 1 0 0-8.8h-8.9a4.4 4.4 0 1 0 0 8.8h8.9Z" fill="#36C5F0" />
      <path d="M29.6 22a4.4 4.4 0 0 0 8.8 0v-8.9a4.4 4.4 0 1 0-8.8 0V22Z" fill="#36C5F0" />
      <path d="M29.6 40.5a4.4 4.4 0 1 0 8.8 0v-8.9a4.4 4.4 0 1 0-8.8 0v8.9Z" fill="#2EB67D" />
      <path d="M26 29.6a4.4 4.4 0 0 0 0 8.8h8.9a4.4 4.4 0 1 0 0-8.8H26Z" fill="#2EB67D" />
      <path d="M7.5 29.6a4.4 4.4 0 1 0 0 8.8h8.9a4.4 4.4 0 1 0 0-8.8H7.5Z" fill="#ECB22E" />
      <path d="M18.4 26a4.4 4.4 0 0 0-8.8 0v8.9a4.4 4.4 0 1 0 8.8 0V26Z" fill="#ECB22E" />
    </svg>
  )
}

function TeamsLogo({ className }: BrandLogoProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <circle cx="34" cy="16" r="5" fill="#7B83EB" />
      <circle cx="39" cy="29" r="4" fill="#A6AAF5" />
      <rect x="10" y="12" width="22" height="24" rx="5" fill="#5059C9" />
      <rect x="6" y="16" width="17" height="18" rx="4" fill="#3E45A8" />
      <path d="M11.5 20h8v3h-2.4v7h-3.2v-7h-2.4v-3Z" fill="#fff" />
      <path d="M32 20h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-8V20Z" fill="#7B83EB" />
    </svg>
  )
}

function MetaLogo({ className }: BrandLogoProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <path d="M10.5 30.2c2.4-8.5 5.9-13 10.3-13 4.5 0 6.8 5.7 9.1 10.8 1.8 4 3.1 5.9 5.3 5.9 2 0 3.3-1.4 3.3-3.7 0-4.9-3.9-12.1-8-15.7-2.2-1.9-4.5-2.8-7.1-2.8-3.7 0-6.8 1.8-9.6 5.5-3.2 4.1-5.7 10.2-5.7 14.7 0 3.7 2.1 6.2 5.7 6.2 3.5 0 5.8-2.7 8.5-8.8 2.1-4.6 3.7-6.8 5.5-6.8 1.7 0 3.2 2.2 5.1 6.8 2.4 5.8 4.7 8.8 8.4 8.8 3.6 0 6.4-2.7 6.4-7 0-7.1-4.8-15.8-10-20.4-3.6-3.2-8.3-5-13.3-5-6.2 0-11.5 3.1-15.8 8.9C4.6 20.5 2 27 2 31.9" stroke="#0866FF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TikTokLogo({ className }: BrandLogoProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <path d="M24 8v20.2a7.6 7.6 0 1 1-7.6-7.6" stroke="#25F4EE" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 8c1 3.8 3.6 6.9 7.2 8.6" stroke="#FE2C55" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 8v20.2a7.6 7.6 0 1 1-7.6-7.6" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28 8c1 3.8 3.6 6.9 7.2 8.6V21c-2.8-.1-5.4-1-7.6-2.6V31a10.6 10.6 0 1 1-10.6-10.6" stroke="#111827" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function YouTubeLogo({ className }: BrandLogoProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect x="6" y="12" width="36" height="24" rx="8" fill="#FF0033" />
      <path d="M21 18.5 31 24l-10 5.5v-11Z" fill="#fff" />
    </svg>
  )
}

function WhatsAppLogo({ className }: BrandLogoProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="16" fill="#25D366" />
      <path d="M14.7 36.1 16.9 30a12.5 12.5 0 1 1 4.5 4.4l-6.7 1.7Z" fill="#25D366" />
      <path d="M20.9 17.8c-.4-.9-.8-1-1.3-1h-1.1c-.4 0-.9.1-1.3.6-.4.5-1.7 1.6-1.7 3.9 0 2.3 1.7 4.6 1.9 4.9.3.3 3.2 5 8 6.8 1.2.4 2.1.7 2.8.8 1.2.2 2.3.2 3.1-.1.9-.3 2.6-1.1 2.9-2.2.4-1 .4-1.9.3-2-.1-.2-.5-.3-1-.6-.5-.2-2.9-1.4-3.4-1.6-.4-.2-.7-.2-1 .2-.3.5-1.2 1.6-1.4 1.9-.3.3-.5.4-1 .1-.5-.2-2-.8-3.8-2.4-1.4-1.2-2.3-2.7-2.6-3.2-.3-.5 0-.7.2-1 .2-.2.5-.5.7-.8.2-.3.3-.5.5-.8.2-.3.1-.6 0-.8-.1-.2-1-2.4-1.4-3.3Z" fill="#fff" />
    </svg>
  )
}

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

type IntegrationGuideKey = TemplatePreset['key']
type GuideAccent = 'sky' | 'emerald' | 'violet' | 'amber' | 'blue' | 'fuchsia' | 'slate'

type IntegrationGuideStep = {
  title: string
  detail: string
  bullets: string[]
}

type IntegrationGuide = {
  title: string
  summary: string
  audience: string
  estimatedTime: string
  accent: GuideAccent
  prerequisites: string[]
  steps: IntegrationGuideStep[]
  validations: string[]
  troubleshooting: string[]
  assets: Array<{ label: string; value: string }>
  visualTitle: string
  visualDescription: string
  visualNodes: Array<{ label: string; caption: string }>
}

type IntegrationSnippets = {
  webForm: string
  webFormIframe: string
  webFormEmbedUrl: string
  chatbot: string
  chatbotIframe: string
  chatbotEmbedUrl: string
  gmail: string
  outlook: string
  webhook: string
  googleSheetsPreview: string
  googleSheetsImport: string
  googleSheetsExport: string
}

type ImplementationAssetCard = {
  id: string
  title: string
  description: string
  value: string
  copyLabel: string
  disabled?: boolean
}

type WizardStep = 'template' | 'config' | 'review' | 'implementation'
type ChatbotPreviewMode = 'floating' | 'compact' | 'expanded'
type ChatbotPreviewViewport = 'desktop' | 'mobile'
type CrmWorkspaceView = 'operations' | 'metrics'
type CrmOperationsPanelView = 'preview' | 'readiness' | 'assets'
type LauncherPosition = 'left' | 'center' | 'right'
type LauncherSize = 'compact' | 'standard' | 'large'
type LauncherPlacement = 'fixed' | 'absolute'
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
  | 'launcherPlacement'
  | 'launcherPosition'
  | 'launcherSize'
  | 'launcherStartsCollapsed'
  | 'launcherOffsetX'
  | 'launcherOffsetY'
  | 'launcherZIndex'
  | 'panelZIndex'
  | 'backdropZIndex'
  | 'headerBadgeLabel'
  | 'statusBadgeLabel'
  | 'chatShellRadius'
  | 'messageBubbleRadius'
  | 'panelShadowPreset'
  | 'showProductField'
  | 'nameLabel'
  | 'namePlaceholder'
  | 'emailLabel'
  | 'emailPlaceholder'
  | 'phoneLabel'
  | 'phonePlaceholder'
  | 'productLabel'
  | 'productPlaceholder'
  | 'messageLabel'
  | 'messagePlaceholder'
  | 'chatResetConversationAfterValue'
  | 'chatResetConversationAfterUnit'
  | 'chatResetConversationAfterAction'
  | 'preChatFormEnabled'
  | 'preChatFormInactivityEnabled'
  | 'preChatFormInactivityValue'
  | 'preChatFormInactivityUnit'
  | 'preChatFormInactivityAction'
  | 'preChatFormTemplate'
  | 'preChatFormTitle'
  | 'preChatFormDescription'
  | 'preChatFormSubmitLabel'
  | 'preChatFormShowNameField'
  | 'preChatFormShowEmailField'
  | 'preChatFormShowPhoneField'
  | 'preChatFormRequireName'
  | 'preChatFormRequireEmail'
  | 'preChatFormRequirePhone'
  | 'preChatFormRequireContactMethod'
  | 'preChatFormShowDepartmentField'
  | 'preChatFormDepartmentLabel'
  | 'preChatFormDepartmentPlaceholder'
  | 'preChatFormDepartmentOptions'
  | 'termsEnabled'
  | 'termsLabel'
  | 'termsLinkText'
  | 'termsLinkUrl'
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
  const preChatPreset = getPublicChatbotPreChatFormPreset('sales-support')

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
    bookingNotifyByEmail: true,
    bookingNotifyByWhatsApp: true,
    outgoingWebhookUrl: '',
    externalAccountId: '',
    externalPageId: '',
    externalPhoneNumberId: '',
    whatsappConnectionMode: 'CRM_ONLY' as WhatsAppConnectionMode,
    whatsappDisplayPhoneNumber: '',
    whatsappAccessToken: '',
    whatsappApiVersion: 'v23.0',
    outboundLimitPerChannelDay: '',
    outboundLimitPerChannelMonth: '',
    outboundLimitPerEmpresaDay: '',
    outboundLimitPerEmpresaMonth: '',
    formSelector: '#lead-form',
    chatbotTitle: 'Asesor virtual SGDigital',
    chatbotPrompt: 'Cuéntanos tu proyecto y te contactamos.',
    assistantName: 'Asesor virtual SGDigital',
    chatResetConversationAfterValue: '12',
    chatResetConversationAfterUnit: 'hours' as PublicChatbotResetConversationUnit,
    chatResetConversationAfterAction: 'restart' as ChatbotInactivityAction,
    preChatFormEnabled: false,
    preChatFormInactivityEnabled: false,
    preChatFormInactivityValue: '12',
    preChatFormInactivityUnit: 'hours' as ChatbotInactivityUnit,
    preChatFormInactivityAction: 'restart' as ChatbotInactivityAction,
    preChatFormTemplate: preChatPreset.value,
    preChatFormTitle: preChatPreset.title,
    preChatFormDescription: preChatPreset.description,
    preChatFormSubmitLabel: preChatPreset.submitLabel,
    preChatFormShowNameField: preChatPreset.showNameField,
    preChatFormShowEmailField: preChatPreset.showEmailField,
    preChatFormShowPhoneField: preChatPreset.showPhoneField,
    preChatFormRequireName: preChatPreset.requireName,
    preChatFormRequireEmail: preChatPreset.requireEmail,
    preChatFormRequirePhone: preChatPreset.requirePhone,
    preChatFormRequireContactMethod: preChatPreset.requireContactMethod,
    preChatFormShowDepartmentField: preChatPreset.showDepartmentField,
    preChatFormDepartmentLabel: preChatPreset.departmentLabel,
    preChatFormDepartmentPlaceholder: preChatPreset.departmentPlaceholder,
    preChatFormDepartmentOptions: preChatPreset.departmentOptions.map((item) => item.label).join('\n'),
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
    launcherPlacement: 'fixed' as LauncherPlacement,
    launcherSize: 'standard' as LauncherSize,
    launcherStartsCollapsed: true,
    launcherOffsetX: '60',
    launcherOffsetY: '60',
    launcherZIndex: '2147483647',
    panelZIndex: '2147483646',
    backdropZIndex: '2147483645',
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
  { key: 'web-booking', name: 'Agenda Web', provider: 'WEB_FORM', bridgeKind: 'BOOKING', description: 'Agenda citas desde un iframe en la web y consúmelas directo en el CRM con confirmación automática.', connectionModel: 'Iframe + API', readiness: 'Operativo hoy', focus: 'Citas, seguimiento y notificación al usuario' },
  { key: 'web-chatbot', name: 'Chatbot Web', provider: 'WEB_CHATBOT', description: 'Chat embebible por iframe con hilo en tiempo real dentro del CRM.', connectionModel: 'Iframe publico', readiness: 'Operativo hoy', focus: 'Conversación, handoff y lead capture' },
  { key: 'whatsapp-cloud', name: 'WhatsApp Cloud', provider: 'WHATSAPP_CLOUD', description: 'Webhook listo para pruebas y conexión oficial.', connectionModel: 'Webhook nativo', readiness: 'Demo avanzada', focus: 'Inbox y mensajes inbound' },
  { key: 'facebook-page', name: 'Facebook / Messenger', provider: 'FACEBOOK_PAGE', description: 'Inbox social vía webhook para mensajes de páginas Meta.', connectionModel: 'Webhook nativo', readiness: 'Demo avanzada', focus: 'Social inbox y conversaciones' },
  { key: 'instagram-dm', name: 'Instagram DM', provider: 'INSTAGRAM_DM', description: 'Captura mensajes de Instagram y llévalos al inbox del CRM.', connectionModel: 'Webhook nativo', readiness: 'Demo avanzada', focus: 'DMs y campañas de performance' },
  { key: 'gmail-bridge', name: 'Gmail Inbox Bridge', provider: 'WEB_FORM', bridgeKind: 'GMAIL', description: 'Apps Script para empujar correos comerciales al inbox omnicanal.', connectionModel: 'Bridge Apps Script', readiness: 'Operativo hoy', focus: 'Correos de prospectos a CRM' },
  { key: 'outlook-bridge', name: 'Outlook Inbox Bridge', provider: 'WEB_FORM', bridgeKind: 'OUTLOOK', description: 'Bridge operativo para Power Automate y Microsoft 365.', connectionModel: 'Bridge Power Automate', readiness: 'Operativo hoy', focus: 'Inbox comercial de Microsoft' },
  { key: 'google-sheets-bridge', name: 'Google Sheets Bridge', provider: 'WEB_FORM', bridgeKind: 'GOOGLE_SHEETS', description: 'Importa y exporta leads desde hojas comerciales sin crear otro módulo.', connectionModel: 'CSV bridge', readiness: 'Operativo hoy', focus: 'Backoffice comercial y campañas' },
  { key: 'google-calendar-bridge', name: 'Google Calendar Bridge', provider: 'WEB_FORM', bridgeKind: 'GOOGLE_CALENDAR', description: 'Empuja tareas y citas del CRM hacia Google Calendar mediante webhook saliente.', connectionModel: 'Outgoing webhook', readiness: 'Operativo hoy', focus: 'Agenda comercial sincronizada' },
  { key: 'microsoft-365-calendar-bridge', name: 'Microsoft 365 Calendar Bridge', provider: 'WEB_FORM', bridgeKind: 'MICROSOFT_365_CALENDAR', description: 'Sincroniza tareas agendadas del CRM hacia Microsoft 365 Calendar con webhook saliente.', connectionModel: 'Outgoing webhook', readiness: 'Operativo hoy', focus: 'Agenda comercial en Microsoft 365' },
  { key: 'slack-bridge', name: 'Slack Alerts Bridge', provider: 'WEB_FORM', bridgeKind: 'SLACK', description: 'Recibe alertas internas de CRM en Slack vía webhook saliente.', connectionModel: 'Outgoing webhook', readiness: 'Operativo hoy', focus: 'Coordinación comercial interna' },
  { key: 'teams-bridge', name: 'Microsoft Teams Alerts Bridge', provider: 'WEB_FORM', bridgeKind: 'TEAMS', description: 'Envía alertas internas de CRM a Teams usando webhook saliente.', connectionModel: 'Outgoing webhook', readiness: 'Operativo hoy', focus: 'Coordinación comercial interna' },
  { key: 'meta-lead-ads-bridge', name: 'Meta Lead Ads Bridge', provider: 'WEB_FORM', bridgeKind: 'META_LEAD_ADS', description: 'Recibe leads de Meta Lead Ads por webhook bridge, n8n, Make o middleware propio.', connectionModel: 'Bridge automation', readiness: 'Operativo hoy', focus: 'Captura de campañas Lead Ads' },
  { key: 'external-form-bridge', name: 'Formulario Externo Bridge', provider: 'WEB_FORM', bridgeKind: 'EXTERNAL_FORM', description: 'Conecta formularios de terceros al CRM sin reescribir el frontend del cliente.', connectionModel: 'Bridge API', readiness: 'Operativo hoy', focus: 'Captura externa unificada' },
  { key: 'tiktok-bridge', name: 'TikTok Lead Bridge', provider: 'WEB_FORM', bridgeKind: 'TIKTOK', description: 'Usa Make/Zapier o webhook para llevar leads al CRM.', connectionModel: 'Bridge automation', readiness: 'Demo guiada', focus: 'Lead Ads y formularios externos' },
  { key: 'youtube-bridge', name: 'YouTube Lead Bridge', provider: 'WEB_FORM', bridgeKind: 'YOUTUBE', description: 'Bridge para formularios, comentarios o capturas desde campañas.', connectionModel: 'Bridge automation', readiness: 'Demo guiada', focus: 'Captura desde video y campañas' },
]

function guideAccentClasses(accent: GuideAccent) {
  switch (accent) {
    case 'emerald':
      return { soft: 'border-emerald-200 bg-emerald-50/70 text-emerald-900', node: 'border-emerald-200 bg-white text-emerald-900', arrow: 'text-emerald-500' }
    case 'violet':
      return { soft: 'border-violet-200 bg-violet-50/70 text-violet-900', node: 'border-violet-200 bg-white text-violet-900', arrow: 'text-violet-500' }
    case 'amber':
      return { soft: 'border-amber-200 bg-amber-50/70 text-amber-900', node: 'border-amber-200 bg-white text-amber-900', arrow: 'text-amber-500' }
    case 'blue':
      return { soft: 'border-blue-200 bg-blue-50/70 text-blue-900', node: 'border-blue-200 bg-white text-blue-900', arrow: 'text-blue-500' }
    case 'fuchsia':
      return { soft: 'border-fuchsia-200 bg-fuchsia-50/70 text-fuchsia-900', node: 'border-fuchsia-200 bg-white text-fuchsia-900', arrow: 'text-fuchsia-500' }
    case 'slate':
      return { soft: 'border-slate-200 bg-slate-50/70 text-slate-900', node: 'border-slate-200 bg-white text-slate-900', arrow: 'text-slate-500' }
    default:
      return { soft: 'border-sky-200 bg-sky-50/70 text-sky-900', node: 'border-sky-200 bg-white text-sky-900', arrow: 'text-sky-500' }
  }
}

function getIntegrationGuideKey(channel: ChannelConnection, bridgeKind: string): IntegrationGuideKey {
  if (channel.provider === 'WEB_CHATBOT') return 'web-chatbot'
  if (channel.provider === 'WHATSAPP_CLOUD' || channel.provider === 'WHATSAPP_SANDBOX') return 'whatsapp-cloud'
  if (channel.provider === 'FACEBOOK_PAGE' || channel.provider === 'MESSENGER') return 'facebook-page'
  if (channel.provider === 'INSTAGRAM_DM') return 'instagram-dm'
  if (bridgeKind === 'BOOKING') return 'web-booking'
  if (bridgeKind === 'GMAIL') return 'gmail-bridge'
  if (bridgeKind === 'OUTLOOK') return 'outlook-bridge'
  if (bridgeKind === 'GOOGLE_SHEETS') return 'google-sheets-bridge'
  if (bridgeKind === 'GOOGLE_CALENDAR') return 'google-calendar-bridge'
  if (bridgeKind === 'MICROSOFT_365_CALENDAR') return 'microsoft-365-calendar-bridge'
  if (bridgeKind === 'SLACK') return 'slack-bridge'
  if (bridgeKind === 'TEAMS') return 'teams-bridge'
  if (bridgeKind === 'META_LEAD_ADS') return 'meta-lead-ads-bridge'
  if (bridgeKind === 'EXTERNAL_FORM') return 'external-form-bridge'
  if (bridgeKind === 'TIKTOK') return 'tiktok-bridge'
  if (bridgeKind === 'YOUTUBE') return 'youtube-bridge'
  return 'web-form'
}

function renderIntegrationGuideVisual(guide: IntegrationGuide): ReactNode {
  const accent = guideAccentClasses(guide.accent)
  return (
    <div className={`rounded-[26px] border p-4 ${accent.soft}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em]">{guide.visualTitle}</p>
      <p className="mt-2 text-sm leading-6">{guide.visualDescription}</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {guide.visualNodes.map((node, index) => (
          <div key={`${node.label}-${index}`} className="flex items-center gap-3 lg:contents">
            <div className={`rounded-[22px] border p-4 ${accent.node}`}>
              <p className="text-sm font-semibold">{node.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{node.caption}</p>
            </div>
            {index < guide.visualNodes.length - 1 ? <div className={`hidden items-center justify-center text-xl font-semibold lg:flex ${accent.arrow}`}>→</div> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function renderBookingPreviewLegend() {
  const items = [
    {
      step: '01',
      title: 'Dia',
      detail: 'El usuario navega el calendario y toma una fecha disponible.',
    },
    {
      step: '02',
      title: 'Hora',
      detail: 'Luego elige el bloque horario que mejor le funcione.',
    },
    {
      step: '03',
      title: 'Confirmacion',
      detail: 'Completa sus datos y el CRM registra la cita con notificacion opcional.',
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.step} className="rounded-2xl border border-sky-200 bg-sky-50/70 p-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-[11px] font-semibold text-white">{item.step}</span>
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

function getDetailedIntegrationGuide(args: {
  channel: ChannelConnection
  bridgeKind: string
  endpoint: string
  token: string
  language: 'es' | 'en'
  snippets: IntegrationSnippets | null
}): IntegrationGuide {
  const key = getIntegrationGuideKey(args.channel, args.bridgeKind)
  const tokenLabel = args.token || args.channel.verifyTokenPreview || (args.language === 'en' ? 'Set a token or channel credential.' : 'Define un token o credencial del canal.')
  const snippets = args.snippets
  const tx = (es: string, en: string) => args.language === 'en' ? en : es

  const buildGuide = (guide: IntegrationGuide) => guide
  const buildBridgeGuide = (
    title: string,
    summary: string,
    accent: GuideAccent,
    audience: string,
    prerequisites: string[],
    steps: IntegrationGuideStep[],
    validations: string[],
    troubleshooting: string[],
    assets: Array<{ label: string; value: string }>,
    visualNodes: Array<{ label: string; caption: string }>,
  ) => buildGuide({
    title,
    summary,
    audience,
    estimatedTime: args.language === 'en' ? '20 to 40 minutes' : '20 a 40 minutos',
    accent,
    prerequisites,
    steps,
    validations,
    troubleshooting,
    assets,
    visualTitle: args.language === 'en' ? 'Visual integration flow' : 'Flujo visual de integración',
    visualDescription: args.language === 'en' ? 'Visual summary of the recommended order to make the channel operational end to end.' : 'Resumen visual del orden recomendado para dejar el canal operativo de punta a punta.',
    visualNodes,
  })

  if (key === 'web-form') {
    return buildBridgeGuide(
      tx('Integración detallada de Formulario Web', 'Detailed Web Form integration'),
      tx('Publica el formulario del CRM como iframe o incrústalo sobre un formulario existente del cliente.', 'Publish the CRM form as an iframe or embed it on the client\'s existing form.'),
      'sky',
      tx('Marketing, desarrollo web o implementador del sitio.', 'Marketing, web development, or site implementer.'),
      [tx('Canal creado y activo en el studio.', 'Channel created and active in the studio.'), tx('Definir si se usará URL pública, iframe o snippet sobre un DOM existente.', 'Define whether to use a public URL, iframe, or snippet on an existing DOM.'), tx('Tener identificado el dominio final donde se publicará.', 'Identify the final domain where it will be published.')],
      [
        { title: tx('1. Ajusta el formulario en el CRM', '1. Adjust the form in the CRM'), detail: tx('Configura textos, campos, CTA, términos y apariencia visual.', 'Configure copy, fields, CTA, legal terms, and visual appearance.'), bullets: [tx('Verifica labels y placeholders comerciales.', 'Verify commercial labels and placeholders.'), tx('Si el cliente no tiene frontend propio, prioriza iframe.', 'If the client has no custom frontend, prioritize the iframe.'), tx('Si ya existe un formulario en la landing, deja listo el selector.', 'If a form already exists on the landing page, leave the selector ready.')] },
        { title: tx('2. Publica la versión embebible', '2. Publish the embeddable version'), detail: tx('Copia la URL pública o el iframe listo para pegar.', 'Copy the public URL or the iframe ready to paste.'), bullets: [`${tx('URL pública', 'Public URL')}: ${snippets?.webFormEmbedUrl || tx('Disponible al seleccionar el canal.', 'Available when selecting the channel.')}`, tx('Usa iframe para CMS o builder visual.', 'Use the iframe for a CMS or visual builder.'), tx('Valida que el sitio no bloquee el embebido por CSP o dominio.', 'Validate that the site does not block the embed because of CSP or domain rules.')] },
        { title: tx('3. Si el cliente ya tiene formulario, usa el snippet bridge', '3. If the client already has a form, use the bridge snippet'), detail: tx('Pega el snippet sobre el DOM existente y ajusta el selector.', 'Paste the snippet into the existing DOM and adjust the selector.'), bullets: [tx('Revisa que el selector exista realmente al cargar la página.', 'Check that the selector actually exists when the page loads.'), `${tx('Token de referencia', 'Reference token')}: ${tokenLabel}`, tx('Mapea nombre, correo, teléfono y mensaje con los names correctos.', 'Map name, email, phone, and message using the correct field names.')] },
        { title: tx('4. Ejecuta la prueba punta a punta', '4. Run the end-to-end test'), detail: tx('Envía una captura real desde la página y revisa lead, actividad y fuente dentro del CRM.', 'Send a real capture from the page and review the lead, activity, and source inside the CRM.'), bullets: [tx('Revisa el endpoint y el estado del canal.', 'Review the endpoint and the channel status.'), tx('Haz una prueba repetida para validar deduplicación.', 'Run a repeated test to validate deduplication.'), tx('Pasa a ACTIVE solo cuando cierre la prueba real.', 'Move to ACTIVE only when the real test is closed.')] },
      ],
      [tx('El formulario abre correctamente.', 'The form opens correctly.'), tx('La captura crea lead y actividad.', 'The capture creates a lead and activity.'), tx('El sitio no bloquea el iframe ni el script.', 'The site does not block the iframe or the script.')],
      [tx('Si el iframe no carga, revisa dominio permitido y políticas del sitio.', 'If the iframe does not load, check allowed domains and site policies.'), tx('Si el snippet no captura, revisa selector y timing de carga.', 'If the snippet does not capture, review the selector and load timing.'), tx('Si no entra al CRM, recopia endpoint y token del canal.', 'If it does not reach the CRM, recopy the channel endpoint and token.')],
      [{ label: 'Endpoint', value: args.endpoint }, { label: tx('URL pública', 'Public URL'), value: snippets?.webFormEmbedUrl || tx('Disponible al seleccionar el canal.', 'Available when selecting the channel.') }, { label: 'Iframe', value: snippets?.webFormIframe || tx('Disponible en la pestaña Formulario.', 'Available in the Form tab.') }],
      [{ label: 'CRM', caption: tx('Configuras el formulario', 'You configure the form') }, { label: tx('Asset web', 'Web asset'), caption: tx('Copias URL, iframe o script', 'You copy the URL, iframe, or script') }, { label: 'Landing', caption: tx('El prospecto envía sus datos', 'The prospect submits their data') }, { label: 'Pipeline', caption: tx('El lead queda trazado', 'The lead is tracked') }],
    )
  }

  if (key === 'web-booking') {
    return buildBridgeGuide(
      tx('Integración detallada de Agenda Web', 'Detailed Web Booking integration'),
      tx('Publica una agenda tipo booking desde el CRM para que el usuario reserve una cita y la operación quede trazada.', 'Publish a booking-style scheduler from the CRM so the user can reserve an appointment and the operation stays tracked.'),
      'sky',
      tx('Implementador web, equipo comercial y responsable de agenda.', 'Web implementer, sales team, and scheduling owner.'),
      [tx('Canal de Agenda Web configurado.', 'Web Booking channel configured.'), tx('Definir si enviará confirmación por correo, WhatsApp o ambos.', 'Define whether it will send confirmation by email, WhatsApp, or both.'), tx('Validar responsable y horario comercial.', 'Validate the owner and business hours.')],
      [
        { title: tx('1. Configura la agenda en el CRM', '1. Configure the booking flow in the CRM'), detail: tx('Ajusta textos, servicio, estados y notificaciones de reserva.', 'Adjust copy, service, states, and booking notifications.'), bullets: [tx('Comprueba que la vista pública muestre la experiencia tipo booking.', 'Check that the public view shows the booking-style experience.'), tx('Activa correo o WhatsApp según la operación.', 'Enable email or WhatsApp according to the operation.'), tx('Verifica el estado TESTING antes de publicar.', 'Verify TESTING status before publishing.')] },
        { title: tx('2. Embebe la agenda en la web', '2. Embed the booking flow on the website'), detail: tx('Inserta la URL pública o el iframe del canal en la booking page.', 'Insert the public URL or the channel iframe into the scheduling page.'), bullets: [`${tx('URL de agenda', 'Booking URL')}: ${snippets?.webFormEmbedUrl || tx('Disponible al seleccionar el canal.', 'Available when selecting the channel.')}`, tx('Ideal para CTA de contacto o campañas.', 'Ideal for contact CTAs or campaigns.'), tx('Prueba la agenda en desktop y mobile.', 'Test the booking flow on desktop and mobile.')] },
        { title: tx('3. Ejecuta una reserva real', '3. Run a real booking'), detail: tx('Selecciona fecha y hora y revisa el resultado dentro del CRM.', 'Select date and time and review the result inside the CRM.'), bullets: [tx('Debe crearse lead y cita asociada.', 'A lead and linked appointment should be created.'), tx('Valida trazabilidad del canal.', 'Validate channel traceability.'), tx('Confirma que salga la notificación configurada.', 'Confirm that the configured notification is sent.')] },
        { title: tx('4. Operativiza la agenda', '4. Operationalize the booking flow'), detail: tx('Comparte el enlace final y deja listo el ownership operativo.', 'Share the final link and leave operational ownership ready.'), bullets: [tx('Revisa readiness antes de salir a producción.', 'Review readiness before going to production.'), tx('Documenta la landing donde quedó publicada.', 'Document the landing page where it was published.'), tx('Haz una segunda prueba con el mismo contacto para revisar deduplicación.', 'Run a second test with the same contact to review deduplication.')] },
      ],
      [tx('La agenda carga correctamente.', 'The booking flow loads correctly.'), tx('La cita aparece en CRM con fecha y hora.', 'The appointment appears in the CRM with date and time.'), tx('Las notificaciones configuradas sí se envían.', 'Configured notifications are sent.')],
      [tx('Si no ves el calendario, revisa el embed o el dominio.', 'If you do not see the calendar, check the embed or the domain.'), tx('Si la confirmación no sale, revisa las credenciales del canal.', 'If confirmation is not sent, review the channel credentials.'), tx('Si se duplican citas, revisa el payload y los datos de contacto.', 'If appointments are duplicated, review the payload and contact data.')],
      [{ label: 'Endpoint', value: args.endpoint }, { label: tx('URL pública', 'Public URL'), value: snippets?.webFormEmbedUrl || tx('Disponible al seleccionar el canal.', 'Available when selecting the channel.') }, { label: tx('Iframe agenda', 'Booking iframe'), value: snippets?.webFormIframe || tx('Disponible en la pestaña Formulario.', 'Available in the Form tab.') }],
      [{ label: tx('Agenda CRM', 'CRM booking'), caption: tx('Canal y reglas listos', 'Channel and rules ready') }, { label: 'Landing', caption: tx('Usuario agenda fecha y hora', 'User books date and time') }, { label: 'CRM', caption: tx('Se crea lead y cita', 'Lead and appointment are created') }, { label: tx('Confirmación', 'Confirmation'), caption: tx('Correo o WhatsApp al usuario', 'Email or WhatsApp to the user') }],
    )
  }

  if (key === 'web-chatbot') {
    return buildBridgeGuide(
      tx('Integración detallada de Chatbot Web', 'Detailed Web Chatbot integration'),
      tx('Inserta el chatbot del CRM por iframe o widget flotante y convierte conversaciones en leads e inbox operativo.', 'Insert the CRM chatbot through an iframe or floating widget and convert conversations into leads and operational inbox threads.'),
      'emerald',
      tx('Webmaster, marketing y equipo de ventas.', 'Webmaster, marketing, and sales team.'),
      [tx('Configurar título, prompt, asistente y launcher.', 'Configure title, prompt, assistant, and launcher.'), tx('Definir dominios permitidos.', 'Define allowed domains.'), tx('Tener lista la URL o iframe que se publicará.', 'Have the URL or iframe that will be published ready.')],
      [
        { title: tx('1. Ajusta el constructor del bot', '1. Adjust the bot builder'), detail: tx('Configura marca, flujo, quick actions, handoff y launcher.', 'Configure brand, flow, quick actions, handoff, and launcher.'), bullets: [tx('Valida el canvas si usarás ramas guiadas.', 'Validate the canvas if you will use guided branches.'), tx('Ajusta colores y copy visibles.', 'Adjust visible colors and copy.'), tx('Decide si el widget flotante quedará activo.', 'Decide whether the floating widget will remain active.')] },
        { title: tx('2. Publica por iframe o widget', '2. Publish through iframe or widget'), detail: tx('Elige si el cliente usará un bloque fijo o un launcher flotante.', 'Choose whether the client will use a fixed block or a floating launcher.'), bullets: [`${tx('URL pública', 'Public URL')}: ${snippets?.chatbotEmbedUrl || tx('Disponible al seleccionar el canal.', 'Available when selecting the channel.')}`, tx('Iframe para bloque fijo.', 'Iframe for a fixed block.'), tx('Widget flotante si prefieren activación discreta.', 'Floating widget if they prefer discreet activation.')] },
        { title: tx('3. Ejecuta pruebas de conversación', '3. Run conversation tests'), detail: tx('Abre la demo, conversa y revisa el inbox CRM.', 'Open the demo, chat, and review the CRM inbox.'), bullets: [tx('Prueba quick actions y escalamiento.', 'Test quick actions and escalation.'), tx('Valida captura de lead si el flujo pide datos.', 'Validate lead capture if the flow requests data.'), tx('Revisa el inbox en paralelo.', 'Review the inbox in parallel.')] },
        { title: tx('4. Activa monitoreo y go-live', '4. Activate monitoring and go live'), detail: tx('Documenta dominios, owner y canal de seguimiento.', 'Document domains, owner, and follow-up channel.'), bullets: [tx('Prueba mobile y desktop.', 'Test mobile and desktop.'), tx('Revisa que el launcher no tape elementos críticos.', 'Make sure the launcher does not cover critical elements.'), tx('Pasa a ACTIVE tras una prueba funcional real.', 'Move to ACTIVE after a real functional test.')] },
      ],
      [tx('El iframe abre con el layout esperado.', 'The iframe opens with the expected layout.'), tx('Las conversaciones llegan al inbox.', 'Conversations reach the inbox.'), tx('El widget no rompe la experiencia del sitio.', 'The widget does not break the site experience.')],
      [tx('Si no aparece el widget, revisa floatingLauncherEnabled.', 'If the widget does not appear, check floatingLauncherEnabled.'), tx('Si no entra al inbox, recopia endpoint y token.', 'If it does not reach the inbox, recopy the endpoint and token.'), tx('Si responde mal, revisa el flujo y quick actions configuradas.', 'If it responds poorly, review the configured flow and quick actions.')],
      [{ label: tx('URL pública', 'Public URL'), value: snippets?.chatbotEmbedUrl || tx('Disponible al seleccionar el canal.', 'Available when selecting the channel.') }, { label: 'Iframe', value: snippets?.chatbotIframe || tx('Disponible en la pestaña Chatbot.', 'Available in the Chatbot tab.') }, { label: 'Widget', value: snippets?.chatbot || tx('Disponible en la pestaña Chatbot.', 'Available in the Chatbot tab.') }],
      [{ label: tx('Constructor', 'Builder'), caption: tx('Marca y flujo del bot', 'Bot brand and flow') }, { label: tx('Sitio web', 'Website'), caption: tx('Iframe o widget publicado', 'Published iframe or widget') }, { label: 'Inbox CRM', caption: tx('Conversación centralizada', 'Centralized conversation') }, { label: tx('Ventas', 'Sales'), caption: tx('Handoff y seguimiento', 'Handoff and follow-up') }],
    )
  }

  if (key === 'whatsapp-cloud' || key === 'facebook-page' || key === 'instagram-dm') {
    const isWhatsApp = key === 'whatsapp-cloud'
    const isFacebook = key === 'facebook-page'
    const platform = isWhatsApp ? 'WhatsApp Cloud' : isFacebook ? 'Facebook / Messenger' : 'Instagram DM'
    const accent = isWhatsApp ? 'emerald' : key === 'instagram-dm' ? 'fuchsia' : 'blue'
    const activeLabel = isWhatsApp ? tx('número activo', 'active number') : isFacebook ? tx('página activa', 'active page') : tx('cuenta activa', 'active account')
    return buildBridgeGuide(
      tx(`Integración detallada de ${platform}`, `Detailed ${platform} integration`),
      isWhatsApp
        ? tx('Conecta WhatsApp Cloud al CRM mediante OAuth de Meta, aplica el número correcto y valida el webhook nativo del canal.', 'Connect WhatsApp Cloud to the CRM through Meta OAuth, apply the correct number, and validate the channel native webhook.')
        : isFacebook
          ? tx('Conecta la página de Facebook al CRM mediante OAuth de Meta, deja activa la página correcta y valida el flujo de Messenger por webhook.', 'Connect the Facebook page to the CRM through Meta OAuth, keep the correct page active, and validate Messenger webhook flow.')
          : tx('Conecta Instagram DM al CRM mediante OAuth de Meta, deja activa la cuenta profesional correcta y valida el flujo de DMs por webhook.', 'Connect Instagram DM to the CRM through Meta OAuth, keep the correct professional account active, and validate the DM webhook flow.'),
      accent,
      tx('Administrador técnico y responsable del activo en Meta.', 'Technical administrator and owner of the asset in Meta.'),
      isWhatsApp
        ? [tx('Acceso al Business Manager y al número de WhatsApp correspondiente.', 'Access to Business Manager and the corresponding WhatsApp number.'), tx('Abrir la conexión oficial desde el canal.', 'Open the official connection from the channel.'), tx('Definir exactamente qué número quedará operativo en el CRM.', 'Define exactly which number will remain operational in the CRM.')]
        : isFacebook
          ? [tx('Acceso a la página de Facebook correcta dentro de Meta.', 'Access to the correct Facebook page inside Meta.'), tx('Abrir la conexión oficial desde este canal.', 'Open the official connection from this channel.'), tx('Definir exactamente qué página quedará operativa en el inbox.', 'Define exactly which page will remain operational in the inbox.')]
          : [tx('Acceso a la cuenta profesional de Instagram y a su página Meta asociada.', 'Access to the Instagram professional account and its linked Meta page.'), tx('Abrir la conexión oficial desde este canal.', 'Open the official connection from this channel.'), tx('Definir exactamente qué cuenta quedará operativa para DMs.', 'Define exactly which account will remain operational for DMs.')],
      [
        { title: tx('1. Inicia OAuth desde el canal', '1. Start OAuth from the channel'), detail: tx('Conecta Meta usando la cuenta que sí administra el activo correcto.', 'Connect Meta using the account that actually manages the correct asset.'), bullets: [tx('Hazlo desde este canal específico.', 'Do it from this specific channel.'), tx('Si el activo no aparece, revisa permisos del usuario en Meta.', 'If the asset does not appear, review the user permissions in Meta.'), tx('Evita mover la operación sin reconectar el canal.', 'Avoid moving the operation without reconnecting the channel.')] },
        { title: tx('2. Aplica el activo correcto', '2. Apply the correct asset'), detail: tx(`Selecciona y guarda el ${activeLabel} que operará en el CRM.`, `Select and save the ${activeLabel} that will operate in the CRM.`), bullets: isWhatsApp
          ? [tx('Valida que el número visible y el ID técnico sí correspondan.', 'Validate that the display number and the technical id do correspond.'), tx('No cierres el proceso hasta ver el número aplicado.', 'Do not close the process until you see the number applied.'), tx('Revisa el checklist de onboarding del panel.', 'Review the onboarding checklist in the panel.')]
          : isFacebook
            ? [tx('Valida que la página seleccionada sea la misma que responde a clientes.', 'Validate that the selected page is the same one that responds to customers.'), tx('No cierres el proceso hasta ver la página aplicada.', 'Do not close the process until you see the page applied.'), tx('Revisa el checklist de onboarding del panel.', 'Review the onboarding checklist in the panel.')]
            : [tx('Valida que la cuenta seleccionada sea la que recibirá los DMs reales.', 'Validate that the selected account is the one that will receive real DMs.'), tx('No cierres el proceso hasta ver la cuenta aplicada.', 'Do not close the process until you see the account applied.'), tx('Confirma también la página Meta vinculada detrás de Instagram.', 'Also confirm the Meta page linked behind Instagram.')] },
        { title: tx('3. Verifica el webhook', '3. Verify the webhook'), detail: tx('Meta debe apuntar al endpoint del canal y validar el token correctamente.', 'Meta must point to the channel endpoint and validate the token correctly.'), bullets: [`${tx('Webhook del canal', 'Channel webhook')}: ${args.endpoint}`, `${tx('Token de verificación', 'Verification token')}: ${tokenLabel}`, isWhatsApp ? tx('Luego ejecuta una prueba real con el número de WhatsApp.', 'Then run a real test using the WhatsApp number.') : isFacebook ? tx('Luego ejecuta una prueba real desde Messenger o la página.', 'Then run a real test from Messenger or the page.') : tx('Luego ejecuta una prueba real enviando un DM a Instagram.', 'Then run a real test by sending an Instagram DM.')] },
        { title: tx('4. Valida cómo responde el CRM', '4. Validate how the CRM responds'), detail: isWhatsApp ? tx('Confirma que el inbound, la respuesta del agente y los estados del mensaje se reflejen en el inbox.', 'Confirm that inbound, the agent reply, and message statuses are reflected in the inbox.') : isFacebook ? tx('Confirma que Messenger abra o actualice la conversación y que el CRM pueda responder desde la página activa.', 'Confirm that Messenger opens or updates the conversation and that the CRM can reply from the active page.') : tx('Confirma que el DM abra o actualice la conversación y que el CRM pueda responder desde la cuenta activa de Instagram.', 'Confirm that the DM opens or updates the conversation and that the CRM can reply from the active Instagram account.'), bullets: isWhatsApp
          ? [tx('Revisa último webhook y errores recientes.', 'Review the latest webhook and recent errors.'), tx('Confirma que el número aplicado es el mismo de la prueba.', 'Confirm that the applied number is the same one used in the test.'), tx('Pasa a ACTIVE solo cuando cierre la validación real.', 'Move to ACTIVE only when the real validation is closed.')]
          : isFacebook
            ? [tx('Valida inbound, reply desde CRM y eventos delivered/read.', 'Validate inbound, CRM reply, and delivered/read events.'), tx('Confirma que la página aplicada es la misma de la prueba.', 'Confirm that the applied page is the same one used in the test.'), tx('Pasa a ACTIVE solo cuando cierre la validación real.', 'Move to ACTIVE only when the real validation is closed.')]
            : [tx('Valida DM inbound, reply desde CRM y eventos delivered/read.', 'Validate inbound DMs, CRM reply, and delivered/read events.'), tx('Confirma que la cuenta aplicada es la misma de la prueba.', 'Confirm that the applied account is the same one used in the test.'), tx('Pasa a ACTIVE solo cuando cierre la validación real.', 'Move to ACTIVE only when the real validation is closed.')] },
      ],
      isWhatsApp
        ? [tx('El número quedó aplicado.', 'The number was applied.'), tx('Meta verifica el webhook.', 'Meta verifies the webhook.'), tx('La prueba entra al inbox correcto y los checks avanzan.', 'The test reaches the correct inbox and the checks advance.')]
        : isFacebook
          ? [tx('La página quedó aplicada.', 'The page was applied.'), tx('Meta verifica el webhook.', 'Meta verifies the webhook.'), tx('Messenger entra al inbox correcto y los checks avanzan.', 'Messenger reaches the correct inbox and the checks advance.')]
          : [tx('La cuenta quedó aplicada.', 'The account was applied.'), tx('Meta verifica el webhook.', 'Meta verifies the webhook.'), tx('El DM entra al inbox correcto y los checks avanzan.', 'The DM reaches the correct inbox and the checks advance.')],
      isWhatsApp
        ? [tx('Si el número no aparece, revisa permisos o reconecta Meta.', 'If the number does not appear, review permissions or reconnect Meta.'), tx('Si falla la verificación, recopia endpoint y token.', 'If verification fails, recopy endpoint and token.'), tx('Si el hilo cae en otro canal, revisa el número realmente aplicado.', 'If the thread lands in another channel, review the number actually applied.')]
        : isFacebook
          ? [tx('Si la página no aparece, revisa permisos o reconecta Meta.', 'If the page does not appear, review permissions or reconnect Meta.'), tx('Si falla la verificación, recopia endpoint y token.', 'If verification fails, recopy endpoint and token.'), tx('Si la conversación cae en otro canal, revisa la página realmente aplicada.', 'If the conversation lands in another channel, review the page actually applied.')]
          : [tx('Si la cuenta no aparece, revisa permisos o reconecta Meta.', 'If the account does not appear, review permissions or reconnect Meta.'), tx('Si falla la verificación, recopia endpoint y token.', 'If verification fails, recopy endpoint and token.'), tx('Si el DM cae en otro canal, revisa la cuenta realmente aplicada y su página vinculada.', 'If the DM lands in another channel, review the applied account and its linked page.')],
      isWhatsApp
        ? [{ label: 'Webhook', value: args.endpoint }, { label: tx('Token de verificación', 'Verification token'), value: tokenLabel }, { label: tx('Activo principal', 'Main asset'), value: tx('Número de WhatsApp', 'WhatsApp number') }]
        : isFacebook
          ? [{ label: 'Webhook', value: args.endpoint }, { label: tx('Token de verificación', 'Verification token'), value: tokenLabel }, { label: tx('Activo principal', 'Main asset'), value: tx('Página de Facebook', 'Facebook page') }]
          : [{ label: 'Webhook', value: args.endpoint }, { label: tx('Token de verificación', 'Verification token'), value: tokenLabel }, { label: tx('Activo principal', 'Main asset'), value: tx('Cuenta profesional de Instagram', 'Instagram professional account') }],
      isWhatsApp
        ? [{ label: 'OAuth Meta', caption: tx('Autorizas cuenta y activos', 'Authorize account and assets') }, { label: tx('Número', 'Number'), caption: tx(`Eliges ${activeLabel}`, `Choose the ${activeLabel}`) }, { label: 'Webhook', caption: tx('Meta verifica y envía eventos', 'Meta verifies and sends events') }, { label: 'Inbox CRM', caption: tx('Conversaciones listas para operar', 'Conversations ready to operate') }]
        : isFacebook
          ? [{ label: 'OAuth Meta', caption: tx('Autorizas cuenta y activos', 'Authorize account and assets') }, { label: tx('Página', 'Page'), caption: tx(`Eliges ${activeLabel}`, `Choose the ${activeLabel}`) }, { label: 'Webhook', caption: tx('Messenger entrega eventos', 'Messenger sends events') }, { label: 'Inbox CRM', caption: tx('Conversaciones listas para operar', 'Conversations ready to operate') }]
          : [{ label: 'OAuth Meta', caption: tx('Autorizas cuenta y activos', 'Authorize account and assets') }, { label: tx('Cuenta IG', 'IG account'), caption: tx(`Eliges ${activeLabel}`, `Choose the ${activeLabel}`) }, { label: 'Webhook', caption: tx('Instagram entrega DMs y estados', 'Instagram sends DMs and statuses') }, { label: 'Inbox CRM', caption: tx('Conversaciones listas para operar', 'Conversations ready to operate') }],
    )
  }

  if (key === 'gmail-bridge' || key === 'outlook-bridge') {
    const isGmail = key === 'gmail-bridge'
    return buildBridgeGuide(
      tx(`Integración detallada de ${isGmail ? 'Gmail Inbox Bridge' : 'Outlook Inbox Bridge'}`, `Detailed ${isGmail ? 'Gmail Inbox Bridge' : 'Outlook Inbox Bridge'} integration`),
      isGmail ? tx('Usa Apps Script para empujar correos de Gmail al inbox omnicanal.', 'Use Apps Script to push Gmail emails into the omnichannel inbox.') : tx('Configura Power Automate para enviar correos de Outlook al bridge CRM.', 'Configure Power Automate to send Outlook emails to the CRM bridge.'),
      isGmail ? 'amber' : 'blue',
      isGmail ? tx('Implementador Google Workspace u operaciones.', 'Google Workspace implementer or operations.') : tx('Administrador Microsoft 365 u operaciones.', 'Microsoft 365 administrator or operations.'),
      [isGmail ? tx('Acceso a script.google.com.', 'Access to script.google.com.') : tx('Acceso a Power Automate.', 'Access to Power Automate.'), tx('Canal bridge creado en el CRM.', 'Bridge channel created in the CRM.'), tx('Definir qué correos sí deben entrar al CRM.', 'Define which emails should enter the CRM.')],
      [
        { title: tx('1. Crea la automatización del correo', '1. Create the email automation'), detail: isGmail ? tx('Abre Apps Script, crea un proyecto y pega el script base del canal.', 'Open Apps Script, create a project, and paste the channel base script.') : tx('Crea un flujo en Power Automate con trigger de correo entrante y acción HTTP.', 'Create a Power Automate flow with an incoming email trigger and an HTTP action.'), bullets: [isGmail ? tx('Nombra el proyecto claramente.', 'Name the project clearly.') : tx('Filtra por carpeta, categoría o remitente.', 'Filter by folder, category, or sender.'), `${tx('Endpoint del bridge', 'Bridge endpoint')}: ${args.endpoint}`, isGmail ? tx('No edites token ni endpoint hasta validar.', 'Do not edit token or endpoint until validation.') : tx('Mantén el flujo acotado a prospectos reales.', 'Keep the flow limited to real prospects.')] },
        { title: tx('2. Ajusta filtro y payload', '2. Adjust filter and payload'), detail: tx('Define qué correos se enviarán y confirma la estructura del payload.', 'Define which emails will be sent and confirm the payload structure.'), bullets: [isGmail ? tx('Usa etiquetas o reglas de Gmail.', 'Use Gmail labels or rules.') : tx('Usa el body de referencia del canal.', 'Use the channel reference body.'), `${tx('Snippet de referencia', 'Reference snippet')}: ${isGmail ? snippets?.gmail || tx('Disponible en Bridges.', 'Available in Bridges.') : snippets?.outlook || tx('Disponible en Bridges.', 'Available in Bridges.')}`, `${tx('Token de referencia', 'Reference token')}: ${tokenLabel}`] },
        { title: tx('3. Ejecuta una prueba controlada', '3. Run a controlled test'), detail: tx('Dispara un correo real y revisa el resultado en el CRM.', 'Trigger a real email and review the result in the CRM.'), bullets: [tx('Confirma remitente, asunto y cuerpo en el inbox.', 'Confirm sender, subject, and body in the inbox.'), tx('Revisa que el endpoint responda correctamente.', 'Check that the endpoint responds correctly.'), tx('Ajusta el filtro si entra demasiado ruido.', 'Adjust the filter if too much noise enters.')] },
        { title: tx('4. Formaliza el ownership', '4. Formalize ownership'), detail: tx('Documenta quién mantiene el script o flujo y qué regla dispara la automatización.', 'Document who maintains the script or flow and which rule triggers the automation.'), bullets: [tx('Evita duplicar automatizaciones sobre la misma bandeja.', 'Avoid duplicating automations on the same inbox.'), tx('Monitorea errores los primeros días.', 'Monitor errors during the first few days.'), tx('Activa producción cuando la trazabilidad sea consistente.', 'Activate production when traceability is consistent.')] },
      ],
      [tx('La automatización corre sin error.', 'The automation runs without error.'), tx('El correo aparece en el inbox CRM.', 'The email appears in the CRM inbox.'), tx('El filtro solo procesa correos comerciales.', 'The filter processes only commercial emails.')],
      [tx('Si falla la automatización, revisa permisos y autenticación.', 'If the automation fails, review permissions and authentication.'), tx('Si el payload no entra, recopia endpoint y cuerpo base.', 'If the payload does not enter, recopy the endpoint and base body.'), tx('Si duplica hilos, revisa trigger, etiqueta o regla.', 'If it duplicates threads, review the trigger, label, or rule.')],
      [{ label: tx('Endpoint bridge', 'Bridge endpoint'), value: args.endpoint }, { label: isGmail ? 'Apps Script' : tx('Body Power Automate', 'Power Automate body'), value: isGmail ? snippets?.gmail || tx('Disponible en Bridges.', 'Available in Bridges.') : snippets?.outlook || tx('Disponible en Bridges.', 'Available in Bridges.') }],
      [{ label: isGmail ? 'Gmail' : 'Outlook', caption: tx('Correo llega a la bandeja', 'Email reaches the inbox') }, { label: isGmail ? 'Apps Script' : 'Power Automate', caption: tx('Filtra y arma el payload', 'Filter and build the payload') }, { label: 'Bridge CRM', caption: tx('Recibe y normaliza el correo', 'Receive and normalize the email') }, { label: 'Inbox', caption: tx('Seguimiento comercial centralizado', 'Centralized sales follow-up') }],
    )
  }

  if (key === 'google-sheets-bridge') {
    return buildBridgeGuide(
      tx('Integración detallada de Google Sheets Bridge', 'Detailed Google Sheets Bridge integration'),
      tx('Usa una hoja como entrada o salida comercial del CRM mediante preview, import y export CSV.', 'Use a spreadsheet as a commercial input or output for the CRM through preview, import, and CSV export.'),
      'emerald',
      tx('Backoffice comercial, analista o integrador ligero.', 'Sales back office, analyst, or lightweight integrator.'),
      [tx('Hoja publicada o Spreadsheet ID configurado.', 'Published sheet or configured Spreadsheet ID.'), tx('Columnas mínimas definidas.', 'Minimum columns defined.'), tx('Canal creado con sheetName o CSV URL.', 'Channel created with sheetName or CSV URL.')],
      [
        { title: tx('1. Configura el origen', '1. Configure the source'), detail: tx('Define CSV publicado o Spreadsheet ID + pestaña dentro del canal.', 'Define a published CSV or Spreadsheet ID plus the tab inside the channel.'), bullets: [tx('Usa una estructura estable de columnas.', 'Use a stable column structure.'), tx('La hoja debe ser accesible para el proceso.', 'The sheet must be accessible for the process.'), tx('Confirma el origen antes de importar masivamente.', 'Confirm the source before importing in bulk.')] },
        { title: tx('2. Lanza un preview', '2. Run a preview'), detail: tx('Usa el preview para revisar headers y filas detectadas.', 'Use the preview to review detected headers and rows.'), bullets: [`Preview: ${snippets?.googleSheetsPreview || tx('Disponible en Bridges.', 'Available in Bridges.')}`, tx('Corrige columnas antes de importar.', 'Correct columns before importing.'), tx('Valida que la hoja correcta sí sea la que responde.', 'Validate that the correct sheet is the one responding.')] },
        { title: tx('3. Ejecuta la importación', '3. Run the import'), detail: tx('Cuando el preview esté correcto, dispara el import desde el canal.', 'When the preview is correct, trigger the import from the channel.'), bullets: [`Import: ${snippets?.googleSheetsImport || tx('Disponible en Bridges.', 'Available in Bridges.')}`, tx('Revisa procesadas, importadas y omitidas.', 'Review processed, imported, and skipped rows.'), tx('Si aplica, valida oportunidades creadas.', 'If applicable, validate created opportunities.')] },
        { title: tx('4. Usa el export operativamente', '4. Use export operationally'), detail: tx('Comparte el CSV de salida cuando el equipo necesite consumo fuera del CRM.', 'Share the output CSV when the team needs consumption outside the CRM.'), bullets: [`Export: ${snippets?.googleSheetsExport || tx('Disponible en Bridges.', 'Available in Bridges.')}`, tx('Útil para checklist o consolidado manual.', 'Useful for checklist or manual consolidation.'), tx('No reemplaza al CRM como fuente principal.', 'It does not replace the CRM as the main source.') ] },
      ],
      [tx('Preview detecta headers correctos.', 'Preview detects correct headers.'), tx('Importa las filas esperadas.', 'It imports the expected rows.'), tx('Export genera un CSV consumible.', 'Export generates a usable CSV.')],
      [tx('Si no lee la hoja, revisa publicación CSV o Spreadsheet ID.', 'If it does not read the sheet, review CSV publication or Spreadsheet ID.'), tx('Si omite filas, revisa columnas obligatorias.', 'If it skips rows, review required columns.'), tx('Si el export falla, revisa el estado y configuración del canal.', 'If export fails, review the channel status and configuration.')],
      [{ label: 'Preview', value: snippets?.googleSheetsPreview || tx('Disponible en Bridges.', 'Available in Bridges.') }, { label: 'Import', value: snippets?.googleSheetsImport || tx('Disponible en Bridges.', 'Available in Bridges.') }, { label: 'Export', value: snippets?.googleSheetsExport || tx('Disponible en Bridges.', 'Available in Bridges.') }],
      [{ label: tx('Hoja', 'Sheet'), caption: tx('Origen comercial o ferial', 'Commercial or event source') }, { label: 'Preview', caption: tx('Valida headers y filas', 'Validate headers and rows') }, { label: 'Import CRM', caption: tx('Crea leads u oportunidades', 'Create leads or opportunities') }, { label: 'Export', caption: tx('Devuelve salida operativa', 'Return operational output') }],
    )
  }

  if (key === 'google-calendar-bridge' || key === 'microsoft-365-calendar-bridge') {
    const calendarName = key === 'google-calendar-bridge' ? 'Google Calendar' : 'Microsoft 365 Calendar'
    return buildBridgeGuide(
      tx(`Integración detallada de ${calendarName} Bridge`, `Detailed ${calendarName} Bridge integration`),
      tx(`Sincroniza tareas o citas del CRM hacia ${calendarName} usando un receptor de webhook saliente.`, `Synchronize CRM tasks or appointments to ${calendarName} using an outgoing webhook receiver.`),
      'blue',
      tx('Integrador de automatización o backend ligero.', 'Automation integrator or lightweight backend owner.'),
      [tx('Canal bridge creado.', 'Bridge channel created.'), tx('Webhook receptor o flujo externo listo.', 'Receiver webhook or external flow ready.'), tx(`Cuenta o calendario de ${calendarName} identificado.`, `${calendarName} account or calendar identified.`)],
      [
        { title: tx('1. Define el receptor externo', '1. Define the external receiver'), detail: tx('Este canal emite un payload saliente; el receptor debe consumirlo y crear el evento real.', 'This channel emits an outgoing payload; the receiver must consume it and create the real event.'), bullets: [tx('Puedes usar Make, n8n, Power Automate o una función propia.', 'You can use Make, n8n, Power Automate, or a custom function.'), tx('Guarda la URL en outgoingWebhookUrl.', 'Save the URL in outgoingWebhookUrl.'), tx(`Ese receptor será quien autentique contra ${calendarName}.`, `That receiver will be responsible for authenticating against ${calendarName}.`)] },
        { title: tx('2. Mapea el payload a evento', '2. Map the payload to the event'), detail: tx('Convierte la tarea CRM a la estructura del calendario final.', 'Convert the CRM task to the final calendar structure.'), bullets: [tx('Conserva el id CRM como referencia.', 'Keep the CRM id as a reference.'), tx('Define duración, timezone y calendario destino.', 'Define duration, timezone, and target calendar.'), tx('Prueba primero con una cita interna.', 'Test first with an internal appointment.')] },
        { title: tx('3. Dispara una tarea de prueba', '3. Trigger a test task'), detail: tx('Crea o agenda una tarea desde el CRM y revisa el resultado en el calendario.', 'Create or schedule a task from the CRM and review the result in the calendar.'), bullets: [tx('Revisa logs del flujo externo.', 'Review logs from the external flow.'), tx(`Confirma que ${calendarName} reciba título y horario correctos.`, `Confirm that ${calendarName} receives the correct title and time.`), tx('Si la tarea cambia, vuelve a probar la sincronización.', 'If the task changes, test synchronization again.')] },
        { title: tx('4. Documenta ownership', '4. Document ownership'), detail: tx('Deja claro quién mantiene el receptor externo y cómo se recupera si falla.', 'Make it clear who maintains the external receiver and how recovery happens if it fails.'), bullets: [tx('No dejes el bridge sin owner técnico.', 'Do not leave the bridge without a technical owner.'), tx('Monitorea expiración de credenciales.', 'Monitor credential expiration.'), tx('Define fallback operativo para reprogramaciones o fallos.', 'Define an operational fallback for rescheduling or failures.')] },
      ],
      [tx('El webhook saliente se dispara.', 'The outgoing webhook is triggered.'), tx(`El receptor crea el evento en ${calendarName}.`, `The receiver creates the event in ${calendarName}.`), tx('La fecha y hora final coinciden con CRM.', 'The final date and time match the CRM.')],
      [tx('Si no sale el webhook, revisa outgoingWebhookUrl.', 'If the webhook does not go out, review outgoingWebhookUrl.'), tx(`Si ${calendarName} no crea el evento, revisa la automatización externa.`, `If ${calendarName} does not create the event, review the external automation.`), tx('Si la hora se mueve, revisa timezone en ambos lados.', 'If the time shifts, review timezone on both sides.')],
      [{ label: tx('Punto clave', 'Key point'), value: tx('Configura outgoingWebhookUrl y mantenlo con un receptor externo activo.', 'Configure outgoingWebhookUrl and keep it connected to an active external receiver.') }],
      [{ label: 'CRM', caption: tx('Se crea tarea o cita', 'Task or appointment is created') }, { label: 'Webhook', caption: tx('Sale el payload del canal', 'The channel payload is sent') }, { label: tx('Automatización', 'Automation'), caption: tx('Transforma y autentica', 'Transforms and authenticates') }, { label: calendarName, caption: tx('Evento publicado', 'Published event') }],
    )
  }

  if (key === 'slack-bridge' || key === 'teams-bridge') {
    const platform = key === 'slack-bridge' ? 'Slack' : 'Microsoft Teams'
    return buildBridgeGuide(
      tx(`Integración detallada de ${platform} Alerts Bridge`, `Detailed ${platform} Alerts Bridge integration`),
      tx(`Envía alertas internas del CRM a ${platform} mediante un webhook saliente configurado en el canal.`, `Send internal CRM alerts to ${platform} through an outgoing webhook configured on the channel.`),
      'slate',
      tx('Operaciones internas, RevOps o administrador corporativo.', 'Internal operations, RevOps, or corporate administrator.'),
      [tx(`Webhook o flujo de ${platform} disponible.`, `${platform} webhook or flow available.`), tx('Canal bridge creado en el CRM.', 'Bridge channel created in the CRM.'), tx('Definir qué canal interno recibirá las alertas.', 'Define which internal channel will receive the alerts.')],
      [
        { title: tx('1. Prepara el destino interno', '1. Prepare the internal destination'), detail: tx(`Crea el webhook o flujo que recibirá las alertas en ${platform}.`, `Create the webhook or flow that will receive alerts in ${platform}.`), bullets: [tx('Usa un canal útil para coordinación comercial.', 'Use a channel that is useful for sales coordination.'), tx('Evita destinos demasiado ruidosos.', 'Avoid overly noisy destinations.'), tx('Conserva la URL como secreto operativo.', 'Keep the URL as an operational secret.')] },
        { title: tx('2. Configura outgoingWebhookUrl', '2. Configure outgoingWebhookUrl'), detail: tx('Guarda la URL destino dentro del canal CRM.', 'Save the destination URL inside the CRM channel.'), bullets: [tx('Mantén el canal en TESTING al inicio.', 'Keep the channel in TESTING at the beginning.'), tx('No reutilices una URL sin saber a qué equipo publica.', 'Do not reuse a URL without knowing which team it posts to.'), tx('Documenta la dependencia externa.', 'Document the external dependency.')] },
        { title: tx('3. Ejecuta una alerta de prueba', '3. Run a test alert'), detail: tx('Provoca el evento comercial y revisa el mensaje publicado.', 'Trigger the commercial event and review the published message.'), bullets: [tx('Puede ser una asignación, captura o alerta interna.', 'It can be an assignment, capture, or internal alert.'), tx('Valida claridad, formato y destinatario.', 'Validate clarity, format, and recipient.'), tx('Ajusta el flujo si el mensaje no se entiende.', 'Adjust the flow if the message is not clear.')] },
        { title: tx('4. Formaliza la operación', '4. Formalize the operation'), detail: tx('Deja claro qué eventos llegan, quién mantiene el bridge y cuál es el fallback.', 'Make clear which events arrive, who maintains the bridge, and what the fallback is.'), bullets: [tx('Pasa a ACTIVE cuando cierre la prueba.', 'Move to ACTIVE when the test closes.'), tx('Define prioridad de alertas para no saturar al equipo.', 'Define alert priority so the team is not overwhelmed.'), tx('Monitorea errores al inicio de operación.', 'Monitor errors at the start of operation.')] },
      ],
      [tx(`${platform} recibe el mensaje esperado.`, `${platform} receives the expected message.`), tx('El receptor responde correctamente.', 'The receiver responds correctly.'), tx('El equipo confirma que el canal interno es el correcto.', 'The team confirms that the internal channel is the correct one.')],
      [tx('Si no llega nada, revisa outgoingWebhookUrl.', 'If nothing arrives, review outgoingWebhookUrl.'), tx('Si el formato es malo, adapta el flujo externo.', 'If the format is poor, adapt the external flow.'), tx('Si no sabes qué equipo lo recibe, documenta el destino antes de activar.', 'If you do not know which team receives it, document the destination before activating.')],
      [{ label: tx('Dato clave', 'Key data'), value: tx(`Configura outgoingWebhookUrl con el receptor de ${platform}.`, `Configure outgoingWebhookUrl with the ${platform} receiver.`) }],
      [{ label: tx('Evento CRM', 'CRM event'), caption: tx('Cambio operativo o alerta', 'Operational change or alert') }, { label: 'Bridge', caption: tx('Tiene outgoingWebhookUrl', 'Has outgoingWebhookUrl') }, { label: platform, caption: tx('Recibe el POST o flujo', 'Receives the POST or flow') }, { label: tx('Equipo', 'Team'), caption: tx('Ve la notificación', 'Sees the notification') }],
    )
  }

  if (key === 'meta-lead-ads-bridge' || key === 'external-form-bridge' || key === 'tiktok-bridge' || key === 'youtube-bridge') {
    const origin = key === 'meta-lead-ads-bridge' ? 'Meta Lead Ads' : key === 'external-form-bridge' ? 'Formulario Externo' : key === 'tiktok-bridge' ? 'TikTok' : 'YouTube'
    return buildBridgeGuide(
      tx(`Integración detallada de ${origin} Bridge`, `Detailed ${origin} Bridge integration`),
      tx(`Conecta ${origin} al CRM mediante bridge HTTP o automatización intermedia sin abrir otro módulo comercial paralelo.`, `Connect ${origin} to the CRM through an HTTP bridge or intermediate automation without opening another parallel sales module.`),
      key === 'meta-lead-ads-bridge' ? 'blue' : 'sky',
      tx('Marketing, automatización o desarrollo web.', 'Marketing, automation, or web development.'),
      [tx('Definir origen exacto del lead o formulario.', 'Define the exact origin of the lead or form.'), tx('Tener middleware, flujo o frontend capaz de hacer POST HTTP.', 'Have middleware, flow, or frontend capable of making an HTTP POST.'), tx('Canal bridge creado en el CRM.', 'Bridge channel created in the CRM.')],
      [
        { title: tx('1. Define la fuente de captura', '1. Define the capture source'), detail: tx('Aclara si el payload saldrá desde frontend, backend, middleware o una automatización externa.', 'Clarify whether the payload will come from frontend, backend, middleware, or external automation.'), bullets: [tx('Evita tener dos rutas activas para el mismo origen.', 'Avoid having two active routes for the same origin.'), tx('Mantén un owner claro del bridge.', 'Keep a clear owner for the bridge.'), `${tx('Endpoint operativo', 'Operational endpoint')}: ${args.endpoint}`] },
        { title: tx('2. Mapea el payload al CRM', '2. Map the payload to the CRM'), detail: tx('Envía nombre, email, teléfono y contexto comercial del origen.', 'Send name, email, phone, and the commercial context from the source.'), bullets: [tx('Incluye campaña, formulario o asset si está disponible.', 'Include campaign, form, or asset if available.'), key === 'meta-lead-ads-bridge' ? tx('Si tienes leadgen_id, no lo pierdas en el flujo.', 'If you have leadgen_id, do not lose it in the flow.') : tx('Usa metadata para campos propios del origen.', 'Use metadata for source-specific fields.'), tx('Mantén consistencia en los nombres de campo.', 'Keep field names consistent.')] },
        { title: tx('3. Ejecuta una prueba real o simulada', '3. Run a real or simulated test'), detail: tx('Lanza un POST controlado y revisa la captura dentro del CRM.', 'Launch a controlled POST and review the capture inside the CRM.'), bullets: [tx('Valida lead, actividad y fuente.', 'Validate lead, activity, and source.'), tx('Revisa deduplicación sobre contactos existentes.', 'Review deduplication against existing contacts.'), tx('Confirma owner y tarea inicial si aplica.', 'Confirm owner and initial task if applicable.')] },
        { title: tx('4. Documenta y opera', '4. Document and operate'), detail: tx('Deja documentado el contrato del payload y el owner técnico del origen.', 'Document the payload contract and the technical owner of the source.'), bullets: [tx('Guarda un payload ejemplo que funcione.', 'Save a sample payload that works.'), tx('Monitorea errores del canal al salir a producción.', 'Monitor channel errors when going to production.'), tx('Separa canales si dos fuentes distintas requieren trazabilidad propia.', 'Separate channels if two different sources require their own traceability.')] },
      ],
      [tx('El lead entra con contexto del origen.', 'The lead enters with the source context.'), tx('La deduplicación funciona.', 'Deduplication works.'), tx('El equipo puede identificar de dónde vino la captura.', 'The team can identify where the capture came from.')],
      [tx('Si no entra, revisa la automatización o middleware.', 'If it does not enter, review the automation or middleware.'), tx('Si falta contexto, amplía metadata.', 'If context is missing, expand the metadata.'), tx('Si duplica, evita múltiples rutas activas sobre el mismo origen.', 'If it duplicates, avoid multiple active routes on the same source.')],
      [{ label: tx('Endpoint bridge', 'Bridge endpoint'), value: args.endpoint }, { label: tx('Referencia payload', 'Payload reference'), value: snippets?.webForm || tx('Usa el contrato base del canal.', 'Use the channel base contract.') }],
      [{ label: origin, caption: tx('Fuente original de la captura', 'Original capture source') }, { label: 'Middleware', caption: tx('Transforma o envía el payload', 'Transforms or sends the payload') }, { label: 'Bridge CRM', caption: tx('Ingesta y deduplicación', 'Ingestion and deduplication') }, { label: 'Pipeline', caption: tx('Seguimiento comercial', 'Commercial follow-up') }],
    )
  }

  return buildBridgeGuide(
    args.language === 'en' ? 'Detailed channel integration' : 'Integración detallada del canal',
    args.language === 'en' ? 'Select a channel to see the detailed implementation walkthrough.' : 'Selecciona un canal para ver el paso a paso detallado de implementación.',
    'sky',
    args.language === 'en' ? 'Channel implementer.' : 'Implementador del canal.',
    [args.language === 'en' ? 'Channel selected.' : 'Canal seleccionado.'],
    [{ title: args.language === 'en' ? '1. Select the channel' : '1. Selecciona el canal', detail: args.language === 'en' ? 'The panel will show the appropriate guide depending on the integration type.' : 'El panel mostrará la guía apropiada según el tipo de integración.', bullets: [args.language === 'en' ? 'Content changes by channel, provider, and bridgeKind.' : 'El contenido cambia por canal, provider y bridgeKind.'] }],
    [args.language === 'en' ? 'Channel identified.' : 'Canal identificado.'],
    [args.language === 'en' ? 'Select a channel on the left.' : 'Selecciona un canal a la izquierda.'],
    [],
    [{ label: args.language === 'en' ? 'Channel' : 'Canal', caption: args.language === 'en' ? 'Select an integration' : 'Selecciona una integración' }, { label: args.language === 'en' ? 'Guide' : 'Guía', caption: args.language === 'en' ? 'Steps and assets are loaded' : 'Se cargan pasos y assets' }, { label: args.language === 'en' ? 'Validation' : 'Validación', caption: args.language === 'en' ? 'QA is executed' : 'Se ejecuta QA' }, { label: args.language === 'en' ? 'Production' : 'Producción', caption: args.language === 'en' ? 'Channel ready to operate' : 'Canal listo para operar' }],
  )
}

const MANAGED_CHANNEL_SETTING_KEYS = new Set([
  'testingToken',
  'bridgeKind',
  'googleSheetsSpreadsheetId',
  'googleSheetsSheetName',
  'googleSheetsPublishedCsvUrl',
  'googleSheetsRowLimit',
  'googleSheetsImportMode',
  'googleSheetsOpportunityStage',
  'bookingNotifyByEmail',
  'bookingNotifyByWhatsApp',
  'outgoingWebhookUrl',
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
  'launcherPlacement',
  'launcherSize',
  'launcherOffsetX',
  'launcherOffsetY',
  'launcherZIndex',
  'panelZIndex',
  'backdropZIndex',
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

function isOutgoingWebhookBridge(bridgeKind: string) {
  return bridgeKind === 'SLACK' || bridgeKind === 'TEAMS' || bridgeKind === 'GOOGLE_CALENDAR' || bridgeKind === 'MICROSOFT_365_CALENDAR'
}

function formatDate(value: string | null | undefined, language: 'es' | 'en' = 'es') {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function formatCompactNumber(value: number, language: 'es' | 'en' = 'es') {
  return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'es-CO', {
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

function getTemplatePresetLogo(preset: TemplatePreset): ComponentType<{ className?: string }> {
  if (preset.bridgeKind === 'GMAIL') return GmailLogo
  if (preset.bridgeKind === 'OUTLOOK') return OutlookLogo
  if (preset.bridgeKind === 'GOOGLE_SHEETS') return GoogleSheetsLogo
  if (preset.bridgeKind === 'GOOGLE_CALENDAR') return GoogleCalendarLogo
  if (preset.bridgeKind === 'MICROSOFT_365_CALENDAR') return MicrosoftLogo
  if (preset.bridgeKind === 'SLACK') return SlackLogo
  if (preset.bridgeKind === 'TEAMS') return TeamsLogo
  if (preset.bridgeKind === 'META_LEAD_ADS') return MetaLogo
  if (preset.bridgeKind === 'TIKTOK') return TikTokLogo
  if (preset.bridgeKind === 'YOUTUBE') return YouTubeLogo
  if (preset.provider === 'WHATSAPP_CLOUD' || preset.provider === 'WHATSAPP_SANDBOX') return WhatsAppLogo
  if (preset.provider === 'INSTAGRAM_DM') return Instagram
  if (preset.provider === 'FACEBOOK_PAGE' || preset.provider === 'MESSENGER') return Facebook
  if (preset.provider === 'WEB_CHATBOT') return Bot
  if (preset.bridgeKind === 'BOOKING') return Target
  return Globe
}

function getTemplatePresetSurface(preset: TemplatePreset) {
  if (preset.bridgeKind === 'BOOKING') {
    return {
      card: 'border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,0.92),rgba(255,255,255,0.98))]',
      selected: 'border-sky-300 bg-sky-50/90 ring-2 ring-sky-200',
      iconWrap: 'border-sky-200 bg-sky-100 text-sky-700',
      pill: 'bg-sky-100 text-sky-700',
      accent: 'text-sky-800',
    }
  }

  if (preset.bridgeKind === 'SLACK' || preset.bridgeKind === 'TEAMS') {
    return {
      card: 'border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))]',
      selected: 'border-slate-300 bg-slate-50/90 ring-2 ring-slate-200',
      iconWrap: 'border-slate-200 bg-slate-100 text-slate-700',
      pill: 'bg-slate-100 text-slate-700',
      accent: 'text-slate-800',
    }
  }

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

function getBookingNotifyByEmail(settingsJson: Record<string, unknown> | null | undefined) {
  return getBooleanSetting(settingsJson, 'bookingNotifyByEmail', true)
}

function getBookingNotifyByWhatsApp(settingsJson: Record<string, unknown> | null | undefined) {
  return getBooleanSetting(settingsJson, 'bookingNotifyByWhatsApp', true)
}

function getOutgoingWebhookUrl(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.outgoingWebhookUrl === 'string' ? settingsJson.outgoingWebhookUrl : ''
}

function getWhatsAppAccessToken(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.whatsappAccessToken === 'string' ? settingsJson.whatsappAccessToken : ''
}

function getWhatsAppDisplayPhoneNumber(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.whatsappDisplayPhoneNumber === 'string' ? settingsJson.whatsappDisplayPhoneNumber : ''
}

function getWhatsAppConnectionMode(settingsJson: Record<string, unknown> | null | undefined): WhatsAppConnectionMode {
  return settingsJson?.whatsappConnectionMode === 'HYBRID_CRM_PHONE' ? 'HYBRID_CRM_PHONE' : 'CRM_ONLY'
}

function getWhatsAppConnectionModeLabel(mode: WhatsAppConnectionMode, language: 'es' | 'en') {
  if (mode === 'HYBRID_CRM_PHONE') {
    return language === 'en' ? 'Hybrid CRM + phone' : 'Híbrido CRM + celular'
  }

  return language === 'en' ? 'CRM only' : 'Solo CRM'
}

function getWhatsAppConnectionModeSummary(mode: WhatsAppConnectionMode, language: 'es' | 'en') {
  if (mode === 'HYBRID_CRM_PHONE') {
    return {
      title: language === 'en' ? 'Hybrid CRM + phone' : 'Híbrido CRM + celular',
      summary: language === 'en'
        ? 'The same number can still have activity from the phone app while the CRM keeps visibility, controls, and anti-collision rules.'
        : 'El mismo número puede seguir teniendo actividad desde la app del celular mientras el CRM conserva visibilidad, controles y reglas anti-colisión.',
      bullets: language === 'en'
        ? [
            'Use it when the client still needs WhatsApp Business App.',
            'Requires official coexistence or compatible Meta behavior.',
            'There is a higher operational risk of duplicate replies if the team does not follow the alerts.',
          ]
        : [
            'Úsalo cuando el cliente todavía necesita atender también desde WhatsApp Business App.',
            'Requiere coexistencia oficial o comportamiento compatible de Meta.',
            'Tiene más riesgo operativo de doble respuesta si el equipo no sigue las alertas.',
          ],
    }
  }

  return {
    title: language === 'en' ? 'CRM only' : 'Solo CRM',
    summary: language === 'en'
      ? 'The number is operated mainly from the CRM inbox, with stronger control, cleaner audit, and lower operational ambiguity.'
      : 'El número se opera principalmente desde el inbox del CRM, con más control, auditoría más limpia y menor ambigüedad operativa.',
    bullets: language === 'en'
      ? [
          'Use it when the sales team will answer from the CRM.',
          'It is the recommended mode for multi-agent operation and automation.',
          'It reduces collisions because the phone is not the main operating surface.',
        ]
      : [
          'Úsalo cuando el equipo comercial va a responder desde el CRM.',
          'Es el modo recomendado para operación multiagente y automatización.',
          'Reduce colisiones porque el celular no es la superficie operativa principal.',
        ],
  }
}

function getWhatsAppApproxPricingRows(language: 'es' | 'en') {
  return language === 'en'
    ? [
        { range: '0 - 1,000 utility templates / month', approximate: 'USD 0.01 - 0.03 each', note: 'Utility or transactional templates. Country and Meta billing table may vary.' },
        { range: '1,001 - 10,000 utility templates / month', approximate: 'USD 0.008 - 0.025 each', note: 'Volume may lower the effective average in some markets.' },
        { range: 'Authentication templates', approximate: 'USD 0.01 - 0.04 each', note: 'Usually priced differently from utility or marketing.' },
        { range: 'Marketing templates', approximate: 'USD 0.03 - 0.12 each', note: 'Usually the most expensive category.' },
        { range: 'Service responses inside allowed window', approximate: 'Low or zero incremental template cost', note: 'Depends on Meta rules, active window, and country.' },
      ]
    : [
        { range: '0 - 1.000 plantillas utilitarias / mes', approximate: 'USD 0,01 - 0,03 c/u', note: 'Plantillas utilitarias o transaccionales. Puede variar por país y tabla vigente de Meta.' },
        { range: '1.001 - 10.000 plantillas utilitarias / mes', approximate: 'USD 0,008 - 0,025 c/u', note: 'El promedio puede bajar por volumen en algunos mercados.' },
        { range: 'Plantillas de autenticación', approximate: 'USD 0,01 - 0,04 c/u', note: 'Suelen tener precio distinto a utilitarias o marketing.' },
        { range: 'Plantillas de marketing', approximate: 'USD 0,03 - 0,12 c/u', note: 'Normalmente es la categoría más costosa.' },
        { range: 'Respuestas de servicio dentro de ventana permitida', approximate: 'Costo incremental bajo o cero por plantilla', note: 'Depende de reglas vigentes de Meta, ventana activa y país.' },
      ]
}

function getMetaSocialOperationalSummary(provider: ChannelConnection['provider'], language: 'es' | 'en') {
  if (provider === 'FACEBOOK_PAGE' || provider === 'MESSENGER') {
    return {
      title: language === 'en' ? 'Facebook / Messenger operating model' : 'Modelo operativo de Facebook / Messenger',
      summary: language === 'en'
        ? 'This channel does not use a hybrid phone-number model. What matters is linking the correct Meta page and validating the webhook for Messenger events.'
        : 'Este canal no usa un modelo híbrido de número. Lo importante es enlazar la página correcta de Meta y validar el webhook para eventos de Messenger.',
      connectTitle: language === 'en' ? 'What to connect' : 'Qué conectar',
      connectBullets: language === 'en'
        ? [
            'Connect the Meta account that actually manages the Facebook page.',
            'Apply the active page inside this specific CRM channel.',
            'Keep the page token and CRM sync current after OAuth.',
          ]
        : [
            'Conecta la cuenta Meta que realmente administra la página de Facebook.',
            'Aplica la página activa dentro de este canal específico del CRM.',
            'Mantén vigente el token de página y la sincronización del CRM después del OAuth.',
          ],
      verifyTitle: language === 'en' ? 'What to verify' : 'Qué verificar',
      verifyBullets: language === 'en'
        ? [
            'The selected page is the same one the team uses publicly.',
            'Meta verifies the webhook and the channel has a valid verification token.',
            'A real inbound test creates the conversation in the correct inbox.',
          ]
        : [
            'Que la página seleccionada sea la misma que usa el equipo públicamente.',
            'Que Meta verifique el webhook y el canal tenga token de verificación válido.',
            'Que una prueba inbound real cree la conversación en la bandeja correcta.',
          ],
      respondTitle: language === 'en' ? 'How it responds' : 'Cómo responde',
      respondBullets: language === 'en'
        ? [
            'Inbound messages arrive through the Meta webhook and open or update the CRM thread.',
            'Replies sent from the CRM go out through Meta Messaging Send API to the linked page.',
            'Delivery and read events feed the same visual status checks used in the inbox.',
          ]
        : [
            'Los mensajes inbound llegan por el webhook de Meta y abren o actualizan el hilo en el CRM.',
            'Las respuestas enviadas desde el CRM salen por Meta Messaging Send API usando la página vinculada.',
            'Los eventos de entrega y lectura alimentan los mismos checks visuales del inbox.',
          ],
    }
  }

  if (provider === 'INSTAGRAM_DM') {
    return {
      title: language === 'en' ? 'Instagram DM operating model' : 'Modelo operativo de Instagram DM',
      summary: language === 'en'
        ? 'Instagram does not reuse the WhatsApp hybrid-number model either. The key is linking the correct Instagram professional account and its backing Meta page.'
        : 'Instagram tampoco reutiliza el modelo híbrido de número de WhatsApp. La clave es enlazar la cuenta profesional correcta de Instagram y su página Meta de respaldo.',
      connectTitle: language === 'en' ? 'What to connect' : 'Qué conectar',
      connectBullets: language === 'en'
        ? [
            'Connect the Meta account that manages the Instagram professional account.',
            'Apply the active Instagram account in this CRM channel.',
            'Confirm the linked Facebook page behind that Instagram account stays available.',
          ]
        : [
            'Conecta la cuenta Meta que administra la cuenta profesional de Instagram.',
            'Aplica la cuenta activa de Instagram en este canal del CRM.',
            'Confirma que la página de Facebook vinculada a esa cuenta siga disponible.',
          ],
      verifyTitle: language === 'en' ? 'What to verify' : 'Qué verificar',
      verifyBullets: language === 'en'
        ? [
            'The selected account matches the brand profile that will receive DMs.',
            'Meta verifies the webhook and sync preserves the Instagram account id.',
            'A real DM creates the conversation in the CRM without falling into another social channel.',
          ]
        : [
            'Que la cuenta seleccionada coincida con el perfil de marca que recibirá los DMs.',
            'Que Meta verifique el webhook y la sincronización conserve el id de la cuenta de Instagram.',
            'Que un DM real cree la conversación en el CRM sin caer en otro canal social.',
          ],
      respondTitle: language === 'en' ? 'How it responds' : 'Cómo responde',
      respondBullets: language === 'en'
        ? [
            'Incoming DMs land through the Meta webhook and are normalized to the CRM inbox.',
            'CRM replies go out with Meta Messaging Send API using the linked Instagram account context.',
            'Read and delivery signals update the same conversation statuses shown for WhatsApp and Messenger.',
          ]
        : [
            'Los DMs entrantes aterrizan por el webhook de Meta y se normalizan hacia la bandeja del CRM.',
            'Las respuestas del CRM salen con Meta Messaging Send API usando el contexto de la cuenta de Instagram vinculada.',
            'Las señales de lectura y entrega actualizan los mismos estados de conversación que se muestran para WhatsApp y Messenger.',
          ],
    }
  }

  return null
}

function getMetaManualFieldCopy(provider: ChannelConnection['provider'], language: 'es' | 'en') {
  if (provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX') {
    return {
      accountLabel: language === 'en' ? 'Business Account ID' : 'Business Account ID',
      assetLabel: language === 'en' ? 'Phone Number ID' : 'Phone Number ID',
      accountPlaceholder: language === 'en' ? 'Connected business account' : 'Cuenta business conectada',
      assetPlaceholder: language === 'en' ? 'WhatsApp number identifier' : 'Identificador del número de WhatsApp',
    }
  }

  if (provider === 'INSTAGRAM_DM') {
    return {
      accountLabel: language === 'en' ? 'Instagram Account ID' : 'Instagram Account ID',
      assetLabel: language === 'en' ? 'Linked Facebook Page ID' : 'Linked Facebook Page ID',
      accountPlaceholder: language === 'en' ? 'Instagram professional account id' : 'Identificador de la cuenta profesional de Instagram',
      assetPlaceholder: language === 'en' ? 'Linked Facebook page id' : 'Identificador de la página de Facebook vinculada',
    }
  }

  return {
    accountLabel: language === 'en' ? 'Meta Account ID' : 'Meta Account ID',
    assetLabel: language === 'en' ? 'Facebook Page ID' : 'Facebook Page ID',
    accountPlaceholder: language === 'en' ? 'Connected Meta account' : 'Cuenta Meta conectada',
    assetPlaceholder: language === 'en' ? 'Facebook page identifier' : 'Identificador de la página de Facebook',
  }
}

function getWhatsAppApiVersion(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.whatsappApiVersion === 'string' ? settingsJson.whatsappApiVersion : 'v23.0'
}

function getOperationalLimitValue(settingsJson: Record<string, unknown> | null | undefined, key: 'outboundLimitPerChannelDay' | 'outboundLimitPerChannelMonth' | 'outboundLimitPerEmpresaDay' | 'outboundLimitPerEmpresaMonth') {
  return typeof settingsJson?.[key] === 'string' ? settingsJson[key] : ''
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
  if (settingsJson?.launcherPosition === 'left') return 'left'
  if (settingsJson?.launcherPosition === 'center') return 'center'
  return 'right'
}

function getLauncherPlacement(settingsJson: Record<string, unknown> | null | undefined): LauncherPlacement {
  return settingsJson?.launcherPlacement === 'absolute' ? 'absolute' : 'fixed'
}

function getLauncherSize(settingsJson: Record<string, unknown> | null | undefined): LauncherSize {
  if (settingsJson?.launcherSize === 'compact') return 'compact'
  if (settingsJson?.launcherSize === 'large') return 'large'
  return 'standard'
}

function getLauncherStartsCollapsed(settingsJson: Record<string, unknown> | null | undefined) {
  return getBooleanSetting(settingsJson ?? {}, 'launcherStartsCollapsed', true)
}

function getLauncherOffsetX(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.launcherOffsetX === 'string' && settingsJson.launcherOffsetX.trim() ? settingsJson.launcherOffsetX : '60'
}

function getLauncherOffsetY(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.launcherOffsetY === 'string' && settingsJson.launcherOffsetY.trim() ? settingsJson.launcherOffsetY : '60'
}

function getLauncherZIndex(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.launcherZIndex === 'string' && settingsJson.launcherZIndex.trim() ? settingsJson.launcherZIndex : '2147483647'
}

function getPanelZIndex(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.panelZIndex === 'string' && settingsJson.panelZIndex.trim() ? settingsJson.panelZIndex : '2147483646'
}

function getBackdropZIndex(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.backdropZIndex === 'string' && settingsJson.backdropZIndex.trim() ? settingsJson.backdropZIndex : '2147483645'
}

function getLauncherPositionLabel(position: LauncherPosition) {
  if (position === 'left') return 'Izquierda'
  if (position === 'center') return 'Centro'
  return 'Derecha'
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

function normalizeZIndexValue(rawValue: string, fallback: string) {
  const digits = rawValue.replace(/[^0-9-]/g, '')
  return digits || fallback
}

function getPreviewJustifyContent(position: LauncherPosition) {
  if (position === 'left') return 'flex-start'
  if (position === 'center') return 'center'
  return 'flex-end'
}

function getPreviewAnchorStyle(position: LauncherPosition, offsetX: number, offsetY: number) {
  if (position === 'left') {
    return { bottom: offsetY, left: offsetX, maxWidth: `calc(100% - ${offsetX * 2}px)` }
  }
  if (position === 'center') {
    return { bottom: offsetY, left: '50%', transform: 'translateX(-50%)', maxWidth: `calc(100% - ${offsetX * 2}px)` }
  }
  return { bottom: offsetY, right: offsetX, maxWidth: `calc(100% - ${offsetX * 2}px)` }
}

function getInitialChatbotPreviewMode(builderState: Pick<ChatbotBuilderState, 'floatingLauncherEnabled' | 'launcherStartsCollapsed'>): ChatbotPreviewMode {
  if (!builderState.floatingLauncherEnabled) return 'expanded'
  return builderState.launcherStartsCollapsed ? 'floating' : 'expanded'
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
  const minHeight = options?.minHeight ?? (viewport === 'mobile' ? 620 : 560)
  const launcherMetrics = getLauncherPreviewMetrics(builderState.launcherSize)
  const panelShadow = getPanelShadowValue(builderState.panelShadowPreset)
  const previewOffsetX = Number.parseInt(normalizePixelValue(builderState.launcherOffsetX, '60'), 10)
  const previewOffsetY = Number.parseInt(normalizePixelValue(builderState.launcherOffsetY, '60'), 10)
  const previewAnchorStyle = getPreviewAnchorStyle(builderState.launcherPosition, previewOffsetX, previewOffsetY)
  const welcomeStage = builderState.flowStages.find((item) => item.id === 'welcome') ?? builderState.flowStages[0] ?? null
  const catalogStage = builderState.flowStages.find((item) => item.id === 'catalog') ?? builderState.flowStages[1] ?? welcomeStage
  const welcomeActions = builderState.quickActions.filter((item) => welcomeStage?.quickActionIds.includes(item.id) && item.enabled)
  const welcomeResponses = welcomeStage?.responseOptions ?? []
  const effectiveMode = mode === 'floating' ? getInitialChatbotPreviewMode(builderState) : mode
  const panelVisible = !builderState.floatingLauncherEnabled || effectiveMode === 'expanded'
  const launcherVisible = builderState.floatingLauncherEnabled && !panelVisible
  const launcherLabelVisible = effectiveMode !== 'compact' && launcherMetrics.labelVisible
  const previewHeight = launcherVisible
    ? Math.max(viewport === 'mobile' ? 220 : 200, previewOffsetY + Number.parseInt(launcherMetrics.buttonHeight, 10) + 72)
    : minHeight
  const preChatDepartmentOptions = builderState.preChatFormDepartmentOptions.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean)

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-emerald-200 p-3 shadow-sm" style={{ background: `radial-gradient(circle at top, rgba(16,185,129,0.12), transparent 30%), linear-gradient(180deg, ${builderState.pageBackgroundColor} 0%, ${builderState.pageBackgroundColor} 55%, ${builderState.backgroundColor} 100%)`, minHeight: previewHeight }}>
      <div className="flex h-full px-3 pt-4" style={{ justifyContent: getPreviewJustifyContent(builderState.launcherPosition), paddingBottom: launcherVisible ? 12 : 96 }}>
        <div className="relative flex min-h-full w-full items-end" style={{ maxWidth: viewport === 'mobile' ? 340 : '100%', fontFamily: builderState.fontFamily }}>
          {panelVisible ? <div className="w-full overflow-hidden border border-slate-200 bg-white" style={{ marginTop: 24, marginLeft: builderState.launcherPosition === 'right' ? 'auto' : builderState.launcherPosition === 'center' ? 'auto' : 0, marginRight: builderState.launcherPosition === 'left' ? 'auto' : builderState.launcherPosition === 'center' ? 'auto' : 0, borderRadius: `${normalizePixelValue(builderState.chatShellRadius, '30')}px`, boxShadow: panelShadow }}>
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
              {builderState.preChatFormEnabled && welcomeStage ? (
                <div className="max-w-[84%] border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-700 shadow-sm" style={{ borderRadius: `${normalizePixelValue(builderState.messageBubbleRadius, '22')}px` }}>{welcomeStage.prompt || builderState.chatbotPrompt}</div>
              ) : welcomeStage ? (
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
              {builderState.preChatFormEnabled ? (
                <div className="max-w-[92%] rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">{builderState.preChatFormTitle}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-600">{builderState.preChatFormDescription}</p>
                  <div className="mt-3 grid gap-2">
                    {builderState.preChatFormShowNameField ? <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400">{builderState.nameLabel}: {builderState.namePlaceholder}</div> : null}
                    {builderState.preChatFormShowEmailField ? <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400">{builderState.emailLabel}: {builderState.emailPlaceholder}</div> : null}
                    {builderState.preChatFormShowPhoneField ? <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400">{builderState.phoneLabel}: {builderState.phonePlaceholder}</div> : null}
                    {builderState.preChatFormShowDepartmentField && preChatDepartmentOptions.length ? <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400">{builderState.preChatFormDepartmentLabel}: {preChatDepartmentOptions.join(' / ')}</div> : null}
                    {builderState.termsEnabled ? <div className="text-[11px] leading-5 text-slate-500">{builderState.termsLabel}</div> : null}
                    <div className="rounded-xl px-3 py-2 text-center text-xs font-semibold text-white" style={{ backgroundColor: builderState.accentColor }}>{builderState.preChatFormSubmitLabel}</div>
                  </div>
                </div>
              ) : <div className="max-w-[84%] border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-700 shadow-sm" style={{ borderRadius: `${normalizePixelValue(builderState.messageBubbleRadius, '22')}px` }}>{welcomeStage?.prompt || builderState.chatbotPrompt}</div>}
              {!builderState.preChatFormEnabled && welcomeResponses.length ? (
                <div className="flex max-w-[92%] flex-wrap gap-2">
                  {welcomeResponses.map((option) => (
                    <div key={option.id} className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-semibold text-violet-900 shadow-sm">
                      <div>{option.label}</div>
                      <div className="mt-0.5 text-[10px] font-medium opacity-75">Salta a {builderState.flowStages.find((stage) => stage.id === option.targetStageId)?.title || option.targetStageId}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {!builderState.preChatFormEnabled && builderState.showProductField ? <div className="max-w-[84%] border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-700 shadow-sm" style={{ borderRadius: `${normalizePixelValue(builderState.messageBubbleRadius, '22')}px` }}>También puedo tomar producto y contexto inicial para enrutar mejor el lead.</div> : null}
              <div className="ml-auto max-w-[78%] px-4 py-3 text-xs leading-5 text-white shadow-sm" style={{ backgroundColor: builderState.accentColor, borderRadius: `${normalizePixelValue(builderState.messageBubbleRadius, '22')}px` }}>{builderState.preChatFormEnabled ? 'Listo, ya completé mis datos.' : 'Hola, necesito ayuda para una nueva cotización.'}</div>
              <div className="max-w-[84%] border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-700 shadow-sm" style={{ borderRadius: `${normalizePixelValue(builderState.messageBubbleRadius, '22')}px` }}>{catalogStage?.prompt || `Perfecto. Soy ${builderState.assistantName} y te ayudo a capturar lo necesario.`}</div>
            </div>
            <div className="border-t border-slate-100 bg-white px-4 py-4">
              <div className="grid gap-2">
                {welcomeActions.length ? (
                  <div className="flex flex-wrap gap-2">
                    {welcomeActions.map((action) => (
                      <div key={action.id} className={`rounded-2xl border px-3 py-2 text-[11px] font-semibold shadow-sm ${getQuickActionTone(action.kind)}`}>
                        <div>{action.label}</div>
                        <div className="mt-0.5 text-[10px] font-medium opacity-80">{action.kind === 'catalog' ? 'Explora catálogo' : action.kind === 'stock' ? 'Consulta inventario' : action.kind === 'human' ? 'Escala al equipo' : action.kind === 'create_quote' ? 'Genera cotización' : action.kind === 'create_invoice' ? 'Genera factura' : action.kind === 'create_work_order' ? 'Genera orden' : 'Acción rápida'}</div>
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
          </div> : null}

          {launcherVisible ? (
            <div className="absolute" style={{ zIndex: Number.parseInt(normalizeZIndexValue(builderState.launcherZIndex, '2147483647'), 10), ...previewAnchorStyle }}>
              <div className="flex max-w-full items-center justify-center whitespace-nowrap text-white shadow-[0_18px_44px_-26px_rgba(15,23,42,0.55)]" style={{ backgroundColor: builderState.accentColor, borderRadius: launcherMetrics.buttonRadius, padding: launcherMetrics.buttonPadding, height: launcherMetrics.buttonHeight, gap: effectiveMode === 'compact' ? '0' : launcherMetrics.buttonGap, minWidth: effectiveMode === 'compact' ? launcherMetrics.buttonHeight : undefined, fontSize: launcherMetrics.fontSize, fontWeight: 700 }}>
                <span style={{ fontSize: launcherMetrics.iconSize, lineHeight: 1 }}>{getLauncherPreviewIcon(builderState.launcherIcon)}</span>
                {launcherLabelVisible ? <span>{builderState.launcherLabel}</span> : null}
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
    if (isOutgoingWebhookBridge(bridgeKind)) return getOutgoingWebhookUrl(settings)
    if (bridgeKind === 'GOOGLE_SHEETS') return `${baseUrl}/api/crm/channels/${channel.id}/google-sheets/import`
    if (bridgeKind === 'BOOKING') return `${baseUrl}/api/crm/captures/booking`
    return bridgeKind && bridgeKind !== 'GENERIC' ? `${baseUrl}/api/crm/captures/bridge` : `${baseUrl}/api/crm/captures/web-form`
  }
  if (channel.provider === 'WEB_CHATBOT') return `${baseUrl}/api/crm/captures/chatbot`
  if (usesMetaProvider(channel.provider)) return `${baseUrl}/api/webhooks/meta`
  return `${baseUrl}/api/crm/channels/${channel.id}/webhook`
}

function buildIntegrationSnippets(args: {
  baseUrl: string
  channelId: string
  provider: CrmChannelProvider
  bridgeKind: string
  settingsJson: Record<string, unknown> | null | undefined
  token: string
}): IntegrationSnippets {
  return {
    webForm: args.bridgeKind === 'BOOKING'
      ? buildBookingSnippet({
          baseUrl: args.baseUrl,
          channelId: args.channelId,
          token: args.token,
          selector: getFormSelector(args.settingsJson),
        })
      : buildWebFormSnippet({
          baseUrl: args.baseUrl,
          channelId: args.channelId,
          token: args.token,
          selector: getFormSelector(args.settingsJson),
        }),
    webFormIframe: args.bridgeKind === 'BOOKING'
      ? buildBookingIframeSnippet({
          baseUrl: args.baseUrl,
          channelId: args.channelId,
          height: getIframeHeight(args.settingsJson),
        })
      : buildWebFormIframeSnippet({
          baseUrl: args.baseUrl,
          channelId: args.channelId,
          height: getIframeHeight(args.settingsJson),
        }),
    webFormEmbedUrl: args.bridgeKind === 'BOOKING' ? buildBookingEmbedUrl(args.baseUrl, args.channelId) : buildWebFormEmbedUrl(args.baseUrl, args.channelId),
    chatbot: buildChatbotSnippet({
      baseUrl: args.baseUrl,
      channelId: args.channelId,
      token: args.token,
      title: getChatbotTitle(args.settingsJson),
      prompt: getChatbotPrompt(args.settingsJson),
      accentColor: getAccentColor(args.settingsJson),
      backgroundColor: getBackgroundColor(args.settingsJson),
      launcherLabel: getLauncherLabel(args.settingsJson),
      launcherIcon: getLauncherIcon(args.settingsJson),
      launcherPosition: getLauncherPosition(args.settingsJson),
      launcherPlacement: getLauncherPlacement(args.settingsJson),
      launcherSize: getLauncherSize(args.settingsJson),
      launcherOffsetX: getLauncherOffsetX(args.settingsJson),
      launcherOffsetY: getLauncherOffsetY(args.settingsJson),
      launcherZIndex: getLauncherZIndex(args.settingsJson),
      panelZIndex: getPanelZIndex(args.settingsJson),
      backdropZIndex: getBackdropZIndex(args.settingsJson),
      customCss: getChatbotCustomCss(args.settingsJson),
    }),
    chatbotIframe: buildChatbotIframeSnippet({
      baseUrl: args.baseUrl,
      channelId: args.channelId,
      height: getIframeHeight(args.settingsJson),
      floatingLauncherEnabled: getFloatingLauncherEnabled(args.settingsJson),
      launcherStartsCollapsed: getLauncherStartsCollapsed(args.settingsJson),
      launcherPosition: getLauncherPosition(args.settingsJson),
      launcherPlacement: getLauncherPlacement(args.settingsJson),
      launcherOffsetX: getLauncherOffsetX(args.settingsJson),
      launcherOffsetY: getLauncherOffsetY(args.settingsJson),
      panelZIndex: getPanelZIndex(args.settingsJson),
      chatShellRadius: getChatShellRadius(args.settingsJson),
      backgroundColor: getBackgroundColor(args.settingsJson),
    }),
    chatbotEmbedUrl: buildChatbotEmbedUrl(args.baseUrl, args.channelId),
    gmail: buildGmailAppsScriptSnippet({
      baseUrl: args.baseUrl,
      channelId: args.channelId,
      token: args.token,
    }),
    outlook: buildOutlookPayloadExample(args.baseUrl, args.channelId, args.token),
    webhook: buildWebhookPayloadExample(args.provider, args.bridgeKind as CrmBridgeKind | null),
    googleSheetsPreview: `${args.baseUrl}/api/crm/channels/${args.channelId}/google-sheets/preview`,
    googleSheetsImport: `${args.baseUrl}/api/crm/channels/${args.channelId}/google-sheets/import`,
    googleSheetsExport: `${args.baseUrl}/api/crm/channels/${args.channelId}/google-sheets/export`,
  }
}

function channelTone(provider: CrmChannelProvider, bridgeKind: string) {
  if (provider === 'WEB_CHATBOT') return 'border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,.92),rgba(255,255,255,.98))]'
  if (provider === 'WEB_FORM' && bridgeKind === 'BOOKING') return 'border-sky-200 bg-[linear-gradient(180deg,rgba(224,242,254,.95),rgba(255,255,255,.98))]'
  if (provider === 'WEB_FORM' && bridgeKind === 'GOOGLE_SHEETS') return 'border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,.95),rgba(255,255,255,.98))]'
  if (provider === 'WEB_FORM' && (bridgeKind === 'GOOGLE_CALENDAR' || bridgeKind === 'MICROSOFT_365_CALENDAR')) return 'border-cyan-200 bg-[linear-gradient(180deg,rgba(236,254,255,.95),rgba(255,255,255,.98))]'
  if (provider === 'WEB_FORM' && (bridgeKind === 'META_LEAD_ADS' || bridgeKind === 'EXTERNAL_FORM')) return 'border-fuchsia-200 bg-[linear-gradient(180deg,rgba(253,244,255,.95),rgba(255,255,255,.98))]'
  if (provider === 'WEB_FORM' && (bridgeKind === 'GMAIL' || bridgeKind === 'OUTLOOK')) return 'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,.95),rgba(255,255,255,.98))]'
  if (provider === 'WEB_FORM' && (bridgeKind === 'SLACK' || bridgeKind === 'TEAMS')) return 'border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,.96),rgba(255,255,255,.98))]'
  if (provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX') return 'border-emerald-200 bg-[linear-gradient(180deg,rgba(220,252,231,.95),rgba(255,255,255,.98))]'
  return 'border-sky-200 bg-[linear-gradient(180deg,rgba(240,249,255,.96),rgba(255,255,255,.98))]'
}

function providerSummary(provider: CrmChannelProvider, bridgeKind: CrmBridgeKind) {
  if (provider === 'WEB_CHATBOT') return 'Canal conversacional embebible por iframe con captura en tiempo real.'
  if (provider === 'WEB_FORM' && bridgeKind === 'BOOKING') return 'Agenda embebible por iframe que crea cita, tarea CRM y dispara confirmaciones automáticas.'
  if (provider === 'WEB_FORM' && bridgeKind === 'GENERIC') return 'Canal de captura vía formularios y landings con tracking comercial.'
  if (provider === 'WEB_FORM' && bridgeKind === 'GOOGLE_SHEETS') return 'Bridge manual para importar y exportar leads desde hojas comerciales ya operativas.'
  if (provider === 'WEB_FORM' && bridgeKind === 'GOOGLE_CALENDAR') return 'Bridge saliente que publica tareas y citas del CRM hacia Google Calendar.'
  if (provider === 'WEB_FORM' && bridgeKind === 'MICROSOFT_365_CALENDAR') return 'Bridge saliente que sincroniza tareas y citas del CRM hacia Microsoft 365 Calendar.'
  if (provider === 'WEB_FORM' && bridgeKind === 'SLACK') return 'Bridge saliente para avisar eventos CRM a canales internos de Slack.'
  if (provider === 'WEB_FORM' && bridgeKind === 'TEAMS') return 'Bridge saliente para publicar eventos CRM en Microsoft Teams.'
  if (provider === 'WEB_FORM' && bridgeKind === 'META_LEAD_ADS') return 'Bridge inbound para campañas de Meta Lead Ads sin depender de una integración nativa cerrada.'
  if (provider === 'WEB_FORM' && bridgeKind === 'EXTERNAL_FORM') return 'Bridge inbound para formularios externos, landings third-party y capturas server-to-server.'
  if (provider === 'WEB_FORM') return 'Bridge operativo para automatizaciones externas y fuentes no nativas.'
  return 'Canal omnicanal basado en webhook para inbox y mensajería inbound.'
}

function usesMetaProvider(provider: CrmChannelProvider) {
  return provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX' || provider === 'FACEBOOK_PAGE' || provider === 'MESSENGER' || provider === 'INSTAGRAM_DM'
}

function getUsageMeterTone(percentage: number) {
  if (percentage >= 100) return 'bg-rose-500'
  if (percentage >= 80) return 'bg-amber-500'
  return 'bg-emerald-500'
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

function requiresMetaOAuthBeforeActive(form: ChannelFormState) {
  return form.provider === 'WHATSAPP_CLOUD' && form.status === 'ACTIVE'
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
    {
      label: 'ACTIVE solo con conexión Meta real del cliente',
      done: !requiresMetaOAuthBeforeActive(form),
      hint: 'Para evitar cobros en activos equivocados, WhatsApp Cloud no debe crearse en ACTIVE con credenciales manuales. Déjalo en TESTING y pásalo a ACTIVE solo después de Conectar con Meta y aplicar el número sincronizado.',
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
  const isWhatsApp = channel.provider === 'WHATSAPP_CLOUD' || channel.provider === 'WHATSAPP_SANDBOX'
  const isInstagram = channel.provider === 'INSTAGRAM_DM'
  const hasActiveAsset = isWhatsApp
    ? Boolean(channel.externalPhoneNumberId)
    : isInstagram
      ? Boolean(channel.externalAccountId)
      : Boolean(channel.externalPageId)

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
    {
      label: isWhatsApp ? 'Número activo aplicado' : isInstagram ? 'Cuenta activa de Instagram aplicada' : 'Página activa aplicada',
      done: hasActiveAsset,
      hint: isWhatsApp
        ? 'El canal debe terminar apuntando al número sincronizado correcto antes de salir a operación real.'
        : isInstagram
          ? 'El canal debe terminar apuntando a la cuenta profesional correcta antes de responder DMs reales.'
          : 'El canal debe terminar apuntando a la página correcta antes de responder conversaciones reales.',
    },
    {
      label: 'Webhook con tráfico reciente',
      done: Boolean(channel.lastWebhookAt),
      hint: channel.lastWebhookAt
        ? 'Ya hubo actividad webhook reciente. Aun así, conviene validar una conversación real end to end.'
        : isWhatsApp
          ? 'Cuando conectes Meta, dispara una prueba real de WhatsApp para confirmar inbound, reply y checks.'
          : isInstagram
            ? 'Cuando conectes Meta, dispara un DM real para confirmar inbound, reply y checks.'
            : 'Cuando conectes Meta, dispara una prueba real de Messenger para confirmar inbound, reply y checks.',
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
  const isPublicWebForm = channel.provider === 'WEB_FORM' && (bridgeKind === 'GENERIC' || bridgeKind === 'BOOKING')
  const isWebhook = channel.provider !== 'WEB_FORM' && channel.provider !== 'WEB_CHATBOT'
  const isMeta = usesMetaProvider(channel.provider)
  const publicEmbed = getPublicEmbedEnabled(settings)
  const allowedDomains = getAllowedDomains(settings)
  const hasExternalId = Boolean(channel.externalAccountId || channel.externalPageId || channel.externalPhoneNumberId)
  const hasMetaConnection = !isMeta || Boolean(settings?.metaAccessTokenEncrypted || settings?.metaConnectedAt)
  const hasWhatsAppCredentials = channel.provider !== 'WHATSAPP_CLOUD' && channel.provider !== 'WHATSAPP_SANDBOX'
    ? true
    : Boolean(getWhatsAppAccessToken(settings))
  const hasOutgoingWebhook = !isOutgoingWebhookBridge(bridgeKind) || Boolean(getOutgoingWebhookUrl(settings))

  const configured: ReadinessItem[] = [
    { label: 'Base configurada', done: Boolean(channel.name && channel.provider), hint: 'Nombre y proveedor definidos.' },
    { label: 'Token listo', done: Boolean(token || channel.verifyTokenPreview), hint: 'Token de pruebas o verificación disponible.' },
    { label: 'Ruta operativa', done: Boolean(getEndpoint(baseUrl, channel)), hint: 'Endpoint o webhook listo para usarse.' },
  ]

  const demo: ReadinessItem[] = [
    { label: 'Listo para demo', done: channel.status === 'TESTING' || channel.status === 'ACTIVE', hint: 'El canal debe estar en TESTING o ACTIVE.' },
    { label: 'Preview comercial', done: isChatbot ? Boolean(buildChatbotEmbedUrl(baseUrl, channel.id)) : isPublicWebForm ? Boolean(bridgeKind === 'BOOKING' ? buildBookingEmbedUrl(baseUrl, channel.id) : buildWebFormEmbedUrl(baseUrl, channel.id)) : true, hint: 'Debe existir forma visible de mostrar la integración.' },
    { label: 'Fuente de demo', done: !isWebhook || hasExternalId || bridgeKind !== 'GENERIC', hint: 'Webhook o IDs externos mínimos para una demo guiada.' },
  ]

  const production: ReadinessItem[] = [
    { label: 'Estado productivo', done: channel.status === 'ACTIVE', hint: 'Para producción el canal debe estar activo.' },
    { label: 'Dominio endurecido', done: (!isChatbot && !isPublicWebForm) || !publicEmbed || Boolean(allowedDomains.trim()), hint: 'Los embeds públicos deberían restringirse por dominios.' },
    { label: 'Webhook saliente configurado', done: hasOutgoingWebhook, hint: 'Slack, Teams y calendarios requieren un destino HTTP configurado.' },
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
  const studioSettings = getChatbotStudioSettings(settingsJson)
  const defaultFlow = getDefaultChatbotAutomationFlowFromSettings(studioSettings)
  const publicSettings = getPublicChatbotSettings(settingsJson)

  return {
    chatbotTitle: publicSettings.chatbotTitle,
    chatbotPrompt: publicSettings.chatbotPrompt,
    assistantName: publicSettings.assistantName,
    chatResetConversationAfterValue: String(publicSettings.resetConversationAfterValue),
    chatResetConversationAfterUnit: publicSettings.resetConversationAfterUnit,
    chatResetConversationAfterAction: publicSettings.resetConversationAfterAction,
    preChatFormEnabled: publicSettings.preChatFormEnabled,
    preChatFormInactivityEnabled: publicSettings.preChatFormInactivityRule.enabled,
    preChatFormInactivityValue: String(publicSettings.preChatFormInactivityRule.timeoutValue),
    preChatFormInactivityUnit: publicSettings.preChatFormInactivityRule.timeoutUnit,
    preChatFormInactivityAction: publicSettings.preChatFormInactivityRule.action,
    preChatFormTemplate: publicSettings.preChatFormTemplate,
    preChatFormTitle: publicSettings.preChatFormTitle,
    preChatFormDescription: publicSettings.preChatFormDescription,
    preChatFormSubmitLabel: publicSettings.preChatFormSubmitLabel,
    preChatFormShowNameField: publicSettings.preChatFormShowNameField,
    preChatFormShowEmailField: publicSettings.preChatFormShowEmailField,
    preChatFormShowPhoneField: publicSettings.preChatFormShowPhoneField,
    preChatFormRequireName: publicSettings.preChatFormRequireName,
    preChatFormRequireEmail: publicSettings.preChatFormRequireEmail,
    preChatFormRequirePhone: publicSettings.preChatFormRequirePhone,
    preChatFormRequireContactMethod: publicSettings.preChatFormRequireContactMethod,
    preChatFormShowDepartmentField: publicSettings.preChatFormShowDepartmentField,
    preChatFormDepartmentLabel: publicSettings.preChatFormDepartmentLabel,
    preChatFormDepartmentPlaceholder: publicSettings.preChatFormDepartmentPlaceholder,
    preChatFormDepartmentOptions: publicSettings.preChatFormDepartmentOptions.map((item) => item.label).join('\n'),
    termsEnabled: publicSettings.termsEnabled,
    termsLabel: publicSettings.termsLabel,
    termsLinkText: publicSettings.termsLinkText,
    termsLinkUrl: publicSettings.termsLinkUrl,
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
    launcherPlacement: getLauncherPlacement(settingsJson),
    launcherSize: getLauncherSize(settingsJson),
    launcherStartsCollapsed: getLauncherStartsCollapsed(settingsJson),
    launcherOffsetX: getLauncherOffsetX(settingsJson),
    launcherOffsetY: getLauncherOffsetY(settingsJson),
    launcherZIndex: getLauncherZIndex(settingsJson),
    panelZIndex: getPanelZIndex(settingsJson),
    backdropZIndex: getBackdropZIndex(settingsJson),
    headerBadgeLabel: getHeaderBadgeLabel(settingsJson),
    statusBadgeLabel: getStatusBadgeLabel(settingsJson),
    chatShellRadius: getChatShellRadius(settingsJson),
    messageBubbleRadius: getMessageBubbleRadius(settingsJson),
    panelShadowPreset: getPanelShadowPreset(settingsJson),
    showProductField: getShowProductField(settingsJson),
    nameLabel: getSettingText(settingsJson, 'nameLabel', 'Nombre'),
    namePlaceholder: getSettingText(settingsJson, 'namePlaceholder', 'Tu nombre'),
    emailLabel: getSettingText(settingsJson, 'emailLabel', 'Correo'),
    emailPlaceholder: getSettingText(settingsJson, 'emailPlaceholder', 'tu@correo.com'),
    phoneLabel: getSettingText(settingsJson, 'phoneLabel', 'Teléfono o WhatsApp'),
    phonePlaceholder: getSettingText(settingsJson, 'phonePlaceholder', '300 000 0000'),
    productLabel: getSettingText(settingsJson, 'productLabel', 'Producto'),
    productPlaceholder: getSettingText(settingsJson, 'productPlaceholder', '¿Qué producto necesitas?'),
    messageLabel: getSettingText(settingsJson, 'messageLabel', 'Mensaje'),
    messagePlaceholder: getSettingText(settingsJson, 'messagePlaceholder', 'Cuéntanos qué necesitas y para cuándo.'),
    quickActions: defaultFlow.quickActions.length
      ? defaultFlow.quickActions
      : normalizeChatbotQuickActions(settingsJson?.quickActions),
    flowStages: defaultFlow.flowStages.length
      ? defaultFlow.flowStages
      : normalizeChatbotFlowStages(settingsJson?.flowStages),
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
  if (nextField === 'whatsapp') return 'Pide WhatsApp'
  if (nextField === 'product') return 'Pide producto'
  if (nextField === 'quantity') return 'Pide cantidad'
  if (nextField === 'company') return 'Pide empresa'
  if (nextField === 'document') return 'Pide documento o NIT'
  if (nextField === 'city') return 'Pide ciudad'
  if (nextField === 'address') return 'Pide dirección'
  if (nextField === 'confirmation') return 'Resumen y confirmación'
  return 'Cierre / handoff'
}

function getQuickActionTone(kind: ChatbotQuickAction['kind']) {
  if (kind === 'catalog') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (kind === 'stock') return 'border-sky-200 bg-sky-50 text-sky-800'
  if (kind === 'human') return 'border-amber-200 bg-amber-50 text-amber-900'
  if (kind === 'create_quote') return 'border-indigo-200 bg-indigo-50 text-indigo-900'
  if (kind === 'create_invoice') return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900'
  if (kind === 'create_work_order') return 'border-cyan-200 bg-cyan-50 text-cyan-900'
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
  const router = useRouter()
  const { language } = useI18n()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null)
  const [updatingChannelId, setUpdatingChannelId] = useState<string | null>(null)
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null)
  const [pendingWizardChannelId, setPendingWizardChannelId] = useState<string | null>(null)
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
  const [chatbotBuilderPreviewMode, setChatbotBuilderPreviewMode] = useState<ChatbotPreviewMode>(getInitialChatbotPreviewMode(getChatbotBuilderState(null)))
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
  const [wizardChatPreviewMode, setWizardChatPreviewMode] = useState<ChatbotPreviewMode>(getInitialChatbotPreviewMode(getInitialChannelForm()))
  const [wizardChatPreviewViewport, setWizardChatPreviewViewport] = useState<ChatbotPreviewViewport>('desktop')
  const [googleSheetsActions, setGoogleSheetsActions] = useState<GoogleSheetsActionState>(getInitialGoogleSheetsActionState())
  const [selectedChannelUsageStats, setSelectedChannelUsageStats] = useState<ChannelConnection['outboundMessagingStats'] | null>(null)
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
    const open = search.get('open')
    const metaStatus = search.get('meta')
    const message = search.get('message')

    if (channelId) {
      setSelectedChannelId(channelId)
      if (open === 'wizard') {
        setPendingWizardChannelId(channelId)
      }
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

  useEffect(() => {
    if (!pendingWizardChannelId || !channels.length) return
    const channel = channels.find((item) => item.id === pendingWizardChannelId) ?? null
    setPendingWizardChannelId(null)
    if (!channel) return
    openEditWizard(channel, { forceWizard: true })
    window.history.replaceState({}, '', window.location.pathname)
  }, [channels, pendingWizardChannelId])

  useEffect(() => {
    let cancelled = false

    async function loadSelectedChannelUsage() {
      if (!selectedChannelId) {
        if (!cancelled) setSelectedChannelUsageStats(null)
        return
      }

      const json = await requestJson<ChannelConnection>(`/api/crm/channels/${selectedChannelId}`)
      if (cancelled) return
      setSelectedChannelUsageStats(json.data?.outboundMessagingStats ?? null)
    }

    void loadSelectedChannelUsage()

    return () => {
      cancelled = true
    }
  }, [selectedChannelId, channels])

  const selectedChannel = useMemo(() => channels.find((item) => item.id === selectedChannelId) ?? null, [channels, selectedChannelId])
  const createPreset = useMemo(() => TEMPLATE_PRESETS.find((item) => item.key === createForm.templateKey) ?? TEMPLATE_PRESETS[0], [createForm.templateKey])
  const createIsChatbot = createForm.provider === 'WEB_CHATBOT'
  const createIsPublicWebForm = createForm.provider === 'WEB_FORM' && (createForm.bridgeKind === 'GENERIC' || createForm.bridgeKind === 'BOOKING')
  const createIsBridge = createForm.provider === 'WEB_FORM' && !createIsPublicWebForm
  const createUsesWebhook = createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' || createForm.provider === 'FACEBOOK_PAGE' || createForm.provider === 'MESSENGER' || createForm.provider === 'INSTAGRAM_DM'
  const derivedChatbotCustomCss = useMemo(() => buildFriendlyChatbotCustomCss({ chatShellRadius: createForm.chatShellRadius, messageBubbleRadius: createForm.messageBubbleRadius, panelShadowPreset: createForm.panelShadowPreset }), [createForm.chatShellRadius, createForm.messageBubbleRadius, createForm.panelShadowPreset])
  const createSettingsJson = useMemo(() => {
    const settingsJsonBase = {
      testingToken: createForm.testingToken,
      bridgeKind: createForm.bridgeKind,
      googleSheetsSpreadsheetId: createForm.googleSheetsSpreadsheetId,
      googleSheetsSheetName: createForm.googleSheetsSheetName,
      googleSheetsPublishedCsvUrl: createForm.googleSheetsPublishedCsvUrl,
      googleSheetsRowLimit: createForm.googleSheetsRowLimit,
      googleSheetsImportMode: createForm.googleSheetsImportMode,
      googleSheetsOpportunityStage: createForm.googleSheetsOpportunityStage,
      bookingNotifyByEmail: createForm.bookingNotifyByEmail,
      bookingNotifyByWhatsApp: createForm.bookingNotifyByWhatsApp,
      outgoingWebhookUrl: createForm.outgoingWebhookUrl,
      externalAccountId: createForm.externalAccountId,
      externalPageId: createForm.externalPageId,
      externalPhoneNumberId: createForm.externalPhoneNumberId,
      whatsappConnectionMode: createForm.whatsappConnectionMode,
      whatsappDisplayPhoneNumber: createForm.whatsappDisplayPhoneNumber,
      whatsappAccessToken: createForm.whatsappAccessToken,
      whatsappApiVersion: createForm.whatsappApiVersion,
      outboundLimitPerChannelDay: createForm.outboundLimitPerChannelDay.replace(/[^0-9]/g, ''),
      outboundLimitPerChannelMonth: createForm.outboundLimitPerChannelMonth.replace(/[^0-9]/g, ''),
      outboundLimitPerEmpresaDay: createForm.outboundLimitPerEmpresaDay.replace(/[^0-9]/g, ''),
      outboundLimitPerEmpresaMonth: createForm.outboundLimitPerEmpresaMonth.replace(/[^0-9]/g, ''),
      formSelector: createForm.formSelector,
      chatbotTitle: createForm.chatbotTitle,
      chatbotPrompt: createForm.chatbotPrompt,
      assistantName: createForm.assistantName,
      chatResetConversationAfterHours: undefined,
      chatResetConversationAfterValue: createForm.chatResetConversationAfterValue,
      chatResetConversationAfterUnit: createForm.chatResetConversationAfterUnit,
      chatResetConversationAfterAction: createForm.chatResetConversationAfterAction,
      preChatFormEnabled: createForm.preChatFormEnabled,
      preChatFormTemplate: createForm.preChatFormTemplate,
      preChatFormTitle: createForm.preChatFormTitle,
      preChatFormDescription: createForm.preChatFormDescription,
      preChatFormSubmitLabel: createForm.preChatFormSubmitLabel,
      preChatFormShowNameField: createForm.preChatFormShowNameField,
      preChatFormShowEmailField: createForm.preChatFormShowEmailField,
      preChatFormShowPhoneField: createForm.preChatFormShowPhoneField,
      preChatFormRequireName: createForm.preChatFormRequireName,
      preChatFormRequireEmail: createForm.preChatFormRequireEmail,
      preChatFormRequirePhone: createForm.preChatFormRequirePhone,
      preChatFormRequireContactMethod: createForm.preChatFormRequireContactMethod,
      preChatFormShowDepartmentField: createForm.preChatFormShowDepartmentField,
      preChatFormDepartmentLabel: createForm.preChatFormDepartmentLabel,
      preChatFormDepartmentPlaceholder: createForm.preChatFormDepartmentPlaceholder,
      preChatFormDepartmentOptions: createForm.preChatFormDepartmentOptions,
      preChatFormInactivityRule: {
        enabled: createForm.preChatFormInactivityEnabled,
        timeoutValue: Math.max(1, Number(createForm.preChatFormInactivityValue) || 1),
        timeoutUnit: createForm.preChatFormInactivityUnit,
        action: createForm.preChatFormInactivityAction,
      },
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
      launcherPlacement: createForm.launcherPlacement,
      launcherSize: createForm.launcherSize,
      launcherStartsCollapsed: createForm.launcherStartsCollapsed,
      launcherOffsetX: normalizePixelValue(createForm.launcherOffsetX, '60'),
      launcherOffsetY: normalizePixelValue(createForm.launcherOffsetY, '60'),
      launcherZIndex: normalizeZIndexValue(createForm.launcherZIndex, '2147483647'),
      panelZIndex: normalizeZIndexValue(createForm.panelZIndex, '2147483646'),
      backdropZIndex: normalizeZIndexValue(createForm.backdropZIndex, '2147483645'),
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

    return createForm.provider === 'WEB_CHATBOT'
      ? mergeChatbotDefaultFlowSettings({
          settingsJson: settingsJsonBase,
          quickActions: createForm.quickActions,
          flowStages: createForm.flowStages,
        })
      : settingsJsonBase
  }, [createForm, derivedChatbotCustomCss])
  const wizardImplementationBaseUrl = baseUrl || 'https://tu-dominio.com'
  const wizardImplementationChannelId = editingChannelId || selectedChannel?.id || '<canal-generado>'
  const wizardImplementationChannel = useMemo<ChannelConnection>(() => ({
    id: wizardImplementationChannelId,
    name: createForm.name || createPreset.name,
    provider: createForm.provider,
    status: createForm.status,
    verifyTokenPreview: createForm.testingToken || null,
    settingsJson: createSettingsJson,
    updatedAt: '',
    createdAt: '',
  }), [createForm.name, createForm.provider, createForm.status, createForm.testingToken, createPreset.name, createSettingsJson, wizardImplementationChannelId])
  const wizardImplementationSnippets = useMemo(() => buildIntegrationSnippets({
    baseUrl: wizardImplementationBaseUrl,
    channelId: wizardImplementationChannelId,
    provider: createForm.provider,
    bridgeKind: createForm.bridgeKind,
    settingsJson: createSettingsJson,
    token: createForm.testingToken || '<TOKEN>',
  }), [createForm.bridgeKind, createForm.provider, createForm.testingToken, createSettingsJson, wizardImplementationBaseUrl, wizardImplementationChannelId])
  const wizardImplementationGuide = useMemo(() => getDetailedIntegrationGuide({
    channel: wizardImplementationChannel,
    bridgeKind: createForm.bridgeKind,
    endpoint: getEndpoint(wizardImplementationBaseUrl, wizardImplementationChannel),
    token: createForm.testingToken,
    language,
    snippets: wizardImplementationSnippets,
  }), [createForm.bridgeKind, createForm.testingToken, language, wizardImplementationChannel, wizardImplementationBaseUrl, wizardImplementationSnippets])
  const wizardImplementationCards = useMemo<ImplementationAssetCard[]>(() => {
    const cards: ImplementationAssetCard[] = []

    if (createForm.provider === 'WEB_CHATBOT') {
      cards.push(
        {
          id: 'wizard-chatbot-url',
          title: 'URL pública',
          description: 'Úsala para demo directa o como ruta base del embebido.',
          value: wizardImplementationSnippets.chatbotEmbedUrl,
          copyLabel: 'Copiar URL',
        },
        {
          id: 'wizard-chatbot-iframe',
          title: 'Iframe fijo',
          description: 'Este bloque publica el panel del chat abierto. Para respetar launcher flotante, usa el widget.',
          value: wizardImplementationSnippets.chatbotIframe,
          copyLabel: 'Copiar iframe',
        },
        {
          id: 'wizard-chatbot-widget',
          title: 'Widget flotante',
          description: createForm.floatingLauncherEnabled
            ? 'Este snippet sí refleja la configuración actual del launcher flotante.'
            : 'El launcher flotante está desactivado en la configuración actual.',
          value: createForm.floatingLauncherEnabled ? wizardImplementationSnippets.chatbot : 'Launcher flotante desactivado en la configuración actual.',
          copyLabel: 'Copiar widget',
          disabled: !createForm.floatingLauncherEnabled,
        },
      )
      return cards
    }

    if (createIsPublicWebForm) {
      cards.push(
        {
          id: 'wizard-webform-url',
          title: createForm.bridgeKind === 'BOOKING' ? 'URL pública de agenda' : 'URL pública del formulario',
          description: 'Enlace directo para demo o integración rápida.',
          value: wizardImplementationSnippets.webFormEmbedUrl,
          copyLabel: 'Copiar URL',
        },
        {
          id: 'wizard-webform-iframe',
          title: createForm.bridgeKind === 'BOOKING' ? 'Iframe de agenda' : 'Iframe del formulario',
          description: 'Snippet listo para pegar en el sitio del cliente.',
          value: wizardImplementationSnippets.webFormIframe,
          copyLabel: 'Copiar iframe',
        },
        {
          id: 'wizard-webform-script',
          title: createForm.bridgeKind === 'BOOKING' ? 'Script sobre formulario existente' : 'Script bridge sobre formulario existente',
          description: 'Úsalo si el cliente ya tiene un formulario propio y no usará el iframe completo.',
          value: wizardImplementationSnippets.webForm,
          copyLabel: 'Copiar script',
        },
      )
      return cards
    }

    if (createForm.provider === 'WEB_FORM' && createForm.bridgeKind === 'GMAIL') {
      cards.push({ id: 'wizard-gmail-script', title: 'Apps Script', description: 'Base para enrutar correos comerciales hacia el CRM.', value: wizardImplementationSnippets.gmail, copyLabel: 'Copiar script' })
      return cards
    }

    if (createForm.provider === 'WEB_FORM' && createForm.bridgeKind === 'OUTLOOK') {
      cards.push({ id: 'wizard-outlook-payload', title: 'Payload de Power Automate', description: 'Referencia para la acción HTTP o flujo equivalente.', value: wizardImplementationSnippets.outlook, copyLabel: 'Copiar payload' })
      return cards
    }

    if (createForm.provider === 'WEB_FORM' && createForm.bridgeKind === 'GOOGLE_SHEETS') {
      cards.push(
        { id: 'wizard-sheets-preview', title: 'Endpoint preview', description: 'Valida headers y primeras filas antes de importar.', value: wizardImplementationSnippets.googleSheetsPreview, copyLabel: 'Copiar endpoint' },
        { id: 'wizard-sheets-import', title: 'Endpoint import', description: 'Dispara la importación cuando el preview ya esté aprobado.', value: wizardImplementationSnippets.googleSheetsImport, copyLabel: 'Copiar endpoint' },
        { id: 'wizard-sheets-export', title: 'Endpoint export', description: 'Entrega la salida CSV operativa del canal.', value: wizardImplementationSnippets.googleSheetsExport, copyLabel: 'Copiar endpoint' },
      )
      return cards
    }

    cards.push(
      {
        id: 'wizard-endpoint',
        title: 'Endpoint del canal',
        description: 'Destino principal para la aplicación o middleware elegido.',
        value: getEndpoint(wizardImplementationBaseUrl, wizardImplementationChannel),
        copyLabel: 'Copiar endpoint',
      },
      {
        id: 'wizard-token',
        title: 'Token de referencia',
        description: 'Útil para pruebas, payloads de demo y verificación.',
        value: createForm.testingToken || '<TOKEN>',
        copyLabel: 'Copiar token',
        disabled: !Boolean(createForm.testingToken.trim()),
      },
    )

    if (createForm.provider === 'WEB_FORM') {
      cards.push({ id: 'wizard-webhook-payload', title: 'Payload de referencia', description: 'Contrato base para puentes HTTP y automatizaciones.', value: wizardImplementationSnippets.webhook, copyLabel: 'Copiar payload' })
    }

    return cards
  }, [createForm, createIsPublicWebForm, wizardImplementationBaseUrl, wizardImplementationChannel, wizardImplementationSnippets])

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
          caption: language === 'en' ? `${formatCompactNumber(totalCaptures, language)} leads already entered the CRM` : `${formatCompactNumber(totalCaptures, language)} leads ya entraron al CRM`,
          icon: TrendingUp,
          accent: 'from-emerald-500 to-lime-400',
        },
        {
          label: 'Conversaciones trazadas',
          value: totalConversations,
          target: conversationGoal,
          progress: Math.min(100, Math.round((totalConversations / conversationGoal) * 100)),
          caption: language === 'en' ? `${formatCompactNumber(totalConversations, language)} linked sales threads` : `${formatCompactNumber(totalConversations, language)} hilos comerciales vinculados`,
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
  const selectedIsBookingBridge = selectedBridgeKind === 'BOOKING'
  const selectedGoogleSheetsCsvUrl = getGoogleSheetsCsvUrl(selectedSettings)
  const selectedChatbotEmbedUrl = selectedChannel?.provider === 'WEB_CHATBOT' ? buildChatbotEmbedUrl(baseUrl, selectedChannel.id) : ''
  const selectedWebFormEmbedUrl = selectedChannel?.provider === 'WEB_FORM' && (selectedBridgeKind === 'GENERIC' || selectedBridgeKind === 'BOOKING')
    ? (selectedBridgeKind === 'BOOKING' ? buildBookingEmbedUrl(baseUrl, selectedChannel.id) : buildWebFormEmbedUrl(baseUrl, selectedChannel.id))
    : ''
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
  const selectedIsPublicWebForm = selectedChannel?.provider === 'WEB_FORM' && (selectedBridgeKind === 'GENERIC' || selectedBridgeKind === 'BOOKING')
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
    const nextBuilderState = getChatbotBuilderState(selectedSettings)
    setChatbotBuilderDraft(nextBuilderState)
    setChatbotBuilderPreviewMode(getInitialChatbotPreviewMode(nextBuilderState))
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

  const snippets = useMemo<IntegrationSnippets | null>(() => {
    if (!selectedChannel || !baseUrl) return null

    return buildIntegrationSnippets({
      baseUrl,
      channelId: selectedChannel.id,
      provider: selectedChannel.provider,
      bridgeKind: selectedBridgeKind,
      settingsJson: selectedSettings,
      token: selectedToken || '<TOKEN>',
    })
  }, [baseUrl, selectedBridgeKind, selectedChannel, selectedSettings, selectedToken])

  const selectedIntegrationGuide = useMemo(() => {
    if (!selectedChannel) return null
    return getDetailedIntegrationGuide({
      channel: selectedChannel,
      bridgeKind: selectedBridgeKind,
      endpoint,
      token: selectedToken,
      language,
      snippets,
    })
  }, [endpoint, language, selectedBridgeKind, selectedChannel, selectedToken, snippets])

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
      publicEmbedEnabled: preset.provider === 'WEB_CHATBOT' || (preset.provider === 'WEB_FORM' && (!preset.bridgeKind || preset.bridgeKind === 'BOOKING')),
    }))
    setWizardStep('config')
  }

  function openCreateWizard() {
    setEditingChannelId(null)
    const nextForm = getInitialChannelForm()
    setCreateForm(nextForm)
    setWizardMetaAdvancedOpen(false)
    setWizardChatPreviewMode(getInitialChatbotPreviewMode(nextForm))
    setWizardChatPreviewViewport('desktop')
    setWizardChatbotSection('base')
    setWizardWebFormSection('base')
    setWizardStep('template')
    setCreateOpen(true)
  }

  function openEditWizard(channel: ChannelConnection, options?: { forceWizard?: boolean }) {
    if (channel.provider === 'WEB_CHATBOT' && !options?.forceWizard) {
      router.push(`/dashboard/crm/chatbot?channelId=${encodeURIComponent(channel.id)}`)
      return
    }

    const settings = (channel.settingsJson as Record<string, unknown> | null | undefined) ?? null
    const bridgeKind = getBridgeKind(settings) as CrmBridgeKind
    const templateMatch = TEMPLATE_PRESETS.find((preset) => preset.provider === channel.provider && (preset.bridgeKind ?? 'GENERIC') === (bridgeKind || 'GENERIC'))

    setEditingChannelId(channel.id)
  setWizardMetaAdvancedOpen(Boolean(channel.externalAccountId || channel.externalPageId || channel.externalPhoneNumberId || getWhatsAppAccessToken(settings) || getWhatsAppApiVersion(settings) !== 'v23.0'))
    const nextForm: ChannelFormState = {
      ...getInitialChannelForm(),
      templateKey: templateMatch?.key ?? 'web-form',
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
      bookingNotifyByEmail: getBookingNotifyByEmail(settings),
      bookingNotifyByWhatsApp: getBookingNotifyByWhatsApp(settings),
      outgoingWebhookUrl: getOutgoingWebhookUrl(settings),
      externalAccountId: channel.externalAccountId || '',
      externalPageId: channel.externalPageId || '',
      externalPhoneNumberId: channel.externalPhoneNumberId || '',
      whatsappConnectionMode: getWhatsAppConnectionMode(settings),
      whatsappDisplayPhoneNumber: getWhatsAppDisplayPhoneNumber(settings),
      whatsappAccessToken: getWhatsAppAccessToken(settings),
      whatsappApiVersion: getWhatsAppApiVersion(settings),
      outboundLimitPerChannelDay: getOperationalLimitValue(settings, 'outboundLimitPerChannelDay'),
      outboundLimitPerChannelMonth: getOperationalLimitValue(settings, 'outboundLimitPerChannelMonth'),
      outboundLimitPerEmpresaDay: getOperationalLimitValue(settings, 'outboundLimitPerEmpresaDay'),
      outboundLimitPerEmpresaMonth: getOperationalLimitValue(settings, 'outboundLimitPerEmpresaMonth'),
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
      launcherPlacement: getLauncherPlacement(settings),
      launcherSize: getLauncherSize(settings),
      launcherStartsCollapsed: getLauncherStartsCollapsed(settings),
      launcherOffsetX: getLauncherOffsetX(settings),
      launcherOffsetY: getLauncherOffsetY(settings),
      launcherZIndex: getLauncherZIndex(settings),
      panelZIndex: getPanelZIndex(settings),
      backdropZIndex: getBackdropZIndex(settings),
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
    }
    setCreateForm(nextForm)
    setWizardChatPreviewMode(getInitialChatbotPreviewMode(nextForm))
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

    if (requiresMetaOAuthBeforeActive(createForm)) {
      alert('WhatsApp Cloud debe crearse en TESTING. Pásalo a ACTIVE solo después de Conectar con Meta y aplicar el número sincronizado del cliente.')
      return
    }

    setSaving(true)
    try {
      const settingsJsonBase = {
        testingToken: createForm.testingToken,
        bridgeKind: createForm.bridgeKind,
        googleSheetsSpreadsheetId: createForm.googleSheetsSpreadsheetId,
        googleSheetsSheetName: createForm.googleSheetsSheetName,
        googleSheetsPublishedCsvUrl: createForm.googleSheetsPublishedCsvUrl,
        googleSheetsRowLimit: createForm.googleSheetsRowLimit,
        googleSheetsImportMode: createForm.googleSheetsImportMode,
        googleSheetsOpportunityStage: createForm.googleSheetsOpportunityStage,
        whatsappConnectionMode: createForm.whatsappConnectionMode,
        whatsappDisplayPhoneNumber: createForm.whatsappDisplayPhoneNumber,
        whatsappAccessToken: createForm.whatsappAccessToken,
        whatsappApiVersion: createForm.whatsappApiVersion,
        outboundLimitPerChannelDay: createForm.outboundLimitPerChannelDay.replace(/[^0-9]/g, ''),
        outboundLimitPerChannelMonth: createForm.outboundLimitPerChannelMonth.replace(/[^0-9]/g, ''),
        outboundLimitPerEmpresaDay: createForm.outboundLimitPerEmpresaDay.replace(/[^0-9]/g, ''),
        outboundLimitPerEmpresaMonth: createForm.outboundLimitPerEmpresaMonth.replace(/[^0-9]/g, ''),
        formSelector: createForm.formSelector,
        chatbotTitle: createForm.chatbotTitle,
        chatbotPrompt: createForm.chatbotPrompt,
        assistantName: createForm.assistantName,
        chatResetConversationAfterHours: undefined,
        chatResetConversationAfterValue: createForm.chatResetConversationAfterValue,
        chatResetConversationAfterUnit: createForm.chatResetConversationAfterUnit,
        chatResetConversationAfterAction: createForm.chatResetConversationAfterAction,
        preChatFormInactivityRule: {
          enabled: createForm.preChatFormInactivityEnabled,
          timeoutValue: Math.max(1, Number(createForm.preChatFormInactivityValue) || 1),
          timeoutUnit: createForm.preChatFormInactivityUnit,
          action: createForm.preChatFormInactivityAction,
        },
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
        launcherPlacement: createForm.launcherPlacement,
        launcherSize: createForm.launcherSize,
        launcherStartsCollapsed: createForm.launcherStartsCollapsed,
        launcherOffsetX: normalizePixelValue(createForm.launcherOffsetX, '60'),
        launcherOffsetY: normalizePixelValue(createForm.launcherOffsetY, '60'),
        launcherZIndex: normalizeZIndexValue(createForm.launcherZIndex, '2147483647'),
        panelZIndex: normalizeZIndexValue(createForm.panelZIndex, '2147483646'),
        backdropZIndex: normalizeZIndexValue(createForm.backdropZIndex, '2147483645'),
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
      const settingsJson = createForm.provider === 'WEB_CHATBOT'
        ? mergeChatbotDefaultFlowSettings({
            settingsJson: settingsJsonBase,
            quickActions: createForm.quickActions,
            flowStages: createForm.flowStages,
          })
        : settingsJsonBase

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
      setWizardStep('template')
      setWizardChatPreviewMode(getInitialChatbotPreviewMode(getInitialChannelForm()))
      setWizardChatPreviewViewport('desktop')
      setActiveAssetTab(json.data.provider === 'WEB_CHATBOT' ? 'chatbot' : json.data.provider === 'WEB_FORM' ? 'form' : 'overview')
      setCreateForm(getInitialChannelForm())
      await loadChannels()
      setSelectedChannelId(json.data.id)
      if (json.data.provider === 'WEB_CHATBOT') {
        router.push(`/dashboard/crm/chatbot?channelId=${encodeURIComponent(json.data.id)}`)
      }
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
          templateKey: null,
          nextField: 'none',
          endChatbotSession: false,
          quickActionIds: [],
          responseOptions: [],
          inactivityRule: getDefaultChatbotFlowStages()[0]?.inactivityRule ?? { enabled: false, timeoutValue: 12, timeoutUnit: 'hours', timeoutMinutes: 720, action: 'restart' },
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
          templateKey: null,
          nextField: 'none',
          endChatbotSession: false,
          quickActionIds: [],
          responseOptions: [],
          inactivityRule: getDefaultChatbotFlowStages()[0]?.inactivityRule ?? { enabled: false, timeoutValue: 12, timeoutUnit: 'hours', timeoutMinutes: 720, action: 'restart' },
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
              targetActionId: '',
              targetTriggerId: '',
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
                  {createForm.bridgeKind === 'BOOKING' ? (
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Confirmaciones al usuario</Label>
                      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                        <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                          <span>Enviar correo al agendar</span>
                          <Switch checked={createForm.bookingNotifyByEmail} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, bookingNotifyByEmail: checked }))} />
                        </label>
                        <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                          <span>Enviar WhatsApp al agendar</span>
                          <Switch checked={createForm.bookingNotifyByWhatsApp} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, bookingNotifyByWhatsApp: checked }))} />
                        </label>
                      </div>
                      <p className="text-xs leading-5 text-slate-500">Estas opciones disparan confirmación al usuario cuando la cita entra por el iframe o por el API.</p>
                    </div>
                  ) : null}
                  {isOutgoingWebhookBridge(createForm.bridgeKind) ? (
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Webhook saliente</Label>
                      <Input value={createForm.outgoingWebhookUrl} onChange={(e) => setCreateForm((prev) => ({ ...prev, outgoingWebhookUrl: e.target.value }))} className="h-11 rounded-xl bg-white" placeholder={createForm.bridgeKind === 'SLACK' ? 'https://hooks.slack.com/services/...' : createForm.bridgeKind === 'TEAMS' ? 'https://...webhook.office.com/...' : 'https://tu-automatizacion.com/webhooks/calendar'} />
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
            <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Abrir panel al cargar</p>
                <p className="text-xs text-slate-500">Si se desactiva, el widget inicia colapsado y muestra solo el launcher.</p>
              </div>
              <Switch checked={!createForm.launcherStartsCollapsed} onCheckedChange={(checked) => setCreateForm((prev) => ({ ...prev, launcherStartsCollapsed: !checked }))} disabled={!createForm.floatingLauncherEnabled} />
            </div>
            <div className="grid gap-2"><Label>Texto del launcher flotante</Label><Input value={createForm.launcherLabel} onChange={(e) => setCreateForm((prev) => ({ ...prev, launcherLabel: e.target.value }))} className="h-11 rounded-xl" placeholder="Abrir asesor virtual" /></div>
            <div className="grid gap-2"><Label>Icono del launcher</Label><Select value={createForm.launcherIcon} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, launcherIcon: value }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bot">bot</SelectItem><SelectItem value="message-circle">message-circle</SelectItem><SelectItem value="sparkles">sparkles</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Alineación horizontal</Label><Select value={createForm.launcherPosition} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, launcherPosition: value as LauncherPosition }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="right">Derecha</SelectItem><SelectItem value="center">Centro</SelectItem><SelectItem value="left">Izquierda</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Tipo de posición</Label><Select value={createForm.launcherPlacement} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, launcherPlacement: value as LauncherPlacement }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="absolute">Absolute</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Tamaño del launcher</Label><Select value={createForm.launcherSize} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, launcherSize: value as LauncherSize }))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Compacto</SelectItem><SelectItem value="standard">Estándar</SelectItem><SelectItem value="large">Grande</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Offset horizontal</Label><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"><Input value={createForm.launcherOffsetX} onChange={(e) => setCreateForm((prev) => ({ ...prev, launcherOffsetX: normalizePixelValue(e.target.value, '60') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="60" /><span className="text-xs font-medium text-slate-500">px</span></div></div>
            <div className="grid gap-2"><Label>Offset vertical</Label><div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"><Input value={createForm.launcherOffsetY} onChange={(e) => setCreateForm((prev) => ({ ...prev, launcherOffsetY: normalizePixelValue(e.target.value, '60') }))} className="h-10 rounded-xl border-0 px-0 shadow-none focus-visible:ring-0" placeholder="60" /><span className="text-xs font-medium text-slate-500">px</span></div></div>
            <div className="grid gap-2"><Label>Z-index overlay</Label><Input value={createForm.backdropZIndex} onChange={(e) => setCreateForm((prev) => ({ ...prev, backdropZIndex: normalizeZIndexValue(e.target.value, '2147483645') }))} className="h-11 rounded-xl" placeholder="2147483645" /></div>
            <div className="grid gap-2"><Label>Z-index panel</Label><Input value={createForm.panelZIndex} onChange={(e) => setCreateForm((prev) => ({ ...prev, panelZIndex: normalizeZIndexValue(e.target.value, '2147483646') }))} className="h-11 rounded-xl" placeholder="2147483646" /></div>
            <div className="grid gap-2"><Label>Z-index launcher</Label><Input value={createForm.launcherZIndex} onChange={(e) => setCreateForm((prev) => ({ ...prev, launcherZIndex: normalizeZIndexValue(e.target.value, '2147483647') }))} className="h-11 rounded-xl" placeholder="2147483647" /></div>
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
      const mergedSettingsBase = {
        ...(selectedSettings ?? {}),
        ...chatbotBuilderDraft,
        chatResetConversationAfterHours: undefined,
        chatResetConversationAfterAction: chatbotBuilderDraft.chatResetConversationAfterAction,
        preChatFormInactivityRule: {
          enabled: chatbotBuilderDraft.preChatFormInactivityEnabled,
          timeoutValue: Math.max(1, Number(chatbotBuilderDraft.preChatFormInactivityValue) || 1),
          timeoutUnit: chatbotBuilderDraft.preChatFormInactivityUnit,
          action: chatbotBuilderDraft.preChatFormInactivityAction,
        },
        iframeHeight: normalizePixelValue(chatbotBuilderDraft.iframeHeight, '720'),
        chatShellRadius: normalizePixelValue(chatbotBuilderDraft.chatShellRadius, '30'),
        messageBubbleRadius: normalizePixelValue(chatbotBuilderDraft.messageBubbleRadius, '22'),
        launcherOffsetX: normalizePixelValue(chatbotBuilderDraft.launcherOffsetX, '60'),
        launcherOffsetY: normalizePixelValue(chatbotBuilderDraft.launcherOffsetY, '60'),
        launcherZIndex: normalizeZIndexValue(chatbotBuilderDraft.launcherZIndex, '2147483647'),
        panelZIndex: normalizeZIndexValue(chatbotBuilderDraft.panelZIndex, '2147483646'),
        backdropZIndex: normalizeZIndexValue(chatbotBuilderDraft.backdropZIndex, '2147483645'),
        chatbotCustomCss: buildFriendlyChatbotCustomCss({
          chatShellRadius: chatbotBuilderDraft.chatShellRadius,
          messageBubbleRadius: chatbotBuilderDraft.messageBubbleRadius,
          panelShadowPreset: chatbotBuilderDraft.panelShadowPreset,
        }),
      }
      const mergedSettings = mergeChatbotDefaultFlowSettings({
        settingsJson: mergedSettingsBase,
        quickActions: chatbotBuilderDraft.quickActions,
        flowStages: chatbotBuilderDraft.flowStages,
      })

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
          ? `${baseUrl || 'https://tu-dominio.com'}${createForm.bridgeKind === 'BOOKING' ? '/api/crm/captures/booking' : createIsBridge ? '/api/crm/captures/bridge' : '/api/crm/captures/web-form'}`
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
      iframeUrl: createForm.provider === 'WEB_CHATBOT'
        ? `${baseUrl || 'https://tu-dominio.com'}/chatbot/<canal-generado>`
        : createIsPublicWebForm
          ? `${baseUrl || 'https://tu-dominio.com'}${createForm.bridgeKind === 'BOOKING' ? '/booking/<canal-generado>' : '/form/<canal-generado>'}`
          : '',
    }
  }, [baseUrl, createForm, createIsPublicWebForm, createUsesWebhook])

  const selectedAssetTabs = useMemo(() => {
    if (!selectedChannel) return ['overview']
    const bridgeKind = selectedBridgeKind
    if (selectedChannel.provider === 'WEB_CHATBOT') return ['overview', 'guide']
    if (selectedChannel.provider === 'WEB_FORM' && bridgeKind === 'GOOGLE_SHEETS') {
      return ['overview', 'guide', 'bridge']
    }
    if (selectedChannel.provider === 'WEB_FORM' && isOutgoingWebhookBridge(bridgeKind)) {
      return ['overview', 'guide']
    }
    if (selectedChannel.provider === 'WEB_FORM' && (bridgeKind === 'GMAIL' || bridgeKind === 'OUTLOOK' || bridgeKind === 'META_LEAD_ADS' || bridgeKind === 'EXTERNAL_FORM' || bridgeKind === 'TIKTOK' || bridgeKind === 'YOUTUBE')) {
      return ['overview', 'guide', 'bridge', 'form']
    }
    if (selectedChannel.provider === 'WEB_FORM') return ['overview', 'guide', 'form', 'bridge']
    return ['overview', 'guide', 'webhook', 'bridge']
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
          { label: language === 'en' ? 'Integrations' : 'Integraciones' },
        ]}
        eyebrow={language === 'en' ? 'Omnichannel CRM' : 'CRM Omnicanal'}
        title={language === 'en' ? 'Integrations and lead capture center' : 'Centro de integraciones y captura de leads'}
        description={language === 'en' ? 'Activate channels, generate scripts for forms and chatbot, and set up operational bridges for email and social networks without duplicating ERP modules. Everything lands in leads, conversations, and opportunities in the existing CRM.' : 'Activa canales, genera scripts para formularios y chatbot, y monta bridges operativos para correo y redes sin duplicar módulos del ERP. Todo termina en leads, conversaciones y oportunidades del CRM existente.'}
        actions={
          <>
            <Button variant="outline" className="rounded-2xl border-slate-200 bg-white/85" onClick={() => void loadChannels()}>
              {language === 'en' ? 'Refresh' : 'Refrescar'}
            </Button>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/85">
              <Link href="/dashboard/crm/conversations">{language === 'en' ? 'Open omnichannel inbox' : 'Abrir bandeja omnicanal'}</Link>
            </Button>
            <Button className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={openCreateWizard}>
              {language === 'en' ? 'New channel' : 'Nuevo canal'}
            </Button>
          </>
        }
        stats={[
          { label: language === 'en' ? 'Active channels' : 'Canales activos', value: stats.active, hint: language === 'en' ? 'Production ready to receive leads' : 'Producción lista para recibir leads', tone: 'teal' },
          { label: language === 'en' ? 'Channels in testing' : 'Canales en pruebas', value: stats.testing, hint: language === 'en' ? 'Sandbox, testing, and controlled demo' : 'Sandbox, testing y demo controlada', tone: 'amber' },
          { label: language === 'en' ? 'Registered captures' : 'Capturas registradas', value: stats.captures, hint: language === 'en' ? 'Leads created from integrations' : 'Leads creados desde integraciones', tone: 'sky' },
          { label: language === 'en' ? 'Linked conversations' : 'Conversaciones vinculadas', value: stats.conversations, hint: language === 'en' ? 'Threads created in the CRM inbox' : 'Hilos generados en el inbox CRM', tone: 'neutral' },
        ]}
      />

      <Tabs value={workspaceView} onValueChange={(value) => setWorkspaceView(value as CrmWorkspaceView)} className="space-y-4">
        <div className="flex flex-col gap-2.5 rounded-[24px] border border-slate-200 bg-white/90 p-2.5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.28)] md:flex-row md:items-center md:justify-between">
          <TabsList className="grid h-auto grid-cols-2 rounded-[18px] border border-slate-200 bg-slate-50 p-1">
            <TabsTrigger value="operations" className="rounded-[14px] px-4 py-2 data-[state=active]:bg-white">{language === 'en' ? 'Operations' : 'Operación'}</TabsTrigger>
            <TabsTrigger value="metrics" className="rounded-[14px] px-4 py-2 data-[state=active]:bg-white">{language === 'en' ? 'Metrics and goals' : 'Métricas y metas'}</TabsTrigger>
          </TabsList>
          {workspaceView === 'metrics' ? (
            <p className="px-2 text-[13px] text-slate-500">
              {language === 'en' ? 'Executive panel to review performance and define commercial goals by channel.' : 'Panel ejecutivo para revisar rendimiento y definir objetivos comerciales por canal.'}
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
                    {language === 'en' ? 'Omnichannel intelligence' : 'Inteligencia omnicanal'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{language === 'en' ? 'Metrics, goals, and trends' : 'Métricas, metas y tendencias'}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                      {language === 'en' ? 'This area concentrates the executive dashboard. It is kept separate so daily operations stay lighter and analysis opens only when you need it.' : 'Este espacio concentra el tablero ejecutivo. Lo dejamos aparte para que la operación diaria siga ligera y aquí puedas abrir el análisis sólo cuando lo necesites.'}
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="rounded-2xl border-slate-200 bg-white/85" onClick={() => setMetricsExpanded((current) => !current)}>
                  {metricsExpanded ? (language === 'en' ? 'Collapse dashboard' : 'Colapsar dashboard') : (language === 'en' ? 'Expand dashboard' : 'Expandir dashboard')}
                </Button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{language === 'en' ? 'Activation' : 'Activación'}</span>
                    <Target className="h-4 w-4 text-sky-500" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.activationRate}%</p>
                  <p className="mt-1 text-sm text-slate-600">{language === 'en' ? 'Active or testing channels over the total.' : 'Canales activos o en testing sobre el total.'}</p>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{language === 'en' ? 'Production' : 'Producción'}</span>
                    <Goal className="h-4 w-4 text-emerald-500" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.productionRate}%</p>
                  <p className="mt-1 text-sm text-slate-600">{language === 'en' ? 'Channels ready for real operation.' : 'Canales listos para salir a operación real.'}</p>
                </div>
                <div className="rounded-[22px] border border-cyan-200 bg-[linear-gradient(135deg,#0f172a,#0b4a6f)] p-4 text-white shadow-[0_24px_50px_-34px_rgba(15,23,42,0.7)]">
                  <div className="flex items-center justify-between text-cyan-100">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Momentum</span>
                    <TrendingUp className="h-4 w-4 text-cyan-300" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold">{formatCompactNumber(stats.captures + stats.conversations, language)}</p>
                  <p className="mt-1 text-sm text-cyan-50/90">{language === 'en' ? 'Total interactions traced from integrations.' : 'Interacciones totales trazadas desde integraciones.'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card className="rounded-[30px] border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] text-slate-950 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.22)]">
              <CardHeader className="pb-4">
                <CardTitle className="text-slate-950">{language === 'en' ? 'Configurable goals' : 'Metas configurables'}</CardTitle>
                <CardDescription className="text-slate-600">{language === 'en' ? 'You can override the suggested targets and progress recalculates instantly.' : 'Puedes sobreescribir los objetivos sugeridos y el progreso se recalcula al instante.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium text-slate-700">{language === 'en' ? 'Operational channels target' : 'Meta de canales operativos'}</Label>
                    <Input value={goalTargets.operational} onChange={(event) => setGoalTargets((current) => ({ ...current, operational: event.target.value.replace(/[^0-9]/g, '') }))} placeholder={String(channelAnalytics.defaultTargets.operational)} className="rounded-2xl border-slate-300 bg-white text-slate-950 placeholder:text-slate-500" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium text-slate-700">{language === 'en' ? 'Captures target' : 'Meta de capturas'}</Label>
                    <Input value={goalTargets.captures} onChange={(event) => setGoalTargets((current) => ({ ...current, captures: event.target.value.replace(/[^0-9]/g, '') }))} placeholder={String(channelAnalytics.defaultTargets.captures)} className="rounded-2xl border-slate-300 bg-white text-slate-950 placeholder:text-slate-500" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium text-slate-700">{language === 'en' ? 'Conversations target' : 'Meta de conversaciones'}</Label>
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
                            <p className="text-2xl font-semibold text-slate-950">{formatCompactNumber(goal.value, language)}</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{language === 'en' ? 'Target' : 'Meta'} {formatCompactNumber(goal.target, language)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-semibold text-slate-950">{goal.progress}%</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{language === 'en' ? 'Reached' : 'Cumplido'}</p>
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
                          <CardTitle>{language === 'en' ? 'Channels with highest impact' : 'Canales con mayor impacto'}</CardTitle>
                          <CardDescription>{language === 'en' ? 'Comparison of captures and conversations by channel in the commercial layer.' : 'Comparativo de capturas y conversaciones por canal en la capa comercial.'}</CardDescription>
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
                                        <p>{language === 'en' ? 'Captures:' : 'Capturas:'} <span className="font-semibold text-slate-950">{item.captures}</span></p>
                                        <p>{language === 'en' ? 'Conversations:' : 'Conversaciones:'} <span className="font-semibold text-slate-950">{item.conversations}</span></p>
                                      </div>
                                    </div>
                                  )
                                }}
                              />
                              <Bar dataKey="captures" name={language === 'en' ? 'Captures' : 'Capturas'} radius={[10, 10, 0, 0]} fill="#0ea5e9" />
                              <Bar dataKey="conversations" name={language === 'en' ? 'Conversations' : 'Conversaciones'} radius={[10, 10, 0, 0]} fill="#0f172a" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {channelAnalytics.performance.length === 0 ? (
                          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                            {language === 'en' ? 'Create channels to start seeing real-time performance comparisons.' : 'Crea canales para empezar a ver comparativos de rendimiento en tiempo real.'}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>

                    <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
                      <CardHeader className="border-b border-slate-100 pb-5">
                        <CardTitle>{language === 'en' ? 'Channel mix' : 'Mix de canales'}</CardTitle>
                        <CardDescription>{language === 'en' ? 'Distribution by source to detect concentration and diversification of the stack.' : 'Distribución por origen para detectar concentración y diversificación del stack.'}</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 p-4 md:p-6">
                        <div className="h-[260px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={channelAnalytics.distribution.length > 0 ? channelAnalytics.distribution : [{ label: language === 'en' ? 'No channels' : 'Sin canales', value: 1, color: '#cbd5e1' }]}
                                dataKey="value"
                                nameKey="label"
                                innerRadius={62}
                                outerRadius={92}
                                paddingAngle={4}
                                stroke="none"
                              >
                                {(channelAnalytics.distribution.length > 0 ? channelAnalytics.distribution : [{ label: language === 'en' ? 'No channels' : 'Sin canales', value: 1, color: '#cbd5e1' }]).map((entry) => (
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
                                      <p className="text-sm text-slate-600">{item.value} {language === 'en' ? 'channel(s)' : 'canal(es)'}</p>
                                    </div>
                                  )
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-3">
                          {(channelAnalytics.distribution.length > 0 ? channelAnalytics.distribution : [{ label: language === 'en' ? 'No channels' : 'Sin canales', value: 0, color: '#cbd5e1' }]).map((entry) => (
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
                        <CardTitle>{language === 'en' ? 'Monthly activity pace' : 'Ritmo de actividad por mes'}</CardTitle>
                        <CardDescription>{language === 'en' ? 'Timeline based on the latest activity or update of each channel.' : 'Lectura temporal con base en última actividad o actualización de cada canal.'}</CardDescription>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {language === 'en' ? 'Last 6 months' : 'Últimos 6 meses'}
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
                                      <p>{language === 'en' ? 'Captures:' : 'Capturas:'} <span className="font-semibold text-slate-950">{captures}</span></p>
                                      <p>{language === 'en' ? 'Conversations:' : 'Conversaciones:'} <span className="font-semibold text-slate-950">{conversations}</span></p>
                                      <p>{language === 'en' ? 'Channels with activity:' : 'Canales con actividad:'} <span className="font-semibold text-slate-950">{channelsInMonth}</span></p>
                                    </div>
                                  </div>
                                )
                              }}
                            />
                            <Line type="monotone" dataKey="captures" name={language === 'en' ? 'Captures' : 'Capturas'} stroke="url(#crmCapturesGradient)" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9' }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="conversations" name={language === 'en' ? 'Conversations' : 'Conversaciones'} stroke="url(#crmConversationsGradient)" strokeWidth={3} dot={{ r: 4, fill: '#f97316' }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
                  <CardHeader>
                    <CardTitle className="text-slate-950">{language === 'en' ? 'Collapsed dashboard' : 'Dashboard colapsado'}</CardTitle>
                    <CardDescription className="text-slate-600">{language === 'en' ? 'Expand it when you want to review charts, trends, and distribution by channel.' : 'Expándelo cuando quieras revisar gráficos, tendencias y distribución por canal.'}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">{language === 'en' ? 'Configured' : 'Configurados'}</p>
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
            <CardTitle>{language === 'en' ? 'Configured channels' : 'Canales configurados'}</CardTitle>
            <CardDescription>{language === 'en' ? 'Select a channel to view assets, webhooks, and bridges ready to copy.' : 'Selecciona un canal para ver assets, webhooks y bridges listos para copiar.'}</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[72vh] space-y-2.5 overflow-y-auto p-3 md:p-4 xl:max-h-[calc(100vh-19rem)]">
            {loading ? <p className="text-sm text-muted-foreground">{language === 'en' ? 'Loading channels...' : 'Cargando canales...'}</p> : null}
            {!loading && channels.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-500">
                {language === 'en' ? 'There are no channels yet. Create one from a template and the CRM will be ready for an immediate demo.' : 'Aún no hay canales. Crea uno desde plantilla y el CRM quedará listo para demo inmediata.'}
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
                      <span>{language === 'en' ? 'Captures' : 'Capturas'}</span>
                      <span className="font-semibold text-slate-900">{channel._count?.captures ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{language === 'en' ? 'Conversations' : 'Conversaciones'}</span>
                      <span className="font-semibold text-slate-900">{channel._count?.conversations ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{language === 'en' ? 'Last webhook' : 'Último webhook'}</span>
                      <span className="font-medium text-slate-900">{formatDate(channel.lastWebhookAt, language)}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="grid gap-1.5">
                      <Label className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Status' : 'Estado'}</Label>
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
                      {copiedKey === `endpoint-${channel.id}` ? (language === 'en' ? 'Copied' : 'Copiado') : (language === 'en' ? 'Copy endpoint' : 'Copiar endpoint')}
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
                    <CardTitle>{operationsPanelView === 'preview' ? (language === 'en' ? 'Channel preview' : 'Vista previa del canal') : (language === 'en' ? 'Readiness checklist' : 'Checklist de readiness')}</CardTitle>
                    <CardDescription>
                      {operationsPanelView === 'preview'
                        ? (language === 'en' ? 'Executive summary and quick actions for the selected channel.' : 'Resumen ejecutivo y accesos rápidos del canal seleccionado.')
                        : (language === 'en' ? 'Operational review to validate whether the channel is ready for demo or production.' : 'Revisión operativa para validar si el canal ya está listo para demo o producción.')}
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
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Captures' : 'Capturas'}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{selectedChannel._count?.captures ?? 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/85 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Conversations' : 'Conversaciones'}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{selectedChannel._count?.conversations ?? 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/85 p-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Last webhook' : 'Último webhook'}</p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">{formatDate(selectedChannel.lastWebhookAt, language)}</p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white/85 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{language === 'en' ? 'Channel management' : 'Gestión del canal'}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{language === 'en' ? 'Main actions remain visible here and inside the setup wizard.' : 'Las acciones principales quedan visibles aquí y también dentro del wizard de configuración.'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {selectedChannel.provider === 'WEB_CHATBOT' ? (
                            <>
                              <Button variant="outline" className="rounded-xl border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100" onClick={() => openEditWizard(selectedChannel, { forceWizard: true })}>
                                {language === 'en' ? 'Edit channel setup' : 'Editar configuración'}
                              </Button>
                              <Button asChild variant="outline" className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100">
                                <Link href={`/dashboard/crm/chatbot?channelId=${selectedChannel.id}`}>{language === 'en' ? 'Open Chatbot Studio' : 'Abrir Chatbot Studio'}</Link>
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" className="rounded-xl" onClick={() => openEditWizard(selectedChannel)}>
                              {language === 'en' ? 'Edit channel' : 'Editar canal'}
                            </Button>
                          )}
                          <Button variant="outline" className="rounded-xl" onClick={() => void copyText('selected-endpoint-top', endpoint)}>
                            {copiedKey === 'selected-endpoint-top' ? (language === 'en' ? 'Copied' : 'Copiado') : (language === 'en' ? 'Copy endpoint' : 'Copiar endpoint')}
                          </Button>
                          {selectedChannel.provider === 'WEB_CHATBOT' ? <Button asChild variant="outline" className="rounded-xl"><Link href={`/dashboard/crm/chatbot?channelId=${selectedChannel.id}`}>{language === 'en' ? 'View Studio' : 'Ver Studio'}</Link></Button> : null}
                          {selectedChannel.provider === 'WEB_CHATBOT' && selectedChatbotEmbedUrl ? <Button asChild variant="outline" className="rounded-xl"><Link href={selectedChatbotEmbedUrl}>{language === 'en' ? 'View iframe' : 'Ver iframe'}</Link></Button> : null}
                          <Button variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setDeleteCandidate(selectedChannel)} disabled={deletingChannelId === selectedChannel.id}>
                            {deletingChannelId === selectedChannel.id ? (language === 'en' ? 'Deleting...' : 'Eliminando...') : (language === 'en' ? 'Delete channel' : 'Eliminar canal')}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {selectedChannel.provider === 'WEB_CHATBOT' && selectedChatbotEmbedUrl ? (
                      <div className="mt-5 rounded-2xl border border-emerald-200 bg-white/85 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{language === 'en' ? 'Real chatbot preview' : 'Preview del chatbot real'}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{language === 'en' ? 'This preview shows the real iframe and, separately, the launcher settings used by the floating widget. In pure iframe mode the launcher does not render.' : 'Este preview muestra el iframe real y, por separado, la configuración del launcher usada por el widget flotante. En modo iframe puro el launcher no se renderiza.'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button asChild className="rounded-xl">
                              <Link href={`/dashboard/crm/chatbot?channelId=${selectedChannel.id}`}>{language === 'en' ? 'Open Chatbot Studio' : 'Abrir Chatbot Studio'}</Link>
                            </Button>
                            <Button className="rounded-xl" variant="outline" onClick={() => void copyText('preview-chatbot-url', selectedChatbotEmbedUrl)}>
                              {copiedKey === 'preview-chatbot-url' ? (language === 'en' ? 'Copied' : 'Copiado') : (language === 'en' ? 'Copy URL' : 'Copiar URL')}
                            </Button>
                            <Button asChild className="rounded-xl" variant="outline"><Link href={selectedChatbotEmbedUrl}>{language === 'en' ? 'Open demo' : 'Abrir demo'}</Link></Button>
                          </div>
                        </div>
                        <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                          <iframe
                            src={selectedChatbotEmbedUrl}
                            title={language === 'en' ? 'Real chatbot preview' : 'Preview real del chatbot'}
                            className="block w-full"
                            style={{ minHeight: '360px', height: `${normalizePixelValue(getIframeHeight(selectedSettings), '720')}px`, border: 0, background: getBackgroundColor(selectedSettings) }}
                            loading="lazy"
                            referrerPolicy="strict-origin-when-cross-origin"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button className="rounded-xl" variant="outline" onClick={() => void copyText('preview-chatbot-iframe', snippets?.chatbotIframe || '')}>
                            {copiedKey === 'preview-chatbot-iframe' ? (language === 'en' ? 'Copied' : 'Copiado') : (language === 'en' ? 'Copy iframe' : 'Copiar iframe')}
                          </Button>
                          <Button asChild className="rounded-xl" variant="outline"><Link href="/dashboard/crm/chatbot">{language === 'en' ? 'View chatbot panel' : 'Ver panel chatbot'}</Link></Button>
                        </div>
                      </div>
                    ) : null}

                    {selectedIsPublicWebForm && selectedWebFormEmbedUrl ? (
                      <div className="mt-5 rounded-2xl border border-sky-200 bg-white/85 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{selectedIsBookingBridge ? (language === 'en' ? 'Real booking preview' : 'Preview de la agenda real') : (language === 'en' ? 'Real web form preview' : 'Preview del formulario web real')}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{selectedIsBookingBridge ? (language === 'en' ? 'This view loads the real channel iframe to validate day and time selection exactly as the end user will see it.' : 'Esta vista carga el iframe real del canal para validar la selección de día y hora tal como la verá el usuario final.') : (language === 'en' ? 'This preview is built from the current channel configuration and reflects how the embedded iframe will look.' : 'Este preview se construye con la configuración actual del canal y refleja cómo se verá el iframe embebido.')}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button className="rounded-xl" onClick={() => setWebFormBuilderModalOpen(true)}>
                              {selectedIsBookingBridge ? (language === 'en' ? 'Edit booking flow' : 'Editar agenda') : (language === 'en' ? 'Edit builder' : 'Editar constructor')}
                            </Button>
                            <Button className="rounded-xl" variant="outline" onClick={() => void copyText('preview-web-form-url', selectedWebFormEmbedUrl)}>
                              {copiedKey === 'preview-web-form-url' ? (language === 'en' ? 'Copied' : 'Copiado') : (language === 'en' ? 'Copy URL' : 'Copiar URL')}
                            </Button>
                            <Button asChild className="rounded-xl" variant="outline"><Link href={selectedWebFormEmbedUrl}>{language === 'en' ? 'Open demo' : 'Abrir demo'}</Link></Button>
                          </div>
                        </div>
                        <div className="mt-4">
                          {selectedIsBookingBridge ? (
                            <div className="space-y-4">
                              {renderBookingPreviewLegend()}
                              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-sm">
                                <div className="border-b border-slate-200 bg-white px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                  {language === 'en' ? 'Real embedded channel demo' : 'Demo embebida real del canal'}
                                </div>
                                <iframe
                                  src={selectedWebFormEmbedUrl}
                                  title={`Preview agenda ${selectedChannel.name}`}
                                  className="h-[720px] w-full bg-white xl:h-[760px]"
                                  loading="lazy"
                                />
                              </div>
                            </div>
                          ) : renderWebFormPreview(webFormBuilderDraft)}
                        </div>
                      </div>
                    ) : null}

                    {selectedIsGoogleSheetsBridge && snippets ? (
                      <div className="mt-5 rounded-2xl border border-emerald-200 bg-white/90 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{language === 'en' ? 'Operational Google Sheets' : 'Google Sheets operativo'}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{language === 'en' ? 'Here you can validate the sheet, import rows into the CRM, and download the exported CSV without leaving the technical studio.' : 'Aquí mismo puedes validar la hoja, importar filas al CRM y descargar el CSV exportado del canal sin irte al studio técnico.'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button className="rounded-xl border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void runGoogleSheetsPreview()} disabled={googleSheetsActions.loadingPreview || googleSheetsActions.loadingImport}>
                              <Eye className="mr-2 h-4 w-4" />
                              {googleSheetsActions.loadingPreview ? (language === 'en' ? 'Testing sheet...' : 'Probando hoja...') : (language === 'en' ? 'Run preview' : 'Probar preview')}
                            </Button>
                            <Button variant="outline" className="rounded-xl border-emerald-200 text-emerald-800 hover:bg-emerald-50" onClick={() => void runGoogleSheetsImport()} disabled={googleSheetsActions.loadingImport || googleSheetsActions.loadingPreview}>
                              <Upload className="mr-2 h-4 w-4" />
                              {googleSheetsActions.loadingImport ? (language === 'en' ? 'Importing...' : 'Importando...') : (language === 'en' ? 'Import now' : 'Importar ahora')}
                            </Button>
                            <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white">
                              <Link href={snippets.googleSheetsExport}>
                                <Download className="mr-2 h-4 w-4" />
                                {language === 'en' ? 'Export CSV' : 'Exportar CSV'}
                              </Link>
                            </Button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-700">{language === 'en' ? 'Connected source' : 'Origen conectado'}</p>
                            <p className="mt-2 break-all text-sm font-semibold text-slate-950">{selectedGoogleSheetsCsvUrl || (language === 'en' ? 'Set CSV URL or spreadsheet ID' : 'Configura URL CSV o spreadsheet ID')}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Last preview' : 'Último preview'}</p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">{googleSheetsActions.previewResult?.totalRows ?? '—'}</p>
                            <p className="mt-1 text-xs text-slate-500">{language === 'en' ? 'rows detected in the sheet' : 'filas detectadas en la hoja'}</p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Last import' : 'Última importación'}</p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">{googleSheetsActions.importResult?.importedRows ?? '—'}</p>
                            <p className="mt-1 text-xs text-slate-500">{language === 'en' ? 'rows imported into the CRM' : 'filas importadas al CRM'}</p>
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
                                <p className="text-sm font-semibold text-slate-900">{language === 'en' ? 'Preview loaded' : 'Preview cargado'}</p>
                                <p className="text-xs leading-5 text-slate-500">Headers: {googleSheetsActions.previewResult.headers.join(' · ') || (language === 'en' ? 'no headers detected' : 'sin headers detectados')}</p>
                              </div>
                              <Button variant="outline" className="rounded-xl" onClick={() => void copyText('google-sheets-preview-url', snippets.googleSheetsPreview)}>
                                {copiedKey === 'google-sheets-preview-url' ? (language === 'en' ? 'Copied' : 'Copiado') : (language === 'en' ? 'Copy preview endpoint' : 'Copiar endpoint preview')}
                              </Button>
                            </div>
                            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                              <table className="min-w-full text-left text-xs text-slate-600">
                                <thead className="bg-slate-50 text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 font-semibold">{language === 'en' ? 'Row' : 'Fila'}</th>
                                    <th className="px-3 py-2 font-semibold">{language === 'en' ? 'Name' : 'Nombre'}</th>
                                    <th className="px-3 py-2 font-semibold">Email</th>
                                    <th className="px-3 py-2 font-semibold">{language === 'en' ? 'Phone' : 'Teléfono'}</th>
                                    <th className="px-3 py-2 font-semibold">{language === 'en' ? 'Product' : 'Producto'}</th>
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
                            <p className="text-sm font-semibold text-emerald-900">{language === 'en' ? 'Import executed' : 'Importación ejecutada'}</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-4">
                              <div className="rounded-2xl border border-white/80 bg-white/85 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Processed' : 'Procesadas'}</p><p className="mt-2 text-xl font-semibold text-slate-950">{googleSheetsActions.importResult.processedRows}</p></div>
                              <div className="rounded-2xl border border-white/80 bg-white/85 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Imported' : 'Importadas'}</p><p className="mt-2 text-xl font-semibold text-slate-950">{googleSheetsActions.importResult.importedRows}</p></div>
                              <div className="rounded-2xl border border-white/80 bg-white/85 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Skipped' : 'Omitidas'}</p><p className="mt-2 text-xl font-semibold text-slate-950">{googleSheetsActions.importResult.skippedRows}</p></div>
                              <div className="rounded-2xl border border-white/80 bg-white/85 p-3"><p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Opportunities' : 'Oportunidades'}</p><p className="mt-2 text-xl font-semibold text-slate-950">{googleSheetsActions.importResult.opportunitiesCreated}</p></div>
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
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{language === 'en' ? 'Readiness checklist' : 'Checklist de readiness'}</p>
                        {selectedReadiness ? (
                          <div className="mt-4 space-y-4">
                            {[
                              { title: language === 'en' ? 'Configured' : 'Configurado', items: selectedReadiness.configured },
                              { title: language === 'en' ? 'Ready for demo' : 'Listo para demo', items: selectedReadiness.demo },
                              { title: language === 'en' ? 'Ready for production' : 'Listo para producción', items: selectedReadiness.production },
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

                    {usesMetaProvider(selectedChannel.provider) ? (
                      <div className="rounded-[26px] border border-sky-200 bg-sky-50/60 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{language === 'en' ? 'Real Meta connection' : 'Conexión real con Meta'}</p>
                        <div className="mt-4 rounded-2xl border border-sky-200 bg-white/80 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{language === 'en' ? 'Guided onboarding' : 'Onboarding guiado'}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">{language === 'en' ? 'Launch the flow in a controlled window, return automatically to the panel, and finish the asset selection right here.' : 'Lanza el flujo en una ventana controlada, vuelve al panel automáticamente y termina aquí mismo la selección del activo.'}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {selectedMeta.hasConnection ? (
                                <Button type="button" variant="outline" className="rounded-xl" onClick={() => void syncMeta(selectedChannel.id)} disabled={updatingChannelId === selectedChannel.id}>
                                  {language === 'en' ? 'Sync Meta' : 'Sincronizar Meta'}
                                </Button>
                              ) : null}
                              <Button type="button" className="rounded-xl bg-[#1877f2] text-white hover:bg-[#166fe0]" onClick={() => openMetaOnboarding(selectedChannel)}>
                                <Facebook className="mr-2 h-4 w-4" />
                                {selectedMeta.hasConnection ? (language === 'en' ? 'Reconnect with Facebook' : 'Reconectar con Facebook') : (language === 'en' ? 'Continue with Facebook' : 'Continuar con Facebook')}
                              </Button>
                            </div>
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
                              {language === 'en' ? 'Hide' : 'Ocultar'}
                            </Button>
                          </div>
                        ) : null}
                        {selectedMeta.hasConnection ? (
                          <div className="mt-4 space-y-3 text-sm text-slate-700">
                            <p><span className="font-semibold text-slate-900">{language === 'en' ? 'Connected account:' : 'Cuenta conectada:'}</span> {selectedMeta.connectedUserName || (language === 'en' ? 'Meta connected' : 'Meta conectada')}</p>
                            <p><span className="font-semibold text-slate-900">{language === 'en' ? 'Connected:' : 'Conectado:'}</span> {formatDate(selectedMeta.connectedAt, language)}</p>
                            <p><span className="font-semibold text-slate-900">{language === 'en' ? 'Last sync:' : 'Última sincronización:'}</span> {formatDate(selectedMeta.lastSyncAt, language)}</p>
                            <p><span className="font-semibold text-slate-900">{language === 'en' ? 'Token expires:' : 'Expira token:'}</span> {formatDate(selectedMeta.tokenExpiresAt, language)}</p>
                            {selectedMetaGuide ? (
                              <div className={selectedMetaGuide.tone === 'amber' ? 'rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-amber-900' : 'rounded-2xl border border-emerald-200 bg-emerald-50/90 p-3 text-emerald-900'}>
                                <p className="font-semibold">{selectedMetaGuide.title}</p>
                                <p className="mt-1 text-sm leading-6">{selectedMetaGuide.description}</p>
                              </div>
                            ) : null}
                            {selectedChannel.provider === 'WHATSAPP_CLOUD' || selectedChannel.provider === 'WHATSAPP_SANDBOX' ? (
                              <div ref={metaPhoneSelectionRef} className={metaSelectionFocusTarget === 'phone' ? 'grid gap-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-3 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] transition' : 'grid gap-2 rounded-2xl border border-sky-200 bg-white/70 p-3 transition'}>
                                <Label>{language === 'en' ? 'Synced number' : 'Número sincronizado'}</Label>
                                <Select value={metaSelectionDraft.selectedPhoneNumberId || '__none__'} onValueChange={(value) => setMetaSelectionDraft((current) => ({ ...current, selectedPhoneNumberId: value === '__none__' ? '' : value }))}>
                                  <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">{language === 'en' ? 'Select a number' : 'Selecciona un número'}</SelectItem>
                                    {selectedMeta.whatsappAssets.map((item) => (
                                      <SelectItem key={item.phoneNumberId} value={item.phoneNumberId}>
                                        {item.displayPhoneNumber || item.phoneNumberId} · {item.wabaName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button className="rounded-xl" variant="outline" onClick={() => void applyMetaSelection(selectedChannel)} disabled={updatingChannelId === selectedChannel.id || !metaSelectionDraft.selectedPhoneNumberId}>
                                  {language === 'en' ? 'Apply active number' : 'Aplicar número activo'}
                                </Button>
                              </div>
                            ) : null}
                            {selectedChannel.provider === 'FACEBOOK_PAGE' || selectedChannel.provider === 'MESSENGER' ? (
                              <div ref={metaPageSelectionRef} className={metaSelectionFocusTarget === 'page' ? 'grid gap-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-3 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] transition' : 'grid gap-2 rounded-2xl border border-sky-200 bg-white/70 p-3 transition'}>
                                <Label>{language === 'en' ? 'Synced page' : 'Página sincronizada'}</Label>
                                <Select value={metaSelectionDraft.selectedPageId || '__none__'} onValueChange={(value) => setMetaSelectionDraft((current) => ({ ...current, selectedPageId: value === '__none__' ? '' : value }))}>
                                  <SelectTrigger className="h-10 rounded-xl bg-white"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">{language === 'en' ? 'Select a page' : 'Selecciona una página'}</SelectItem>
                                    {selectedMeta.pages.map((item) => (
                                      <SelectItem key={item.pageId} value={item.pageId}>{item.pageName}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button className="rounded-xl" variant="outline" onClick={() => void applyMetaSelection(selectedChannel)} disabled={updatingChannelId === selectedChannel.id || !metaSelectionDraft.selectedPageId}>
                                  {language === 'en' ? 'Apply active page' : 'Aplicar página activa'}
                                </Button>
                              </div>
                            ) : null}
                            {selectedChannel.provider === 'INSTAGRAM_DM' ? (
                              <div ref={metaInstagramSelectionRef} className={metaSelectionFocusTarget === 'instagram' ? 'grid gap-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-3 shadow-[0_0_0_4px_rgba(16,185,129,0.12)] transition' : 'grid gap-2 rounded-2xl border border-sky-200 bg-white/70 p-3 transition'}>
                                <Label>{language === 'en' ? 'Synced Instagram account' : 'Cuenta de Instagram sincronizada'}</Label>
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
                                    <SelectItem value="__none__">{language === 'en' ? 'Select an account' : 'Selecciona una cuenta'}</SelectItem>
                                    {selectedMeta.pages.filter((item) => item.instagramAccountId).map((item) => (
                                      <SelectItem key={item.instagramAccountId} value={item.instagramAccountId || item.pageId}>
                                        @{item.instagramUsername || item.instagramName || item.instagramAccountId}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button className="rounded-xl" variant="outline" onClick={() => void applyMetaSelection(selectedChannel)} disabled={updatingChannelId === selectedChannel.id || !metaSelectionDraft.selectedInstagramAccountId}>
                                  {language === 'en' ? 'Apply active account' : 'Aplicar cuenta activa'}
                                </Button>
                              </div>
                            ) : null}
                            {selectedChannel.provider === 'WHATSAPP_CLOUD' || selectedChannel.provider === 'WHATSAPP_SANDBOX' ? (
                              <>
                                {(() => {
                                  const mode = getWhatsAppConnectionMode(selectedSettings)
                                  const modeSummary = getWhatsAppConnectionModeSummary(mode, language)
                                  const pricingRows = getWhatsAppApproxPricingRows(language)
                                  return (
                                    <div className="mb-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900">{language === 'en' ? 'WhatsApp operating model' : 'Modelo operativo de WhatsApp'}</p>
                                        <p className="mt-1 text-xs leading-5 text-slate-600">{modeSummary.summary}</p>
                                      </div>
                                      <div className="grid gap-3 md:grid-cols-2">
                                        <div className={mode === 'CRM_ONLY' ? 'rounded-2xl border border-emerald-200 bg-emerald-50 p-3' : 'rounded-2xl border border-slate-200 bg-white p-3'}>
                                          <p className="text-sm font-semibold text-slate-900">{language === 'en' ? 'CRM only' : 'Solo CRM'}</p>
                                          <p className="mt-1 text-xs leading-5 text-slate-600">{language === 'en' ? 'Recommended when the team will answer from the CRM inbox and wants the cleanest control.' : 'Recomendado cuando el equipo va a responder desde el inbox del CRM y quiere el control más limpio.'}</p>
                                        </div>
                                        <div className={mode === 'HYBRID_CRM_PHONE' ? 'rounded-2xl border border-amber-200 bg-amber-50 p-3' : 'rounded-2xl border border-slate-200 bg-white p-3'}>
                                          <p className="text-sm font-semibold text-slate-900">{language === 'en' ? 'Hybrid CRM + phone' : 'Híbrido CRM + celular'}</p>
                                          <p className="mt-1 text-xs leading-5 text-slate-600">{language === 'en' ? 'Use it when the client still needs WhatsApp Business App besides the CRM.' : 'Úsalo cuando el cliente todavía necesita WhatsApp Business App además del CRM.'}</p>
                                        </div>
                                      </div>
                                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{language === 'en' ? 'What changes in practice' : 'Qué cambia en la práctica'}</p>
                                        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-700">
                                          {modeSummary.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                                        </ul>
                                      </div>
                                      <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-3">
                                        <p className="text-sm font-semibold text-slate-900">{language === 'en' ? 'Approximate Meta pricing reference' : 'Referencia aproximada de precios Meta'}</p>
                                        <p className="mt-1 text-xs leading-5 text-slate-600">{language === 'en' ? 'These values are only a commercial reference. Meta charges vary by country, category, and current pricing table.' : 'Estos valores son solo una referencia comercial. Los cobros de Meta cambian por país, categoría y tabla vigente.'}</p>
                                        <div className="mt-3 overflow-x-auto">
                                          <table className="min-w-full text-left text-xs text-slate-700">
                                            <thead>
                                              <tr className="border-b border-sky-100 text-slate-500">
                                                <th className="px-2 py-2 font-semibold">{language === 'en' ? 'Use case / range' : 'Uso / rango'}</th>
                                                <th className="px-2 py-2 font-semibold">{language === 'en' ? 'Approx. price' : 'Precio aprox.'}</th>
                                                <th className="px-2 py-2 font-semibold">{language === 'en' ? 'Notes' : 'Notas'}</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {pricingRows.map((row) => (
                                                <tr key={row.range} className="border-b border-sky-50 align-top last:border-b-0">
                                                  <td className="px-2 py-2 font-medium text-slate-900">{row.range}</td>
                                                  <td className="px-2 py-2">{row.approximate}</td>
                                                  <td className="px-2 py-2 text-slate-600">{row.note}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })()}
                                <p><span className="font-semibold text-slate-900">{language === 'en' ? 'Active number:' : 'Número activo:'}</span> {selectedMeta.whatsappAssets.find((item) => item.phoneNumberId === selectedChannel.externalPhoneNumberId)?.displayPhoneNumber || getWhatsAppDisplayPhoneNumber(selectedSettings) || selectedChannel.externalPhoneNumberId || (language === 'en' ? 'No linked number' : 'Sin número asociado')}</p>
                                <p><span className="font-semibold text-slate-900">{language === 'en' ? 'Connection mode:' : 'Modo de conexión:'}</span> {getWhatsAppConnectionModeLabel(getWhatsAppConnectionMode(selectedSettings), language)}</p>
                                {getWhatsAppConnectionMode(selectedSettings) === 'HYBRID_CRM_PHONE' ? (
                                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-5 text-amber-900">
                                    <p className="font-semibold">{language === 'en' ? 'Hybrid mode planned architecture' : 'Arquitectura prevista para modo híbrido'}</p>
                                    <p>{language === 'en' ? 'This mode requires official Meta coexistence, inbound and outbound event reconciliation, and rules to avoid duplicate replies between the phone and the CRM.' : 'Este modo requiere coexistencia oficial de Meta, conciliación de eventos inbound y outbound, y reglas para evitar respuestas duplicadas entre el celular y el CRM.'}</p>
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                            {(() => {
                              const socialSummary = getMetaSocialOperationalSummary(selectedChannel.provider, language)
                              if (!socialSummary) return null

                              return (
                                <div className="mb-4 space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{socialSummary.title}</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-600">{socialSummary.summary}</p>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-3">
                                    <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{socialSummary.connectTitle}</p>
                                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-700">
                                        {socialSummary.connectBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                                      </ul>
                                    </div>
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">{socialSummary.verifyTitle}</p>
                                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-700">
                                        {socialSummary.verifyBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                                      </ul>
                                    </div>
                                    <div className={selectedChannel.provider === 'INSTAGRAM_DM' ? 'rounded-2xl border border-fuchsia-200 bg-fuchsia-50/80 p-3' : 'rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3'}>
                                      <p className={selectedChannel.provider === 'INSTAGRAM_DM' ? 'text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-700' : 'text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700'}>{socialSummary.respondTitle}</p>
                                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-700">
                                        {socialSummary.respondBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                            {selectedChannel.provider === 'FACEBOOK_PAGE' || selectedChannel.provider === 'MESSENGER' ? (
                              <p><span className="font-semibold text-slate-900">{language === 'en' ? 'Active page:' : 'Página activa:'}</span> {selectedMeta.pages.find((item) => item.pageId === selectedChannel.externalPageId)?.pageName || selectedChannel.externalPageId || (language === 'en' ? 'No linked page' : 'Sin página asociada')}</p>
                            ) : null}
                            {selectedChannel.provider === 'INSTAGRAM_DM' ? (
                              <p><span className="font-semibold text-slate-900">{language === 'en' ? 'Active Instagram:' : 'Instagram activo:'}</span> {selectedMeta.pages.find((item) => item.instagramAccountId === selectedChannel.externalAccountId)?.instagramUsername || selectedChannel.externalAccountId || (language === 'en' ? 'No linked account' : 'Sin cuenta asociada')}</p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-slate-700">{language === 'en' ? 'This channel can already be linked to Meta using real OAuth from the CRM. When connected, the system syncs pages, Instagram accounts, and WhatsApp assets so the channel becomes operational with real IDs.' : 'Este canal ya puede enlazarse con Meta usando OAuth real desde el CRM. Al conectar, el sistema sincroniza páginas, cuentas de Instagram y assets de WhatsApp para dejar el canal operativo con IDs reales.'}</p>
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
                  <CardTitle>{language === 'en' ? 'Assets studio' : 'Studio de assets'}</CardTitle>
                  <CardDescription>
                    {selectedChannel
                      ? (language === 'en' ? `Active channel: ${selectedChannel.name}. From here you copy scripts, payloads, tokens, and URLs for forms, chatbot, email, and social.` : `Canal activo: ${selectedChannel.name}. Desde aquí copias scripts, payloads, tokens y URLs para formularios, chatbot, correo y social.`)
                      : (language === 'en' ? 'Select a channel to view the operational setup.' : 'Selecciona un canal para ver el setup operativo.')}
                  </CardDescription>
                </div>
                {operationsPanelSwitcher}
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              {!selectedChannel || !snippets ? (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
                  {language === 'en' ? 'Choose a channel on the left. The system will automatically show the correct endpoint, the testing token, and the scripts ready to paste.' : 'Elige un canal a la izquierda. El sistema te mostrará automáticamente el endpoint correcto, el token de pruebas y los scripts listos para pegar.'}
                </div>
              ) : (
                <Tabs value={activeAssetTab} onValueChange={setActiveAssetTab} className="space-y-4">
                  <div className="overflow-x-auto pb-1">
                    <TabsList className="inline-flex h-auto min-w-max flex-nowrap rounded-2xl border border-slate-200 bg-slate-50 p-1 md:flex-wrap">
                    {selectedAssetTabs.includes('overview') ? <TabsTrigger value="overview" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">{language === 'en' ? 'Overview' : 'Resumen'}</TabsTrigger> : null}
                    {selectedAssetTabs.includes('guide') ? <TabsTrigger value="guide" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">{language === 'en' ? 'Detailed integration walkthrough' : 'Integración paso a paso detallado'}</TabsTrigger> : null}
                    {selectedAssetTabs.includes('form') ? <TabsTrigger value="form" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">{language === 'en' ? 'Form' : 'Formulario'}</TabsTrigger> : null}
                    {selectedAssetTabs.includes('chatbot') ? <TabsTrigger value="chatbot" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Chatbot</TabsTrigger> : null}
                    {selectedAssetTabs.includes('webhook') ? <TabsTrigger value="webhook" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">{language === 'en' ? 'Social webhook' : 'Webhook social'}</TabsTrigger> : null}
                    {selectedAssetTabs.includes('bridge') ? <TabsTrigger value="bridge" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Bridges</TabsTrigger> : null}
                    </TabsList>
                  </div>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Endpoint</p>
                        <p className="mt-2 break-all text-sm font-medium text-slate-900">{endpoint}</p>
                        <Button variant="outline" className="mt-3 rounded-xl" onClick={() => void copyText('endpoint-main', endpoint)}>
                          {copiedKey === 'endpoint-main' ? (language === 'en' ? 'Copied' : 'Copiado') : (language === 'en' ? 'Copy endpoint' : 'Copiar endpoint')}
                        </Button>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{language === 'en' ? 'Demo token' : 'Token demo'}</p>
                        <p className="mt-2 break-all text-sm font-medium text-slate-900">{selectedToken || selectedChannel.verifyTokenPreview || (language === 'en' ? 'Set testingToken on the channel' : 'Configura testingToken en el canal')}</p>
                        <Button variant="outline" className="mt-3 rounded-xl" onClick={() => void copyText('token-main', selectedToken)} disabled={!selectedToken}>
                          {copiedKey === 'token-main' ? (language === 'en' ? 'Copied' : 'Copiado') : (language === 'en' ? 'Copy token' : 'Copiar token')}
                        </Button>
                      </div>
                      <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{language === 'en' ? 'Operational destination' : 'Destino operativo'}</p>
                        <p className="mt-2 text-sm font-medium text-slate-900">{language === 'en' ? 'Leads, conversations, and opportunities in the existing CRM' : 'Leads, conversaciones y oportunidades del CRM existente'}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button asChild variant="outline" className="rounded-xl"><Link href="/dashboard/crm">{language === 'en' ? 'View pipeline' : 'Ver pipeline'}</Link></Button>
                          <Button asChild variant="outline" className="rounded-xl"><Link href="/dashboard/crm/conversations">{language === 'en' ? 'Open inbox' : 'Abrir inbox'}</Link></Button>
                          {selectedChannel.provider === 'WEB_CHATBOT' && selectedChatbotEmbedUrl ? <Button asChild variant="outline" className="rounded-xl"><Link href={selectedChatbotEmbedUrl}>{language === 'en' ? 'Open iframe demo' : 'Abrir demo iframe'}</Link></Button> : null}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-3xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                        <p className="font-semibold">Google / Outlook / Sheets</p>
                        <p className="mt-2 leading-6">{language === 'en' ? 'Email and spreadsheets are set up as bridges on the same CRM. This lets you import, export, or automate capture without opening another parallel sales module.' : 'Correo y hojas quedaron montados como bridges del mismo CRM. Así puedes importar, exportar o automatizar captación sin abrir otro módulo comercial paralelo.'}</p>
                      </div>
                      <div className="rounded-3xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-900">
                        <p className="font-semibold">Meta / WhatsApp / Instagram</p>
                        <p className="mt-2 leading-6">{language === 'en' ? 'You can now connect Meta directly from the CRM with real OAuth, choose the exact channel asset, and operate WhatsApp, Messenger, and Instagram on the same sales inbox.' : 'Ahora puedes conectar Meta directamente desde el CRM por OAuth real, elegir el activo exacto del canal y operar WhatsApp, Messenger e Instagram sobre el mismo inbox comercial.'}</p>
                      </div>
                    </div>

                    {selectedChannelUsageStats?.meters?.length ? (
                      <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Consumo operativo</p>
                            <p className="mt-2 text-lg font-semibold text-amber-950">Mensajes salientes con costo frente a límites configurados</p>
                          </div>
                          <p className="text-xs leading-5 text-amber-800">El porcentaje se calcula solo sobre envíos con providerMessageId real.</p>
                        </div>
                        {selectedChannelUsageStats.meters.some((meter) => meter.percentage >= 100) ? (
                          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/90 p-3 text-sm text-rose-900">
                            <p className="font-semibold">Límite agotado</p>
                            <p className="mt-1 leading-6">Al menos uno de los topes operativos ya llegó al 100%. El inbox bloqueará nuevos envíos con costo hasta que ajustes el límite o cambie la ventana diaria o mensual.</p>
                          </div>
                        ) : selectedChannelUsageStats.meters.some((meter) => meter.percentage >= 80) ? (
                          <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-100/90 p-3 text-sm text-amber-950">
                            <p className="font-semibold">Consumo alto</p>
                            <p className="mt-1 leading-6">Al menos uno de los límites operativos ya superó el 80%. Conviene revisar el volumen antes de que el canal quede bloqueado.</p>
                          </div>
                        ) : null}
                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          {selectedChannelUsageStats.meters.map((meter) => (
                            <div key={meter.key} className="rounded-2xl border border-white/70 bg-white/85 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-900">{meter.label}</p>
                                <div className="flex items-center gap-2">
                                  {meter.percentage >= 100 ? <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700">Bloqueado</span> : meter.percentage >= 80 ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">Alerta</span> : null}
                                  <p className="text-sm font-semibold text-slate-900">{meter.percentage}%</p>
                                </div>
                              </div>
                              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
                                <div className={`h-full rounded-full ${getUsageMeterTone(meter.percentage)}`} style={{ width: `${Math.max(4, meter.percentage)}%` }} />
                              </div>
                              <p className="mt-3 text-xs leading-5 text-slate-600">{meter.used} de {meter.limit} mensajes consumidos.</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedChannel.provider === 'WEB_CHATBOT' ? (
                      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 text-sm text-emerald-950">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Chatbot Studio centralizado</p>
                          <p className="mt-3 text-lg font-semibold">Integraciones ya no edita el chatbot.</p>
                          <p className="mt-2 leading-6">Este módulo solo crea el canal y entrega accesos rápidos. La configuración del flujo, apariencia, launcher, dominios, inbox y guardado del chatbot continúa únicamente en Chatbot Studio.</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button asChild className="rounded-xl">
                              <Link href={`/dashboard/crm/chatbot?channelId=${selectedChannel.id}`}>{language === 'en' ? 'Open Chatbot Studio' : 'Abrir Chatbot Studio'}</Link>
                            </Button>
                            {selectedChatbotEmbedUrl ? <Button asChild variant="outline" className="rounded-xl"><Link href={selectedChatbotEmbedUrl}>{language === 'en' ? 'Open iframe demo' : 'Abrir demo iframe'}</Link></Button> : null}
                          </div>
                        </div>
                        <div className="grid gap-4">
                          <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4 text-sm text-slate-700">
                            <p className="font-semibold text-slate-900">Estado del embed</p>
                            <p className="mt-2 leading-6">{getPublicEmbedEnabled(selectedSettings) ? 'Publico habilitado para iframe.' : 'Publico deshabilitado. Ajustalo desde Chatbot Studio.'}</p>
                          </div>
                          <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4 text-sm text-slate-700">
                            <p className="font-semibold text-slate-900">Dominios</p>
                            <p className="mt-2 leading-6">{getAllowedDomains(selectedSettings) || 'Sin restricción declarada todavía.'}</p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="guide" className="space-y-4">
                    {!selectedIntegrationGuide ? (
                      <Card className="rounded-3xl border-slate-200">
                        <CardContent className="p-6 text-sm text-slate-500">{language === 'en' ? 'Select a channel to view the detailed integration guide.' : 'Selecciona un canal para ver la guía detallada de integración.'}</CardContent>
                      </Card>
                    ) : (
                      <>
                        <ErpSectionHeading title={selectedIntegrationGuide.title} description={selectedIntegrationGuide.summary} />
                        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                          <Card className="rounded-3xl border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)]">
                            <CardHeader>
                              <CardTitle className="text-base">{language === 'en' ? 'Integration context' : 'Contexto de la integración'}</CardTitle>
                              <CardDescription>{language === 'en' ? 'Executive summary to align business, implementation, and validation.' : 'Resumen ejecutivo para alinear negocio, implementación y validación.'}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm text-slate-700">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Recommended profile' : 'Perfil recomendado'}</p>
                                  <p className="mt-2 font-medium text-slate-900">{selectedIntegrationGuide.audience}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Estimated time' : 'Tiempo estimado'}</p>
                                  <p className="mt-2 font-medium text-slate-900">{selectedIntegrationGuide.estimatedTime}</p>
                                </div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Prerequisites' : 'Prerequisitos'}</p>
                                <div className="mt-3 space-y-2">
                                  {selectedIntegrationGuide.prerequisites.map((item) => (
                                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">OK</span>
                                      <p className="text-sm leading-6 text-slate-700">{item}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {renderIntegrationGuideVisual(selectedIntegrationGuide)}
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                          <Card className="rounded-3xl border-slate-200">
                            <CardHeader>
                              <CardTitle className="text-base">{language === 'en' ? 'Operational step by step' : 'Paso a paso operativo'}</CardTitle>
                              <CardDescription>{language === 'en' ? 'Recommended sequence to leave the channel working end to end.' : 'Secuencia recomendada para dejar el canal funcionando de punta a punta.'}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {selectedIntegrationGuide.steps.map((step, index) => (
                                <div key={step.title} className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4">
                                  <div className="flex items-start gap-3">
                                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white">{index + 1}</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                                      <p className="mt-1 text-sm leading-6 text-slate-600">{step.detail}</p>
                                      <div className="mt-3 space-y-2">
                                        {step.bullets.map((bullet) => (
                                          <div key={bullet} className="rounded-2xl border border-slate-100 bg-white px-3 py-2 text-sm leading-6 text-slate-700">
                                            {bullet}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </CardContent>
                          </Card>

                          <div className="space-y-4">
                            <Card className="rounded-3xl border-slate-200">
                              <CardHeader>
                                <CardTitle className="text-base">{language === 'en' ? 'Assets and references' : 'Assets y referencias'}</CardTitle>
                                <CardDescription>{language === 'en' ? 'Values the implementer usually needs during integration.' : 'Valores que el implementador suele necesitar durante la integración.'}</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {selectedIntegrationGuide.assets.map((asset) => (
                                  <div key={asset.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{asset.label}</p>
                                    <Textarea value={asset.value} readOnly rows={Math.min(Math.max(Math.ceil(asset.value.length / 72), 2), 8)} className="mt-2 font-mono text-xs" />
                                  </div>
                                ))}
                              </CardContent>
                            </Card>

                            <Card className="rounded-3xl border-slate-200">
                              <CardHeader>
                                <CardTitle className="text-base">{language === 'en' ? 'Final validation' : 'Validación final'}</CardTitle>
                                <CardDescription>{language === 'en' ? 'Short checklist to close QA and move the channel to demo or production.' : 'Checklist corto para cerrar QA y pasar el canal a demo o producción.'}</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                {selectedIntegrationGuide.validations.map((item) => (
                                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900">
                                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">OK</span>
                                    <span>{item}</span>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>

                            <Card className="rounded-3xl border-slate-200">
                              <CardHeader>
                                <CardTitle className="text-base">{language === 'en' ? 'Common problems' : 'Problemas comunes'}</CardTitle>
                                <CardDescription>{language === 'en' ? 'What to check first if the integration is not ready on the first pass.' : 'Qué revisar primero si la integración no queda lista a la primera.'}</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                {selectedIntegrationGuide.troubleshooting.map((item) => (
                                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">
                                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">!</span>
                                    <span>{item}</span>
                                  </div>
                                ))}
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="form" className="space-y-4">
                    <ErpSectionHeading title={language === 'en' ? 'Embeddable web form' : 'Formulario web embebible'} description={language === 'en' ? 'Recommended mode: public URL and iframe ready to paste, with legacy selector fallback.' : 'Modo recomendado: URL pública e iframe listo para pegar, con fallback legacy por selector.'} />
                    {selectedIsPublicWebForm ? (
                      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                        <Card className="rounded-3xl border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fbff)]">
                          <CardHeader>
                            <CardTitle className="text-base">{language === 'en' ? 'Visual builder in modal' : 'Constructor visual en modal'}</CardTitle>
                            <CardDescription>{language === 'en' ? 'Open a dedicated space to edit the form without getting lost on the main screen. Every change is reflected in real time.' : 'Abre un espacio dedicado para editar el formulario sin perderte en la pantalla principal. Cada cambio se refleja en tiempo real.'}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <p className="text-sm font-semibold text-slate-900">{language === 'en' ? 'What you will edit' : 'Qué vas a editar'}</p>
                              <p className="mt-1 text-sm leading-6 text-slate-600">{selectedIsBookingBridge ? (language === 'en' ? 'Commercial copy, colors, radii, spacing, visible fields, labels, placeholders, and the public experience of the embedded booking flow.' : 'Texto comercial, colores, radios, espaciados, campos visibles, labels, placeholders y la experiencia pública de la agenda embebida.') : (language === 'en' ? 'Commercial copy, colors, radii, spacing, visible fields, labels, placeholders, and iframe domains.' : 'Texto comercial, colores, radios, espaciados, campos visibles, labels, placeholders y dominios del iframe.')}</p>
                            </div>
                            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Active fields' : 'Campos activos'}</p>
                                <p className="mt-2 font-medium text-slate-900">{[
                                  webFormBuilderDraft.showNameField && (language === 'en' ? 'Name' : 'Nombre'),
                                  webFormBuilderDraft.showEmailField && (language === 'en' ? 'Email' : 'Correo'),
                                  webFormBuilderDraft.showPhoneField && (language === 'en' ? 'Phone' : 'Teléfono'),
                                  webFormBuilderDraft.showCompanyField && (language === 'en' ? 'Company' : 'Empresa'),
                                  webFormBuilderDraft.showCityField && (language === 'en' ? 'City' : 'Ciudad'),
                                  webFormBuilderDraft.showProductField && (language === 'en' ? 'Product' : 'Producto'),
                                  webFormBuilderDraft.showMessageField && (language === 'en' ? 'Message' : 'Mensaje'),
                                ].filter(Boolean).join(' · ') || (language === 'en' ? 'No visible fields' : 'Sin campos visibles')}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{language === 'en' ? 'Presentation' : 'Presentación'}</p>
                                <p className="mt-2 font-medium text-slate-900">{normalizePixelValue(webFormBuilderDraft.formFontSize, '14')}px · {language === 'en' ? 'radius' : 'radio'} {normalizePixelValue(webFormBuilderDraft.formInputRadius, '16')}px · gap {normalizePixelValue(webFormBuilderDraft.formFieldSpacing, '14')}px</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button className="rounded-xl" onClick={() => setWebFormBuilderModalOpen(true)}>
                                {selectedIsBookingBridge ? (language === 'en' ? 'Open booking editor' : 'Abrir editor de la agenda') : (language === 'en' ? 'Open form editor' : 'Abrir editor del formulario')}
                              </Button>
                              <Button variant="outline" className="rounded-xl" onClick={() => void copyText('form-builder-url', selectedWebFormEmbedUrl || snippets.webFormEmbedUrl)}>
                                {copiedKey === 'form-builder-url' ? (language === 'en' ? 'Copied' : 'Copiado') : (language === 'en' ? 'Copy public URL' : 'Copiar URL pública')}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="rounded-3xl border-sky-200 bg-sky-50/40">
                          <CardHeader>
                            <CardTitle className="text-base">{language === 'en' ? 'Channel preview' : 'Preview del canal'}</CardTitle>
                            <CardDescription>{selectedIsBookingBridge ? (language === 'en' ? 'Real view of the embedded booking flow with date and time selection. To edit it, use the dedicated modal.' : 'Vista real de la agenda embebida con selección de fecha y hora. Para editar, usa el modal dedicado.') : (language === 'en' ? 'Quick view of the current iframe. To edit it, use the dedicated modal.' : 'Vista rápida del iframe actual. Para editar, usa el modal dedicado.')}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            {selectedIsBookingBridge ? (
                              <div className="space-y-4">
                                {renderBookingPreviewLegend()}
                                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                    {language === 'en' ? 'Published booking-style flow' : 'Agenda tipo booking publicada'}
                                  </div>
                                  <iframe
                                    src={selectedWebFormEmbedUrl || snippets.webFormEmbedUrl}
                                    title={`Preview agenda ${selectedChannel?.name || 'canal'}`}
                                    className="h-[760px] w-full bg-white xl:h-[820px]"
                                    loading="lazy"
                                  />
                                </div>
                              </div>
                            ) : renderWebFormPreview(webFormBuilderDraft, { maxWidthClassName: 'max-w-xl', outerPaddingClassName: 'p-4', titleClassName: 'text-lg', messageMinHeight: 112 })}
                          </CardContent>
                        </Card>
                      </div>
                    ) : null}
                    {selectedIsPublicWebForm ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Card className="rounded-3xl border-slate-200">
                          <CardHeader>
                            <CardTitle className="text-base">{selectedIsBookingBridge ? (language === 'en' ? 'Public booking URL' : 'URL pública de la agenda') : (language === 'en' ? 'Public form URL' : 'URL pública del formulario')}</CardTitle>
                            <CardDescription>{selectedIsBookingBridge ? (language === 'en' ? 'Open it directly or use it as the source for the booking iframe.' : 'Ábrela directamente o úsala como fuente del iframe de agendamiento.') : (language === 'en' ? 'Open it directly or use it as the source for the iframe.' : 'Ábrela directamente o úsala como fuente del iframe.')}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Textarea value={selectedWebFormEmbedUrl || snippets.webFormEmbedUrl} readOnly rows={3} className="font-mono text-xs" />
                            <div className="flex flex-wrap gap-2">
                              <Button className="rounded-xl" onClick={() => void copyText('form-url', selectedWebFormEmbedUrl || snippets.webFormEmbedUrl)}>
                                {copiedKey === 'form-url' ? (language === 'en' ? 'Copied' : 'Copiado') : (language === 'en' ? 'Copy URL' : 'Copiar URL')}
                              </Button>
                              <Button asChild variant="outline" className="rounded-xl">
                                <Link href={selectedWebFormEmbedUrl || snippets.webFormEmbedUrl}>{language === 'en' ? 'Open demo' : 'Abrir demo'}</Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="rounded-3xl border-slate-200">
                          <CardHeader>
                            <CardTitle className="text-base">{selectedIsBookingBridge ? (language === 'en' ? 'Booking iframe ready to paste' : 'Iframe de agenda listo para pegar') : (language === 'en' ? 'Iframe ready to paste' : 'Iframe listo para pegar')}</CardTitle>
                            <CardDescription>{selectedIsBookingBridge ? (language === 'en' ? 'Recommended embed to publish the booking-style flow on any website.' : 'Embed recomendado para publicar el flujo tipo booking en cualquier sitio web.') : (language === 'en' ? 'Recommended embed to integrate it on any website.' : 'Embed recomendado para integrarlo en cualquier sitio web.')}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Textarea value={snippets.webFormIframe} readOnly rows={9} className="font-mono text-xs" />
                            <Button className="rounded-xl" onClick={() => void copyText('snippet-web-form-iframe', snippets.webFormIframe)}>
                              {copiedKey === 'snippet-web-form-iframe' ? (language === 'en' ? 'Iframe copied' : 'Iframe copiado') : (language === 'en' ? 'Copy iframe' : 'Copiar iframe')}
                            </Button>
                          </CardContent>
                        </Card>
                        <Card className="rounded-3xl border-slate-200 lg:col-span-2">
                          <CardHeader>
                            <CardTitle className="text-base">{language === 'en' ? 'Legacy selector snippet' : 'Snippet legacy por selector'}</CardTitle>
                            <CardDescription>{language === 'en' ? 'Use it if the client already has their own form in the DOM.' : 'Úsalo si el cliente ya tiene su propio formulario en el DOM.'}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <Textarea value={snippets.webForm} readOnly rows={16} className="font-mono text-xs" />
                            <div className="flex flex-wrap gap-2">
                              <Button className="rounded-xl" onClick={() => void copyText('snippet-web-form', snippets.webForm)}>
                                {copiedKey === 'snippet-web-form' ? (language === 'en' ? 'Snippet copied' : 'Snippet copiado') : (language === 'en' ? 'Copy snippet' : 'Copiar snippet')}
                              </Button>
                              <Button variant="outline" className="rounded-xl" onClick={() => void copyText('token-form', selectedToken)} disabled={!selectedToken}>
                                {language === 'en' ? 'Copy token' : 'Copiar token'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <Card className="rounded-3xl border-slate-200">
                        <CardHeader>
                          <CardTitle className="text-base">{language === 'en' ? 'Manual integration snippet' : 'Snippet para integración manual'}</CardTitle>
                          <CardDescription>{language === 'en' ? 'This channel uses an external bridge and does not expose a public iframe form.' : 'Este canal usa bridge externo y no expone formulario público por iframe.'}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Textarea value={snippets.webForm} readOnly rows={18} className="font-mono text-xs" />
                          <div className="flex flex-wrap gap-2">
                            <Button className="rounded-xl" onClick={() => void copyText('snippet-web-form', snippets.webForm)}>
                              {copiedKey === 'snippet-web-form' ? (language === 'en' ? 'Snippet copied' : 'Snippet copiado') : (language === 'en' ? 'Copy snippet' : 'Copiar snippet')}
                            </Button>
                            <Button variant="outline" className="rounded-xl" onClick={() => void copyText('token-form', selectedToken)} disabled={!selectedToken}>
                              {language === 'en' ? 'Copy token' : 'Copiar token'}
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
                          <CardTitle className="text-base">Edicion centralizada en Chatbot Studio</CardTitle>
                          <CardDescription>Integraciones crea y publica el canal. La configuracion completa del chatbot vive en Chatbot Studio.</CardDescription>
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
                            <Button asChild className="rounded-xl">
                              <Link href={`/dashboard/crm/chatbot?channelId=${selectedChannel.id}`}>Abrir Chatbot Studio</Link>
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
                          <CardDescription>Vista real del iframe actual. Para editar el canal, abre Chatbot Studio.</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                            <iframe
                              src={snippets.chatbotEmbedUrl}
                              title="Preview real del canal"
                              className="block h-[720px] w-full"
                              style={{ minHeight: '360px', border: 0, background: '#ffffff' }}
                              loading="lazy"
                              referrerPolicy="strict-origin-when-cross-origin"
                            />
                          </div>
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
                          <div className="grid gap-2"><Label>Siguiente paso esperado</Label><Select value={selectedChatbotFlowStage.nextField} onValueChange={(value) => updateChatbotStage(selectedChatbotFlowStage.id as ChatbotFlowStageId, { nextField: value as ChatbotFlowNextField })}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Nombre</SelectItem><SelectItem value="email">Correo</SelectItem><SelectItem value="phone">Teléfono</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="product">Producto</SelectItem><SelectItem value="quantity">Cantidad</SelectItem><SelectItem value="company">Empresa</SelectItem><SelectItem value="document">Documento / NIT</SelectItem><SelectItem value="city">Ciudad</SelectItem><SelectItem value="address">Dirección</SelectItem><SelectItem value="confirmation">Resumen y confirmación</SelectItem><SelectItem value="none">Cierre</SelectItem></SelectContent></Select></div>
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
                                <p className="text-sm font-semibold text-slate-900">{action.kind === 'human' ? 'Escalamiento humano' : action.kind === 'stock' ? 'Consulta de stock' : action.kind === 'catalog' ? 'Explorar catálogo' : action.kind === 'create_quote' ? 'Crear cotización' : action.kind === 'create_invoice' ? 'Crear factura' : action.kind === 'create_work_order' ? 'Crear orden' : 'Mensaje libre'}</p>
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
                        <p className="text-sm font-semibold text-slate-900">Abrir panel al cargar</p>
                        <p className="text-xs text-slate-500">Si se apaga, el widget inicia colapsado y solo deja visible el launcher</p>
                      </div>
                      <Switch checked={!chatbotBuilderDraft.launcherStartsCollapsed} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, launcherStartsCollapsed: !checked }))} disabled={!chatbotBuilderDraft.floatingLauncherEnabled} />
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
                    <div className="grid gap-2"><Label>Alineación launcher</Label><Select value={chatbotBuilderDraft.launcherPosition} onValueChange={(value) => setChatbotBuilderDraft((current) => ({ ...current, launcherPosition: value as LauncherPosition }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="right">Derecha</SelectItem><SelectItem value="center">Centro</SelectItem><SelectItem value="left">Izquierda</SelectItem></SelectContent></Select></div>
                    <div className="grid gap-2"><Label>Tipo posición</Label><Select value={chatbotBuilderDraft.launcherPlacement} onValueChange={(value) => setChatbotBuilderDraft((current) => ({ ...current, launcherPlacement: value as LauncherPlacement }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="absolute">Absolute</SelectItem></SelectContent></Select></div>
                    <div className="grid gap-2"><Label>Tamaño launcher</Label><Select value={chatbotBuilderDraft.launcherSize} onValueChange={(value) => setChatbotBuilderDraft((current) => ({ ...current, launcherSize: value as LauncherSize }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Compacto</SelectItem><SelectItem value="standard">Estándar</SelectItem><SelectItem value="large">Grande</SelectItem></SelectContent></Select></div>
                    <div className="grid gap-2"><Label>Offset horizontal</Label><Input value={chatbotBuilderDraft.launcherOffsetX} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, launcherOffsetX: normalizePixelValue(e.target.value, '60') }))} className="h-11 rounded-xl bg-white" /></div>
                    <div className="grid gap-2"><Label>Offset vertical</Label><Input value={chatbotBuilderDraft.launcherOffsetY} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, launcherOffsetY: normalizePixelValue(e.target.value, '60') }))} className="h-11 rounded-xl bg-white" /></div>
                    <div className="grid gap-2"><Label>Z-index overlay</Label><Input value={chatbotBuilderDraft.backdropZIndex} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, backdropZIndex: normalizeZIndexValue(e.target.value, '2147483645') }))} className="h-11 rounded-xl bg-white" /></div>
                    <div className="grid gap-2"><Label>Z-index panel</Label><Input value={chatbotBuilderDraft.panelZIndex} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, panelZIndex: normalizeZIndexValue(e.target.value, '2147483646') }))} className="h-11 rounded-xl bg-white" /></div>
                    <div className="grid gap-2"><Label>Z-index launcher</Label><Input value={chatbotBuilderDraft.launcherZIndex} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, launcherZIndex: normalizeZIndexValue(e.target.value, '2147483647') }))} className="h-11 rounded-xl bg-white" /></div>
                  </div>
                ) : null}

                {chatbotBuilderSection === 'copy' ? (
                  <div className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="grid gap-2"><Label>Label producto</Label><Input value={chatbotBuilderDraft.productLabel} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, productLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2"><Label>Placeholder producto</Label><Input value={chatbotBuilderDraft.productPlaceholder} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, productPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2 md:col-span-2"><Label>Label mensaje</Label><Input value={chatbotBuilderDraft.messageLabel} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, messageLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                      <div className="grid gap-2 md:col-span-2"><Label>Placeholder mensaje</Label><Input value={chatbotBuilderDraft.messagePlaceholder} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, messagePlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                    </div>

                    <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-2">
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Formulario previo al chat</p>
                          <p className="text-xs text-slate-500">Pide datos y área antes de abrir la conversación del visitante.</p>
                        </div>
                        <Switch checked={chatbotBuilderDraft.preChatFormEnabled} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormEnabled: checked }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Reiniciar conversación después de</Label>
                        <Input value={chatbotBuilderDraft.chatResetConversationAfterValue} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, chatResetConversationAfterValue: e.target.value.replace(/[^0-9]/g, '') || '1' }))} className="h-11 rounded-xl" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Unidad</Label>
                        <Select value={chatbotBuilderDraft.chatResetConversationAfterUnit} onValueChange={(value) => setChatbotBuilderDraft((current) => ({ ...current, chatResetConversationAfterUnit: value as PublicChatbotResetConversationUnit }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutes">Minutos</SelectItem><SelectItem value="hours">Horas</SelectItem><SelectItem value="days">Días</SelectItem></SelectContent></Select>
                      </div>
                      <div className="grid gap-2 md:col-span-2">
                        <Label>Acción al vencer</Label>
                        <Select value={chatbotBuilderDraft.chatResetConversationAfterAction} onValueChange={(value) => setChatbotBuilderDraft((current) => ({ ...current, chatResetConversationAfterAction: value as ChatbotInactivityAction }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="restart">Volver al inicio</SelectItem><SelectItem value="close">Cerrar conversación</SelectItem></SelectContent></Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Plantilla</Label>
                        <Select value={chatbotBuilderDraft.preChatFormTemplate} onValueChange={(value) => {
                          const preset = getPublicChatbotPreChatFormPreset(value)
                          setChatbotBuilderDraft((current) => ({
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
                        }}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{getPublicChatbotPreChatFormPresets().map((preset) => <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>)}</SelectContent></Select>
                      </div>
                      <div className="text-xs text-slate-500 md:col-span-2">Ejemplos: 5 minutos, 1 hora o 12 horas. Al vencer el tiempo, el visitante ve un hilo nuevo y el CRM puede seguir agrupando por correo o teléfono.</div>
                      {chatbotBuilderDraft.preChatFormEnabled ? (
                        <>
                          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2 md:grid-cols-3">
                            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 md:col-span-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Inactividad del formulario previo</p>
                                <p className="text-xs text-slate-500">Si el prospecto no termina esta plantilla, puedes reiniciarla o cerrar la conversación.</p>
                              </div>
                              <Switch checked={chatbotBuilderDraft.preChatFormInactivityEnabled} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormInactivityEnabled: checked }))} />
                            </div>
                            {chatbotBuilderDraft.preChatFormInactivityEnabled ? (
                              <>
                                <div className="grid gap-2">
                                  <Label>Tiempo</Label>
                                  <Input value={chatbotBuilderDraft.preChatFormInactivityValue} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormInactivityValue: e.target.value.replace(/[^0-9]/g, '') || '1' }))} className="h-11 rounded-xl" />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Unidad</Label>
                                  <Select value={chatbotBuilderDraft.preChatFormInactivityUnit} onValueChange={(value) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormInactivityUnit: value as ChatbotInactivityUnit }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutes">Minutos</SelectItem><SelectItem value="hours">Horas</SelectItem><SelectItem value="days">Días</SelectItem></SelectContent></Select>
                                </div>
                                <div className="grid gap-2">
                                  <Label>Al vencer</Label>
                                  <Select value={chatbotBuilderDraft.preChatFormInactivityAction} onValueChange={(value) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormInactivityAction: value as ChatbotInactivityAction }))}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="restart">Volver al inicio</SelectItem><SelectItem value="close">Cerrar conversación</SelectItem></SelectContent></Select>
                                </div>
                              </>
                            ) : null}
                          </div>
                          <div className="grid gap-2 md:col-span-2"><Label>Título del formulario</Label><Input value={chatbotBuilderDraft.preChatFormTitle} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormTitle: e.target.value }))} className="h-11 rounded-xl" /></div>
                          <div className="grid gap-2 md:col-span-2"><Label>Descripción</Label><Textarea value={chatbotBuilderDraft.preChatFormDescription} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormDescription: e.target.value }))} rows={3} className="rounded-2xl" /></div>
                          <div className="grid gap-2 md:col-span-2"><Label>Texto del botón</Label><Input value={chatbotBuilderDraft.preChatFormSubmitLabel} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormSubmitLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar nombre</span><Switch checked={chatbotBuilderDraft.preChatFormShowNameField} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormShowNameField: checked }))} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir nombre</span><Switch checked={chatbotBuilderDraft.preChatFormRequireName} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormRequireName: checked }))} disabled={!chatbotBuilderDraft.preChatFormShowNameField} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar correo</span><Switch checked={chatbotBuilderDraft.preChatFormShowEmailField} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormShowEmailField: checked }))} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir correo</span><Switch checked={chatbotBuilderDraft.preChatFormRequireEmail} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormRequireEmail: checked }))} disabled={!chatbotBuilderDraft.preChatFormShowEmailField} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Mostrar teléfono</span><Switch checked={chatbotBuilderDraft.preChatFormShowPhoneField} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormShowPhoneField: checked }))} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"><span className="text-sm text-slate-700">Requerir teléfono</span><Switch checked={chatbotBuilderDraft.preChatFormRequirePhone} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormRequirePhone: checked }))} disabled={!chatbotBuilderDraft.preChatFormShowPhoneField} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2"><span className="text-sm text-slate-700">Exigir al menos correo o teléfono</span><Switch checked={chatbotBuilderDraft.preChatFormRequireContactMethod} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormRequireContactMethod: checked }))} disabled={!chatbotBuilderDraft.preChatFormShowEmailField && !chatbotBuilderDraft.preChatFormShowPhoneField} /></div>
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2"><span className="text-sm text-slate-700">Mostrar selector de departamento</span><Switch checked={chatbotBuilderDraft.preChatFormShowDepartmentField} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormShowDepartmentField: checked }))} /></div>
                          {chatbotBuilderDraft.preChatFormShowDepartmentField ? (
                            <>
                              <div className="grid gap-2"><Label>Label departamento</Label><Input value={chatbotBuilderDraft.preChatFormDepartmentLabel} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormDepartmentLabel: e.target.value }))} className="h-11 rounded-xl" /></div>
                              <div className="grid gap-2"><Label>Placeholder departamento</Label><Input value={chatbotBuilderDraft.preChatFormDepartmentPlaceholder} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormDepartmentPlaceholder: e.target.value }))} className="h-11 rounded-xl" /></div>
                              <div className="grid gap-2 md:col-span-2"><Label>Opciones del departamento</Label><Textarea value={chatbotBuilderDraft.preChatFormDepartmentOptions} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, preChatFormDepartmentOptions: e.target.value }))} rows={4} className="rounded-2xl" placeholder="Ventas&#10;Soporte técnico&#10;Facturación" /></div>
                            </>
                          ) : null}
                          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2"><span className="text-sm text-slate-700">Mostrar nota legal</span><Switch checked={chatbotBuilderDraft.termsEnabled} onCheckedChange={(checked) => setChatbotBuilderDraft((current) => ({ ...current, termsEnabled: checked }))} /></div>
                          {chatbotBuilderDraft.termsEnabled ? (
                            <>
                              <div className="grid gap-2 md:col-span-2"><Label>Texto legal</Label><Textarea value={chatbotBuilderDraft.termsLabel} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, termsLabel: e.target.value }))} rows={2} className="rounded-2xl" /></div>
                              <div className="grid gap-2"><Label>Texto enlace</Label><Input value={chatbotBuilderDraft.termsLinkText} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, termsLinkText: e.target.value }))} className="h-11 rounded-xl" /></div>
                              <div className="grid gap-2"><Label>URL política</Label><Input value={chatbotBuilderDraft.termsLinkUrl} onChange={(e) => setChatbotBuilderDraft((current) => ({ ...current, termsLinkUrl: e.target.value }))} className="h-11 rounded-xl" placeholder="https://..." /></div>
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff,#f6fffb)] p-6">
              <div className="rounded-[26px] border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Preview en vivo</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Puedes revisar el estado inicial configurado, forzar solo launcher o abrir el panel, tanto en desktop como en mobile.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[{ value: 'floating', label: 'Estado inicial' }, { value: 'compact', label: 'Solo launcher' }, { value: 'expanded', label: 'Panel abierto' }].map((mode) => (
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
                <Button variant="outline" className="rounded-xl" onClick={() => {
                  const nextBuilderState = getChatbotBuilderState(selectedSettings)
                  setChatbotBuilderDraft(nextBuilderState)
                  setChatbotBuilderPreviewMode(getInitialChatbotPreviewMode(nextBuilderState))
                }} disabled={savingChatbotBuilder}>
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
                  { id: 'implementation', label: '4. Implementación' },
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
                      const Icon = getTemplatePresetLogo(preset)
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
                                { value: 'floating', label: 'Estado inicial' },
                                { value: 'compact', label: 'Solo launcher' },
                                { value: 'expanded', label: 'Panel abierto' },
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

                          <div className="mt-3">
                            {renderChatbotPreview(createForm, { mode: wizardChatPreviewMode, viewport: wizardChatPreviewViewport, minHeight: wizardChatPreviewViewport === 'mobile' ? 620 : 560 })}
                          </div>

                          <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2">
                              <p className="font-semibold text-slate-900">Launcher</p>
                              <p className="mt-1">{getLauncherPositionLabel(createForm.launcherPosition)} · {createForm.launcherPlacement} · {createForm.launcherSize} · {createForm.launcherStartsCollapsed ? 'inicia cerrado' : 'inicia abierto'}</p>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2">
                              <p className="font-semibold text-slate-900">Anclaje</p>
                              <p className="mt-1">X {normalizePixelValue(createForm.launcherOffsetX, '60')}px · Y {normalizePixelValue(createForm.launcherOffsetY, '60')}px</p>
                            </div>
                            <div className="rounded-2xl border border-white/70 bg-white/75 px-3 py-2">
                              <p className="font-semibold text-slate-900">Capas</p>
                              <p className="mt-1">L {normalizeZIndexValue(createForm.launcherZIndex, '2147483647')} · P {normalizeZIndexValue(createForm.panelZIndex, '2147483646')}</p>
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
                {editingChannelId && selectedChannel?.id === editingChannelId ? (
                  <div className="md:col-span-2 rounded-[24px] border border-sky-200 bg-sky-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Gestión del canal</p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">Mientras editas, aquí también tienes los accesos principales del canal para no bajar a otros bloques.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" className="rounded-xl border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50">
                          <Link href={`/dashboard/crm/chatbot?channelId=${selectedChannel.id}`}>Abrir Chatbot Studio</Link>
                        </Button>
                        <Button variant="outline" className="rounded-xl" onClick={() => void copyText('wizard-selected-endpoint', endpoint)}>
                          {copiedKey === 'wizard-selected-endpoint' ? 'Copiado' : 'Copiar endpoint'}
                        </Button>
                        {selectedChatbotEmbedUrl ? <Button asChild variant="outline" className="rounded-xl"><Link href={selectedChatbotEmbedUrl}>Ver iframe</Link></Button> : null}
                        <Button variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setDeleteCandidate(selectedChannel)} disabled={deletingChannelId === selectedChannel.id}>
                          {deletingChannelId === selectedChannel.id ? 'Eliminando...' : 'Eliminar canal'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
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
                        {(() => {
                          const socialSummary = getMetaSocialOperationalSummary(createForm.provider, language)
                          if (!socialSummary) return null

                          return (
                            <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white/80 p-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{socialSummary.title}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-600">{socialSummary.summary}</p>
                              </div>
                              <div className="grid gap-3 md:grid-cols-3">
                                <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">{socialSummary.connectTitle}</p>
                                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-700">
                                    {socialSummary.connectBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                                  </ul>
                                </div>
                                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">{socialSummary.verifyTitle}</p>
                                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-700">
                                    {socialSummary.verifyBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                                  </ul>
                                </div>
                                <div className={createForm.provider === 'INSTAGRAM_DM' ? 'rounded-2xl border border-fuchsia-200 bg-fuchsia-50/80 p-3' : 'rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3'}>
                                  <p className={createForm.provider === 'INSTAGRAM_DM' ? 'text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-700' : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700'}>{socialSummary.respondTitle}</p>
                                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-slate-700">
                                    {socialSummary.respondBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
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
                          <Label>{getMetaManualFieldCopy(createForm.provider, language).accountLabel}</Label>
                          <Input value={createForm.externalAccountId} onChange={(e) => setCreateForm((prev) => ({ ...prev, externalAccountId: e.target.value }))} className="h-11 rounded-xl" placeholder={getMetaManualFieldCopy(createForm.provider, language).accountPlaceholder} />
                        </div>
                        <div className="grid gap-2">
                          <Label>{getMetaManualFieldCopy(createForm.provider, language).assetLabel}</Label>
                          <Input
                            value={createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' ? createForm.externalPhoneNumberId : createForm.externalPageId}
                            onChange={(e) => setCreateForm((prev) => ({
                              ...prev,
                              ...(createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX'
                                ? { externalPhoneNumberId: e.target.value }
                                : { externalPageId: e.target.value }),
                            }))}
                            className="h-11 rounded-xl"
                            placeholder={getMetaManualFieldCopy(createForm.provider, language).assetPlaceholder}
                          />
                        </div>
                        {createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' ? (
                          <>
                            <div className="grid gap-2 md:col-span-2">
                              <Label>Modo de conexión del número</Label>
                              <Select value={createForm.whatsappConnectionMode} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, whatsappConnectionMode: value as WhatsAppConnectionMode }))}>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="CRM_ONLY">Solo CRM</SelectItem>
                                  <SelectItem value="HYBRID_CRM_PHONE">Híbrido CRM + celular</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-700">
                                <p className="font-semibold text-slate-900">{createForm.whatsappConnectionMode === 'CRM_ONLY' ? 'Solo CRM' : 'Híbrido CRM + celular'}</p>
                                <p className="mt-1 leading-5">
                                  {createForm.whatsappConnectionMode === 'CRM_ONLY'
                                    ? 'El número se atiende principalmente desde el inbox del CRM. Es el modo recomendado cuando quieres multiagente, trazabilidad, automatización y menos riesgo de doble respuesta.'
                                    : 'El número debe convivir entre CRM y WhatsApp Business App. El CRM refleja actividad y aplica alertas, pero este modo exige más disciplina operativa y compatibilidad real con Meta.'}
                                </p>
                                <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                                  <table className="min-w-full text-left text-[11px] text-slate-700">
                                    <thead>
                                      <tr className="border-b border-slate-100 text-slate-500">
                                        <th className="px-3 py-2 font-semibold">Modo</th>
                                        <th className="px-3 py-2 font-semibold">Cuándo usarlo</th>
                                        <th className="px-3 py-2 font-semibold">Riesgo</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr className="border-b border-slate-100 align-top">
                                        <td className="px-3 py-2 font-medium text-slate-900">Solo CRM</td>
                                        <td className="px-3 py-2">Cuando el equipo comercial trabajará desde el CRM como canal principal.</td>
                                        <td className="px-3 py-2">Bajo riesgo de colisión y mejor auditoría.</td>
                                      </tr>
                                      <tr className="align-top">
                                        <td className="px-3 py-2 font-medium text-slate-900">Híbrido CRM + celular</td>
                                        <td className="px-3 py-2">Cuando el cliente todavía necesita responder desde el celular además del CRM.</td>
                                        <td className="px-3 py-2">Más riesgo de doble respuesta, exige alertas y disciplina operativa.</td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                                <p className="mt-3 leading-5 text-slate-500">Referencia rápida de cobro Meta: utilitarias suelen moverse aprox. entre USD 0,01 y 0,03; autenticación entre USD 0,01 y 0,04; marketing entre USD 0,03 y 0,12 por plantilla, según país y tabla vigente.</p>
                              </div>
                            </div>
                            <div className="grid gap-2">
                              <Label>Número visible de WhatsApp</Label>
                              <Input value={createForm.whatsappDisplayPhoneNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, whatsappDisplayPhoneNumber: e.target.value }))} className="h-11 rounded-xl" placeholder="+57 320 2102047" />
                              <p className="text-xs leading-5 text-slate-500">Opcional. Se usa para mostrar el número legible cuando Meta solo devuelve el Phone Number ID.</p>
                            </div>
                            <div className="grid gap-2 md:col-span-2">
                              <Label>Access Token Cloud API</Label>
                              <Input value={createForm.whatsappAccessToken} onChange={(e) => setCreateForm((prev) => ({ ...prev, whatsappAccessToken: e.target.value }))} className="h-11 rounded-xl" placeholder="EAAG..." />
                              <p className="text-xs leading-5 text-slate-500">Si lo dejas vacío, el inbox seguirá operando en modo demo local para mensajes salientes.</p>
                            </div>
                            <div className="grid gap-2">
                              <Label>Versión Graph API</Label>
                              <Input value={createForm.whatsappApiVersion} onChange={(e) => setCreateForm((prev) => ({ ...prev, whatsappApiVersion: e.target.value }))} className="h-11 rounded-xl" placeholder="v23.0" />
                            </div>
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 md:col-span-2">
                              <p className="font-semibold">Límites operativos para controlar costo</p>
                              <p className="mt-2 leading-6">Estos topes se aplican antes de despachar mensajes salientes con costo desde el inbox. Déjalos vacíos si no quieres límite en ese nivel.</p>
                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <div className="grid gap-2">
                                  <Label>Límite diario por canal</Label>
                                  <Input value={createForm.outboundLimitPerChannelDay} onChange={(e) => setCreateForm((prev) => ({ ...prev, outboundLimitPerChannelDay: e.target.value.replace(/[^0-9]/g, '') }))} className="h-11 rounded-xl" placeholder="200" />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Límite mensual por canal</Label>
                                  <Input value={createForm.outboundLimitPerChannelMonth} onChange={(e) => setCreateForm((prev) => ({ ...prev, outboundLimitPerChannelMonth: e.target.value.replace(/[^0-9]/g, '') }))} className="h-11 rounded-xl" placeholder="3000" />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Límite diario por empresa</Label>
                                  <Input value={createForm.outboundLimitPerEmpresaDay} onChange={(e) => setCreateForm((prev) => ({ ...prev, outboundLimitPerEmpresaDay: e.target.value.replace(/[^0-9]/g, '') }))} className="h-11 rounded-xl" placeholder="500" />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Límite mensual por empresa</Label>
                                  <Input value={createForm.outboundLimitPerEmpresaMonth} onChange={(e) => setCreateForm((prev) => ({ ...prev, outboundLimitPerEmpresaMonth: e.target.value.replace(/[^0-9]/g, '') }))} className="h-11 rounded-xl" placeholder="10000" />
                                </div>
                              </div>
                              <p className="mt-3 text-xs leading-5 text-amber-800">El conteo usa mensajes salientes con providerMessageId real. Cuando se supera un tope, el inbox bloquea el envío, registra el intento fallido y deja trazabilidad en la actividad CRM.</p>
                            </div>
                          </>
                        ) : null}
                        {usesMetaProvider(createForm.provider) && createForm.provider !== 'WHATSAPP_CLOUD' && createForm.provider !== 'WHATSAPP_SANDBOX' ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 md:col-span-2">
                            <p className="font-semibold">Límites operativos para controlar costo y volumen</p>
                            <p className="mt-2 leading-6">Estos topes se aplican antes de despachar mensajes salientes por Meta desde el inbox. Déjalos vacíos si no quieres límite en ese nivel.</p>
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div className="grid gap-2">
                                <Label>Límite diario por canal</Label>
                                <Input value={createForm.outboundLimitPerChannelDay} onChange={(e) => setCreateForm((prev) => ({ ...prev, outboundLimitPerChannelDay: e.target.value.replace(/[^0-9]/g, '') }))} className="h-11 rounded-xl" placeholder="200" />
                              </div>
                              <div className="grid gap-2">
                                <Label>Límite mensual por canal</Label>
                                <Input value={createForm.outboundLimitPerChannelMonth} onChange={(e) => setCreateForm((prev) => ({ ...prev, outboundLimitPerChannelMonth: e.target.value.replace(/[^0-9]/g, '') }))} className="h-11 rounded-xl" placeholder="3000" />
                              </div>
                              <div className="grid gap-2">
                                <Label>Límite diario por empresa</Label>
                                <Input value={createForm.outboundLimitPerEmpresaDay} onChange={(e) => setCreateForm((prev) => ({ ...prev, outboundLimitPerEmpresaDay: e.target.value.replace(/[^0-9]/g, '') }))} className="h-11 rounded-xl" placeholder="500" />
                              </div>
                              <div className="grid gap-2">
                                <Label>Límite mensual por empresa</Label>
                                <Input value={createForm.outboundLimitPerEmpresaMonth} onChange={(e) => setCreateForm((prev) => ({ ...prev, outboundLimitPerEmpresaMonth: e.target.value.replace(/[^0-9]/g, '') }))} className="h-11 rounded-xl" placeholder="10000" />
                              </div>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-amber-800">El porcentaje y el bloqueo usan mensajes salientes con providerMessageId real, igual que en WhatsApp Cloud.</p>
                          </div>
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
                ) : null}

                {createForm.provider === 'WEB_FORM' && isOutgoingWebhookBridge(createForm.bridgeKind) ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Webhook saliente</Label>
                    <Input value={createForm.outgoingWebhookUrl} onChange={(e) => setCreateForm((prev) => ({ ...prev, outgoingWebhookUrl: e.target.value }))} className="h-11 rounded-xl" placeholder={createForm.bridgeKind === 'SLACK' ? 'https://hooks.slack.com/services/...' : createForm.bridgeKind === 'TEAMS' ? 'https://...webhook.office.com/...' : 'https://tu-automatizacion.com/webhooks/calendar'} />
                    <p className="text-xs leading-5 text-slate-500">Los bridges salientes disparan POST automáticos cuando el CRM crea nuevas tareas con fecha o registra citas web.</p>
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
                            <p className="mt-2 text-sm font-semibold text-sky-900">{createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' ? 'Conecta Meta y aplica el número sincronizado' : createForm.provider === 'INSTAGRAM_DM' ? 'Conecta Meta y aplica la cuenta de Instagram sincronizada' : 'Conecta Meta y aplica la página sincronizada'}</p>
                            <p className="mt-2 text-xs leading-5 text-sky-800">{createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' ? 'Después de guardar el canal, usa Conectar con Meta. Cuando vuelvas, selecciona el número correcto desde el bloque Conexión real con Meta.' : createForm.provider === 'INSTAGRAM_DM' ? 'Después de guardar el canal, usa Conectar con Meta. Cuando vuelvas, selecciona la cuenta profesional correcta y confirma una prueba real de DM desde el bloque Conexión real con Meta.' : 'Después de guardar el canal, usa Conectar con Meta. Cuando vuelvas, selecciona la página correcta y confirma una prueba real de Messenger desde el bloque Conexión real con Meta.'}</p>
                            {(() => {
                              const socialSummary = getMetaSocialOperationalSummary(createForm.provider, language)
                              if (!socialSummary) return null

                              return (
                                <div className="mt-3 grid gap-2 md:grid-cols-3">
                                  <div className="rounded-2xl border border-blue-200 bg-white/90 px-3 py-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">{socialSummary.connectTitle}</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-700">{socialSummary.connectBullets[0]}</p>
                                  </div>
                                  <div className="rounded-2xl border border-amber-200 bg-white/90 px-3 py-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">{socialSummary.verifyTitle}</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-700">{socialSummary.verifyBullets[0]}</p>
                                  </div>
                                  <div className="rounded-2xl border border-emerald-200 bg-white/90 px-3 py-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">{socialSummary.respondTitle}</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-700">{socialSummary.respondBullets[0]}</p>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        ) : null}
                        {requiresMetaOAuthBeforeActive(createForm) ? (
                          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3 sm:col-span-2">
                            <p className="text-[11px] uppercase tracking-[0.14em] text-rose-700">Bloqueo de salida productiva</p>
                            <p className="mt-2 text-sm font-semibold text-rose-900">WhatsApp Cloud no puede guardarse en ACTIVE antes de conectar Meta</p>
                            <p className="mt-2 text-xs leading-5 text-rose-800">Esto evita dejar números productivos cobrando sobre un activo manual o equivocado. Crea el canal en TESTING y cambia a ACTIVE solo cuando el número del cliente ya quede sincronizado.</p>
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
                ) : wizardStep === 'implementation' ? (
                  <div className="space-y-4">
                    <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Implementación paso a paso</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-950">{wizardImplementationGuide.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{wizardImplementationGuide.summary}</p>
                      {createForm.provider === 'WEB_CHATBOT' ? (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                          <p className="font-semibold">Criterio de publicación para chatbot web</p>
                          <p className="mt-2 leading-6">El iframe fijo publica el panel abierto del chat. La configuración del launcher flotante se refleja en el widget, por eso aquí se entregan ambos códigos de forma separada y actualizada.</p>
                        </div>
                      ) : null}
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Implementador</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{wizardImplementationGuide.audience}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tiempo estimado</p>
                          <p className="mt-2 text-sm font-medium text-slate-900">{wizardImplementationGuide.estimatedTime}</p>
                        </div>
                      </div>
                      {wizardImplementationGuide.prerequisites.length ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-semibold text-slate-900">Prerrequisitos</p>
                          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                            {wizardImplementationGuide.prerequisites.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                      <div className="space-y-4">
                        {wizardImplementationGuide.steps.map((step, index) => (
                          <div key={`${step.title}-${index}`} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
                            {step.bullets.length ? (
                              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
                                {step.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                              </ul>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-sm font-semibold text-slate-900">Referencias rápidas</p>
                          <div className="mt-3 space-y-3">
                            {wizardImplementationGuide.assets.map((asset) => (
                              <div key={`${asset.label}-${asset.value}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{asset.label}</p>
                                <p className="mt-2 break-all text-sm font-medium text-slate-900">{asset.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                          <p className="text-sm font-semibold text-slate-900">Código y activos para copiar</p>
                          <div className="mt-3 space-y-4">
                            {wizardImplementationCards.map((asset) => (
                              <div key={asset.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900">{asset.title}</p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">{asset.description}</p>
                                  </div>
                                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => void copyText(asset.id, asset.value)} disabled={asset.disabled}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    {copiedKey === asset.id ? 'Copiado' : asset.copyLabel}
                                  </Button>
                                </div>
                                <Textarea value={asset.value} readOnly rows={Math.min(18, Math.max(3, asset.value.split('\n').length + 1))} className="mt-3 font-mono text-xs" />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
                          <p className="text-sm font-semibold text-emerald-900">Validación final</p>
                          <div className="mt-3 space-y-2">
                            {wizardImplementationGuide.validations.map((item) => (
                              <div key={item} className="rounded-2xl border border-emerald-200 bg-white/90 px-3 py-2 text-sm text-emerald-900">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
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
                <Button variant="outline" className="rounded-xl" onClick={() => setWizardStep(wizardStep === 'implementation' ? 'review' : wizardStep === 'review' ? 'config' : 'template')} disabled={saving}>Atrás</Button>
                {wizardStep === 'config' ? <Button variant="outline" className="rounded-xl" onClick={() => setWizardStep('review')} disabled={saving}>Revisar canal</Button> : null}
                {wizardStep === 'review' ? <Button variant="outline" className="rounded-xl" onClick={() => setWizardStep('implementation')} disabled={saving}>Ver implementación</Button> : null}
                <Button variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)} disabled={saving}>Cancelar</Button>
                <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => void saveChannel()} disabled={saving || wizardStep !== 'implementation'}>
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