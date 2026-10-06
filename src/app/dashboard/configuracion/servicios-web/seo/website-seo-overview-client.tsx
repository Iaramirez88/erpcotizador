"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type Site = {
  id: string
  nombre: string
  status: string
  defaultUrl: string
  siteUrl: string
  searchConsoleSiteUrl: string
  keywordCount: number
  rankedKeywordCount: number
}

export default function WebsiteSeoOverviewClient({ sites, searchConsoleConnected }: { sites: Site[]; searchConsoleConnected: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const [forms, setForms] = useState<Record<string, { siteUrl: string; searchConsoleSiteUrl: string }>>(() => Object.fromEntries(sites.map((site) => [site.id, { siteUrl: site.siteUrl || site.defaultUrl, searchConsoleSiteUrl: site.searchConsoleSiteUrl || site.siteUrl || site.defaultUrl }])))
  const [savingId, setSavingId] = useState('')

  async function saveAndOpen(site: Site) {
    const form = forms[site.id]
    setSavingId(site.id)
    try {
      const response = await fetch(`/api/servicios-web/projects/${site.id}/seo`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const json = await response.json() as { error?: string }
      if (!response.ok) throw new Error(json.error || 'No se pudo guardar la URL.')
      router.push(`/dashboard/configuracion/servicios-web/sitios/${site.id}/seo`)
    } catch (error) {
      toast({ title: 'No se pudo configurar SEO', description: error instanceof Error ? error.message : 'Revisa la URL ingresada.', variant: 'destructive' })
    } finally { setSavingId('') }
  }

  return <div className="space-y-4">
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><p className="text-xs font-semibold uppercase text-slate-500">Google Search Console</p><h2 className="mt-1 text-xl font-semibold text-slate-950">Ranking SEO de tus sitios</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">Escribe la URL pública, vincula su propiedad de Google y consulta la posición de cada palabra clave.</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${searchConsoleConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{searchConsoleConnected ? 'Search Console conectado' : 'Search Console pendiente'}</span><Button asChild><a href={`/api/crm/marketing/google/connect?product=SEARCH_CONSOLE&returnTo=${encodeURIComponent('/dashboard/configuracion/servicios-web/seo')}`}>{searchConsoleConnected ? 'Reconectar' : 'Conectar Search Console'}</a></Button></div>
      </div>
    </section>

    {sites.length === 0 ? <section className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center"><Search className="mx-auto h-7 w-7 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-950">Primero crea un sitio web</h3><p className="mt-1 text-sm text-slate-500">El ranking SEO se organiza por sitio para conservar URL, keywords e historial.</p><Button asChild className="mt-4"><Link href="/dashboard/configuracion/servicios-web/sitios">Ir a Sitios</Link></Button></section> : null}

    <div className="grid gap-4 xl:grid-cols-2">{sites.map((site) => {
      const form = forms[site.id]
      return <section key={site.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{site.nombre}</h3><p className="mt-1 text-xs text-slate-500">{site.keywordCount} keywords · {site.rankedKeywordCount} con posición</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{site.status}</span></div>
        <div className="mt-4 space-y-3"><div><Label>URL de la página web</Label><Input className="mt-1.5" value={form?.siteUrl || ''} onChange={(event) => setForms((current) => ({ ...current, [site.id]: { ...current[site.id], siteUrl: event.target.value } }))} placeholder="https://www.cliente.com/" /></div><div><Label>Propiedad en Google Search Console</Label><Input className="mt-1.5" value={form?.searchConsoleSiteUrl || ''} onChange={(event) => setForms((current) => ({ ...current, [site.id]: { ...current[site.id], searchConsoleSiteUrl: event.target.value } }))} placeholder="sc-domain:cliente.com" /><p className="mt-1 text-xs text-slate-500">Puede ser una propiedad de dominio o una URL-prefix exacta.</p></div></div>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><Button asChild variant="ghost" size="sm"><a href={form?.siteUrl || site.defaultUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-3.5 w-3.5" />Abrir web</a></Button><Button onClick={() => void saveAndOpen(site)} disabled={savingId === site.id}>{savingId === site.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}Guardar y ver ranking</Button></div>
      </section>
    })}</div>
  </div>
}
