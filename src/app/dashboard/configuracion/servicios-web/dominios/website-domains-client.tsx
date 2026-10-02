'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Copy, ExternalLink, Globe2, Loader2, RefreshCw, Search, ShieldCheck, Star, Trash2 } from 'lucide-react'
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

type WebsiteProjectDomain = {
  id: string
  websiteProjectId: string
  hostname: string
  status: string
  dnsStatus: string
  sslStatus: string
  isPrimary: boolean
  lastCheckedAt: string | null
  failureReason: string | null
  instructions: {
    ownership: { type: string; name: string; value: string }
    routing: { cnameTarget: string; ipv4: string[]; ipv6: string[] }
  }
}

function domainStatusLabel(status: string) {
  if (status === 'ACTIVE') return 'Activo'
  if (status === 'PENDING_DNS') return 'Falta apuntar el dominio'
  if (status === 'PENDING_TLS') return 'Preparando certificado'
  if (status === 'ERROR') return 'Requiere atención'
  return 'Pendiente de verificación'
}

export default function WebsiteDomainsClient() {
  const { toast } = useToast()
  const [projects, setProjects] = useState<WebsiteProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [availability, setAvailability] = useState<Record<string, AvailabilityState>>({})
  const [checkingProjectId, setCheckingProjectId] = useState<string | null>(null)
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [customDomainDraft, setCustomDomainDraft] = useState('')
  const [customDomains, setCustomDomains] = useState<Record<string, WebsiteProjectDomain[]>>({})
  const [domainOperation, setDomainOperation] = useState<string | null>(null)

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
        setSelectedProjectId((current) => current || items[0]?.id || '')

        const domainEntries = await Promise.all(items.map(async (project) => {
          const domainsResponse = await fetch(`/api/servicios-web/projects/${project.id}/domains`)
          const domainsPayload = await domainsResponse.json()
          return [project.id, domainsResponse.ok && domainsPayload.ok ? domainsPayload.items : []] as const
        }))
        if (!cancelled) setCustomDomains(Object.fromEntries(domainEntries))
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

  async function connectCustomDomain() {
    if (!selectedProjectId || !customDomainDraft.trim()) return
    setDomainOperation('connect')
    try {
      const response = await fetch(`/api/servicios-web/projects/${selectedProjectId}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: customDomainDraft }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo conectar el dominio.')
      setCustomDomains((current) => ({
        ...current,
        [selectedProjectId]: [...(current[selectedProjectId] ?? []), payload.item],
      }))
      setCustomDomainDraft('')
      toast({ title: 'Dominio agregado', description: 'Configura los registros DNS y luego comprueba la conexión.' })
    } catch (error) {
      toast({ title: 'No se pudo agregar', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally {
      setDomainOperation(null)
    }
  }

  async function runDomainAction(domain: WebsiteProjectDomain, action: 'verify' | 'primary' | 'disconnect') {
    if (action === 'disconnect' && !window.confirm(`¿Desconectar ${domain.hostname}? El sitio dejará de responder en este dominio.`)) return
    setDomainOperation(`${action}:${domain.id}`)
    try {
      const endpoint = `/api/servicios-web/projects/${domain.websiteProjectId}/domains/${domain.id}`
      const response = await fetch(action === 'verify' ? `${endpoint}/verify` : endpoint, {
        method: action === 'disconnect' ? 'DELETE' : action === 'verify' ? 'POST' : 'PATCH',
        headers: action === 'primary' ? { 'Content-Type': 'application/json' } : undefined,
        body: action === 'primary' ? JSON.stringify({ action: 'SET_PRIMARY' }) : undefined,
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo completar la acción.')

      setCustomDomains((current) => {
        const items = current[domain.websiteProjectId] ?? []
        if (action === 'disconnect') {
          return { ...current, [domain.websiteProjectId]: items.filter((item) => item.id !== domain.id) }
        }
        return {
          ...current,
          [domain.websiteProjectId]: items.map((item) => item.id === domain.id
            ? payload.item
            : action === 'primary' ? { ...item, isPrimary: false } : item),
        }
      })
      toast({
        title: action === 'verify' ? (payload.item.status === 'ACTIVE' ? 'Dominio conectado' : 'DNS aún pendiente') : action === 'primary' ? 'Dominio principal actualizado' : 'Dominio desconectado',
        description: payload.item?.failureReason || undefined,
      })
    } catch (error) {
      toast({ title: 'No se pudo completar', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally {
      setDomainOperation(null)
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value)
    toast({ title: 'Copiado al portapapeles' })
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

      <section className="border-y border-slate-200 px-5 py-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Conectar un dominio existente</h2>
            <p className="mt-1 text-sm text-slate-600">Verifica que el dominio te pertenece y apúntalo a Ordex para activar el sitio y su certificado.</p>
          </div>
        </div>

        {projects.length > 0 ? (
          <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(180px,0.7fr)_minmax(280px,1.3fr)_auto] lg:items-end">
            <div>
              <label htmlFor="custom-domain-project" className="mb-1.5 block text-xs font-semibold text-slate-600">Sitio</label>
              <select id="custom-domain-project" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
                {projects.map((project) => <option key={project.id} value={project.id}>{project.nombre}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="custom-domain-hostname" className="mb-1.5 block text-xs font-semibold text-slate-600">Dominio</label>
              <Input id="custom-domain-hostname" value={customDomainDraft} onChange={(event) => setCustomDomainDraft(event.target.value.toLowerCase())} placeholder="empresa.com" />
            </div>
            <Button type="button" onClick={connectCustomDomain} disabled={!customDomainDraft.trim() || domainOperation === 'connect'}>
              {domainOperation === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />} Conectar dominio
            </Button>
          </div>
        ) : null}

        <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
          {(customDomains[selectedProjectId] ?? []).length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Este sitio aún no tiene dominios personalizados.</div>
          ) : (customDomains[selectedProjectId] ?? []).map((domain) => {
            const busy = domainOperation?.endsWith(`:${domain.id}`) ?? false
            const routingValues = [
              domain.instructions.routing.cnameTarget ? `CNAME → ${domain.instructions.routing.cnameTarget}` : '',
              ...domain.instructions.routing.ipv4.map((value) => `A → ${value}`),
              ...domain.instructions.routing.ipv6.map((value) => `AAAA → ${value}`),
            ].filter(Boolean)

            return (
              <div key={domain.id} className="py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-950">{domain.hostname}</span>
                      {domain.isPrimary ? <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Principal</span> : null}
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${domain.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{domainStatusLabel(domain.status)}</span>
                    </div>
                    {domain.failureReason ? <p className="mt-1 text-sm text-amber-800">{domain.failureReason}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => runDomainAction(domain, 'verify')}>
                      {domainOperation === `verify:${domain.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Comprobar DNS
                    </Button>
                    {!domain.isPrimary && domain.status === 'ACTIVE' ? (
                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => runDomainAction(domain, 'primary')}><Star className="h-4 w-4" /> Hacer principal</Button>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => runDomainAction(domain, 'disconnect')} className="text-rose-700"><Trash2 className="h-4 w-4" /> Desconectar</Button>
                  </div>
                </div>

                {domain.status !== 'ACTIVE' ? (
                  <div className="mt-4 grid gap-4 bg-slate-50 px-4 py-4 lg:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">1. Verificar propiedad</div>
                      <div className="mt-2 text-sm text-slate-700">TXT · {domain.instructions.ownership.name}</div>
                      <div className="mt-1 flex min-w-0 items-center gap-2">
                        <code className="min-w-0 break-all text-xs text-slate-600">{domain.instructions.ownership.value}</code>
                        <Button type="button" size="icon" variant="ghost" title="Copiar valor TXT" onClick={() => copyValue(domain.instructions.ownership.value)}><Copy className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500">2. Apuntar hacia Ordex</div>
                      {routingValues.length ? routingValues.map((value) => (
                        <div key={value} className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                          <code className="min-w-0 break-all">{value}</code>
                          <Button type="button" size="icon" variant="ghost" title="Copiar destino" onClick={() => copyValue(value.split('→')[1]?.trim() || value)}><Copy className="h-4 w-4" /></Button>
                        </div>
                      )) : <p className="mt-2 text-sm text-rose-700">Falta configurar el destino DNS en el servidor Ordex.</p>}
                    </div>
                  </div>
                ) : (
                  <a href={`https://${domain.hostname}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">Abrir sitio<ExternalLink className="h-3.5 w-3.5" /></a>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="border-l-4 border-slate-300 px-5 py-2">
        <div className="flex items-center gap-2 font-semibold text-slate-900"><Search className="h-4 w-4" /> Buscar y comprar dominio</div>
        <p className="mt-2 text-sm leading-6 text-slate-600">La compra, renovación y registro automático se habilitarán al conectar el proveedor reseller.</p>
        <Button type="button" variant="outline" disabled className="mt-4">Próximamente</Button>
      </section>
    </div>
  )
}
