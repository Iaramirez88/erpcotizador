'use client'

import '@puckeditor/core/puck.css'

import { Puck, type Data } from '@puckeditor/core'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { ArrowRight, Check, ChevronsDownUp, ChevronsUpDown, ExternalLink, Eye, Globe, History, LayoutTemplate, Loader2, MoreHorizontal, Pin, PinOff, RotateCcw, Save, Sparkles, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { websiteBuilderPuckConfig } from '@/components/website-builder/puck-config'
import { buildWebsitePublicPath } from '@/lib/website-builder'
import { cloneWebsiteFunnelTemplateData, WEBSITE_FUNNEL_TEMPLATES, type WebsiteFunnelTemplate } from '@/lib/website-builder-funnel-templates'
import { useUiStore } from '@/lib/ui-store'
import { cn } from '@/lib/utils'

type BuilderVersion = {
  id: string
  versionNumber: number
  editorJson: Record<string, unknown>
  isPublished: boolean
  createdAt: string
}

type Props = {
  projectId: string
  pageId: string
  projectName: string
  pageName: string
  projectSubdomain: string
  pageSlug: string
  isHome: boolean
  initialData: Record<string, unknown>
  versions: BuilderVersion[]
}

type BuilderActionKey = 'templates' | 'preview' | 'published' | 'save' | 'publish' | 'history'

const BUILDER_PINNED_ACTIONS_KEY = 'website_builder_pinned_actions'
const BUILDER_ACTION_KEYS: BuilderActionKey[] = ['templates', 'preview', 'published', 'save', 'publish', 'history']

function readPinnedActions(): BuilderActionKey[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(BUILDER_PINNED_ACTIONS_KEY) || '[]')
    return Array.isArray(stored)
      ? stored.filter((value): value is BuilderActionKey => BUILDER_ACTION_KEYS.includes(value as BuilderActionKey))
      : []
  } catch {
    return []
  }
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

export default function WebsitePageBuilderClient({
  projectId,
  pageId,
  projectName,
  pageName,
  projectSubdomain,
  pageSlug,
  isHome,
  initialData,
  versions,
}: Props) {
  const { toast } = useToast()
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const [data, setData] = useState<Data>(initialData as Data)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false)
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false)
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false)
  const [appliedTemplateKey, setAppliedTemplateKey] = useState<string | null>(null)
  const [editorRevision, setEditorRevision] = useState(0)
  const [expandedView, setExpandedView] = useState(false)
  const [pinnedActions, setPinnedActions] = useState<BuilderActionKey[]>([])
  const [publishedVersions, setPublishedVersions] = useState<BuilderVersion[]>(versions)
  const [isPublishing, startPublishing] = useTransition()
  const dataRevisionRef = useRef(0)
  const savingDraftRef = useRef(false)
  const previewPath = `/dashboard/configuracion/servicios-web/sitios/${projectId}/pages/${pageId}/preview`
  const publicPath = buildWebsitePublicPath(projectSubdomain, pageSlug, isHome)

  useEffect(() => {
    setPinnedActions(readPinnedActions())
  }, [])

  function togglePinnedAction(actionKey: BuilderActionKey) {
    setPinnedActions((current) => {
      const next = current.includes(actionKey)
        ? current.filter((key) => key !== actionKey)
        : [...current, actionKey]
      window.localStorage.setItem(BUILDER_PINNED_ACTIONS_KEY, JSON.stringify(next))
      return next
    })
  }

  async function persistDraft(nextData: Data, notify: boolean) {
    if (savingDraftRef.current) return
    savingDraftRef.current = true
    setIsSavingDraft(true)
    const savedRevision = dataRevisionRef.current
    try {
      const response = await fetch(`/api/servicios-web/pages/${pageId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: nextData }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'No se pudo guardar el borrador.')
      }

      setDraftSavedAt(new Date().toISOString())
      if (dataRevisionRef.current === savedRevision) setIsDirty(false)
      if (notify) {
        toast({ title: 'Borrador guardado', description: 'El árbol JSON del builder quedó persistido.' })
      }
    } catch (error) {
      if (notify) {
        toast({
          title: 'Error guardando borrador',
          description: error instanceof Error ? error.message : 'Intenta nuevamente.',
          variant: 'destructive',
        })
      }
    } finally {
      savingDraftRef.current = false
      setIsSavingDraft(false)
    }
  }

  function handleSaveDraft() {
    void persistDraft(data, true)
  }

  function handleBuilderChange(nextData: Data) {
    dataRevisionRef.current += 1
    setData(nextData)
    setIsDirty(true)
  }

  function applyTemplate(template: WebsiteFunnelTemplate) {
    const currentContent = Array.isArray(data.content) ? data.content : []
    if (currentContent.length > 0 && !window.confirm(`Aplicar “${template.name}” reemplazará los bloques actuales de esta página. El último borrador guardado seguirá disponible hasta el próximo autoguardado. ¿Continuar?`)) {
      return
    }

    const nextData = cloneWebsiteFunnelTemplateData(template)
    dataRevisionRef.current += 1
    setData(nextData)
    setIsDirty(true)
    setAppliedTemplateKey(template.key)
    setEditorRevision((current) => current + 1)
    setTemplateGalleryOpen(false)
    toast({ title: `${template.name} aplicada`, description: 'Todos los bloques quedaron listos para personalizar.' })
  }

  function restoreVersion(version: BuilderVersion) {
    if (!window.confirm(`Restaurar la versión ${version.versionNumber} reemplazará el borrador visible. La versión publicada actual no cambiará hasta que vuelvas a publicar. ¿Continuar?`)) return

    dataRevisionRef.current += 1
    setData(version.editorJson as Data)
    setIsDirty(true)
    setEditorRevision((current) => current + 1)
    toast({ title: `Versión ${version.versionNumber} restaurada`, description: 'Se cargó como borrador editable. Revisa los cambios antes de publicar.' })
  }

  useEffect(() => {
    if (!isDirty || isSavingDraft || isPublishing) return
    const timeout = window.setTimeout(() => void persistDraft(data, false), 3000)
    return () => window.clearTimeout(timeout)
  }, [data, isDirty, isPublishing, isSavingDraft])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void persistDraft(data, true)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [data])

  function handlePublish(nextData: Data) {
    startPublishing(async () => {
      try {
        const response = await fetch(`/api/servicios-web/pages/${pageId}/versions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: nextData }),
        })
        const payload = await response.json()
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || 'No se pudo publicar la versión.')
        }

        setData(nextData)
        setPublishedVersions((current) => [payload.item, ...current.filter((item) => item.id !== payload.item.id)])
        setDraftSavedAt(new Date().toISOString())
        toast({ title: 'Versión publicada', description: `Se creó la versión ${payload.item.versionNumber} de esta página.` })
      } catch (error) {
        toast({
          title: 'Error publicando',
          description: error instanceof Error ? error.message : 'Intenta nuevamente.',
          variant: 'destructive',
        })
      }
    })
  }

  const builderActions = [
    {
      key: 'templates' as const,
      label: 'Plantillas',
      icon: LayoutTemplate,
      onSelect: () => setTemplateGalleryOpen(true),
    },
    {
      key: 'preview' as const,
      label: 'Ver preview',
      icon: Eye,
      onSelect: () => window.open(previewPath, '_blank', 'noopener,noreferrer'),
    },
    {
      key: 'published' as const,
      label: 'Ver publicado',
      icon: Globe,
      disabled: publishedVersions.length === 0,
      onSelect: () => window.open(publicPath, '_blank', 'noopener,noreferrer'),
    },
    {
      key: 'save' as const,
      label: isSavingDraft ? 'Guardando...' : 'Guardar borrador',
      icon: isSavingDraft ? Loader2 : Save,
      disabled: isSavingDraft || isPublishing,
      loading: isSavingDraft,
      onSelect: handleSaveDraft,
    },
    {
      key: 'publish' as const,
      label: isPublishing ? 'Publicando...' : 'Publicar versión',
      icon: isPublishing ? Loader2 : UploadCloud,
      disabled: isSavingDraft || isPublishing,
      loading: isPublishing,
      primary: true,
      onSelect: () => handlePublish(data),
    },
    {
      key: 'history' as const,
      label: 'Historial de versiones',
      icon: History,
      onSelect: () => setVersionHistoryOpen(true),
    },
  ]

  const puckOverrides = useMemo(() => ({
    headerActions: ({ children }: { children: React.ReactNode }) => (
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => setExpandedView((current) => !current)}>
          {expandedView ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
          {expandedView ? 'Contraer vista' : 'Expandir vista'}
        </Button>
        {children}
      </div>
    ),
  }), [expandedView])

  return (
    <div
      className={cn(
        'space-y-4',
        expandedView && 'fixed inset-2 z-[85] overflow-auto rounded-[22px] bg-white p-2 shadow-2xl',
        expandedView && (sidebarCollapsed ? 'md:left-[4.75rem]' : 'md:left-[14.5rem]'),
      )}
    >
      {!expandedView ? <Card className="rounded-[26px] border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950">{projectName} / {pageName}</div>
            <div className="mt-1 text-sm text-slate-500">
              Proyecto {projectId.slice(0, 8)} · Página {pageId.slice(0, 8)}
              {draftSavedAt ? ` · borrador guardado ${formatDate(draftSavedAt)}` : ''}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={`mr-1 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${isDirty ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isDirty ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isSavingDraft ? 'Guardando...' : isDirty ? 'Cambios pendientes' : 'Borrador al día'}
            </div>
            {builderActions.filter((action) => pinnedActions.includes(action.key)).map((action) => {
              const ActionIcon = action.icon
              return (
                <Button key={action.key} type="button" variant={action.primary ? 'default' : 'outline'} onClick={action.onSelect} disabled={action.disabled}>
                  <ActionIcon className={cn('h-4 w-4', action.loading && 'animate-spin')} />
                  <span className="hidden xl:inline">{action.label}</span>
                </Button>
              )
            })}
            <DropdownMenu open={actionsMenuOpen} onOpenChange={setActionsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" variant="outline" aria-label="Abrir acciones del builder" title="Acciones del builder">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2">
                <DropdownMenuLabel className="px-2 py-2">Acciones del builder</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="space-y-1">
                  {builderActions.map((action) => {
                    const ActionIcon = action.icon
                    const isPinned = pinnedActions.includes(action.key)
                    return (
                      <div key={action.key} className="flex items-center gap-1 rounded-md hover:bg-accent focus-within:bg-accent">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none disabled:pointer-events-none disabled:opacity-50"
                          onClick={() => {
                            setActionsMenuOpen(false)
                            action.onSelect()
                          }}
                          disabled={action.disabled}
                        >
                          <ActionIcon className={cn('h-4 w-4 shrink-0', action.loading && 'animate-spin')} />
                          <span className="truncate">{action.label}</span>
                          {(action.key === 'preview' || action.key === 'published') ? <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" /> : null}
                        </button>
                        <button
                          type="button"
                          className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground', isPinned && 'text-blue-600')}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            togglePinnedAction(action.key)
                          }}
                          aria-label={isPinned ? `Desanclar ${action.label}` : `Anclar ${action.label}`}
                          title={isPinned ? 'Quitar de la barra' : 'Anclar a la barra'}
                        >
                          {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Usa la chincheta para mantener accesos en la barra.</div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card> : null}

      <div className="space-y-4">
        <div className={cn('overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm', expandedView && 'rounded-[20px]')}>
          <Puck
            key={editorRevision}
            config={websiteBuilderPuckConfig}
            data={data}
            onChange={handleBuilderChange}
            onPublish={(nextData) => handlePublish(nextData)}
            headerTitle={`${projectName} · ${pageName}`}
            height={expandedView ? 'calc(100vh - 1rem)' : undefined}
            overrides={puckOverrides}
          />
        </div>
      </div>

      <Dialog open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border-slate-200 p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Historial de versiones</DialogTitle>
            <DialogDescription>Consulta o restaura una versión publicada como borrador editable.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto p-6">
            {publishedVersions.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                Aún no hay versiones publicadas para esta página.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {publishedVersions.map((version) => (
                  <div key={version.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div><div className="font-semibold text-slate-900">Versión {version.versionNumber}</div><div className="mt-1 text-xs text-slate-500">{version.isPublished ? 'Publicada' : 'Histórica'} · {formatDate(version.createdAt)}</div></div>
                    <Button type="button" size="icon" variant="ghost" title={`Restaurar versión ${version.versionNumber}`} aria-label={`Restaurar versión ${version.versionNumber}`} onClick={() => { restoreVersion(version); setVersionHistoryOpen(false) }}><RotateCcw className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templateGalleryOpen} onOpenChange={setTemplateGalleryOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border-slate-200 p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-blue-700"><Sparkles className="h-4 w-4" /> Kits de conversión</div>
            <DialogTitle className="mt-2 text-xl">Elige un punto de partida</DialogTitle>
            <DialogDescription>Las plantillas son opcionales. Cada sección seguirá siendo editable después de aplicarla.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto p-6">
            <div className="grid gap-5 lg:grid-cols-3">
              {WEBSITE_FUNNEL_TEMPLATES.map((template) => (
                <article key={template.key} className="flex min-h-[430px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <div className="h-40 p-5" style={{ backgroundColor: template.surface }}>
                    <div className="flex h-full flex-col justify-between rounded-md border border-black/10 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between"><div className="h-2.5 w-16 rounded-full" style={{ backgroundColor: template.accent }} /><div className="flex gap-1"><span className="h-1.5 w-8 rounded bg-slate-200" /><span className="h-1.5 w-8 rounded bg-slate-200" /></div></div>
                      <div><div className="h-2 w-16 rounded" style={{ backgroundColor: template.accent }} /><div className="mt-2 h-4 w-4/5 rounded bg-slate-900" /><div className="mt-2 h-2 w-3/5 rounded bg-slate-300" /></div>
                      <div className="h-6 w-24 rounded" style={{ backgroundColor: template.accent }} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: template.accent }}>{template.category}</div>
                    <h3 className="mt-2 text-xl font-semibold text-slate-950">{template.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{template.description}</p>
                    <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold text-slate-900">Objetivo:</span> <span className="text-slate-600">{template.objective}</span></div>
                    <div className="mt-4 flex flex-wrap gap-1.5">{template.steps.map((step, index) => <span key={step} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-600"><span className="font-semibold">{index + 1}</span>{step}</span>)}</div>
                    <Button type="button" className="mt-auto w-full" style={{ backgroundColor: template.accent }} onClick={() => applyTemplate(template)}>
                      {appliedTemplateKey === template.key ? <Check className="h-4 w-4" /> : <LayoutTemplate className="h-4 w-4" />}
                      Usar esta plantilla
                      <ArrowRight className="ml-auto h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setTemplateGalleryOpen(false)}>Continuar con mi diseño</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}