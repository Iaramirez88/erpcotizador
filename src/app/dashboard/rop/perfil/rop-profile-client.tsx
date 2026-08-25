'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type ProfileResponse = {
  companyId: string
  companyType: 'INTERNAL' | 'EXTERNAL' | 'PARTNER'
  legalName: string
  brandName: string | null
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
  onboardingStatus: 'DRAFT' | 'ACTIVE' | 'SUSPENDED'
  location: {
    countryCode: string
    region: string | null
    city: string | null
  }
  coverageScope: 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT' | null
  descriptionPublic: string | null
  services: Array<{
    companyServiceId: string
    serviceCatalogId: string
    categoryName: string
    subcategoryName: string
    serviceName: string
    leadTimeHours: number | null
  }>
  profileCompletionPercent: number
  visibility: {
    profile: 'PRIVATE' | 'NETWORK' | 'PUBLIC'
    capacity: 'PRIVATE' | 'NETWORK' | 'PUBLIC'
  }
}

type CapacityResponse = {
  items: Array<{
    id: string
    companyServiceId: string
    serviceCatalogId: string
    serviceName: string
    availableQuantity: number
    reservedQuantity: number | null
    status: 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE'
    availableFrom: string
    availableUntil: string
    slaHours: number | null
    sourceType: 'MANUAL' | 'ERP_EVENT' | 'API'
  }>
}

type ServiceCatalogItem = {
  id: string
  name: string
  code: string
  subcategory: { id: string; name: string; category: { id: string; name: string } }
}

type ServiceSelectionForm = {
  serviceCatalogId: string
  publicTitle: string
  leadTimeHours: string
  minOrderValue: string
}

type CapacityFormItem = {
  companyServiceId: string
  serviceName: string
  availableQuantity: string
  reservedQuantity: string
  status: 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE'
  availableFrom: string
  availableUntil: string
  slaHours: string
  sourceType: 'MANUAL' | 'ERP_EVENT' | 'API'
}

type ApiEnvelope<T> = {
  data?: T
  error?: { code?: string; message?: string }
}

const COVERAGE_OPTIONS = [
  { value: 'LOCAL', label: 'Local' },
  { value: 'REGIONAL', label: 'Regional' },
  { value: 'NATIONAL', label: 'Nacional' },
  { value: 'EXPORT', label: 'Exportación' },
] as const

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Privado' },
  { value: 'NETWORK', label: 'Red' },
  { value: 'PUBLIC', label: 'Público' },
] as const

const CAPACITY_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'LIMITED', label: 'Limitada' },
  { value: 'SATURATED', label: 'Saturada' },
  { value: 'OFFLINE', label: 'Fuera de servicio' },
] as const

function toDatetimeLocal(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const adjusted = new Date(date.getTime() - offset * 60000)
  return adjusted.toISOString().slice(0, 16)
}

function fromDatetimeLocal(value: string) {
  if (!value.trim()) return ''
  return new Date(value).toISOString()
}

function buildEmptyCapacityFormItem(service: ProfileResponse['services'][number]): CapacityFormItem {
  return {
    companyServiceId: service.companyServiceId,
    serviceName: service.serviceName,
    availableQuantity: '0',
    reservedQuantity: '0',
    status: 'AVAILABLE',
    availableFrom: '',
    availableUntil: '',
    slaHours: String(service.leadTimeHours ?? ''),
    sourceType: 'MANUAL',
  }
}

export default function RopProfileClient() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'perfil' | 'capacidad'>('perfil')
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingCapacity, setSavingCapacity] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [serviceCatalog, setServiceCatalog] = useState<ServiceCatalogItem[]>([])
  const [visibilityEnabled, setVisibilityEnabled] = useState(true)
  const [profileForm, setProfileForm] = useState({
    brandName: '',
    descriptionPublic: '',
    countryCode: 'CO',
    region: '',
    city: '',
    coverageScope: 'LOCAL' as 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT',
    visibilityLevel: 'NETWORK' as 'PRIVATE' | 'NETWORK' | 'PUBLIC',
  })
  const [serviceSelections, setServiceSelections] = useState<ServiceSelectionForm[]>([])
  const [capacityForm, setCapacityForm] = useState<CapacityFormItem[]>([])

  useEffect(() => {
    void Promise.all([loadCatalog(), loadProfileAndCapacity()])
  }, [])

  async function loadCatalog() {
    setCatalogLoading(true)
    try {
      const response = await fetch('/api/rop/v1/catalog/services', { cache: 'no-store' })
      const json = (await response.json().catch(() => null)) as ApiEnvelope<ServiceCatalogItem[]> | null
      if (!response.ok || !json?.data) {
        throw new Error(json?.error?.message || 'No se pudo cargar el catálogo ROP.')
      }
      setServiceCatalog(json.data)
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo cargar el catálogo ROP.', variant: 'destructive' })
    } finally {
      setCatalogLoading(false)
    }
  }

  async function loadProfileAndCapacity() {
    setLoading(true)
    try {
      const [profileResponse, capacityResponse] = await Promise.all([
        fetch('/api/rop/v1/companies/me/profile', { cache: 'no-store' }),
        fetch('/api/rop/v1/companies/me/capacity', { cache: 'no-store' }),
      ])

      const profileJson = (await profileResponse.json().catch(() => null)) as ApiEnvelope<ProfileResponse> | null
      const capacityJson = (await capacityResponse.json().catch(() => null)) as ApiEnvelope<CapacityResponse> | null

      if (!profileResponse.ok || !profileJson?.data) {
        throw new Error(profileJson?.error?.message || 'No se pudo cargar el perfil operativo.')
      }

      const profileData = profileJson.data
      setProfile(profileData)
      setProfileForm({
        brandName: profileData.brandName || '',
        descriptionPublic: profileData.descriptionPublic || '',
        countryCode: profileData.location.countryCode || 'CO',
        region: profileData.location.region || '',
        city: profileData.location.city || '',
        coverageScope: profileData.coverageScope || 'LOCAL',
        visibilityLevel: profileData.visibility.profile,
      })
      setVisibilityEnabled(profileData.visibility.profile !== 'PRIVATE')
      setServiceSelections(
        profileData.services.length
          ? profileData.services.map((service) => ({
              serviceCatalogId: service.serviceCatalogId,
              publicTitle: '',
              leadTimeHours: String(service.leadTimeHours ?? ''),
              minOrderValue: '',
            }))
          : [{ serviceCatalogId: '', publicTitle: '', leadTimeHours: '', minOrderValue: '' }]
      )

      const capacityItems = capacityJson?.data?.items ?? []
      const mappedCapacity = profileData.services.map((service) => {
        const found = capacityItems.find((item) => item.companyServiceId === service.companyServiceId)
        return found
          ? {
              companyServiceId: found.companyServiceId,
              serviceName: found.serviceName,
              availableQuantity: String(found.availableQuantity),
              reservedQuantity: String(found.reservedQuantity ?? 0),
              status: found.status,
              availableFrom: toDatetimeLocal(found.availableFrom),
              availableUntil: toDatetimeLocal(found.availableUntil),
              slaHours: String(found.slaHours ?? service.leadTimeHours ?? ''),
              sourceType: found.sourceType,
            }
          : buildEmptyCapacityFormItem(service)
      })
      setCapacityForm(mappedCapacity)
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo cargar ROP.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const serviceCatalogById = useMemo(() => new Map(serviceCatalog.map((item) => [item.id, item])), [serviceCatalog])

  function updateServiceSelection(index: number, patch: Partial<ServiceSelectionForm>) {
    setServiceSelections((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function addServiceSelection() {
    setServiceSelections((current) => [...current, { serviceCatalogId: '', publicTitle: '', leadTimeHours: '', minOrderValue: '' }])
  }

  function removeServiceSelection(index: number) {
    setServiceSelections((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)))
  }

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const normalizedSelections = serviceSelections
        .map((item) => ({
          serviceCatalogId: item.serviceCatalogId.trim(),
          publicTitle: item.publicTitle.trim() || null,
          leadTimeHours: item.leadTimeHours.trim() ? Number(item.leadTimeHours) : null,
          minOrderValue: item.minOrderValue.trim() ? Number(item.minOrderValue) : null,
        }))
        .filter((item) => item.serviceCatalogId)

      const response = await fetch('/api/rop/v1/companies/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: profileForm.brandName.trim() || null,
          descriptionPublic: profileForm.descriptionPublic.trim() || null,
          location: {
            countryCode: profileForm.countryCode.trim().toUpperCase(),
            region: profileForm.region.trim() || null,
            city: profileForm.city.trim() || null,
          },
          coverageScope: normalizedSelections.length ? profileForm.coverageScope : null,
          visibilityLevel: visibilityEnabled ? profileForm.visibilityLevel : 'PRIVATE',
          serviceSelections: normalizedSelections,
        }),
      })

      const json = (await response.json().catch(() => null)) as ApiEnvelope<ProfileResponse> | null
      if (!response.ok || !json?.data) {
        throw new Error(json?.error?.message || 'No se pudo guardar el perfil operativo.')
      }

      toast({ title: 'Perfil actualizado', description: 'El perfil operativo quedó guardado y listo para discovery.' })
      await loadProfileAndCapacity()
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo guardar el perfil operativo.', variant: 'destructive' })
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveCapacity() {
    setSavingCapacity(true)
    try {
      const items = capacityForm
        .filter((item) => item.availableFrom.trim() && item.availableUntil.trim())
        .map((item) => ({
          companyServiceId: item.companyServiceId,
          availableQuantity: Number(item.availableQuantity || 0),
          reservedQuantity: item.reservedQuantity.trim() ? Number(item.reservedQuantity) : null,
          status: item.status,
          availableFrom: fromDatetimeLocal(item.availableFrom),
          availableUntil: fromDatetimeLocal(item.availableUntil),
          slaHours: item.slaHours.trim() ? Number(item.slaHours) : null,
          sourceType: item.sourceType,
        }))

      const response = await fetch('/api/rop/v1/companies/me/capacity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })

      const json = (await response.json().catch(() => null)) as ApiEnvelope<CapacityResponse> | null
      if (!response.ok || !json?.data) {
        throw new Error(json?.error?.message || 'No se pudo guardar la capacidad.')
      }

      toast({ title: 'Capacidad publicada', description: 'La disponibilidad operativa quedó actualizada en la red.' })
      await loadProfileAndCapacity()
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo guardar la capacidad.', variant: 'destructive' })
    } finally {
      setSavingCapacity(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#fff7ed_0%,_#f8fafc_52%,_#ecfeff_100%)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">Configuración ROP</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Perfil operativo y capacidad</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-700 sm:text-base">
              Publica cómo trabaja tu empresa, qué servicios ofrece y cuándo tiene capacidad real para que la red pueda recomendarte.
            </p>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/80 px-5 py-4 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Completitud</div>
            <div className="mt-2 text-3xl font-semibold text-slate-950">{profile?.profileCompletionPercent ?? 0}%</div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-teal-500" style={{ width: `${profile?.profileCompletionPercent ?? 0}%` }} />
            </div>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'perfil' | 'capacidad')} className="space-y-4">
        <TabsList className="grid h-auto grid-cols-2 rounded-3xl border border-slate-200 bg-slate-50 p-1">
          <TabsTrigger value="perfil" className="rounded-2xl px-4 py-2 data-[state=active]:bg-white">Perfil operativo</TabsTrigger>
          <TabsTrigger value="capacidad" className="rounded-2xl px-4 py-2 data-[state=active]:bg-white">Capacidad publicada</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-4">
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Base operativa</CardTitle>
              <CardDescription>Describe cómo trabaja tu empresa y qué tan visible quieres estar dentro de la red.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2 xl:col-span-2">
                  <Label>Nombre comercial</Label>
                  <Input value={profileForm.brandName} onChange={(e) => setProfileForm((current) => ({ ...current, brandName: e.target.value }))} placeholder="Ej. SGDigital Operaciones" />
                </div>
                <div className="space-y-2">
                  <Label>País</Label>
                  <Input value={profileForm.countryCode} onChange={(e) => setProfileForm((current) => ({ ...current, countryCode: e.target.value.toUpperCase() }))} maxLength={2} />
                </div>
                <div className="space-y-2">
                  <Label>Cobertura</Label>
                  <Select value={profileForm.coverageScope} onValueChange={(value) => setProfileForm((current) => ({ ...current, coverageScope: value as typeof current.coverageScope }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona cobertura" />
                    </SelectTrigger>
                    <SelectContent>
                      {COVERAGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Región o departamento</Label>
                  <Input value={profileForm.region} onChange={(e) => setProfileForm((current) => ({ ...current, region: e.target.value }))} placeholder="Ej. Cundinamarca" />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad principal</Label>
                  <Input value={profileForm.city} onChange={(e) => setProfileForm((current) => ({ ...current, city: e.target.value }))} placeholder="Ej. Bogotá" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descripción operativa</Label>
                <Textarea value={profileForm.descriptionPublic} onChange={(e) => setProfileForm((current) => ({ ...current, descriptionPublic: e.target.value }))} placeholder="Describe qué ejecuta tu empresa, qué tipo de trabajos toma y cómo responde." className="min-h-[140px]" />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Visibilidad del perfil</h3>
                    <p className="mt-1 text-sm text-slate-600">Controla si la red puede encontrarte y hasta qué nivel de exposición.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">Visible en la red</span>
                    <Switch checked={visibilityEnabled} onCheckedChange={setVisibilityEnabled} />
                  </div>
                </div>
                <div className="mt-4 max-w-sm space-y-2">
                  <Label>Nivel de visibilidad</Label>
                  <Select value={visibilityEnabled ? profileForm.visibilityLevel : 'PRIVATE'} onValueChange={(value) => setProfileForm((current) => ({ ...current, visibilityLevel: value as typeof current.visibilityLevel }))} disabled={!visibilityEnabled}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona visibilidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Servicios que ofreces</h3>
                    <p className="mt-1 text-sm text-slate-600">Elige servicios reales del catálogo ROP para que la red te pueda recomendar.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={addServiceSelection} disabled={catalogLoading}>Agregar servicio</Button>
                </div>

                <div className="space-y-3">
                  {serviceSelections.map((selection, index) => {
                    const selectedService = serviceCatalogById.get(selection.serviceCatalogId)
                    return (
                      <div key={`${selection.serviceCatalogId}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
                          <div className="space-y-2">
                            <Label>Servicio</Label>
                            <Select value={selection.serviceCatalogId} onValueChange={(value) => updateServiceSelection(index, { serviceCatalogId: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder={catalogLoading ? 'Cargando catálogo...' : 'Selecciona un servicio'} />
                              </SelectTrigger>
                              <SelectContent>
                                {serviceCatalog.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedService ? (
                              <p className="text-xs text-slate-500">{selectedService.subcategory.category.name} / {selectedService.subcategory.name}</p>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            <Label>Título público</Label>
                            <Input value={selection.publicTitle} onChange={(e) => updateServiceSelection(index, { publicTitle: e.target.value })} placeholder="Cómo quieres mostrarlo" />
                          </div>
                          <div className="space-y-2">
                            <Label>SLA base en horas</Label>
                            <Input type="number" min="0" value={selection.leadTimeHours} onChange={(e) => updateServiceSelection(index, { leadTimeHours: e.target.value })} placeholder="24" />
                          </div>
                          <div className="flex items-end">
                            <Button type="button" variant="outline" className="w-full" onClick={() => removeServiceSelection(index)} disabled={serviceSelections.length === 1}>Quitar</Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar perfil
                </Button>
                <Button asChild variant="outline">
                  <Link href="/dashboard/rop">Volver a home ROP</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capacidad" className="space-y-4">
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Capacidad publicada</CardTitle>
              <CardDescription>Publica ventanas reales de disponibilidad para que el matching inicial no dependa solo del perfil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {capacityForm.length ? (
                capacityForm.map((item, index) => (
                  <div key={item.companyServiceId} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-col gap-1 pb-4">
                      <h3 className="font-semibold text-slate-950">{item.serviceName}</h3>
                      <p className="text-sm text-slate-600">Define cuánto puedes ofrecer, en qué ventana y con qué estado operativo.</p>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Cantidad disponible</Label>
                        <Input type="number" min="0" value={item.availableQuantity} onChange={(e) => setCapacityForm((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, availableQuantity: e.target.value } : entry))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Cantidad reservada</Label>
                        <Input type="number" min="0" value={item.reservedQuantity} onChange={(e) => setCapacityForm((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, reservedQuantity: e.target.value } : entry))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Select value={item.status} onValueChange={(value) => setCapacityForm((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, status: value as CapacityFormItem['status'] } : entry))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona estado" />
                          </SelectTrigger>
                          <SelectContent>
                            {CAPACITY_STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-4">
                      <div className="space-y-2 xl:col-span-2">
                        <Label>Disponible desde</Label>
                        <Input type="datetime-local" value={item.availableFrom} onChange={(e) => setCapacityForm((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, availableFrom: e.target.value } : entry))} />
                      </div>
                      <div className="space-y-2 xl:col-span-2">
                        <Label>Disponible hasta</Label>
                        <Input type="datetime-local" value={item.availableUntil} onChange={(e) => setCapacityForm((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, availableUntil: e.target.value } : entry))} />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>SLA en horas</Label>
                        <Input type="number" min="0" value={item.slaHours} onChange={(e) => setCapacityForm((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, slaHours: e.target.value } : entry))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Origen</Label>
                        <Select value={item.sourceType} onValueChange={(value) => setCapacityForm((current) => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, sourceType: value as CapacityFormItem['sourceType'] } : entry))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona origen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MANUAL">Manual</SelectItem>
                            <SelectItem value="ERP_EVENT">Evento ERP</SelectItem>
                            <SelectItem value="API">API</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  Primero guarda al menos un servicio en el perfil operativo para poder publicar capacidad.
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={saveCapacity} disabled={savingCapacity || !capacityForm.length}>
                  {savingCapacity ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Guardar capacidad
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}