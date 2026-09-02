"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CatalogModuleTabs } from "@/components/inventory/catalog-module-tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ErpPageHero } from "@/components/dashboard/erp-page-chrome"
import { formatUnidadMedidaLabel } from "@/lib/utils"
import { useI18n } from "@/components/providers/i18n-provider"

type Warehouse = { id: string; nombre: string; codigo?: string | null }

type Material = { id: string; nombre: string; unidadMedida: string }

type Traslado = {
  id: string
  numero: string
  status: "PENDIENTE" | "COMPLETADO" | "CANCELADO"
  quantity: number
  note?: string | null
  createdAt: string
  completedAt?: string | null
  fromWarehouse: { id: string; nombre: string }
  toWarehouse: { id: string; nombre: string }
  material: { id: string; nombre: string; unidadMedida: string }
  createdBy?: { id: string; name: string | null } | null
  completedBy?: { id: string; name: string | null } | null
}

type ApiListResponse<T> = { success?: boolean; data?: T; error?: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "")
}

export default function TrasladosPage() {
  const { t, language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const [loading, setLoading] = useState(true)
  const [traslados, setTraslados] = useState<Traslado[]>([])
  const [search, setSearch] = useState("")

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [materials, setMaterials] = useState<Material[]>([])

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    fromWarehouseId: "",
    toWarehouseId: "",
    materialId: "",
    quantity: "1",
    note: "",
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return traslados
    return traslados.filter(
      (t) =>
        t.numero.toLowerCase().includes(q) ||
        t.fromWarehouse.nombre.toLowerCase().includes(q) ||
        t.toWarehouse.nombre.toLowerCase().includes(q) ||
        t.material.nombre.toLowerCase().includes(q)
    )
  }, [traslados, search])

  const loadCatalogs = useCallback(async () => {
    const [wRaw, mRaw] = await Promise.all([
      fetch("/api/bodegas")
        .then((r) => r.json().catch(() => null) as Promise<unknown>)
        .catch(() => null),
      fetch("/api/materiales?activo=true")
        .then((r) => r.json().catch(() => null) as Promise<unknown>)
        .catch(() => null),
    ])

    if (isRecord(wRaw) && wRaw.success === true && Array.isArray(wRaw.data)) {
      const list: Warehouse[] = wRaw.data
        .map((x): Warehouse | null => {
          if (!isRecord(x)) return null
          return {
            id: asString(x.id),
            nombre: asString(x.nombre),
            codigo: typeof x.codigo === "string" ? x.codigo : null,
          }
        })
        .filter((x): x is Warehouse => Boolean(x && x.id && x.nombre))
      setWarehouses(list)
    }

    if (isRecord(mRaw) && mRaw.success === true && Array.isArray(mRaw.data)) {
      const list: Material[] = mRaw.data
        .map((x): Material | null => {
          if (!isRecord(x)) return null
          return {
            id: asString(x.id),
            nombre: asString(x.nombre),
            unidadMedida: typeof x.unidadMedida === "string" ? x.unidadMedida : "",
          }
        })
        .filter((x): x is Material => Boolean(x && x.id && x.nombre))
      setMaterials(list)
    }
  }, [])

  const loadTraslados = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/inventario/traslados?limit=200")
      const json = (await res.json().catch(() => ({}))) as ApiListResponse<Traslado[]>
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setTraslados(json.data)
      } else {
        setTraslados([])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCatalogs()
    void loadTraslados()
  }, [loadCatalogs, loadTraslados])

  function openNew() {
    setForm({ fromWarehouseId: "", toWarehouseId: "", materialId: "", quantity: "1", note: "" })
    setOpen(true)
  }

  async function submit() {
    const qty = Number(form.quantity)
    if (!form.fromWarehouseId) {
      alert(t('inventoryTransfers.validation.selectFromSite'))
      return
    }
    if (!form.toWarehouseId) {
      alert(t('inventoryTransfers.validation.selectToSite'))
      return
    }
    if (form.fromWarehouseId === form.toWarehouseId) {
      alert(t('inventoryTransfers.validation.sitesMustDiffer'))
      return
    }
    if (!form.materialId) {
      alert(t('inventoryTransfers.validation.selectMaterial'))
      return
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      alert(t('inventoryTransfers.validation.invalidQuantity'))
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        fromWarehouseId: form.fromWarehouseId,
        toWarehouseId: form.toWarehouseId,
        materialId: form.materialId,
        quantity: qty,
        note: form.note || null,
      }

      const res = await fetch("/api/inventario/traslados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        alert(json?.error || t('inventoryTransfers.errors.createFailed'))
        return
      }

      setOpen(false)
      await loadTraslados()
    } finally {
      setSubmitting(false)
    }
  }

  const materialById = useMemo(() => {
    const m = new Map<string, Material>()
    for (const it of materials) m.set(it.id, it)
    return m
  }, [materials])

  const warehouseById = useMemo(() => {
    const w = new Map<string, Warehouse>()
    for (const it of warehouses) w.set(it.id, it)
    return w
  }, [warehouses])

  function statusLabel(status: Traslado['status'] | string): string {
    if (status === 'COMPLETADO') return t('inventoryTransfers.status.completed')
    if (status === 'PENDIENTE') return t('inventoryTransfers.status.pending')
    if (status === 'CANCELADO') return t('inventoryTransfers.status.canceled')
    return String(status)
  }

  return (
    <div className="space-y-6">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Inventario', href: '/dashboard/inventario' },
          { label: 'Traslados' },
        ]}
        title={t('inventoryTransfers.title')}
        description={t('inventoryTransfers.subtitle')}
        actions={<Button onClick={openNew}>{t('inventoryTransfers.actions.new')}</Button>}
      />

      <CatalogModuleTabs group="inventory" />

      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder={t('inventoryTransfers.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('inventoryTransfers.list.title', { count: filtered.length })}</CardTitle>
          <CardDescription>
            {t('inventoryTransfers.list.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">{t('inventoryTransfers.list.empty')}</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((transfer) => (
                <div key={transfer.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold">{transfer.numero}</div>
                        <span
                          className={
                            "text-xs px-2 py-1 rounded border " +
                            (transfer.status === "COMPLETADO"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : transfer.status === "PENDIENTE"
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                              : "bg-slate-50 text-slate-700 border-slate-200")
                          }
                        >
                          {statusLabel(transfer.status)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <strong>{transfer.material.nombre}</strong> — {transfer.quantity} {formatUnidadMedidaLabel(transfer.material.unidadMedida)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {t('inventoryTransfers.labels.from')}: <strong>{transfer.fromWarehouse.nombre}</strong> → {t('inventoryTransfers.labels.to')}: <strong>{transfer.toWarehouse.nombre}</strong>
                      </div>
                      {transfer.note ? <div className="text-sm mt-2">{transfer.note}</div> : null}
                      <div className="text-xs text-muted-foreground mt-2">
                        {t('inventoryTransfers.meta.created')}: {new Date(transfer.createdAt).toLocaleString(locale)}
                        {transfer.createdBy?.name ? ` ${t('inventoryTransfers.meta.by')} ${transfer.createdBy.name}` : ""}
                        {transfer.completedAt
                          ? ` · ${t('inventoryTransfers.meta.completed')}: ${new Date(transfer.completedAt).toLocaleString(locale)}`
                          : ""}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('inventoryTransfers.dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('inventoryTransfers.dialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t('inventoryTransfers.fields.fromSite')}</Label>
              <select
                value={form.fromWarehouseId}
                onChange={(e) => setForm((p) => ({ ...p, fromWarehouseId: e.target.value }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">{t('inventoryTransfers.placeholders.fromSite')}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>{t('inventoryTransfers.fields.toSite')}</Label>
              <select
                value={form.toWarehouseId}
                onChange={(e) => setForm((p) => ({ ...p, toWarehouseId: e.target.value }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">{t('inventoryTransfers.placeholders.toSite')}</option>
                {warehouses
                  .filter((w) => w.id !== form.fromWarehouseId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label>{t('inventoryTransfers.fields.material')}</Label>
              <select
                value={form.materialId}
                onChange={(e) => setForm((p) => ({ ...p, materialId: e.target.value }))}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">{t('inventoryTransfers.placeholders.material')}</option>
                {materials
                  .slice()
                  .sort((a, b) => a.nombre.localeCompare(b.nombre, language === 'en' ? 'en' : 'es'))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label>{t('inventoryTransfers.fields.quantity')}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                placeholder="1"
              />
              {form.materialId && materialById.get(form.materialId) ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('inventoryTransfers.fields.unit')}: {formatUnidadMedidaLabel(materialById.get(form.materialId)!.unidadMedida)}
                </p>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <Label>{t('inventoryTransfers.fields.noteOptional')}</Label>
              <Input
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                placeholder={t('inventoryTransfers.placeholders.note')}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? t('inventoryTransfers.actions.creating') : t('inventoryTransfers.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
