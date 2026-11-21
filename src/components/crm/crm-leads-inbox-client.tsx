'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LayoutGrid, List, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  CrmLeadsFilters,
  EMPTY_LEADS_FILTERS,
  type CrmLeadsFilterState,
} from '@/components/crm/crm-leads-filters'
import { CrmLeadsTable, type CrmLeadsSortKey } from '@/components/crm/crm-leads-table'
import { CrmLeadsCards } from '@/components/crm/crm-leads-cards'
import { CrmLeadsViewsTabs } from '@/components/crm/crm-leads-views-tabs'
import { CrmNegotiationsTabs } from '@/components/crm/crm-negotiations-tabs'
import { CrmLeadDetailPanel } from '@/components/crm/crm-lead-detail-panel'
import type {
  CrmLeadFacets,
  CrmLeadOwner,
  CrmLeadPagination,
  CrmLeadRow,
} from '@/components/crm/crm-leads-types'

type LeadsResponse = {
  data?: CrmLeadRow[]
  pagination?: CrmLeadPagination
  facets?: CrmLeadFacets
  error?: string
}

const EMPTY_NEW_LEAD = {
  nombre: '',
  empresaNombre: '',
  email: '',
  telefono: '',
  serviceInterest: '',
  source: 'OTRO',
}

export function CrmLeadsInboxClient() {
  const { toast } = useToast()
  const [view, setView] = useState('all')
  const [filters, setFilters] = useState<CrmLeadsFilterState>(EMPTY_LEADS_FILTERS)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortKey, setSortKey] = useState<CrmLeadsSortKey>('lastActivityAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [leads, setLeads] = useState<CrmLeadRow[]>([])
  const [pagination, setPagination] = useState<CrmLeadPagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  })
  const [facets, setFacets] = useState<CrmLeadFacets>({ byStatus: {}, all: 0, unassigned: 0, scope: 'SEDE' })
  const [owners, setOwners] = useState<CrmLeadOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewLead, setShowNewLead] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newLead, setNewLead] = useState(EMPTY_NEW_LEAD)
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'single'; lead: CrmLeadRow } | { kind: 'bulk'; count: number } | null
  >(null)
  const [deleting, setDeleting] = useState(false)

  const query = useMemo(() => {
    const params = new URLSearchParams()
    params.set('view', view)
    params.set('page', String(page))
    params.set('pageSize', String(pageSize))
    params.set('sort', sortKey)
    params.set('dir', sortDir)
    if (filters.q) params.set('q', filters.q)
    if (filters.source) params.set('source', filters.source)
    if (filters.scoreBand) params.set('scoreBand', filters.scoreBand)
    if (filters.ownerUserId) params.set('ownerUserId', filters.ownerUserId)
    if (filters.serviceInterest) params.set('serviceInterest', filters.serviceInterest)
    if (filters.unassigned) params.set('unassigned', '1')
    if (filters.createdFrom) params.set('createdFrom', filters.createdFrom)
    if (filters.createdTo) params.set('createdTo', filters.createdTo)
    return params.toString()
  }, [view, page, pageSize, sortKey, sortDir, filters])

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/crm/leads?${query}`, { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as LeadsResponse | null
      if (!response.ok || !payload?.data) throw new Error(payload?.error || 'No se pudieron cargar los leads')
      setLeads(payload.data)
      if (payload.pagination) setPagination(payload.pagination)
      if (payload.facets) setFacets(payload.facets)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error al cargar los leads')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadLeads()
    }, 250)
    return () => clearTimeout(timeout)
  }, [loadLeads])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/api/crm/assignees', { cache: 'no-store' })
        const payload = (await response.json().catch(() => null)) as { data?: CrmLeadOwner[] } | null
        if (!cancelled) setOwners(Array.isArray(payload?.data) ? payload.data : [])
      } catch {
        if (!cancelled) setOwners([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function patchFilters(patch: Partial<CrmLeadsFilterState>) {
    setPage(1)
    setFilters((current) => ({ ...current, ...patch }))
  }

  function changeSort(key: CrmLeadsSortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  async function createLead() {
    if (!newLead.nombre && !newLead.email && !newLead.telefono) {
      toast({
        title: 'Datos incompletos',
        description: 'Ingresa nombre, correo o teléfono.',
        variant: 'destructive',
      })
      return
    }
    setCreating(true)
    try {
      const response = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'No se pudo crear el lead')
      toast({ title: 'Lead creado' })
      setShowNewLead(false)
      setNewLead(EMPTY_NEW_LEAD)
      await loadLeads()
    } catch (createError) {
      toast({
        title: 'No se pudo crear el lead',
        description: createError instanceof Error ? createError.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const allSelected = leads.length > 0 && leads.every((lead) => selectedIds.has(lead.id))

  function toggleSelect(leadId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(leadId)) next.delete(leadId)
      else next.add(leadId)
      return next
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(leads.map((lead) => lead.id)))
    }
  }

  function requestSingleDelete(lead: CrmLeadRow) {
    setDeleteTarget({ kind: 'single', lead })
    setDeleteDialogOpen(true)
  }

  function requestBulkDelete() {
    setDeleteTarget({ kind: 'bulk', count: selectedIds.size })
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.kind === 'single') {
        const response = await fetch(`/api/crm/leads/${deleteTarget.lead.id}`, { method: 'DELETE' })
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        if (!response.ok) throw new Error(payload?.error || 'No se pudo eliminar el lead')
        toast({ title: 'Lead eliminado' })
        setSelectedIds((current) => {
          const next = new Set(current)
          next.delete(deleteTarget.lead.id)
          return next
        })
        if (selectedId === deleteTarget.lead.id) setSelectedId(null)
      } else {
        const response = await fetch('/api/crm/leads/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedIds) }),
        })
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; data?: { deleted?: number; skipped?: number } }
          | null
        if (!response.ok) throw new Error(payload?.error || 'No se pudieron eliminar los leads')
        const deleted = payload?.data?.deleted ?? selectedIds.size
        const skipped = payload?.data?.skipped ?? 0
        toast({
          title: `${deleted} lead${deleted === 1 ? '' : 's'} eliminado${deleted === 1 ? '' : 's'}`,
          description: skipped ? `${skipped} sin permiso para eliminar` : undefined,
        })
        setSelectedIds(new Set())
      }
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      await loadLeads()
    } catch (deleteError) {
      toast({
        title: 'No se pudo eliminar',
        description: deleteError instanceof Error ? deleteError.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Bandeja de leads</h1>
          <p className="text-xs text-slate-500">
            {facets.all} leads · alcance {facets.scope} · {pagination.total} en la vista actual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition',
                viewMode === 'list' ? 'bg-slate-100 text-slate-900' : 'bg-white text-slate-500 hover:text-slate-700'
              )}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={cn(
                'flex items-center gap-1 border-l border-slate-200 px-2.5 py-1.5 text-[11px] font-medium transition',
                viewMode === 'cards' ? 'bg-slate-100 text-slate-900' : 'bg-white text-slate-500 hover:text-slate-700'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Cartas
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={() => void loadLeads()} disabled={loading}>
            <RefreshCw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Actualizar
          </Button>
          <Button size="sm" onClick={() => setShowNewLead((current) => !current)}>
            <Plus className="h-3.5 w-3.5" /> Nuevo lead
          </Button>
        </div>
      </div>

      <CrmNegotiationsTabs />

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      ) : null}

      {showNewLead ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              className="h-9 text-xs"
              placeholder="Nombre *"
              value={newLead.nombre}
              onChange={(event) => setNewLead((current) => ({ ...current, nombre: event.target.value }))}
            />
            <Input
              className="h-9 text-xs"
              placeholder="Empresa"
              value={newLead.empresaNombre}
              onChange={(event) => setNewLead((current) => ({ ...current, empresaNombre: event.target.value }))}
            />
            <Input
              className="h-9 text-xs"
              placeholder="Correo"
              value={newLead.email}
              onChange={(event) => setNewLead((current) => ({ ...current, email: event.target.value }))}
            />
            <Input
              className="h-9 text-xs"
              placeholder="Teléfono"
              value={newLead.telefono}
              onChange={(event) => setNewLead((current) => ({ ...current, telefono: event.target.value }))}
            />
            <Input
              className="h-9 text-xs"
              placeholder="Servicio de interés"
              value={newLead.serviceInterest}
              onChange={(event) => setNewLead((current) => ({ ...current, serviceInterest: event.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-slate-200 px-2.5 text-xs"
              value={newLead.source}
              onChange={(event) => setNewLead((current) => ({ ...current, source: event.target.value }))}
            >
              <option value="OTRO">Otro</option>
              <option value="WEB">Web</option>
              <option value="REFERIDO">Referido</option>
              <option value="LLAMADA">Llamada</option>
              <option value="EVENTO">Evento</option>
              <option value="IMPORT">Importación</option>
            </select>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowNewLead(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={creating} onClick={() => void createLead()}>
              {creating ? 'Creando…' : 'Crear lead'}
            </Button>
          </div>
        </div>
      ) : null}

      <CrmLeadsViewsTabs
        activeView={view}
        counters={facets.byStatus}
        total={facets.all}
        unassigned={facets.unassigned}
        onChange={(nextView) => {
          setView(nextView)
          setPage(1)
        }}
      />

      <CrmLeadsFilters
        value={filters}
        owners={owners}
        onChange={patchFilters}
        onClear={() => {
          setFilters(EMPTY_LEADS_FILTERS)
          setPage(1)
        }}
      />

      {selectedIds.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
          <span className="font-medium">
            {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={toggleSelectAll}>
              {allSelected ? 'Quitar selección' : 'Seleccionar todos'}
            </Button>
            <Button size="sm" variant="destructive" onClick={requestBulkDelete} disabled={deleting}>
              <Trash2 className="h-3.5 w-3.5" /> Eliminar seleccionados
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="min-w-0 flex-1 space-y-3">
          {viewMode === 'cards' ? (
            <CrmLeadsCards
              leads={leads}
              loading={loading}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={(lead) => setSelectedId(lead.id)}
              onToggleSelect={toggleSelect}
            />
          ) : (
            <CrmLeadsTable
              leads={leads}
              loading={loading}
              selectedId={selectedId}
              selectedIds={selectedIds}
              allSelected={allSelected}
              sortKey={sortKey}
              sortDir={sortDir}
              onSelect={(lead) => setSelectedId(lead.id)}
              onSortChange={changeSort}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onAssign={(lead) => setSelectedId(lead.id)}
              onStatus={(lead) => setSelectedId(lead.id)}
              onConvert={(lead) => setSelectedId(lead.id)}
              onDoNotContact={(lead) => setSelectedId(lead.id)}
              onDelete={requestSingleDelete}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <span>
              Página {pagination.page} de {pagination.totalPages} · {pagination.total} leads
            </span>
            <div className="flex items-center gap-2">
              <select
                className="h-8 rounded-md border border-slate-200 px-2 text-[11px]"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(1)
                }}
              >
                {[25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size} por página
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>

        <CrmLeadDetailPanel
          leadId={selectedId}
          owners={owners}
          onClose={() => setSelectedId(null)}
          onChanged={() => void loadLeads()}
        />
      </div>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteDialogOpen(false)
            setDeleteTarget(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.kind === 'single' ? 'Eliminar lead' : 'Eliminar leads seleccionados'}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.kind === 'single'
                ? `¿Eliminar el lead “${deleteTarget.lead.nombre}”?`
                : `¿Eliminar ${deleteTarget?.count ?? 0} leads seleccionados?`}{' '}
              Esta acción es irreversible y los registros se borrarán permanentemente. Las conversaciones,
              tareas y oportunidades asociadas quedarán sin lead vinculado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeleteTarget(null)
              }}
            >
              Cancelar
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

