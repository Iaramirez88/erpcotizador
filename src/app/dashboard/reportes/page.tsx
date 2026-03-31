'use client';

import { useEffect, useState } from 'react';
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  Calendar,
  Package,
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
  total: number;
  createdAt: string;
  cliente: {
    id: string;
    nombre: string;
    empresa?: string;
  };
}

type VentaReporteApi = {
  id: string;
  createdAt: string;
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

type GroupBy = 'dia' | 'mes' | 'año';

type ReportPrefs = {
  sections?: {
    kpis?: boolean;
    ventas?: boolean;
    topClientes?: boolean;
    documentos?: boolean;
    compras?: boolean;
  };
  charts?: {
    ventasMensuales?: boolean;
    documentosPorTipo?: boolean;
    comprasPorProveedor?: boolean;
  };
};

type UiPrefsResponse = {
  success: boolean;
  data?: {
    report?: ReportPrefs;
  };
};

const DEFAULT_REPORT_PREFS: Required<ReportPrefs> = {
  sections: { kpis: true, ventas: true, topClientes: true, documentos: true, compras: true },
  charts: { ventasMensuales: true, documentosPorTipo: true, comprasPorProveedor: true },
};

const PIE_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

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

export default function ReportesPage() {
  const { t, language } = useI18n();
  const locale = language === 'en' ? 'en-US' : 'es-CO';
  const naText = t('common.na');

  const ordersNoun = (count: number) => (count === 1 ? t('reports.common.order') : t('reports.common.orders'));
  const purchasesNoun = (count: number) => (count === 1 ? t('reports.common.purchase') : t('reports.common.purchases'));

  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('mes'); // mes, trimestre, año
  const [groupByDraft, setGroupByDraft] = useState<GroupBy>('mes');
  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('mes');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [reportPrefs, setReportPrefs] = useState<Required<ReportPrefs>>(DEFAULT_REPORT_PREFS);
  const [reportPrefsDraft, setReportPrefsDraft] = useState<Required<ReportPrefs>>(DEFAULT_REPORT_PREFS);
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
        const res = await fetch('/api/ui-preferences');
        const json: UiPrefsResponse = await res.json().catch(() => ({ success: false }));
        if (!cancelled && json?.success) {
          const next = {
            sections: { ...DEFAULT_REPORT_PREFS.sections, ...(json.data?.report?.sections ?? {}) },
            charts: { ...DEFAULT_REPORT_PREFS.charts, ...(json.data?.report?.charts ?? {}) },
          };
          setReportPrefs(next);
          setReportPrefsDraft(next);
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
    if (!from || !to) return;

    const controller = new AbortController();
    let cancelled = false;

    async function cargarReportes() {
      try {
        setLoading(true);

        const { fromDate, toDate } = parseLocalRange(from, to);

        const [resCotizaciones, resOrdenes, resVentas, resDocs, resCompras] = await Promise.all([
          fetch('/api/cotizaciones', { signal: controller.signal }),
          fetch('/api/ordenes', { signal: controller.signal }),
          fetch(`/api/reportes/ventas${buildParams({ periodo, from, to })}`, { signal: controller.signal }),
          fetch(`/api/reportes/documentos${buildParams({ periodo, from, to })}`, { signal: controller.signal }),
          fetch(`/api/reportes/compras${buildParams({ periodo, from, to })}`, { signal: controller.signal }),
        ]);

        const [dataCotizaciones, dataOrdenes, dataVentas, dataDocs, dataCompras] = await Promise.all([
          resCotizaciones.json(),
          resOrdenes.json(),
          resVentas.json().catch(() => null),
          resDocs.json().catch(() => null),
          resCompras.json().catch(() => null),
        ]);

        const cotizaciones = dataCotizaciones.success ? dataCotizaciones.data : [];
        const ordenes: OrdenAPI[] = dataOrdenes.success ? dataOrdenes.data : [];
        const ventas = dataVentas?.success ? (dataVentas.data as ReporteVentas) : null;
        const ventasItems = ventas?.sales ?? [];

        const ordenesFiltradas = ordenes.filter((o) => {
          const dt = new Date(o.createdAt);
          if (fromDate && dt < fromDate) return false;
          if (toDate && dt > toDate) return false;
          return true;
        });

        const cotizacionesFiltradas = (cotizaciones as Array<{ createdAt?: string }>).filter((c) => {
          const raw = c.createdAt;
          if (!raw) return true;
          const dt = new Date(raw);
          if (fromDate && dt < fromDate) return false;
          if (toDate && dt > toDate) return false;
          return true;
        });

        const ventasTotales = ventas?.totals.netSales ?? 0;
        const tasaConversion =
          cotizacionesFiltradas.length > 0 ? (ordenesFiltradas.length / cotizacionesFiltradas.length) * 100 : 0;
        const promedioVenta = ventas?.totals.averageSale ?? 0;
        const clientesActivos = new Set([
          ...ordenesFiltradas.map((orden) => orden.cliente.id),
          ...ventasItems.map((sale) => sale.customerKey),
        ]).size;

        if (!cancelled) {
          setEstadisticas({
            ventasTotales,
            cotizacionesTotales: cotizacionesFiltradas.length,
            ordenesTrabajo: ordenesFiltradas.length,
            clientesActivos,
            tasaConversion,
            promedioVenta,
          });
        }

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

        const topClientesArray = Object.values(clientesMap)
          .sort((a, b) => b.totalCompras - a.totalCompras)
          .slice(0, 5);

        if (!cancelled) {
          setVentasMensuales(ventasArray);
          setTopClientes(topClientesArray);
          setDocs(dataDocs?.success ? (dataDocs.data as ReporteDocumentos) : null);
          setCompras(dataCompras?.success ? (dataCompras.data as ReporteCompras) : null);
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
  }, [periodo, from, to, groupBy, locale]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'COP',
    }).format(value);
  };

  async function saveReportPrefs(next: Required<ReportPrefs>) {
    setReportPrefs(next);
    setReportPrefsDraft(next);
    await fetch('/api/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: next }),
    }).catch(() => null);
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <ErpPageHero
        eyebrow="ERP analítico"
        title={t('reports.title')}
        description={t('reports.subtitle')}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReportPrefsDraft(reportPrefs);
                setPrefsOpen(true);
              }}
              disabled={prefsLoading}
            >
              {t('reports.actions.customize')}
            </Button>
            <select
              className="px-4 py-2 border rounded-md"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            >
              <option value="mes">{t('reports.period.thisMonth')}</option>
              <option value="trimestre">{t('reports.period.quarter')}</option>
              <option value="año">{t('reports.period.year')}</option>
            </select>
          </>
        }
        stats={[
          { label: 'Ventas', value: formatCurrency(estadisticas.ventasTotales), hint: 'Periodo actual', tone: 'teal' },
          { label: 'Órdenes', value: estadisticas.ordenesTrabajo, hint: 'Trabajo registrado', tone: 'sky' },
          { label: 'Conversión', value: `${estadisticas.tasaConversion.toFixed(1)}%`, hint: 'Desempeño comercial', tone: 'amber' },
        ]}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('reports.filters.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
              <select
                className="px-3 py-2 border rounded-md w-full"
                value={groupByDraft}
                onChange={(e) => setGroupByDraft(e.target.value as GroupBy)}
              >
                <option value="dia">{t('reports.groupBy.day')}</option>
                <option value="mes">{t('reports.groupBy.month')}</option>
                <option value="año">{t('reports.groupBy.year')}</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  setFrom(fromDraft);
                  setTo(toDraft);
                  setGroupBy(groupByDraft);
                }}
              >
                {t('reports.filters.apply')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const next = defaultRangeForPeriodo(periodo);
                  setFromDraft(next.from);
                  setToDraft(next.to);
                  setFrom(next.from);
                  setTo(next.to);
                  setGroupByDraft('mes');
                  setGroupBy('mes');
                }}
              >
                {t('reports.filters.reset')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('reports.prefs.title')}</DialogTitle>
            <DialogDescription>{t('reports.prefs.subtitle')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="font-medium">{t('reports.prefs.sectionsTitle')}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  ['kpis', t('reports.prefs.sections.kpis')],
                  ['ventas', t('reports.prefs.sections.sales')],
                  ['topClientes', t('reports.prefs.sections.topCustomers')],
                  ['documentos', t('reports.prefs.sections.scannedDocs')],
                  ['compras', t('reports.prefs.sections.purchases')],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-md border p-2">
                    <input
                      type="checkbox"
                      checked={reportPrefsDraft.sections[key]}
                      onChange={(e) =>
                        setReportPrefsDraft((prev) => ({
                          ...prev,
                          sections: { ...prev.sections, [key]: e.target.checked },
                        }))
                      }
                    />
                    <Label className="cursor-pointer">{label}</Label>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">{t('reports.prefs.chartsTitle')}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  ['ventasMensuales', t('reports.prefs.charts.monthlySales')],
                  ['documentosPorTipo', t('reports.prefs.charts.docsByType')],
                  ['comprasPorProveedor', t('reports.prefs.charts.purchasesBySupplier')],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-md border p-2">
                    <input
                      type="checkbox"
                      checked={reportPrefsDraft.charts[key]}
                      onChange={(e) =>
                        setReportPrefsDraft((prev) => ({
                          ...prev,
                          charts: { ...prev.charts, [key]: e.target.checked },
                        }))
                      }
                    />
                    <Label className="cursor-pointer">{label}</Label>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPrefsOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void saveReportPrefs(reportPrefsDraft);
                setPrefsOpen(false);
              }}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tarjetas de estadísticas principales */}
      {reportPrefs.sections.kpis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('reports.kpis.totalSales')}</p>
                  <p className="text-2xl font-bold">{formatCurrency(estadisticas.ventasTotales)}</p>
                </div>
                <DollarSign className="w-12 h-12 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('reports.kpis.workOrders')}</p>
                  <p className="text-2xl font-bold">{estadisticas.ordenesTrabajo}</p>
                </div>
                <Package className="w-12 h-12 text-blue-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('reports.kpis.quotes')}</p>
                  <p className="text-2xl font-bold">{estadisticas.cotizacionesTotales}</p>
                </div>
                <FileText className="w-12 h-12 text-purple-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{t('reports.kpis.activeCustomers')}</p>
                  <p className="text-2xl font-bold">{estadisticas.clientesActivos}</p>
                </div>
                <Users className="w-12 h-12 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Documentos escaneados */}
      {reportPrefs.sections.documentos ? (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">{t('reports.docs.title')}</h2>
            <p className="text-sm text-gray-600">{t('reports.docs.subtitle')}</p>
          </div>
          <FileText className="w-6 h-6 text-gray-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.docs.totalScans')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{docs?.totals.total ?? 0}</div>
              <p className="text-sm text-gray-600 mt-1">
                {t('reports.common.since')} {docs?.from ? new Date(docs.from).toLocaleDateString(locale) : naText}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.docs.processed')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{docs?.totals.processed ?? 0}</div>
              <p className="text-sm text-gray-600 mt-1">{t('reports.docs.processedHint')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.docs.approved')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{docs?.totals.approved ?? 0}</div>
              <p className="text-sm text-gray-600 mt-1">{t('reports.docs.approvedHint')}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.docs.byDetected')}</CardTitle>
            </CardHeader>
            <CardContent>
              {docs && docs.byDetected ? (
                reportPrefs.charts.documentosPorTipo ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(docs.byDetected)
                            .sort((a, b) => b[1] - a[1])
                            .map(([name, value]) => ({ name, value }))}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {Object.keys(docs.byDetected).map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(docs.byDetected)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <div key={k} className="rounded-md border p-3">
                          <div className="text-sm text-gray-600">{k}</div>
                          <div className="text-2xl font-bold">{v}</div>
                        </div>
                      ))}
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-600">{t('reports.docs.empty')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      ) : null}

      {/* Compras */}
      {reportPrefs.sections.compras ? (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">{t('reports.purchases.title')}</h2>
            <p className="text-sm text-gray-600">{t('reports.purchases.subtitle')}</p>
          </div>
          <DollarSign className="w-6 h-6 text-gray-400" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.purchases.count')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{compras?.totals.count ?? 0}</div>
              <p className="text-sm text-gray-600 mt-1">
                {t('reports.common.since')} {compras?.from ? new Date(compras.from).toLocaleDateString(locale) : naText}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.purchases.totalSpend')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(compras?.totals.total ?? 0)}</div>
              <p className="text-sm text-gray-600 mt-1">{t('reports.purchases.totalSpendHint')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.purchases.vat')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(compras?.totals.iva ?? 0)}</div>
              <p className="text-sm text-gray-600 mt-1">{t('reports.purchases.vatHint')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.purchases.authorization')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{compras?.totals.authorizedCount ?? 0} / {compras?.totals.count ?? 0}</div>
              <p className="text-sm text-gray-600 mt-1">{t('reports.purchases.authorizationHint')}</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.purchases.topSuppliers')}</CardTitle>
            </CardHeader>
            <CardContent>
              {compras?.byProveedor?.length ? (
                reportPrefs.charts.comprasPorProveedor ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compras.byProveedor.slice(0, 8).map((p) => ({
                        proveedor: p.proveedorNombre,
                        total: p.total,
                        count: p.count,
                      }))}>
                        <XAxis dataKey="proveedor" hide />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" name={t('reports.common.total')} fill="#2563eb" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-2 text-xs text-muted-foreground">{t('reports.purchases.top8Hint')}</div>
                  </div>
                ) : null
              ) : (
                <p className="text-sm text-gray-600">{t('reports.purchases.empty')}</p>
              )}

              {compras?.byProveedor?.length ? (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left">{t('reports.purchases.table.supplier')}</th>
                        <th className="py-2 text-left">{t('reports.purchases.table.count')}</th>
                        <th className="py-2 text-left">{t('reports.purchases.table.subtotal')}</th>
                        <th className="py-2 text-left">{t('reports.purchases.table.vat')}</th>
                        <th className="py-2 text-left">{t('reports.purchases.table.total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compras.byProveedor.map((p) => (
                        <tr key={p.proveedorNombre} className="border-b">
                          <td className="py-2">{p.proveedorNombre}</td>
                          <td className="py-2">{p.count}</td>
                          <td className="py-2">{formatCurrency(p.subtotalSinIva)}</td>
                          <td className="py-2">{formatCurrency(p.iva)}</td>
                          <td className="py-2">{formatCurrency(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('reports.purchases.bySite')}</CardTitle>
            </CardHeader>
            <CardContent>
              {compras?.bySede?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {compras.bySede.map((s) => (
                    <div key={s.sede} className="rounded-md border p-3">
                      <div className="text-sm text-gray-600">{s.sede}</div>
                      <div className="text-sm text-gray-500">{s.count} {purchasesNoun(s.count)}</div>
                      <div className="text-xl font-bold mt-1">{formatCurrency(s.total)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">{t('reports.purchases.bySiteEmpty')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      ) : null}

      {/* Tarjetas de métricas secundarias */}
      {reportPrefs.sections.kpis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">{t('reports.kpis.conversionRate')}</p>
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold">{estadisticas.tasaConversion.toFixed(1)}%</p>
              <p className="text-xs text-gray-500 mt-1">{t('reports.kpis.conversionRateHint')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">{t('reports.kpis.avgSale')}</p>
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold">{formatCurrency(estadisticas.promedioVenta)}</p>
              <p className="text-xs text-gray-500 mt-1">{t('reports.kpis.avgSaleHint')}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Ventas mensuales */}
      {reportPrefs.sections.ventas ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {t('reports.sales.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reportPrefs.charts.ventasMensuales ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ventasMensuales}>
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="ventas" name={t('reports.common.sales')} fill="#2563eb" />
                    <Bar dataKey="ventasCount" name={t('reports.common.orders')} fill="#16a34a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="space-y-4">
                {ventasMensuales.map((mes) => {
                  const maxVentas = Math.max(...ventasMensuales.map((m) => m.ventas));
                  const porcentaje = maxVentas > 0 ? (mes.ventas / maxVentas) * 100 : 0;

                  return (
                    <div key={mes.mes}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{mes.mes}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold">{formatCurrency(mes.ventas)}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({mes.ventasCount} {ordersNoun(mes.ventasCount)})
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${porcentaje}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Top clientes */}
      {reportPrefs.sections.topClientes ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {t('reports.topCustomers.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topClientes.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t('reports.topCustomers.empty')}</p>
            ) : (
              <div className="space-y-4">
                {topClientes.map((cliente, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-bold">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{cliente.nombre}</p>
                        {cliente.empresa && <p className="text-sm text-gray-500">{cliente.empresa}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatCurrency(cliente.totalCompras)}</p>
                      <p className="text-sm text-gray-500">
                        {cliente.numOrdenes} {ordersNoun(cliente.numOrdenes)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
