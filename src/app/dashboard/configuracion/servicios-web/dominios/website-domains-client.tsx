'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, Globe2, Loader2, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { buildWebsitePublicUrl, normalizeWebsiteSubdomain } from '@/lib/website-builder'

type WebsiteProjectItem = {
  id: string
  nombre: string
  slug: string
  subdomain: string | null
  primaryDomain: string | null
}

type AvailabilityState = {
  value: string
  available: boolean
  error?: string
} | null

export default function WebsiteDomainsClient() {
  const { toast } = useToast()
  const [projects, setProjects] = useState<WebsiteProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [availability, setAvailability] = useState<Record<string, AvailabilityState>>({})
  const [checkingProjectId, setCheckingProjectId] = useState<string | null>(null)
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadProjects() {
      try {
        const response = await fetch('/api/servicios-web/projects')
        const payload = await response.json()
        if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudieron cargar los sitios.')
        if (cancelled) return

        const items = (payload.items ?? []) as WebsiteProjectItem[]
        setProjects(items)
        setDrafts(Object.fromEntries(items.map((project) => [project.id, project.subdomain || project.slug])))
      } catch (error) {
        if (!cancelled) toast({ title: 'No se pudieron cargar los dominios', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadProjects()
    return () => { cancelled = true }
  }, [toast])

  async function checkAvailability(projectId: string) {
    const value = drafts[projectId] ?? ''
    setCheckingProjectId(projectId)
    try {
      const response = await fetch(`/api/servicios-web/projects/${projectId}/subdomain?value=${encodeURIComponent(value)}`)
      const payload = await response.json()
      setAvailability((current) => ({
        ...current,
        [projectId]: { value: normalizeWebsiteSubdomain(value), available: Boolean(payload.available), error: payload.error },
      }))
    } catch {
      setAvailability((current) => ({ ...current, [projectId]: { value: normalizeWebsiteSubdomain(value), available: false, error: 'No se pudo comprobar ahora.' } }))
    } finally {
      setCheckingProjectId(null)
    }
  }

  async function saveSubdomain(projectId: string) {
    const value = drafts[projectId] ?? ''
    setSavingProjectId(projectId)
    try {
      const response = await fetch(`/api/servicios-web/projects/${projectId}/subdomain`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain: value }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo guardar el subdominio.')

      setProjects((current) => current.map((project) => project.id === projectId ? { ...project, subdomain: payload.item.subdomain } : project))
      setDrafts((current) => ({ ...current, [projectId]: payload.item.subdomain }))
      setAvailability((current) => ({ ...current, [projectId]: { value: payload.item.subdomain, available: true } }))
      toast({ title: 'Subdominio actualizado', description: `${payload.item.subdomain}.sgdigitalordex.com ya identifica este sitio.` })
    } catch (error) {
      toast({ title: 'No se pudo guardar', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally {
      setSavingProjectId(null)
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 border-y border-slate-200 py-10 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Cargando dominios...</div>
  }

  return (
    <div className="space-y-8">
      <section className="border-y border-slate-200 bg-slate-50/70 px-5 py-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white"><Globe2 className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Subdominio gratuito</h2>
            <p className="mt-1 text-sm text-slate-600">Cada sitio incluye una dirección profesional bajo sgdigitalordex.com.</p>
          </div>
        </div>

        <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {projects.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Crea primero un sitio para asignarle un subdominio.</div>
          ) : projects.map((project) => {
            const draft = drafts[project.id] ?? ''
            const normalizedDraft = normalizeWebsiteSubdomain(draft)
            const result = availability[project.id]
            const isCurrentValue = normalizedDraft === project.subdomain
            const canSave = result?.value === normalizedDraft && result.available && !isCurrentValue
            const publicUrl = buildWebsitePublicUrl(project.subdomain || project.slug)

            return (
              <div key={project.id} className="grid gap-4 px-4 py-5 lg:grid-cols-[minmax(180px,0.7fr)_minmax(300px,1.3fr)_auto] lg:items-end">
                <div>
                  <div className="font-semibold text-slate-950">{project.nombre}</div>
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">
                    {publicUrl}<ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                <div>
                  <label htmlFor={`subdomain-${project.id}`} className="mb-1.5 block text-xs font-semibold text-slate-600">Dirección gratuita</label>
                  <div className="flex min-w-0 items-center rounded-md border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-blue-500/20">
                    <Input
                      id={`subdomain-${project.id}`}
                      value={draft}
                      onChange={(event) => {
                        setDrafts((current) => ({ ...current, [project.id]: event.target.value.toLowerCase() }))
                        setAvailability((current) => ({ ...current, [project.id]: null }))
                      }}
                      className="min-w-0 border-0 shadow-none focus-visible:ring-0"
                      placeholder="mi-empresa"
                    />
                    <span className="shrink-0 border-l border-slate-200 px-3 text-sm text-slate-500">.sgdigitalordex.com</span>
                  </div>
                  {result?.value === normalizedDraft ? (
                    <div className={`mt-1.5 text-xs ${result.available ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {result.available ? 'Disponible para este sitio.' : result.error || 'Este subdominio ya está en uso.'}
                    </div>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => checkAvailability(project.id)} disabled={checkingProjectId === project.id}>
                    {checkingProjectId === project.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Comprobar
                  </Button>
                  <Button type="button" onClick={() => saveSubdomain(project.id)} disabled={!canSave || savingProjectId === project.id}>
                    {savingProjectId === project.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Guardar
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid gap-6 px-1 md:grid-cols-2">
        <div className="border-l-4 border-slate-300 px-5 py-2">
          <div className="flex items-center gap-2 font-semibold text-slate-900"><ShieldCheck className="h-4 w-4" /> Conectar un dominio existente</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Próxima fase: verificación de propiedad por TXT, conexión CNAME/A y activación automática de SSL.</p>
          <Button type="button" variant="outline" disabled className="mt-4">Próximamente</Button>
        </div>
        <div className="border-l-4 border-slate-300 px-5 py-2">
          <div className="flex items-center gap-2 font-semibold text-slate-900"><Search className="h-4 w-4" /> Buscar y comprar dominio</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Próxima fase: consulta de disponibilidad, precio y registro mediante un proveedor reseller.</p>
          <Button type="button" variant="outline" disabled className="mt-4">Próximamente</Button>
        </div>
      </section>
    </div>
  )
}
