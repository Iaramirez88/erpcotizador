'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/components/providers/i18n-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BrainCircuit,
  Calendar,
  Download,
  Eye,
  FileImage,
  FileSpreadsheet,
  FileText,
  GripVertical,
  LayoutGrid,
  LineChart as LineChartIcon,
  List,
  Package,
  PieChart as PieChartIcon,
  Plus,
  Settings2,
  Trash2,
  Users,
  DollarSign,
} from 'lucide-react';

interface Estadisticas {
  ventasTotales: number;
  cotizacionesTotales: number;
  ordenesTrabajo: number;
  clientesActivos: number;
  tasaConversion: number;
  promedioVenta: number;
}

interface VentaMensual {
  mes: string;
  ventas: number;
  ventasCount: number;
}

interface TopCliente {
  nombre: string;
  empresa?: string;
  totalCompras: number;
  numOrdenes: number;
}

interface OrdenAPI {
  id: string;
  sedeId?: string | null;
  total: number;
  createdAt: string;
  areaResponsable?: string | null;
  sourceType?: string | null;
  assignedTo?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  vendedor?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  cliente: {
    id: string;
    nombre: string;
    empresa?: string;
  };
}

type HealthStatus = 'EXCELENTE' | 'BUENO' | 'ATENCION' | 'CRITICO';

type DecisionInsight = {
  id?: string;
  title?: string;
  summary?: string;
  priority?: 'NOW' | 'NEXT' | 'LATER';
};

type DecisionKpi = {
  label: string;
  metric?: string;
  value: number;
  unit?: string;
};

type DecisionResult = {
  target: 'company' | 'crm' | 'sales' | 'inventory' | 'purchases' | 'operations' | 'finance';
  healthScore: number;
  healthStatus: HealthStatus;
  executiveSummary: string;
  alerts: DecisionInsight[];
  opportunities: DecisionInsight[];
  risks: DecisionInsight[];
  recommendations: DecisionInsight[];
  actions: DecisionInsight[];
  kpis: DecisionKpi[];
  metadata: {
    from: string;
    to: string;
    generatedAt: string;
  };
};

type SnapshotBundle = {
  generatedAt: string;
  company: DecisionResult;
  crm: DecisionResult;
  finance: DecisionResult;
  inventory: DecisionResult;
  operations: DecisionResult;
  purchases: DecisionResult;
  sales: DecisionResult;
};

type SnapshotItem = {
  id: string;
  scope: 'EMPRESA' | 'SEDE';
  from: string;
  to: string;
  locale: string;
  engineVersion: string;
  companyHealthScore: number;
  companyHealthStatus: HealthStatus;
  executiveSummary: string;
  createdAt: string;
  snapshot?: SnapshotBundle | null;
};

type VentaReporteApi = {
  id: string;
  createdAt: string;
  sedeId?: string | null;
  total: number;
  customerKey: string;
  customerName: string;
  customerCompany?: string | null;
};

type ReporteVentas = {
  periodo: string;
  from: string;
  to: string;
  totals: {
    grossSales: number;
    returned: number;
    netSales: number;
    count: number;
    uniqueCustomers: number;
    averageSale: number;
  };
  sales: VentaReporteApi[];
};

type ReporteDocumentos = {
  periodo: string;
  from: string;
  to?: string;
  totals: { total: number; approved: number; processed: number };
  byDetected: Record<string, number>;
};

type ReporteCompras = {
  periodo: string;
  from: string;
  to: string;
  totals: {
    count: number;
    subtotalSinIva: number;
    iva: number;
    descuentoTotal: number;
    subtotalConIva: number;
    total: number;
    authorizedCount: number;
    unauthorizedCount: number;
  };
  byProveedor: Array<{ proveedorNombre: string; count: number; subtotalSinIva: number; iva: number; total: number }>;
  bySede: Array<{ sede: string; count: number; total: number }>;
};

type CotizacionResumen = {
  id: string;
  numero: string;
  createdAt: string;
  clienteNombre: string;
  total: number;
  emailSentCount: number;
  whatsappSentCount: number;
};

type ReportChannel = 'EMAIL' | 'WHATSAPP' | 'MULTICANAL' | 'DIRECTO';

type SedeOption = {
  id: string;
  nombre: string;
  codigo?: string;
};

type GroupBy = 'dia' | 'mes' | 'año';
type WidgetSource = 'ventas' | 'ordenes' | 'cotizaciones' | 'clientes' | 'compras' | 'documentos' | 'topClientes' | 'inventarioInteligencia' | 'crmInteligencia' | 'contabilidadInteligencia' | 'ventasInteligencia' | 'comprasInteligencia' | 'operacionesInteligencia' | 'snapshotsInteligencia';
type WidgetView = 'kpi' | 'list' | 'bar' | 'pie' | 'line';
type KpiMetric = 'ventasTotales' | 'ordenesTrabajo' | 'cotizacionesTotales' | 'clientesActivos';
type ExportFormat = 'excel' | 'csv' | 'pdf' | 'png' | 'jpg';
type ExportLayout = 'dashboard' | 'list';
type TemplatePageSize = 'A4' | 'LETTER' | 'LEGAL';
type TemplateOrientation = 'portrait' | 'landscape';
type TemplateDensity = 'compact' | 'comfortable';

type ReportWidget = {
  id: string;
  source: WidgetSource;
  view: WidgetView;
  title: string;
  metric?: KpiMetric;
  limit?: number;
  width?: number;
  height?: number;
};

type ReportTemplate = {
  id: string;
  name: string;
  pageSize: TemplatePageSize;
  orientation: TemplateOrientation;
  density: TemplateDensity;
  accentColor: string;
  includeMetrics: boolean;
  showHeader: boolean;
  showFooter: boolean;
};

type ExportHistoryItem = {
  id: string;
  createdAt: string;
  format: ExportFormat;
  templateName: string;
  from: string;
  to: string;
  widgetCount: number;
  includeMetrics: boolean;
  layout: ExportLayout;
};

type ReportPrefs = {
  builder?: {
    widgets?: ReportWidget[];
    templates?: ReportTemplate[];
    history?: ExportHistoryItem[];
    lastTemplateId?: string | null;
  };
};

type ReportBuilderState = {
  builder: {
    widgets: ReportWidget[];
    templates: ReportTemplate[];
    history: ExportHistoryItem[];
    lastTemplateId: string | null;
  };
};

type UiPrefsResponse = {
  success: boolean;
  data?: {
    report?: ReportPrefs;
  };
};

type WidgetCatalogItem = {
  source: WidgetSource;
  title: string;
  description: string;
  supportedViews: WidgetView[];
  accentClass: string;
};

type ListRow = {
  primary: string;
  secondary?: string;
  value?: string;
};

type ChartDatum = {
  name: string;
  value: number;
  extra?: string;
};

type ExportSectionSnapshot = {
  title: string;
  view: WidgetView;
  rows: ListRow[];
};

type DragPlacement = 'before' | 'after';

type ResizeState = {
  widgetId: string;
  pointerId: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  view: WidgetView;
};

type ExportSnapshot = {
  title: string;
  subtitle: string;
  generatedAt: string;
  from: string;
  to: string;
  layout: ExportLayout;
  includeMetrics: boolean;
  metrics: Array<{ label: string; value: string }>;
  sections: ExportSectionSnapshot[];
};

const PIE_COLORS = ['#163b65', '#e69a18', '#5ba4ff', '#94a3b8', '#22c55e', '#f97316', '#8b5cf6', '#06b6d4'];

const DEFAULT_REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'template-executive',
    name: 'Ejecutiva horizontal',
    pageSize: 'A4',
    orientation: 'landscape',
    density: 'comfortable',
    accentColor: '#163b65',
    includeMetrics: true,
    showHeader: true,
    showFooter: true,
  },
  {
    id: 'template-operativa',
    name: 'Operativa compacta',
    pageSize: 'LETTER',
    orientation: 'portrait',
    density: 'compact',
    accentColor: '#0f766e',
    includeMetrics: true,
    showHeader: true,
    showFooter: false,
  },
];

const DEFAULT_REPORT_WIDGETS: ReportWidget[] = [
  { id: 'widget-kpi-sales', source: 'ventas', view: 'kpi', title: 'Ventas totales', metric: 'ventasTotales', width: 1, height: 176 },
  { id: 'widget-kpi-orders', source: 'ordenes', view: 'kpi', title: 'Órdenes de trabajo', metric: 'ordenesTrabajo', width: 1, height: 176 },
  { id: 'widget-kpi-quotes', source: 'cotizaciones', view: 'kpi', title: 'Cotizaciones', metric: 'cotizacionesTotales', width: 1, height: 176 },
  { id: 'widget-kpi-customers', source: 'clientes', view: 'kpi', title: 'Clientes activos', metric: 'clientesActivos', width: 1, height: 176 },
];

const DEFAULT_REPORT_PREFS: ReportBuilderState = {
  builder: {
    widgets: DEFAULT_REPORT_WIDGETS,
    templates: DEFAULT_REPORT_TEMPLATES,
    history: [],
    lastTemplateId: DEFAULT_REPORT_TEMPLATES[0].id,
  },
};

const WIDGET_CATALOG: WidgetCatalogItem[] = [
  {
    source: 'ventas',
    title: 'Ventas',
    description: 'Usa ventas POS netas del periodo para barras, línea o listado comercial.',
    supportedViews: ['kpi', 'bar', 'line', 'list'],
    accentClass: 'from-emerald-500/20 to-emerald-100',
  },
  {
    source: 'ordenes',
    title: 'Órdenes de trabajo',
    description: 'Carga operativa y trazabilidad temporal de órdenes registradas.',
    supportedViews: ['kpi', 'bar', 'line', 'list'],
    accentClass: 'from-sky-500/20 to-sky-100',
  },
  {
    source: 'cotizaciones',
    title: 'Cotizaciones',
    description: 'Volumen comercial cotizado y seguimiento por fecha.',
    supportedViews: ['kpi', 'bar', 'line', 'list'],
    accentClass: 'from-violet-500/20 to-violet-100',
  },
  {
    source: 'clientes',
    title: 'Clientes',
    description: 'Resumen de clientes activos y distribución de cartera visible.',
    supportedViews: ['kpi', 'pie', 'list'],
    accentClass: 'from-orange-500/20 to-orange-100',
  },
  {
    source: 'compras',
    title: 'Compras',
    description: 'Proveedores y gasto por sede o proveedor cuando quieras incluir abastecimiento.',
    supportedViews: ['bar', 'pie', 'list'],
    accentClass: 'from-cyan-500/20 to-cyan-100',
  },
  {
    source: 'documentos',
    title: 'Documentos escaneados',
    description: 'OCR y aprobaciones disponibles solo si quieres sumar ese módulo al reporte.',
    supportedViews: ['pie', 'list'],
    accentClass: 'from-slate-500/20 to-slate-100',
  },
  {
    source: 'topClientes',
    title: 'Top clientes',
    description: 'Ranking de clientes por compra para vistas tipo lista o barras.',
    supportedViews: ['bar', 'list'],
    accentClass: 'from-amber-500/20 to-amber-100',
  },
  {
    source: 'inventarioInteligencia',
    title: 'Inventario inteligente',
    description: 'Usa KPIs, riesgos y oportunidades del motor para reflejar ruptura, sobrestock y criticidad.',
    supportedViews: ['bar', 'pie', 'list'],
    accentClass: 'from-lime-500/20 to-lime-100',
  },
  {
    source: 'crmInteligencia',
    title: 'CRM inteligente',
    description: 'Trae la lectura asistida del pipeline, seguimiento y oportunidades próximas a cierre.',
    supportedViews: ['bar', 'pie', 'list'],
    accentClass: 'from-fuchsia-500/20 to-fuchsia-100',
  },
  {
    source: 'contabilidadInteligencia',
    title: 'Contabilidad inteligente',
    description: 'Aprovecha KPIs y alertas financieras del motor para reportería ejecutiva.',
    supportedViews: ['bar', 'pie', 'list'],
    accentClass: 'from-blue-500/20 to-blue-100',
  },
  {
    source: 'ventasInteligencia',
    title: 'Ventas inteligentes',
    description: 'Usa el snapshot del motor para ver salud comercial, alertas y KPIs de ventas con lectura ejecutiva.',
    supportedViews: ['bar', 'line', 'list'],
    accentClass: 'from-emerald-600/20 to-emerald-100',
  },
  {
    source: 'comprasInteligencia',
    title: 'Compras inteligentes',
    description: 'Resume abastecimiento, riesgos y oportunidades desde el snapshot de compras del motor.',
    supportedViews: ['bar', 'pie', 'list'],
    accentClass: 'from-cyan-600/20 to-cyan-100',
  },
  {
    source: 'operacionesInteligencia',
    title: 'Operaciones inteligentes',
    description: 'Expone cuellos de botella, acciones y salud operativa consolidada por el motor empresarial.',
    supportedViews: ['bar', 'pie', 'list'],
    accentClass: 'from-indigo-600/20 to-indigo-100',
  },
  {
    source: 'snapshotsInteligencia',
    title: 'Snapshots del motor',
    description: 'Muestra el historial de snapshots ejecutivos y la evolución de la salud empresarial.',
    supportedViews: ['line', 'pie', 'list'],
    accentClass: 'from-emerald-600/20 to-teal-100',
  },
];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatDateInput(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function defaultRangeForPeriodo(p: string) {
  const now = new Date();
  let start: Date;
  if (p === 'año') {
    start = new Date(now.getFullYear(), 0, 1);
  } else if (p === 'trimestre') {
    const quarter = Math.floor(now.getMonth() / 3);
    start = new Date(now.getFullYear(), quarter * 3, 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { from: formatDateInput(start), to: formatDateInput(now) };
}

function parseLocalRange(fromStr: string, toStr: string) {
  const fromDate = fromStr ? new Date(`${fromStr}T00:00:00`) : null;
  const toDate = toStr ? new Date(`${toStr}T23:59:59.999`) : null;
  return {
    fromDate: fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null,
    toDate: toDate && !Number.isNaN(toDate.getTime()) ? toDate : null,
  };
}

function bucketKey(date: Date, gb: GroupBy) {
  if (gb === 'dia') return formatDateInput(date);
  if (gb === 'mes') return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
  return `${date.getFullYear()}`;
}

function bucketDateFromKey(key: string, gb: GroupBy) {
  if (gb === 'dia') {
    const [y, m, d] = key.split('-').map((n) => Number(n));
    return new Date(y, (m || 1) - 1, d || 1);
  }
  if (gb === 'mes') {
    const [y, m] = key.split('-').map((n) => Number(n));
    return new Date(y, (m || 1) - 1, 1);
  }
  return new Date(Number(key), 0, 1);
}

function bucketLabelFromKey(key: string, gb: GroupBy, locale: string) {
  if (gb === 'dia') return key;
  const dt = bucketDateFromKey(key, gb);
  if (gb === 'mes') return dt.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  return key;
}

function buildParams(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && String(v).trim() !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

function buildId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36).slice(-5)}`;
}

function reorderWidgets(widgets: ReportWidget[], fromId: string, toId: string, placement: DragPlacement) {
  if (!fromId || !toId || fromId === toId) return widgets;
  const next = [...widgets];
  const fromIndex = next.findIndex((widget) => widget.id === fromId);
  const toIndex = next.findIndex((widget) => widget.id === toId);
  if (fromIndex === -1 || toIndex === -1) return widgets;
  const [moved] = next.splice(fromIndex, 1);
  const targetIndex = next.findIndex((widget) => widget.id === toId);
  if (targetIndex === -1) {
    next.push(moved);
    return next;
  }
  next.splice(placement === 'after' ? targetIndex + 1 : targetIndex, 0, moved);
  return next;
}

function defaultWidgetWidth(view: WidgetView) {
  return view === 'kpi' ? 1 : 2;
}

function defaultWidgetHeight(view: WidgetView) {
  return view === 'kpi' ? 176 : 320;
}

function clampWidgetWidth(value: number | undefined, view: WidgetView) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultWidgetWidth(view);
  return Math.max(1, Math.min(4, Math.round(value)));
}

function clampWidgetHeight(value: number | undefined, view: WidgetView) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultWidgetHeight(view);
  return Math.max(140, Math.min(720, Math.round(value)));
}

function getQuoteChannel(quote: Pick<CotizacionResumen, 'emailSentCount' | 'whatsappSentCount'>): ReportChannel {
  if (quote.whatsappSentCount > 0 && quote.emailSentCount > 0) return 'MULTICANAL';
  if (quote.whatsappSentCount > 0) return 'WHATSAPP';
  if (quote.emailSentCount > 0) return 'EMAIL';
  return 'DIRECTO';
}

function reportChannelLabel(channel: ReportChannel) {
  switch (channel) {
    case 'WHATSAPP':
      return 'WhatsApp';
    case 'EMAIL':
      return 'Email';
    case 'MULTICANAL':
      return 'Multicanal';
    default:
      return 'Directo';
  }
}

function clonePrefs<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTemplate(value: unknown, fallback: ReportTemplate): ReportTemplate {
  if (!isPlainObject(value)) return fallback;
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : fallback.id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : fallback.name,
    pageSize: value.pageSize === 'LETTER' || value.pageSize === 'LEGAL' ? value.pageSize : 'A4',
    orientation: value.orientation === 'portrait' ? 'portrait' : 'landscape',
    density: value.density === 'compact' ? 'compact' : 'comfortable',
    accentColor: typeof value.accentColor === 'string' && value.accentColor.trim() ? value.accentColor : fallback.accentColor,
    includeMetrics: value.includeMetrics !== false,
    showHeader: value.showHeader !== false,
    showFooter: value.showFooter !== false,
  };
}

function normalizeWidget(value: unknown, fallback: ReportWidget): ReportWidget {
  if (!isPlainObject(value)) return fallback;
  const view = value.view === 'list' || value.view === 'bar' || value.view === 'pie' || value.view === 'line' ? value.view : 'kpi';
  const source = value.source === 'ordenes' || value.source === 'cotizaciones' || value.source === 'clientes' || value.source === 'compras' || value.source === 'documentos' || value.source === 'topClientes' || value.source === 'inventarioInteligencia' || value.source === 'crmInteligencia' || value.source === 'contabilidadInteligencia' || value.source === 'ventasInteligencia' || value.source === 'comprasInteligencia' || value.source === 'operacionesInteligencia' || value.source === 'snapshotsInteligencia' ? value.source : 'ventas';
  const metric = value.metric === 'ordenesTrabajo' || value.metric === 'cotizacionesTotales' || value.metric === 'clientesActivos' ? value.metric : value.metric === 'ventasTotales' ? 'ventasTotales' : fallback.metric;
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : fallback.id,
    source,
    view,
    title: typeof value.title === 'string' && value.title.trim() ? value.title : fallback.title,
    metric,
    limit: typeof value.limit === 'number' && Number.isFinite(value.limit) ? Math.max(1, Math.min(20, Math.floor(value.limit))) : fallback.limit,
    width: clampWidgetWidth(typeof value.width === 'number' ? value.width : fallback.width, view),
    height: clampWidgetHeight(typeof value.height === 'number' ? value.height : fallback.height, view),
  };
}

function normalizeHistoryItem(value: unknown): ExportHistoryItem | null {
  if (!isPlainObject(value)) return null;
  const format = value.format === 'csv' || value.format === 'pdf' || value.format === 'png' || value.format === 'jpg' ? value.format : value.format === 'excel' ? 'excel' : null;
  if (!format) return null;
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : buildId('history'),
    createdAt: typeof value.createdAt === 'string' && value.createdAt.trim() ? value.createdAt : new Date().toISOString(),
    format,
    templateName: typeof value.templateName === 'string' && value.templateName.trim() ? value.templateName : 'Plantilla',
    from: typeof value.from === 'string' ? value.from : '',
    to: typeof value.to === 'string' ? value.to : '',
    widgetCount: typeof value.widgetCount === 'number' && Number.isFinite(value.widgetCount) ? value.widgetCount : 0,
    includeMetrics: value.includeMetrics !== false,
    layout: value.layout === 'list' ? 'list' : 'dashboard',
  };
}

function normalizeReportPrefs(value: unknown): ReportBuilderState {
  if (!isPlainObject(value) || !isPlainObject(value.builder)) {
    return clonePrefs(DEFAULT_REPORT_PREFS);
  }

  const builder = value.builder;
  const templatesRaw = Array.isArray(builder.templates) ? builder.templates : [];
  const widgetsRaw = Array.isArray(builder.widgets) ? builder.widgets : [];
  const historyRaw = Array.isArray(builder.history) ? builder.history : [];

  const templates = (templatesRaw.length ? templatesRaw : DEFAULT_REPORT_TEMPLATES).map((item, index) =>
    normalizeTemplate(item, DEFAULT_REPORT_TEMPLATES[index] ?? DEFAULT_REPORT_TEMPLATES[0])
  );
  const widgets = (widgetsRaw.length ? widgetsRaw : DEFAULT_REPORT_WIDGETS).map((item, index) =>
    normalizeWidget(item, DEFAULT_REPORT_WIDGETS[index] ?? DEFAULT_REPORT_WIDGETS[0])
  );
  const history = historyRaw
    .map((item) => normalizeHistoryItem(item))
    .filter((item): item is ExportHistoryItem => Boolean(item))
    .slice(0, 20);

  return {
    builder: {
      widgets,
      templates,
      history,
      lastTemplateId: typeof builder.lastTemplateId === 'string' && builder.lastTemplateId.trim()
        ? builder.lastTemplateId
        : templates[0]?.id ?? DEFAULT_REPORT_TEMPLATES[0].id,
    },
  };
}

function metricLabel(metric: KpiMetric) {
  switch (metric) {
    case 'ordenesTrabajo':
      return 'Órdenes de trabajo';
    case 'cotizacionesTotales':
      return 'Cotizaciones';
    case 'clientesActivos':
      return 'Clientes activos';
    default:
      return 'Ventas totales';
  }
}

function viewLabel(view: WidgetView) {
  switch (view) {
    case 'list':
      return 'Lista';
    case 'bar':
      return 'Barras';
    case 'pie':
      return 'Circular';
    case 'line':
      return 'Línea';
    default:
      return 'KPI';
  }
}

function healthStatusLabel(status: HealthStatus) {
  switch (status) {
    case 'EXCELENTE':
      return 'Excelente';
    case 'BUENO':
      return 'Bueno';
    case 'ATENCION':
      return 'Atención';
    default:
      return 'Crítico';
  }
}

function emptyDecisionResult(target: DecisionResult['target']): DecisionResult {
  return {
    target,
    healthScore: 0,
    healthStatus: 'CRITICO',
    executiveSummary: '',
    alerts: [],
    opportunities: [],
    risks: [],
    recommendations: [],
    actions: [],
    kpis: [],
    metadata: { from: '', to: '', generatedAt: '' },
  };
}

function normalizeDecisionResult(value: unknown): DecisionResult | null {
  if (!isPlainObject(value)) return null;
  const target = value.target === 'crm' || value.target === 'sales' || value.target === 'inventory' || value.target === 'purchases' || value.target === 'operations' || value.target === 'finance' ? value.target : 'company';
  return {
    target,
    healthScore: typeof value.healthScore === 'number' && Number.isFinite(value.healthScore) ? value.healthScore : 0,
    healthStatus: value.healthStatus === 'EXCELENTE' || value.healthStatus === 'BUENO' || value.healthStatus === 'ATENCION' ? value.healthStatus : 'CRITICO',
    executiveSummary: typeof value.executiveSummary === 'string' ? value.executiveSummary : '',
    alerts: Array.isArray(value.alerts) ? value.alerts as DecisionInsight[] : [],
    opportunities: Array.isArray(value.opportunities) ? value.opportunities as DecisionInsight[] : [],
    risks: Array.isArray(value.risks) ? value.risks as DecisionInsight[] : [],
    recommendations: Array.isArray(value.recommendations) ? value.recommendations as DecisionInsight[] : [],
    actions: Array.isArray(value.actions) ? value.actions as DecisionInsight[] : [],
    kpis: Array.isArray(value.kpis) ? value.kpis as DecisionKpi[] : [],
    metadata: isPlainObject(value.metadata)
      ? {
          from: typeof value.metadata.from === 'string' ? value.metadata.from : '',
          to: typeof value.metadata.to === 'string' ? value.metadata.to : '',
          generatedAt: typeof value.metadata.generatedAt === 'string' ? value.metadata.generatedAt : '',
        }
      : { from: '', to: '', generatedAt: '' },
  };
}

function normalizeSnapshotItem(value: unknown): SnapshotItem | null {
  if (!isPlainObject(value)) return null;
  return {
    id: typeof value.id === 'string' ? value.id : buildId('snapshot'),
    scope: value.scope === 'SEDE' ? 'SEDE' : 'EMPRESA',
    from: typeof value.from === 'string' ? value.from : '',
    to: typeof value.to === 'string' ? value.to : '',
    locale: typeof value.locale === 'string' ? value.locale : 'es-CO',
    engineVersion: typeof value.engineVersion === 'string' ? value.engineVersion : 'v1',
    companyHealthScore: typeof value.companyHealthScore === 'number' && Number.isFinite(value.companyHealthScore) ? value.companyHealthScore : 0,
    companyHealthStatus: value.companyHealthStatus === 'EXCELENTE' || value.companyHealthStatus === 'BUENO' || value.companyHealthStatus === 'ATENCION' ? value.companyHealthStatus : 'CRITICO',
    executiveSummary: typeof value.executiveSummary === 'string' ? value.executiveSummary : '',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    snapshot: isPlainObject(value.snapshot)
      ? {
          generatedAt: typeof value.snapshot.generatedAt === 'string' ? value.snapshot.generatedAt : '',
          company: normalizeDecisionResult(value.snapshot.company) ?? emptyDecisionResult('company'),
          crm: normalizeDecisionResult(value.snapshot.crm) ?? emptyDecisionResult('crm'),
          finance: normalizeDecisionResult(value.snapshot.finance) ?? emptyDecisionResult('finance'),
          inventory: normalizeDecisionResult(value.snapshot.inventory) ?? emptyDecisionResult('inventory'),
          operations: normalizeDecisionResult(value.snapshot.operations) ?? emptyDecisionResult('operations'),
          purchases: normalizeDecisionResult(value.snapshot.purchases) ?? emptyDecisionResult('purchases'),
          sales: normalizeDecisionResult(value.snapshot.sales) ?? emptyDecisionResult('sales'),
        }
      : null,
  };
}

function formatDateTime(value: string, locale: string) {
  try {
    return new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
}

function buildCsv(snapshot: ExportSnapshot) {
  const rows: string[][] = [
    ['Reporte', snapshot.title],
    ['Periodo', `${snapshot.from} a ${snapshot.to}`],
    ['Generado', snapshot.generatedAt],
    [],
  ];

  if (snapshot.includeMetrics) {
    rows.push(['Métrica', 'Valor']);
    snapshot.metrics.forEach((metric) => rows.push([metric.label, metric.value]));
    rows.push([]);
  }

  snapshot.sections.forEach((section) => {
    rows.push([section.title, section.view]);
    rows.push(['Título', 'Detalle', 'Valor']);
    section.rows.forEach((row) => rows.push([row.primary, row.secondary ?? '', row.value ?? '']));
    rows.push([]);
  });

  return rows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

function buildExcelHtml(snapshot: ExportSnapshot) {
  const metricsHtml = snapshot.includeMetrics
    ? `
      <h2>Métricas base</h2>
      <table>
        <thead><tr><th>Métrica</th><th>Valor</th></tr></thead>
        <tbody>
          ${snapshot.metrics.map((metric) => `<tr><td>${escapeHtml(metric.label)}</td><td>${escapeHtml(metric.value)}</td></tr>`).join('')}
        </tbody>
      </table>
    `
    : '';

  const sectionsHtml = snapshot.sections.map((section) => `
    <h2>${escapeHtml(section.title)} <small>(${escapeHtml(viewLabel(section.view))})</small></h2>
    <table>
      <thead><tr><th>Título</th><th>Detalle</th><th>Valor</th></tr></thead>
      <tbody>
        ${section.rows.map((row) => `<tr><td>${escapeHtml(row.primary)}</td><td>${escapeHtml(row.secondary ?? '')}</td><td>${escapeHtml(row.value ?? '')}</td></tr>`).join('')}
      </tbody>
    </table>
  `).join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Segoe UI, Arial, sans-serif; padding: 24px; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background: #e2e8f0; }
          h1, h2 { margin: 0 0 12px; }
          p { margin: 0 0 16px; color: #475569; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(snapshot.title)}</h1>
        <p>${escapeHtml(snapshot.subtitle)}</p>
        <p>Periodo: ${escapeHtml(snapshot.from)} a ${escapeHtml(snapshot.to)}. Generado: ${escapeHtml(snapshot.generatedAt)}</p>
        ${metricsHtml}
        ${sectionsHtml}
      </body>
    </html>
  `;
}

function buildPrintHtml(snapshot: ExportSnapshot, template: ReportTemplate) {
  const metricsHtml = snapshot.includeMetrics
    ? `
      <section class="metrics">
        ${snapshot.metrics.map((metric) => `<article class="metric"><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(metric.value)}</strong></article>`).join('')}
      </section>
    `
    : '';

  const sectionsHtml = snapshot.sections.map((section) => `
    <section class="block">
      <header>
        <h2>${escapeHtml(section.title)}</h2>
        <span>${escapeHtml(viewLabel(section.view))}</span>
      </header>
      <div class="rows">
        ${section.rows.map((row) => `
          <div class="row">
            <div>
              <strong>${escapeHtml(row.primary)}</strong>
              ${row.secondary ? `<p>${escapeHtml(row.secondary)}</p>` : ''}
            </div>
            ${row.value ? `<span>${escapeHtml(row.value)}</span>` : ''}
          </div>`).join('')}
      </div>
    </section>
  `).join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(snapshot.title)}</title>
        <style>
          @page { size: ${template.pageSize} ${template.orientation}; margin: 18mm; }
          body { font-family: Segoe UI, Arial, sans-serif; color: #0f172a; }
          .shell { display: flex; flex-direction: column; gap: 18px; }
          .header { border-bottom: 3px solid ${template.accentColor}; padding-bottom: 12px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 6px 0 0; color: #475569; }
          .metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .metric { border: 1px solid #dbeafe; border-radius: 14px; padding: 12px; background: #f8fafc; }
          .metric span { display: block; color: #64748b; font-size: 12px; }
          .metric strong { display: block; margin-top: 4px; font-size: 20px; }
          .block { border: 1px solid #e2e8f0; border-radius: 18px; padding: 14px; break-inside: avoid; margin-bottom: 12px; }
          .block header { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 10px; }
          .block h2 { margin: 0; font-size: 18px; }
          .block header span { color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
          .row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid #f1f5f9; }
          .row:first-child { border-top: 0; }
          .row p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
          .footer { margin-top: 10px; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="shell">
          ${template.showHeader ? `<div class="header"><h1>${escapeHtml(snapshot.title)}</h1><p>${escapeHtml(snapshot.subtitle)}</p><p>Periodo: ${escapeHtml(snapshot.from)} a ${escapeHtml(snapshot.to)} · Generado: ${escapeHtml(snapshot.generatedAt)}</p></div>` : ''}
          ${metricsHtml}
          ${sectionsHtml}
          ${template.showFooter ? `<div class="footer">Plantilla: ${escapeHtml(template.name)} · Layout: ${escapeHtml(snapshot.layout)}</div>` : ''}
        </div>
      </body>
    </html>
  `;
}

async function buildImageBlob(snapshot: ExportSnapshot, template: ReportTemplate, format: 'png' | 'jpg') {
  const landscape = template.orientation === 'landscape';
  const width = landscape ? 1600 : 1200;
  const height = landscape ? 1000 : 1500;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No fue posible iniciar el canvas.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = template.accentColor;
  ctx.fillRect(0, 0, width, 22);

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 42px Segoe UI';
  ctx.fillText(snapshot.title, 60, 92);

  ctx.fillStyle = '#475569';
  ctx.font = '24px Segoe UI';
  ctx.fillText(snapshot.subtitle, 60, 132);
  ctx.fillText(`Periodo: ${snapshot.from} a ${snapshot.to}`, 60, 168);

  let cursorY = 220;

  if (snapshot.includeMetrics) {
    const metricWidth = (width - 160) / 2;
    const metricHeight = 110;
    snapshot.metrics.slice(0, 4).forEach((metric, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 60 + col * (metricWidth + 40);
      const y = cursorY + row * (metricHeight + 20);
      ctx.strokeStyle = '#dbeafe';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, metricWidth, metricHeight);
      ctx.fillStyle = '#64748b';
      ctx.font = '20px Segoe UI';
      ctx.fillText(metric.label, x + 20, y + 34);
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 30px Segoe UI';
      ctx.fillText(metric.value, x + 20, y + 78);
    });
    cursorY += 260;
  }

  const sections = snapshot.sections.slice(0, 6);
  sections.forEach((section) => {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(60, cursorY, width - 120, 120);
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 24px Segoe UI';
    ctx.fillText(section.title, 84, cursorY + 34);
    ctx.fillStyle = '#64748b';
    ctx.font = '18px Segoe UI';
    ctx.fillText(viewLabel(section.view), width - 220, cursorY + 34);
    section.rows.slice(0, 3).forEach((row, index) => {
      const top = cursorY + 62 + index * 18;
      ctx.fillStyle = '#334155';
      ctx.font = '16px Segoe UI';
      ctx.fillText(`• ${row.primary}`, 84, top);
      if (row.value) {
        ctx.textAlign = 'right';
        ctx.fillText(row.value, width - 84, top);
        ctx.textAlign = 'left';
      }
    });
    cursorY += 144;
  });

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.95));
  if (!blob) throw new Error('No se pudo generar la imagen del reporte.');
  return blob;
}

export default function ReportesPage() {
  const { t, language } = useI18n();
  const locale = language === 'en' ? 'en-US' : 'es-CO';

  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('mes');
  const [groupByDraft, setGroupByDraft] = useState<GroupBy>('mes');
  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('mes');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedSedeIdDraft, setSelectedSedeIdDraft] = useState('');
  const [selectedSedeId, setSelectedSedeId] = useState('');
  const [responsibleFilterDraft, setResponsibleFilterDraft] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('');
  const [channelFilterDraft, setChannelFilterDraft] = useState<ReportChannel | ''>('');
  const [channelFilter, setChannelFilter] = useState<ReportChannel | ''>('');

  const [prefsLoading, setPrefsLoading] = useState(true);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [widgetSettingsId, setWidgetSettingsId] = useState<string | null>(null);
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);
  const [dragOverPlacement, setDragOverPlacement] = useState<DragPlacement>('before');
  const [layoutDraggingWidgetId, setLayoutDraggingWidgetId] = useState<string | null>(null);
  const [layoutDragOverWidgetId, setLayoutDragOverWidgetId] = useState<string | null>(null);
  const [layoutDragOverPlacement, setLayoutDragOverPlacement] = useState<DragPlacement>('before');
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);

  const [reportPrefs, setReportPrefs] = useState<ReportBuilderState>(clonePrefs(DEFAULT_REPORT_PREFS));
  const [reportPrefsDraft, setReportPrefsDraft] = useState<ReportBuilderState>(clonePrefs(DEFAULT_REPORT_PREFS));

  const [estadisticas, setEstadisticas] = useState<Estadisticas>({
    ventasTotales: 0,
    cotizacionesTotales: 0,
    ordenesTrabajo: 0,
    clientesActivos: 0,
    tasaConversion: 0,
    promedioVenta: 0,
  });
  const [ventasMensuales, setVentasMensuales] = useState<VentaMensual[]>([]);
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [docs, setDocs] = useState<ReporteDocumentos | null>(null);
  const [compras, setCompras] = useState<ReporteCompras | null>(null);
  const [ventasReport, setVentasReport] = useState<ReporteVentas | null>(null);
  const [ordenesFiltradas, setOrdenesFiltradas] = useState<OrdenAPI[]>([]);
  const [cotizacionesFiltradas, setCotizacionesFiltradas] = useState<CotizacionResumen[]>([]);
  const [crmInsights, setCrmInsights] = useState<DecisionResult | null>(null);
  const [inventoryInsights, setInventoryInsights] = useState<DecisionResult | null>(null);
  const [financeInsights, setFinanceInsights] = useState<DecisionResult | null>(null);
  const [snapshotHistory, setSnapshotHistory] = useState<SnapshotItem[]>([]);
  const [sedes, setSedes] = useState<SedeOption[]>([]);

  const [listPages, setListPages] = useState<Record<string, number>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState(DEFAULT_REPORT_PREFS.builder.lastTemplateId ?? DEFAULT_REPORT_TEMPLATES[0].id);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [exportLayout, setExportLayout] = useState<ExportLayout>('dashboard');
  const [exportIncludeMetrics, setExportIncludeMetrics] = useState(true);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState<string[]>(DEFAULT_REPORT_WIDGETS.map((widget) => widget.id));

  const exportPreviewRef = useRef<HTMLDivElement | null>(null);
  const reportPrefsRef = useRef<ReportBuilderState>(clonePrefs(DEFAULT_REPORT_PREFS));
  const persistWidgetsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedSedeOption = useMemo(() => sedes.find((sede) => sede.id === selectedSedeId) ?? null, [sedes, selectedSedeId]);
  const activeWidgetSettings = useMemo(() => reportPrefs.builder.widgets.find((widget) => widget.id === widgetSettingsId) ?? null, [reportPrefs.builder.widgets, widgetSettingsId]);

  useEffect(() => {
    reportPrefsRef.current = reportPrefs;
  }, [reportPrefs]);

  useEffect(() => {
    const next = defaultRangeForPeriodo(periodo);
    setFromDraft(next.from);
    setToDraft(next.to);
    setFrom(next.from);
    setTo(next.to);
  }, [periodo]);

  useEffect(() => {
    let cancelled = false;
    async function loadPrefs() {
      try {
        setPrefsLoading(true);
        const res = await fetch('/api/ui-preferences', { cache: 'no-store' });
        const json: UiPrefsResponse = await res.json().catch(() => ({ success: false }));
        if (!cancelled) {
          const next = normalizeReportPrefs(json.data?.report);
          setReportPrefs(next);
          setReportPrefsDraft(clonePrefs(next));
          setSelectedTemplateId(next.builder.lastTemplateId ?? next.builder.templates[0]?.id ?? DEFAULT_REPORT_TEMPLATES[0].id);
          setExportIncludeMetrics(next.builder.templates.find((template) => template.id === next.builder.lastTemplateId)?.includeMetrics ?? true);
        }
      } finally {
        if (!cancelled) setPrefsLoading(false);
      }
    }
    void loadPrefs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedWidgetIds(reportPrefs.builder.widgets.map((widget) => widget.id));
  }, [reportPrefs]);

  useEffect(() => {
    let cancelled = false;

    async function loadSedes() {
      const res = await fetch('/api/crm/sedes', { cache: 'no-store' }).catch(() => null);
      const json = await res?.json().catch(() => null);
      if (!cancelled && json?.success && Array.isArray(json.data)) {
        setSedes(
          json.data
            .filter((item: unknown): item is SedeOption => isPlainObject(item) && typeof item.id === 'string' && typeof item.nombre === 'string')
            .map((item: SedeOption) => ({ id: item.id, nombre: item.nombre, codigo: typeof item.codigo === 'string' ? item.codigo : undefined }))
        );
      }
    }

    void loadSedes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!from || !to) return;

    const controller = new AbortController();
    let cancelled = false;

    async function cargarReportes() {
      try {
        setLoading(true);

        const { fromDate, toDate } = parseLocalRange(from, to);

        const [resCotizaciones, resOrdenes, resVentas, resDocs, resCompras, resCrm, resInventory, resFinance, resSnapshots] = await Promise.all([
          fetch(`/api/cotizaciones${buildParams({ sedeId: selectedSedeId || undefined })}`, { signal: controller.signal }),
          fetch(`/api/ordenes${buildParams({ sedeId: selectedSedeId || undefined })}`, { signal: controller.signal }),
          fetch(`/api/reportes/ventas${buildParams({ periodo, from, to, sedeId: selectedSedeId || undefined })}`, { signal: controller.signal }),
          fetch(`/api/reportes/documentos${buildParams({ periodo, from, to })}`, { signal: controller.signal }),
          fetch(`/api/reportes/compras${buildParams({ periodo, from, to, sede: selectedSedeOption?.nombre || undefined })}`, { signal: controller.signal }),
          fetch(`/api/decision-engine/crm${buildParams({ from, to, locale, sedeId: selectedSedeId || undefined })}`, { signal: controller.signal }).catch(() => null),
          fetch(`/api/decision-engine/inventory${buildParams({ from, to, locale, sedeId: selectedSedeId || undefined })}`, { signal: controller.signal }).catch(() => null),
          fetch(`/api/decision-engine/finance${buildParams({ from, to, locale, sedeId: selectedSedeId || undefined })}`, { signal: controller.signal }).catch(() => null),
          fetch(`/api/decision-engine/snapshots${buildParams({ limit: '8', includeBundle: 'true', sedeId: selectedSedeId || undefined })}`, { signal: controller.signal }).catch(() => null),
        ]);

        const [dataCotizaciones, dataOrdenes, dataVentas, dataDocs, dataCompras, dataCrm, dataInventory, dataFinance, dataSnapshots] = await Promise.all([
          resCotizaciones.json().catch(() => ({ success: false })),
          resOrdenes.json().catch(() => ({ success: false })),
          resVentas.json().catch(() => null),
          resDocs.json().catch(() => null),
          resCompras.json().catch(() => null),
          resCrm?.json().catch(() => null) ?? null,
          resInventory?.json().catch(() => null) ?? null,
          resFinance?.json().catch(() => null) ?? null,
          resSnapshots?.json().catch(() => null) ?? null,
        ]);

        const cotizacionesRaw: unknown[] = dataCotizaciones.success && Array.isArray(dataCotizaciones.data) ? dataCotizaciones.data : [];
        const ordenes: OrdenAPI[] = dataOrdenes.success && Array.isArray(dataOrdenes.data) ? dataOrdenes.data : [];
        const ventas = dataVentas?.success ? (dataVentas.data as ReporteVentas) : null;
        const ventasItems = ventas?.sales ?? [];

        const ordenesNext = ordenes.filter((o) => {
          const dt = new Date(o.createdAt);
          if (fromDate && dt < fromDate) return false;
          if (toDate && dt > toDate) return false;
          return true;
        });

        const cotizacionesNext = cotizacionesRaw
          .filter((value: unknown): value is Record<string, unknown> => isPlainObject(value))
          .map((cotizacion: Record<string, unknown>, index: number) => ({
            id: typeof cotizacion.id === 'string' ? cotizacion.id : `quote-${index}`,
            numero: typeof cotizacion.numero === 'string' && cotizacion.numero.trim() ? cotizacion.numero : `Cotización ${index + 1}`,
            createdAt: typeof cotizacion.createdAt === 'string' ? cotizacion.createdAt : new Date().toISOString(),
            clienteNombre: isPlainObject(cotizacion.cliente) && typeof cotizacion.cliente.nombre === 'string'
              ? cotizacion.cliente.nombre
              : 'Cliente sin nombre',
            total: typeof cotizacion.total === 'number' && Number.isFinite(cotizacion.total) ? cotizacion.total : 0,
            emailSentCount: typeof cotizacion.emailSentCount === 'number' && Number.isFinite(cotizacion.emailSentCount) ? cotizacion.emailSentCount : 0,
            whatsappSentCount: typeof cotizacion.whatsappSentCount === 'number' && Number.isFinite(cotizacion.whatsappSentCount) ? cotizacion.whatsappSentCount : 0,
          }))
          .filter((c: CotizacionResumen) => {
            const dt = new Date(c.createdAt);
            if (fromDate && dt < fromDate) return false;
            if (toDate && dt > toDate) return false;
            return true;
          });

        const ventasTotales = ventas?.totals.netSales ?? 0;
        const tasaConversion = cotizacionesNext.length > 0 ? (ordenesNext.length / cotizacionesNext.length) * 100 : 0;
        const promedioVenta = ventas?.totals.averageSale ?? 0;
        const clientesActivos = new Set([
          ...ordenesNext.map((orden) => orden.cliente.id),
          ...ventasItems.map((sale) => sale.customerKey),
        ]).size;

        const ventasPorBucket: Record<string, { ventas: number; ordenes: number }> = {};
        const rangeStart = fromDate ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const rangeEnd = toDate ?? new Date();
        const cursor = new Date(rangeStart);
        while (cursor <= rangeEnd) {
          const key = bucketKey(cursor, groupBy);
          ventasPorBucket[key] = ventasPorBucket[key] ?? { ventas: 0, ordenes: 0 };
          if (groupBy === 'dia') cursor.setDate(cursor.getDate() + 1);
          else if (groupBy === 'mes') cursor.setMonth(cursor.getMonth() + 1);
          else cursor.setFullYear(cursor.getFullYear() + 1);
        }

        ventasItems.forEach((venta) => {
          const fecha = new Date(venta.createdAt);
          const key = bucketKey(fecha, groupBy);
          if (!ventasPorBucket[key]) ventasPorBucket[key] = { ventas: 0, ordenes: 0 };
          ventasPorBucket[key].ventas += venta.total;
          ventasPorBucket[key].ordenes += 1;
        });

        const ventasArray = Object.entries(ventasPorBucket)
          .map(([key, data]) => ({
            key,
            date: bucketDateFromKey(key, groupBy),
            mes: bucketLabelFromKey(key, groupBy, locale),
            ventas: data.ventas,
            ventasCount: data.ordenes,
          }))
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map(({ mes, ventas, ventasCount }) => ({ mes, ventas, ventasCount }));

        const clientesMap: Record<string, { nombre: string; empresa?: string; totalCompras: number; numOrdenes: number }> = {};
        ventasItems.forEach((venta) => {
          const clienteId = venta.customerKey;
          if (!clientesMap[clienteId]) {
            clientesMap[clienteId] = {
              nombre: venta.customerName,
              empresa: venta.customerCompany ?? undefined,
              totalCompras: 0,
              numOrdenes: 0,
            };
          }
          clientesMap[clienteId].totalCompras += venta.total;
          clientesMap[clienteId].numOrdenes += 1;
        });

        const topClientesArray = Object.values(clientesMap).sort((a, b) => b.totalCompras - a.totalCompras).slice(0, 8);
        const crmResult = dataCrm?.success ? normalizeDecisionResult(dataCrm.data) : null;
        const inventoryResult = dataInventory?.success ? normalizeDecisionResult(dataInventory.data) : null;
        const financeResult = dataFinance?.success ? normalizeDecisionResult(dataFinance.data) : null;
        const snapshots = Array.isArray(dataSnapshots?.data)
          ? dataSnapshots.data.map((item: unknown) => normalizeSnapshotItem(item)).filter((item: SnapshotItem | null): item is SnapshotItem => Boolean(item))
          : [];

        if (!cancelled) {
          setEstadisticas({
            ventasTotales,
            cotizacionesTotales: cotizacionesNext.length,
            ordenesTrabajo: ordenesNext.length,
            clientesActivos,
            tasaConversion,
            promedioVenta,
          });
          setVentasMensuales(ventasArray);
          setTopClientes(topClientesArray);
          setDocs(dataDocs?.success ? (dataDocs.data as ReporteDocumentos) : null);
          setCompras(dataCompras?.success ? (dataCompras.data as ReporteCompras) : null);
          setVentasReport(ventas);
          setOrdenesFiltradas(ordenesNext);
          setCotizacionesFiltradas(cotizacionesNext);
          setCrmInsights(crmResult);
          setInventoryInsights(inventoryResult);
          setFinanceInsights(financeResult);
          setSnapshotHistory(snapshots);
        }
      } catch (error) {
        if ((error as { name?: string })?.name !== 'AbortError') {
          console.error('Error al cargar reportes:', error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void cargarReportes();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [periodo, from, to, groupBy, locale, selectedSedeId, selectedSedeOption?.nombre]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const activeTemplate = useMemo(() => {
    return reportPrefs.builder.templates.find((template) => template.id === selectedTemplateId)
      ?? reportPrefs.builder.templates[0]
      ?? DEFAULT_REPORT_TEMPLATES[0];
  }, [reportPrefs.builder.templates, selectedTemplateId]);

  const responsibleOptions = useMemo(() => {
    const entries = new Map<string, string>();

    ordenesFiltradas.forEach((orden) => {
      if (orden.assignedTo?.id) {
        entries.set(`assigned:${orden.assignedTo.id}`, orden.assignedTo.name || orden.assignedTo.email || 'Asignado');
      }
      if (orden.vendedor?.id) {
        entries.set(`seller:${orden.vendedor.id}`, orden.vendedor.name || orden.vendedor.email || 'Vendedor');
      }
      if (orden.areaResponsable?.trim()) {
        entries.set(`area:${orden.areaResponsable.trim()}`, orden.areaResponsable.trim());
      }
    });

    return Array.from(entries.entries()).map(([value, label]) => ({ value, label }));
  }, [ordenesFiltradas]);

  const availableChannelOptions = useMemo(() => {
    const entries = new Set<ReportChannel>();
    cotizacionesFiltradas.forEach((quote) => {
      entries.add(getQuoteChannel(quote));
    });
    return Array.from(entries.values());
  }, [cotizacionesFiltradas]);

  const activeResponsibleLabel = useMemo(() => {
    return responsibleOptions.find((option) => option.value === responsibleFilter)?.label || '';
  }, [responsibleFilter, responsibleOptions]);

  const filteredOrders = useMemo(() => {
    if (!responsibleFilter) return ordenesFiltradas;

    return ordenesFiltradas.filter((orden) => {
      if (responsibleFilter.startsWith('assigned:')) {
        return orden.assignedTo?.id === responsibleFilter.slice('assigned:'.length);
      }
      if (responsibleFilter.startsWith('seller:')) {
        return orden.vendedor?.id === responsibleFilter.slice('seller:'.length);
      }
      if (responsibleFilter.startsWith('area:')) {
        return (orden.areaResponsable || '').trim() === responsibleFilter.slice('area:'.length);
      }
      return true;
    });
  }, [ordenesFiltradas, responsibleFilter]);

  const filteredQuotes = useMemo(() => {
    if (!channelFilter) return cotizacionesFiltradas;
    return cotizacionesFiltradas.filter((quote) => getQuoteChannel(quote) === channelFilter);
  }, [channelFilter, cotizacionesFiltradas]);

  const reportStats = useMemo(() => {
    const clientesActivos = new Set([
      ...filteredOrders.map((orden) => orden.cliente.id),
      ...(ventasReport?.sales ?? []).map((sale) => sale.customerKey),
    ]).size;

    return {
      ...estadisticas,
      ordenesTrabajo: filteredOrders.length,
      cotizacionesTotales: filteredQuotes.length,
      clientesActivos,
      tasaConversion: filteredQuotes.length > 0 ? (filteredOrders.length / filteredQuotes.length) * 100 : 0,
    };
  }, [estadisticas, filteredOrders, filteredQuotes, ventasReport]);

  const ordersNoun = (count: number) => (count === 1 ? 'orden' : 'órdenes');

  const orderTimeline = useMemo(() => {
    const { fromDate, toDate } = parseLocalRange(from, to);
    if (!fromDate || !toDate) return [] as ChartDatum[];

    const buckets: Record<string, number> = {};
    const cursor = new Date(fromDate);
    while (cursor <= toDate) {
      const key = bucketKey(cursor, groupBy);
      buckets[key] = buckets[key] ?? 0;
      if (groupBy === 'dia') cursor.setDate(cursor.getDate() + 1);
      else if (groupBy === 'mes') cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setFullYear(cursor.getFullYear() + 1);
    }

    filteredOrders.forEach((orden) => {
      const dt = new Date(orden.createdAt);
      const key = bucketKey(dt, groupBy);
      buckets[key] = (buckets[key] ?? 0) + 1;
    });

    return Object.entries(buckets)
      .map(([key, value]) => ({
        key,
        date: bucketDateFromKey(key, groupBy),
        name: bucketLabelFromKey(key, groupBy, locale),
        value,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(({ name, value }) => ({ name, value }));
  }, [filteredOrders, from, to, groupBy, locale]);

  const quotesTimeline = useMemo(() => {
    const { fromDate, toDate } = parseLocalRange(from, to);
    if (!fromDate || !toDate) return [] as ChartDatum[];

    const buckets: Record<string, number> = {};
    const cursor = new Date(fromDate);
    while (cursor <= toDate) {
      const key = bucketKey(cursor, groupBy);
      buckets[key] = buckets[key] ?? 0;
      if (groupBy === 'dia') cursor.setDate(cursor.getDate() + 1);
      else if (groupBy === 'mes') cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setFullYear(cursor.getFullYear() + 1);
    }

    filteredQuotes.forEach((cotizacion) => {
      const dt = new Date(cotizacion.createdAt);
      const key = bucketKey(dt, groupBy);
      buckets[key] = (buckets[key] ?? 0) + 1;
    });

    return Object.entries(buckets)
      .map(([key, value]) => ({
        key,
        date: bucketDateFromKey(key, groupBy),
        name: bucketLabelFromKey(key, groupBy, locale),
        value,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map(({ name, value }) => ({ name, value }));
  }, [filteredQuotes, from, to, groupBy, locale]);

  const salesListRows = useMemo<ListRow[]>(() => {
    return (ventasReport?.sales ?? []).slice(0, 50).map((sale) => ({
      primary: sale.customerName,
      secondary: formatDateTime(sale.createdAt, locale),
      value: formatCurrency(sale.total),
    }));
  }, [ventasReport, locale]);

  const ordersListRows = useMemo<ListRow[]>(() => {
    return filteredOrders.map((orden) => ({
      primary: orden.cliente.nombre,
      secondary: [formatDateTime(orden.createdAt, locale), orden.assignedTo?.name || orden.vendedor?.name || orden.areaResponsable || 'Sin responsable'].join(' · '),
      value: formatCurrency(orden.total),
    }));
  }, [filteredOrders, locale]);

  const quotesListRows = useMemo<ListRow[]>(() => {
    return filteredQuotes.map((quote) => ({
      primary: quote.numero,
      secondary: `${quote.clienteNombre} · ${reportChannelLabel(getQuoteChannel(quote))} · ${formatDateTime(quote.createdAt, locale)}`,
      value: formatCurrency(quote.total),
    }));
  }, [filteredQuotes, locale]);

  const customerPieData = useMemo<ChartDatum[]>(() => {
    return topClientes.slice(0, 5).map((cliente) => ({
      name: cliente.empresa || cliente.nombre,
      value: cliente.totalCompras,
      extra: `${cliente.numOrdenes} ${ordersNoun(cliente.numOrdenes)}`,
    }));
  }, [topClientes]);

  const customerListRows = useMemo<ListRow[]>(() => {
    return topClientes.map((cliente) => ({
      primary: cliente.nombre,
      secondary: cliente.empresa || `${cliente.numOrdenes} ${ordersNoun(cliente.numOrdenes)}`,
      value: formatCurrency(cliente.totalCompras),
    }));
  }, [topClientes]);

  const purchaseBarData = useMemo<ChartDatum[]>(() => {
    return (compras?.byProveedor ?? []).slice(0, 8).map((item) => ({
      name: item.proveedorNombre,
      value: item.total,
      extra: `${item.count} compras`,
    }));
  }, [compras]);

  const purchasePieData = useMemo<ChartDatum[]>(() => {
    return (compras?.bySede ?? []).slice(0, 6).map((item) => ({
      name: item.sede,
      value: item.total,
      extra: `${item.count} compras`,
    }));
  }, [compras]);

  const purchaseListRows = useMemo<ListRow[]>(() => {
    return (compras?.byProveedor ?? []).map((item) => ({
      primary: item.proveedorNombre,
      secondary: `${item.count} compras · IVA ${formatCurrency(item.iva)}`,
      value: formatCurrency(item.total),
    }));
  }, [compras]);

  const documentPieData = useMemo<ChartDatum[]>(() => {
    return Object.entries(docs?.byDetected ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [docs]);

  const documentListRows = useMemo<ListRow[]>(() => {
    return Object.entries(docs?.byDetected ?? {})
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        primary: name,
        secondary: 'Tipo detectado por OCR/IA',
        value: String(value),
      }));
  }, [docs]);

  const topCustomerBarData = useMemo<ChartDatum[]>(() => {
    return topClientes.map((cliente) => ({
      name: cliente.empresa || cliente.nombre,
      value: cliente.totalCompras,
      extra: `${cliente.numOrdenes} ${ordersNoun(cliente.numOrdenes)}`,
    }));
  }, [topClientes]);

  const crmListRows = useMemo<ListRow[]>(() => {
    if (!crmInsights) return [];
    return [
      ...crmInsights.risks.map((item) => ({ primary: item.title || 'Riesgo CRM', secondary: item.summary || 'Sin detalle', value: 'Riesgo' })),
      ...crmInsights.opportunities.map((item) => ({ primary: item.title || 'Oportunidad CRM', secondary: item.summary || 'Sin detalle', value: 'Oportunidad' })),
      ...crmInsights.recommendations.map((item) => ({ primary: item.title || 'Recomendación CRM', secondary: item.summary || 'Sin detalle', value: item.priority || 'NEXT' })),
    ].slice(0, 18);
  }, [crmInsights]);

  const crmChartData = useMemo<ChartDatum[]>(() => {
    if (!crmInsights) return [];
    if (crmInsights.kpis.length) {
      return crmInsights.kpis.slice(0, 8).map((kpi) => ({ name: kpi.label, value: kpi.value, extra: kpi.unit || '' }));
    }
    return [
      { name: 'Riesgos', value: crmInsights.risks.length },
      { name: 'Oportunidades', value: crmInsights.opportunities.length },
      { name: 'Acciones', value: crmInsights.actions.length },
    ];
  }, [crmInsights]);

  const inventoryListRows = useMemo<ListRow[]>(() => {
    if (!inventoryInsights) return [];
    return [
      ...inventoryInsights.risks.map((item) => ({ primary: item.title || 'Riesgo inventario', secondary: item.summary || 'Sin detalle', value: 'Riesgo' })),
      ...inventoryInsights.opportunities.map((item) => ({ primary: item.title || 'Oportunidad inventario', secondary: item.summary || 'Sin detalle', value: 'Oportunidad' })),
      ...inventoryInsights.actions.map((item) => ({ primary: item.title || 'Acción inventario', secondary: item.summary || 'Sin detalle', value: item.priority || 'NEXT' })),
    ].slice(0, 18);
  }, [inventoryInsights]);

  const inventoryChartData = useMemo<ChartDatum[]>(() => {
    if (!inventoryInsights) return [];
    if (inventoryInsights.kpis.length) {
      return inventoryInsights.kpis.slice(0, 8).map((kpi) => ({ name: kpi.label, value: kpi.value, extra: kpi.unit || '' }));
    }
    return [
      { name: 'Riesgos', value: inventoryInsights.risks.length },
      { name: 'Oportunidades', value: inventoryInsights.opportunities.length },
      { name: 'Acciones', value: inventoryInsights.actions.length },
    ];
  }, [inventoryInsights]);

  const financeListRows = useMemo<ListRow[]>(() => {
    if (!financeInsights) return [];
    return [
      ...financeInsights.risks.map((item) => ({ primary: item.title || 'Riesgo financiero', secondary: item.summary || 'Sin detalle', value: 'Riesgo' })),
      ...financeInsights.opportunities.map((item) => ({ primary: item.title || 'Oportunidad financiera', secondary: item.summary || 'Sin detalle', value: 'Oportunidad' })),
      ...financeInsights.recommendations.map((item) => ({ primary: item.title || 'Recomendación financiera', secondary: item.summary || 'Sin detalle', value: item.priority || 'NEXT' })),
    ].slice(0, 18);
  }, [financeInsights]);

  const financeChartData = useMemo<ChartDatum[]>(() => {
    if (!financeInsights) return [];
    if (financeInsights.kpis.length) {
      return financeInsights.kpis.slice(0, 8).map((kpi) => ({ name: kpi.label, value: kpi.value, extra: kpi.unit || '' }));
    }
    return [
      { name: 'Riesgos', value: financeInsights.risks.length },
      { name: 'Oportunidades', value: financeInsights.opportunities.length },
      { name: 'Acciones', value: financeInsights.actions.length },
    ];
  }, [financeInsights]);

  const snapshotListRows = useMemo<ListRow[]>(() => {
    return snapshotHistory.map((item) => ({
      primary: `${healthStatusLabel(item.companyHealthStatus)} · ${item.companyHealthScore}/100`,
      secondary: `${formatDateTime(item.createdAt, locale)} · ${item.scope}`,
      value: item.executiveSummary,
    }));
  }, [snapshotHistory, locale]);

  const latestSnapshotBundle = useMemo(() => {
    return [...snapshotHistory]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .find((item) => item.snapshot)?.snapshot ?? null;
  }, [snapshotHistory]);

  const salesSnapshotListRows = useMemo<ListRow[]>(() => {
    const salesSnapshot = latestSnapshotBundle?.sales;
    if (!salesSnapshot) return [];
    return [
      ...salesSnapshot.risks.map((item) => ({ primary: item.title || 'Riesgo comercial', secondary: item.summary || 'Sin detalle', value: 'Riesgo' })),
      ...salesSnapshot.opportunities.map((item) => ({ primary: item.title || 'Oportunidad comercial', secondary: item.summary || 'Sin detalle', value: 'Oportunidad' })),
      ...salesSnapshot.actions.map((item) => ({ primary: item.title || 'Acción comercial', secondary: item.summary || 'Sin detalle', value: item.priority || 'NEXT' })),
    ].slice(0, 18);
  }, [latestSnapshotBundle]);

  const salesSnapshotChartData = useMemo<ChartDatum[]>(() => {
    const salesSnapshots = [...snapshotHistory]
      .filter((item) => item.snapshot?.sales)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (salesSnapshots.length > 1) {
      return salesSnapshots.map((item) => ({
        name: new Date(item.createdAt).toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
        value: item.snapshot?.sales.healthScore ?? 0,
        extra: healthStatusLabel(item.snapshot?.sales.healthStatus ?? 'CRITICO'),
      }));
    }

    const salesSnapshot = latestSnapshotBundle?.sales;
    if (!salesSnapshot) return [];
    if (salesSnapshot.kpis.length) {
      return salesSnapshot.kpis.slice(0, 8).map((kpi) => ({ name: kpi.label, value: kpi.value, extra: kpi.unit || '' }));
    }
    return [
      { name: 'Riesgos', value: salesSnapshot.risks.length },
      { name: 'Oportunidades', value: salesSnapshot.opportunities.length },
      { name: 'Acciones', value: salesSnapshot.actions.length },
    ];
  }, [latestSnapshotBundle, locale, snapshotHistory]);

  const purchasesSnapshotListRows = useMemo<ListRow[]>(() => {
    const purchasesSnapshot = latestSnapshotBundle?.purchases;
    if (!purchasesSnapshot) return [];
    return [
      ...purchasesSnapshot.risks.map((item) => ({ primary: item.title || 'Riesgo de compras', secondary: item.summary || 'Sin detalle', value: 'Riesgo' })),
      ...purchasesSnapshot.opportunities.map((item) => ({ primary: item.title || 'Oportunidad de compras', secondary: item.summary || 'Sin detalle', value: 'Oportunidad' })),
      ...purchasesSnapshot.recommendations.map((item) => ({ primary: item.title || 'Recomendación de compras', secondary: item.summary || 'Sin detalle', value: item.priority || 'NEXT' })),
    ].slice(0, 18);
  }, [latestSnapshotBundle]);

  const purchasesSnapshotChartData = useMemo<ChartDatum[]>(() => {
    const purchasesSnapshot = latestSnapshotBundle?.purchases;
    if (!purchasesSnapshot) return [];
    if (purchasesSnapshot.kpis.length) {
      return purchasesSnapshot.kpis.slice(0, 8).map((kpi) => ({ name: kpi.label, value: kpi.value, extra: kpi.unit || '' }));
    }
    return [
      { name: 'Riesgos', value: purchasesSnapshot.risks.length },
      { name: 'Oportunidades', value: purchasesSnapshot.opportunities.length },
      { name: 'Acciones', value: purchasesSnapshot.actions.length },
    ];
  }, [latestSnapshotBundle]);

  const operationsSnapshotListRows = useMemo<ListRow[]>(() => {
    const operationsSnapshot = latestSnapshotBundle?.operations;
    if (!operationsSnapshot) return [];
    return [
      ...operationsSnapshot.risks.map((item) => ({ primary: item.title || 'Riesgo operativo', secondary: item.summary || 'Sin detalle', value: 'Riesgo' })),
      ...operationsSnapshot.opportunities.map((item) => ({ primary: item.title || 'Oportunidad operativa', secondary: item.summary || 'Sin detalle', value: 'Oportunidad' })),
      ...operationsSnapshot.actions.map((item) => ({ primary: item.title || 'Acción operativa', secondary: item.summary || 'Sin detalle', value: item.priority || 'NEXT' })),
    ].slice(0, 18);
  }, [latestSnapshotBundle]);

  const operationsSnapshotChartData = useMemo<ChartDatum[]>(() => {
    const operationsSnapshot = latestSnapshotBundle?.operations;
    if (!operationsSnapshot) return [];
    if (operationsSnapshot.kpis.length) {
      return operationsSnapshot.kpis.slice(0, 8).map((kpi) => ({ name: kpi.label, value: kpi.value, extra: kpi.unit || '' }));
    }
    return [
      { name: 'Riesgos', value: operationsSnapshot.risks.length },
      { name: 'Oportunidades', value: operationsSnapshot.opportunities.length },
      { name: 'Acciones', value: operationsSnapshot.actions.length },
    ];
  }, [latestSnapshotBundle]);

  const snapshotLineData = useMemo<ChartDatum[]>(() => {
    return [...snapshotHistory]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((item) => ({ name: new Date(item.createdAt).toLocaleDateString(locale, { month: 'short', day: 'numeric' }), value: item.companyHealthScore, extra: healthStatusLabel(item.companyHealthStatus) }));
  }, [snapshotHistory, locale]);

  const snapshotPieData = useMemo<ChartDatum[]>(() => {
    const buckets: Record<string, number> = {};
    snapshotHistory.forEach((item) => {
      const key = healthStatusLabel(item.companyHealthStatus);
      buckets[key] = (buckets[key] ?? 0) + 1;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [snapshotHistory]);

  async function saveReportPrefs(next: ReportBuilderState) {
    reportPrefsRef.current = next;
    setReportPrefs(next);
    setReportPrefsDraft(clonePrefs(next));
    await fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: next }),
    }).catch(() => null);
  }

  function applyWidgetsLocally(nextWidgets: ReportWidget[]) {
    setReportPrefs((current) => {
      const next = {
        builder: {
          ...current.builder,
          widgets: nextWidgets,
        },
      };
      reportPrefsRef.current = next;
      return next;
    });
    setReportPrefsDraft((current) => ({
      builder: {
        ...current.builder,
        widgets: clonePrefs(nextWidgets),
      },
    }));
  }

  function persistCurrentWidgets() {
    void saveReportPrefs(reportPrefsRef.current);
  }

  function scheduleWidgetPersist(delay = 320) {
    if (persistWidgetsTimeoutRef.current) {
      clearTimeout(persistWidgetsTimeoutRef.current);
    }
    persistWidgetsTimeoutRef.current = setTimeout(() => {
      persistWidgetsTimeoutRef.current = null;
      persistCurrentWidgets();
    }, delay);
  }

  useEffect(() => {
    return () => {
      if (persistWidgetsTimeoutRef.current) {
        clearTimeout(persistWidgetsTimeoutRef.current);
      }
    };
  }, []);

  function addWidget(source: WidgetSource, view: WidgetView) {
    const catalog = WIDGET_CATALOG.find((item) => item.source === source);
    const widget: ReportWidget = {
      id: buildId('widget'),
      source,
      view,
      title: `${catalog?.title ?? source} · ${viewLabel(view)}`,
      limit: view === 'list' ? 5 : undefined,
      metric: view === 'kpi'
        ? source === 'ordenes'
          ? 'ordenesTrabajo'
          : source === 'cotizaciones'
            ? 'cotizacionesTotales'
            : source === 'clientes'
              ? 'clientesActivos'
              : 'ventasTotales'
        : undefined,
      width: defaultWidgetWidth(view),
      height: defaultWidgetHeight(view),
    };
    const next = clonePrefs(reportPrefs);
    next.builder.widgets.push(widget);
    void saveReportPrefs(next);
  }

  function updateWidget(widgetId: string, changes: Partial<ReportWidget>, draft = false) {
    const current = draft ? clonePrefs(reportPrefsDraft) : clonePrefs(reportPrefs);
    current.builder.widgets = current.builder.widgets.map((widget) => {
      if (widget.id !== widgetId) return widget;
      const nextView = changes.view ?? widget.view;
      return {
        ...widget,
        ...changes,
        width: clampWidgetWidth(changes.width ?? widget.width, nextView),
        height: clampWidgetHeight(changes.height ?? widget.height, nextView),
      };
    });
    if (draft) {
      setReportPrefsDraft(current);
      return;
    }
    void saveReportPrefs(current);
  }

  function removeWidget(widgetId: string, draft = false) {
    const current = draft ? clonePrefs(reportPrefsDraft) : clonePrefs(reportPrefs);
    current.builder.widgets = current.builder.widgets.filter((widget) => widget.id !== widgetId);
    if (draft) {
      setReportPrefsDraft(current);
      return;
    }
    void saveReportPrefs(current);
  }

  function handleWidgetDragStart(widgetId: string, event: React.DragEvent<HTMLButtonElement>) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', widgetId);
    setDraggingWidgetId(widgetId);
    setDragOverWidgetId(widgetId);
    setDragOverPlacement('before');
  }

  function handleWidgetDragOver(widgetId: string, event: React.DragEvent<HTMLDivElement>) {
    if (!draggingWidgetId || draggingWidgetId === widgetId) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY - bounds.top < bounds.height / 2 ? 'before' : 'after';
    setDragOverWidgetId(widgetId);
    setDragOverPlacement(placement);
  }

  function clearWidgetDragState() {
    setDraggingWidgetId(null);
    setDragOverWidgetId(null);
    setDragOverPlacement('before');
  }

  function handleDraftWidgetDragStart(widgetId: string, event: React.DragEvent<HTMLButtonElement>) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', widgetId);
    setLayoutDraggingWidgetId(widgetId);
    setLayoutDragOverWidgetId(widgetId);
    setLayoutDragOverPlacement('before');
  }

  function handleDraftWidgetDragOver(widgetId: string, event: React.DragEvent<HTMLDivElement>) {
    if (!layoutDraggingWidgetId || layoutDraggingWidgetId === widgetId) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement = event.clientY - bounds.top < bounds.height / 2 ? 'before' : 'after';
    setLayoutDragOverWidgetId(widgetId);
    setLayoutDragOverPlacement(placement);
  }

  function clearDraftWidgetDragState() {
    setLayoutDraggingWidgetId(null);
    setLayoutDragOverWidgetId(null);
    setLayoutDragOverPlacement('before');
  }

  function handleDraftWidgetDrop(widgetId: string, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const sourceId = layoutDraggingWidgetId || event.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === widgetId) {
      clearDraftWidgetDragState();
      return;
    }
    setReportPrefsDraft((current) => ({
      builder: {
        ...current.builder,
        widgets: reorderWidgets(current.builder.widgets, sourceId, widgetId, layoutDragOverPlacement),
      },
    }));
    clearDraftWidgetDragState();
  }

  function handleWidgetDrop(widgetId: string, event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const sourceId = draggingWidgetId || event.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === widgetId) {
      clearWidgetDragState();
      return;
    }
    const nextWidgets = reorderWidgets(reportPrefsRef.current.builder.widgets, sourceId, widgetId, dragOverPlacement);
    applyWidgetsLocally(nextWidgets);
    clearWidgetDragState();
    scheduleWidgetPersist();
  }

  function handleResizeStart(widget: ReportWidget, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const nextResizeState: ResizeState = {
      widgetId: widget.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: clampWidgetWidth(widget.width, widget.view),
      startHeight: clampWidgetHeight(widget.height, widget.view),
      view: widget.view,
    };
    setResizeState(nextResizeState);
  }

  useEffect(() => {
    if (!resizeState) return;
    const activeResize = resizeState;

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activeResize.pointerId) return;
      const deltaX = event.clientX - activeResize.startX;
      const deltaY = event.clientY - activeResize.startY;
      const nextWidth = clampWidgetWidth(activeResize.startWidth + deltaX / 170, activeResize.view);
      const nextHeight = clampWidgetHeight(activeResize.startHeight + deltaY, activeResize.view);
      const nextWidgets = reportPrefsRef.current.builder.widgets.map((widget) => (
        widget.id === activeResize.widgetId
          ? { ...widget, width: nextWidth, height: nextHeight }
          : widget
      ));
      applyWidgetsLocally(nextWidgets);
    }

    function finishPointer(event?: PointerEvent) {
      if (event && event.pointerId !== activeResize.pointerId) return;
      setResizeState(null);
      scheduleWidgetPersist();
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishPointer);
    window.addEventListener('pointercancel', finishPointer);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishPointer);
      window.removeEventListener('pointercancel', finishPointer);
    };
  }, [resizeState]);

  function updateTemplate(templateId: string, field: keyof ReportTemplate, value: string | boolean) {
    setReportPrefsDraft((current) => ({
      builder: {
        ...current.builder,
        templates: current.builder.templates.map((template) => template.id === templateId ? { ...template, [field]: value } : template),
      },
    }));
  }

  function duplicateTemplate(templateId: string) {
    setReportPrefsDraft((current) => {
      const template = current.builder.templates.find((entry) => entry.id === templateId);
      if (!template) return current;
      return {
        builder: {
          ...current.builder,
          templates: [
            ...current.builder.templates,
            { ...template, id: buildId('template'), name: `${template.name} copia` },
          ],
        },
      };
    });
  }

  function getMetricValue(metric: KpiMetric) {
    if (metric === 'ordenesTrabajo') return String(reportStats.ordenesTrabajo);
    if (metric === 'cotizacionesTotales') return String(reportStats.cotizacionesTotales);
    if (metric === 'clientesActivos') return String(reportStats.clientesActivos);
    return formatCurrency(reportStats.ventasTotales);
  }

  function getListRows(widget: ReportWidget): ListRow[] {
    if (widget.source === 'ventas') return salesListRows;
    if (widget.source === 'ordenes') return ordersListRows;
    if (widget.source === 'cotizaciones') return quotesListRows;
    if (widget.source === 'clientes') return customerListRows;
    if (widget.source === 'compras') return purchaseListRows;
    if (widget.source === 'documentos') return documentListRows;
    if (widget.source === 'crmInteligencia') return crmListRows;
    if (widget.source === 'inventarioInteligencia') return inventoryListRows;
    if (widget.source === 'contabilidadInteligencia') return financeListRows;
    if (widget.source === 'ventasInteligencia') return salesSnapshotListRows;
    if (widget.source === 'comprasInteligencia') return purchasesSnapshotListRows;
    if (widget.source === 'operacionesInteligencia') return operationsSnapshotListRows;
    if (widget.source === 'snapshotsInteligencia') return snapshotListRows;
    return customerListRows;
  }

  function getChartData(widget: ReportWidget): ChartDatum[] {
    if (widget.source === 'ventas') {
      return ventasMensuales.map((item) => ({ name: item.mes, value: widget.view === 'line' ? item.ventasCount : item.ventas, extra: `${item.ventasCount} órdenes` }));
    }
    if (widget.source === 'ordenes') return orderTimeline;
    if (widget.source === 'cotizaciones') return quotesTimeline;
    if (widget.source === 'clientes') return customerPieData;
    if (widget.source === 'compras') return widget.view === 'pie' ? purchasePieData : purchaseBarData;
    if (widget.source === 'documentos') return documentPieData;
    if (widget.source === 'crmInteligencia') return crmChartData;
    if (widget.source === 'inventarioInteligencia') return inventoryChartData;
    if (widget.source === 'contabilidadInteligencia') return financeChartData;
    if (widget.source === 'ventasInteligencia') return salesSnapshotChartData;
    if (widget.source === 'comprasInteligencia') return purchasesSnapshotChartData;
    if (widget.source === 'operacionesInteligencia') return operationsSnapshotChartData;
    if (widget.source === 'snapshotsInteligencia') return widget.view === 'pie' ? snapshotPieData : snapshotLineData;
    return topCustomerBarData;
  }

  function buildExportSnapshot(): ExportSnapshot {
    const widgets = reportPrefs.builder.widgets.filter((widget) => selectedWidgetIds.includes(widget.id));
    const sections = widgets.map<ExportSectionSnapshot>((widget) => ({
      title: widget.title,
      view: widget.view,
      rows: widget.view === 'kpi'
        ? [{ primary: metricLabel(widget.metric ?? 'ventasTotales'), value: getMetricValue(widget.metric ?? 'ventasTotales') }]
        : getListRows(widget).slice(0, widget.limit ?? 5),
    }));

    return {
      title: 'Reporte corporativo',
      subtitle: ['Resumen configurable del negocio con datos visibles del periodo actual.', selectedSedeOption ? `Sede: ${selectedSedeOption.nombre}.` : '', activeResponsibleLabel ? `Responsable: ${activeResponsibleLabel}.` : '', channelFilter ? `Canal: ${reportChannelLabel(channelFilter)}.` : ''].filter(Boolean).join(' '),
      generatedAt: new Date().toLocaleString(locale),
      from,
      to,
      layout: exportLayout,
      includeMetrics: exportIncludeMetrics,
      metrics: [
        { label: 'Ventas totales', value: formatCurrency(reportStats.ventasTotales) },
        { label: 'Órdenes de trabajo', value: String(reportStats.ordenesTrabajo) },
        { label: 'Cotizaciones', value: String(reportStats.cotizacionesTotales) },
        { label: 'Clientes activos', value: String(reportStats.clientesActivos) },
      ],
      sections,
    };
  }

  async function handleExport() {
    const snapshot = buildExportSnapshot();
    const template = activeTemplate;
    const baseName = `Reporte-${from}-${to}`;

    try {
      setExporting(true);

      if (exportFormat === 'csv') {
        downloadBlob(`${baseName}.csv`, new Blob([buildCsv(snapshot)], { type: 'text/csv;charset=utf-8' }));
      } else if (exportFormat === 'excel') {
        downloadBlob(`${baseName}.xls`, new Blob([buildExcelHtml(snapshot)], { type: 'application/vnd.ms-excel;charset=utf-8' }));
      } else if (exportFormat === 'pdf') {
        const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900');
        if (!printWindow) throw new Error('El navegador bloqueó la ventana de impresión.');
        printWindow.document.write(buildPrintHtml(snapshot, template));
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      } else {
        const blob = await buildImageBlob(snapshot, template, exportFormat);
        downloadBlob(`${baseName}.${exportFormat}`, blob);
      }

      const next = clonePrefs(reportPrefs);
      next.builder.lastTemplateId = template.id;
      next.builder.history = [
        {
          id: buildId('history'),
          createdAt: new Date().toISOString(),
          format: exportFormat,
          templateName: template.name,
          from,
          to,
          widgetCount: snapshot.sections.length,
          includeMetrics: exportIncludeMetrics,
          layout: exportLayout,
        },
        ...next.builder.history,
      ].slice(0, 20);
      await saveReportPrefs(next);
      setExportOpen(false);
    } catch (error) {
      console.error('No fue posible exportar el reporte:', error);
      window.alert(error instanceof Error ? error.message : 'No fue posible exportar el reporte.');
    } finally {
      setExporting(false);
    }
  }

  function renderWidgetCard(widget: ReportWidget, mode: 'page' | 'preview' = 'page') {
    const listRows = getListRows(widget);
    const chartData = getChartData(widget);
    const limit = widget.limit ?? 5;
    const currentPage = listPages[widget.id] ?? 1;
    const totalPages = Math.max(1, Math.ceil(listRows.length / limit));
    const visibleRows = listRows.slice((currentPage - 1) * limit, currentPage * limit);
    const compact = activeTemplate.density === 'compact' || mode === 'preview';
    const widgetWidth = clampWidgetWidth(widget.width, widget.view);
    const widgetHeight = clampWidgetHeight(widget.height, widget.view);
    const spanClass = widgetWidth >= 4
      ? 'md:col-span-2 xl:col-span-4'
      : widgetWidth === 3
        ? 'md:col-span-2 xl:col-span-3'
        : widgetWidth === 2
          ? 'md:col-span-2 xl:col-span-2'
          : '';
    const shellClass = widget.view === 'kpi'
      ? `rounded-[24px] border-slate-200 bg-white shadow-sm ${spanClass}`.trim()
      : `rounded-[24px] border-slate-200 bg-white shadow-sm md:col-span-2 ${spanClass}`.trim();
    const chartHeight = Math.max(190, widgetHeight - (compact ? 112 : 126));
    const isResizingThisWidget = mode === 'page' && resizeState?.widgetId === widget.id;

    if (widget.view === 'kpi') {
      return (
        <Card key={widget.id} className={`${shellClass} ${isResizingThisWidget ? 'ring-2 ring-sky-300 shadow-[0_0_0_6px_rgba(125,211,252,0.18)]' : ''}`.trim()} style={{ minHeight: `${widgetHeight}px` }}>
          <CardContent className={`${compact ? 'p-4' : 'p-5'} flex h-full items-center`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">{widget.title}</p>
                <p className="mt-1 text-3xl font-semibold text-slate-950">{getMetricValue(widget.metric ?? 'ventasTotales')}</p>
              </div>
              {widget.metric === 'ordenesTrabajo' ? <Package className="h-10 w-10 text-sky-200" /> : widget.metric === 'cotizacionesTotales' ? <FileText className="h-10 w-10 text-violet-200" /> : widget.metric === 'clientesActivos' ? <Users className="h-10 w-10 text-orange-200" /> : <DollarSign className="h-10 w-10 text-emerald-200" />}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (widget.view === 'list') {
      return (
        <Card key={widget.id} className={`${shellClass} ${isResizingThisWidget ? 'ring-2 ring-sky-300 shadow-[0_0_0_6px_rgba(125,211,252,0.18)]' : ''}`.trim()} style={{ minHeight: `${widgetHeight}px` }}>
          <CardHeader className={compact ? 'px-4 pb-2 pt-4' : 'px-5 pb-3 pt-5'}>
            <CardTitle className="text-base text-slate-950">{widget.title}</CardTitle>
          </CardHeader>
          <CardContent className={`${compact ? 'px-4 pb-4' : 'px-5 pb-5'} flex h-full flex-col`}>
            {visibleRows.length ? (
              <div className="space-y-3">
                {visibleRows.map((row, index) => (
                  <div key={`${widget.id}-${index}`} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{row.primary}</div>
                      {row.secondary ? <div className="mt-0.5 text-xs text-slate-500">{row.secondary}</div> : null}
                    </div>
                    {row.value ? <div className="shrink-0 text-sm font-semibold text-slate-900">{row.value}</div> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">Sin datos para esta vista.</div>
            )}
            {listRows.length > limit ? (
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Página {currentPage} de {totalPages}</span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setListPages((current) => ({ ...current, [widget.id]: Math.max(1, currentPage - 1) }))}>Anterior</Button>
                  <Button type="button" variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setListPages((current) => ({ ...current, [widget.id]: Math.min(totalPages, currentPage + 1) }))}>Siguiente</Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      );
    }

    const chartEmpty = chartData.length === 0;
    return (
      <Card key={widget.id} className={`${shellClass} ${isResizingThisWidget ? 'ring-2 ring-sky-300 shadow-[0_0_0_6px_rgba(125,211,252,0.18)]' : ''}`.trim()} style={{ minHeight: `${widgetHeight}px` }}>
        <CardHeader className={compact ? 'px-4 pb-2 pt-4' : 'px-5 pb-3 pt-5'}>
          <CardTitle className="text-base text-slate-950">{widget.title}</CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-4' : 'px-5 pb-5'}>
          {chartEmpty ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500">Sin datos suficientes para la visualización.</div>
          ) : (
            <div style={{ height: `${chartHeight}px` }}>
              <ResponsiveContainer width="100%" height="100%">
                {widget.view === 'pie' ? (
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={92} paddingAngle={2}>
                      {chartData.map((_, idx) => <Cell key={`${widget.id}-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                ) : widget.view === 'line' ? (
                  <LineChart data={chartData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke={activeTemplate.accentColor} strokeWidth={3} dot={{ r: 3 }} name={widget.title} />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" hide={chartData.length > 6} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill={activeTemplate.accentColor} name={widget.title} radius={[8, 8, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="py-12 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const exportSnapshot = buildExportSnapshot();

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <ErpPageHero
        eyebrow="ERP analítico"
        title={t('reports.title')}
        description="Centro analítico configurable para armar reportes con bloques del negocio, exportarlos en varios formatos y conservar historial operativo."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => { setReportPrefsDraft(clonePrefs(reportPrefs)); setLayoutOpen(true); }} disabled={prefsLoading}>
              <Settings2 className="mr-2 h-4 w-4" />
              Personalizar
            </Button>
            <Button type="button" variant="outline" onClick={() => setExportOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Descargar reporte
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/inteligencia">
                <BrainCircuit className="mr-2 h-4 w-4" />
                Motor de inteligencia empresarial
              </Link>
            </Button>
            <select className="rounded-md border px-4 py-2" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
              <option value="mes">{t('reports.period.thisMonth')}</option>
              <option value="trimestre">{t('reports.period.quarter')}</option>
              <option value="año">{t('reports.period.year')}</option>
            </select>
          </>
        }
        stats={[
          { label: 'Widgets activos', value: reportPrefs.builder.widgets.length, hint: 'Bloques visibles del reporte', tone: 'sky' },
          { label: 'Plantillas', value: reportPrefs.builder.templates.length, hint: 'Diseños reutilizables', tone: 'teal' },
          { label: 'Exportaciones', value: reportPrefs.builder.history.length, hint: 'Historial reciente', tone: 'amber' },
        ]}
      />

      <Card className="rounded-[28px] border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('reports.filters.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>{t('reports.filters.from')}</Label>
              <Input type="date" value={fromDraft} onChange={(e) => setFromDraft(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('reports.filters.to')}</Label>
              <Input type="date" value={toDraft} onChange={(e) => setToDraft(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('reports.filters.groupBy')}</Label>
              <select className="w-full rounded-md border px-3 py-2" value={groupByDraft} onChange={(e) => setGroupByDraft(e.target.value as GroupBy)}>
                <option value="dia">{t('reports.groupBy.day')}</option>
                <option value="mes">{t('reports.groupBy.month')}</option>
                <option value="año">{t('reports.groupBy.year')}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => { setFrom(fromDraft); setTo(toDraft); setGroupBy(groupByDraft); setSelectedSedeId(selectedSedeIdDraft); setResponsibleFilter(responsibleFilterDraft); setChannelFilter(channelFilterDraft); }}>{t('reports.filters.apply')}</Button>
              <Button type="button" variant="outline" onClick={() => { const next = defaultRangeForPeriodo(periodo); setFromDraft(next.from); setToDraft(next.to); setFrom(next.from); setTo(next.to); setGroupByDraft('mes'); setGroupBy('mes'); setSelectedSedeIdDraft(''); setSelectedSedeId(''); setResponsibleFilterDraft(''); setResponsibleFilter(''); setChannelFilterDraft(''); setChannelFilter(''); }}>{t('reports.filters.reset')}</Button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Sede</Label>
              <select className="w-full rounded-md border px-3 py-2" value={selectedSedeIdDraft} onChange={(e) => setSelectedSedeIdDraft(e.target.value)}>
                <option value="">Sede actual</option>
                {sedes.map((sede) => (
                  <option key={sede.id} value={sede.id}>{sede.nombre}{sede.codigo ? ` · ${sede.codigo}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <select className="w-full rounded-md border px-3 py-2" value={responsibleFilterDraft} onChange={(e) => setResponsibleFilterDraft(e.target.value)}>
                <option value="">Todos</option>
                {responsibleOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Canal</Label>
              <select className="w-full rounded-md border px-3 py-2" value={channelFilterDraft} onChange={(e) => setChannelFilterDraft((e.target.value || '') as ReportChannel | '')}>
                <option value="">Todos</option>
                {availableChannelOptions.map((channel) => (
                  <option key={channel} value={channel}>{reportChannelLabel(channel)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">
            Sede afecta las consultas del periodo. Responsable refina principalmente órdenes. Canal refina las cotizaciones según envío por WhatsApp, email, multicanal o flujo directo.
          </div>
        </CardContent>
      </Card>

      <Dialog open={layoutOpen} onOpenChange={setLayoutOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Diseño del tablero</DialogTitle>
            <DialogDescription>Ordena widgets activos, elimina bloques no deseados y deja lista la base del reporte.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-900">Widgets activos</div>
            <div className="space-y-2">
              {reportPrefsDraft.builder.widgets.map((widget) => (
                <div
                  key={widget.id}
                  className="space-y-2"
                  onDragOver={(event) => handleDraftWidgetDragOver(widget.id, event)}
                  onDrop={(event) => handleDraftWidgetDrop(widget.id, event)}
                >
                  {layoutDragOverWidgetId === widget.id && layoutDraggingWidgetId && layoutDraggingWidgetId !== widget.id && layoutDragOverPlacement === 'before' ? (
                    <div className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/80 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                      Soltar aquí para insertar antes
                    </div>
                  ) : null}
                  <div className={`flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 transition ${layoutDraggingWidgetId === widget.id ? 'opacity-60' : 'shadow-sm'}`}>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => handleDraftWidgetDragStart(widget.id, event)}
                        onDragEnd={clearDraftWidgetDragState}
                        className="inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-sky-300 hover:text-sky-700 active:cursor-grabbing"
                        title="Arrastrar bloque"
                        aria-label="Arrastrar bloque"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{widget.title}</div>
                        <div className="text-xs text-slate-500">{viewLabel(widget.view)} · fuente {widget.source} · ancho {clampWidgetWidth(widget.width, widget.view)} columnas · alto {clampWidgetHeight(widget.height, widget.view)} px</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="icon" onClick={() => removeWidget(widget.id, true)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  {layoutDragOverWidgetId === widget.id && layoutDraggingWidgetId && layoutDraggingWidgetId !== widget.id && layoutDragOverPlacement === 'after' ? (
                    <div className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/80 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                      Soltar aquí para insertar después
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLayoutOpen(false)}>{t('common.cancel')}</Button>
            <Button type="button" onClick={() => { void saveReportPrefs({ builder: { ...reportPrefsDraft.builder, lastTemplateId: selectedTemplateId } }); setLayoutOpen(false); }}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Plantillas de descarga</DialogTitle>
            <DialogDescription>Configura formatos reutilizables para exportar sin ocupar espacio fijo en la pantalla.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {reportPrefsDraft.builder.templates.map((template) => (
              <Card key={template.id} className={selectedTemplateId === template.id ? 'rounded-[24px] border-sky-300 shadow-sm' : 'rounded-[24px] border-slate-200 shadow-sm'}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Input value={template.name} onChange={(e) => updateTemplate(template.id, 'name', e.target.value)} />
                    <Button type="button" variant="outline" size="sm" onClick={() => duplicateTemplate(template.id)}>Duplicar</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Tamaño</Label>
                      <select className="w-full rounded-md border px-3 py-2" value={template.pageSize} onChange={(e) => updateTemplate(template.id, 'pageSize', e.target.value)}>
                        <option value="A4">A4</option>
                        <option value="LETTER">Letter</option>
                        <option value="LEGAL">Legal</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Orientación</Label>
                      <select className="w-full rounded-md border px-3 py-2" value={template.orientation} onChange={(e) => updateTemplate(template.id, 'orientation', e.target.value)}>
                        <option value="landscape">Horizontal</option>
                        <option value="portrait">Vertical</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Densidad</Label>
                      <select className="w-full rounded-md border px-3 py-2" value={template.density} onChange={(e) => updateTemplate(template.id, 'density', e.target.value)}>
                        <option value="comfortable">Cómoda</option>
                        <option value="compact">Compacta</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Acento</Label>
                      <Input type="color" value={template.accentColor} onChange={(e) => updateTemplate(template.id, 'accentColor', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><input type="checkbox" checked={template.includeMetrics} onChange={(e) => updateTemplate(template.id, 'includeMetrics', e.target.checked)} />Incluir métricas</label>
                    <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><input type="checkbox" checked={template.showHeader} onChange={(e) => updateTemplate(template.id, 'showHeader', e.target.checked)} />Header</label>
                    <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"><input type="checkbox" checked={template.showFooter} onChange={(e) => updateTemplate(template.id, 'showFooter', e.target.checked)} />Footer</label>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm">
                    <span>{template.pageSize} · {template.orientation === 'landscape' ? 'Horizontal' : 'Vertical'} · {template.density === 'compact' ? 'Compacta' : 'Cómoda'}</span>
                    <Button type="button" variant={selectedTemplateId === template.id ? 'default' : 'outline'} size="sm" onClick={() => setSelectedTemplateId(template.id)}>Usar</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTemplatesOpen(false)}>{t('common.cancel')}</Button>
            <Button type="button" onClick={() => { void saveReportPrefs({ builder: { ...reportPrefsDraft.builder, lastTemplateId: selectedTemplateId } }); setTemplatesOpen(false); }}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sourcesOpen} onOpenChange={setSourcesOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fuentes del negocio para insertar</DialogTitle>
            <DialogDescription>Abre el catálogo, elige la visualización y cada bloque se inserta en el tablero para seguirlo configurando después.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {WIDGET_CATALOG.map((item) => (
              <div key={item.source} className={`rounded-[26px] border border-slate-200 bg-gradient-to-br ${item.accentClass} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-950">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-600">{item.description}</div>
                  </div>
                  <Plus className="mt-1 h-4 w-4 text-slate-500" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.supportedViews.map((view) => (
                    <Button key={`${item.source}-${view}`} type="button" variant="outline" size="sm" onClick={() => addWidget(item.source, view)}>
                      {view === 'list' ? <List className="mr-1.5 h-3.5 w-3.5" /> : view === 'bar' ? <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> : view === 'pie' ? <PieChartIcon className="mr-1.5 h-3.5 w-3.5" /> : view === 'line' ? <LineChartIcon className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                      {viewLabel(view)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeWidgetSettings)} onOpenChange={(open) => { if (!open) setWidgetSettingsId(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Tamaño del bloque</DialogTitle>
            <DialogDescription>Define ancho y alto del widget como en un tablero configurable. El cambio se guarda sobre ese bloque.</DialogDescription>
          </DialogHeader>

          {activeWidgetSettings ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="font-medium text-slate-950">{activeWidgetSettings.title}</div>
                <div className="mt-1 text-sm text-slate-500">{viewLabel(activeWidgetSettings.view)} · fuente {activeWidgetSettings.source}</div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Ancho en columnas</Label>
                  <Input type="number" min={1} max={4} value={clampWidgetWidth(activeWidgetSettings.width, activeWidgetSettings.view)} onChange={(e) => updateWidget(activeWidgetSettings.id, { width: Number(e.target.value) || 1 })} />
                  <div className="text-xs text-slate-500">1 a 4 columnas en escritorio amplio.</div>
                </div>
                <div className="space-y-2">
                  <Label>Alto del bloque</Label>
                  <Input type="number" min={140} max={720} step={10} value={clampWidgetHeight(activeWidgetSettings.height, activeWidgetSettings.view)} onChange={(e) => updateWidget(activeWidgetSettings.id, { height: Number(e.target.value) || defaultWidgetHeight(activeWidgetSettings.view) })} />
                  <div className="text-xs text-slate-500">Entre 140 y 720 px.</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[1, 2, 3, 4].map((width) => (
                  <Button key={width} type="button" variant={clampWidgetWidth(activeWidgetSettings.width, activeWidgetSettings.view) === width ? 'default' : 'outline'} onClick={() => updateWidget(activeWidgetSettings.id, { width })}>
                    {width} col
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Descargar reporte</DialogTitle>
            <DialogDescription>Elige formato, periodo, bloques incluidos, diseño y revisa una vista previa antes de exportar.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Formato</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['excel', 'Excel'],
                    ['csv', 'CSV'],
                    ['pdf', 'PDF'],
                    ['png', 'PNG'],
                    ['jpg', 'JPG'],
                  ] as const).map(([value, label]) => (
                    <Button key={value} type="button" variant={exportFormat === value ? 'default' : 'outline'} onClick={() => setExportFormat(value)}>{label}</Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Desde</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Hasta</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Layout de salida</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={exportLayout === 'dashboard' ? 'default' : 'outline'} onClick={() => setExportLayout('dashboard')}>
                    <LayoutGrid className="mr-2 h-4 w-4" />Dashboard
                  </Button>
                  <Button type="button" variant={exportLayout === 'list' ? 'default' : 'outline'} onClick={() => setExportLayout('list')}>
                    <List className="mr-2 h-4 w-4" />Lista
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Plantilla</Label>
                <select className="w-full rounded-md border px-3 py-2" value={selectedTemplateId} onChange={(e) => { setSelectedTemplateId(e.target.value); const template = reportPrefs.builder.templates.find((entry) => entry.id === e.target.value); setExportIncludeMetrics(template?.includeMetrics ?? true); }}>
                  {reportPrefs.builder.templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                <input type="checkbox" checked={exportIncludeMetrics} onChange={(e) => setExportIncludeMetrics(e.target.checked)} />
                Incluir las métricas base del negocio en el archivo.
              </label>

              <div className="space-y-2">
                <Label>Bloques a descargar</Label>
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
                  {reportPrefs.builder.widgets.map((widget) => {
                    const checked = selectedWidgetIds.includes(widget.id);
                    return (
                      <label key={widget.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedWidgetIds((current) => e.target.checked ? [...current, widget.id] : current.filter((id) => id !== widget.id));
                          }}
                        />
                        <div>
                          <div className="font-medium text-slate-900">{widget.title}</div>
                          <div className="text-xs text-slate-500">{viewLabel(widget.view)} · {widget.source}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Vista previa</div>
                  <div className="text-xs text-slate-500">Preview operativo del archivo antes de exportar.</div>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  {activeTemplate.name} · {activeTemplate.pageSize} · {activeTemplate.orientation === 'landscape' ? 'Horizontal' : 'Vertical'}
                </div>
              </div>

              <div ref={exportPreviewRef} className="rounded-[28px] border border-slate-200 bg-slate-50/40 p-4">
                {activeTemplate.showHeader ? (
                  <div className="mb-4 rounded-[22px] border border-slate-200 bg-white p-4" style={{ borderTop: `4px solid ${activeTemplate.accentColor}` }}>
                    <div className="text-xl font-semibold text-slate-950">Reporte corporativo</div>
                    <div className="mt-1 text-sm text-slate-500">Resumen configurable del negocio con datos visibles del periodo actual.</div>
                    <div className="mt-2 text-xs text-slate-500">Periodo: {from} a {to}</div>
                  </div>
                ) : null}

                {exportIncludeMetrics ? (
                  <div className="mb-4 grid gap-3 md:grid-cols-2">
                    {exportSnapshot.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{metric.label}</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  {reportPrefs.builder.widgets.filter((widget) => selectedWidgetIds.includes(widget.id)).map((widget) => renderWidgetCard(widget, 'preview'))}
                </div>

                {activeTemplate.showFooter ? (
                  <div className="mt-4 text-right text-xs text-slate-500">Plantilla {activeTemplate.name} · Layout {exportLayout}</div>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExportOpen(false)}>{t('common.cancel')}</Button>
            <Button type="button" onClick={() => void handleExport()} disabled={exporting || selectedWidgetIds.length === 0}>
              {exportFormat === 'excel' ? <FileSpreadsheet className="mr-2 h-4 w-4" /> : exportFormat === 'pdf' ? <FileText className="mr-2 h-4 w-4" /> : exportFormat === 'csv' ? <Eye className="mr-2 h-4 w-4" /> : <FileImage className="mr-2 h-4 w-4" />}
              {exporting ? 'Generando...' : 'Exportar ahora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Constructor del reporte</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSourcesOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Insertar fuente
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setReportPrefsDraft(clonePrefs(reportPrefs)); setLayoutOpen(true); }} disabled={prefsLoading}>
                  <Settings2 className="mr-1.5 h-4 w-4" />
                  Ordenar bloques
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {reportPrefs.builder.widgets.map((widget) => (
                <div
                  key={widget.id}
                  className={['relative space-y-2 transition-all', draggingWidgetId === widget.id ? 'opacity-60' : ''].filter(Boolean).join(' ')}
                  onDragOver={(event) => handleWidgetDragOver(widget.id, event)}
                  onDrop={(event) => handleWidgetDrop(widget.id, event)}
                >
                  {dragOverWidgetId === widget.id && draggingWidgetId && draggingWidgetId !== widget.id && dragOverPlacement === 'before' ? (
                    <div className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/85 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 shadow-[0_0_0_6px_rgba(125,211,252,0.16)]">
                      Soltar aquí para insertar antes del bloque
                    </div>
                  ) : null}
                  {renderWidgetCard(widget)}
                  {resizeState?.widgetId === widget.id ? (
                    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[24px]">
                      <div className="absolute inset-0 bg-sky-50/22" />
                      <div className="absolute inset-y-0 left-1/4 border-l border-dashed border-sky-300/90" />
                      <div className="absolute inset-y-0 left-2/4 border-l border-dashed border-sky-300/90" />
                      <div className="absolute inset-y-0 left-3/4 border-l border-dashed border-sky-300/90" />
                      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-sky-200 bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700 shadow-sm">
                        Snap: {clampWidgetWidth(widget.width, widget.view)} col · {clampWidgetHeight(widget.height, widget.view)} px
                      </div>
                    </div>
                  ) : null}
                  <div className="absolute left-3 top-3 z-10 flex items-center gap-1">
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => handleWidgetDragStart(widget.id, event)}
                      onDragEnd={clearWidgetDragState}
                      className="inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-700 active:cursor-grabbing"
                      title="Arrastrar bloque"
                      aria-label="Arrastrar bloque"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon" onClick={() => setWidgetSettingsId(widget.id)} title="Configurar tamaño"><Settings2 className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="icon" onClick={() => removeWidget(widget.id)} title="Quitar bloque"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <button
                    type="button"
                    onPointerDown={(event) => handleResizeStart(widget, event)}
                    className="absolute bottom-3 right-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-500 shadow-sm transition hover:border-sky-300 hover:text-sky-700"
                    title="Redimensionar bloque"
                    aria-label="Redimensionar bloque"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <path d="M5 11L11 5" />
                      <path d="M8 11L11 8" />
                      <path d="M11 11L11 11" />
                    </svg>
                  </button>
                  {dragOverWidgetId === widget.id && draggingWidgetId && draggingWidgetId !== widget.id && dragOverPlacement === 'after' ? (
                    <div className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/85 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 shadow-[0_0_0_6px_rgba(125,211,252,0.16)]">
                      Soltar aquí para insertar después del bloque
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Plantillas de descarga</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => { setReportPrefsDraft(clonePrefs(reportPrefs)); setTemplatesOpen(true); }}>
                <Settings2 className="mr-1.5 h-4 w-4" />
                Configurar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-slate-950">{activeTemplate.name}</div>
                  <div className="mt-1 text-sm text-slate-500">{activeTemplate.pageSize} · {activeTemplate.orientation === 'landscape' ? 'Horizontal' : 'Vertical'} · {activeTemplate.density === 'compact' ? 'Compacta' : 'Cómoda'}</div>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">Activa</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1">Métricas {activeTemplate.includeMetrics ? 'ON' : 'OFF'}</span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1">Header {activeTemplate.showHeader ? 'ON' : 'OFF'}</span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1">Footer {activeTemplate.showFooter ? 'ON' : 'OFF'}</span>
              </div>
            </div>
            <div className="rounded-[24px] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
              {reportPrefs.builder.templates.length} plantillas guardadas. La configuración completa queda dentro del botón Configurar.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Fuentes del negocio para insertar</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => setSourcesOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Abrir catálogo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
            El catálogo de fuentes ahora se abre bajo demanda para no dejar opciones fijas ocupando el tablero. Inserta un bloque, luego ajusta su tamaño desde el icono de configuración del widget.
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Fuentes disponibles</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{WIDGET_CATALOG.length}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Bloques activos</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{reportPrefs.builder.widgets.length}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Vista de trabajo</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">Modal</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Reportes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reportPrefs.builder.history.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">Aún no hay reportes exportados. Cuando generes el primero, quedará listado aquí con formato, periodo, plantilla y cantidad de bloques.</div>
            ) : reportPrefs.builder.history.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-950">{item.templateName}</div>
                    <div className="mt-1 text-sm text-slate-500">{item.from} a {item.to} · {item.widgetCount} bloques · {item.includeMetrics ? 'con métricas' : 'sin métricas'}</div>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium uppercase text-slate-600">{item.format}</div>
                </div>
                <div className="mt-3 text-xs text-slate-500">{formatDateTime(item.createdAt, locale)} · layout {item.layout}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Acceso ejecutivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start gap-3">
                <BrainCircuit className="mt-0.5 h-5 w-5 text-sky-600" />
                <div>
                  <div className="font-medium text-slate-950">Motor de inteligencia empresarial</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Desde aquí puedes saltar a la capa ejecutiva para lectura consolidada de señales de la empresa, mientras este módulo conserva la analítica tradicional y configurable.</p>
                </div>
              </div>
            </div>
            <Button asChild className="w-full">
              <Link href="/dashboard/inteligencia">
                <BrainCircuit className="mr-2 h-4 w-4" />
                Abrir Motor de inteligencia empresarial
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}