/**
 * Página de Clientes
 * Lista, crea, edita y elimina clientes
 */

"use client"

import { useState, useEffect } from "react"
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ImportDialog } from "@/components/import/import-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ErpPageHero } from "@/components/dashboard/erp-page-chrome"
import { useI18n } from "@/components/providers/i18n-provider"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Cliente {
  id: string
  nombre: string
  tipoDocumento: string
  documento: string
  email?: string | null
  telefono?: string | null
  celular?: string | null
  direccion?: string | null
  ciudad?: string | null
  departamento?: string | null
  createdAt: string
  segmento?: "POTENCIAL" | "OCASIONAL" | "FRECUENTE"
  ultimaActividadAt?: string | null
  sede?: {
    id: string
    nombre: string
  } | null
  invoiceCount?: number
  invoiceTotal?: number
  invoiceCost?: number
  cotizacionesRangeCount?: number
  cotizacionesRangeTotal?: number
  _count?: {
    cotizaciones: number
    ordenes?: number
  }
}

interface Sede {
  id: string
  nombre: string
}

type ClienteSegmento = NonNullable<Cliente["segmento"]>

function fmtDate(date: string | null | undefined, locale: string, naText: string) {
  if (!date) return naText
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(date))
  } catch {
    return String(date)
  }
}

function fmtMoney(value: number | null | undefined, locale: string) {
  const n = typeof value === 'number' ? value : 0
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return String(n)
  }
}

export default function ClientesPage() {
  const { t, language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = t('common.na')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [segmentoFiltro, setSegmentoFiltro] = useState<"" | "POTENCIAL" | "OCASIONAL" | "FRECUENTE">("")
  const [tipoDocumentoFiltro, setTipoDocumentoFiltro] = useState("")
  const [ciudadFiltro, setCiudadFiltro] = useState("")
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeFiltro, setSedeFiltro] = useState("")
  const [createdAtMode, setCreatedAtMode] = useState<"" | "day" | "month" | "year">("")
  const [createdAtValue, setCreatedAtValue] = useState("")
  const [actividadDesde, setActividadDesde] = useState("")
  const [actividadHasta, setActividadHasta] = useState("")
  const [facturadoMin, setFacturadoMin] = useState("")
  const [facturadoMax, setFacturadoMax] = useState("")
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportPeriodo, setExportPeriodo] = useState<'' | 'day' | 'week' | 'month' | 'quarter'>('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    nombre: "",
    tipoDocumento: "NIT",
    documento: "",
    email: "",
    telefono: "",
    celular: "",
    direccion: "",
    ciudad: "",
    departamento: "",
    segmento: "" as "" | ClienteSegmento,
  })

  // Cargar clientes
  const fetchClientes = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (segmentoFiltro) params.set('segmento', segmentoFiltro)
      if (tipoDocumentoFiltro) params.set('tipoDocumento', tipoDocumentoFiltro)
      if (ciudadFiltro) params.set('ciudad', ciudadFiltro)
      if (sedeFiltro) params.set('sedeId', sedeFiltro)

      if (createdAtMode === 'day' && createdAtValue) params.set('createdAtDay', createdAtValue)
      if (createdAtMode === 'month' && createdAtValue) params.set('createdAtMonth', createdAtValue)
      if (createdAtMode === 'year' && createdAtValue) params.set('createdAtYear', createdAtValue)

      if (actividadDesde) params.set('activityFrom', actividadDesde)
      if (actividadHasta) params.set('activityTo', actividadHasta)

      if (facturadoMin) params.set('invoiceTotalMin', facturadoMin)
      if (facturadoMax) params.set('invoiceTotalMax', facturadoMax)

      const url = params.toString() ? `/api/clientes?${params.toString()}` : '/api/clientes'

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setClientes(data.data)
      }
    } catch (error) {
      console.error('Error al cargar clientes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchClientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, segmentoFiltro, tipoDocumentoFiltro, ciudadFiltro, sedeFiltro, createdAtMode, createdAtValue, actividadDesde, actividadHasta, facturadoMin, facturadoMax])

  useEffect(() => {
    const fetchSedes = async () => {
      try {
        const response = await fetch('/api/sedes')
        const data = await response.json()
        if (data.success) setSedes(data.data)
      } catch (error) {
        console.error('Error al cargar sedes:', error)
      }
    }

    fetchSedes()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = editingCliente 
        ? `/api/clientes/${editingCliente.id}`
        : '/api/clientes'
      
      const method = editingCliente ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setIsModalOpen(false)
        resetForm()
        fetchClientes()
      } else {
        alert(data.error || t('customers.errors.saveFailed'))
      }
    } catch (error) {
      console.error('Error:', error)
      alert(t('customers.errors.saveFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setFormData({
      nombre: cliente.nombre,
      tipoDocumento: cliente.tipoDocumento,
      documento: cliente.documento,
      email: cliente.email || "",
      telefono: cliente.telefono || "",
      celular: cliente.celular || "",
      direccion: cliente.direccion || "",
      ciudad: cliente.ciudad || "",
      departamento: cliente.departamento || "",
      segmento: (cliente.segmento || "") as "" | ClienteSegmento,
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('customers.confirm.delete'))) return

    try {
      const response = await fetch(`/api/clientes/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        fetchClientes()
      } else {
        alert(data.error || t('customers.errors.deleteFailed'))
      }
    } catch (error) {
      console.error('Error:', error)
      alert(t('customers.errors.deleteFailed'))
    }
  }

  const segmentoLabel = (segmento: ClienteSegmento) => t(`customers.segment.${segmento}`)
  const segmentoLabelPlural = (segmento: ClienteSegmento) => t(`customers.segment.${segmento}.plural`)

  const resetForm = () => {
    setEditingCliente(null)
    setFormData({
      nombre: "",
      tipoDocumento: "NIT",
      documento: "",
      email: "",
      telefono: "",
      celular: "",
      direccion: "",
      ciudad: "",
      departamento: "",
      segmento: "" as "" | ClienteSegmento,
    })
  }

  const openNewClienteModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const formatLocalDateInput = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const applyExportPeriod = (period: '' | 'day' | 'week' | 'month' | 'quarter') => {
    setExportPeriodo(period)
    if (!period) return
    const now = new Date()
    const to = formatLocalDateInput(now)
    const days = period === 'day' ? 0 : period === 'week' ? 7 : period === 'month' ? 30 : 90
    const fromDate = new Date(now)
    fromDate.setDate(fromDate.getDate() - days)
    const from = formatLocalDateInput(fromDate)
    setActividadDesde(from)
    setActividadHasta(to)
  }

  const exportExcel = () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (segmentoFiltro) params.set('segmento', segmentoFiltro)
    if (tipoDocumentoFiltro) params.set('tipoDocumento', tipoDocumentoFiltro)
    if (ciudadFiltro) params.set('ciudad', ciudadFiltro)
    if (sedeFiltro) params.set('sedeId', sedeFiltro)

    if (createdAtMode === 'day' && createdAtValue) params.set('createdAtDay', createdAtValue)
    if (createdAtMode === 'month' && createdAtValue) params.set('createdAtMonth', createdAtValue)
    if (createdAtMode === 'year' && createdAtValue) params.set('createdAtYear', createdAtValue)

    if (actividadDesde) params.set('activityFrom', actividadDesde)
    if (actividadHasta) params.set('activityTo', actividadHasta)

    if (facturadoMin) params.set('invoiceTotalMin', facturadoMin)
    if (facturadoMax) params.set('invoiceTotalMax', facturadoMax)

    const url = params.toString() ? `/api/clientes/export?${params.toString()}` : '/api/clientes/export'
    window.location.href = url
  }

  const clearFilters = () => {
    setSearch("")
    setSegmentoFiltro("")
    setTipoDocumentoFiltro("")
    setCiudadFiltro("")
    setSedeFiltro("")
    setCreatedAtMode("")
    setCreatedAtValue("")
    setActividadDesde("")
    setActividadHasta("")
    setFacturadoMin("")
    setFacturadoMax("")
  }

  return (
    <div className="space-y-6">
      <ErpPageHero
        eyebrow="ERP comercial"
        title={<span data-tour="clientes-title">{t('customers.title')}</span>}
        description={t('customers.subtitle')}
        actions={
          <>
            <span data-tour="clientes-import">
              <ImportDialog
                module="clientes"
                title={t('customers.actions.import')}
                onSuccess={async () => {
                  await fetchClientes()
                }}
              />
            </span>
            <Button variant="outline" onClick={() => setIsExportOpen(true)}>
              {t('customers.actions.exportExcel')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setFiltersOpen((current) => !current)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              {filtersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            </Button>
            <Button onClick={openNewClienteModal} data-tour="clientes-new">
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('customers.actions.new')}
            </Button>
          </>
        }
        stats={[
          { label: 'Clientes', value: clientes.length, hint: 'Registros visibles', tone: 'neutral' },
          { label: 'Sedes', value: sedes.length, hint: 'Sucursales consultables', tone: 'sky' },
          {
            label: 'Segmento activo',
            value: segmentoFiltro ? segmentoLabel(segmentoFiltro) : t('customers.filters.segment.all'),
            hint: search || naText,
            tone: 'teal',
          },
        ]}
      />

      {/* Modal de exportación */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('customers.export.title')}</DialogTitle>
            <DialogDescription>{t('customers.export.description')}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>{t('customers.filters.site')}</Label>
                <select
                  value={sedeFiltro}
                  onChange={(e) => setSedeFiltro(e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">{t('customers.filters.allSites')}</option>
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>{t('customers.filters.segment')}</Label>
                <select
                  value={segmentoFiltro}
                  onChange={(e) =>
                    setSegmentoFiltro(e.target.value as "" | "POTENCIAL" | "OCASIONAL" | "FRECUENTE")
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">{t('customers.filters.segment.all')}</option>
                  <option value="POTENCIAL">{segmentoLabelPlural('POTENCIAL')}</option>
                  <option value="OCASIONAL">{segmentoLabelPlural('OCASIONAL')}</option>
                  <option value="FRECUENTE">{segmentoLabelPlural('FRECUENTE')}</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label>{t('customers.filters.documentType')}</Label>
                <select
                  value={tipoDocumentoFiltro}
                  onChange={(e) => setTipoDocumentoFiltro(e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">{t('customers.filters.all')}</option>
                  <option value="NIT">NIT</option>
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="PASAPORTE">{t('customers.form.documentType.PASAPORTE')}</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label>{t('customers.filters.city')}</Label>
                <Input
                  value={ciudadFiltro}
                  onChange={(e) => setCiudadFiltro(e.target.value)}
                  placeholder={t('customers.form.cityPlaceholder')}
                />
              </div>

              <div className="space-y-1">
                <Label>{t('customers.export.period')}</Label>
                <select
                  value={exportPeriodo}
                  onChange={(e) => applyExportPeriod(e.target.value as ('' | 'day' | 'week' | 'month' | 'quarter'))}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">{t('customers.export.period.none')}</option>
                  <option value="day">{t('customers.export.period.day')}</option>
                  <option value="week">{t('customers.export.period.week')}</option>
                  <option value="month">{t('customers.export.period.month')}</option>
                  <option value="quarter">{t('customers.export.period.quarter')}</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label>{t('customers.filters.activityFrom')}</Label>
                  <Input
                    type="date"
                    value={actividadDesde}
                    onChange={(e) => {
                      setExportPeriodo('')
                      setActividadDesde(e.target.value)
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('customers.filters.activityTo')}</Label>
                  <Input
                    type="date"
                    value={actividadHasta}
                    onChange={(e) => {
                      setExportPeriodo('')
                      setActividadHasta(e.target.value)
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>{t('customers.filters.billingMin')}</Label>
                  <Input
                    inputMode="numeric"
                    value={facturadoMin}
                    onChange={(e) => setFacturadoMin(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('customers.filters.billingMax')}</Label>
                  <Input
                    inputMode="numeric"
                    value={facturadoMax}
                    onChange={(e) => setFacturadoMax(e.target.value)}
                    placeholder=""
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsExportOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                exportExcel()
                setIsExportOpen(false)
              }}
            >
              {t('common.download')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className={filtersOpen ? "grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" : "grid grid-cols-1 gap-6"}>
        {/* Lista (primero) */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{t('customers.list.title', { count: String(clientes.length) })}</CardTitle>
            <CardDescription>{t('customers.list.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <div className="min-w-[240px] flex-1">
                <Input
                  data-tour="clientes-search"
                  placeholder={t('customers.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button type="button" variant="outline" onClick={clearFilters}>
                {t('customers.filters.clear')}
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : clientes.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('customers.empty')}</p>
                <Button onClick={openNewClienteModal} className="mt-4">
                  {t('customers.actions.createFirst')}
                </Button>
              </div>
            ) : (
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-[1400px] w-full">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-3 font-medium">{t('customers.columns.name')}</th>
                      <th className="pb-3 font-medium">{t('customers.columns.document')}</th>
                      <th className="pb-3 font-medium">{t('customers.columns.site')}</th>
                      <th className="pb-3 font-medium">{t('customers.columns.segment')}</th>
                      <th className="pb-3 font-medium">{t('customers.columns.contact')}</th>
                      <th className="pb-3 font-medium">{t('customers.columns.city')}</th>
                      <th className="pb-3 font-medium text-center">{t('customers.columns.quotesRange')}</th>
                      <th className="pb-3 font-medium text-center">{t('customers.columns.orders')}</th>
                      <th className="pb-3 font-medium text-center">{t('customers.columns.invoices')}</th>
                      <th className="pb-3 font-medium text-right">{t('customers.columns.billed')}</th>
                      <th className="pb-3 font-medium text-right">{t('customers.columns.costApprox')}</th>
                      <th className="pb-3 font-medium">{t('customers.columns.lastActivity')}</th>
                      <th className="pb-3 font-medium text-right">{t('customers.columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((cliente) => (
                      <tr key={cliente.id} className="border-b last:border-0">
                        <td className="py-4">
                          <div>
                            <p className="font-medium">{cliente.nombre}</p>
                            <p className="text-sm text-muted-foreground">{cliente.email || t('customers.noEmail')}</p>
                          </div>
                        </td>
                        <td className="py-4">
                          <div>
                            <p className="text-sm">{cliente.tipoDocumento}</p>
                            <p className="font-mono text-sm">{cliente.documento}</p>
                          </div>
                        </td>
                        <td className="py-4 text-sm">{cliente.sede?.nombre || naText}</td>
                        <td className="py-4">
                          <span
                            className={
                              "text-xs px-2 py-1 rounded border " +
                              (cliente.segmento === "FRECUENTE"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : cliente.segmento === "OCASIONAL"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-slate-50 text-slate-700 border-slate-200")
                            }
                          >
                            {cliente.segmento ? segmentoLabel(cliente.segmento) : naText}
                          </span>
                        </td>
                        <td className="py-4 text-sm">{cliente.celular || cliente.telefono || t('customers.noPhone')}</td>
                        <td className="py-4 text-sm">{cliente.ciudad || t('customers.naDash')}</td>
                        <td className="py-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                            {cliente.cotizacionesRangeCount || 0}
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
                            {cliente._count?.ordenes || 0}
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
                            {cliente.invoiceCount || 0}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-right">{fmtMoney(cliente.invoiceTotal, locale)}</td>
                        <td className="py-4 text-sm text-right">{fmtMoney(cliente.invoiceCost, locale)}</td>
                        <td className="py-4 text-sm">{fmtDate(cliente.ultimaActividadAt, locale, naText)}</td>
                        <td className="py-4">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)}>
                              {t('common.edit')}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(cliente.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              {t('common.delete')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filtros (compacto, al lado) */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{t('customers.filters.title')}</CardTitle>
                <CardDescription>{t('customers.filters.subtitle')}</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setFiltersOpen((current) => !current)}>
                {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          {filtersOpen ? (
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>{t('customers.filters.site')}</Label>
              <select
                value={sedeFiltro}
                onChange={(e) => setSedeFiltro(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">{t('customers.filters.allSites')}</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>{t('customers.filters.segment')}</Label>
              <select
                value={segmentoFiltro}
                onChange={(e) =>
                  setSegmentoFiltro(e.target.value as "" | "POTENCIAL" | "OCASIONAL" | "FRECUENTE")
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">{t('customers.filters.segment.all')}</option>
                <option value="POTENCIAL">{segmentoLabelPlural('POTENCIAL')}</option>
                <option value="OCASIONAL">{segmentoLabelPlural('OCASIONAL')}</option>
                <option value="FRECUENTE">{segmentoLabelPlural('FRECUENTE')}</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>{t('customers.filters.documentType')}</Label>
              <select
                value={tipoDocumentoFiltro}
                onChange={(e) => setTipoDocumentoFiltro(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">{t('customers.filters.all')}</option>
                <option value="NIT">NIT</option>
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="PASAPORTE">{t('customers.form.documentType.PASAPORTE')}</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>{t('customers.filters.city')}</Label>
              <Input
                value={ciudadFiltro}
                onChange={(e) => setCiudadFiltro(e.target.value)}
                placeholder={t('customers.form.cityPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label>{t('customers.filters.createdAt')}</Label>
                <select
                  value={createdAtMode}
                  onChange={(e) => {
                    setCreatedAtMode(e.target.value as ("" | "day" | "month" | "year"))
                    setCreatedAtValue("")
                  }}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">{t('customers.filters.none')}</option>
                  <option value="day">{t('customers.filters.day')}</option>
                  <option value="month">{t('customers.filters.month')}</option>
                  <option value="year">{t('customers.filters.year')}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t('customers.filters.value')}</Label>
                <Input
                  disabled={!createdAtMode}
                  type={createdAtMode === 'day' ? 'date' : createdAtMode === 'month' ? 'month' : 'number'}
                  placeholder={createdAtMode === 'year' ? t('customers.filters.yearPlaceholder') : undefined}
                  value={createdAtValue}
                  onChange={(e) => setCreatedAtValue(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label>{t('customers.filters.activityFrom')}</Label>
                <Input type="date" value={actividadDesde} onChange={(e) => setActividadDesde(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>{t('customers.filters.activityTo')}</Label>
                <Input type="date" value={actividadHasta} onChange={(e) => setActividadHasta(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>{t('customers.filters.billingMin')}</Label>
                  <Input
                    inputMode="numeric"
                    value={facturadoMin}
                    onChange={(e) => setFacturadoMin(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('customers.filters.billingMax')}</Label>
                  <Input
                    inputMode="numeric"
                    value={facturadoMax}
                    onChange={(e) => setFacturadoMax(e.target.value)}
                    placeholder=""
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setActividadDesde("")
                    setActividadHasta("")
                  }}
                >
                  {t('customers.filters.clearRange')}
                </Button>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  {t('customers.filters.clearAll')}
                </Button>
              </div>
            </div>
          </CardContent>
          ) : (
            <CardContent>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
                Los filtros quedan colapsados por defecto para dar más ancho al listado. Ábrelos solo cuando los necesites.
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Modal de crear/editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? t('customers.dialog.editTitle') : t('customers.dialog.newTitle')}
            </DialogTitle>
            <DialogDescription>
              {editingCliente ? t('customers.dialog.editDescription') : t('customers.dialog.newDescription')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="col-span-2">
                <Label htmlFor="nombre">{t('customers.form.name')} *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  placeholder={t('customers.form.namePlaceholder')}
                />
              </div>

              {/* Segmento */}
              <div className="col-span-2">
                <Label htmlFor="segmento">{t('customers.form.segment')}</Label>
                <select
                  id="segmento"
                  value={formData.segmento}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      segmento: e.target.value as ("" | ClienteSegmento),
                    })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">{t('customers.form.segmentAuto')}</option>
                  <option value="POTENCIAL">{segmentoLabel('POTENCIAL')}</option>
                  <option value="OCASIONAL">{segmentoLabel('OCASIONAL')}</option>
                  <option value="FRECUENTE">{segmentoLabel('FRECUENTE')}</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('customers.form.segmentHelp')}
                </p>
              </div>

              {/* Tipo Documento */}
              <div>
                <Label htmlFor="tipoDocumento">{t('customers.form.documentType')} *</Label>
                <select
                  id="tipoDocumento"
                  value={formData.tipoDocumento}
                  onChange={(e) => setFormData({ ...formData, tipoDocumento: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  required
                >
                  <option value="NIT">NIT</option>
                  <option value="CC">{t('customers.form.documentType.CC')}</option>
                  <option value="CE">{t('customers.form.documentType.CE')}</option>
                  <option value="PASAPORTE">{t('customers.form.documentType.PASAPORTE')}</option>
                </select>
              </div>

              {/* Documento */}
              <div>
                <Label htmlFor="documento">{t('customers.form.documentNumber')} *</Label>
                <Input
                  id="documento"
                  value={formData.documento}
                  onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                  required
                  placeholder="123456789"
                />
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">{t('customers.form.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t('customers.form.emailPlaceholder')}
                />
              </div>

              {/* Teléfono */}
              <div>
                <Label htmlFor="telefono">{t('customers.form.phone')}</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder={t('customers.form.phonePlaceholder')}
                />
              </div>

              {/* Celular */}
              <div className="col-span-2">
                <Label htmlFor="celular">{t('customers.form.mobile')}</Label>
                <Input
                  id="celular"
                  value={formData.celular}
                  onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                  placeholder={t('customers.form.mobilePlaceholder')}
                />
              </div>

              {/* Dirección */}
              <div className="col-span-2">
                <Label htmlFor="direccion">{t('customers.form.address')}</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder={t('customers.form.addressPlaceholder')}
                />
              </div>

              {/* Ciudad */}
              <div>
                <Label htmlFor="ciudad">{t('customers.form.city')}</Label>
                <Input
                  id="ciudad"
                  value={formData.ciudad}
                  onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                  placeholder={t('customers.form.cityPlaceholder')}
                />
              </div>

              {/* Departamento */}
              <div>
                <Label htmlFor="departamento">{t('customers.form.state')}</Label>
                <Input
                  id="departamento"
                  value={formData.departamento}
                  onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                  placeholder={t('customers.form.statePlaceholder')}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
                }}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting 
                  ? t('common.saving')
                  : editingCliente 
                    ? t('customers.actions.update')
                    : t('customers.actions.create')
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
