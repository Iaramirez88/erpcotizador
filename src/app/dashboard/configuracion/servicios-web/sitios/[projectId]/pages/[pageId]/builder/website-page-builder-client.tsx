'use client'

import '@puckeditor/core/puck.css'

import Link from 'next/link'
import { Puck, type Data } from '@puckeditor/core'
import { useState, useTransition } from 'react'
import { Loader2, Save, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { websiteBuilderPuckConfig } from '@/components/website-builder/puck-config'
import { buildWebsitePublicPath } from '@/lib/website-builder'

type BuilderVersion = {
  id: string
  versionNumber: number
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
  const [data, setData] = useState<Data>(initialData as Data)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [publishedVersions, setPublishedVersions] = useState<BuilderVersion[]>(versions)
  const [isSavingDraft, startSavingDraft] = useTransition()
  const [isPublishing, startPublishing] = useTransition()
  const previewPath = `/dashboard/configuracion/servicios-web/sitios/${projectId}/pages/${pageId}/preview`
  const publicPath = buildWebsitePublicPath(projectSubdomain, pageSlug, isHome)

  function handleSaveDraft() {
    startSavingDraft(async () => {
      try {
        const response = await fetch(`/api/servicios-web/pages/${pageId}/draft`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        })
        const payload = await response.json()
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || 'No se pudo guardar el borrador.')
        }

        setDraftSavedAt(new Date().toISOString())
        toast({ title: 'Borrador guardado', description: 'El árbol JSON del builder quedó persistido.' })
      } catch (error) {
        toast({
          title: 'Error guardando borrador',
          description: error instanceof Error ? error.message : 'Intenta nuevamente.',
          variant: 'destructive',
        })
      }
    })
  }

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

  return (
    <div className="space-y-4">
      <Card className="rounded-[26px] border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950">{projectName} / {pageName}</div>
            <div className="mt-1 text-sm text-slate-500">
              Proyecto {projectId.slice(0, 8)} · Página {pageId.slice(0, 8)}
              {draftSavedAt ? ` · borrador guardado ${formatDate(draftSavedAt)}` : ''}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild type="button" variant="secondary">
              <Link href={previewPath} target="_blank" rel="noreferrer">
                Ver preview
              </Link>
            </Button>
            <Button asChild type="button" variant="secondary" disabled={publishedVersions.length === 0}>
              <Link href={publicPath} target="_blank" rel="noreferrer">
                Ver publicado
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSavingDraft || isPublishing}>
              {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar borrador
            </Button>
            <Button type="button" onClick={() => handlePublish(data)} disabled={isSavingDraft || isPublishing}>
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Publicar versión
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_320px]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <Puck
            config={websiteBuilderPuckConfig}
            data={data}
            onChange={(nextData) => setData(nextData)}
            onPublish={(nextData) => handlePublish(nextData)}
            headerTitle={`${projectName} · ${pageName}`}
          />
        </div>

        <Card className="rounded-[26px] border-slate-200 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div>
              <div className="text-sm font-semibold text-slate-950">Estado del slice</div>
              <div className="mt-1 text-sm leading-6 text-slate-600">
                Este primer builder ya persiste JSON de Puck en borrador y crea versiones publicadas sobre los modelos nuevos.
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-950">Bloques habilitados</div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Hero</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Texto</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">CTA</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-950">Versiones publicadas</div>
              {publishedVersions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                  Aún no hay versiones publicadas para esta página.
                </div>
              ) : (
                <div className="space-y-2">
                  {publishedVersions.map((version) => (
                    <div key={version.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">Versión {version.versionNumber}</div>
                      <div className="mt-1 text-xs text-slate-500">{version.isPublished ? 'Publicada' : 'Histórica'} · {formatDate(version.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}