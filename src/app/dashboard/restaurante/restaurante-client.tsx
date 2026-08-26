"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ChefHat,
  ChevronRight,
  Clock3,
  Eye,
  Flame,
  GripVertical,
  HandCoins,
  LayoutGrid,
  Loader2,
  Plus,
  Printer,
  ReceiptText,
  Settings2,
  ShoppingBasket,
  TimerReset,
  Trash2,
  Undo2,
  Users2,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { buildWhatsAppWebUrl } from "@/lib/whatsapp-link";
import { cn } from "@/lib/utils";
import {
  createEmptyRestaurantBoard,
  type DiningTable,
  type KitchenStatus,
  type KitchenTicket,
  type Priority,
  type RecipeComponent,
  RESTAURANT_STATION_OPTIONS,
  type RestaurantActivityLog,
  type RestaurantBoardState,
  type RestaurantBoardSummary,
  type RestaurantCourierType,
  type RestaurantServiceMode,
  type Station,
  type TableStatus,
} from "@/lib/restaurante";

type OverviewData = {
  sede: {
    id: string;
    nombre: string;
  };
  currentTurno: {
    id: string;
    title: string | null;
    status: "ABIERTO" | "CERRADO";
    closingNotes: string | null;
    openedAt: string;
    closedAt: string | null;
    updatedAt: string;
    board: RestaurantBoardState;
    summary: RestaurantBoardSummary;
  } | null;
  salesToday: {
    total: number;
    count: number;
    average: number;
    tickets: Array<{
      id: string;
      numero: string;
      createdAt: string;
      clienteNombre: string;
      status: "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
      returnedTotal: number;
      total: number;
      items: Array<{
        id: string;
        materialId: string | null;
        descripcion: string;
        quantity: number;
        unitPrice: number;
        total: number;
      }>;
    }>;
  };
  purchasesWeek: {
    total: number;
    count: number;
    authorizedCount: number;
    items: Array<{
      id: string;
      fechaCompra: string;
      proveedorNombre: string;
      total: number;
      autorizado: boolean;
      numeroFactura: string | null;
      observaciones: string | null;
    }>;
  };
  topProducts: Array<{
    key: string;
    label: string;
    materialId: string | null;
    quantity: number;
    total: number;
  }>;
  materials: Array<{
    id: string;
    nombre: string;
    categoria: string | null;
    imagenUrl: string | null;
    unidadMedida: string;
    stockActual: number;
    stockMinimo: number;
    precioCompra: number | null;
    precioUnidad: number | null;
    wastePct: number;
  }>;
  stockAlerts: Array<{
    id: string;
    nombre: string;
    categoria: string | null;
    unidadMedida: string;
    stockActual: number;
    stockMinimo: number;
    wastePct: number;
    severity: "critical" | "warning";
  }>;
  wasteAlerts: Array<{
    id: string;
    nombre: string;
    categoria: string | null;
    wastePct: number;
    stockActual: number;
    stockMinimo: number;
  }>;
};

type TicketFormState = {
  tableId: string;
  guestName: string;
  guests: number;
  dishName: string;
  qty: number;
  station: Station;
  priority: Priority;
  recipeId: string;
  note: string;
};

type RecipeDraftState = {
  name: string;
  station: Station;
  yieldCount: number;
  notes: string;
  components: RecipeComponent[];
};

type AutosaveState = "idle" | "saving" | "saved" | "error";
type RestaurantLane = "TODAS" | "SALON" | "BARRA" | "DOMICILIO";
type MenuFilter = "FAVORITOS" | Station;
type DashboardTab = "venta" | "cocina" | "operacion";
type SectionId =
  | "mesas"
  | "menu"
  | "pedido"
  | "kds"
  | "comercial"
  | "faltantes"
  | "recetas"
  | "consumo"
  | "cierre";
type SectionPlacement = "before" | "after";

type MenuShortcut = {
  id: string;
  name: string;
  materialId: string | null;
  station: Station;
  recipeId: string | null;
  averagePrice: number | null;
  soldQty: number;
  note: string | null;
  source: "recipe" | "top-product" | "inventory" | "manual";
  category: string | null;
  imageUrl: string | null;
  stockActual: number | null;
  unitLabel: string | null;
};

type RestaurantCheckoutPaymentMethod =
  | "CASH"
  | "CARD"
  | "TRANSFER"
  | "OTHER";

type TableTicketLineItem = KitchenTicket & {
  unitPrice: number | null;
  total: number | null;
  imageUrl: string | null;
};

type TableSaleLineItem = {
  key: string;
  ticketIds: string[];
  dishName: string;
  materialId: string | null;
  recipeId: string | null;
  qty: number;
  station: Station;
  note: string;
  unitPrice: number | null;
  total: number | null;
  imageUrl: string | null;
};

type ManualChargeDraft = {
  name: string;
  price: string;
  qty: number;
  station: Station;
  note: string;
};

type RestaurantTransactionDialogState = {
  open: boolean;
  mode: "VOID" | "REFUND" | null;
  invoiceId: string;
  invoiceNumber: string;
  invoiceTotal: number;
  invoiceStatus: OverviewData["salesToday"]["tickets"][number]["status"] | null;
  items: OverviewData["salesToday"]["tickets"][number]["items"];
};

type LayoutPrefs = Record<
  DashboardTab,
  { order: SectionId[]; visible: SectionId[] }
>;

const EMPTY_BOARD_SNAPSHOT = JSON.stringify(createEmptyRestaurantBoard());
const RESTAURANTE_LAYOUT_KEY = "sgd-restaurante-layout-v1";

const TAB_DEFS: Array<{
  id: DashboardTab;
  label: string;
  description: string;
}> = [
  {
    id: "venta",
    label: "Venta",
    description: "Mesas, carta visual y pedido actual.",
  },
  {
    id: "cocina",
    label: "Cocina",
    description: "KDS, incidencias y ritmo del turno.",
  },
  {
    id: "operacion",
    label: "Operación",
    description: "Recetas, consumo, merma y cierre.",
  },
];

const TAB_SECTIONS: Record<DashboardTab, SectionId[]> = {
  venta: ["mesas", "menu", "pedido"],
  cocina: ["kds", "comercial", "faltantes"],
  operacion: ["recetas", "consumo", "cierre"],
};

const SECTION_META: Record<SectionId, { title: string; description: string }> =
  {
    mesas: {
      title: "Mesas y canales",
      description: "Selecciona dónde estás atendiendo.",
    },
    menu: {
      title: "Carta visual",
      description: "Solo toca la tarjeta y se agrega al pedido.",
    },
    pedido: {
      title: "Pedido actual",
      description: "Resumen, captura rápida y avance de ítems.",
    },
    kds: {
      title: "Kitchen display",
      description: "Producción en curso por prioridad y hora.",
    },
    comercial: {
      title: "Pulso comercial",
      description: "Top productos y tickets ya cobrados.",
    },
    faltantes: {
      title: "Faltantes",
      description: "Incidencias rápidas del turno.",
    },
    recetas: {
      title: "Recetas",
      description: "Alta rápida para el menú del día.",
    },
    consumo: {
      title: "Consumo proyectado",
      description: "Impacto del turno sobre inventario.",
    },
    cierre: {
      title: "Merma y cierre",
      description: "Notas finales y cierre del turno.",
    },
  };

function createRecipeDraft(): RecipeDraftState {
  return {
    name: "",
    station: "COCINA",
    yieldCount: 1,
    notes: "",
    components: [{ id: crypto.randomUUID(), materialId: "", quantity: 1 }],
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(
    value || 0,
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeRestaurantText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function resolveRestaurantLane(table: DiningTable): RestaurantLane {
  const normalized = normalizeRestaurantText(
    `${table.id} ${table.name} ${table.guestName}`,
  );
  if (
    normalized.includes("domicilio") ||
    normalized.includes("delivery") ||
    normalized.includes("rappi") ||
    normalized.includes("uber")
  )
    return "DOMICILIO";
  if (normalized.includes("barra") || normalized.includes("bar"))
    return "BARRA";
  return "SALON";
}

function getNextKitchenStatus(status: KitchenStatus): KitchenStatus {
  if (status === "PENDIENTE") return "EN_PREPARACION";
  if (status === "EN_PREPARACION") return "LISTO";
  if (status === "LISTO") return "ENTREGADO";
  return "ENTREGADO";
}

function formatTableStatusLabel(value: TableStatus) {
  if (value === "ATENDIENDO") return "Abierta";
  if (value === "ESPERANDO_COCINA") return "En cocina";
  if (value === "LISTA_PARA_COBRO") return "Lista";
  return "Libre";
}

function formatKitchenStatusLabel(value: KitchenStatus) {
  if (value === "EN_PREPARACION") return "Preparando";
  if (value === "LISTO") return "Listo";
  if (value === "ENTREGADO") return "Entregado";
  return "Pendiente";
}

function getLaneBadgeTone(value: RestaurantLane) {
  if (value === "DOMICILIO") return "bg-emerald-100 text-emerald-700";
  if (value === "BARRA") return "bg-sky-100 text-sky-700";
  if (value === "SALON") return "bg-violet-100 text-violet-700";
  return "bg-slate-200 text-slate-700";
}

function getStationBadgeTone(value: Station) {
  if (value === "BARRA") return "bg-sky-100 text-sky-700";
  if (value === "EMPAQUE") return "bg-emerald-100 text-emerald-700";
  return "bg-orange-100 text-orange-700";
}

function getTableCardTone(status: TableStatus, selected: boolean) {
  if (selected)
    return "border-orange-400 bg-orange-500 text-white shadow-[0_22px_48px_-28px_rgba(249,115,22,0.8)]";
  if (status === "LISTA_PARA_COBRO")
    return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (status === "ESPERANDO_COCINA")
    return "border-amber-200 bg-amber-50 text-amber-950";
  if (status === "ATENDIENDO") return "border-sky-200 bg-sky-50 text-sky-950";
  return "border-slate-200 bg-white text-slate-800";
}

function getMenuCardTone(station: Station) {
  if (station === "BARRA")
    return "border-sky-200 from-sky-50 via-white to-sky-100/40";
  if (station === "EMPAQUE")
    return "border-emerald-200 from-emerald-50 via-white to-emerald-100/40";
  return "border-orange-200 from-orange-50 via-white to-amber-100/40";
}

function getMenuInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "R";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase();
}

function getRestaurantPaymentMethodLabel(
  method: RestaurantCheckoutPaymentMethod,
) {
  if (method === "CARD") return "Tarjeta / datáfono";
  if (method === "TRANSFER") return "Transferencia";
  if (method === "OTHER") return "Otro";
  return "Efectivo";
}

function getRestaurantPaymentFlow(method: RestaurantCheckoutPaymentMethod) {
  if (method === "CARD") return "DATAPHONE" as const;
  if (method === "TRANSFER") return "QR" as const;
  if (method === "OTHER") return "LINK" as const;
  return "CASH" as const;
}

function formatRestaurantServiceModeLabel(value: RestaurantServiceMode) {
  if (value === "TAKEAWAY") return "Para llevar";
  if (value === "DELIVERY") return "Domicilio";
  return "En mesa";
}

function formatRestaurantCourierLabel(value: RestaurantCourierType, customLabel?: string) {
  if (value === "INTERNAL") return "Repartidor interno";
  if (value === "RAPPI") return "Rappi";
  if (value === "DIDI") return "Didi Food";
  if (value === "UBER_EATS") return "Uber Eats";
  if (value === "OTHER") return customLabel?.trim() || "Repartidor externo";
  return "Sin repartidor";
}

function formatRestaurantActivityKindLabel(value: RestaurantActivityLog["kind"]) {
  if (value === "VOIDED") return "Anulada";
  if (value === "REFUNDED") return "Devuelta";
  if (value === "PRINTED") return "Comanda impresa";
  return "Cancelada";
}

function getRestaurantQuickCashOptions(total: number) {
  const normalized = Math.max(0, Math.round(total));
  const baseOptions = [1000, 2000, 5000, 10000, 20000, 50000, 100000]
    .filter((value) => value >= normalized)
    .slice(0, 4);
  const roundedHundred = Math.ceil(normalized / 100) * 100;
  const roundedThousand = Math.ceil(normalized / 1000) * 1000;
  return Array.from(new Set([normalized, roundedHundred, roundedThousand, ...baseOptions])).filter((value) => value > 0);
}

function roundRestaurantAmount(value: number, step: number) {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

function buildRestaurantInvoiceNote(args: {
  tableName: string;
  serviceMode: RestaurantServiceMode;
  courierType: RestaurantCourierType;
  courierLabel: string;
  tableNote: string;
  splitCount: number;
}) {
  const parts = [
    `Restaurante · ${args.tableName}`,
    `Modo ${formatRestaurantServiceModeLabel(args.serviceMode)}`,
    args.serviceMode === "DELIVERY" || args.serviceMode === "TAKEAWAY"
      ? `Despacho ${formatRestaurantCourierLabel(args.courierType, args.courierLabel)}`
      : null,
    args.splitCount > 1 ? `División ${args.splitCount} personas` : null,
    args.tableNote.trim() ? `Nota ${args.tableNote.trim()}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function getTicketGroupingKey(ticket: {
  materialId: string | null;
  recipeId: string | null;
  dishName: string;
  note?: string | null;
}) {
  const baseKey = ticket.materialId
    ? `material:${ticket.materialId}`
    : ticket.recipeId
      ? `recipe:${ticket.recipeId}`
      : `name:${normalizeRestaurantText(ticket.dishName)}`;
  const noteKey = normalizeRestaurantText(ticket.note ?? "");
  return `${baseKey}|note:${noteKey}`;
}

function formatRestaurantStockError(details: {
  materialId?: string;
  materialNombre?: string | null;
  required?: number;
  warehouseNombre?: string | null;
  warehouseAvailable?: number | null;
  globalAvailable?: number | null;
}) {
  const material = details.materialNombre || details.materialId || "Producto";
  const required =
    typeof details.required === "number" ? formatNumber(details.required) : "N/D";
  const warehouseName = details.warehouseNombre || "bodega principal";
  const warehouseAvailable =
    typeof details.warehouseAvailable === "number"
      ? formatNumber(details.warehouseAvailable)
      : "N/D";
  const globalAvailable =
    typeof details.globalAvailable === "number"
      ? formatNumber(details.globalAvailable)
      : "N/D";

  return `Stock insuficiente para ${material}. Requiere ${required}, disponible en ${warehouseName}: ${warehouseAvailable}, stock global: ${globalAvailable}.`;
}

function guessStationFromCategory(category: string | null): Station {
  const normalized = normalizeRestaurantText(category ?? "");
  if (
    normalized.includes("bebida") ||
    normalized.includes("bar") ||
    normalized.includes("coctel") ||
    normalized.includes("cafe")
  )
    return "BARRA";
  if (
    normalized.includes("empaque") ||
    normalized.includes("delivery") ||
    normalized.includes("llevar")
  )
    return "EMPAQUE";
  return "COCINA";
}

function getTableStatusAccent(status: TableStatus, selected: boolean) {
  if (selected) return "bg-orange-500 text-white";
  if (status === "LISTA_PARA_COBRO") return "bg-emerald-500 text-white";
  if (status === "ESPERANDO_COCINA") return "bg-amber-400 text-white";
  if (status === "ATENDIENDO") return "bg-sky-500 text-white";
  return "bg-slate-200 text-slate-500";
}

function getTableLineArtClass(status: TableStatus, selected: boolean) {
  if (selected) return "text-white";
  if (status === "LISTA_PARA_COBRO") return "text-emerald-400";
  if (status === "ESPERANDO_COCINA") return "text-amber-400";
  if (status === "ATENDIENDO") return "text-sky-400";
  return "text-slate-300";
}

function TableSketch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 72"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="34"
        y="22"
        width="28"
        height="16"
        rx="4"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M39 38v17M57 38v17M28 30H15c-3 0-5-2-5-5V13c0-3 2-5 5-5h6c3 0 5 2 5 5v12c0 3-2 5-5 5ZM81 30H68c-3 0-5-2-5-5V13c0-3 2-5 5-5h6c3 0 5 2 5 5v12c0 3-2 5-5 5ZM21 30v24M15 54h12M75 30v24M69 54h12M48 38v22"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getProductCategoryLabel(shortcut: MenuShortcut) {
  if (shortcut.category?.trim()) return shortcut.category.trim();
  if (shortcut.station === "BARRA") return "Bebidas";
  if (shortcut.station === "EMPAQUE") return "Para llevar";
  return "Cocina";
}

function reorderSections(
  values: SectionId[],
  fromValue: SectionId,
  toValue: SectionId,
  placement: SectionPlacement,
) {
  if (!fromValue || !toValue || fromValue === toValue) return values;
  const next = [...values];
  const fromIndex = next.indexOf(fromValue);
  const toIndex = next.indexOf(toValue);
  if (fromIndex === -1 || toIndex === -1) return values;
  const [moved] = next.splice(fromIndex, 1);
  const insertionIndex =
    placement === "after"
      ? fromIndex < toIndex
        ? toIndex
        : toIndex + 1
      : fromIndex < toIndex
        ? toIndex - 1
        : toIndex;
  next.splice(Math.max(0, insertionIndex), 0, moved);
  return next;
}

function createDefaultLayoutPrefs(): LayoutPrefs {
  return {
    venta: { order: [...TAB_SECTIONS.venta], visible: ["mesas"] },
    cocina: {
      order: [...TAB_SECTIONS.cocina],
      visible: [...TAB_SECTIONS.cocina],
    },
    operacion: {
      order: [...TAB_SECTIONS.operacion],
      visible: [...TAB_SECTIONS.operacion],
    },
  };
}

function normalizeLayoutPrefs(raw: unknown): LayoutPrefs {
  const defaults = createDefaultLayoutPrefs();
  if (!raw || typeof raw !== "object") return defaults;
  const record = raw as Partial<
    Record<DashboardTab, { order?: SectionId[]; visible?: SectionId[] }>
  >;
  const next = createDefaultLayoutPrefs();
  for (const tab of Object.keys(defaults) as DashboardTab[]) {
    const allowed = TAB_SECTIONS[tab];
    const source = record[tab];
    const order = Array.isArray(source?.order)
      ? source.order.filter((id): id is SectionId => allowed.includes(id))
      : [];
    const visible = Array.isArray(source?.visible)
      ? source.visible.filter((id): id is SectionId => allowed.includes(id))
      : [];
    next[tab] = {
      order: [...order, ...allowed.filter((id) => !order.includes(id))],
      visible: visible.length ? visible : [...allowed],
    };
  }
  return next;
}

function RestaurantSectionCard({
  title,
  description,
  children,
  dragHandle,
  dragStateClassName,
  hideHeader = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  dragHandle?: ReactNode;
  dragStateClassName?: string;
  hideHeader?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm",
        dragStateClassName,
      )}
    >
      {hideHeader ? null : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {title}
            </p>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
          {dragHandle}
        </div>
      )}
      <div className={cn(!hideHeader && "mt-4")}>{children}</div>
    </section>
  );
}

export default function RestauranteClient() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<RestaurantBoardState>(
    createEmptyRestaurantBoard,
  );
  const [currentTurnoId, setCurrentTurnoId] = useState<string | null>(null);
  const [currentTurnoStatus, setCurrentTurnoStatus] = useState<
    "ABIERTO" | "CERRADO" | null
  >(null);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [boardReady, setBoardReady] = useState(false);
  const [isClosingTurno, setIsClosingTurno] = useState(false);
  const [activeLane, setActiveLane] = useState<RestaurantLane>("TODAS");
  const [activeMenuFilter, setActiveMenuFilter] =
    useState<MenuFilter>("FAVORITOS");
  const [activeTab, setActiveTab] = useState<DashboardTab>("venta");
  const [layoutPrefs, setLayoutPrefs] = useState<LayoutPrefs>(() =>
    createDefaultLayoutPrefs(),
  );
  const [sectionsDialogOpen, setSectionsDialogOpen] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState<SectionId | null>(
    null,
  );
  const [dragOverSectionId, setDragOverSectionId] = useState<SectionId | null>(
    null,
  );
  const [dragOverPlacement, setDragOverPlacement] =
    useState<SectionPlacement>("before");
  const [selectedTableId, setSelectedTableId] = useState("m1");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [activeProductCategory, setActiveProductCategory] = useState("TODOS");
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [customerNotificationsEnabled, setCustomerNotificationsEnabled] =
    useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<RestaurantCheckoutPaymentMethod>("CASH");
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [tipInput, setTipInput] = useState("");
  const [roundingStep, setRoundingStep] = useState<0 | 100 | 1000>(0);
  const [splitCount, setSplitCount] = useState(1);
  const [manualChargeDraft, setManualChargeDraft] = useState<ManualChargeDraft>({
    name: "",
    price: "",
    qty: 1,
    station: "COCINA",
    note: "",
  });
  const [cancelOrderDialogOpen, setCancelOrderDialogOpen] = useState(false);
  const [cancelOrderReason, setCancelOrderReason] = useState("");
  const [transactionDialogState, setTransactionDialogState] =
    useState<RestaurantTransactionDialogState>({
      open: false,
      mode: null,
      invoiceId: "",
      invoiceNumber: "",
      invoiceTotal: 0,
      invoiceStatus: null,
      items: [],
    });
  const [transactionReason, setTransactionReason] = useState("");
  const [submittingTransaction, setSubmittingTransaction] = useState(false);
  const [customerPhoneInput, setCustomerPhoneInput] = useState("");
  const [customerEmailInput, setCustomerEmailInput] = useState("");
  const [finalizingSale, setFinalizingSale] = useState(false);
  const [saleSubmitState, setSaleSubmitState] = useState<{
    kind: "idle" | "info" | "success" | "error";
    message: string;
  }>({ kind: "idle", message: "" });
  const [saleSuccessState, setSaleSuccessState] = useState<{
    open: boolean;
    invoiceNumber: string;
    total: number;
    paymentMethod: RestaurantCheckoutPaymentMethod;
    warnings: string[];
  }>({
    open: false,
    invoiceNumber: "",
    total: 0,
    paymentMethod: "CASH",
    warnings: [],
  });
  const [ticketForm, setTicketForm] = useState<TicketFormState>({
    tableId: "m1",
    guestName: "",
    guests: 2,
    dishName: "",
    qty: 1,
    station: "COCINA",
    priority: "NORMAL",
    recipeId: "",
    note: "",
  });
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraftState>(() =>
    createRecipeDraft(),
  );
  const [shortageDraft, setShortageDraft] = useState({ label: "", note: "" });
  const lastPersistedSnapshotRef = useRef(EMPTY_BOARD_SNAPSHOT);
  const skipNextAutosaveRef = useRef(true);

  async function loadOverview() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/restaurante/overview", {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok)
        throw new Error(
          payload?.error ?? "No se pudo cargar el panel restaurante",
        );

      const data = payload.data as OverviewData;
      const nextBoard = data.currentTurno?.board ?? createEmptyRestaurantBoard();
      setOverview(data);
      setBoard(nextBoard);
      setCurrentTurnoId(data.currentTurno?.id ?? null);
      setCurrentTurnoStatus(data.currentTurno?.status ?? null);
      setSelectedTableId((current) =>
        nextBoard.tables.some((table) => table.id === current)
          ? current
          : (nextBoard.tables[0]?.id ?? "m1"),
      );
      setTicketForm((current) => ({
        ...current,
        tableId: nextBoard.tables[0]?.id ?? current.tableId ?? "m1",
      }));
      lastPersistedSnapshotRef.current = JSON.stringify(nextBoard);
      skipNextAutosaveRef.current = true;
      setBoardReady(true);
      setAutosaveState("idle");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar el panel restaurante",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RESTAURANTE_LAYOUT_KEY);
      if (raw) setLayoutPrefs(normalizeLayoutPrefs(JSON.parse(raw)));
    } catch {
      setLayoutPrefs(createDefaultLayoutPrefs());
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      RESTAURANTE_LAYOUT_KEY,
      JSON.stringify(layoutPrefs),
    );
  }, [layoutPrefs]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadOverview();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const boardSnapshot = useMemo(() => JSON.stringify(board), [board]);
  const isPristineBoard = boardSnapshot === EMPTY_BOARD_SNAPSHOT;

  useEffect(() => {
    if (!boardReady) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    if (boardSnapshot === lastPersistedSnapshotRef.current) return;
    if (!currentTurnoId && isPristineBoard) return;

    setAutosaveState("saving");
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/restaurante/turnos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: currentTurnoId, action: "SAVE", board }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok)
          throw new Error(
            payload?.error ?? "No se pudo guardar el turno de restaurante",
          );
        const savedTurno = payload.data as OverviewData["currentTurno"];
        lastPersistedSnapshotRef.current = boardSnapshot;
        setCurrentTurnoId(savedTurno?.id ?? null);
        setCurrentTurnoStatus(savedTurno?.status ?? null);
        setOverview((current) =>
          current ? { ...current, currentTurno: savedTurno } : current,
        );
        setAutosaveState("saved");
      } catch (saveError) {
        setAutosaveState("error");
        setError(
          saveError instanceof Error
            ? saveError.message
            : "No se pudo guardar el turno de restaurante",
        );
      }
    }, 900);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [board, boardReady, boardSnapshot, currentTurnoId, isPristineBoard]);

  const kitchenQueue = useMemo(
    () =>
      board.tables
        .flatMap((table) =>
          table.tickets.map((ticket) => ({
            ...ticket,
            tableId: table.id,
            tableName: table.name,
            guestName: table.guestName,
          })),
        )
        .filter((ticket) => ticket.status !== "ENTREGADO")
        .sort((left, right) => {
          const priorityWeight = left.priority === "ALTA" ? -1 : 0;
          const nextPriorityWeight = right.priority === "ALTA" ? -1 : 0;
          if (priorityWeight !== nextPriorityWeight)
            return priorityWeight - nextPriorityWeight;
          return (
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime()
          );
        }),
    [board.tables],
  );

  const consumption = useMemo(() => {
    const materialsById = new Map(
      (overview?.materials ?? []).map((material) => [material.id, material]),
    );
    const recipesById = new Map(
      board.recipes.map((recipe) => [recipe.id, recipe]),
    );
    const aggregate = new Map<
      string,
      {
        materialId: string;
        nombre: string;
        unidad: string;
        qty: number;
        projectedStock: number;
        wastePct: number;
      }
    >();
    for (const table of board.tables) {
      for (const ticket of table.tickets) {
        if (!ticket.recipeId) continue;
        const recipe = recipesById.get(ticket.recipeId);
        if (!recipe) continue;
        for (const component of recipe.components) {
          if (!component.materialId || component.quantity <= 0) continue;
          const material = materialsById.get(component.materialId);
          if (!material) continue;
          const normalizedQty =
            (component.quantity * ticket.qty) / Math.max(recipe.yieldCount, 1);
          const current = aggregate.get(component.materialId);
          if (current) {
            current.qty += normalizedQty;
            current.projectedStock = material.stockActual - current.qty;
            continue;
          }
          aggregate.set(component.materialId, {
            materialId: component.materialId,
            nombre: material.nombre,
            unidad: material.unidadMedida,
            qty: normalizedQty,
            projectedStock: material.stockActual - normalizedQty,
            wastePct: material.wastePct,
          });
        }
      }
    }
    return Array.from(aggregate.values()).sort(
      (left, right) => right.qty - left.qty,
    );
  }, [board.recipes, board.tables, overview?.materials]);

  const replenishmentSuggestions = useMemo(() => {
    const materialsById = new Map(
      (overview?.materials ?? []).map((material) => [material.id, material]),
    );
    const fromConsumption = consumption
      .map((item) => {
        const material = materialsById.get(item.materialId);
        if (!material) return null;
        if (item.projectedStock >= material.stockMinimo) return null;
        return {
          id: item.materialId,
          nombre: item.nombre,
          unidad: item.unidad,
          projectedStock: item.projectedStock,
          targetStock: material.stockMinimo,
          shortage: Math.max(material.stockMinimo - item.projectedStock, 0),
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      nombre: string;
      unidad: string;
      projectedStock: number;
      targetStock: number;
      shortage: number;
    }>;
    const fromStockAlerts = (overview?.stockAlerts ?? []).map((alert) => ({
      id: alert.id,
      nombre: alert.nombre,
      unidad: alert.unidadMedida,
      projectedStock: alert.stockActual,
      targetStock: alert.stockMinimo,
      shortage: Math.max(alert.stockMinimo - alert.stockActual, 0),
    }));
    const deduped = new Map<string, (typeof fromConsumption)[number]>();
    for (const item of [...fromConsumption, ...fromStockAlerts])
      deduped.set(item.id, item);
    return Array.from(deduped.values())
      .sort((left, right) => right.shortage - left.shortage)
      .slice(0, 8);
  }, [consumption, overview?.stockAlerts, overview?.materials]);

  const activeTablesCount = board.tables.filter(
    (table) => table.status !== "LIBRE",
  ).length;
  const deliveredTicketsCount = board.tables
    .flatMap((table) => table.tickets)
    .filter((ticket) => ticket.status === "ENTREGADO").length;

  useEffect(() => {
    if (!board.tables.length) return;
    if (!board.tables.some((table) => table.id === selectedTableId))
      setSelectedTableId(board.tables[0]!.id);
  }, [board.tables, selectedTableId]);

  async function closeTurno() {
    if (isClosingTurno) return;
    if (!currentTurnoId && isPristineBoard) return;
    try {
      setIsClosingTurno(true);
      setError(null);
      const response = await fetch("/api/restaurante/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentTurnoId, action: "CLOSE", board }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok)
        throw new Error(payload?.error ?? "No se pudo cerrar el turno");
      lastPersistedSnapshotRef.current = EMPTY_BOARD_SNAPSHOT;
      skipNextAutosaveRef.current = true;
      setCurrentTurnoId(null);
      setCurrentTurnoStatus("CERRADO");
      setBoard(createEmptyRestaurantBoard());
      setSelectedTableId("m1");
      setTicketForm((current) => ({
        ...current,
        tableId: "m1",
        guestName: "",
        guests: 2,
        dishName: "",
        qty: 1,
        recipeId: "",
        note: "",
      }));
      setRecipeDraft(createRecipeDraft());
      setShortageDraft({ label: "", note: "" });
      setAutosaveState("idle");
      setOverview((current) =>
        current ? { ...current, currentTurno: null } : current,
      );
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "No se pudo cerrar el turno",
      );
    } finally {
      setIsClosingTurno(false);
    }
  }

  const autosaveLabel =
    autosaveState === "saving"
      ? "Guardando en base de datos..."
      : autosaveState === "saved"
        ? "Turno guardado en base de datos"
        : autosaveState === "error"
          ? "Error al guardar el turno"
          : currentTurnoId
            ? "Turno activo persistido en base de datos"
            : "Sin turno abierto todavía";

  function updateTable(
    tableId: string,
    updater: (table: DiningTable) => DiningTable,
  ) {
    setBoard((current) => ({
      ...current,
      tables: current.tables.map((table) =>
        table.id === tableId ? updater(table) : table,
      ),
    }));
  }

  function submitTicket() {
    if (!ticketForm.tableId || !ticketForm.dishName.trim()) return;
    const newTicket: KitchenTicket = {
      id: crypto.randomUUID(),
      dishName: ticketForm.dishName.trim(),
      materialId: null,
      qty: Math.max(1, Number(ticketForm.qty) || 1),
      unitPrice: null,
      station: ticketForm.station,
      priority: ticketForm.priority,
      status: "PENDIENTE",
      recipeId: ticketForm.recipeId || null,
      note: ticketForm.note.trim(),
      createdAt: new Date().toISOString(),
    };
    updateTable(ticketForm.tableId, (table) => ({
      ...table,
      guestName: ticketForm.guestName.trim() || table.guestName,
      guests: Math.max(1, Number(ticketForm.guests) || table.guests || 1),
      status: "ESPERANDO_COCINA",
      tickets: [...table.tickets, newTicket],
    }));
    setSelectedTableId(ticketForm.tableId);
    setTicketForm((current) => ({
      ...current,
      dishName: "",
      qty: 1,
      note: "",
      recipeId: "",
    }));
  }

  function advanceTicket(tableId: string, ticketId: string) {
    updateTable(tableId, (table) => {
      const nextTickets = table.tickets.map((ticket) =>
        ticket.id !== ticketId
          ? ticket
          : { ...ticket, status: getNextKitchenStatus(ticket.status) },
      );
      const hasPendingKitchen = nextTickets.some(
        (ticket) => ticket.status !== "ENTREGADO",
      );
      const hasReadyToCharge = nextTickets.some(
        (ticket) => ticket.status === "ENTREGADO",
      );
      return {
        ...table,
        tickets: nextTickets,
        status: hasPendingKitchen
          ? "ESPERANDO_COCINA"
          : hasReadyToCharge
            ? "LISTA_PARA_COBRO"
            : "ATENDIENDO",
      };
    });
  }

  function closeTable(tableId: string) {
    updateTable(tableId, (table) => ({
      ...table,
      status: "LIBRE",
      guestName: "",
      guests: 0,
      note: "",
      tickets: [],
    }));
  }

  function addRecipe() {
    const validComponents = recipeDraft.components.filter(
      (component) => component.materialId && component.quantity > 0,
    );
    if (!recipeDraft.name.trim() || !validComponents.length) return;
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
    }));
    setRecipeDraft(createRecipeDraft());
  }

  function updateRecipeComponent(
    componentId: string,
    changes: Partial<RecipeComponent>,
  ) {
    setRecipeDraft((current) => ({
      ...current,
      components: current.components.map((component) =>
        component.id === componentId ? { ...component, ...changes } : component,
      ),
    }));
  }

  function addRecipeComponentRow() {
    setRecipeDraft((current) => ({
      ...current,
      components: [
        ...current.components,
        { id: crypto.randomUUID(), materialId: "", quantity: 1 },
      ],
    }));
  }

  function removeRecipeComponentRow(componentId: string) {
    setRecipeDraft((current) => ({
      ...current,
      components:
        current.components.length === 1
          ? current.components
          : current.components.filter(
              (component) => component.id !== componentId,
            ),
    }));
  }

  function deleteRecipe(recipeId: string) {
    setBoard((current) => ({
      ...current,
      recipes: current.recipes.filter((recipe) => recipe.id !== recipeId),
    }));
  }

  function addShortage() {
    if (!shortageDraft.label.trim()) return;
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
    }));
    setShortageDraft({ label: "", note: "" });
  }

  function toggleShortage(shortageId: string) {
    setBoard((current) => ({
      ...current,
      shortages: current.shortages.map((shortage) =>
        shortage.id === shortageId
          ? { ...shortage, resolved: !shortage.resolved }
          : shortage,
      ),
    }));
  }

  const kitchenStatusSummary = useMemo(() => {
    const summary = { pending: 0, preparing: 0, ready: 0, charge: 0 };
    for (const table of board.tables) {
      if (table.status === "LISTA_PARA_COBRO") summary.charge += 1;
      for (const ticket of table.tickets) {
        if (ticket.status === "PENDIENTE") summary.pending += 1;
        else if (ticket.status === "EN_PREPARACION") summary.preparing += 1;
        else if (ticket.status === "LISTO") summary.ready += 1;
      }
    }
    return summary;
  }, [board.tables]);

  const laneOptions = useMemo(
    () => [
      { key: "TODAS" as const, label: "Todas", count: board.tables.length },
      {
        key: "SALON" as const,
        label: "Salón",
        count: board.tables.filter(
          (table) => resolveRestaurantLane(table) === "SALON",
        ).length,
      },
      {
        key: "BARRA" as const,
        label: "Barra",
        count: board.tables.filter(
          (table) => resolveRestaurantLane(table) === "BARRA",
        ).length,
      },
      {
        key: "DOMICILIO" as const,
        label: "Domicilios",
        count: board.tables.filter(
          (table) => resolveRestaurantLane(table) === "DOMICILIO",
        ).length,
      },
    ],
    [board.tables],
  );

  const visibleTables = useMemo(
    () =>
      activeLane === "TODAS"
        ? board.tables
        : board.tables.filter(
            (table) => resolveRestaurantLane(table) === activeLane,
          ),
    [activeLane, board.tables],
  );
  const selectedTable = useMemo(
    () =>
      board.tables.find((table) => table.id === selectedTableId) ??
      visibleTables[0] ??
      board.tables[0] ??
      null,
    [board.tables, selectedTableId, visibleTables],
  );
  const materialsById = useMemo(
    () =>
      new Map(
        (overview?.materials ?? []).map((material) => [material.id, material]),
      ),
    [overview?.materials],
  );

  const menuShortcuts = useMemo(() => {
    const topProductsByName = new Map(
      (overview?.topProducts ?? []).map((product) => [
        normalizeRestaurantText(product.label),
        product,
      ]),
    );
    const fromRecipes: MenuShortcut[] = board.recipes.map((recipe) => {
      const matchedProduct = topProductsByName.get(
        normalizeRestaurantText(recipe.name),
      );
      const baseCost = recipe.components.reduce((sum, component) => {
        const material = materialsById.get(component.materialId);
        return (
          sum +
          (material?.precioUnidad ?? material?.precioCompra ?? 0) *
            component.quantity
        );
      }, 0);
      const averagePrice = matchedProduct
        ? Number(
            (
              matchedProduct.total / Math.max(matchedProduct.quantity, 1)
            ).toFixed(2),
          )
        : baseCost > 0
          ? Number((baseCost * 2.4).toFixed(2))
          : null;
      const recipeLeadMaterial = recipe.components
        .map((component) => materialsById.get(component.materialId))
        .find((material) => Boolean(material?.imagenUrl));
      return {
        id: recipe.id,
        name: recipe.name,
        materialId: null,
        station: recipe.station,
        recipeId: recipe.id,
        averagePrice,
        soldQty: matchedProduct?.quantity ?? 0,
        note: recipe.notes || null,
        source: "recipe",
        category: null,
        imageUrl:
          (matchedProduct?.materialId
            ? materialsById.get(matchedProduct.materialId)?.imagenUrl
            : null) ??
          recipeLeadMaterial?.imagenUrl ??
          null,
        stockActual: null,
        unitLabel: null,
      };
    });
    const existingNames = new Set(
      fromRecipes.map((item) => normalizeRestaurantText(item.name)),
    );
    const fromTopProducts: MenuShortcut[] = (overview?.topProducts ?? [])
      .filter(
        (product) => !existingNames.has(normalizeRestaurantText(product.label)),
      )
      .map((product) => ({
        id: `top-${product.key}`,
        name: product.label,
        materialId: product.materialId,
        station: "COCINA" as Station,
        recipeId: null,
        averagePrice: Number(
          (product.total / Math.max(product.quantity, 1)).toFixed(2),
        ),
        soldQty: product.quantity,
        note: "Desde histórico POS",
        source: "top-product",
        category: null,
        imageUrl: product.materialId
          ? materialsById.get(product.materialId)?.imagenUrl ?? null
          : null,
        stockActual: null,
        unitLabel: null,
      }));
    const fromInventory: MenuShortcut[] = (overview?.materials ?? [])
      .filter(
        (material) =>
          !existingNames.has(normalizeRestaurantText(material.nombre)),
      )
      .map((material) => ({
        id: `inventory-${material.id}`,
        name: material.nombre,
        materialId: material.id,
        station: guessStationFromCategory(material.categoria),
        recipeId: null,
        averagePrice: material.precioUnidad ?? material.precioCompra ?? null,
        soldQty: 0,
        note: material.categoria
          ? `Inventario · ${material.categoria}`
          : "Inventario disponible",
        source: "inventory",
        category: material.categoria,
        imageUrl: material.imagenUrl,
        stockActual: material.stockActual,
        unitLabel: material.unidadMedida,
      }));
    return [...fromRecipes, ...fromTopProducts, ...fromInventory].sort(
      (left, right) => {
        const sourceWeight =
          left.source === right.source
            ? 0
            : left.source === "inventory"
              ? -1
              : right.source === "inventory"
                ? 1
                : 0;
        if (sourceWeight !== 0) return sourceWeight;
        if (right.soldQty !== left.soldQty) return right.soldQty - left.soldQty;
        return left.name.localeCompare(right.name, "es");
      },
    );
  }, [board.recipes, materialsById, overview?.topProducts]);

  const visibleMenuShortcuts = useMemo(() => {
    if (activeMenuFilter === "FAVORITOS") return menuShortcuts.slice(0, 20);
    return menuShortcuts
      .filter((item) => item.station === activeMenuFilter)
      .slice(0, 20);
  }, [activeMenuFilter, menuShortcuts]);
  const productCategories = useMemo(
    () => [
      "TODOS",
      ...Array.from(
        new Set(
          menuShortcuts.map((shortcut) => getProductCategoryLabel(shortcut)),
        ),
      ).sort((left, right) => left.localeCompare(right, "es")),
    ],
    [menuShortcuts],
  );
  const visibleProductPickerItems = useMemo(
    () =>
      activeProductCategory === "TODOS"
        ? menuShortcuts
        : menuShortcuts.filter(
            (shortcut) =>
              getProductCategoryLabel(shortcut) === activeProductCategory,
          ),
    [activeProductCategory, menuShortcuts],
  );
  const selectedTableTicketLineItems = useMemo<TableTicketLineItem[]>(
    () =>
      !selectedTable
        ? []
        : selectedTable.tickets.map((ticket) => {
            const matchedShortcut = menuShortcuts.find(
              (item) =>
                item.materialId === ticket.materialId ||
                item.recipeId === ticket.recipeId ||
                normalizeRestaurantText(item.name) ===
                  normalizeRestaurantText(ticket.dishName),
            );
            const unitPrice =
              ticket.unitPrice ?? matchedShortcut?.averagePrice ?? null;
            return {
              ...ticket,
              materialId:
                ticket.materialId ?? matchedShortcut?.materialId ?? null,
              unitPrice,
              imageUrl: matchedShortcut?.imageUrl ?? null,
              total:
                unitPrice !== null
                  ? Number((unitPrice * ticket.qty).toFixed(2))
                  : null,
            };
          }),
    [menuShortcuts, selectedTable],
  );
  const selectedTableSaleItems = useMemo<TableSaleLineItem[]>(() => {
    const grouped = new Map<string, TableSaleLineItem>();

    for (const item of selectedTableTicketLineItems) {
      const key = getTicketGroupingKey(item);
      const current = grouped.get(key);
      if (current) {
        current.qty += item.qty;
        current.ticketIds.push(item.id);
        current.total =
          current.unitPrice !== null
            ? Number((current.qty * current.unitPrice).toFixed(2))
            : null;
        continue;
      }

      grouped.set(key, {
        key,
        ticketIds: [item.id],
        dishName: item.dishName,
        materialId: item.materialId,
        recipeId: item.recipeId,
        qty: item.qty,
        station: item.station,
        note: item.note,
        unitPrice: item.unitPrice,
        total: item.total,
        imageUrl: item.imageUrl,
      });
    }

    return Array.from(grouped.values());
  }, [selectedTableTicketLineItems]);
  const selectedTableItemCount = useMemo(
    () => selectedTableSaleItems.reduce((sum, item) => sum + item.qty, 0),
    [selectedTableSaleItems],
  );
  const selectedTableEstimatedTotal = useMemo(
    () =>
      selectedTableSaleItems.reduce((sum, item) => sum + (item.total ?? 0), 0),
    [selectedTableSaleItems],
  );
  const tipAmount = useMemo(() => {
    const parsed = Number(tipInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [tipInput]);
  const totalBeforeRounding = useMemo(
    () => selectedTableEstimatedTotal + tipAmount,
    [selectedTableEstimatedTotal, tipAmount],
  );
  const roundedCheckoutTotal = useMemo(
    () => roundRestaurantAmount(totalBeforeRounding, roundingStep),
    [roundingStep, totalBeforeRounding],
  );
  const roundingAdjustment = useMemo(
    () => roundedCheckoutTotal - totalBeforeRounding,
    [roundedCheckoutTotal, totalBeforeRounding],
  );
  const checkoutTotal = useMemo(
    () => Math.max(0, roundedCheckoutTotal),
    [roundedCheckoutTotal],
  );
  const selectedSplitCount = Math.max(1, Number(splitCount) || 1);
  const splitPerPerson = useMemo(
    () => (selectedSplitCount > 0 ? checkoutTotal / selectedSplitCount : checkoutTotal),
    [checkoutTotal, selectedSplitCount],
  );
  const cashReceivedAmount = useMemo(() => {
    const parsed = Number(cashReceivedInput);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [cashReceivedInput]);
  const cashChangeDue = useMemo(
    () => Math.max(0, cashReceivedAmount - checkoutTotal),
    [cashReceivedAmount, checkoutTotal],
  );
  const wasteAveragePct = useMemo(
    () =>
      !overview?.wasteAlerts.length
        ? 0
        : overview.wasteAlerts.reduce((sum, item) => sum + item.wastePct, 0) /
          overview.wasteAlerts.length,
    [overview?.wasteAlerts],
  );

  function addMenuShortcutToSelectedTable(shortcut: MenuShortcut) {
    const targetTableId =
      selectedTable?.id ?? visibleTables[0]?.id ?? board.tables[0]?.id;
    if (!targetTableId) return;
    setSelectedTableId(targetTableId);
    updateTable(targetTableId, (table) => ({
      ...table,
      status: "ESPERANDO_COCINA",
      guests: table.guests || 1,
      tickets: (() => {
        const incomingKey = getTicketGroupingKey({
          materialId: shortcut.materialId,
          recipeId: shortcut.recipeId,
          dishName: shortcut.name,
          note: "",
        });
        const existingIndex = table.tickets.findIndex(
          (ticket) =>
            ticket.status === "PENDIENTE" &&
            ticket.priority === "NORMAL" &&
            !ticket.note.trim() &&
            getTicketGroupingKey(ticket) === incomingKey,
        );

        if (existingIndex === -1) {
          return [
            ...table.tickets,
            {
              id: crypto.randomUUID(),
              dishName: shortcut.name,
              materialId: shortcut.materialId,
              qty: 1,
              station: shortcut.station,
              priority: "NORMAL",
              status: "PENDIENTE",
              recipeId: shortcut.recipeId,
              note: "",
              unitPrice: shortcut.averagePrice,
              createdAt: new Date().toISOString(),
            },
          ];
        }

        return table.tickets.map((ticket, index) =>
          index === existingIndex ? { ...ticket, qty: ticket.qty + 1 } : ticket,
        );
      })(),
    }));
  }

  function updateSelectedTableMeta(changes: Partial<DiningTable>) {
    if (!selectedTable) return;
    updateTable(selectedTable.id, (table) => ({ ...table, ...changes }));
  }

  function appendRestaurantActivity(entry: Omit<RestaurantActivityLog, "id" | "createdAt">) {
    setBoard((current) => ({
      ...current,
      activityLog: [
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          ...entry,
        },
        ...current.activityLog,
      ].slice(0, 40),
    }));
  }

  function addManualChargeToSelectedTable() {
    const targetTableId =
      selectedTable?.id ?? visibleTables[0]?.id ?? board.tables[0]?.id;
    const unitPrice = Number(manualChargeDraft.price);
    const qty = Math.max(1, Number(manualChargeDraft.qty) || 1);
    if (!targetTableId || !manualChargeDraft.name.trim() || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      setSaleSubmitState({
        kind: "error",
        message: "Escribe un concepto y un valor válido para agregarlo como Otros.",
      });
      return;
    }

    setSelectedTableId(targetTableId);
    updateTable(targetTableId, (table) => ({
      ...table,
      status: "ESPERANDO_COCINA",
      guests: table.guests || 1,
      tickets: [
        ...table.tickets,
        {
          id: crypto.randomUUID(),
          dishName: manualChargeDraft.name.trim(),
          materialId: null,
          qty,
          station: manualChargeDraft.station,
          priority: "NORMAL",
          status: "PENDIENTE",
          recipeId: null,
          note: manualChargeDraft.note.trim(),
          unitPrice,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setManualChargeDraft({
      name: "",
      price: "",
      qty: 1,
      station: "COCINA",
      note: "",
    });
    setSaleSubmitState({ kind: "idle", message: "" });
  }

  function openProductPickerForTable(tableId?: string) {
    const targetTableId =
      tableId ??
      selectedTable?.id ??
      visibleTables[0]?.id ??
      board.tables[0]?.id;
    if (!targetTableId) return;
    const table = board.tables.find((item) => item.id === targetTableId);
    setSelectedTableId(targetTableId);
    setTicketForm((current) => ({
      ...current,
      tableId: targetTableId,
      guestName: table?.guestName ?? current.guestName,
      guests: table?.guests || current.guests || 1,
    }));
    setPaymentDialogOpen(false);
    setCustomerNotificationsEnabled(false);
    setSelectedPaymentMethod("CASH");
    setCashReceivedInput("");
    setTipInput("");
    setRoundingStep(0);
    setSplitCount(Math.max(1, table?.guests || 1));
    setCustomerPhoneInput("");
    setCustomerEmailInput("");
    setSaleSubmitState({ kind: "idle", message: "" });
    setActiveProductCategory("TODOS");
    setProductPickerOpen(true);
  }

  function removeSelectedTableTickets(ticketIds: string[]) {
    if (!selectedTable || !ticketIds.length) return;
    const ids = new Set(ticketIds);
    updateTable(selectedTable.id, (table) => {
      const tickets = table.tickets.filter((ticket) => !ids.has(ticket.id));
      const hasPendingKitchen = tickets.some(
        (ticket) => ticket.status !== "ENTREGADO",
      );
      const hasReadyToCharge = tickets.some(
        (ticket) => ticket.status === "ENTREGADO",
      );
      return {
        ...table,
        status: tickets.length
          ? hasPendingKitchen
            ? "ESPERANDO_COCINA"
            : hasReadyToCharge
              ? "LISTA_PARA_COBRO"
              : "ATENDIENDO"
          : "LIBRE",
        tickets,
      };
    });
  }

  function openSaleCheckout() {
    if (!selectedTable) {
      setSaleSubmitState({
        kind: "error",
        message: "Selecciona una mesa antes de registrar la venta.",
      });
      return;
    }

    if (!selectedTableSaleItems.length) {
      setSaleSubmitState({
        kind: "error",
        message: "Agrega al menos un producto antes de registrar la venta.",
      });
      return;
    }

    const itemsWithoutPrice = selectedTableSaleItems.filter(
      (item) => item.unitPrice === null,
    );
    if (itemsWithoutPrice.length) {
      setSaleSubmitState({
        kind: "error",
        message: `Faltan precios para: ${itemsWithoutPrice
          .slice(0, 3)
          .map((item) => item.dishName)
          .join(", ")}.`,
      });
      return;
    }

    setSaleSubmitState({ kind: "idle", message: "" });
    setSplitCount(Math.max(1, selectedTable.guests || 1));
    if (selectedPaymentMethod === "CASH" && !cashReceivedInput.trim()) {
      setCashReceivedInput(String(Math.max(0, Math.round(checkoutTotal))));
    }
    setPaymentDialogOpen(true);
  }

  function printKitchenTickets(scope: "selected" | "all") {
    const tickets = scope === "selected"
      ? selectedTableTicketLineItems.map((ticket) => ({
          ...ticket,
          tableName: selectedTable?.name ?? "Mesa",
          guestName: selectedTable?.guestName ?? "",
          tableNote: selectedTable?.note ?? "",
        }))
      : kitchenQueue.map((ticket) => ({
          ...ticket,
          tableNote: board.tables.find((table) => table.id === ticket.tableId)?.note ?? "",
        }));

    if (!tickets.length) {
      setSaleSubmitState({
        kind: "error",
        message: "No hay comandas para imprimir.",
      });
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=860,height=900");
    if (!printWindow) {
      setSaleSubmitState({ kind: "error", message: "Tu navegador bloqueó la ventana de impresión." });
      return;
    }

    const rows = tickets
      .map(
        (ticket) => `
          <article style="border:1px solid #e2e8f0;border-radius:16px;padding:16px;margin-bottom:16px;page-break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;gap:12px;">
              <div>
                <div style="font-size:12px;text-transform:uppercase;letter-spacing:.18em;color:#64748b;">${ticket.tableName}</div>
                <h2 style="margin:6px 0 0;font-size:24px;color:#0f172a;">${ticket.qty} x ${ticket.dishName}</h2>
                <p style="margin:8px 0 0;color:#334155;">${ticket.guestName || "Sin nombre"}</p>
              </div>
              <div style="text-align:right;">
                <div style="display:inline-block;background:#fff7ed;color:#c2410c;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;">${ticket.station}</div>
                <div style="margin-top:8px;font-size:12px;color:#64748b;">${formatDateTime(ticket.createdAt)}</div>
              </div>
            </div>
            ${ticket.note ? `<div style="margin-top:12px;padding:12px;border-radius:12px;background:#f8fafc;color:#0f172a;"><strong>Nota:</strong> ${ticket.note}</div>` : ""}
            ${ticket.tableNote ? `<div style="margin-top:12px;padding:12px;border-radius:12px;background:#fff7ed;color:#9a3412;"><strong>Pedido:</strong> ${ticket.tableNote}</div>` : ""}
          </article>`,
      )
      .join("");

    printWindow.document.write(`<!doctype html><html><head><title>Comanda cocina</title></head><body style="font-family:Arial,sans-serif;padding:24px;background:#fff;"><h1 style="margin:0 0 20px;">Comandas cocina</h1>${rows}<script>window.onload=function(){window.print();}</script></body></html>`);
    printWindow.document.close();
    appendRestaurantActivity({
      kind: "PRINTED",
      tableName: scope === "selected" ? selectedTable?.name ?? "Mesa" : "Cocina",
      invoiceId: null,
      invoiceNumber: null,
      reason: scope === "selected" ? "Comanda de mesa impresa" : "Comandas pendientes impresas",
      amount: null,
    });
  }

  function cancelSelectedOrder() {
    if (!selectedTable || !cancelOrderReason.trim()) {
      setSaleSubmitState({ kind: "error", message: "Escribe el motivo de cancelación." });
      return;
    }

    appendRestaurantActivity({
      kind: "CANCELLED",
      tableName: selectedTable.name,
      invoiceId: null,
      invoiceNumber: null,
      reason: cancelOrderReason.trim(),
      amount: selectedTableEstimatedTotal,
    });
    closeTable(selectedTable.id);
    setCancelOrderReason("");
    setCancelOrderDialogOpen(false);
    setProductPickerOpen(false);
    setPaymentDialogOpen(false);
    setSaleSubmitState({ kind: "success", message: "Pedido cancelado y mesa liberada." });
  }

  function openTransactionDialog(
    mode: "VOID" | "REFUND",
    ticket: OverviewData["salesToday"]["tickets"][number],
  ) {
    setTransactionDialogState({
      open: true,
      mode,
      invoiceId: ticket.id,
      invoiceNumber: ticket.numero,
      invoiceTotal: ticket.total,
      invoiceStatus: ticket.status,
      items: ticket.items,
    });
    setTransactionReason("");
  }

  async function submitTransactionAction() {
    if (!transactionDialogState.mode || !transactionDialogState.invoiceId || !transactionReason.trim()) {
      setSaleSubmitState({ kind: "error", message: "Escribe un motivo para continuar." });
      return;
    }

    setSubmittingTransaction(true);
    try {
      if (transactionDialogState.mode === "VOID") {
        const response = await fetch(`/api/pos/facturas/${transactionDialogState.invoiceId}/anular`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: transactionReason.trim() }),
        });
        const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? "No se pudo anular la factura.");
        }
        appendRestaurantActivity({
          kind: "VOIDED",
          tableName: "POS restaurante",
          invoiceId: transactionDialogState.invoiceId,
          invoiceNumber: transactionDialogState.invoiceNumber,
          reason: transactionReason.trim(),
          amount: transactionDialogState.invoiceTotal,
        });
      } else {
        const response = await fetch("/api/pos/devoluciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            invoiceId: transactionDialogState.invoiceId,
            motivo: transactionReason.trim(),
            items: transactionDialogState.items.map((item) => ({
              materialId: item.materialId,
              descripcion: item.descripcion,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          }),
        });
        const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error ?? "No se pudo registrar la devolución.");
        }
        appendRestaurantActivity({
          kind: "REFUNDED",
          tableName: "POS restaurante",
          invoiceId: transactionDialogState.invoiceId,
          invoiceNumber: transactionDialogState.invoiceNumber,
          reason: transactionReason.trim(),
          amount: transactionDialogState.invoiceTotal,
        });
      }

      await loadOverview();
      setTransactionDialogState({
        open: false,
        mode: null,
        invoiceId: "",
        invoiceNumber: "",
        invoiceTotal: 0,
        invoiceStatus: null,
        items: [],
      });
      setTransactionReason("");
      setSaleSubmitState({
        kind: "success",
        message:
          transactionDialogState.mode === "VOID"
            ? `Factura ${transactionDialogState.invoiceNumber} anulada.`
            : `Devolución registrada sobre ${transactionDialogState.invoiceNumber}.`,
      });
    } catch (transactionError) {
      setSaleSubmitState({
        kind: "error",
        message:
          transactionError instanceof Error
            ? transactionError.message
            : "No se pudo ejecutar la acción sobre la venta.",
      });
    } finally {
      setSubmittingTransaction(false);
    }
  }

  async function finalizeSelectedTableSale() {
    if (!selectedTable) {
      setSaleSubmitState({
        kind: "error",
        message: "Selecciona una mesa antes de registrar la venta.",
      });
      return;
    }

    if (!selectedTableSaleItems.length) {
      setSaleSubmitState({
        kind: "error",
        message: "Agrega al menos un producto antes de registrar la venta.",
      });
      return;
    }

    const itemsWithoutPrice = selectedTableSaleItems.filter(
      (item) => item.unitPrice === null,
    );
    if (itemsWithoutPrice.length) {
      setSaleSubmitState({
        kind: "error",
        message: `Faltan precios para: ${itemsWithoutPrice
          .slice(0, 3)
          .map((item) => item.dishName)
          .join(", ")}.`,
      });
      return;
    }

    const customerName =
      ticketForm.guestName.trim() ||
      selectedTable.guestName.trim() ||
      selectedTable.name;
    if (selectedPaymentMethod === "CASH" && cashReceivedAmount + 0.001 < checkoutTotal) {
      setSaleSubmitState({
        kind: "error",
        message: "El efectivo recibido debe cubrir el total de la cuenta.",
      });
      return;
    }
    const soldAt = new Date().toISOString();
    setFinalizingSale(true);
    setSaleSubmitState({
      kind: "info",
      message: "Registrando venta y procesando el pago...",
    });

    try {
      const saleResponse = await fetch("/api/pos/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNombre: customerName,
          note: buildRestaurantInvoiceNote({
            tableName: selectedTable.name,
            serviceMode: selectedTable.serviceMode,
            courierType: selectedTable.courierType,
            courierLabel: selectedTable.courierLabel,
            tableNote: selectedTable.note,
            splitCount: selectedSplitCount,
          }),
          asDraft: true,
          items: [
            ...selectedTableSaleItems.map((item) => ({
              materialId: item.materialId,
              descripcion: item.dishName,
              quantity: item.qty,
              unitPrice: item.unitPrice ?? 0,
            })),
            ...(tipAmount > 0
              ? [
                  {
                    materialId: null,
                    descripcion: "Propina voluntaria",
                    quantity: 1,
                    unitPrice: tipAmount,
                  },
                ]
              : []),
            ...(Math.abs(roundingAdjustment) >= 0.01
              ? [
                  {
                    materialId: null,
                    descripcion:
                      roundingAdjustment > 0
                        ? "Ajuste por redondeo"
                        : "Descuento por redondeo",
                    quantity: 1,
                    unitPrice: roundingAdjustment,
                  },
                ]
              : []),
          ],
        }),
      });
      const salePayload = (await saleResponse.json().catch(() => null)) as {
        success?: boolean;
        data?: { id: string; numero: string; total: number; status: string };
        error?: string;
      } | null;
      if (!saleResponse.ok || !salePayload?.success || !salePayload.data) {
        throw new Error(
          salePayload?.error ??
            "No se pudo registrar la venta POS desde restaurante.",
        );
      }

      const invoiceData = salePayload.data;

      const finalizeResponse = await fetch(
        `/api/pos/facturas/${invoiceData.id}/finalizar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payments:
              checkoutTotal > 0
                ? [
                    {
                      method: selectedPaymentMethod,
                      amount: checkoutTotal,
                      provider: "MANUAL",
                      status: "PAID",
                      flow: getRestaurantPaymentFlow(selectedPaymentMethod),
                      source: "NONE",
                      metadata: {
                        cashReceived:
                          selectedPaymentMethod === "CASH"
                            ? cashReceivedAmount
                            : null,
                        cashChangeDue:
                          selectedPaymentMethod === "CASH"
                            ? cashChangeDue
                            : null,
                        tipAmount,
                        roundingAdjustment,
                        splitCount: selectedSplitCount,
                        serviceMode: selectedTable.serviceMode,
                        courierType: selectedTable.courierType,
                        courierLabel: selectedTable.courierLabel || null,
                      },
                    },
                  ]
                : [],
          }),
        },
      );
      const finalizePayload = (await finalizeResponse
        .json()
        .catch(() => null)) as {
        success?: boolean;
        error?: string;
        details?: {
          materialId?: string;
          materialNombre?: string | null;
          required?: number;
          warehouseNombre?: string | null;
          warehouseAvailable?: number | null;
          globalAvailable?: number | null;
        };
      } | null;
      if (!finalizeResponse.ok || !finalizePayload?.success) {
        if (finalizePayload?.details) {
          throw new Error(formatRestaurantStockError(finalizePayload.details));
        }
        throw new Error(
          finalizePayload?.error ?? "No se pudo finalizar la venta POS.",
        );
      }

      const warnings: string[] = [];

      const notifyResponse = await fetch("/api/restaurante/ventas/notificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoiceData.id,
          numero: invoiceData.numero,
          tableName: selectedTable.name,
          clienteNombre: customerName,
          total: invoiceData.total,
        }),
      });
      if (!notifyResponse.ok)
        warnings.push("No se pudo avisar internamente a cocina/operación.");

      const normalizedEmail = customerNotificationsEnabled
        ? customerEmailInput.trim()
        : "";
      if (customerNotificationsEnabled && normalizedEmail) {
        const emailResponse = await fetch(
          `/api/pos/facturas/${salePayload.data.id}/enviar`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              destinatarios: [normalizedEmail],
              mensaje: `Adjuntamos tu factura ${salePayload.data.numero}. Gracias por tu compra.`,
            }),
          },
        );
        if (!emailResponse.ok)
          warnings.push("No se pudo enviar el correo al cliente.");
      }

      const normalizedPhone = customerNotificationsEnabled
        ? customerPhoneInput.trim()
        : "";
      if (customerNotificationsEnabled && normalizedPhone) {
        const shareResponse = await fetch(
          `/api/pos/facturas/${invoiceData.id}/share`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ttlSeconds: 60 * 60 * 24 * 7 }),
          },
        );
        const sharePayload = (await shareResponse.json().catch(() => null)) as {
          success?: boolean;
          data?: { url: string };
          error?: string;
        } | null;
        if (
          !shareResponse.ok ||
          !sharePayload?.success ||
          !sharePayload.data?.url
        ) {
          warnings.push(
            "No se pudo preparar el enlace de WhatsApp para el cliente.",
          );
        } else {
          const whatsappUrl = buildWhatsAppWebUrl({
            phone: normalizedPhone,
            message: `Hola ${customerName}, aqui tienes tu factura ${invoiceData.numero}: ${sharePayload.data.url}`,
          });
          window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        }
      }

      setOverview((current) =>
        current
          ? {
              ...current,
              salesToday: {
                ...current.salesToday,
                total: current.salesToday.total + invoiceData.total,
                count: current.salesToday.count + 1,
                tickets: [
                  {
                    id: invoiceData.id,
                    numero: invoiceData.numero,
                    createdAt: soldAt,
                    clienteNombre: customerName,
                    status: "PAID" as const,
                    returnedTotal: 0,
                    total: invoiceData.total,
                    items: [
                      ...selectedTableSaleItems.map((item) => ({
                        id: item.key,
                        materialId: item.materialId,
                        descripcion: item.dishName,
                        quantity: item.qty,
                        unitPrice: item.unitPrice ?? 0,
                        total: item.total ?? 0,
                      })),
                      ...(tipAmount > 0
                        ? [
                            {
                              id: `tip-${invoiceData.id}`,
                              materialId: null,
                              descripcion: "Propina voluntaria",
                              quantity: 1,
                              unitPrice: tipAmount,
                              total: tipAmount,
                            },
                          ]
                        : []),
                    ],
                  },
                  ...current.salesToday.tickets,
                ].slice(0, 12),
              },
            }
          : current,
      );

      closeTable(selectedTable.id);
      setPaymentDialogOpen(false);
      setProductPickerOpen(false);
      setCustomerNotificationsEnabled(false);
      setCashReceivedInput("");
      setTipInput("");
      setRoundingStep(0);
      setCustomerPhoneInput("");
      setCustomerEmailInput("");
      setSaleSuccessState({
        open: true,
        invoiceNumber: invoiceData.numero,
        total: invoiceData.total,
        paymentMethod: selectedPaymentMethod,
        warnings,
      });
      setSaleSubmitState({
        kind: warnings.length ? "info" : "success",
        message: warnings.length
          ? `Venta ${invoiceData.numero} registrada. ${warnings.join(" ")}`
          : `Venta ${invoiceData.numero} registrada y notificada correctamente.`,
      });
    } catch (saleError) {
      setSaleSubmitState({
        kind: "error",
        message:
          saleError instanceof Error
            ? saleError.message
            : "No se pudo registrar la venta desde restaurante.",
      });
    } finally {
      setFinalizingSale(false);
    }
  }

  function updateTabLayout(
    tab: DashboardTab,
    updater: (current: LayoutPrefs[DashboardTab]) => LayoutPrefs[DashboardTab],
  ) {
    setLayoutPrefs((current) => ({ ...current, [tab]: updater(current[tab]) }));
  }

  function toggleSectionVisibility(sectionId: SectionId) {
    updateTabLayout(activeTab, (current) => {
      const visible = current.visible.includes(sectionId)
        ? current.visible.filter((item) => item !== sectionId)
        : [...current.visible, sectionId];
      return { ...current, visible: visible.length ? visible : [sectionId] };
    });
  }

  function resetActiveTabLayout() {
    const defaults = createDefaultLayoutPrefs();
    updateTabLayout(activeTab, () => defaults[activeTab]);
  }

  function handleSectionDragStart(
    event: DragEvent<HTMLDivElement>,
    sectionId: SectionId,
  ) {
    setDraggingSectionId(sectionId);
    setDragOverSectionId(sectionId);
    setDragOverPlacement("before");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", sectionId);
  }

  function handleSectionDragOver(
    event: DragEvent<HTMLDivElement>,
    sectionId: SectionId,
  ) {
    if (!draggingSectionId) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement =
      event.clientY - bounds.top < bounds.height / 2 ? "before" : "after";
    setDragOverSectionId(sectionId);
    setDragOverPlacement(placement);
  }

  function clearDragState() {
    setDraggingSectionId(null);
    setDragOverSectionId(null);
    setDragOverPlacement("before");
  }

  function handleSectionDrop(sectionId: SectionId) {
    if (!draggingSectionId) {
      clearDragState();
      return;
    }
    updateTabLayout(activeTab, (current) => ({
      ...current,
      order: reorderSections(
        current.order,
        draggingSectionId,
        sectionId,
        dragOverPlacement,
      ),
    }));
    clearDragState();
  }

  function renderDragHandle(sectionId: SectionId) {
    return (
      <div className="flex items-center gap-2 text-slate-400">
        <span className="rounded-full bg-slate-100 p-2">
          <GripVertical className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {sectionId}
        </span>
      </div>
    );
  }

  function renderSection(sectionId: SectionId) {
    if (sectionId === "mesas")
      return (
        <div className="space-y-5">
          <div className="rounded-[30px] border border-slate-200 bg-slate-50/90 p-3">
            <div className="flex flex-wrap gap-2">
              {laneOptions.map((lane, index) => {
                const active = activeLane === lane.key;
                const dotTone =
                  index === 0
                    ? "bg-pink-500"
                    : index === 1
                      ? "bg-violet-500"
                      : index === 2
                        ? "bg-amber-400"
                        : "bg-emerald-400";
                return (
                  <button
                    key={lane.key}
                    type="button"
                    onClick={() => setActiveLane(lane.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                      active
                        ? "bg-white text-slate-950 shadow-sm ring-2 ring-orange-300"
                        : "text-slate-500 hover:bg-white hover:text-slate-900",
                    )}
                  >
                    <span className={cn("h-3 w-3 rounded-full", dotTone)} />
                    <span>{lane.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        active
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-200 text-slate-600",
                      )}
                    >
                      {lane.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {selectedTable ? (
            <div className="flex flex-col gap-3 rounded-[26px] border border-orange-200 bg-orange-50/80 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
                  Mesa activa
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-950">
                  {selectedTable.name}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {selectedTable.guestName || "Lista para tomar pedido"} ·{" "}
                  {selectedTable.tickets.length} productos cargados
                </div>
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {visibleTables.map((table) => {
              const selected = selectedTable?.id === table.id;
              const lane = resolveRestaurantLane(table);
              const openTickets = table.tickets.filter(
                (ticket) => ticket.status !== "ENTREGADO",
              ).length;
              return (
                <div key={table.id} className="group relative">
                  {selected ? (
                    <Button
                      type="button"
                      size="sm"
                      className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-white text-orange-600 opacity-0 shadow-lg transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 hover:bg-white"
                      onClick={() => openProductPickerForTable(table.id)}
                    >
                      <ShoppingBasket className="mr-2 h-4 w-4" /> Agregar productos
                    </Button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTableId(table.id);
                      setTicketForm((current) => ({
                        ...current,
                        tableId: table.id,
                        guestName: table.guestName,
                        guests: table.guests || 1,
                      }));
                    }}
                    className={cn(
                      "relative flex min-h-[210px] w-full flex-col rounded-[22px] border px-4 py-3 text-left transition",
                      selected
                        ? "border-orange-300 bg-orange-500 pt-14 shadow-[0_24px_48px_-32px_rgba(249,115,22,0.8)]"
                        : "border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/40",
                    )}
                  >
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span
                      className={cn(
                        selected ? "text-white/90" : "text-amber-500",
                      )}
                    >
                      {table.guests || 0} Lithos
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-[10px] font-semibold uppercase",
                        selected
                          ? "bg-white/20 text-white"
                          : getLaneBadgeTone(lane),
                      )}
                    >
                      {lane === "SALON"
                        ? "Floor"
                        : lane === "BARRA"
                          ? "Barra"
                          : "Delivery"}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <span
                      className={cn(
                        "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold",
                        getTableStatusAccent(table.status, selected),
                      )}
                    >
                      {table.guests || 0}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <TableSketch
                      className={cn(
                        "h-20 w-24",
                        getTableLineArtClass(table.status, selected),
                      )}
                    />
                  </div>
                  <div className="mt-auto space-y-2">
                    <div
                      className={cn(
                        "text-lg font-semibold tracking-tight",
                        selected ? "text-white" : "text-orange-500",
                      )}
                    >
                      {table.name}
                    </div>
                    <div
                      className={cn(
                        "text-xs",
                        selected ? "text-white/80" : "text-slate-500",
                      )}
                    >
                      {table.guestName || "Disponible para nuevo pedido"}
                    </div>
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em]">
                      <span
                        className={cn(
                          selected ? "text-white/80" : "text-slate-400",
                        )}
                      >
                        {formatTableStatusLabel(table.status)}
                      </span>
                      <span
                        className={cn(
                          selected ? "text-white" : "text-slate-500",
                        )}
                      >
                        {openTickets} items
                      </span>
                    </div>
                  </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );
    if (sectionId === "menu")
      return (
        <TooltipProvider delayDuration={120}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(
                ["FAVORITOS", ...RESTAURANT_STATION_OPTIONS] as MenuFilter[]
              ).map((filter) => {
                const active = activeMenuFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveMenuFilter(filter)}
                    className={cn(
                      "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition",
                      active
                        ? "bg-orange-500 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-700",
                    )}
                  >
                    {filter === "FAVORITOS" ? "Inventario" : filter}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {visibleMenuShortcuts.map((shortcut) => (
                <button
                  key={shortcut.id}
                  type="button"
                  onClick={() => addMenuShortcutToSelectedTable(shortcut)}
                  className="overflow-hidden rounded-[18px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
                >
                  <div className="px-3 pt-3 text-base font-bold text-orange-500">
                    {shortcut.averagePrice !== null
                      ? formatCurrency(shortcut.averagePrice)
                      : "Sin precio"}
                  </div>
                  <div className="px-3 pb-3">
                    <div className="relative overflow-hidden rounded-[12px] bg-slate-100">
                      <div
                        className={cn(
                          "aspect-square w-full bg-gradient-to-br p-3",
                          getMenuCardTone(shortcut.station),
                        )}
                      >
                        <div className="flex h-full flex-col justify-between rounded-[10px] bg-white/45 p-3 backdrop-blur-[1px]">
                          <div className="flex items-start justify-between gap-2">
                            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                              {shortcut.category || shortcut.station}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[220px]">
                                <div className="space-y-1">
                                  <div className="font-semibold text-slate-900">
                                    {shortcut.name}
                                  </div>
                                  <div>
                                    Stock:{" "}
                                    {shortcut.stockActual !== null
                                      ? `${formatNumber(shortcut.stockActual)} ${shortcut.unitLabel ?? ""}`
                                      : shortcut.recipeId
                                        ? "ver insumos vinculados"
                                        : "sin inventario enlazado"}
                                  </div>
                                  <div>
                                    Origen:{" "}
                                    {shortcut.source === "inventory"
                                      ? "inventario"
                                      : shortcut.source === "recipe"
                                        ? "receta"
                                        : "histórico POS"}
                                    .
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="flex flex-1 items-center justify-center">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-2xl font-semibold text-slate-800 shadow-sm">
                              {getMenuInitials(shortcut.name)}
                            </div>
                          </div>
                          <div className="text-xs text-slate-600">
                            {shortcut.stockActual !== null
                              ? `Stock ${formatNumber(shortcut.stockActual)} ${shortcut.unitLabel ?? ""}`
                              : shortcut.soldQty
                                ? `${shortcut.soldQty} vendidos`
                                : "Disponible para venta"}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 line-clamp-2 min-h-[42px] text-center text-sm font-semibold leading-5 text-slate-800">
                      {shortcut.name}
                    </div>
                  </div>
                </button>
              ))}
              {!visibleMenuShortcuts.length ? (
                <div className="rounded-[18px] border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500 sm:col-span-3 xl:col-span-4 2xl:col-span-5">
                  No hay productos disponibles en inventario para esta vista.
                </div>
              ) : null}
            </div>
          </div>
        </TooltipProvider>
      );
    if (sectionId === "pedido")
      return (
        <div className="rounded-[28px] bg-slate-950 p-4 text-white shadow-[0_34px_90px_-52px_rgba(15,23,42,0.88)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                Pedido actual
              </p>
              <h3 className="mt-2 text-2xl font-semibold">
                {selectedTable?.name ?? "Sin mesa seleccionada"}
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                {selectedTable?.guestName ||
                  "Asigna cliente o canal y empieza a cargar productos."}
              </p>
            </div>
            <ReceiptText className="h-7 w-7 text-orange-300" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] bg-white/8 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Comensales
              </div>
              <div className="mt-2 text-xl font-semibold text-white">
                {selectedTable?.guests || 0}
              </div>
            </div>
            <div className="rounded-[22px] bg-white/8 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Items
              </div>
              <div className="mt-2 text-xl font-semibold text-white">
                {selectedTableItemCount}
              </div>
            </div>
            <div className="rounded-[22px] bg-white/8 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Estimado
              </div>
              <div className="mt-2 text-xl font-semibold text-white">
                {selectedTableEstimatedTotal > 0
                  ? formatCurrency(selectedTableEstimatedTotal)
                  : "Sin cálculo"}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              className="h-11 rounded-2xl bg-orange-500 text-white hover:bg-orange-600"
              onClick={() => openProductPickerForTable(selectedTable?.id)}
            >
              <ShoppingBasket className="mr-2 h-4 w-4" /> Agregar productos
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => printKitchenTickets("selected")}
              disabled={!selectedTableSaleItems.length}
            >
              <Printer className="mr-2 h-4 w-4" /> Imprimir comanda
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20 hover:text-white"
              onClick={() => setCancelOrderDialogOpen(true)}
              disabled={!selectedTable || !selectedTableSaleItems.length}
            >
              Cancelar pedido
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => selectedTable && closeTable(selectedTable.id)}
              disabled={!selectedTable || selectedTable.status === "LIBRE"}
            >
              Liberar mesa
            </Button>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Cliente o referencia</span>
              <Input
                value={selectedTable?.guestName ?? ticketForm.guestName}
                onChange={(event) => {
                  setTicketForm((current) => ({ ...current, guestName: event.target.value }));
                  updateSelectedTableMeta({ guestName: event.target.value });
                }}
                placeholder="Mesa Gómez / Pedido Ana"
                className="rounded-2xl border-white/10 bg-white text-slate-950"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Comensales / personas</span>
              <Input
                type="number"
                min={1}
                value={selectedTable?.guests || ticketForm.guests || 1}
                onChange={(event) => {
                  const guests = Math.max(1, Number(event.target.value) || 1);
                  setTicketForm((current) => ({ ...current, guests }));
                  updateSelectedTableMeta({ guests });
                  setSplitCount(guests);
                }}
                className="rounded-2xl border-white/10 bg-white text-slate-950"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Modo de servicio</span>
              <Select
                value={selectedTable?.serviceMode ?? "DINE_IN"}
                onValueChange={(value) =>
                  updateSelectedTableMeta({
                    serviceMode: value as RestaurantServiceMode,
                    courierType:
                      value === "DELIVERY"
                        ? selectedTable?.courierType ?? "INTERNAL"
                        : "NONE",
                    courierLabel: value === "DELIVERY" ? selectedTable?.courierLabel ?? "" : "",
                  })
                }
              >
                <SelectTrigger className="rounded-2xl border-white/10 bg-white text-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DINE_IN">En mesa</SelectItem>
                  <SelectItem value="TAKEAWAY">Para llevar</SelectItem>
                  <SelectItem value="DELIVERY">Domicilio</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-slate-300">Despacho / repartidor</span>
              <Select
                value={selectedTable?.courierType ?? "NONE"}
                onValueChange={(value) =>
                  updateSelectedTableMeta({ courierType: value as RestaurantCourierType })
                }
                disabled={!selectedTable || selectedTable.serviceMode === "DINE_IN"}
              >
                <SelectTrigger className="rounded-2xl border-white/10 bg-white text-slate-950 disabled:opacity-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin repartidor</SelectItem>
                  <SelectItem value="INTERNAL">Repartidor interno</SelectItem>
                  <SelectItem value="RAPPI">Rappi</SelectItem>
                  <SelectItem value="DIDI">Didi Food</SelectItem>
                  <SelectItem value="UBER_EATS">Uber Eats</SelectItem>
                  <SelectItem value="OTHER">Otro externo</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {selectedTable && selectedTable.serviceMode !== "DINE_IN" && selectedTable.courierType === "OTHER" ? (
              <label className="space-y-1 text-sm lg:col-span-2">
                <span className="text-slate-300">Nombre del repartidor o plataforma</span>
                <Input
                  value={selectedTable.courierLabel}
                  onChange={(event) =>
                    updateSelectedTableMeta({ courierLabel: event.target.value })
                  }
                  placeholder="Ej. aliado externo"
                  className="rounded-2xl border-white/10 bg-white text-slate-950"
                />
              </label>
            ) : null}
            <label className="space-y-1 text-sm lg:col-span-2">
              <span className="text-slate-300">Notas del pedido</span>
              <Textarea
                value={selectedTable?.note ?? ""}
                onChange={(event) => updateSelectedTableMeta({ note: event.target.value })}
                placeholder="Alergias, observaciones de mesa, punto de entrega..."
                className="min-h-[88px] rounded-2xl border-white/10 bg-white text-slate-950"
              />
            </label>
          </div>
          <div className="mt-5 max-h-[320px] space-y-3 overflow-auto pr-1">
            {selectedTableSaleItems.length ? (
              selectedTableSaleItems.map((item) => (
                <div
                  key={item.key}
                  className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {item.qty} x {item.dishName}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 font-semibold",
                            getStationBadgeTone(item.station),
                          )}
                        >
                          {item.station}
                        </span>
                        <span>Consolidado</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-white">
                        {item.total !== null
                          ? formatCurrency(item.total)
                          : "Sin precio"}
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => removeSelectedTableTickets(item.ticketIds)}
                          className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                        >
                          X
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            selectedTable &&
                            advanceTicket(selectedTable.id, item.ticketIds[0] ?? "")
                          }
                          className="rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-orange-600"
                          disabled={!item.ticketIds[0]}
                        >
                          Avanzar
                        </button>
                      </div>
                    </div>
                  </div>
                  {item.note ? (
                    <div className="mt-2 text-xs text-slate-400">
                      {item.note}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-white/15 px-4 py-8 text-sm text-slate-400">
                No hay productos cargados en este pedido.
              </div>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="rounded-full bg-white/10 px-3 py-1">
              {formatRestaurantServiceModeLabel(selectedTable?.serviceMode ?? "DINE_IN")}
            </span>
            {selectedTable && selectedTable.serviceMode !== "DINE_IN" ? (
              <span className="rounded-full bg-white/10 px-3 py-1">
                {formatRestaurantCourierLabel(selectedTable.courierType, selectedTable.courierLabel)}
              </span>
            ) : null}
            {selectedSplitCount > 1 ? (
              <span className="rounded-full bg-white/10 px-3 py-1">
                División sugerida {formatCurrency(splitPerPerson)} por persona
              </span>
            ) : null}
          </div>
        </div>
      );
    if (sectionId === "kds")
      return (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Pendientes
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {kitchenStatusSummary.pending}
              </div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Preparando
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {kitchenStatusSummary.preparing}
              </div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Lista para cobro
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {kitchenStatusSummary.charge}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Pantalla de cocina</div>
              <div className="text-xs text-slate-500">Más visual por estación, prioridad y hora de entrada.</div>
            </div>
            <Button variant="outline" className="rounded-2xl" onClick={() => printKitchenTickets("all")}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir pendientes
            </Button>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            {RESTAURANT_STATION_OPTIONS.map((station) => {
              const stationTickets = kitchenQueue.filter((ticket) => ticket.station === station);
              return (
                <div key={station} className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Estación</div>
                      <div className="mt-1 text-lg font-semibold text-slate-950">{station}</div>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", getStationBadgeTone(station))}>{stationTickets.length} activas</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {stationTickets.map((ticket) => (
                      <div key={ticket.id} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-base font-semibold text-slate-950">{ticket.qty} x {ticket.dishName}</div>
                            <div className="mt-1 text-sm text-slate-500">{ticket.tableName} · {ticket.guestName || "Sin nombre"}</div>
                          </div>
                          <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", ticket.priority === "ALTA" ? "bg-rose-100 text-rose-700" : "bg-slate-200 text-slate-700")}>{ticket.priority}</span>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-600">{formatKitchenStatusLabel(ticket.status)}</span>
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">{formatDateTime(ticket.createdAt)}</span>
                        </div>
                        {ticket.note ? (
                          <div className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs text-slate-600">
                            {ticket.note}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {!stationTickets.length ? (
                      <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                        Sin comandas en esta estación.
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!kitchenQueue.length ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500 xl:col-span-3">
                No hay comandas pendientes.
              </div>
            ) : null}
          </div>
        </div>
      );
    if (sectionId === "comercial")
      return (
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Top productos
            </div>
            <div className="mt-2 space-y-2">
              {(overview?.topProducts ?? []).slice(0, 4).map((product) => (
                <div
                  key={product.key}
                  className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  <span className="font-medium text-slate-950">
                    {product.label}
                  </span>
                  <span>{formatNumber(product.quantity)} uds</span>
                </div>
              ))}
              {!(overview?.topProducts ?? []).length ? (
                <div className="rounded-[18px] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                  Sin histórico suficiente todavía.
                </div>
              ) : null}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Tickets pagados
            </div>
            <div className="mt-2 space-y-2">
              {(overview?.salesToday.tickets ?? [])
                .slice(0, 3)
                .map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-950">
                        {ticket.numero}
                      </span>
                      <span>{formatCurrency(ticket.total)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {ticket.clienteNombre || "Consumidor final"} ·{" "}
                      {formatDateTime(ticket.createdAt)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {ticket.status === "PAID"
                          ? "Pagada"
                          : ticket.status === "PARTIALLY_REFUNDED"
                            ? "Parcialmente devuelta"
                            : "Devuelta"}
                      </span>
                      {ticket.returnedTotal > 0 ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                          Devuelto {formatCurrency(ticket.returnedTotal)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => openTransactionDialog("VOID", ticket)}
                        disabled={ticket.status !== "PAID" || ticket.returnedTotal > 0}
                      >
                        <Undo2 className="mr-2 h-4 w-4" /> Anular
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => openTransactionDialog("REFUND", ticket)}
                        disabled={ticket.status === "REFUNDED"}
                      >
                        <HandCoins className="mr-2 h-4 w-4" /> Devolución
                      </Button>
                    </div>
                  </div>
                ))}
              {!(overview?.salesToday.tickets ?? []).length ? (
                <div className="rounded-[18px] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                  Todavía no hay tickets pagados hoy.
                </div>
              ) : null}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Informes imprimibles
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Button asChild variant="outline" className="justify-start rounded-2xl">
                <Link href="/dashboard/reportes?periodo=hoy">Día</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start rounded-2xl">
                <Link href="/dashboard/reportes?periodo=7d">Semana</Link>
              </Button>
              <Button asChild variant="outline" className="justify-start rounded-2xl">
                <Link href="/dashboard/reportes?periodo=30d">Mes</Link>
              </Button>
            </div>
          </div>
        </div>
      );
    if (sectionId === "faltantes")
      return (
        <div className="space-y-3">
          <Input
            value={shortageDraft.label}
            onChange={(event) =>
              setShortageDraft((current) => ({
                ...current,
                label: event.target.value,
              }))
            }
            placeholder="Ej. Sin pan brioche"
          />
          <Textarea
            value={shortageDraft.note}
            onChange={(event) =>
              setShortageDraft((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
            placeholder="Alternativa o acción operativa"
            className="min-h-[84px] rounded-2xl"
          />
          <Button
            className="w-full rounded-2xl bg-orange-500 text-white hover:bg-orange-600"
            onClick={addShortage}
          >
            Guardar faltante
          </Button>
          <div className="space-y-2 max-h-[240px] overflow-auto pr-1">
            {board.shortages.map((shortage) => (
              <button
                type="button"
                key={shortage.id}
                onClick={() => toggleShortage(shortage.id)}
                className={cn(
                  "w-full rounded-[20px] border px-4 py-3 text-left text-sm",
                  shortage.resolved
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-700",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-semibold">{shortage.label}</span>
                  {shortage.resolved ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : null}
                </div>
                {shortage.note ? (
                  <div className="mt-1 text-xs opacity-80">{shortage.note}</div>
                ) : null}
              </button>
            ))}
            {!board.shortages.length ? (
              <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                Sin novedades registradas.
              </div>
            ) : null}
          </div>
        </div>
      );
    if (sectionId === "recetas")
      return (
        <div className="space-y-4">
          <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                value={recipeDraft.name}
                onChange={(event) =>
                  setRecipeDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Nombre de receta"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Estación</Label>
                <Select
                  value={recipeDraft.station}
                  onValueChange={(value) =>
                    setRecipeDraft((current) => ({
                      ...current,
                      station: value as Station,
                    }))
                  }
                >
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESTAURANT_STATION_OPTIONS.map((station) => (
                      <SelectItem key={station} value={station}>
                        {station}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Rinde</Label>
                <Input
                  type="number"
                  min={1}
                  value={recipeDraft.yieldCount}
                  onChange={(event) =>
                    setRecipeDraft((current) => ({
                      ...current,
                      yieldCount: Number(event.target.value) || 1,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Textarea
                value={recipeDraft.notes}
                onChange={(event) =>
                  setRecipeDraft((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder="Nota de preparación o merma"
                className="min-h-[74px] rounded-2xl"
              />
            </div>
            <div className="space-y-2">
              {recipeDraft.components.map((component) => (
                <div
                  key={component.id}
                  className="grid gap-2 sm:grid-cols-[1fr_120px_auto]"
                >
                  <Select
                    value={component.materialId || "__none__"}
                    onValueChange={(value) =>
                      updateRecipeComponent(component.id, {
                        materialId: value === "__none__" ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger className="rounded-2xl bg-white">
                      <SelectValue placeholder="Material" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        Selecciona material
                      </SelectItem>
                      {(overview?.materials ?? []).map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={component.quantity}
                    onChange={(event) =>
                      updateRecipeComponent(component.id, {
                        quantity: Number(event.target.value) || 0,
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-2xl"
                    onClick={() => removeRecipeComponentRow(component.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={addRecipeComponentRow}
              >
                <Plus className="mr-2 h-4 w-4" /> Insumo
              </Button>
              <Button
                className="rounded-2xl bg-orange-500 text-white hover:bg-orange-600"
                onClick={addRecipe}
              >
                Guardar receta
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {board.recipes.length ? (
              board.recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="rounded-[22px] border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">
                        {recipe.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {recipe.station} · rinde {recipe.yieldCount}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="rounded-2xl"
                      onClick={() => deleteRecipe(recipe.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {recipe.notes ? (
                    <div className="mt-2 text-xs text-slate-500">
                      {recipe.notes}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                Aún no hay recetas cargadas.
              </div>
            )}
          </div>
        </div>
      );
    if (sectionId === "consumo")
      return (
        <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
          {consumption.length ? (
            consumption.map((item) => (
              <div
                key={item.materialId}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-950">
                      {item.nombre}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatNumber(item.qty)} {item.unidad} estimados
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>Stock final</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {formatNumber(item.projectedStock)} {item.unidad}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
              El consumo aparecerá cuando haya comandas vinculadas con recetas.
            </div>
          )}
        </div>
      );
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[20px] bg-slate-50 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Merma promedio
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {formatNumber(wasteAveragePct)}%
            </div>
          </div>
          <div className="rounded-[20px] bg-slate-50 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Alertas de merma
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">
              {overview?.wasteAlerts.length ?? 0}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[22px] border border-orange-100 bg-orange-50 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-orange-700">
              Turno
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {currentTurnoStatus === "CERRADO"
                ? "Cerrado"
                : currentTurnoId
                  ? "Abierto"
                  : "Por iniciar"}
            </div>
            <div className="text-xs text-slate-500">{autosaveLabel}</div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Ventas hoy
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {formatCurrency(overview?.salesToday.total ?? 0)}
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Compras 7d
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {formatCurrency(overview?.purchasesWeek.total ?? 0)}
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Reposición
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {replenishmentSuggestions.length}
            </div>
          </div>
        </div>
        <Textarea
          value={board.closingNotes}
          onChange={(event) =>
            setBoard((current) => ({
              ...current,
              closingNotes: event.target.value,
            }))
          }
          placeholder="Caja, pendientes, incidencias y entrega del siguiente turno"
          className="min-h-[110px] rounded-2xl"
        />
        <Button
          className="w-full rounded-2xl"
          variant="destructive"
          onClick={() => void closeTurno()}
          disabled={isClosingTurno}
        >
          {isClosingTurno ? "Cerrando turno..." : "Cerrar turno"}
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={120}>
      <main className="min-h-screen bg-[linear-gradient(180deg,#fff7ed_0%,#fff1dd_24%,#f8fafc_100%)] text-slate-950">
        <div className="mx-auto flex min-h-screen max-w-[1700px] flex-col px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-1 flex-col overflow-hidden rounded-[34px] border border-orange-100 bg-white shadow-[0_40px_120px_-64px_rgba(234,88,12,0.35)]">
            <header className="border-b border-slate-200 bg-white px-5 py-4 lg:px-7">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <Link
                      href="/dashboard"
                      className="transition hover:text-orange-600"
                    >
                      Dashboard
                    </Link>
                    <ChevronRight className="h-4 w-4" />
                    <span className="text-orange-600">Restaurante</span>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-700">
                      Modo sala
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-orange-500 text-white shadow-[0_18px_36px_-24px_rgba(249,115,22,0.9)]">
                      <ChefHat className="h-7 w-7" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-semibold tracking-tight">
                        Cabina restaurante
                      </h1>
                      <p className="mt-1 text-sm text-slate-500">
                        Más clara, modular y enfocada en tocar para vender.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[24px] border border-orange-100 bg-orange-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
                      Turno
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {currentTurnoStatus === "CERRADO"
                        ? "Cerrado"
                        : currentTurnoId
                          ? "Abierto"
                          : "Por iniciar"}
                    </p>
                    <p className="text-xs text-slate-500">{autosaveLabel}</p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Ventas hoy
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {formatCurrency(overview?.salesToday.total ?? 0)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {overview?.salesToday.count ?? 0} tickets pagados
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Cocina
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {kitchenQueue.length} activas
                    </p>
                    <p className="text-xs text-slate-500">
                      {kitchenStatusSummary.ready} listas para salir
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Reposición
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {replenishmentSuggestions.length}
                    </p>
                    <p className="text-xs text-slate-500">
                      insumos por vigilar
                    </p>
                  </div>
                </div>
              </div>
            </header>
            {error ? (
              <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800 lg:px-7">
                {error}
              </div>
            ) : null}
            {loading ? (
              <div className="flex flex-1 items-center justify-center px-6 text-sm text-slate-500">
                Cargando operación del turno...
              </div>
            ) : (
              <div className="grid flex-1 min-h-0 gap-4 overflow-hidden p-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="grid min-h-0 content-start gap-4 overflow-auto rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <section className="rounded-[26px] bg-slate-950 p-4 text-white shadow-[0_28px_60px_-40px_rgba(15,23,42,0.8)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                      Resumen
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-[20px] bg-white/8 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                          Mesas activas
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-white">
                          {activeTablesCount}
                        </div>
                      </div>
                      <div className="rounded-[20px] bg-white/8 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                          Entregadas
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-white">
                          {deliveredTicketsCount}
                        </div>
                      </div>
                      <div className="rounded-[20px] bg-white/8 px-4 py-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-300">
                          Merma prom.
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-white">
                          {formatNumber(wasteAveragePct)}%
                        </div>
                      </div>
                    </div>
                  </section>
                  <section className="rounded-[26px] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Accesos rápidos
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Navega sin saturar esta vista.
                        </p>
                      </div>
                      <LayoutGrid className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="mt-4 grid gap-2">
                      <Button
                        asChild
                        variant="outline"
                        className="justify-start rounded-2xl border-slate-200 bg-white"
                      >
                        <Link href="/dashboard/pos/venta-rapida">
                          Caja rápida
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="justify-start rounded-2xl border-slate-200 bg-white"
                      >
                        <Link href="/dashboard/inventario">Inventario</Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="justify-start rounded-2xl border-slate-200 bg-white"
                      >
                        <Link href="/dashboard/compras">Compras</Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="justify-start rounded-2xl border-slate-200 bg-white"
                      >
                        <Link href="/dashboard/reportes?periodo=hoy">Informe del día</Link>
                      </Button>
                    </div>
                  </section>
                  <section className="rounded-[26px] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Alertas
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Lo que no puede esperar.
                        </p>
                      </div>
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {replenishmentSuggestions.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                        >
                          <div className="font-semibold">{item.nombre}</div>
                          <div className="mt-1 text-xs text-amber-800">
                            Faltan {formatNumber(item.shortage)} {item.unidad}
                          </div>
                        </div>
                      ))}
                      {!replenishmentSuggestions.length ? (
                        <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                          Sin alertas críticas de inventario.
                        </div>
                      ) : null}
                    </div>
                  </section>
                </aside>
                <section className="min-h-0 overflow-auto rounded-[30px] border border-slate-200 bg-[#fffdf9] p-4">
                  <Tabs
                    value={activeTab}
                    onValueChange={(value) =>
                      setActiveTab(value as DashboardTab)
                    }
                    className="w-full"
                  >
                    <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <TabsList className="h-auto rounded-3xl bg-slate-100 p-1">
                            {TAB_DEFS.map((tab) => (
                              <TabsTrigger
                                key={tab.id}
                                value={tab.id}
                                className="rounded-2xl px-4 py-2.5 text-sm font-semibold"
                              >
                                {tab.label}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                          {activeTab === "venta" ? (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                {SECTION_META.mesas.title}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {SECTION_META.mesas.description}
                              </p>
                            </div>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          {
                            TAB_DEFS.find((tab) => tab.id === activeTab)
                              ?.description
                          }
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl border-slate-200 bg-white"
                          onClick={() => setSectionsDialogOpen(true)}
                        >
                          <Settings2 className="mr-2 h-4 w-4" /> Insertar secciones
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl border-slate-200 bg-white"
                          onClick={resetActiveTabLayout}
                        >
                          Restablecer vista
                        </Button>
                      </div>
                    </div>
                    {TAB_DEFS.map((tab) => (
                      <TabsContent
                        key={tab.id}
                        value={tab.id}
                        className="mt-4 space-y-4"
                      >
                        {layoutPrefs[tab.id].order
                          .filter((sectionId) =>
                            layoutPrefs[tab.id].visible.includes(sectionId),
                          )
                          .map((sectionId) => {
                            const isDragging = draggingSectionId === sectionId;
                            const isDropTarget =
                              dragOverSectionId === sectionId;
                            return (
                              <div
                                key={sectionId}
                                draggable
                                onDragStart={(event) =>
                                  handleSectionDragStart(event, sectionId)
                                }
                                onDragOver={(event) =>
                                  handleSectionDragOver(event, sectionId)
                                }
                                onDrop={() => handleSectionDrop(sectionId)}
                                onDragEnd={clearDragState}
                                className={cn(
                                  "transition",
                                  isDragging && "opacity-50",
                                  isDropTarget &&
                                    dragOverPlacement === "before" &&
                                    "border-t-4 border-t-orange-400 pt-2",
                                  isDropTarget &&
                                    dragOverPlacement === "after" &&
                                    "border-b-4 border-b-orange-400 pb-2",
                                )}
                              >
                                <RestaurantSectionCard
                                  title={SECTION_META[sectionId].title}
                                  description={
                                    SECTION_META[sectionId].description
                                  }
                                  dragHandle={renderDragHandle(sectionId)}
                                  hideHeader={
                                    activeTab === "venta" &&
                                    sectionId === "mesas"
                                  }
                                >
                                  {renderSection(sectionId)}
                                </RestaurantSectionCard>
                              </div>
                            );
                          })}
                      </TabsContent>
                    ))}
                  </Tabs>
                </section>
              </div>
            )}
          </div>
        </div>
        <Dialog
          open={productPickerOpen}
          onOpenChange={(open) => {
            setProductPickerOpen(open);
            if (!open) {
              setPaymentDialogOpen(false);
              setSaleSubmitState({ kind: "idle", message: "" });
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-hidden rounded-[30px] border-slate-200 p-0 sm:max-w-6xl">
            <DialogHeader className="sr-only">
              <DialogTitle>
                {selectedTable
                  ? `Agregar productos a ${selectedTable.name}`
                  : "Agregar productos a la mesa"}
              </DialogTitle>
              <DialogDescription>
                Selecciona productos, revisa el pedido y confirma la venta de la mesa activa.
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[90vh] min-h-[680px] gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-950 text-white">
                <div className="border-b border-white/10 px-6 py-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                    Mesa seleccionada
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {selectedTable?.name ?? "Sin mesa"}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {selectedTable?.guestName || "Sin referencia de cliente"}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-white/10 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-300">
                        Comensales
                      </div>
                      <div className="mt-1 text-lg font-semibold">
                        {selectedTable?.guests || 0}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/10 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-300">
                        Items
                      </div>
                      <div className="mt-1 text-lg font-semibold">
                        {selectedTableItemCount}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white/10 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-300">
                        Total
                      </div>
                      <div className="mt-1 text-lg font-semibold">
                        {selectedTableEstimatedTotal > 0
                          ? formatCurrency(selectedTableEstimatedTotal)
                          : "--"}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 border-b border-white/10 px-6 py-5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                      Cliente
                    </Label>
                    <Input
                      value={ticketForm.guestName}
                      onChange={(event) =>
                        setTicketForm((current) => ({
                          ...current,
                          guestName: event.target.value,
                        }))
                      }
                      placeholder="Nombre para la venta"
                      className="border-white/10 bg-white/10 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                        Comensales
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={selectedTable?.guests || 1}
                        onChange={(event) => {
                          const guests = Math.max(1, Number(event.target.value) || 1);
                          setTicketForm((current) => ({ ...current, guests }));
                          updateSelectedTableMeta({ guests });
                          setSplitCount(guests);
                        }}
                        className="border-white/10 bg-white/10 text-white placeholder:text-slate-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                        Modo
                      </Label>
                      <Select
                        value={selectedTable?.serviceMode ?? "DINE_IN"}
                        onValueChange={(value) =>
                          updateSelectedTableMeta({
                            serviceMode: value as RestaurantServiceMode,
                            courierType:
                              value === "DELIVERY"
                                ? selectedTable?.courierType ?? "INTERNAL"
                                : "NONE",
                            courierLabel:
                              value === "DELIVERY"
                                ? selectedTable?.courierLabel ?? ""
                                : "",
                          })
                        }
                      >
                        <SelectTrigger className="border-white/10 bg-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DINE_IN">En mesa</SelectItem>
                          <SelectItem value="TAKEAWAY">Para llevar</SelectItem>
                          <SelectItem value="DELIVERY">Domicilio</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selectedTable && selectedTable.serviceMode !== "DINE_IN" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                          Repartidor
                        </Label>
                        <Select
                          value={selectedTable.courierType}
                          onValueChange={(value) =>
                            updateSelectedTableMeta({ courierType: value as RestaurantCourierType })
                          }
                        >
                          <SelectTrigger className="border-white/10 bg-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NONE">Sin repartidor</SelectItem>
                            <SelectItem value="INTERNAL">Interno</SelectItem>
                            <SelectItem value="RAPPI">Rappi</SelectItem>
                            <SelectItem value="DIDI">Didi Food</SelectItem>
                            <SelectItem value="UBER_EATS">Uber Eats</SelectItem>
                            <SelectItem value="OTHER">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                          Etiqueta entrega
                        </Label>
                        <Input
                          value={selectedTable.courierLabel}
                          onChange={(event) => updateSelectedTableMeta({ courierLabel: event.target.value })}
                          placeholder="Nombre o apoyo externo"
                          className="border-white/10 bg-white/10 text-white placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                      Nota general del pedido
                    </Label>
                    <Textarea
                      value={selectedTable?.note ?? ""}
                      onChange={(event) => updateSelectedTableMeta({ note: event.target.value })}
                      placeholder="Observaciones de cocina o entrega"
                      className="min-h-[84px] border-white/10 bg-white/10 text-white placeholder:text-slate-400"
                    />
                  </div>
                  <label className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                    <input
                      type="checkbox"
                      checked={customerNotificationsEnabled}
                      onChange={(event) =>
                        setCustomerNotificationsEnabled(event.target.checked)
                      }
                      className="h-4 w-4 rounded border-white/20 bg-transparent"
                    />
                    <span>Notificar al cliente</span>
                  </label>
                  {customerNotificationsEnabled ? (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                          WhatsApp
                        </Label>
                        <Input
                          value={customerPhoneInput}
                          onChange={(event) => setCustomerPhoneInput(event.target.value)}
                          placeholder="573001112233"
                          className="border-white/10 bg-white/10 text-white placeholder:text-slate-400"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                          Correo
                        </Label>
                        <Input
                          type="email"
                          value={customerEmailInput}
                          onChange={(event) => setCustomerEmailInput(event.target.value)}
                          placeholder="cliente@correo.com"
                          className="border-white/10 bg-white/10 text-white placeholder:text-slate-400"
                        />
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="flex-1 space-y-3 overflow-auto px-6 py-5">
                  <div className="rounded-[20px] border border-dashed border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Bike className="h-4 w-4 text-orange-300" /> Otros cargos o productos fuera de lista
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Input
                        value={manualChargeDraft.name}
                        onChange={(event) => setManualChargeDraft((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Ej. recargo, bebida especial"
                        className="border-white/10 bg-white/10 text-white placeholder:text-slate-400 sm:col-span-2"
                      />
                      <Input
                        type="number"
                        min={1}
                        value={manualChargeDraft.price}
                        onChange={(event) => setManualChargeDraft((current) => ({ ...current, price: event.target.value }))}
                        placeholder="Valor"
                        className="border-white/10 bg-white/10 text-white placeholder:text-slate-400"
                      />
                      <Input
                        type="number"
                        min={1}
                        value={manualChargeDraft.qty}
                        onChange={(event) => setManualChargeDraft((current) => ({ ...current, qty: Math.max(1, Number(event.target.value) || 1) }))}
                        placeholder="Cantidad"
                        className="border-white/10 bg-white/10 text-white placeholder:text-slate-400"
                      />
                      <Select
                        value={manualChargeDraft.station}
                        onValueChange={(value) => setManualChargeDraft((current) => ({ ...current, station: value as Station }))}
                      >
                        <SelectTrigger className="border-white/10 bg-white/10 text-white sm:col-span-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESTAURANT_STATION_OPTIONS.map((station) => (
                            <SelectItem key={station} value={station}>
                              {station}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        value={manualChargeDraft.note}
                        onChange={(event) => setManualChargeDraft((current) => ({ ...current, note: event.target.value }))}
                        placeholder="Nota opcional"
                        className="min-h-[72px] border-white/10 bg-white/10 text-white placeholder:text-slate-400 sm:col-span-2"
                      />
                      <Button type="button" className="rounded-2xl bg-white text-slate-950 hover:bg-slate-100 sm:col-span-2" onClick={addManualChargeToSelectedTable}>
                        <Plus className="mr-2 h-4 w-4" /> Agregar como Otros
                      </Button>
                    </div>
                  </div>
                  {selectedTableSaleItems.length ? (
                    selectedTableSaleItems.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <div className="flex items-start gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl || "/placeholder-product.svg"}
                            alt={item.dishName}
                            className="h-14 w-14 rounded-2xl border border-white/10 bg-white object-cover"
                            onError={(event) => {
                              event.currentTarget.src = "/placeholder-product.svg";
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-white">
                                  {item.dishName}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {item.qty} unidad{item.qty === 1 ? "" : "es"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeSelectedTableTickets(item.ticketIds)
                                  }
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                                  aria-label={`Quitar ${item.dishName}`}
                                >
                                  X
                                </button>
                                <div className="text-right text-sm font-semibold text-white">
                                  {item.total !== null
                                    ? formatCurrency(item.total)
                                    : "Sin precio"}
                                </div>
                              </div>
                            </div>
                            {item.note ? (
                              <div className="mt-2 text-xs text-slate-400">
                                {item.note}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-white/15 px-4 py-8 text-sm text-slate-400">
                      Todavía no hay productos en esta mesa.
                    </div>
                  )}
                  {saleSubmitState.kind !== "idle" ? (
                    <div
                      className={cn(
                        "rounded-[18px] px-4 py-3 text-sm",
                        saleSubmitState.kind === "error"
                          ? "bg-rose-500/15 text-rose-100"
                          : saleSubmitState.kind === "success"
                            ? "bg-emerald-500/15 text-emerald-100"
                            : "bg-white/10 text-slate-200",
                      )}
                    >
                      {saleSubmitState.message}
                    </div>
                  ) : null}
                </div>
                <div className="border-t border-white/10 px-6 py-4">
                  <Button
                    className="w-full rounded-2xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-70"
                    onClick={openSaleCheckout}
                    disabled={finalizingSale || !selectedTableSaleItems.length}
                  >
                    {finalizingSale ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrando venta...
                      </>
                    ) : (
                      <>
                        <ReceiptText className="mr-2 h-4 w-4" />
                        Confirmar venta
                      </>
                    )}
                  </Button>
                </div>
              </aside>
              <section className="flex min-h-0 flex-col bg-[#f6f6f4]">
                <div className="border-b border-slate-200 bg-white px-6 py-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Agregar productos
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-slate-950">
                        Primero categoría, luego producto
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {productCategories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setActiveProductCategory(category)}
                          className={cn(
                            "rounded-full px-4 py-2 text-sm font-semibold transition",
                            activeProductCategory === category
                              ? "bg-orange-500 text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-orange-50 hover:text-orange-700",
                          )}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                    {visibleProductPickerItems.map((shortcut) => (
                      <button
                        key={`picker-${shortcut.id}`}
                        type="button"
                        onClick={() => addMenuShortcutToSelectedTable(shortcut)}
                        className="overflow-hidden rounded-[18px] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
                      >
                        <div className="px-3 pt-3 text-base font-bold text-orange-500">
                          {shortcut.averagePrice !== null
                            ? formatCurrency(shortcut.averagePrice)
                            : "Sin precio"}
                        </div>
                        <div className="px-3 pb-3">
                          <div className="relative overflow-hidden rounded-[12px] bg-slate-100">
                            <div
                              className={cn(
                                "aspect-square w-full bg-gradient-to-br p-3",
                                getMenuCardTone(shortcut.station),
                              )}
                            >
                              <div className="flex h-full flex-col justify-between rounded-[10px] bg-white/45 p-3 backdrop-blur-[1px]">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                                    {getProductCategoryLabel(shortcut)}
                                  </span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={(event) =>
                                          event.stopPropagation()
                                        }
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
                                      >
                                        <Eye className="h-4 w-4" />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[220px]">
                                      <div className="space-y-1">
                                        <div className="font-semibold text-slate-900">
                                          {shortcut.name}
                                        </div>
                                        <div>
                                          Stock:{" "}
                                          {shortcut.stockActual !== null
                                            ? `${formatNumber(shortcut.stockActual)} ${shortcut.unitLabel ?? ""}`
                                            : shortcut.recipeId
                                              ? "ver insumos vinculados"
                                              : "sin inventario enlazado"}
                                        </div>
                                        <div>
                                          Origen:{" "}
                                          {shortcut.source === "inventory"
                                            ? "inventario"
                                            : shortcut.source === "recipe"
                                              ? "receta"
                                              : "histórico POS"}
                                          .
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="flex flex-1 items-center justify-center">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={shortcut.imageUrl || "/placeholder-product.svg"}
                                    alt={shortcut.name}
                                    className="h-20 w-20 rounded-[20px] border border-white/60 bg-white object-cover shadow-sm"
                                    onError={(event) => {
                                      event.currentTarget.src = "/placeholder-product.svg";
                                    }}
                                  />
                                </div>
                                <div className="text-xs text-slate-600">
                                  {shortcut.stockActual !== null
                                    ? `Stock ${formatNumber(shortcut.stockActual)} ${shortcut.unitLabel ?? ""}`
                                    : shortcut.soldQty
                                      ? `${shortcut.soldQty} vendidos`
                                      : "Disponible para venta"}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 line-clamp-2 min-h-[42px] text-center text-sm font-semibold leading-5 text-slate-800">
                            {shortcut.name}
                          </div>
                        </div>
                      </button>
                    ))}
                    {!visibleProductPickerItems.length ? (
                      <div className="rounded-[18px] border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500 sm:col-span-2 xl:col-span-4 2xl:col-span-5">
                        No hay productos disponibles para la categoría
                        seleccionada.
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="flex max-h-[88vh] flex-col overflow-hidden rounded-[28px] border-slate-200 p-0 sm:max-w-5xl">
            <DialogHeader>
              <div className="border-b border-slate-200 px-6 py-5">
                <DialogTitle>Metodo de pago</DialogTitle>
                <DialogDescription>
                Confirma como se pagara esta venta antes de descontar inventario.
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Total a cobrar
                    </div>
                    <div className="mt-2 text-4xl font-semibold text-slate-950 sm:text-5xl">
                      {formatCurrency(checkoutTotal)}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {selectedTableItemCount} item{selectedTableItemCount === 1 ? "" : "s"} en {selectedTable?.name ?? "la mesa"}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Servicio</div>
                      <div className="mt-2 text-base font-semibold text-slate-950">{formatRestaurantServiceModeLabel(selectedTable?.serviceMode ?? "DINE_IN")}</div>
                      {selectedTable && selectedTable.serviceMode !== "DINE_IN" ? (
                        <div className="mt-1 text-xs text-slate-500">{formatRestaurantCourierLabel(selectedTable.courierType, selectedTable.courierLabel)}</div>
                      ) : null}
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">División sugerida</div>
                      <div className="mt-2 text-base font-semibold text-slate-950">{formatCurrency(splitPerPerson)}</div>
                      <div className="mt-1 text-xs text-slate-500">entre {selectedSplitCount} persona{selectedSplitCount === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                    <Label>Metodo</Label>
                    <Select
                      value={selectedPaymentMethod}
                      onValueChange={(value) =>
                        setSelectedPaymentMethod(
                          value as RestaurantCheckoutPaymentMethod,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un metodo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Efectivo</SelectItem>
                        <SelectItem value="CARD">Tarjeta / datáfono</SelectItem>
                        <SelectItem value="TRANSFER">Transferencia</SelectItem>
                        <SelectItem value="OTHER">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedPaymentMethod === "CASH" ? (
                    <div className="space-y-3 rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                        <HandCoins className="h-4 w-4" /> Efectivo recibido y cambio
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getRestaurantQuickCashOptions(checkoutTotal).map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setCashReceivedInput(String(value))}
                            className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            {formatCurrency(value)}
                          </button>
                        ))}
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={cashReceivedInput}
                        onChange={(event) => setCashReceivedInput(event.target.value)}
                        placeholder="Cuánto entrega el cliente"
                        className="bg-white"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recibido</div>
                          <div className="mt-1 text-xl font-semibold text-slate-950">{cashReceivedAmount > 0 ? formatCurrency(cashReceivedAmount) : "--"}</div>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cambio</div>
                          <div className="mt-1 text-xl font-semibold text-slate-950">{formatCurrency(cashChangeDue)}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-4">
                  <div className="space-y-2 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                    <Label>Propina voluntaria</Label>
                    <div className="flex flex-wrap gap-2">
                      {[0, 2000, 5000, 10000].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTipInput(value ? String(value) : "")}
                          className={cn(
                            "rounded-full border px-3 py-2 text-sm font-semibold transition",
                            (Number(tipInput) || 0) === value
                              ? "border-orange-300 bg-orange-50 text-orange-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                          )}
                        >
                          {value ? formatCurrency(value) : "Sin propina"}
                        </button>
                      ))}
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={tipInput}
                      onChange={(event) => setTipInput(event.target.value)}
                      placeholder="Otro valor de propina"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                      <Label>Dividir cuenta</Label>
                      <Input
                        type="number"
                        min={1}
                        value={selectedSplitCount}
                        onChange={(event) => setSplitCount(Math.max(1, Number(event.target.value) || 1))}
                      />
                      <p className="text-xs text-slate-500">
                        {formatCurrency(splitPerPerson)} por persona.
                      </p>
                    </div>
                    <div className="space-y-2 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                      <Label>Redondeo</Label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 0 as const, label: "Sin redondeo" },
                          { value: 100 as const, label: "A 100" },
                          { value: 1000 as const, label: "A 1000" },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setRoundingStep(option.value)}
                            className={cn(
                              "rounded-full border px-3 py-2 text-sm font-semibold transition",
                              roundingStep === option.value
                                ? "border-orange-300 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        Ajuste: {formatCurrency(roundingAdjustment)}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">Subtotal productos</span>
                      <span className="font-semibold text-slate-950">{formatCurrency(selectedTableEstimatedTotal)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">Propina</span>
                      <span className="font-semibold text-slate-950">{formatCurrency(tipAmount)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600">Ajuste redondeo</span>
                      <span className="font-semibold text-slate-950">{formatCurrency(roundingAdjustment)}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                      <span className="text-base font-semibold text-slate-950">Total final</span>
                      <span className="text-3xl font-semibold text-slate-950">{formatCurrency(checkoutTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentDialogOpen(false)}
                disabled={finalizingSale}
              >
                Volver
              </Button>
              <Button
                type="button"
                onClick={finalizeSelectedTableSale}
                disabled={finalizingSale}
              >
                {finalizingSale ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>Registrar venta</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={saleSuccessState.open}
          onOpenChange={(open) =>
            setSaleSuccessState((current) => ({ ...current, open }))
          }
        >
          <DialogContent className="rounded-[32px] border-slate-200 sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Venta registrada con exito</DialogTitle>
              <DialogDescription>
                La mesa ya quedo liberada y la venta fue enviada al modulo POS.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-5 rounded-[28px] bg-emerald-50 px-6 py-6 text-emerald-900">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/75 shadow-sm">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    Factura {saleSuccessState.invoiceNumber}
                  </div>
                  <div className="mt-1 text-sm text-emerald-800">
                    Pago: {getRestaurantPaymentMethodLabel(saleSuccessState.paymentMethod)}
                  </div>
                  <div className="mt-4 text-[50px] font-semibold leading-none tracking-tight text-emerald-950">
                    {formatCurrency(saleSuccessState.total)}
                  </div>
                  <div className="mt-2 text-sm text-emerald-800">
                    Valor registrado con éxito
                  </div>
                </div>
              </div>
              {saleSuccessState.warnings.length ? (
                <div className="rounded-[18px] bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {saleSuccessState.warnings.join(" ")}
                </div>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={() =>
                  setSaleSuccessState((current) => ({ ...current, open: false }))
                }
              >
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={cancelOrderDialogOpen} onOpenChange={setCancelOrderDialogOpen}>
          <DialogContent className="rounded-[28px] border-slate-200 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancelar pedido</DialogTitle>
              <DialogDescription>
                Registra el motivo antes de vaciar este pedido.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Textarea
                value={cancelOrderReason}
                onChange={(event) => setCancelOrderReason(event.target.value)}
                placeholder="Motivo de cancelación"
                className="min-h-[110px] rounded-2xl"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCancelOrderDialogOpen(false)}>
                Volver
              </Button>
              <Button type="button" variant="destructive" onClick={cancelSelectedOrder}>
                Confirmar cancelación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={transactionDialogState.open}
          onOpenChange={(open) =>
            setTransactionDialogState((current) => ({ ...current, open }))
          }
        >
          <DialogContent className="rounded-[28px] border-slate-200 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {transactionDialogState.mode === "VOID" ? "Anular venta" : "Registrar devolución"}
              </DialogTitle>
              <DialogDescription>
                {transactionDialogState.mode === "VOID"
                  ? `La factura ${transactionDialogState.invoiceNumber} se marcará como anulada.`
                  : `Se registrará una devolución completa sobre ${transactionDialogState.invoiceNumber}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Total: {formatCurrency(transactionDialogState.invoiceTotal)}
              </div>
              <Textarea
                value={transactionReason}
                onChange={(event) => setTransactionReason(event.target.value)}
                placeholder="Motivo"
                className="min-h-[110px] rounded-2xl"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setTransactionDialogState((current) => ({ ...current, open: false }))
                }
                disabled={submittingTransaction}
              >
                Cerrar
              </Button>
              <Button type="button" onClick={() => void submitTransactionAction()} disabled={submittingTransaction}>
                {submittingTransaction
                  ? "Procesando..."
                  : transactionDialogState.mode === "VOID"
                    ? "Anular factura"
                    : "Registrar devolución"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={sectionsDialogOpen} onOpenChange={setSectionsDialogOpen}>
          <DialogContent className="rounded-[28px] border-slate-200 sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Armar dashboard</DialogTitle>
              <DialogDescription>
                Activa las secciones que quieras ver en{" "}
                {TAB_DEFS.find(
                  (tab) => tab.id === activeTab,
                )?.label.toLowerCase()}{" "}
                y luego arrástralas dentro del dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              {TAB_SECTIONS[activeTab].map((sectionId) => {
                const enabled =
                  layoutPrefs[activeTab].visible.includes(sectionId);
                return (
                  <label
                    key={sectionId}
                    className="flex items-start gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleSectionVisibility(sectionId)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-950">
                        {SECTION_META[sectionId].title}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {SECTION_META[sectionId].description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <div className="text-xs text-slate-500">
                Tip: después de guardar, arrastra cada bloque desde el manillar
                para ordenar la pantalla.
              </div>
              <Button
                type="button"
                className="rounded-2xl bg-orange-500 text-white hover:bg-orange-600"
                onClick={() => setSectionsDialogOpen(false)}
              >
                Listo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </TooltipProvider>
  );
}
