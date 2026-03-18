"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  buildChatbotEmbedUrl,
  buildChatbotIframeSnippet,
  buildChatbotSnippet,
  buildGmailAppsScriptSnippet,
  buildOutlookPayloadExample,
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

type ReadinessItem = {
  label: string
  done: boolean
  hint: string
}

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
    formSelector: '#lead-form',
    chatbotTitle: 'Asesor virtual SGDigital',
    chatbotPrompt: 'Cuéntanos tu proyecto y te contactamos.',
    assistantName: 'Asesor virtual SGDigital',
    publicEmbedEnabled: true,
    iframeHeight: '720',
    allowedDomains: '',
    accentColor: '#1d4ed8',
  }
}

type ChannelFormState = ReturnType<typeof getInitialChannelForm>

const CHANNEL_STATUS_OPTIONS: ChannelStatus[] = ['DRAFT', 'TESTING', 'ACTIVE', 'DISABLED', 'ERROR']

const TEMPLATE_PRESETS: TemplatePreset[] = [
  { key: 'web-form', name: 'Formulario Web', provider: 'WEB_FORM', description: 'Captura leads desde formularios embebidos y landings.', connectionModel: 'Script embebido', readiness: 'Operativo hoy', focus: 'Captura de formularios y campañas' },
  { key: 'web-chatbot', name: 'Chatbot Web', provider: 'WEB_CHATBOT', description: 'Chat embebible por iframe con hilo en tiempo real dentro del CRM.', connectionModel: 'Iframe publico', readiness: 'Operativo hoy', focus: 'Conversación, handoff y lead capture' },
  { key: 'whatsapp-cloud', name: 'WhatsApp Cloud', provider: 'WHATSAPP_CLOUD', description: 'Webhook listo para pruebas y conexión oficial.', connectionModel: 'Webhook nativo', readiness: 'Demo avanzada', focus: 'Inbox y mensajes inbound' },
  { key: 'facebook-page', name: 'Facebook / Messenger', provider: 'FACEBOOK_PAGE', description: 'Inbox social vía webhook para mensajes de páginas Meta.', connectionModel: 'Webhook nativo', readiness: 'Demo avanzada', focus: 'Social inbox y conversaciones' },
  { key: 'instagram-dm', name: 'Instagram DM', provider: 'INSTAGRAM_DM', description: 'Captura mensajes de Instagram y llévalos al inbox del CRM.', connectionModel: 'Webhook nativo', readiness: 'Demo avanzada', focus: 'DMs y campañas de performance' },
  { key: 'gmail-bridge', name: 'Gmail Inbox Bridge', provider: 'WEB_FORM', bridgeKind: 'GMAIL', description: 'Apps Script para prospectos que llegan al correo.', connectionModel: 'Bridge Apps Script', readiness: 'Demo guiada', focus: 'Correos de prospectos a CRM' },
  { key: 'outlook-bridge', name: 'Outlook Inbox Bridge', provider: 'WEB_FORM', bridgeKind: 'OUTLOOK', description: 'Bridge demo para Power Automate y Microsoft 365.', connectionModel: 'Bridge Power Automate', readiness: 'Demo guiada', focus: 'Inbox comercial de Microsoft' },
  { key: 'tiktok-bridge', name: 'TikTok Lead Bridge', provider: 'WEB_FORM', bridgeKind: 'TIKTOK', description: 'Usa Make/Zapier o webhook para llevar leads al CRM.', connectionModel: 'Bridge automation', readiness: 'Demo guiada', focus: 'Lead Ads y formularios externos' },
  { key: 'youtube-bridge', name: 'YouTube Lead Bridge', provider: 'WEB_FORM', bridgeKind: 'YOUTUBE', description: 'Bridge para formularios, comentarios o capturas desde campañas.', connectionModel: 'Bridge automation', readiness: 'Demo guiada', focus: 'Captura desde video y campañas' },
]

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

function getTokenFromSettings(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.testingToken === 'string' ? settingsJson.testingToken : ''
}

function getBridgeKind(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.bridgeKind === 'string' ? settingsJson.bridgeKind : ''
}

function getFormSelector(settingsJson: Record<string, unknown> | null | undefined) {
  return typeof settingsJson?.formSelector === 'string' ? settingsJson.formSelector : '#lead-form'
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

function getPublicEmbedEnabled(settingsJson: Record<string, unknown> | null | undefined) {
  return settingsJson?.publicEmbedEnabled !== false
}

function getEndpoint(baseUrl: string, channel: ChannelConnection | null) {
  if (!channel) return ''
  if (channel.provider === 'WEB_FORM') return `${baseUrl}/api/crm/captures/web-form`
  if (channel.provider === 'WEB_CHATBOT') return `${baseUrl}/api/crm/captures/chatbot`
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

function getChannelReadiness(channel: ChannelConnection, baseUrl: string) {
  const settings = (channel.settingsJson as Record<string, unknown> | null | undefined) ?? null
  const token = getTokenFromSettings(settings)
  const bridgeKind = getBridgeKind(settings)
  const isChatbot = channel.provider === 'WEB_CHATBOT'
  const isWebhook = channel.provider !== 'WEB_FORM' && channel.provider !== 'WEB_CHATBOT'
  const publicEmbed = getPublicEmbedEnabled(settings)
  const allowedDomains = getAllowedDomains(settings)
  const hasExternalId = Boolean(channel.externalAccountId || channel.externalPageId || channel.externalPhoneNumberId)

  const configured: ReadinessItem[] = [
    { label: 'Base configurada', done: Boolean(channel.name && channel.provider), hint: 'Nombre y proveedor definidos.' },
    { label: 'Token listo', done: Boolean(token || channel.verifyTokenPreview), hint: 'Token de pruebas o verificación disponible.' },
    { label: 'Ruta operativa', done: Boolean(getEndpoint(baseUrl, channel)), hint: 'Endpoint o webhook listo para usarse.' },
  ]

  const demo: ReadinessItem[] = [
    { label: 'Listo para demo', done: channel.status === 'TESTING' || channel.status === 'ACTIVE', hint: 'El canal debe estar en TESTING o ACTIVE.' },
    { label: 'Preview comercial', done: !isChatbot || Boolean(buildChatbotEmbedUrl(baseUrl, channel.id)), hint: 'Debe existir forma visible de mostrar la integración.' },
    { label: 'Fuente de demo', done: !isWebhook || hasExternalId || bridgeKind !== 'GENERIC', hint: 'Webhook o IDs externos mínimos para una demo guiada.' },
  ]

  const production: ReadinessItem[] = [
    { label: 'Estado productivo', done: channel.status === 'ACTIVE', hint: 'Para producción el canal debe estar activo.' },
    { label: 'Dominio endurecido', done: !isChatbot || !publicEmbed || Boolean(allowedDomains.trim()), hint: 'El chatbot debería restringirse por dominios.' },
    { label: 'Identificadores externos', done: !isWebhook || hasExternalId, hint: 'Meta o proveedor externo debe quedar identificado.' },
  ]

  return { configured, demo, production }
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
  const [baseUrl, setBaseUrl] = useState('')
  const [copiedKey, setCopiedKey] = useState('')
  const [activeAssetTab, setActiveAssetTab] = useState('overview')
  const [createForm, setCreateForm] = useState<ChannelFormState>(getInitialChannelForm())

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
    }
    void loadChannels()
  }, [loadChannels])

  useEffect(() => {
    if (!copiedKey) return
    const timeout = window.setTimeout(() => setCopiedKey(''), 1800)
    return () => window.clearTimeout(timeout)
  }, [copiedKey])

  const selectedChannel = useMemo(() => channels.find((item) => item.id === selectedChannelId) ?? null, [channels, selectedChannelId])
  const createPreset = useMemo(() => TEMPLATE_PRESETS.find((item) => item.key === createForm.templateKey) ?? TEMPLATE_PRESETS[0], [createForm.templateKey])
  const createIsChatbot = createForm.provider === 'WEB_CHATBOT'
  const createIsBridge = createForm.provider === 'WEB_FORM' && createForm.bridgeKind !== 'GENERIC'
  const createUsesWebhook = createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' || createForm.provider === 'FACEBOOK_PAGE' || createForm.provider === 'MESSENGER' || createForm.provider === 'INSTAGRAM_DM'

  const stats = useMemo(() => {
    return {
      active: channels.filter((item) => item.status === 'ACTIVE').length,
      testing: channels.filter((item) => item.status === 'TESTING').length,
      captures: channels.reduce((sum, item) => sum + (item._count?.captures ?? 0), 0),
      conversations: channels.reduce((sum, item) => sum + (item._count?.conversations ?? 0), 0),
    }
  }, [channels])

  const endpoint = getEndpoint(baseUrl, selectedChannel)
  const selectedSettings = (selectedChannel?.settingsJson as Record<string, unknown> | null | undefined) ?? null
  const selectedToken = getTokenFromSettings(selectedSettings)
  const selectedBridgeKind = getBridgeKind(selectedSettings)
  const selectedChatbotEmbedUrl = selectedChannel?.provider === 'WEB_CHATBOT' ? buildChatbotEmbedUrl(baseUrl, selectedChannel.id) : ''
  const selectedChatbotTitle = getChatbotTitle(selectedSettings)
  const selectedChatbotPrompt = getChatbotPrompt(selectedSettings)
  const selectedChatbotAssistant = getAssistantName(selectedSettings)
  const selectedChatbotAccent = getAccentColor(selectedSettings)
  const selectedReadiness = useMemo(() => selectedChannel ? getChannelReadiness(selectedChannel, baseUrl) : null, [baseUrl, selectedChannel])

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
      chatbot: buildChatbotSnippet({
        baseUrl,
        channelId: selectedChannel.id,
        token,
        title: getChatbotTitle(selectedSettings),
        prompt: getChatbotPrompt(selectedSettings),
      }),
      chatbotIframe: buildChatbotIframeSnippet({
        baseUrl,
        channelId: selectedChannel.id,
        height: getIframeHeight(selectedSettings),
      }),
      chatbotEmbedUrl: buildChatbotEmbedUrl(baseUrl, selectedChannel.id),
      gmail: buildGmailAppsScriptSnippet({
        baseUrl,
        channelId: selectedChannel.id,
        token,
      }),
      outlook: buildOutlookPayloadExample(selectedChannel.id, token),
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
      publicEmbedEnabled: preset.provider === 'WEB_CHATBOT',
    }))
    setWizardStep('config')
  }

  function openCreateWizard() {
    setEditingChannelId(null)
    setCreateForm(getInitialChannelForm())
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
      formSelector: getFormSelector(settings),
      chatbotTitle: getChatbotTitle(settings),
      chatbotPrompt: getChatbotPrompt(settings),
      assistantName: getAssistantName(settings),
      publicEmbedEnabled: getPublicEmbedEnabled(settings),
      iframeHeight: getIframeHeight(settings),
      allowedDomains: getAllowedDomains(settings),
      accentColor: getAccentColor(settings),
    })
    setWizardStep('config')
    setCreateOpen(true)
  }

  async function copyText(key: string, value: string) {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
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
        formSelector: createForm.formSelector,
        chatbotTitle: createForm.chatbotTitle,
        chatbotPrompt: createForm.chatbotPrompt,
        assistantName: createForm.assistantName,
        publicEmbedEnabled: createForm.publicEmbedEnabled,
        iframeHeight: createForm.iframeHeight,
        allowedDomains: createForm.allowedDomains,
        accentColor: createForm.accentColor,
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
      setActiveAssetTab(json.data.provider === 'WEB_CHATBOT' ? 'chatbot' : 'overview')
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

  const wizardPreview = useMemo(() => {
    const endpointPreview = createForm.provider === 'WEB_CHATBOT'
      ? `${baseUrl || 'https://tu-dominio.com'}/chatbot/<canal>`
      : createForm.provider === 'WEB_FORM'
        ? `${baseUrl || 'https://tu-dominio.com'}/api/crm/captures/web-form`
        : `${baseUrl || 'https://tu-dominio.com'}/api/crm/channels/<canal>/webhook`

    const configured = [
      { label: 'Plantilla elegida', done: Boolean(createForm.templateKey), hint: 'Base visual y técnica definida.' },
      { label: 'Nombre y token', done: Boolean(createForm.name.trim() && createForm.testingToken.trim()), hint: 'Datos mínimos para operar.' },
      { label: 'Canal listo', done: createForm.status === 'TESTING' || createForm.status === 'ACTIVE', hint: 'Recomendado para demo.' },
    ]

    const demo = [
      { label: 'Demo navegable', done: createForm.provider !== 'WEB_CHATBOT' || createForm.publicEmbedEnabled, hint: 'El chatbot debe poder abrirse en el iframe.' },
      { label: 'Fuente visible', done: createForm.provider !== 'WEB_FORM' || Boolean(createForm.formSelector || createForm.bridgeKind), hint: 'Origen del lead definido.' },
      { label: 'Mensaje comercial', done: createForm.provider !== 'WEB_CHATBOT' || Boolean(createForm.chatbotPrompt.trim()), hint: 'Prompt inicial presentable.' },
    ]

    const production = [
      { label: 'Estado ACTIVE', done: createForm.status === 'ACTIVE', hint: 'Solo necesario para producción.' },
      { label: 'Restricciones', done: createForm.provider !== 'WEB_CHATBOT' || !createForm.publicEmbedEnabled || Boolean(createForm.allowedDomains.trim()), hint: 'Dominios permitidos sugeridos.' },
      { label: 'IDs externos', done: !createUsesWebhook || Boolean(createForm.externalAccountId.trim() || createForm.externalPageId.trim()), hint: 'Meta o proveedor identificado.' },
    ]

    return {
      endpointPreview,
      configured,
      demo,
      production,
      iframeUrl: createForm.provider === 'WEB_CHATBOT' ? `${baseUrl || 'https://tu-dominio.com'}/chatbot/<canal-generado>` : '',
    }
  }, [baseUrl, createForm, createUsesWebhook])

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
        eyebrow="CRM Omnicanal"
        title="Centro de integraciones y captura de leads"
        description="Activa canales, genera scripts para formularios y chatbot, y monta bridges demo para correo y redes sin duplicar módulos del ERP. Todo termina en leads, conversaciones y oportunidades del CRM existente."
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

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="rounded-[26px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
          <CardHeader className="border-b border-slate-100 pb-4">
            <CardTitle>Canales configurados</CardTitle>
            <CardDescription>Selecciona un canal para ver assets, webhooks y bridges listos para copiar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 md:p-5">
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
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Iframe vinculado</p>
                        <p className="mt-2 break-all text-sm font-medium text-slate-900">{selectedChatbotEmbedUrl}</p>
                        <div className="mt-4 overflow-hidden rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5,#ffffff)] shadow-sm">
                          <div className="flex items-center justify-between border-b border-emerald-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
                            <span>{selectedChatbotTitle}</span>
                            <span>{selectedChatbotAssistant}</span>
                          </div>
                          <div className="space-y-3 p-4">
                            <div className="max-w-[78%] rounded-2xl rounded-tl-md bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                              {selectedChatbotPrompt}
                            </div>
                            <div className="ml-auto max-w-[72%] rounded-2xl rounded-tr-md px-3 py-2 text-sm text-white shadow-sm" style={{ backgroundColor: selectedChatbotAccent }}>
                              Hola, quiero una cotizacion para un proyecto nuevo.
                            </div>
                            <div className="max-w-[82%] rounded-2xl rounded-tl-md bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                              Perfecto. Te tomo los datos y el equipo comercial sigue el hilo desde el inbox CRM.
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button className="rounded-xl" onClick={() => void copyText('preview-chatbot-url', selectedChatbotEmbedUrl)}>
                            {copiedKey === 'preview-chatbot-url' ? 'Copiado' : 'Copiar URL'}
                          </Button>
                          <Button className="rounded-xl" variant="outline" onClick={() => void copyText('preview-chatbot-iframe', snippets?.chatbotIframe || '')}>
                            {copiedKey === 'preview-chatbot-iframe' ? 'Copiado' : 'Copiar iframe'}
                          </Button>
                          <Button asChild className="rounded-xl" variant="outline"><Link href="/dashboard/crm/chatbot">Ver panel chatbot</Link></Button>
                          <Button asChild className="rounded-xl" variant="outline"><Link href={selectedChatbotEmbedUrl}>Abrir demo</Link></Button>
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
                        <Button variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => setDeleteCandidate(selectedChannel)} disabled={deletingChannelId === selectedChannel.id}>
                          {deletingChannelId === selectedChannel.id ? 'Eliminando...' : 'Eliminar canal'}
                        </Button>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">Solo se eliminan canales sin conversaciones ni capturas. Si ya hubo actividad, deben desactivarse.</p>
                    </div>
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
                  <TabsList className="h-auto flex-wrap rounded-2xl border border-slate-200 bg-slate-50 p-1">
                    {selectedAssetTabs.includes('overview') ? <TabsTrigger value="overview" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Resumen</TabsTrigger> : null}
                    {selectedAssetTabs.includes('form') ? <TabsTrigger value="form" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Formulario</TabsTrigger> : null}
                    {selectedAssetTabs.includes('chatbot') ? <TabsTrigger value="chatbot" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Chatbot</TabsTrigger> : null}
                    {selectedAssetTabs.includes('webhook') ? <TabsTrigger value="webhook" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Webhook social</TabsTrigger> : null}
                    {selectedAssetTabs.includes('bridge') ? <TabsTrigger value="bridge" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Bridges</TabsTrigger> : null}
                  </TabsList>

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
                        <p className="mt-2 leading-6">Quedaron listos vía webhook con el modelo omnicanal actual. Cuando tengas credenciales reales, solo conectas el webhook y los leads entran al mismo inbox comercial.</p>
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
                          <p className="mt-2 leading-6">{getAssistantName(selectedSettings)} con color {getAccentColor(selectedSettings)}.</p>
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#fff,#f8fafc)] p-4 text-sm text-slate-700">
                          <p className="font-semibold text-slate-900">Dominios previstos</p>
                          <p className="mt-2 leading-6">{getAllowedDomains(selectedSettings) || 'Sin restricción declarada todavía para la demo.'}</p>
                        </div>
                      </div>
                    ) : null}
                  </TabsContent>

                  <TabsContent value="form" className="space-y-4">
                    <ErpSectionHeading title="Snippet para formulario web" description="Pega este script en tu sitio y enlázalo al formulario indicado por selector." />
                    <Textarea value={snippets.webForm} readOnly rows={18} className="font-mono text-xs" />
                    <div className="flex flex-wrap gap-2">
                      <Button className="rounded-xl" onClick={() => void copyText('snippet-web-form', snippets.webForm)}>
                        {copiedKey === 'snippet-web-form' ? 'Snippet copiado' : 'Copiar snippet'}
                      </Button>
                      <Button variant="outline" className="rounded-xl" onClick={() => void copyText('token-form', selectedToken)} disabled={!selectedToken}>
                        Copiar token
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="chatbot" className="space-y-4">
                    <ErpSectionHeading title="Chatbot embebible por iframe" description="Demo funcional para insertar en un sitio web y ver mensajes entrar al inbox del CRM casi en tiempo real." />
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
                        <Textarea value={snippets.chatbot} readOnly rows={18} className="font-mono text-xs" />
                        <Button className="rounded-xl" onClick={() => void copyText('snippet-chatbot', snippets.chatbot)}>
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
                    <ErpSectionHeading title="Bridges de correo y adquisición" description="Assets demo para Gmail, Outlook y otras fuentes que aún no tengan integración nativa." />
                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card className="rounded-3xl border-amber-200 bg-amber-50/60">
                        <CardHeader>
                          <CardTitle className="text-base">Google Apps Script para Gmail</CardTitle>
                          <CardDescription>Etiqueta prospectos en Gmail y empújalos a este canal CRM.</CardDescription>
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
                          <CardTitle className="text-base">Body demo para Outlook / Power Automate</CardTitle>
                          <CardDescription>Úsalo en una acción HTTP después de detectar correos de prospectos.</CardDescription>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden rounded-[30px] border-slate-200 bg-white/98 p-0 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.45)]">
          <div className="grid h-full gap-0 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.18),transparent_32%),linear-gradient(180deg,#f8fbff,#ffffff)] p-6 lg:border-b-0 lg:border-r">
              <DialogHeader>
                <DialogTitle>{editingChannelId ? 'Editar canal omnicanal' : 'Nuevo canal omnicanal'}</DialogTitle>
                <DialogDescription>{editingChannelId ? 'Ajusta configuración, demo e iframe desde el mismo wizard sin perder el contexto del canal.' : 'Wizard por pasos para dejar el canal listo, con preview comercial y checklist antes de crearlo.'}</DialogDescription>
              </DialogHeader>

              <div className="mt-4 flex flex-wrap gap-2">
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

              {wizardStep === 'template' ? (
                <div className="mt-5 max-h-[62vh] space-y-3 overflow-y-auto pr-1">
                  {TEMPLATE_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => applyTemplate(preset.key)}
                      className={createForm.templateKey === preset.key ? 'rounded-3xl border border-sky-300 bg-sky-50/80 p-4 text-left shadow-sm ring-2 ring-sky-200' : 'rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md'}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-950">{preset.name}</p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{preset.connectionModel}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{preset.description}</p>
                      <p className="mt-2 text-xs font-medium text-slate-600">{preset.focus}</p>
                    </button>
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
                        <div className="mt-3 overflow-hidden rounded-[22px] border border-emerald-200 bg-white shadow-sm">
                          <div className="flex items-center justify-between border-b border-emerald-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                            <span>{createForm.chatbotTitle}</span>
                            <span>{createForm.assistantName}</span>
                          </div>
                          <div className="space-y-2 p-3">
                            <div className="max-w-[82%] rounded-2xl rounded-tl-md bg-emerald-50 px-3 py-2 text-xs leading-5 text-slate-700">
                              {createForm.chatbotPrompt}
                            </div>
                            <div className="ml-auto max-w-[72%] rounded-2xl rounded-tr-md px-3 py-2 text-xs leading-5 text-white" style={{ backgroundColor: createForm.accentColor }}>
                              Necesito asesoría para una campaña con materiales impresos.
                            </div>
                          </div>
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

            <div className="flex max-h-[92vh] flex-col overflow-hidden p-6">
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
                    <div className="grid gap-2">
                      <Label>{createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' ? 'Business Account ID' : 'Account ID'}</Label>
                      <Input value={createForm.externalAccountId} onChange={(e) => setCreateForm((prev) => ({ ...prev, externalAccountId: e.target.value }))} className="h-11 rounded-xl" placeholder="Cuenta conectada" />
                    </div>
                    <div className="grid gap-2">
                      <Label>{createForm.provider === 'WHATSAPP_CLOUD' || createForm.provider === 'WHATSAPP_SANDBOX' ? 'Phone Number ID' : 'Page ID / Inbox ID'}</Label>
                      <Input value={createForm.externalPageId} onChange={(e) => setCreateForm((prev) => ({ ...prev, externalPageId: e.target.value }))} className="h-11 rounded-xl" placeholder="Identificador del canal" />
                    </div>
                  </>
                ) : null}

                {!createIsBridge && createForm.provider === 'WEB_FORM' ? (
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Selector del formulario</Label>
                    <Input value={createForm.formSelector} onChange={(e) => setCreateForm((prev) => ({ ...prev, formSelector: e.target.value }))} className="h-11 rounded-xl" />
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
                      <Input value={createForm.accentColor} onChange={(e) => setCreateForm((prev) => ({ ...prev, accentColor: e.target.value }))} className="h-11 rounded-xl" placeholder="#1d4ed8" />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label>Dominios permitidos</Label>
                      <Textarea value={createForm.allowedDomains} onChange={(e) => setCreateForm((prev) => ({ ...prev, allowedDomains: e.target.value }))} rows={3} className="rounded-2xl" placeholder="cliente.com, demo.cliente.com" />
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