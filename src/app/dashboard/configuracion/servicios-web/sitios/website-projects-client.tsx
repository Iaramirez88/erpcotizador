'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ExternalLink, FilePenLine, Loader2, MoreVertical, Plus, Power, Search, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { buildWebsitePublicUrl } from '@/lib/website-builder'

type WebsiteProjectPageItem = {
  id: string
  nombre: string
  slug: string
  isHome: boolean
  status: string
  createdAt: string
  updatedAt: string
}

type WebsiteProjectItem = {
  id: string
  nombre: string
  slug: string
  subdomain: string | null
  primaryDomain: string | null
  status: string
  createdAt: string
  updatedAt: string
  pages: WebsiteProjectPageItem[]
}

function buildRopInviteHref(project: WebsiteProjectItem) {
  const params = new URLSearchParams()
  const pagesSummary = project.pages
    .slice(0, 3)
    .map((page) => page.nombre)
    .filter(Boolean)
    .join(', ')

  params.set('title', `Aliados para proyecto ${project.nombre}`)
  params.set(
    'descriptionPublic',
    `Proyecto digital ${project.nombre} en estado ${project.status}. Buscamos aliados para acelerar entrega, contenido o ejecución complementaria${pagesSummary ? `. Páginas iniciales: ${pagesSummary}.` : '.'}`
  )
  params.set(
    'requirementsPrivate',
    `Origen ERP: proyecto web ${project.id}. Dominio base: ${project.subdomain || project.slug}. Páginas registradas: ${project.pages.length}.`
  )
  params.set('sourceRef', `website-project:${project.id}`)
  params.set('sourceType', 'OPS_SIGNAL')
  return `/dashboard/rop/necesidades/nueva?${params.toString()}`
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

export default function WebsiteProjectsClient() {
  const { toast } = useToast()
  const [projects, setProjects] = useState<WebsiteProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingProject, setCreatingProject] = useState(false)
  const [creatingPageForProjectId, setCreatingPageForProjectId] = useState<string | null>(null)
  const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [newPageNames, setNewPageNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    async function loadProjects() {
      setLoading(true)
      try {
        const response = await fetch('/api/servicios-web/projects')
        const data = await response.json()
        if (!response.ok || !data.ok) {
          throw new Error(data.error || 'No se pudieron cargar los sitios.')
        }

        if (!cancelled) {
          setProjects(data.items ?? [])
        }
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'No se pudo cargar Sitios',
            description: error instanceof Error ? error.message : 'Intenta nuevamente.',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProjects()
    return () => {
      cancelled = true
    }
  }, [toast])

  async function handleCreateProject() {
    if (!newProjectName.trim()) {
      toast({ title: 'Nombre requerido', description: 'Escribe el nombre del sitio antes de crearlo.', variant: 'destructive' })
      return
    }

    setCreatingProject(true)
    try {
      const response = await fetch('/api/servicios-web/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newProjectName.trim() }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo crear el sitio.')
      }

      setProjects((current) => [data.item, ...current])
      setNewProjectName('')
      toast({ title: 'Sitio creado', description: 'Ya puedes entrar al builder de la página Inicio.' })
    } catch (error) {
      toast({
        title: 'Error creando sitio',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setCreatingProject(false)
    }
  }

  async function handleCreatePage(projectId: string) {
    const nombre = String(newPageNames[projectId] ?? '').trim()
    if (!nombre) {
      toast({ title: 'Nombre requerido', description: 'Escribe el nombre de la página antes de crearla.', variant: 'destructive' })
      return
    }

    setCreatingPageForProjectId(projectId)
    try {
      const response = await fetch(`/api/servicios-web/projects/${projectId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo crear la página.')
      }

      setProjects((current) => current.map((project) => (
        project.id === projectId
          ? { ...project, pages: [...project.pages, data.item] }
          : project
      )))
      setNewPageNames((current) => ({ ...current, [projectId]: '' }))
      toast({ title: 'Página creada', description: 'La nueva página ya está lista para editarse.' })
    } catch (error) {
      toast({
        title: 'Error creando página',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setCreatingPageForProjectId(null)
    }
  }

  async function handleProjectStatus(project: WebsiteProjectItem, status: 'DRAFT' | 'DISABLED') {
    const actionLabel = status === 'DRAFT' ? 'pasar a borrador' : 'deshabilitar'
    if (!window.confirm(`¿Quieres ${actionLabel} el sitio "${project.nombre}"? Dejará de estar disponible públicamente.`)) return

    setUpdatingProjectId(project.id)
    try {
      const response = await fetch(`/api/servicios-web/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo actualizar el sitio.')

      setProjects((current) => current.map((item) => (
        item.id === project.id ? { ...item, status: data.item.status, updatedAt: data.item.updatedAt } : item
      )))
      toast({ title: status === 'DRAFT' ? 'Sitio en borrador' : 'Sitio deshabilitado' })
    } catch (error) {
      toast({
        title: 'No se pudo actualizar el sitio',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setUpdatingProjectId(null)
    }
  }

  async function handleDeleteProject(project: WebsiteProjectItem) {
    if (!window.confirm(`¿Eliminar definitivamente el sitio "${project.nombre}" y todas sus páginas? Esta acción no se puede deshacer.`)) return

    setUpdatingProjectId(project.id)
    try {
      const response = await fetch(`/api/servicios-web/projects/${project.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar el sitio.')

      setProjects((current) => current.filter((item) => item.id !== project.id))
      toast({ title: 'Sitio eliminado', description: `${project.nombre} y sus páginas fueron eliminados.` })
    } catch (error) {
      toast({
        title: 'No se pudo eliminar el sitio',
        description: error instanceof Error ? error.message : 'Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setUpdatingProjectId(null)
    }
  }

  return (
    <Card className="rounded-[26px] border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-amber-500" />
          Sitios editables
        </CardTitle>
        <CardDescription>
          Crea sitios, abre su página Inicio y entra al builder visual con persistencia JSON y versionado básico.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="space-y-2">
            <Label htmlFor="website-project-name">Nombre del sitio</Label>
            <Input
              id="website-project-name"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Ej. Clínica Dental Norte"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleCreateProject} disabled={creatingProject} className="w-full md:w-auto">
              {creatingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Crear sitio
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando sitios...
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-sm text-slate-500">
            Aún no hay sitios creados. El primer sitio se crea con una página Inicio lista para editar.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {projects.map((project) => (
              <div key={project.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">{project.nombre}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      /{project.slug} · {project.subdomain || 'sin subdominio'} · actualizado {formatDate(project.updatedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                      {project.status}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" disabled={updatingProjectId === project.id} aria-label={`Acciones para ${project.nombre}`}>
                          {updatingProjectId === project.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[190px]">
                        <DropdownMenuItem disabled={project.status === 'DRAFT'} onSelect={() => void handleProjectStatus(project, 'DRAFT')}>
                          <FilePenLine className="mr-2 h-4 w-4" />
                          Pasar a borrador
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={project.status === 'DISABLED'} onSelect={() => void handleProjectStatus(project, 'DISABLED')}>
                          <Power className="mr-2 h-4 w-4" />
                          Deshabilitar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-700 focus:text-rose-700" onSelect={() => void handleDeleteProject(project)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline" className="rounded-full px-4">
                    <Link href={`/dashboard/configuracion/servicios-web/sitios/${project.id}/seo`}><Search className="mr-2 h-3.5 w-3.5" />SEO y posición</Link>
                  </Button>
                  <Button asChild size="sm" className="rounded-full px-4">
                    <Link href={buildRopInviteHref(project)}>Invitar empresas</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="rounded-full px-4">
                    <Link href="/dashboard/rop/empresas">Explorar red ROP</Link>
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {project.pages.map((page) => (
                    <div key={page.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{page.nombre}{page.isHome ? ' · Home' : ''}</div>
                        <div className="text-xs text-slate-500">/{page.slug} · {page.status}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={buildWebsitePublicUrl(project.subdomain || project.slug, page.slug, page.isHome)} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver sitio
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/configuracion/servicios-web/sitios/${project.id}/pages/${page.id}/builder`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir builder
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <Input
                    value={newPageNames[project.id] ?? ''}
                    onChange={(event) => setNewPageNames((current) => ({ ...current, [project.id]: event.target.value }))}
                    placeholder="Nueva página, ej. Servicios"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={creatingPageForProjectId === project.id}
                    onClick={() => handleCreatePage(project.id)}
                  >
                    {creatingPageForProjectId === project.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Agregar página
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}