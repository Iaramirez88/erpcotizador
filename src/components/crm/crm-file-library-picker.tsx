'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, FileText, Folder, ImageIcon, Music2, Search, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { CrmFileItem, CrmFilesSnapshot, JsonResponse } from '@/components/crm/crm-files-types'

function getItemIcon(type: CrmFileItem['type']) {
  if (type === 'folder') return Folder
  if (type === 'image') return ImageIcon
  if (type === 'audio') return Music2
  if (type === 'video') return Video
  return FileText
}

type CrmFileLibraryPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (item: CrmFileItem) => Promise<void> | void
  title?: string
  allowFolders?: boolean
}

export function CrmFileLibraryPicker({ open, onOpenChange, onPick, title = 'Seleccionar desde biblioteca', allowFolders = true }: CrmFileLibraryPickerProps) {
  const [snapshot, setSnapshot] = useState<CrmFilesSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function loadSnapshot(nextPath?: string) {
    setLoading(true)
    try {
      const url = nextPath ? `/api/crm/files?path=${encodeURIComponent(nextPath)}` : '/api/crm/files'
      const response = await fetch(url, { cache: 'no-store' })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<CrmFilesSnapshot>
      if (!json.success || !json.data) {
        setFeedback(json.error || 'No se pudo cargar la biblioteca.')
        return
      }
      setSnapshot(json.data)
      setFeedback(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void loadSnapshot('')
  }, [open])

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    const items = snapshot?.items || []
    return items.filter((item) => {
      if (!allowFolders && item.type === 'folder') return false
      if (!term) return true
      return item.name.toLowerCase().includes(term) || item.directoryPath.toLowerCase().includes(term)
    })
  }, [allowFolders, search, snapshot?.items])

  async function handlePick(item: CrmFileItem) {
    setSubmitting(true)
    try {
      await onPick(item)
      onOpenChange(false)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo seleccionar el archivo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en la carpeta actual" className="pl-9" />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {snapshot?.breadcrumbs.map((crumb, index) => (
              <div key={`${crumb.path}-${index}`} className="inline-flex items-center gap-2">
                <button type="button" className="rounded-full px-2 py-1 hover:bg-white" onClick={() => void loadSnapshot(crumb.path)}>
                  {crumb.label}
                </button>
                {index < snapshot.breadcrumbs.length - 1 ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
              </div>
            ))}
          </div>

          {feedback ? <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{feedback}</div> : null}

          <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-slate-200">
            {loading ? <div className="px-4 py-6 text-sm text-slate-500">Cargando biblioteca...</div> : null}
            {!loading && !visibleItems.length ? <div className="px-4 py-6 text-sm text-slate-500">No hay resultados en esta carpeta.</div> : null}
            {!loading ? visibleItems.map((item) => {
              const Icon = getItemIcon(item.type)
              const selectable = allowFolders || item.type !== 'folder'
              return (
                <div key={item.path} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-3 text-left"
                    onClick={() => {
                      if (item.type === 'folder') {
                        void loadSnapshot(item.path)
                      }
                    }}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-950">{item.name}</span>
                      <span className="block truncate text-xs text-slate-500">/{item.directoryPath || ''}</span>
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    {item.type === 'folder' ? <Button variant="outline" className="rounded-xl" onClick={() => void loadSnapshot(item.path)}>Abrir</Button> : null}
                    {selectable ? <Button className="rounded-xl" onClick={() => void handlePick(item)} disabled={submitting}>Vincular</Button> : null}
                  </div>
                </div>
              )
            }) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}