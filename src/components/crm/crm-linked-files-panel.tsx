'use client'

import { useEffect, useState } from 'react'
import { FilePlus2, Folder, ImageIcon, Link2, Music2, Paperclip, Trash2, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CrmFileLibraryPicker } from '@/components/crm/crm-file-library-picker'
import type { CrmFileItem, JsonResponse } from '@/components/crm/crm-files-types'

type EntityType = 'TASK' | 'LEAD' | 'OPPORTUNITY'

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
    await navigator.clipboard.writeText(`${window.location.origin}${item.url}`)
    setFeedback('Enlace copiado al portapapeles.')
  }

  return (
    <>
      <Card className="rounded-[24px] border-slate-200 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          {canEdit && entityId ? (
            <Button variant="outline" className="rounded-xl" onClick={() => setPickerOpen(true)} disabled={busy}>
              <FilePlus2 className="mr-2 h-4 w-4" />
              Elegir desde biblioteca
            </Button>
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
                    <p className="truncate text-xs text-slate-500">/{item.directoryPath || ''} · {formatDate(item.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
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
    </>
  )
}