'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Radar, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type ServiceCatalogItem = {
  id: string
  name: string
  code: string
  subcategory: {
    id: string
    name: string
    category: {
      id: string
      name: string
    }
  }
}

type ProfileResponse = {
  location: {
    countryCode: string
    region: string | null
    city: string | null
  }
}

type CreatedOpportunity = {
  id: string
  title: string
  status: string
}

type ApiEnvelope<T> = {
  data?: T
  error?: { code?: string; message?: string }
}

type FormState = {
  title: string
  descriptionPublic: string
  requirementsPrivate: string
  categoryId: string
  subcategoryId: string
  serviceCatalogId: string
  countryCode: string
  region: string
  city: string
  expectedQuantity: string
  dueAt: string
  visibilityLevel: 'PRIVATE' | 'CLUSTER' | 'NETWORK'
}

const VISIBILITY_OPTIONS = [
  { value: 'NETWORK', label: 'Red operativa' },
  { value: 'CLUSTER', label: 'Solo cluster' },
  { value: 'PRIVATE', label: 'Privada' },
] as const

const EMPTY_FORM: FormState = {
  title: '',
  descriptionPublic: '',
  requirementsPrivate: '',
  categoryId: '',
  subcategoryId: '',
  serviceCatalogId: '',
  countryCode: 'CO',
  region: '',
  city: '',
  expectedQuantity: '',
  dueAt: '',
  visibilityLevel: 'NETWORK',
}

export default function RopOpportunityCreateClient({ initialServiceCatalogId }: { initialServiceCatalogId?: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [created, setCreated] = useState<CreatedOpportunity | null>(null)

  useEffect(() => {
    void loadContext()
  }, [])

  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    for (const item of catalog) {
      map.set(item.subcategory.category.id, item.subcategory.category)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [catalog])

  const subcategories = useMemo(() => {
    return Array.from(
      new Map(
        catalog
          .filter((item) => item.subcategory.category.id === form.categoryId)
          .map((item) => [item.subcategory.id, { id: item.subcategory.id, name: item.subcategory.name }])
      ).values()
    ).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [catalog, form.categoryId])

  const services = useMemo(() => {
    return catalog
      .filter((item) => item.subcategory.id === form.subcategoryId)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [catalog, form.subcategoryId])

  const selectedService = useMemo(() => services.find((item) => item.id === form.serviceCatalogId) ?? null, [services, form.serviceCatalogId])

  async function loadContext() {
    setLoading(true)
    try {
      const [catalogResponse, profileResponse] = await Promise.all([
        fetch('/api/rop/v1/catalog/services', { cache: 'no-store' }),
        fetch('/api/rop/v1/companies/me/profile', { cache: 'no-store' }),
      ])

      const catalogJson = (await catalogResponse.json().catch(() => null)) as ApiEnvelope<ServiceCatalogItem[]> | null
      const profileJson = (await profileResponse.json().catch(() => null)) as ApiEnvelope<ProfileResponse> | null

      if (!catalogResponse.ok || !catalogJson?.data) {
        throw new Error(catalogJson?.error?.message || 'No se pudo cargar el catálogo ROP.')
      }

      const preferredService = catalogJson.data.find((item) => item.id === initialServiceCatalogId) ?? catalogJson.data[0]
      const initialCategoryId = preferredService?.subcategory.category.id || ''
      const initialSubcategoryId = preferredService?.subcategory.id || ''
      const initialCatalogServiceId = preferredService?.id || ''

      setCatalog(catalogJson.data)
      setForm((current) => ({
        ...current,
        categoryId: current.categoryId || initialCategoryId,
        subcategoryId: current.subcategoryId || initialSubcategoryId,
        serviceCatalogId: current.serviceCatalogId || initialCatalogServiceId,
        countryCode: profileJson?.data?.location.countryCode || current.countryCode,
        region: profileJson?.data?.location.region || current.region,
        city: profileJson?.data?.location.city || current.city,
      }))
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo cargar el formulario.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/rop/v1/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          descriptionPublic: form.descriptionPublic.trim() || null,
          requirementsPrivate: form.requirementsPrivate.trim() || null,
          categoryId: form.categoryId,
          subcategoryId: form.subcategoryId,
          serviceCatalogId: form.serviceCatalogId,
          location: {
            countryCode: form.countryCode.trim().toUpperCase() || 'CO',
            region: form.region.trim() || null,
            city: form.city.trim() || null,
          },
          expectedQuantity: form.expectedQuantity.trim() ? Number(form.expectedQuantity) : null,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
          visibilityLevel: form.visibilityLevel,
          sourceType: 'MANUAL',
          sourceRef: null,
        }),
      })

      const json = (await response.json().catch(() => null)) as ApiEnvelope<CreatedOpportunity> | null
      if (!response.ok || !json?.data) {
        throw new Error(json?.error?.message || 'No se pudo publicar la necesidad.')
      }

      setCreated(json.data)
      setForm((current) => ({
        ...EMPTY_FORM,
        categoryId: current.categoryId,
        subcategoryId: current.subcategoryId,
        serviceCatalogId: current.serviceCatalogId,
        countryCode: current.countryCode,
        region: current.region,
        city: current.city,
      }))
      toast({ title: 'Necesidad publicada', description: 'La necesidad operativa quedó abierta para discovery y matching.' })
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo publicar la necesidad.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  function handleCategoryChange(categoryId: string) {
    const firstSubcategory = catalog.find((item) => item.subcategory.category.id === categoryId)?.subcategory
    const firstService = catalog.find((item) => item.subcategory.id === firstSubcategory?.id)
    setForm((current) => ({
      ...current,
      categoryId,
      subcategoryId: firstSubcategory?.id || '',
      serviceCatalogId: firstService?.id || '',
    }))
  }

  function handleSubcategoryChange(subcategoryId: string) {
    const firstService = catalog.find((item) => item.subcategory.id === subcategoryId)
    setForm((current) => ({
      ...current,
      subcategoryId,
      serviceCatalogId: firstService?.id || '',
    }))
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.18),_transparent_34%),linear-gradient(135deg,_#fff7ed_0%,_#ffffff_48%,_#f0fdfa_100%)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">Publicar necesidad</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Activa una oportunidad operativa</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-700 sm:text-base">
              Publica el trabajo que necesitas mover y deja la red lista para discovery, matching e invitaciones.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-full bg-white/85 px-5">
              <Link href="/dashboard/rop/empresas">Ver empresas</Link>
            </Button>
            <Button asChild className="rounded-full px-5">
              <Link href="/dashboard/rop">Volver a ROP</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Brief operativo</CardTitle>
            <CardDescription>Define el trabajo, la taxonomía y el contexto mínimo para que el matching tenga señal suficiente.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label>Título</Label>
                <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ej. Producción de material POP para activación nacional" />
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Categoría</Label>
                  <Select value={form.categoryId} onValueChange={handleCategoryChange}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Subcategoría</Label>
                  <Select value={form.subcategoryId} onValueChange={handleSubcategoryChange}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {subcategories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Servicio</Label>
                  <Select value={form.serviceCatalogId} onValueChange={(value) => setForm((current) => ({ ...current, serviceCatalogId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {services.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Descripción visible</Label>
                <Textarea value={form.descriptionPublic} onChange={(event) => setForm((current) => ({ ...current, descriptionPublic: event.target.value }))} rows={5} placeholder="Describe el alcance que la red puede ver para decidir si aplica." />
              </div>

              <div className="grid gap-2">
                <Label>Requisitos privados</Label>
                <Textarea value={form.requirementsPrivate} onChange={(event) => setForm((current) => ({ ...current, requirementsPrivate: event.target.value }))} rows={5} placeholder="Especificaciones, restricciones o condiciones que solo quieres conservar para la gestión interna." />
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <div className="grid gap-2">
                  <Label>País</Label>
                  <Input maxLength={2} value={form.countryCode} onChange={(event) => setForm((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Región</Label>
                  <Input value={form.region} onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))} placeholder="Ej. Cundinamarca" />
                </div>
                <div className="grid gap-2">
                  <Label>Ciudad</Label>
                  <Input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} placeholder="Ej. Bogotá" />
                </div>
                <div className="grid gap-2">
                  <Label>Visibilidad</Label>
                  <Select value={form.visibilityLevel} onValueChange={(value) => setForm((current) => ({ ...current, visibilityLevel: value as FormState['visibilityLevel'] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VISIBILITY_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Cantidad esperada</Label>
                  <Input type="number" min="0" value={form.expectedQuantity} onChange={(event) => setForm((current) => ({ ...current, expectedQuantity: event.target.value }))} placeholder="Ej. 5000" />
                </div>
                <div className="grid gap-2">
                  <Label>Fecha objetivo</Label>
                  <Input type="datetime-local" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" className="rounded-full px-5" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Publicar necesidad
                </Button>
                <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => setForm((current) => ({ ...EMPTY_FORM, countryCode: current.countryCode, region: current.region, city: current.city, categoryId: current.categoryId, subcategoryId: current.subcategoryId, serviceCatalogId: current.serviceCatalogId }))}>
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Radar className="h-5 w-5 text-orange-600" /> Señal para matching</CardTitle>
              <CardDescription>La señal inicial sale de servicio, ubicación, cantidad, fecha y visibilidad.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <p>Servicio activo: <span className="font-medium text-slate-900">{selectedService?.name || 'Sin selección'}</span></p>
              <p>Discovery usa esta necesidad como punto de partida para shortlist e invitaciones posteriores.</p>
              <p>En este corte la publicación queda en estado abierto y lista para que el siguiente slice calcule recomendaciones.</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-teal-600" /> Resultado</CardTitle>
              <CardDescription>{created ? 'La necesidad ya quedó publicada.' : 'Todavía no has publicado una necesidad en esta sesión.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              {created ? (
                <>
                  <p className="font-medium text-slate-900">{created.title}</p>
                  <p>ID interno: {created.id}</p>
                  <p>Estado inicial: {created.status}</p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild className="rounded-full px-4">
                      <Link href={`/dashboard/rop/necesidades/${created.id}`}>Ver shortlist</Link>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full px-4">
                      <Link href="/dashboard/rop/empresas">Buscar aliados</Link>
                    </Button>
                    <Button asChild variant="ghost" className="rounded-full px-4">
                      <Link href="/dashboard/rop">Volver a home ROP</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <p>Cuando publiques, aquí dejamos una confirmación corta para seguir hacia discovery.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}