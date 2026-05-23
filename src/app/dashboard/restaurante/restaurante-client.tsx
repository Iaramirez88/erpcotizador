'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ChefHat,
  ClipboardList,
  Flame,
  Plus,
  ReceiptText,
  ShoppingBasket,
  Soup,
  TimerReset,
  Trash2,
  Users2,
  Warehouse,
} from 'lucide-react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  createEmptyRestaurantBoard,
  type DiningTable,
  type KitchenTicket,
  type KitchenStatus,
  type Priority,
  type RecipeComponent,
  RESTAURANT_STATION_OPTIONS,
  type RestaurantBoardState,
  type RestaurantBoardSummary,
  type Station,
  type TableStatus,
} from '@/lib/restaurante'

type OverviewData = {
  sede: {
    id: string
    nombre: string
  }
  currentTurno: {
    id: string
    title: string | null
    status: 'ABIERTO' | 'CERRADO'
    closingNotes: string | null
    openedAt: string
    closedAt: string | null
    updatedAt: string
    board: RestaurantBoardState
    summary: RestaurantBoardSummary
  } | null
  salesToday: {
    total: number
    count: number
    average: number
    tickets: Array<{
      id: string
      numero: string
      createdAt: string
      clienteNombre: string
      total: number
      items: Array<{
        id: string
        materialId: string | null
        descripcion: string
        quantity: number
        total: number
      }>
    }>
  }
  purchasesWeek: {
    total: number
    count: number
    authorizedCount: number
    items: Array<{
      id: string
      fechaCompra: string
      proveedorNombre: string
      total: number
      autorizado: boolean
      numeroFactura: string | null
      observaciones: string | null
    }>
  }
  topProducts: Array<{
    key: string
    label: string
    materialId: string | null
    quantity: number
    total: number
  }>
  materials: Array<{
    id: string
    nombre: string
    categoria: string | null
    unidadMedida: string
    stockActual: number
    stockMinimo: number
    precioCompra: number | null
    precioUnidad: number | null
    wastePct: number
  }>
  stockAlerts: Array<{
    id: string
    nombre: string
    categoria: string | null
    unidadMedida: string
    stockActual: number
    stockMinimo: number
    wastePct: number
    severity: 'critical' | 'warning'
  }>
  wasteAlerts: Array<{
    id: string
    nombre: string
    categoria: string | null
    wastePct: number
    stockActual: number
    stockMinimo: number
  }>
}

type TicketFormState = {
  tableId: string
  guestName: string
  guests: number
  dishName: string
  qty: number
  station: Station
  priority: Priority
  recipeId: string
  note: string
}

type RecipeDraftState = {
  name: string
  station: Station
  yieldCount: number
  notes: string
  components: RecipeComponent[]
}

type AutosaveState = 'idle' | 'saving' | 'saved' | 'error'

const EMPTY_BOARD_SNAPSHOT = JSON.stringify(createEmptyRestaurantBoard())

function createRecipeDraft(): RecipeDraftState {
  return {
    name: '',
    station: 'COCINA',
    yieldCount: 1,
    notes: '',
    components: [{ id: crypto.randomUUID(), materialId: '', quantity: 1 }],
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value || 0)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function getTableTone(status: TableStatus) {
  if (status === 'LIBRE') return 'border-slate-200 bg-white text-slate-700'
  if (status === 'ATENDIENDO') return 'border-sky-200 bg-sky-50 text-sky-800'
  if (status === 'ESPERANDO_COCINA') return 'border-orange-200 bg-orange-50 text-orange-900'
  return 'border-emerald-200 bg-emerald-50 text-emerald-900'
}

function getKitchenTone(status: KitchenStatus) {
  if (status === 'PENDIENTE') return 'border-orange-200 bg-orange-50 text-orange-900'
  if (status === 'EN_PREPARACION') return 'border-sky-200 bg-sky-50 text-sky-800'
  if (status === 'LISTO') return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  return 'border-slate-200 bg-slate-100 text-slate-700'
}

function getNextKitchenStatus(status: KitchenStatus): KitchenStatus {
  if (status === 'PENDIENTE') return 'EN_PREPARACION'
  if (status === 'EN_PREPARACION') return 'LISTO'
  if (status === 'LISTO') return 'ENTREGADO'
  return 'ENTREGADO'
}

export default function RestauranteClient() {
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [board, setBoard] = useState<RestaurantBoardState>(createEmptyRestaurantBoard)
  const [currentTurnoId, setCurrentTurnoId] = useState<string | null>(null)
  const [currentTurnoStatus, setCurrentTurnoStatus] = useState<'ABIERTO' | 'CERRADO' | null>(null)
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle')
  const [boardReady, setBoardReady] = useState(false)
  const [isClosingTurno, setIsClosingTurno] = useState(false)
  const [ticketForm, setTicketForm] = useState<TicketFormState>({
    tableId: 'm1',
    guestName: '',
    guests: 2,
    dishName: '',
    qty: 1,
    station: 'COCINA',
    priority: 'NORMAL',
    recipeId: '',
    note: '',
  })
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraftState>(() => createRecipeDraft())
  const [shortageDraft, setShortageDraft] = useState({ label: '', note: '' })
  const lastPersistedSnapshotRef = useRef(EMPTY_BOARD_SNAPSHOT)
  const skipNextAutosaveRef = useRef(true)

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/restaurante/overview', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? 'No se pudo cargar el panel restaurante')
        }
        if (!cancelled) {
          const data = payload.data as OverviewData
          const nextBoard = data.currentTurno?.board ?? createEmptyRestaurantBoard()
          setOverview(data)
          setBoard(nextBoard)
          setCurrentTurnoId(data.currentTurno?.id ?? null)
          setCurrentTurnoStatus(data.currentTurno?.status ?? null)
          setTicketForm((current) => ({ ...current, tableId: nextBoard.tables[0]?.id ?? 'm1' }))
          lastPersistedSnapshotRef.current = JSON.stringify(nextBoard)
          skipNextAutosaveRef.current = true
          setBoardReady(true)
          setAutosaveState('idle')
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el panel restaurante')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadOverview()

    return () => {
      cancelled = true
    }
  }, [])

  const boardSnapshot = useMemo(() => JSON.stringify(board), [board])
  const isPristineBoard = boardSnapshot === EMPTY_BOARD_SNAPSHOT

  useEffect(() => {
    if (!boardReady) return
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false
      return
    }
    if (boardSnapshot === lastPersistedSnapshotRef.current) return
    if (!currentTurnoId && isPristineBoard) return

    setAutosaveState('saving')
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/restaurante/turnos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentTurnoId, action: 'SAVE', board }),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? 'No se pudo guardar el turno de restaurante')
        }

        const savedTurno = payload.data as OverviewData['currentTurno']
        lastPersistedSnapshotRef.current = boardSnapshot
        setCurrentTurnoId(savedTurno?.id ?? null)
        setCurrentTurnoStatus(savedTurno?.status ?? null)
        setOverview((current) => (current ? { ...current, currentTurno: savedTurno } : current))
        setAutosaveState('saved')
      } catch (saveError) {
        setAutosaveState('error')
        setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el turno de restaurante')
      }
    }, 900)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [board, boardReady, boardSnapshot, currentTurnoId, isPristineBoard])

  const kitchenQueue = useMemo(() => {
    return board.tables
      .flatMap((table) =>
        table.tickets.map((ticket) => ({
          ...ticket,
          tableId: table.id,
          tableName: table.name,
          guestName: table.guestName,
        }))
      )
      .filter((ticket) => ticket.status !== 'ENTREGADO')
      .sort((left, right) => {
        const priorityWeight = left.priority === 'ALTA' ? -1 : 0
        const nextPriorityWeight = right.priority === 'ALTA' ? -1 : 0
        if (priorityWeight !== nextPriorityWeight) return priorityWeight - nextPriorityWeight
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      })
  }, [board.tables])

  const consumption = useMemo(() => {
    const materialsById = new Map((overview?.materials ?? []).map((material) => [material.id, material]))
    const recipesById = new Map(board.recipes.map((recipe) => [recipe.id, recipe]))
    const aggregate = new Map<string, { materialId: string; nombre: string; unidad: string; qty: number; projectedStock: number; wastePct: number }>()

    for (const table of board.tables) {
      for (const ticket of table.tickets) {
        if (!ticket.recipeId) continue
        const recipe = recipesById.get(ticket.recipeId)
        if (!recipe) continue

        for (const component of recipe.components) {
          if (!component.materialId || component.quantity <= 0) continue
          const material = materialsById.get(component.materialId)
          if (!material) continue
          const normalizedQty = (component.quantity * ticket.qty) / Math.max(recipe.yieldCount, 1)
          const current = aggregate.get(component.materialId)
          if (current) {
            current.qty += normalizedQty
            current.projectedStock = material.stockActual - current.qty
            continue
          }
          aggregate.set(component.materialId, {
            materialId: component.materialId,
            nombre: material.nombre,
            unidad: material.unidadMedida,
            qty: normalizedQty,
            projectedStock: material.stockActual - normalizedQty,
            wastePct: material.wastePct,
          })
        }
      }
    }

    return Array.from(aggregate.values()).sort((left, right) => right.qty - left.qty)
  }, [board.recipes, board.tables, overview?.materials])

  const replenishmentSuggestions = useMemo(() => {
    const materialsById = new Map((overview?.materials ?? []).map((material) => [material.id, material]))
    const fromConsumption = consumption
      .map((item) => {
        const material = materialsById.get(item.materialId)
        if (!material) return null
        if (item.projectedStock >= material.stockMinimo) return null
        return {
          id: item.materialId,
          nombre: item.nombre,
          unidad: item.unidad,
          projectedStock: item.projectedStock,
          targetStock: material.stockMinimo,
          shortage: Math.max(material.stockMinimo - item.projectedStock, 0),
        }
      })
      .filter(Boolean) as Array<{
      id: string
      nombre: string
      unidad: string
      projectedStock: number
      targetStock: number
      shortage: number
    }>

    const fromStockAlerts = (overview?.stockAlerts ?? []).map((alert) => ({
      id: alert.id,
      nombre: alert.nombre,
      unidad: alert.unidadMedida,
      projectedStock: alert.stockActual,
      targetStock: alert.stockMinimo,
      shortage: Math.max(alert.stockMinimo - alert.stockActual, 0),
    }))

    const deduped = new Map<string, (typeof fromConsumption)[number]>()
    for (const item of [...fromConsumption, ...fromStockAlerts]) {
      deduped.set(item.id, item)
    }
    return Array.from(deduped.values()).sort((left, right) => right.shortage - left.shortage).slice(0, 8)
  }, [consumption, overview?.stockAlerts, overview?.materials])

  const activeTablesCount = board.tables.filter((table) => table.status !== 'LIBRE').length
  const deliveredTicketsCount = board.tables.flatMap((table) => table.tickets).filter((ticket) => ticket.status === 'ENTREGADO').length

  async function closeTurno() {
    if (isClosingTurno) return
    if (!currentTurnoId && isPristineBoard) return

    try {
      setIsClosingTurno(true)
      setError(null)
      const response = await fetch('/api/restaurante/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentTurnoId, action: 'CLOSE', board }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'No se pudo cerrar el turno')
      }

      lastPersistedSnapshotRef.current = EMPTY_BOARD_SNAPSHOT
      skipNextAutosaveRef.current = true
      setCurrentTurnoId(null)
      setCurrentTurnoStatus('CERRADO')
      setBoard(createEmptyRestaurantBoard())
      setTicketForm((current) => ({ ...current, tableId: 'm1', guestName: '', guests: 2, dishName: '', qty: 1, recipeId: '', note: '' }))
      setRecipeDraft(createRecipeDraft())
      setShortageDraft({ label: '', note: '' })
      setAutosaveState('idle')
      setOverview((current) => (current ? { ...current, currentTurno: null } : current))
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : 'No se pudo cerrar el turno')
    } finally {
      setIsClosingTurno(false)
    }
  }

  const autosaveLabel =
    autosaveState === 'saving'
      ? 'Guardando en base de datos...'
      : autosaveState === 'saved'
        ? 'Turno guardado en base de datos'
        : autosaveState === 'error'
          ? 'Error al guardar el turno'
          : currentTurnoId
            ? 'Turno activo persistido en base de datos'
            : 'Sin turno abierto todavía'

  function updateTable(tableId: string, updater: (table: DiningTable) => DiningTable) {
    setBoard((current) => ({
      ...current,
      tables: current.tables.map((table) => (table.id === tableId ? updater(table) : table)),
    }))
  }

  function submitTicket() {
    if (!ticketForm.tableId || !ticketForm.dishName.trim()) return

    const newTicket: KitchenTicket = {
      id: crypto.randomUUID(),
      dishName: ticketForm.dishName.trim(),
      qty: Math.max(1, Number(ticketForm.qty) || 1),
      station: ticketForm.station,
      priority: ticketForm.priority,
      status: 'PENDIENTE',
      recipeId: ticketForm.recipeId || null,
      note: ticketForm.note.trim(),
      createdAt: new Date().toISOString(),
    }

    updateTable(ticketForm.tableId, (table) => ({
      ...table,
      guestName: ticketForm.guestName.trim() || table.guestName,
      guests: Math.max(1, Number(ticketForm.guests) || table.guests || 1),
      status: 'ESPERANDO_COCINA',
      tickets: [...table.tickets, newTicket],
    }))

    setTicketForm((current) => ({
      ...current,
      dishName: '',
      qty: 1,
      note: '',
      recipeId: '',
    }))
  }

  function advanceTicket(tableId: string, ticketId: string) {
    updateTable(tableId, (table) => {
      const nextTickets = table.tickets.map((ticket) => {
        if (ticket.id !== ticketId) return ticket
        return { ...ticket, status: getNextKitchenStatus(ticket.status) }
      })

      const hasPendingKitchen = nextTickets.some((ticket) => ticket.status !== 'ENTREGADO')
      const hasReadyToCharge = nextTickets.some((ticket) => ticket.status === 'ENTREGADO')

      return {
        ...table,
        tickets: nextTickets,
        status: hasPendingKitchen ? 'ESPERANDO_COCINA' : hasReadyToCharge ? 'LISTA_PARA_COBRO' : 'ATENDIENDO',
      }
    })
  }

  function closeTable(tableId: string) {
    updateTable(tableId, (table) => ({
      ...table,
      status: 'LIBRE',
      guestName: '',
      guests: 0,
      note: '',
      tickets: [],
    }))
  }

  function addRecipe() {
    const validComponents = recipeDraft.components.filter((component) => component.materialId && component.quantity > 0)
    if (!recipeDraft.name.trim() || !validComponents.length) return

    setBoard((current) => ({
      ...current,
      recipes: [
        {
          id: crypto.randomUUID(),
          name: recipeDraft.name.trim(),
          station: recipeDraft.station,
          yieldCount: Math.max(1, Number(recipeDraft.yieldCount) || 1),
          notes: recipeDraft.notes.trim(),
          components: validComponents,
        },
        ...current.recipes,
      ],
    }))

    setRecipeDraft(createRecipeDraft())
  }

  function updateRecipeComponent(componentId: string, changes: Partial<RecipeComponent>) {
    setRecipeDraft((current) => ({
      ...current,
      components: current.components.map((component) => (component.id === componentId ? { ...component, ...changes } : component)),
    }))
  }

  function addRecipeComponentRow() {
    setRecipeDraft((current) => ({
      ...current,
      components: [...current.components, { id: crypto.randomUUID(), materialId: '', quantity: 1 }],
    }))
  }

  function removeRecipeComponentRow(componentId: string) {
    setRecipeDraft((current) => ({
      ...current,
      components: current.components.length === 1 ? current.components : current.components.filter((component) => component.id !== componentId),
    }))
  }

  function deleteRecipe(recipeId: string) {
    setBoard((current) => ({
      ...current,
      recipes: current.recipes.filter((recipe) => recipe.id !== recipeId),
    }))
  }

  function addShortage() {
    if (!shortageDraft.label.trim()) return
    setBoard((current) => ({
      ...current,
      shortages: [
        {
          id: crypto.randomUUID(),
          label: shortageDraft.label.trim(),
          note: shortageDraft.note.trim(),
          resolved: false,
        },
        ...current.shortages,
      ],
    }))
    setShortageDraft({ label: '', note: '' })
  }

  function toggleShortage(shortageId: string) {
    setBoard((current) => ({
      ...current,
      shortages: current.shortages.map((shortage) =>
        shortage.id === shortageId ? { ...shortage, resolved: !shortage.resolved } : shortage
      ),
    }))
  }

  const laneStats = [
    { label: 'Mesas activas', value: String(activeTablesCount), hint: 'servicios abiertos o en cobro', tone: 'sky' as const },
    { label: 'Comandas vivas', value: String(kitchenQueue.length), hint: 'cola de cocina/barra', tone: 'amber' as const },
    { label: 'Ventas hoy', value: formatCurrency(overview?.salesToday.total ?? 0), hint: 'desde POS pagado', tone: 'teal' as const },
    { label: 'Reposición sugerida', value: String(replenishmentSuggestions.length), hint: 'insumos para el siguiente turno', tone: 'neutral' as const },
  ]

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Restaurante' }]}
        eyebrow="Vertical SGDigital"
        title="Panel restaurante"
        description="Opera salón, barra y cocina en la misma cabina. Las ventas salen de POS; mesas, comandas, recetas y cierre se ordenan aquí sin perder contexto del turno."
        actions={
          <>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/90">
              <Link href="/dashboard/inventario">Revisar stock</Link>
            </Button>
            <Button asChild className="rounded-2xl">
              <Link href="/dashboard/pos">Entrar a caja</Link>
            </Button>
          </>
        }
        stats={laneStats}
      />

      {error ? (
        <Card className="rounded-[28px] border-red-200 bg-red-50 text-red-900">
          <CardContent className="p-6 text-sm">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardTitle className="flex items-center gap-2 text-2xl text-slate-950"><Users2 className="h-5 w-5 text-orange-700" /> Mesas y servicio</CardTitle>
            <CardDescription>Abre mesas, manda comandas y deja claro qué está cocinando, qué está listo y qué ya va a cobro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {board.tables.map((table) => {
                const pendingCount = table.tickets.filter((ticket) => ticket.status !== 'ENTREGADO').length
                const deliveredCount = table.tickets.filter((ticket) => ticket.status === 'ENTREGADO').length
                return (
                  <div key={table.id} className={cn('rounded-[24px] border p-4 transition-all', getTableTone(table.status))}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold">{table.name}</div>
                        <div className="text-sm opacity-80">{table.guestName || 'Sin responsable'} {table.guests ? `· ${table.guests} pax` : ''}</div>
                      </div>
                      <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">{table.status.replaceAll('_', ' ')}</span>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-current/80">
                      <div className="flex items-center justify-between"><span>Pendiente cocina</span><span className="font-semibold">{pendingCount}</span></div>
                      <div className="flex items-center justify-between"><span>Ya entregado</span><span className="font-semibold">{deliveredCount}</span></div>
                    </div>
                    {table.tickets.length ? (
                      <div className="mt-4 space-y-2">
                        {table.tickets.slice(-3).reverse().map((ticket) => (
                          <div key={ticket.id} className="rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-sm text-slate-700">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">{ticket.dishName}</span>
                              <span className="text-xs uppercase tracking-[0.16em]">x{ticket.qty}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                              <span>{ticket.station}</span>
                              <span>{ticket.status.replaceAll('_', ' ')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => updateTable(table.id, (current) => ({ ...current, status: current.status === 'LIBRE' ? 'ATENDIENDO' : current.status }))}>
                        Abrir
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => closeTable(table.id)}>
                        Cerrar mesa
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-slate-950"><Plus className="h-4 w-4 text-orange-700" /> Nueva comanda</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label>Mesa o canal</Label>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={ticketForm.tableId}
                    onChange={(event) => setTicketForm((current) => ({ ...current, tableId: event.target.value }))}
                  >
                    {board.tables.map((table) => (
                      <option key={table.id} value={table.id}>{table.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Responsable</Label>
                  <Input value={ticketForm.guestName} onChange={(event) => setTicketForm((current) => ({ ...current, guestName: event.target.value }))} placeholder="Nombre o mesa corporativa" />
                </div>
                <div className="space-y-2">
                  <Label>Comensales</Label>
                  <Input type="number" min={1} value={ticketForm.guests} onChange={(event) => setTicketForm((current) => ({ ...current, guests: Number(event.target.value) || 1 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Plato o bebida</Label>
                  <Input value={ticketForm.dishName} onChange={(event) => setTicketForm((current) => ({ ...current, dishName: event.target.value }))} placeholder="Ej. Bowl de pollo" />
                </div>
                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Input type="number" min={1} value={ticketForm.qty} onChange={(event) => setTicketForm((current) => ({ ...current, qty: Number(event.target.value) || 1 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Estación</Label>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={ticketForm.station}
                    onChange={(event) => setTicketForm((current) => ({ ...current, station: event.target.value as Station }))}
                  >
                    {RESTAURANT_STATION_OPTIONS.map((station) => (
                      <option key={station} value={station}>{station}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={ticketForm.priority}
                    onChange={(event) => setTicketForm((current) => ({ ...current, priority: event.target.value as Priority }))}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="ALTA">Alta</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Receta vinculada</Label>
                  <select
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    value={ticketForm.recipeId}
                    onChange={(event) => setTicketForm((current) => ({ ...current, recipeId: event.target.value }))}
                  >
                    <option value="">Sin receta</option>
                    {board.recipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label>Nota de cocina</Label>
                <Textarea value={ticketForm.note} onChange={(event) => setTicketForm((current) => ({ ...current, note: event.target.value }))} placeholder="Sin cebolla, término, empaque especial, etc." />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" className="rounded-2xl" onClick={submitTicket}>Mandar comanda</Button>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setTicketForm((current) => ({ ...current, dishName: '', qty: 1, note: '', recipeId: '' }))}>Limpiar</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="flex items-center gap-2 text-2xl text-slate-950"><ChefHat className="h-5 w-5 text-orange-700" /> Cola de cocina</CardTitle>
              <CardDescription>La cola vive por estación y prioridad para que el turno no se rompa en los picos de servicio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              {kitchenQueue.length ? kitchenQueue.map((ticket) => (
                <div key={ticket.id} className={cn('rounded-[24px] border p-4', getKitchenTone(ticket.status))}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{ticket.dishName}</div>
                      <div className="text-sm opacity-80">{ticket.tableName} · {ticket.station} · x{ticket.qty}</div>
                    </div>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">{ticket.priority}</span>
                  </div>
                  {ticket.note ? <div className="mt-2 text-sm opacity-80">{ticket.note}</div> : null}
                  <div className="mt-3 flex items-center justify-between text-xs opacity-70">
                    <span>{formatDateTime(ticket.createdAt)}</span>
                    <span>{ticket.status.replaceAll('_', ' ')}</span>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="mt-3 rounded-full bg-white/80" onClick={() => advanceTicket(ticket.tableId, ticket.id)}>
                    Avanzar estado
                  </Button>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">No hay comandas pendientes. El turno está limpio por ahora.</div>}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="flex items-center gap-2 text-2xl text-slate-950"><ReceiptText className="h-5 w-5 text-orange-700" /> Cierre de turno</CardTitle>
              <CardDescription>Combina ventas, compras cortas, entregas y reposición sugerida antes de cerrar caja o abrir el siguiente pico.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 rounded-2xl" />
                  <Skeleton className="h-16 rounded-2xl" />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Persistencia del turno</div>
                      <div className="mt-1 text-base font-semibold text-slate-950">{currentTurnoStatus === 'ABIERTO' ? 'Turno abierto' : currentTurnoStatus === 'CERRADO' ? 'Último turno cerrado' : 'Sin turno activo'}</div>
                      <div className="mt-1 text-sm text-slate-600">{autosaveLabel}</div>
                    </div>
                    <Button type="button" className="rounded-2xl" onClick={closeTurno} disabled={isClosingTurno || (!currentTurnoId && isPristineBoard)}>
                      {isClosingTurno ? 'Cerrando...' : 'Cerrar turno'}
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">Ventas POS de hoy</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-950">{formatCurrency(overview?.salesToday.total ?? 0)}</div>
                      <div className="mt-1 text-sm text-slate-600">{overview?.salesToday.count ?? 0} tickets · promedio {formatCurrency(overview?.salesToday.average ?? 0)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">Compras cortas 7 d</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-950">{formatCurrency(overview?.purchasesWeek.total ?? 0)}</div>
                      <div className="mt-1 text-sm text-slate-600">{overview?.purchasesWeek.authorizedCount ?? 0}/{overview?.purchasesWeek.count ?? 0} autorizadas</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">Comandas entregadas</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-950">{deliveredTicketsCount}</div>
                      <div className="mt-1 text-sm text-slate-600">Listas para cobro o ya cerradas en mesa</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-sm text-slate-500">Reposición sugerida</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-950">{replenishmentSuggestions.length}</div>
                      <div className="mt-1 text-sm text-slate-600">Materiales que conviene mover o comprar antes del siguiente turno</div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 p-4">
                    <div className="flex items-center gap-2 text-lg font-semibold text-slate-950"><ShoppingBasket className="h-4 w-4 text-orange-700" /> Compras cortas del turno</div>
                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                      <Input value={shortageDraft.label} onChange={(event) => setShortageDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Ej. Limón, vasos, carbón" />
                      <Input value={shortageDraft.note} onChange={(event) => setShortageDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Proveedor, urgencia o cantidad" />
                      <Button type="button" className="rounded-2xl" onClick={addShortage}>Agregar</Button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {board.shortages.length ? board.shortages.map((shortage) => (
                        <button key={shortage.id} type="button" onClick={() => toggleShortage(shortage.id)} className={cn('flex w-full items-start justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-all', shortage.resolved ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700')}>
                          <span>
                            <span className="block font-medium">{shortage.label}</span>
                            {shortage.note ? <span className="mt-1 block text-xs opacity-75">{shortage.note}</span> : null}
                          </span>
                          <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">{shortage.resolved ? 'Resuelto' : 'Pendiente'}</span>
                        </button>
                      )) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">Registra faltantes rápidos del turno para que no se pierdan en el cierre.</div>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notas del cierre</Label>
                    <Textarea value={board.closingNotes} onChange={(event) => setBoard((current) => ({ ...current, closingNotes: event.target.value }))} placeholder="Ventas fuera de ritmo, observaciones de caja, novedades de cocina o compra inmediata sugerida." />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardTitle className="flex items-center gap-2 text-2xl text-slate-950"><Soup className="h-5 w-5 text-orange-700" /> Recetas y consumo de insumos</CardTitle>
            <CardDescription>Arma recetas base por estación y enlázalas a las comandas para estimar consumo y reposición del turno.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre de la receta</Label>
                  <Input value={recipeDraft.name} onChange={(event) => setRecipeDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Burger clásica" />
                </div>
                <div className="space-y-2">
                  <Label>Estación</Label>
                  <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={recipeDraft.station} onChange={(event) => setRecipeDraft((current) => ({ ...current, station: event.target.value as Station }))}>
                    {RESTAURANT_STATION_OPTIONS.map((station) => (
                      <option key={station} value={station}>{station}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Rinde</Label>
                  <Input type="number" min={1} value={recipeDraft.yieldCount} onChange={(event) => setRecipeDraft((current) => ({ ...current, yieldCount: Number(event.target.value) || 1 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Input value={recipeDraft.notes} onChange={(event) => setRecipeDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Estándar, cocción, empaque" />
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {recipeDraft.components.map((component) => (
                  <div key={component.id} className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                    <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={component.materialId} onChange={(event) => updateRecipeComponent(component.id, { materialId: event.target.value })}>
                      <option value="">Selecciona un insumo</option>
                      {(overview?.materials ?? []).map((material) => (
                        <option key={material.id} value={material.id}>{material.nombre} · stock {formatNumber(material.stockActual)} {material.unidadMedida}</option>
                      ))}
                    </select>
                    <Input type="number" min={0.1} step="0.1" value={component.quantity} onChange={(event) => updateRecipeComponent(component.id, { quantity: Number(event.target.value) || 0 })} />
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => removeRecipeComponentRow(component.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={addRecipeComponentRow}>Agregar insumo</Button>
                <Button type="button" className="rounded-2xl" onClick={addRecipe}>Guardar receta</Button>
              </div>
            </div>

            <div className="space-y-3">
              {board.recipes.length ? board.recipes.map((recipe) => (
                <div key={recipe.id} className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-950">{recipe.name}</div>
                      <div className="text-sm text-slate-500">{recipe.station} · rinde {recipe.yieldCount}</div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => deleteRecipe(recipe.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    {recipe.components.map((component) => {
                      const material = overview?.materials.find((item) => item.id === component.materialId)
                      if (!material) return null
                      return <div key={component.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"><span>{material.nombre}</span><span>{formatNumber(component.quantity)} {material.unidadMedida}</span></div>
                    })}
                  </div>
                  {recipe.notes ? <div className="mt-3 text-sm text-slate-500">{recipe.notes}</div> : null}
                </div>
              )) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">Todavía no hay recetas guardadas. Vincúlalas a las comandas para calcular consumo del turno.</div>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="flex items-center gap-2 text-2xl text-slate-950"><Warehouse className="h-5 w-5 text-orange-700" /> Reposición y merma</CardTitle>
              <CardDescription>Combina stock real, consumo estimado y reglas de desperdicio para avisar antes de que el turno se quede sin insumos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"><TimerReset className="h-4 w-4 text-orange-700" /> Consumo estimado</div>
                <div className="space-y-2">
                  {consumption.length ? consumption.slice(0, 8).map((item) => (
                    <div key={item.materialId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-950">{item.nombre}</span>
                        <span>{formatNumber(item.qty)} {item.unidad}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>Stock proyectado {formatNumber(item.projectedStock)} {item.unidad}</span>
                        <span>Merma {formatNumber(item.wastePct)}%</span>
                      </div>
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">El consumo estimado aparecerá cuando las comandas usen recetas vinculadas.</div>}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"><Flame className="h-4 w-4 text-orange-700" /> Reposición sugerida</div>
                <div className="space-y-2">
                  {replenishmentSuggestions.length ? replenishmentSuggestions.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.nombre}</span>
                        <span>Comprar {formatNumber(item.shortage)} {item.unidad}</span>
                      </div>
                      <div className="mt-1 text-xs text-orange-800">Proyectado {formatNumber(item.projectedStock)} {item.unidad} · objetivo {formatNumber(item.targetStock)} {item.unidad}</div>
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">Sin alerta fuerte de reposición con la foto actual del turno.</div>}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500"><AlertTriangle className="h-4 w-4 text-orange-700" /> Alertas de merma</div>
                <div className="space-y-2">
                  {(overview?.wasteAlerts ?? []).length ? overview?.wasteAlerts.slice(0, 6).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{item.nombre}</span>
                        <span>{formatNumber(item.wastePct)}%</span>
                      </div>
                      <div className="mt-1 text-xs text-amber-800">Stock actual {formatNumber(item.stockActual)} · mínimo {formatNumber(item.stockMinimo)}</div>
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">La configuración de desperdicio de la sede aún no muestra riesgos altos.</div>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
            <CardHeader className="border-b border-slate-100 pb-5">
              <CardTitle className="flex items-center gap-2 text-2xl text-slate-950"><ClipboardList className="h-5 w-5 text-orange-700" /> Pulso del negocio</CardTitle>
              <CardDescription>Conecta la operación del turno con lo que ya viene entrando por POS, compras e inventario.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Platos con más salida</div>
                <div className="mt-3 space-y-2">
                  {loading ? (
                    <>
                      <Skeleton className="h-12 rounded-2xl" />
                      <Skeleton className="h-12 rounded-2xl" />
                    </>
                  ) : (overview?.topProducts ?? []).length ? overview?.topProducts.slice(0, 6).map((product) => (
                    <div key={product.key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <span className="font-medium text-slate-950">{product.label}</span>
                      <span>{formatNumber(product.quantity)} uds · {formatCurrency(product.total)}</span>
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">Todavía no hay ventas suficientes en POS para sugerir recetas o rotación.</div>}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Tickets pagados hoy</div>
                <div className="mt-3 space-y-2">
                  {loading ? (
                    <Skeleton className="h-16 rounded-2xl" />
                  ) : (overview?.salesToday.tickets ?? []).length ? overview?.salesToday.tickets.slice(0, 4).map((ticket) => (
                    <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-950">{ticket.numero}</span>
                        <span>{formatCurrency(ticket.total)}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{ticket.clienteNombre || 'Consumidor final'} · {formatDateTime(ticket.createdAt)}</div>
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">Sin tickets pagados hoy todavía.</div>}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline" className="rounded-2xl"><Link href="/dashboard/compras">Compras</Link></Button>
                <Button asChild variant="outline" className="rounded-2xl"><Link href="/dashboard/inventario">Inventario</Link></Button>
                <Button asChild variant="outline" className="rounded-2xl"><Link href="/dashboard/reportes">Reportes</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}