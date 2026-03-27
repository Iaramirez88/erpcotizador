'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ImportDialog } from '@/components/import/import-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { useI18n } from '@/components/providers/i18n-provider'
import { buildPurchaseOrderPrefillHref } from '@/lib/purchase-order-prefill'

type Proveedor = {
  id: string
  nombre: string
  nit: string | null
  telefono: string | null
  direccion: string | null
  email: string | null
  contacto: string | null
  ciudad: string | null
  departamento: string | null
  observaciones: string | null
  activo: boolean
  createdAt: string
}

export default function ProveedoresPage() {
  const { t } = useI18n()
  const router = useRouter()
  const naText = t('common.na')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Proveedor[]>([])

  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [email, setEmail] = useState('')
  const [contacto, setContacto] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const query = useMemo(() => search.trim(), [search])

  async function load() {
    setLoading(true)
    try {
      const url = new URL('/api/proveedores', window.location.origin)
      if (query) url.searchParams.set('search', query)
      const res = await fetch(url.toString())
      const json = await res.json().catch(() => null)
      setItems(json?.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function create() {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          nit: nit.trim() || null,
          telefono: telefono.trim() || null,
          direccion: direccion.trim() || null,
          email: email.trim() || null,
          contacto: contacto.trim() || null,
          ciudad: ciudad.trim() || null,
          departamento: departamento.trim() || null,
          observaciones: observaciones.trim() || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? t('suppliers.errors.createFailed'))
      }

      setNombre('')
      setNit('')
      setTelefono('')
      setDireccion('')
      setEmail('')
      setContacto('')
      setCiudad('')
      setDepartamento('')
      setObservaciones('')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  const exportExcel = () => {
    const url = new URL('/api/proveedores/export', window.location.origin)
    if (query) url.searchParams.set('search', query)
    window.location.href = url.toString()
  }

  function openSupplierOrder(proveedor: Proveedor) {
    const notes = [proveedor.contacto ? `Contacto: ${proveedor.contacto}` : null, proveedor.email ? `Email: ${proveedor.email}` : null]
      .filter(Boolean)
      .join(' · ')

    router.push(
      buildPurchaseOrderPrefillHref({
        mode: 'order',
        source: 'supplier',
        supplierName: proveedor.nombre,
        supplierPhone: proveedor.telefono ?? undefined,
        supplierAddress: proveedor.direccion ?? undefined,
        notes: notes || undefined,
      })
    )
  }

  return (
    <div className="space-y-6 p-8">
      <ErpPageHero
        eyebrow="ERP de abastecimiento"
        title={t('suppliers.title')}
        description={t('suppliers.subtitle')}
        actions={
          <>
            <ImportDialog
              module="proveedores"
              title={t('suppliers.actions.import')}
              onSuccess={async () => {
                await load()
              }}
            />
            <Button variant="outline" onClick={exportExcel}>
              {t('suppliers.actions.exportExcel')}
            </Button>
          </>
        }
        stats={[
          { label: 'Proveedores', value: items.length, hint: 'Registros visibles', tone: 'neutral' },
          { label: 'Búsqueda', value: query || naText, hint: 'Filtro activo', tone: 'sky' },
          { label: 'Nuevo proveedor', value: nombre.trim() || naText, hint: 'Formulario actual', tone: 'amber' },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('suppliers.create.title')}</CardTitle>
          <CardDescription>{t('suppliers.create.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 lg:col-span-2">
              <Label>{t('suppliers.fields.name')}</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={t('suppliers.placeholders.name')} />
            </div>
            <div className="space-y-2">
              <Label>{t('suppliers.fields.nit')}</Label>
              <Input value={nit} onChange={(e) => setNit(e.target.value)} placeholder={t('suppliers.placeholders.nit')} />
            </div>
            <div className="space-y-2">
              <Label>{t('suppliers.fields.phone')}</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder={t('suppliers.placeholders.phone')} />
            </div>
            <div className="space-y-2">
              <Label>{t('suppliers.fields.email')}</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('suppliers.placeholders.email')} />
            </div>
            <div className="space-y-2">
              <Label>{t('suppliers.fields.contact')}</Label>
              <Input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder={t('suppliers.placeholders.contact')} />
            </div>
            <div className="space-y-2">
              <Label>{t('suppliers.fields.city')}</Label>
              <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder={t('suppliers.placeholders.city')} />
            </div>
            <div className="space-y-2">
              <Label>{t('suppliers.fields.state')}</Label>
              <Input value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder={t('suppliers.placeholders.state')} />
            </div>
            <div className="space-y-2 lg:col-span-4">
              <Label>{t('suppliers.fields.address')}</Label>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder={t('suppliers.placeholders.address')} />
            </div>
            <div className="space-y-2 lg:col-span-4">
              <Label>{t('suppliers.fields.notes')}</Label>
              <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder={t('suppliers.placeholders.notes')} />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={create} disabled={saving || !nombre.trim()}>
              {saving ? t('common.saving') : t('suppliers.actions.create')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{t('suppliers.list.title')}</CardTitle>
              <CardDescription>{t('suppliers.list.description')}</CardDescription>
            </div>
            <div className="w-full max-w-md">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('suppliers.list.searchPlaceholder')} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">{t('suppliers.table.columns.name')}</th>
                  <th className="py-2 text-left">{t('suppliers.table.columns.nit')}</th>
                  <th className="py-2 text-left">{t('suppliers.table.columns.phone')}</th>
                  <th className="py-2 text-left">{t('suppliers.table.columns.email')}</th>
                  <th className="py-2 text-left">{t('suppliers.table.columns.address')}</th>
                  <th className="py-2 text-right">{t('suppliers.table.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.nombre}</td>
                    <td className="py-2">{p.nit ?? naText}</td>
                    <td className="py-2">{p.telefono ?? naText}</td>
                    <td className="py-2">{p.email ?? naText}</td>
                    <td className="py-2">{p.direccion ?? naText}</td>
                    <td className="py-2 text-right">
                      <Button variant="outline" onClick={() => openSupplierOrder(p)}>
                        {t('suppliers.actions.newOrder')}
                      </Button>
                    </td>
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={6}>
                      {t('common.noResults')}
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={6}>
                      {t('common.loading')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
