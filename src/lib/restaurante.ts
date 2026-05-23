export type TableStatus = 'LIBRE' | 'ATENDIENDO' | 'ESPERANDO_COCINA' | 'LISTA_PARA_COBRO'
export type KitchenStatus = 'PENDIENTE' | 'EN_PREPARACION' | 'LISTO' | 'ENTREGADO'
export type Station = 'COCINA' | 'BARRA' | 'EMPAQUE'
export type Priority = 'ALTA' | 'NORMAL'

export type KitchenTicket = {
  id: string
  dishName: string
  qty: number
  station: Station
  priority: Priority
  status: KitchenStatus
  recipeId: string | null
  note: string
  createdAt: string
}

export type RecipeComponent = {
  id: string
  materialId: string
  quantity: number
}

export type Recipe = {
  id: string
  name: string
  station: Station
  yieldCount: number
  notes: string
  components: RecipeComponent[]
}

export type DiningTable = {
  id: string
  name: string
  status: TableStatus
  guestName: string
  guests: number
  note: string
  tickets: KitchenTicket[]
}

export type ShortageNote = {
  id: string
  label: string
  note: string
  resolved: boolean
}

export type RestaurantBoardState = {
  tables: DiningTable[]
  recipes: Recipe[]
  shortages: ShortageNote[]
  closingNotes: string
}

export type RestaurantBoardSummary = {
  activeTablesCount: number
  openTicketsCount: number
  deliveredTicketsCount: number
  recipeCount: number
  shortageCount: number
  unresolvedShortageCount: number
}

export const RESTAURANT_STATION_OPTIONS: Station[] = ['COCINA', 'BARRA', 'EMPAQUE']

const TABLE_STATUS_VALUES: TableStatus[] = ['LIBRE', 'ATENDIENDO', 'ESPERANDO_COCINA', 'LISTA_PARA_COBRO']
const KITCHEN_STATUS_VALUES: KitchenStatus[] = ['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO']
const PRIORITY_VALUES: Priority[] = ['ALTA', 'NORMAL']

export const DEFAULT_RESTAURANT_TABLES: DiningTable[] = [
  { id: 'm1', name: 'Mesa 1', status: 'LIBRE', guestName: '', guests: 0, note: '', tickets: [] },
  { id: 'm2', name: 'Mesa 2', status: 'LIBRE', guestName: '', guests: 0, note: '', tickets: [] },
  { id: 'm3', name: 'Mesa 3', status: 'LIBRE', guestName: '', guests: 0, note: '', tickets: [] },
  { id: 'm4', name: 'Mesa 4', status: 'LIBRE', guestName: '', guests: 0, note: '', tickets: [] },
  { id: 'barra', name: 'Barra', status: 'LIBRE', guestName: '', guests: 0, note: '', tickets: [] },
  { id: 'dom', name: 'Domicilios', status: 'LIBRE', guestName: '', guests: 0, note: '', tickets: [] },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanPositiveNumber(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeTableStatus(value: unknown): TableStatus {
  return typeof value === 'string' && TABLE_STATUS_VALUES.includes(value as TableStatus) ? (value as TableStatus) : 'LIBRE'
}

function normalizeKitchenStatus(value: unknown): KitchenStatus {
  return typeof value === 'string' && KITCHEN_STATUS_VALUES.includes(value as KitchenStatus) ? (value as KitchenStatus) : 'PENDIENTE'
}

function normalizeStation(value: unknown): Station {
  return typeof value === 'string' && RESTAURANT_STATION_OPTIONS.includes(value as Station) ? (value as Station) : 'COCINA'
}

function normalizePriority(value: unknown): Priority {
  return typeof value === 'string' && PRIORITY_VALUES.includes(value as Priority) ? (value as Priority) : 'NORMAL'
}

export function createEmptyRestaurantBoard(): RestaurantBoardState {
  return {
    tables: DEFAULT_RESTAURANT_TABLES.map((table) => ({ ...table, tickets: [] })),
    recipes: [],
    shortages: [],
    closingNotes: '',
  }
}

export function sanitizeRestaurantBoard(value: unknown): RestaurantBoardState {
  if (!isRecord(value)) return createEmptyRestaurantBoard()

  const tables = Array.isArray(value.tables)
    ? value.tables
        .map((table, index) => {
          if (!isRecord(table)) return null
          const tickets = Array.isArray(table.tickets)
            ? table.tickets
                .map((ticket, ticketIndex) => {
                  if (!isRecord(ticket)) return null
                  return {
                    id: cleanText(ticket.id) || `ticket-${index + 1}-${ticketIndex + 1}`,
                    dishName: cleanText(ticket.dishName) || 'Sin nombre',
                    qty: cleanPositiveNumber(ticket.qty, 1),
                    station: normalizeStation(ticket.station),
                    priority: normalizePriority(ticket.priority),
                    status: normalizeKitchenStatus(ticket.status),
                    recipeId: cleanText(ticket.recipeId) || null,
                    note: cleanText(ticket.note),
                    createdAt: cleanText(ticket.createdAt) || new Date(0).toISOString(),
                  } satisfies KitchenTicket
                })
                .filter(Boolean) as KitchenTicket[]
            : []

          return {
            id: cleanText(table.id) || `table-${index + 1}`,
            name: cleanText(table.name) || `Mesa ${index + 1}`,
            status: normalizeTableStatus(table.status),
            guestName: cleanText(table.guestName),
            guests: Math.max(0, Math.round(cleanPositiveNumber(table.guests, 0))),
            note: cleanText(table.note),
            tickets,
          } satisfies DiningTable
        })
        .filter(Boolean) as DiningTable[]
    : []

  const recipes = Array.isArray(value.recipes)
    ? value.recipes
        .map((recipe, index) => {
          if (!isRecord(recipe)) return null
          const components = Array.isArray(recipe.components)
            ? recipe.components
                .map((component, componentIndex) => {
                  if (!isRecord(component)) return null
                  const materialId = cleanText(component.materialId)
                  if (!materialId) return null
                  return {
                    id: cleanText(component.id) || `component-${index + 1}-${componentIndex + 1}`,
                    materialId,
                    quantity: cleanPositiveNumber(component.quantity, 1),
                  } satisfies RecipeComponent
                })
                .filter(Boolean) as RecipeComponent[]
            : []

          return {
            id: cleanText(recipe.id) || `recipe-${index + 1}`,
            name: cleanText(recipe.name) || `Receta ${index + 1}`,
            station: normalizeStation(recipe.station),
            yieldCount: cleanPositiveNumber(recipe.yieldCount, 1),
            notes: cleanText(recipe.notes),
            components,
          } satisfies Recipe
        })
        .filter(Boolean) as Recipe[]
    : []

  const shortages = Array.isArray(value.shortages)
    ? value.shortages
        .map((shortage, index) => {
          if (!isRecord(shortage)) return null
          return {
            id: cleanText(shortage.id) || `shortage-${index + 1}`,
            label: cleanText(shortage.label) || `Faltante ${index + 1}`,
            note: cleanText(shortage.note),
            resolved: shortage.resolved === true,
          } satisfies ShortageNote
        })
        .filter(Boolean) as ShortageNote[]
    : []

  return {
    tables: tables.length ? tables : createEmptyRestaurantBoard().tables,
    recipes,
    shortages,
    closingNotes: cleanText(value.closingNotes),
  }
}

export function computeRestaurantBoardSummary(board: RestaurantBoardState): RestaurantBoardSummary {
  const tickets = board.tables.flatMap((table) => table.tickets)
  return {
    activeTablesCount: board.tables.filter((table) => table.status !== 'LIBRE').length,
    openTicketsCount: tickets.filter((ticket) => ticket.status !== 'ENTREGADO').length,
    deliveredTicketsCount: tickets.filter((ticket) => ticket.status === 'ENTREGADO').length,
    recipeCount: board.recipes.length,
    shortageCount: board.shortages.length,
    unresolvedShortageCount: board.shortages.filter((shortage) => !shortage.resolved).length,
  }
}