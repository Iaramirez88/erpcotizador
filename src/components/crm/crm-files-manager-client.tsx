'use client'

import Image from 'next/image'
import { type ReactElement, useDeferredValue, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Copy, Download, Eye, FileText, Folder, FolderInput, FolderPlus, ImageIcon, MoreHorizontal, Music2, Pencil, Plus, Search, Share2, Trash2, Upload, Video } from 'lucide-react'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { CardInfoHeader } from '@/components/ui/card-info-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { InfoHint } from '@/components/ui/info-hint'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import type { CrmFileItem, CrmFilesSnapshot, CrmFilesTeamUser, CrmFolderNode, JsonResponse } from '@/components/crm/crm-files-types'

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size.toFixed(size >= 100 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function getItemVisual(type: CrmFileItem['type']) {
  switch (type) {
    case 'folder':
      return { icon: Folder, tone: 'bg-sky-100 text-sky-700 border-sky-200' }
    case 'image':
      return { icon: ImageIcon, tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    case 'audio':
      return { icon: Music2, tone: 'bg-violet-100 text-violet-700 border-violet-200' }
    case 'video':
      return { icon: Video, tone: 'bg-amber-100 text-amber-700 border-amber-200' }
    default:
      return { icon: FileText, tone: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
}

function buildExpandedFolderDefaults(currentPath: string, tree: CrmFolderNode): string[] {
  const expanded = new Set<string>([tree.path])
  const segments = currentPath.split('/').filter(Boolean)
  let cursor = ''
  for (const segment of segments) {
    cursor = cursor ? `${cursor}/${segment}` : segment
    expanded.add(cursor)
  }
  return [...expanded]
}

export function CrmFilesManagerClient() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [snapshot, setSnapshot] = useState<CrmFilesSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'files' | 'history'>('files')
  const { mode: viewMode, setMode: setViewMode } = useDataViewMode('crm.files.history', 'list')
  const [search, setSearch] = useState('')
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CrmFileItem | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [moveTargetPath, setMoveTargetPath] = useState('')
  const [shareUserIds, setShareUserIds] = useState<string[]>([])
  const [teamUsers, setTeamUsers] = useState<CrmFilesTeamUser[]>([])
  const [pendingPreviewPath, setPendingPreviewPath] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<string[]>([''])

  const deferredSearch = useDeferredValue(search.trim().toLowerCase())

  async function loadSnapshot(nextPath?: string) {
    setLoading(true)
    try {
      const url = nextPath ? `/api/crm/files?path=${encodeURIComponent(nextPath)}` : '/api/crm/files'
      const response = await fetch(url, { cache: 'no-store' })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<CrmFilesSnapshot>
      if (!json.success || !json.data) {
        setFeedback(json.error || 'No se pudo cargar el administrador de archivos.')
        return
      }
      setSnapshot(json.data)
      setExpandedFolders(buildExpandedFolderDefaults(json.data.currentPath, json.data.tree))
      setFeedback(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nextPath = params.get('path') || ''
    const previewPath = params.get('preview')
    setPendingPreviewPath(previewPath)
    void loadSnapshot(nextPath)
  }, [])

  useEffect(() => {
    if (!snapshot || !pendingPreviewPath) return
    const previewMatch = [...snapshot.items, ...snapshot.recentItems].find((item) => item.path === pendingPreviewPath)
    if (!previewMatch || previewMatch.type === 'folder') return
    setSelectedItem(previewMatch)
    setPreviewDialogOpen(true)
    setPendingPreviewPath(null)
  }, [pendingPreviewPath, snapshot])

  const visibleItems = (snapshot?.items || []).filter((item) => {
    if (!deferredSearch) return true
    return item.name.toLowerCase().includes(deferredSearch)
  })

  const visibleRecentItems = (snapshot?.recentItems || []).filter((item) => {
    if (!deferredSearch) return true
    return item.name.toLowerCase().includes(deferredSearch) || item.directoryPath.toLowerCase().includes(deferredSearch)
  })

  function flattenFolders(node: CrmFolderNode): Array<{ label: string; path: string }> {
    const current = [{ label: node.path ? `/${node.path}` : '/', path: node.path }]
    return current.concat(node.children.flatMap((child) => flattenFolders(child)))
  }

  const folderOptions = snapshot ? flattenFolders(snapshot.tree) : [{ label: '/', path: '' }]
  const moveFolderOptions = folderOptions.filter((option) => {
    if (!selectedItem || selectedItem.type !== 'folder') return true
    if (option.path === selectedItem.path) return false
    if (option.path.startsWith(`${selectedItem.path}/`)) return false
    return true
  })

  async function handleCreateFolder() {
    if (!snapshot) return
    setBusy(true)
    try {
      const response = await fetch('/api/crm/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create-folder', path: snapshot.currentPath, name: newFolderName }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<{ path: string }>
      if (!json.success) {
        setFeedback(json.error || 'No se pudo crear la carpeta.')
        return
      }
      setFolderDialogOpen(false)
      setNewFolderName('')
      setFeedback('Carpeta creada correctamente.')
      await loadSnapshot(snapshot.currentPath)
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload(files: FileList | File[] | null) {
    if (!files || !snapshot) return
    const list = Array.from(files)
    if (!list.length) return

    setBusy(true)
    try {
      const formData = new FormData()
      formData.append('path', snapshot.currentPath)
      list.forEach((file) => formData.append('files', file))

      const response = await fetch('/api/crm/files', { method: 'POST', body: formData })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<Array<{ path: string }>>
      if (!json.success) {
        setFeedback(json.error || 'No se pudieron subir los archivos.')
        return
      }
      setFeedback(`${list.length} archivo(s) subidos correctamente.`)
      await loadSnapshot(snapshot.currentPath)
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete(item: CrmFileItem) {
    if (!snapshot) return
    const confirmed = window.confirm(`¿Seguro que quieres eliminar ${item.type === 'folder' ? 'la carpeta' : 'el archivo'} ${item.name}?`)
    if (!confirmed) return

    setBusy(true)
    try {
      const response = await fetch('/api/crm/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<{ type: string }>
      if (!json.success) {
        setFeedback(json.error || 'No se pudo eliminar el elemento.')
        return
      }
      if (selectedItem?.path === item.path) {
        setPreviewDialogOpen(false)
        setSelectedItem(null)
      }
      setFeedback(`${item.type === 'folder' ? 'Carpeta' : 'Archivo'} eliminado.`)
      await loadSnapshot(snapshot.currentPath)
    } finally {
      setBusy(false)
    }
  }

  function openRenameDialog(item: CrmFileItem) {
    setSelectedItem(item)
    setRenameValue(item.name)
    setRenameDialogOpen(true)
  }

  function openMoveDialog(item: CrmFileItem) {
    setSelectedItem(item)
    setMoveTargetPath(item.directoryPath)
    setMoveDialogOpen(true)
  }

  async function handleRename() {
    if (!selectedItem) return
    setBusy(true)
    try {
      const response = await fetch('/api/crm/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', path: selectedItem.path, newName: renameValue }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<CrmFileItem>
      if (!json.success) {
        setFeedback(json.error || 'No se pudo renombrar el elemento.')
        return
      }
      setFeedback('Nombre actualizado correctamente.')
      setRenameDialogOpen(false)
      setSelectedItem(null)
      await loadSnapshot(snapshot?.currentPath || '')
    } finally {
      setBusy(false)
    }
  }

  async function handleMove() {
    if (!selectedItem) return
    setBusy(true)
    try {
      const response = await fetch('/api/crm/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', path: selectedItem.path, targetDirectoryPath: moveTargetPath }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<CrmFileItem>
      if (!json.success) {
        setFeedback(json.error || 'No se pudo mover el elemento.')
        return
      }
      setFeedback('Elemento movido correctamente.')
      setMoveDialogOpen(false)
      setSelectedItem(null)
      await loadSnapshot(snapshot?.currentPath || '')
    } finally {
      setBusy(false)
    }
  }

  async function loadTeamUsers() {
    const response = await fetch('/api/crm/files/team-users', { cache: 'no-store' })
    const json = (await response.json().catch(() => ({}))) as JsonResponse<CrmFilesTeamUser[]>
    if (!json.success || !json.data) {
      setFeedback(json.error || 'No se pudo cargar el equipo de la empresa.')
      return
    }
    setTeamUsers(json.data)
  }

  function openShareDialog(item: CrmFileItem) {
    setSelectedItem(item)
    setShareUserIds(item.sharedWithUserIds)
    setShareDialogOpen(true)
    if (!teamUsers.length) {
      void loadTeamUsers()
    }
  }

  function openPreview(item: CrmFileItem) {
    if (item.type === 'folder') {
      void loadSnapshot(item.path)
      return
    }
    setSelectedItem(item)
    setPreviewDialogOpen(true)
  }

  async function handleShareUpdate() {
    if (!selectedItem) return
    setBusy(true)
    try {
      const response = await fetch('/api/crm/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'share', path: selectedItem.path, sharedWithUserIds: shareUserIds }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<CrmFileItem>
      if (!json.success) {
        setFeedback(json.error || 'No se pudo actualizar el acceso compartido.')
        return
      }
      setFeedback('Compartición actualizada correctamente.')
      setShareDialogOpen(false)
      await loadSnapshot(snapshot?.currentPath || '')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyDeepLink(item: CrmFileItem) {
    const url = new URL(window.location.href)
    url.searchParams.set('path', item.directoryPath)
    url.searchParams.set('preview', item.path)
    await navigator.clipboard.writeText(url.toString())
    setFeedback('Enlace copiado. Abrirá la carpeta y la previsualización del archivo.')
  }

  function handleDownload(item: CrmFileItem) {
    if (!item.url) return
    const anchor = document.createElement('a')
    anchor.href = item.url
    anchor.download = item.name
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  function toggleSharedUser(userId: string) {
    setShareUserIds((current) => current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId])
  }

  function toggleFolderExpanded(path: string) {
    setExpandedFolders((current) => current.includes(path) ? current.filter((item) => item !== path) : [...current, path])
  }

  function renderItemActions(item: CrmFileItem) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-xl"
            disabled={busy}
            aria-label={`Acciones para ${item.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
          <DropdownMenuItem onClick={() => openPreview(item)}>
            <Eye className="mr-2 h-4 w-4" />
            Ver
          </DropdownMenuItem>
          {item.url ? (
            <DropdownMenuItem onClick={() => void handleCopyDeepLink(item)}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar enlace
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => openShareDialog(item)}>
            <Share2 className="mr-2 h-4 w-4" />
            Compartir
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openRenameDialog(item)}>
            <Pencil className="mr-2 h-4 w-4" />
            Renombrar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openMoveDialog(item)}>
            <FolderInput className="mr-2 h-4 w-4" />
            Mover
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void handleDelete(item)} className="text-rose-700 focus:text-rose-700">
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  function renderTree(node: CrmFolderNode, depth = 0): ReactElement {
    const isRoot = depth === 0
    const isActive = snapshot?.currentPath === node.path
    const hasChildren = node.children.length > 0
    const isExpanded = expandedFolders.includes(node.path)

    return (
      <div key={node.path || 'root'} className="space-y-1">
        <div
          className={`flex items-center gap-1 rounded-xl pr-2 transition-colors ${isActive ? 'bg-sky-100 text-sky-900' : 'text-slate-700 hover:bg-slate-100'}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <button
            type="button"
            onClick={() => hasChildren ? toggleFolderExpanded(node.path) : void 0}
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${hasChildren ? 'hover:bg-white/80' : 'opacity-40'}`}
            aria-label={hasChildren ? `${isExpanded ? 'Contraer' : 'Expandir'} ${isRoot ? 'Raíz CRM' : node.name}` : undefined}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <span className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (hasChildren && !isExpanded) {
                toggleFolderExpanded(node.path)
              }
              void loadSnapshot(node.path)
            }}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left text-sm"
          >
            <Folder className="h-4 w-4 shrink-0" />
            <span className="truncate">{isRoot ? 'Raíz CRM' : node.name}</span>
          </button>
        </div>
        {hasChildren && isExpanded ? (
          <div className="space-y-1">
            {node.children.map((child) => renderTree(child, depth + 1))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4.5 pb-4">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'CRM', href: '/dashboard/crm' }, { label: 'Administrador de archivos' }]}
        eyebrow="Repositorio operativo"
        title="Administrador de archivos"
        description="Centraliza assets comerciales, documentos, audios y piezas de soporte del CRM con estructura por carpetas, historial y acceso directo desde el dashboard."
        actions={
          <>
            <Button variant="outline" className="rounded-2xl border-slate-200 bg-white/85" onClick={() => setFolderDialogOpen(true)} disabled={busy || loading}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Nueva carpeta
            </Button>
            <Button className="rounded-2xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => fileInputRef.current?.click()} disabled={busy || loading}>
              <Upload className="mr-2 h-4 w-4" />
              {busy ? 'Procesando...' : 'Cargar archivos'}
            </Button>
          </>
        }
        stats={[
          { label: 'Total', value: snapshot ? formatBytes(snapshot.usage.totalBytes) : '—', hint: 'Capacidad reservada para CRM', tone: 'neutral' },
          { label: 'Gratis', value: snapshot ? formatBytes(snapshot.usage.freeBytes) : '—', hint: 'Espacio disponible hoy', tone: 'teal' },
          { label: 'Usado', value: snapshot ? formatBytes(snapshot.usage.usedBytes) : '—', hint: `${snapshot?.usage.filesCount ?? 0} archivos y ${snapshot?.usage.foldersCount ?? 0} carpetas`, tone: 'amber' },
        ]}
      />

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => void handleUpload(event.target.files)} />

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardInfoHeader
              title={<CardTitle className="text-xl">Estructura</CardTitle>}
              description="Navega carpetas del CRM y mantén assets organizados por área, cliente o canal."
              tone="data"
            />
          </CardHeader>
          <CardContent className="max-h-[70vh] space-y-3 overflow-y-auto p-4 md:p-5">
            {snapshot ? renderTree(snapshot.tree) : <p className="text-sm text-slate-500">Cargando árbol...</p>}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.32)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardInfoHeader
              title={<CardTitle className="text-xl">Studio de archivos</CardTitle>}
              description={snapshot?.currentPath ? `Carpeta actual: /${snapshot.currentPath}` : 'Carpeta raíz del CRM con historial reciente y vista por grid o lista.'}
              tone="action"
              actions={<div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre" className="rounded-xl pl-9" />
                </div>
                <DataViewToggle mode={viewMode} onChange={setViewMode} />
              </div>}
            />
          </CardHeader>
          <CardContent className="space-y-4 p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600">
              {snapshot?.breadcrumbs.map((crumb, index) => (
                <div key={`${crumb.path}-${index}`} className="inline-flex items-center gap-2">
                  <button type="button" className="rounded-full px-2 py-1 hover:bg-white" onClick={() => void loadSnapshot(crumb.path)}>
                    {crumb.label}
                  </button>
                  {index < (snapshot.breadcrumbs.length - 1) ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
                </div>
              ))}
            </div>

            {feedback ? <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{feedback}</div> : null}

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'files' | 'history')} className="space-y-4">
              <TabsList className="rounded-2xl bg-slate-100 p-1">
                <TabsTrigger value="files" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Lista de archivos</TabsTrigger>
                <TabsTrigger value="history" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Historial</TabsTrigger>
              </TabsList>

              <TabsContent value="files" className="space-y-4">
                {loading ? <p className="text-sm text-slate-500">Cargando archivos...</p> : null}
                {!loading && !visibleItems.length ? (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <Plus className="h-8 w-8 text-slate-500" />
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <p className="text-base font-semibold text-slate-900">Esta carpeta está vacía</p>
                      <InfoHint content="Crea una carpeta nueva o sube archivos para empezar a organizar el CRM." label="Ver ayuda de carpeta vacía" />
                    </div>
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => setFolderDialogOpen(true)} disabled={busy}>
                        <FolderPlus className="mr-2 h-4 w-4" />
                        Nueva carpeta
                      </Button>
                      <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                        <Upload className="mr-2 h-4 w-4" />
                        Subir archivos
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!loading && visibleItems.length && viewMode === 'grid' ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {visibleItems.map((item) => {
                      const visual = getItemVisual(item.type)
                      const Icon = visual.icon
                      return (
                        <div key={item.path} className="overflow-hidden rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fbfdff)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                          <button
                            type="button"
                            className="block w-full text-left"
                            onClick={() => {
                              if (item.type === 'folder') {
                                void loadSnapshot(item.path)
                                return
                              }
                              openPreview(item)
                            }}
                          >
                            <div className={`flex h-36 items-center justify-center border-b ${visual.tone}`}>
                              {item.type === 'image' && item.url ? (
                                <div className="relative h-full w-full">
                                  <Image src={item.url} alt={item.name} fill className="object-cover" sizes="(max-width: 1280px) 50vw, 25vw" unoptimized />
                                </div>
                              ) : (
                                <Icon className="h-10 w-10" />
                              )}
                            </div>
                            <div className="space-y-2 p-4">
                              <div>
                                <p className="line-clamp-2 font-medium text-slate-950">{item.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{item.type === 'folder' ? 'Carpeta' : `${formatBytes(item.sizeBytes)} · ${formatDate(item.updatedAt)}`}</p>
                                {item.sharedWithUserIds.length ? <p className="mt-1 text-[11px] text-sky-700">Compartido con {item.sharedWithUserIds.length} usuario(s)</p> : null}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{item.type}</span>
                                <div onClick={(event) => event.stopPropagation()}>
                                  {renderItemActions(item)}
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {!loading && visibleItems.length && viewMode === 'list' ? (
                  <div className="overflow-hidden rounded-[24px] border border-slate-200">
                    {visibleItems.map((item) => {
                      const visual = getItemVisual(item.type)
                      const Icon = visual.icon
                      return (
                        <div key={item.path} className="grid grid-cols-[minmax(0,1.5fr)_0.7fr_0.8fr_auto] items-center gap-4 border-b border-slate-100 px-4 py-3 last:border-b-0">
                          <button type="button" className="flex min-w-0 items-center gap-3 text-left" onClick={() => item.type === 'folder' ? void loadSnapshot(item.path) : openPreview(item)}>
                            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${visual.tone}`}><Icon className="h-5 w-5" /></span>
                            <span className="truncate font-medium text-slate-950">{item.name}</span>
                          </button>
                          <span className="text-sm text-slate-500">{item.type === 'folder' ? 'Carpeta' : formatBytes(item.sizeBytes)}</span>
                          <span className="text-sm text-slate-500">{formatDate(item.updatedAt)}</span>
                          <div className="flex justify-end">
                            {renderItemActions(item)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="history" className="space-y-3">
                {!visibleRecentItems.length ? <p className="text-sm text-slate-500">Todavía no hay actividad reciente.</p> : null}
                {visibleRecentItems.map((item) => {
                  const visual = getItemVisual(item.type)
                  const Icon = visual.icon
                  return (
                    <div key={`${item.path}-${item.updatedAt}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${visual.tone}`}><Icon className="h-5 w-5" /></span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-950">{item.name}</p>
                          <p className="truncate text-sm text-slate-500">/{item.directoryPath || ''} · {formatDate(item.updatedAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="hidden text-sm text-slate-500 md:inline">{formatBytes(item.sizeBytes)}</span>
                        <Button variant="outline" className="rounded-xl" onClick={() => openPreview(item)}>Ver</Button>
                        {item.url ? <Button variant="outline" className="rounded-xl" onClick={() => void handleCopyDeepLink(item)}>Copiar enlace</Button> : null}
                      </div>
                    </div>
                  )
                })}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva carpeta</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="Ej. propuestas-marzo" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleCreateFolder()} disabled={busy || !newFolderName.trim()}>Crear carpeta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Renombrar elemento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} placeholder="Nuevo nombre" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleRename()} disabled={busy || !renameValue.trim()}>Guardar nombre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mover a otra carpeta</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Select value={moveTargetPath} onValueChange={setMoveTargetPath}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una carpeta destino" />
              </SelectTrigger>
              <SelectContent>
                {moveFolderOptions.map((option) => (
                  <SelectItem key={option.path || 'root'} value={option.path}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleMove()} disabled={busy}>Mover elemento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Compartir con usuarios de la empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Elemento: <span className="font-medium text-slate-900">{selectedItem?.name || 'Sin selección'}</span>
            </div>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto">
              {teamUsers.map((user) => {
                const checked = shareUserIds.includes(user.id)
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleSharedUser(user.id)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-colors ${checked ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div>
                      <p className="font-medium text-slate-950">{user.name || user.email}</p>
                      <p className="text-xs text-slate-500">{user.email} · {user.role}</p>
                    </div>
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${checked ? 'border-sky-300 bg-sky-600 text-white' : 'border-slate-200 text-slate-400'}`}>
                      <Check className="h-4 w-4" />
                    </span>
                  </button>
                )
              })}
              {!teamUsers.length ? <p className="text-sm text-slate-500">No hay usuarios disponibles para compartir.</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleShareUpdate()} disabled={busy}>Guardar acceso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name || 'Previsualización'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 lg:grid-cols-[minmax(0,1.4fr)_320px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                /{selectedItem?.directoryPath || ''}
              </div>
              {selectedItem?.type === 'image' && selectedItem.url ? (
                <div className="relative h-[60vh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
                  <Image src={selectedItem.url} alt={selectedItem.name} fill className="object-contain" sizes="90vw" unoptimized />
                </div>
              ) : null}
              {selectedItem?.type === 'video' && selectedItem.url ? (
                <video src={selectedItem.url} controls className="max-h-[60vh] w-full rounded-2xl border border-slate-200 bg-black" />
              ) : null}
              {selectedItem?.type === 'audio' && selectedItem.url ? (
                <audio src={selectedItem.url} controls className="w-full" />
              ) : null}
              {selectedItem?.mimeType === 'application/pdf' && selectedItem.url ? (
                <iframe src={selectedItem.url} title={selectedItem.name} className="h-[60vh] w-full rounded-2xl border border-slate-200 bg-white" />
              ) : null}
              {selectedItem && selectedItem.type === 'document' && selectedItem.mimeType !== 'application/pdf' ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-600">
                  Vista previa directa no disponible para este formato. Usa el enlace para abrir el archivo original.
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Control</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p><span className="font-semibold text-slate-950">Tipo:</span> {selectedItem?.type || 'Sin dato'}</p>
                  <p><span className="font-semibold text-slate-950">Tamaño:</span> {selectedItem ? formatBytes(selectedItem.sizeBytes) : 'Sin dato'}</p>
                  <p><span className="font-semibold text-slate-950">Actualizado:</span> {selectedItem ? formatDate(selectedItem.updatedAt) : 'Sin dato'}</p>
                  <p><span className="font-semibold text-slate-950">Compartido con:</span> {selectedItem?.sharedWithUserIds.length || 0} usuario(s)</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Auditoría</p>
                <div className="mt-3 space-y-3">
                  {selectedItem?.auditTrail.length ? selectedItem.auditTrail.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-sm font-medium text-slate-900">{entry.message}</p>
                      <p className="mt-1 text-xs text-slate-500">{entry.actorLabel || 'Sistema'} · {formatDate(entry.at)}</p>
                    </div>
                  )) : <p className="text-sm text-slate-500">Sin auditoría disponible todavía.</p>}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            {selectedItem ? <Button variant="outline" onClick={() => openShareDialog(selectedItem)}><Share2 className="mr-2 h-4 w-4" />Compartir</Button> : null}
            {selectedItem?.url ? <Button variant="outline" onClick={() => handleDownload(selectedItem)}><Download className="mr-2 h-4 w-4" />Descargar</Button> : null}
            {selectedItem ? <Button variant="outline" onClick={() => { setPreviewDialogOpen(false); openMoveDialog(selectedItem) }}><FolderInput className="mr-2 h-4 w-4" />Mover</Button> : null}
            {selectedItem ? <Button variant="outline" className="text-rose-700 hover:text-rose-700" onClick={() => void handleDelete(selectedItem)}><Trash2 className="mr-2 h-4 w-4" />Borrar</Button> : null}
            {selectedItem?.url ? <Button variant="outline" onClick={() => void handleCopyDeepLink(selectedItem)}><Copy className="mr-2 h-4 w-4" />Copiar enlace</Button> : null}
            {selectedItem?.url ? <Button variant="outline" onClick={() => window.open(selectedItem.url!, '_blank', 'noopener,noreferrer')}>Abrir original</Button> : null}
            <Button onClick={() => setPreviewDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}