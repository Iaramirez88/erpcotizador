'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search } from 'lucide-react'
import {
  formatRopCapacityLabel,
  formatRopCoverageLabel,
  formatRopVerificationLabel,
  getRopCapacityTone,
  getRopVerificationTone,
  RopCompanyAvatar,
  RopQuickContactActions,
  RopTrustStars,
} from '@/components/rop/rop-visuals'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

type DiscoveryItem = {
  companyId: string
  title: string
  subtitle: string | null
  logoUrl: string | null
  city: string | null
  region: string | null
  coverageScope: 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT' | null
  trustScore: number | null
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
  capacityStatus: 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE' | null
  availableQuantity: number | null
  availabilityLabel: string | null
  phonePublic: string | null
  emailPublic: string | null
  serviceName: string | null
  serviceCatalogId: string | null
  reason: string
}

type ServiceCatalogItem = {
  id: string
  name: string
  code: string
  subcategory: { id: string; name: string; category: { id: string; name: string } }
}

type ApiEnvelope<T> = { data?: T; error?: { message?: string } }

const COVERAGE_OPTIONS = [
  { value: 'ALL', label: 'Toda cobertura' },
  { value: 'LOCAL', label: 'Local' },
  { value: 'REGIONAL', label: 'Regional' },
  { value: 'NATIONAL', label: 'Nacional' },
  { value: 'EXPORT', label: 'Exportación' },
] as const

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Cualquier capacidad' },
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'LIMITED', label: 'Limitada' },
  { value: 'SATURATED', label: 'Saturada' },
  { value: 'OFFLINE', label: 'Fuera de servicio' },
] as const

export default function RopDiscoveryClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [items, setItems] = useState<DiscoveryItem[]>([])
  const [catalog, setCatalog] = useState<ServiceCatalogItem[]>([])
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [serviceCatalogId, setServiceCatalogId] = useState('ALL')
  const [coverageScope, setCoverageScope] = useState<'ALL' | 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT'>('ALL')
  const [availabilityStatus, setAvailabilityStatus] = useState<'ALL' | 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE'>('ALL')
  const [minTrustScore, setMinTrustScore] = useState('')

  useEffect(() => {
    void loadCatalog()
  }, [])

  useEffect(() => {
    void loadItems()
  }, [search, city, serviceCatalogId, coverageScope, availabilityStatus, minTrustScore])

  async function loadCatalog() {
    setCatalogLoading(true)
    try {
      const response = await fetch('/api/rop/v1/catalog/services', { cache: 'no-store' })
      const json = (await response.json().catch(() => null)) as ApiEnvelope<ServiceCatalogItem[]> | null
      if (!response.ok || !json?.data) {
        throw new Error(json?.error?.message || 'No se pudo cargar el catálogo ROP.')
      }
      setCatalog(json.data)
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo cargar el catálogo.', variant: 'destructive' })
    } finally {
      setCatalogLoading(false)
    }
  }

  async function loadItems() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (city.trim()) params.set('city', city.trim())
      if (serviceCatalogId !== 'ALL') params.set('serviceCatalogId', serviceCatalogId)
      if (coverageScope !== 'ALL') params.set('coverageScope', coverageScope)
      if (availabilityStatus !== 'ALL') params.set('availabilityStatus', availabilityStatus)
      if (minTrustScore.trim()) params.set('minTrustScore', minTrustScore.trim())

      const url = params.toString() ? `/api/rop/v1/discovery/companies?${params.toString()}` : '/api/rop/v1/discovery/companies'
      const response = await fetch(url, { cache: 'no-store' })
      const json = (await response.json().catch(() => null)) as ApiEnvelope<DiscoveryItem[]> | null
      if (!response.ok || !json?.data) {
        throw new Error(json?.error?.message || 'No se pudo cargar discovery.')
      }
      setItems(json.data)
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo cargar discovery.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const selectedService = useMemo(() => catalog.find((item) => item.id === serviceCatalogId) ?? null, [catalog, serviceCatalogId])

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_30%),linear-gradient(135deg,_#f8fafc_0%,_#eff6ff_48%,_#f0fdfa_100%)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Discovery ROP</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Empresas para tu operación</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-700 sm:text-base">
              Explora aliados operativos con filtros ligeros de ciudad, servicio, cobertura y capacidad, sin caer en un directorio plano.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-full bg-white/85 px-5">
              <Link href="/dashboard/rop/perfil">Editar perfil</Link>
            </Button>
            <Button asChild className="rounded-full px-5">
              <Link href="/dashboard/rop">Volver a ROP</Link>
            </Button>
          </div>
        </div>
      </section>

      <Card className="rounded-3xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Filtros vivos</CardTitle>
          <CardDescription>{selectedService ? `${selectedService.subcategory.category.name} / ${selectedService.subcategory.name}` : 'Ajusta el radar para acotar el shortlist.'}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2 xl:col-span-2">
            <Label>Búsqueda</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, marca o contexto operativo" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ciudad</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ej. Bogotá" />
          </div>
          <div className="space-y-2">
            <Label>Servicio</Label>
            <Select value={serviceCatalogId} onValueChange={setServiceCatalogId}>
              <SelectTrigger>
                <SelectValue placeholder={catalogLoading ? 'Cargando...' : 'Todos'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los servicios</SelectItem>
                {catalog.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cobertura</Label>
            <Select value={coverageScope} onValueChange={(value) => setCoverageScope(value as typeof coverageScope)}>
              <SelectTrigger>
                <SelectValue placeholder="Toda" />
              </SelectTrigger>
              <SelectContent>
                {COVERAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Capacidad</Label>
            <Select value={availabilityStatus} onValueChange={(value) => setAvailabilityStatus(value as typeof availabilityStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Cualquiera" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Trust mínimo</Label>
            <Input type="number" min="0" max="100" value={minTrustScore} onChange={(e) => setMinTrustScore(e.target.value)} placeholder="0 - 100" />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex min-h-[35vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
        </div>
      ) : items.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card key={item.companyId} className="rounded-3xl border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <RopCompanyAvatar label={item.title} logoUrl={item.logoUrl} size="lg" className="ring-4 ring-sky-100" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{item.city || item.region || 'Ubicación por confirmar'}</p>
                      </div>
                      {item.trustScore !== null ? <RopTrustStars score={item.trustScore} /> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                      <span className={`rounded-full border px-2.5 py-1 ${getRopVerificationTone(item.verificationStatus)}`}>
                        {formatRopVerificationLabel(item.verificationStatus)}
                      </span>
                      {item.coverageScope ? (
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
                          {formatRopCoverageLabel(item.coverageScope)}
                        </span>
                      ) : null}
                      <span className={`rounded-full border px-2.5 py-1 ${getRopCapacityTone(item.capacityStatus)}`}>
                        {formatRopCapacityLabel(item.capacityStatus)}
                      </span>
                      {item.availabilityLabel ? (
                        <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-teal-700">
                          {item.availabilityLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {item.subtitle ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.subtitle}</p> : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Servicio</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{item.serviceName || 'Sin servicio visible'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Capacidad</div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{formatRopCapacityLabel(item.capacityStatus)}</div>
                    {item.availableQuantity !== null ? <div className="text-xs text-slate-500">Cantidad {item.availableQuantity}</div> : null}
                    {item.availabilityLabel ? <div className="text-xs text-slate-500">Ventana {item.availabilityLabel}</div> : null}
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-600">{item.reason}</p>

                <div className="mt-5 space-y-3">
                  <RopQuickContactActions phone={item.phonePublic} email={item.emailPublic} companyName={item.title} />
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button asChild className="rounded-full px-4">
                    <Link href={item.serviceCatalogId ? `/dashboard/rop/necesidades/nueva?serviceCatalogId=${encodeURIComponent(item.serviceCatalogId)}` : '/dashboard/rop/necesidades/nueva'}>Invitar desde necesidad</Link>
                  </Button>
                  <Button variant="outline" className="rounded-full px-4">Ver compatibilidad</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="rounded-3xl border-dashed border-slate-300 bg-slate-50 shadow-none">
          <CardContent className="p-8 text-center text-sm text-slate-600">
            No encontramos empresas con esos filtros. Si el catálogo aún está vacío, ejecuta el seed ROP y vuelve a intentar.
          </CardContent>
        </Card>
      )}
    </div>
  )
}