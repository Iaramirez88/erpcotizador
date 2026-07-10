'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ImportDialog } from '@/components/import/import-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { useCurrentUserAccess } from '@/hooks/use-current-user-access'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
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
  const { mode: dataViewMode, setMode: setDataViewMode } = useDataViewMode('proveedores.history', 'list')
  const { hasWriteAccess } = useCurrentUserAccess()
  const canManageSuppliers = hasWriteAccess('PROVEEDORES')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
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

  function resetForm() {
    setNombre('')
    setNit('')
    setTelefono('')
    setDireccion('')
    setEmail('')
    setContacto('')
    setCiudad('')
    setDepartamento('')
    setObservaciones('')
  }

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

      resetForm()
      setCreateOpen(false)
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
    <div className="space-y-6 p-4 sm:p-6">
      <ErpPageHero
        eyebrow="ERP de abastecimiento"
        title={t('suppliers.title')}
        description={t('suppliers.subtitle')}
        actions={
          <>
            {canManageSuppliers ? <Button onClick={() => setCreateOpen(true)}>
              Nuevo proveedor
            </Button> : null}
            {canManageSuppliers ? <ImportDialog
              module="proveedores"
              title={t('suppliers.actions.import')}
              onSuccess={async () => {
                await load()
              }}
            /> : null}
            {canManageSuppliers ? <Button variant="outline" onClick={exportExcel}>
              {t('suppliers.actions.exportExcel')}
            </Button> : null}
          </>
        }
        stats={[
          { label: 'Proveedores', value: items.length, hint: 'Registros visibles', tone: 'neutral' },
          { label: 'Búsqueda', value: query || naText, hint: 'Filtro activo', tone: 'sky' },
          { label: 'Nuevo proveedor', value: nombre.trim() || naText, hint: 'Formulario actual', tone: 'amber' },
        ]}
      />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('suppliers.create.title')}</DialogTitle>
            <DialogDescription>{t('suppliers.create.description')}</DialogDescription>
          </DialogHeader>
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

          <div className="flex justify-end">
            <Button onClick={create} disabled={saving || !nombre.trim()}>
              {saving ? t('common.saving') : t('suppliers.actions.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{t('suppliers.list.title')}</CardTitle>
              <CardDescription>{t('suppliers.list.description')}</CardDescription>
            </div>
            <div className="flex w-full max-w-2xl items-center justify-end gap-3">
              <div className="w-full max-w-md">
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('suppliers.list.searchPlaceholder')} />
              </div>
              <DataViewToggle mode={dataViewMode} onChange={setDataViewMode} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dataViewMode === 'grid' ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((p) => (
                <Card key={p.id} className="rounded-2xl border bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div>
                      <p className="font-semibold text-foreground">{p.nombre}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{p.nit ?? naText}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">{t('suppliers.table.columns.phone')}</p>
                        <p className="font-medium text-foreground">{p.telefono ?? naText}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t('suppliers.table.columns.email')}</p>
                        <p className="font-medium text-foreground break-all">{p.email ?? naText}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">{t('suppliers.table.columns.address')}</p>
                        <p className="font-medium text-foreground">{p.direccion ?? naText}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button variant="outline" onClick={() => openSupplierOrder(p)}>
                        {t('suppliers.actions.newOrder')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!loading && items.length === 0 ? (
                <div className="md:col-span-2 xl:col-span-3 py-6 text-center text-muted-foreground">{t('common.noResults')}</div>
              ) : null}
              {loading ? (
                <div className="md:col-span-2 xl:col-span-3 py-6 text-center text-muted-foreground">{t('common.loading')}</div>
              ) : null}
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
