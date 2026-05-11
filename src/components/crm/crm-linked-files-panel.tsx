'use client'

import { useEffect, useRef, useState } from 'react'
import { FilePlus2, Folder, HardDrive, ImageIcon, Link2, Music2, Paperclip, Search, Trash2, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CrmFileLibraryPicker } from '@/components/crm/crm-file-library-picker'
import type { CrmExternalFileProvider, CrmFileItem, JsonResponse } from '@/components/crm/crm-files-types'

type EntityType = 'TASK' | 'LEAD' | 'OPPORTUNITY'

type ExternalStorageItem = {
  id: string
  name: string
  url: string
  mimeType: string | null
  sizeBytes: number | null
  updatedAt: string
  type: 'folder' | 'document'
  provider: CrmExternalFileProvider
}

type ExternalStorageListResponse = {
  connected: boolean
  accountLabel: string | null
  items: ExternalStorageItem[]
}

function getExternalProviderLabel(provider: CrmExternalFileProvider) {
  return provider === 'GOOGLE_DRIVE' ? 'Google Drive' : 'OneDrive'
}

function getItemIcon(type: CrmFileItem['type']) {
  if (type === 'folder') return Folder
  if (type === 'image') return ImageIcon
  if (type === 'audio') return Music2
  if (type === 'video') return Video
  return Paperclip
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

type Props = {
  entityType: EntityType
  entityId: string | null | undefined
  title?: string
  emptyLabel?: string
  canEdit?: boolean
}

export function CrmLinkedFilesPanel({ entityType, entityId, title = 'Archivos vinculados', emptyLabel = 'Todavía no hay archivos vinculados.', canEdit = true }: Props) {
  const [items, setItems] = useState<CrmFileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [externalPickerOpen, setExternalPickerOpen] = useState(false)
  const [externalProvider, setExternalProvider] = useState<CrmExternalFileProvider>('GOOGLE_DRIVE')
  const [externalQuery, setExternalQuery] = useState('')
  const [externalLoading, setExternalLoading] = useState(false)
  const [externalItems, setExternalItems] = useState<ExternalStorageItem[]>([])
  const [externalConnected, setExternalConnected] = useState(false)
  const [externalAccountLabel, setExternalAccountLabel] = useState<string | null>(null)
  const [externalFeedback, setExternalFeedback] = useState<string | null>(null)
  const popupRef = useRef<Window | null>(null)
  const popupIntervalRef = useRef<number | null>(null)

  async function loadItems() {
    if (!entityId) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`/api/crm/files/links?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`, { cache: 'no-store' })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<CrmFileItem[]>
      if (!json.success || !json.data) {
        setFeedback(json.error || 'No se pudieron cargar los archivos vinculados.')
        return
      }
      setItems(json.data)
      setFeedback(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadItems()
  }, [entityId, entityType])

  async function handleLink(item: CrmFileItem) {
    if (!entityId) return
    setBusy(true)
    try {
      const response = await fetch('/api/crm/files/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, path: item.path }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<CrmFileItem>
      if (!json.success) {
        throw new Error(json.error || 'No se pudo vincular el archivo.')
      }
      setFeedback('Archivo vinculado correctamente.')
      await loadItems()
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlink(item: CrmFileItem) {
    if (!entityId) return
    setBusy(true)
    try {
      const response = await fetch('/api/crm/files/links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, path: item.path }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<CrmFileItem>
      if (!json.success) {
        setFeedback(json.error || 'No se pudo desvincular el archivo.')
        return
      }
      setFeedback('Archivo desvinculado correctamente.')
      await loadItems()
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyLink(item: CrmFileItem) {
    if (!item.url) return
    const resolvedUrl = item.url.startsWith('http://') || item.url.startsWith('https://') ? item.url : `${window.location.origin}${item.url}`
    await navigator.clipboard.writeText(resolvedUrl)
    setFeedback('Enlace copiado al portapapeles.')
  }

  function stopPopupTracking() {
    if (popupIntervalRef.current) {
      window.clearInterval(popupIntervalRef.current)
    }
    popupIntervalRef.current = null
    popupRef.current = null
  }

  async function loadExternalItems(provider = externalProvider, query = externalQuery) {
    setExternalLoading(true)
    try {
      const response = await fetch(`/api/crm/external-storage/files?provider=${provider}&q=${encodeURIComponent(query)}`, { cache: 'no-store' })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<ExternalStorageListResponse>
      if (!json.success || !json.data) {
        setExternalFeedback(json.error || 'No se pudieron cargar archivos externos.')
        setExternalConnected(false)
        setExternalItems([])
        setExternalAccountLabel(null)
        return
      }
      setExternalConnected(json.data.connected)
      setExternalAccountLabel(json.data.accountLabel)
      setExternalItems(json.data.items || [])
      setExternalFeedback(null)
    } finally {
      setExternalLoading(false)
    }
  }

  async function handleConnectExternal(provider: CrmExternalFileProvider) {
    stopPopupTracking()
    const popup = window.open(`/api/crm/external-storage/connect?provider=${provider}`, 'sgdigital-external-storage', 'popup=yes,width=720,height=820,left=120,top=80')
    if (!popup) {
      setExternalFeedback('El navegador bloqueó la ventana emergente. Permite popups para continuar.')
      return
    }
    popupRef.current = popup
    popup.focus()
    setExternalFeedback(`Conectando ${getExternalProviderLabel(provider)}...`)
    popupIntervalRef.current = window.setInterval(async () => {
      const currentPopup = popupRef.current
      if (!currentPopup) {
        stopPopupTracking()
        return
      }
      if (currentPopup.closed) {
        stopPopupTracking()
        await loadExternalItems(provider, externalQuery)
      }
    }, 600)
  }

  async function handleLinkExternal(item: ExternalStorageItem) {
    if (!entityId) return
    setBusy(true)
    try {
      const response = await fetch('/api/crm/files/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          external: {
            provider: item.provider,
            id: item.id,
            name: item.name,
            url: item.url,
            mimeType: item.mimeType,
            sizeBytes: item.sizeBytes,
            updatedAt: item.updatedAt,
          },
        }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<CrmFileItem>
      if (!json.success) {
        throw new Error(json.error || 'No se pudo vincular el archivo externo.')
      }
      setExternalFeedback('Archivo externo vinculado correctamente.')
      setFeedback('Archivo vinculado correctamente.')
      await loadItems()
    } catch (error) {
      setExternalFeedback(error instanceof Error ? error.message : 'No se pudo vincular el archivo externo.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!externalPickerOpen) return
    void loadExternalItems(externalProvider, externalQuery)
  }, [externalPickerOpen, externalProvider])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'crm-external-storage-success') {
        setExternalFeedback(typeof event.data?.message === 'string' ? event.data.message : 'Conexión lista.')
        void loadExternalItems(externalProvider, externalQuery)
      }
      if (event.data?.type === 'crm-external-storage-error') {
        setExternalFeedback(typeof event.data?.message === 'string' ? event.data.message : 'No se pudo conectar el proveedor externo.')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      stopPopupTracking()
    }
  }, [externalProvider, externalQuery])

  return (
    <>
      <Card className="rounded-[24px] border-slate-200 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          {canEdit && entityId ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setPickerOpen(true)} disabled={busy}>
                <FilePlus2 className="mr-2 h-4 w-4" />
                Elegir desde biblioteca
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={() => setExternalPickerOpen(true)} disabled={busy}>
                <HardDrive className="mr-2 h-4 w-4" />
                Drive / OneDrive
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {feedback ? <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{feedback}</div> : null}
          {loading ? <p className="text-sm text-slate-500">Cargando archivos vinculados...</p> : null}
          {!loading && !items.length ? <p className="text-sm text-slate-500">{emptyLabel}</p> : null}
          {!loading ? items.map((item) => {
            const Icon = getItemIcon(item.type)
            return (
              <div key={item.path} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-950">{item.name}</p>
                    <p className="truncate text-xs text-slate-500">{item.isExternal ? item.directoryPath : `/${item.directoryPath || ''}`} · {formatDate(item.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.sourceProvider ? <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{getExternalProviderLabel(item.sourceProvider)}</span> : null}
                  {item.url ? <Button variant="outline" className="rounded-xl" onClick={() => window.open(item.url!, '_blank', 'noopener,noreferrer')}>Abrir</Button> : null}
                  {item.url ? <Button variant="outline" className="rounded-xl" onClick={() => void handleCopyLink(item)}><Link2 className="mr-2 h-4 w-4" />Copiar enlace</Button> : null}
                  {canEdit ? <Button variant="outline" className="rounded-xl text-rose-700 hover:text-rose-700" onClick={() => void handleUnlink(item)} disabled={busy}><Trash2 className="mr-2 h-4 w-4" />Quitar</Button> : null}
                </div>
              </div>
            )
          }) : null}
        </CardContent>
      </Card>

      <CrmFileLibraryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handleLink}
        title="Elegir archivo o carpeta desde biblioteca CRM"
      />

      <Dialog open={externalPickerOpen} onOpenChange={setExternalPickerOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Selector Drive / OneDrive</DialogTitle>
            <DialogDescription>Conecta tu cuenta por OAuth y vincula archivos externos al lead, deal o tarea sin pegar URLs manuales.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2 md:grid-cols-[220px_1fr_auto] md:items-end">
              <div className="grid gap-2">
                <Label>Proveedor</Label>
                <Select value={externalProvider} onValueChange={(value) => setExternalProvider(value as CrmExternalFileProvider)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GOOGLE_DRIVE">Google Drive</SelectItem>
                    <SelectItem value="ONEDRIVE">OneDrive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Buscar archivo</Label>
                <Input value={externalQuery} onChange={(event) => setExternalQuery(event.target.value)} placeholder="Nombre del archivo o carpeta" className="rounded-xl" />
              </div>
              <Button type="button" className="rounded-xl" variant="outline" onClick={() => void loadExternalItems(externalProvider, externalQuery)} disabled={externalLoading}>
                <Search className="mr-2 h-4 w-4" />
                Buscar
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{getExternalProviderLabel(externalProvider)}</p>
                <p className="text-sm text-slate-600">{externalConnected ? `Conectado${externalAccountLabel ? ` como ${externalAccountLabel}` : ''}.` : 'Aún no hay conexión OAuth activa para este proveedor.'}</p>
              </div>
              <Button type="button" className="rounded-xl" onClick={() => void handleConnectExternal(externalProvider)} disabled={externalLoading}>
                {externalConnected ? 'Reconectar' : 'Conectar por OAuth'}
              </Button>
            </div>

            {externalFeedback ? <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{externalFeedback}</div> : null}
            {externalLoading ? <p className="text-sm text-slate-500">Cargando resultados...</p> : null}
            {!externalLoading && externalConnected && !externalItems.length ? <p className="text-sm text-slate-500">No hay archivos visibles con ese criterio.</p> : null}

            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
              {externalItems.map((item) => {
                const Icon = item.type === 'folder' ? Folder : Paperclip
                return (
                  <div key={`${item.provider}:${item.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-950">{item.name}</p>
                        <p className="truncate text-xs text-slate-500">{getExternalProviderLabel(item.provider)} · {formatDate(item.updatedAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}>
                        Abrir
                      </Button>
                      <Button type="button" className="rounded-xl" onClick={() => void handleLinkExternal(item)} disabled={busy}>
                        Vincular
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}