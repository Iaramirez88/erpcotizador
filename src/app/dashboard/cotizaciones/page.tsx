'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  FileText, 
  Download, 
  Mail, 
  MessageCircle,
  Search, 
  Filter,
  Trash2,
  Plus,
  Pencil,
  CheckCircle,
  Clock,
  XCircle,
  ClipboardCheck,
  Eye,
  History
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import CotizacionPDF, { type CotizacionPdfData } from '@/lib/pdf-template.client';
import type { CotizacionTemplateSettings } from '@/lib/cotizacion-template';
import { useI18n } from '@/components/providers/i18n-provider';
import { buildWhatsAppWebUrl } from '@/lib/whatsapp-link';
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome';

function PdfPreviewLoading() {
  const { t } = useI18n();
  return <div className="flex h-96 items-center justify-center">{t('quotes.preview.loading')}</div>;
}

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <PdfPreviewLoading /> }
);

interface Cotizacion {
  id: string;
  numero: string;
  createdAt: string;
  estado: string;
  subtotal: number;
  iva: number;
  total: number;
  validezDias: number;
  postApprovalEditCount?: number;
  ventaRealizadaAt?: string | null;
  ganancia?: number | null;
  margenPct?: number | null;
  emailSentCount: number;
  whatsappSentCount: number;
  lastEmailSentAt?: string | null;
  lastWhatsappSentAt?: string | null;
  orden?: { id: string } | null;
  cliente: {
    nombre: string;
    email: string;
    telefono?: string | null;
  };
  items: {
    id: string;
    materialId?: string;
    descripcion?: string;
    cantidad?: number;
    unidad?: string;
    material?: {
      nombre: string;
    } | null;
  }[];
}

type AuditEvent = {
  id: string;
  action:
    | 'CREATED'
    | 'UPDATED'
    | 'APPROVED'
    | 'SENT'
    | 'SALE_REALIZED_SET'
    | 'SALE_REALIZED_UNSET';
  effect: 'NONE' | 'DEBIT' | 'CREDIT';
  note: string | null;
  autoSummary?: string[];
  before?: unknown;
  after?: unknown;
  createdAt: string;
  performedBy: { id: string; name: string | null; email: string } | null;
  requestedBy: { id: string; name: string | null; email: string } | null;
};

export default function CotizacionesPage() {
  const { t, language } = useI18n();
  const locale = language === 'en' ? 'en-US' : 'es-MX';

  // La facturación electrónica aún no está habilitada: se muestran opciones, pero quedan deshabilitadas.
  const electronicBillingEnabled = false;

  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroSede, setFiltroSede] = useState<string>('');
  const [sedes, setSedes] = useState<{ id: string; nombre: string; codigo?: string }[]>([]);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [compartiendo, setCompartiendo] = useState<string | null>(null);
  const [aprobando, setAprobando] = useState<string | null>(null);
  const [facturando, setFacturando] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<25 | 50 | 100 | 'all'>(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const pageCount = useMemo(() => {
    if (pageSize === 'all') return 1;
    return totalPages;
  }, [pageSize, totalPages]);

  // Estado para el preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);
  const [traceTarget, setTraceTarget] = useState<{ id: string; numero: string } | null>(null);
  const [previewNumero, setPreviewNumero] = useState<string | null>(null);
  const [previewCotizacion, setPreviewCotizacion] = useState<
    (CotizacionPdfData & { id: string; estado?: string }) | null
  >(null);
  const [previewTemplate, setPreviewTemplate] = useState<CotizacionTemplateSettings | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  const [diffOpen, setDiffOpen] = useState(false);
  const [diffEvent, setDiffEvent] = useState<AuditEvent | null>(null);

  const [ventaRealizadaBusy, setVentaRealizadaBusy] = useState(false);

  useEffect(() => {
    cargarCotizaciones({ page: 1 });
    cargarSedes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarSedes = async () => {
    try {
      const res = await fetch('/api/sedes');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setSedes(data.data);
        }
      }
    } catch (error) {
      console.error('Error cargando sedes:', error);
    }
  };

  const cargarCotizaciones = async (opts?: { page?: number; pageSize?: 25 | 50 | 100 | 'all' }) => {
    try {
      setLoading(true);
      const effectivePageSize = opts?.pageSize ?? pageSize;
      const params = new URLSearchParams();
      if (busqueda) params.append('search', busqueda);
      if (filtroEstado) params.append('estado', filtroEstado);
      if (filtroSede) params.append('sedeId', filtroSede);
      if (from) params.append('from', from);
      if (to) params.append('to', to);

      const pageToLoad = effectivePageSize === 'all' ? 1 : (opts?.page ?? page);
      if (effectivePageSize !== 'all') {
        params.append('page', String(pageToLoad));
        params.append('pageSize', String(effectivePageSize));
      } else {
        params.append('pageSize', 'all');
      }

      const res = await fetch(`/api/cotizaciones?${params.toString()}`);
      const contentType = res.headers.get('content-type') ?? '';
      const rawText = await res.text().catch(() => '');
      const response: unknown = (() => {
        if (!rawText) return {};
        try {
          return JSON.parse(rawText) as unknown;
        } catch {
          return {};
        }
      })();
      
      // El API retorna { success, data }
      if (
        res.ok &&
        response &&
        typeof response === 'object' &&
        'success' in response &&
        (response as any).success === true &&
        'data' in response &&
        Array.isArray((response as any).data)
      ) {
        const okResponse = response as any;
        setCotizaciones(okResponse.data);
        const meta = okResponse.meta as
          | { page?: number; pageSize?: number | 'all'; total?: number; totalPages?: number }
          | undefined;
        const nextTotalPages = typeof meta?.totalPages === 'number' && meta.totalPages > 0 ? meta.totalPages : 1;
        const nextTotal = typeof meta?.total === 'number' && meta.total >= 0 ? meta.total : okResponse.data.length;

        setTotalPages(effectivePageSize === 'all' ? 1 : nextTotalPages);
        setTotal(nextTotal);
        setPage(effectivePageSize === 'all' ? 1 : pageToLoad);
      } else {
        const apiError =
          response && typeof response === 'object' && 'error' in response && typeof (response as any).error === 'string'
            ? (response as any).error
            : null;
        console.error('La respuesta no tiene el formato esperado:', {
          status: res.status,
          ok: res.ok,
          contentType,
          rawStart: rawText ? rawText.slice(0, 220) : null,
          error: apiError,
          response,
        });
        setCotizaciones([]);
        setTotalPages(1);
        setTotal(0);
      }
    } catch (error) {
      console.error('Error:', error);
      setCotizaciones([]);
      setTotalPages(1);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const params = new URLSearchParams();
    if (busqueda) params.append('search', busqueda);
    if (filtroEstado) params.append('estado', filtroEstado);
    if (filtroSede) params.append('sedeId', filtroSede);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    const url = params.toString() ? `/api/cotizaciones/export?${params}` : '/api/cotizaciones/export';
    window.location.href = url;
  };

  const descargarPDF = async (id: string, numero: string) => {
    try {
      const res = await fetch(`/api/cotizaciones/${id}/pdf`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('quotes.pdf.filenamePrefix')}-${numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error descargando PDF:', error);
      alert(t('quotes.errors.downloadPdf'));
    }
  };

  const enviarPorEmail = async (cotizacion: Cotizacion) => {
    const confirmar = window.confirm(
      t('quotes.confirm.sendEmail', { numero: cotizacion.numero, email: cotizacion.cliente.email })
    );
    
    if (!confirmar) return;

    setEnviando(cotizacion.id);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacion.id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinatarios: [cotizacion.cliente.email],
          copiarContabilidad: cotizacion.estado === 'APROBADA',
        }),
      });

      if (res.ok) {
        alert(t('quotes.success.emailSent'));
        cargarCotizaciones();
      } else {
        const error = await res.json();
        alert(t('common.errorWithDetails', { details: error.error }));
      }
    } catch (error) {
      console.error('Error:', error);
      alert(t('quotes.errors.sendEmail'));
    } finally {
      setEnviando(null);
    }
  };

  const compartirPorWhatsApp = async (cotizacion: Cotizacion) => {
    setCompartiendo(cotizacion.id);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacion.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttlSeconds: 60 * 60 * 24 * 14 }),
      });

      const json = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !json?.success) {
        alert(
          t('quotes.errors.whatsappLink', {
            details: json?.error ?? t('common.error'),
          })
        );
        return;
      }

      const url: string = json.data.url;
      const mensaje = buildWhatsAppMessage(cotizacion, url);

      const whatsappUrl = buildWhatsAppWebUrl({
        phone: cotizacion.cliente?.telefono,
        message: mensaje,
      });
      window.open(whatsappUrl, '_blank');
      cargarCotizaciones();
    } catch (error) {
      console.error('Error:', error);
      alert(t('quotes.errors.whatsappPrepare'));
    } finally {
      setCompartiendo(null);
    }
  };

  const eliminarCotizacion = async (id: string, numero: string) => {
    const confirmar = window.confirm(
      t('quotes.confirm.delete', { numero })
    );
    
    if (!confirmar) return;

    try {
      const res = await fetch(`/api/cotizaciones/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert(t('quotes.success.deleted'));
        cargarCotizaciones();
      } else {
        const error = await res.json();
        alert(t('common.errorWithDetails', { details: error.error }));
      }
    } catch (error) {
      console.error('Error:', error);
      alert(t('quotes.errors.delete'));
    }
  };

  const cargarAuditoria = async (cotizacionId: string) => {
    try {
      const auditRes = await fetch(`/api/cotizaciones/${cotizacionId}/audit`, { cache: 'no-store' });
      if (!auditRes.ok) {
        setAuditEvents([]);
        return;
      }

      const auditJson = await auditRes.json().catch(() => null);
      const events = auditJson?.success ? auditJson?.data?.events : null;
      setAuditEvents(Array.isArray(events) ? (events as AuditEvent[]) : []);
    } catch {
      setAuditEvents([]);
    }
  };

  const abrirTrazabilidad = async (cotizacion: Cotizacion) => {
    try {
      setTraceTarget({ id: cotizacion.id, numero: cotizacion.numero });
      setAuditEvents([]);
      setTraceOpen(true);
      await cargarAuditoria(cotizacion.id);
    } catch {
      setAuditEvents([]);
      setTraceOpen(true);
    }
  };

  const abrirPreview = async (cotizacion: Cotizacion) => {
    try {
      setPreviewNumero(cotizacion.numero);
      setPreviewOpen(true);
      setPreviewTemplate(null);
      setPreviewCotizacion(null);
      setAuditEvents([]);

      const res = await fetch(`/api/cotizaciones/${cotizacion.id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(t('quotes.errors.loadQuote'));
      const data = await res.json();
      if (!data?.success || !data?.data) throw new Error(data?.error ?? t('quotes.errors.loadQuote'));
      setPreviewCotizacion(data.data as CotizacionPdfData & { id: string; estado?: string });

      await cargarAuditoria(cotizacion.id);

      const templateRes = await fetch('/api/cotizacion-template', { cache: 'no-store' });
      if (templateRes.ok) {
        const templateData = await templateRes.json();
        const settings = templateData?.success && templateData?.data?.settings
          ? (templateData.data.settings as CotizacionTemplateSettings)
          : null;
        setPreviewTemplate(settings);
      } else {
        setPreviewTemplate(null);
      }
    } catch (error) {
      console.error('Error al cargar datos para preview:', error);
      alert(t('quotes.errors.loadPreview'));
      setPreviewCotizacion(null);
      setPreviewTemplate(null);
      setPreviewNumero(null);
      setPreviewOpen(false);
      setAuditEvents([]);
    }
  };

  const setVentaRealizada = async (nextValue: boolean) => {
    if (!previewCotizacion?.id) return;
    setVentaRealizadaBusy(true);
    try {
      const res = await fetch(`/api/cotizaciones/${previewCotizacion.id}/venta-realizada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: nextValue }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        alert(t('common.errorWithDetails', { details: json?.error ?? 'No se pudo actualizar' }));
        return;
      }

      const ventaRealizadaAt = (json?.data as { ventaRealizadaAt?: string | null } | null)?.ventaRealizadaAt ?? null;
      setPreviewCotizacion((prev) => (prev ? ({ ...prev, ventaRealizadaAt } as typeof prev) : prev));
      await cargarAuditoria(previewCotizacion.id);
      cargarCotizaciones();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar venta realizada');
    } finally {
      setVentaRealizadaBusy(false);
    }
  };

  const crearOrden = async (cotizacionId: string, numero: string) => {
    const confirmar = window.confirm(t('quotes.confirm.createOrder', { numero }));
    
    if (!confirmar) return;

    try {
      const res = await fetch('/api/ordenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacionId }),
      });

      const response = await res.json();

      if (response.success) {
        alert(t('quotes.success.orderCreated', { numero: response.data.numero }));
        cargarCotizaciones(); // Recargar para actualizar estados
        // Opcional: redirigir a la página de órdenes
        // window.location.href = '/dashboard/ordenes';
      } else {
        alert(t('common.errorWithDetails', { details: response.error }));
      }
    } catch (error) {
      console.error('Error:', error);
      alert(t('quotes.errors.createOrder'));
    }
  };

  const aprobarCotizacion = async (cotizacionId: string, numero: string) => {
    const confirmar = window.confirm(t('quotes.confirm.approve', { numero }));
    if (!confirmar) return;

    setAprobando(cotizacionId);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/aprobar`, { method: 'POST' });
      const json = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !json?.success) {
        alert(t('common.errorWithDetails', { details: json?.error ?? t('quotes.errors.approveFallback') }));
        return;
      }
      cargarCotizaciones();
    } catch (error) {
      console.error('Error:', error);
      alert(t('quotes.errors.approve'));
    } finally {
      setAprobando(null);
    }
  };

  const facturarCotizacion = async (cotizacionId: string, numero: string) => {
    if (!electronicBillingEnabled) {
      alert(t('quoteBuilder.preview.billingDisabled'));
      return;
    }
    const confirmar = window.confirm(t('quotes.confirm.createInvoice', { numero }));
    if (!confirmar) return;

    setFacturando(cotizacionId);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/facturar`, { method: 'POST' });
      const json = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !json?.ok || !json?.data) {
        alert(t('common.errorWithDetails', { details: json?.error ?? t('quotes.errors.createInvoiceFallback') }));
        return;
      }

      const inv = json.data as { id: string; numero: string; alreadyExisted?: boolean };
      const msg = inv.alreadyExisted
        ? t('quotes.invoice.alreadyExists', { numero: inv.numero })
        : t('quotes.invoice.created', { numero: inv.numero });

      const go = window.confirm(`${msg}.\n\n${t('quotes.invoice.goToHistory')}`);
      if (go) {
        window.location.href = '/dashboard/pos';
        return;
      }

      // Mantener lista actualizada (por si luego se quiere reflejar estado)
      cargarCotizaciones();
    } catch (error) {
      console.error('Error:', error);
      alert(t('quotes.errors.createInvoice'));
    } finally {
      setFacturando(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'MXN',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const parseLitografiaMetaFromObservaciones = (
    raw: unknown
  ): { costoProduccion: number; precioVenta: number } | null => {
    if (typeof raw !== 'string') return null;
    const idx = raw.indexOf('LITOGRAFIA_META:');
    if (idx < 0) return null;
    const json = raw.slice(idx + 'LITOGRAFIA_META:'.length).trim();
    if (!json) return null;
    try {
      const parsed = JSON.parse(json) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      const rec = parsed as Record<string, unknown>;
      const version = Number(rec.version);
      if (![1, 2].includes(version)) return null;
      const costoProduccion =
        typeof rec.costoProduccion === 'number' ? rec.costoProduccion : Number(rec.costoProduccion);
      const precioVenta =
        typeof rec.precioVenta === 'number' ? rec.precioVenta : Number(rec.precioVenta);
      if (!Number.isFinite(costoProduccion) || !Number.isFinite(precioVenta)) return null;
      return { costoProduccion, precioVenta };
    } catch {
      return null;
    }
  };

  const computeGananciaFromItems = (itemsRaw: unknown): { ganancia: number | null; margenPct: number | null } => {
    const items = Array.isArray(itemsRaw) ? (itemsRaw as Array<Record<string, unknown>>) : [];
    if (!items.length) return { ganancia: null, margenPct: null };

    let venta = 0;
    let costo = 0;

    for (const it of items) {
      const meta = parseLitografiaMetaFromObservaciones(it.observaciones);
      if (meta) {
        venta += meta.precioVenta;
        costo += meta.costoProduccion;
        continue;
      }

      const subtotal = typeof it.subtotal === 'number' ? it.subtotal : Number(it.subtotal);
      venta += Number.isFinite(subtotal) ? subtotal : 0;

      const qty = typeof it.cantidad === 'number' ? it.cantidad : Number(it.cantidad);
      const q = Number.isFinite(qty) ? qty : 0;

      const cm = typeof it.costoMaterial === 'number' ? it.costoMaterial : Number(it.costoMaterial);
      const ci = typeof it.costoImpresion === 'number' ? it.costoImpresion : Number(it.costoImpresion);
      const ca = typeof it.costoAcabados === 'number' ? it.costoAcabados : Number(it.costoAcabados);
      const cins = typeof it.costoInstalacion === 'number' ? it.costoInstalacion : Number(it.costoInstalacion);

      costo += (Number.isFinite(cm) ? cm : 0) * q;
      costo += (Number.isFinite(ci) ? ci : 0) * q;
      costo += Number.isFinite(ca) ? ca : 0;
      costo += Number.isFinite(cins) ? cins : 0;
    }

    if (venta <= 0) return { ganancia: null, margenPct: null };
    const ganancia = venta - costo;
    const margenPct = (ganancia / venta) * 100;
    return { ganancia, margenPct };
  };

  const previewGanancia = useMemo(() => {
    const items = (previewCotizacion as unknown as { items?: unknown } | null)?.items;
    return computeGananciaFromItems(items);
  }, [previewCotizacion]);

  const buildWhatsAppMessage = (cotizacion: Cotizacion, pdfUrl: string) => {
    const createdAt = new Date(cotizacion.createdAt);
    const validUntil = new Date(
      createdAt.getTime() + cotizacion.validezDias * 24 * 60 * 60 * 1000
    );

    const resumenItems = (cotizacion.items || [])
      .slice(0, 4)
      .map((it) => {
        const name = it.descripcion?.trim() || it.material?.nombre?.trim() || t('quotes.whatsapp.itemFallback');
        const qty = typeof it.cantidad === 'number' && !Number.isNaN(it.cantidad) ? it.cantidad : null;
        const unit = it.unidad?.trim();
        const qtyLabel = qty !== null ? `${qty}${unit ? ` ${unit}` : ''}` : null;
        return `• ${qtyLabel ? `${qtyLabel} - ` : ''}${name}`;
      })
      .join('\n');

    const hayMasItems = (cotizacion.items?.length ?? 0) > 4;

    return [
      '*SGDigital Softwares*',
      t('quotes.whatsapp.title', { numero: cotizacion.numero }),
      '',
      t('quotes.whatsapp.client', { name: cotizacion.cliente?.nombre ?? '-' }),
      t('quotes.whatsapp.total', { total: formatCurrency(cotizacion.total) }),
      t('quotes.whatsapp.date', { date: createdAt.toLocaleDateString(locale) }),
      t('quotes.whatsapp.validUntil', { date: validUntil.toLocaleDateString(locale) }),
      '',
      resumenItems
        ? t('quotes.whatsapp.summaryHeader') + '\n' + resumenItems + (hayMasItems ? '\n• …' : '')
        : '',
      '',
      t('quotes.whatsapp.pdf', { url: pdfUrl }),
      '',
      t('quotes.whatsapp.closing'),
    ]
      .filter(Boolean)
      .join('\n');
  };

  const getEstadoColor = (estado: string) => {
    const colores: Record<string, string> = {
      BORRADOR: 'bg-gray-100 text-gray-800',
      ENVIADA: 'bg-blue-100 text-blue-800',
      APROBADA: 'bg-green-100 text-green-800',
      RECHAZADA: 'bg-red-100 text-red-800',
      VENCIDA: 'bg-orange-100 text-orange-800',
    };
    return colores[estado] || 'bg-gray-100 text-gray-800';
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'APROBADA':
        return <CheckCircle className="w-4 h-4" />;
      case 'ENVIADA':
        return <Clock className="w-4 h-4" />;
      case 'RECHAZADA':
      case 'VENCIDA':
        return <XCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getEstadoLabel = (estado: string) => {
    switch (estado) {
      case 'BORRADOR':
        return t('quotes.status.draft');
      case 'ENVIADA':
        return t('quotes.status.sent');
      case 'APROBADA':
        return t('quotes.status.approved');
      case 'RECHAZADA':
        return t('quotes.status.rejected');
      case 'VENCIDA':
        return t('quotes.status.expired');
      case 'CONVERTIDA':
        return t('quotes.status.converted');
      default:
        return estado;
    }
  };

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6">
      <ErpPageHero
        eyebrow="ERP comercial"
        title={t('quotes.page.title')}
        description={t('quotes.page.subtitle')}
        actions={
          <>
            <Link href="/dashboard/cotizaciones/plantilla">
              <Button variant="outline">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                {t('quotes.actions.editTemplate')}
              </Button>
            </Link>
            <Button variant="outline" onClick={exportExcel}>
              <Download className="mr-2 h-4 w-4" />
              {t('quotes.actions.exportExcel')}
            </Button>
            <Link href="/dashboard/cotizador">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('quotes.actions.newQuote')}
              </Button>
            </Link>
          </>
        }
        stats={[
          { label: 'Cotizaciones', value: total, hint: 'Resultados en paginación', tone: 'neutral' },
          { label: 'Página', value: `${page}/${pageCount || 1}`, hint: 'Navegación actual', tone: 'sky' },
          {
            label: 'Estado',
            value: filtroEstado ? getEstadoLabel(filtroEstado) : t('quotes.filters.allStatuses'),
            hint: filtroSede ? sedes.find((sede) => sede.id === filtroSede)?.nombre || filtroSede : t('quotes.filters.allBranches'),
            tone: 'teal',
          },
        ]}
      />

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder={t('quotes.filters.searchPlaceholder')}
                className="pl-10"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              title={t('quotes.filters.from')}
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              title={t('quotes.filters.to')}
            />

            <select
              className="px-3 py-2 border rounded-md"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="">{t('quotes.filters.allStatuses')}</option>
              <option value="BORRADOR">{getEstadoLabel('BORRADOR')}</option>
              <option value="ENVIADA">{getEstadoLabel('ENVIADA')}</option>
              <option value="APROBADA">{getEstadoLabel('APROBADA')}</option>
              <option value="RECHAZADA">{getEstadoLabel('RECHAZADA')}</option>
              <option value="VENCIDA">{getEstadoLabel('VENCIDA')}</option>
            </select>

            <select
              className="px-3 py-2 border rounded-md"
              value={filtroSede}
              onChange={(e) => setFiltroSede(e.target.value)}
            >
              <option value="">{t('quotes.filters.allBranches')}</option>
              {sedes.map((sede) => (
                <option key={sede.id} value={sede.id}>
                  {sede.codigo ? `${sede.codigo} - ` : ''}{sede.nombre}
                </option>
              ))}
            </select>

            <Button
              onClick={() => cargarCotizaciones({ page: 1 })}
              variant="outline"
              className="md:col-span-1"
            >
              <Filter className="w-4 h-4 mr-2" />
              {t('quotes.filters.apply')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Cotizaciones */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : cotizaciones.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">{t('quotes.empty.title')}</p>
            <Link href="/dashboard/cotizador">
              <Button>{t('quotes.empty.createFirst')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {cotizaciones.map((cot) => (
            <Card key={cot.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{cot.numero}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getEstadoColor(
                          cot.estado
                        )}`}
                      >
                        {getEstadoIcon(cot.estado)}
                        {getEstadoLabel(cot.estado)}
                      </span>
                      {cot.ventaRealizadaAt ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Venta realizada
                        </span>
                      ) : null}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-muted-foreground mb-2">
                      <div>
                        <span className="font-medium">{t('quotes.fields.client')}</span>
                        <p className="text-gray-900">{cot.cliente.nombre}</p>
                      </div>
                      <div>
                        <span className="font-medium">{t('quotes.fields.date')}</span>
                        <p className="text-gray-900">{formatDate(cot.createdAt)}</p>
                      </div>
                      <div>
                        <span className="font-medium">{t('quotes.fields.items')}</span>
                        <p className="text-gray-900">{cot.items.length}</p>
                        {(cot.postApprovalEditCount ?? 0) > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Post-aprob.: {cot.postApprovalEditCount}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <span className="font-medium">{t('quotes.fields.total')}</span>
                        <p className="text-gray-900 text-lg font-semibold">
                          {formatCurrency(cot.total)}
                        </p>
                        {typeof cot.ganancia === 'number' && Number.isFinite(cot.ganancia) ? (
                          <p className="text-xs text-muted-foreground">
                            Ganancia: {formatCurrency(cot.ganancia)}
                            {typeof cot.margenPct === 'number' && Number.isFinite(cot.margenPct)
                              ? ` (${cot.margenPct.toFixed(1)}%)`
                              : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 ml-4">
                    {/* Preview */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirPreview(cot)}
                      title={t('quotes.actions.preview')}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>

                    {/* Trazabilidad */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void abrirTrazabilidad(cot)}
                      title="Trazabilidad"
                    >
                      <History className="w-4 h-4" />
                    </Button>

                    {/* Editar (permitido también en aprobadas; se bloquea si ya tiene orden) */}
                    {!cot.orden ? (
                      <Link href={`/dashboard/cotizador?id=${cot.id}`}>
                        <Button size="sm" variant="outline" title={t('quotes.actions.edit')}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        title="No se puede editar: tiene una orden asociada"
                        disabled
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Aprobar */}
                    {cot.estado !== 'APROBADA' && cot.estado !== 'CONVERTIDA' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => aprobarCotizacion(cot.id, cot.numero)}
                        disabled={aprobando === cot.id}
                        title={t('quotes.actions.approveToSend')}
                      >
                        {aprobando === cot.id ? (
                          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </Button>
                    )}

                    {/* Crear factura (solo si está aprobada) */}
                    {cot.estado === 'APROBADA' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => facturarCotizacion(cot.id, cot.numero)}
                        title={!electronicBillingEnabled ? t('quoteBuilder.preview.billingDisabled') : t('quotes.actions.createInvoice')}
                        disabled={!electronicBillingEnabled || facturando === cot.id}
                      >
                        {facturando === cot.id ? (
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FileText className="w-4 h-4" />
                        )}
                      </Button>
                    ) : null}

                    {/* Botón para crear orden (solo si está aprobada y no tiene orden) */}
                    {cot.estado === 'APROBADA' && !cot.orden && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => crearOrden(cot.id, cot.numero)}
                        title={t('quotes.actions.createOrder')}
                      >
                        <ClipboardCheck className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">{t('quotes.actions.createOrderShort')}</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => descargarPDF(cot.id, cot.numero)}
                      title={t('quotes.actions.downloadPdf')}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => enviarPorEmail(cot)}
                      disabled={enviando === cot.id}
                      title={t('quotes.actions.sendEmail')}
                      className="relative"
                    >
                      {enviando === cot.id ? (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}

                      {cot.emailSentCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] px-1 flex items-center justify-center">
                          {cot.emailSentCount}
                        </span>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => compartirPorWhatsApp(cot)}
                      disabled={compartiendo === cot.id}
                      title={t('quotes.actions.shareWhatsapp')}
                      className="relative"
                    >
                      {compartiendo === cot.id ? (
                        <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <MessageCircle className="w-4 h-4" />
                      )}

                      {cot.whatsappSentCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] px-1 flex items-center justify-center">
                          {cot.whatsappSentCount}
                        </span>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => eliminarCotizacion(cot.id, cot.numero)}
                      title={t('quotes.actions.delete')}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Paginación */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
            <div className="text-sm text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{cotizaciones.length}</span> de{' '}
              <span className="font-medium text-foreground">{total}</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={String(pageSize)}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = v === 'all' ? 'all' : (Number(v) as 25 | 50 | 100);
                  setPageSize(next);
                  cargarCotizaciones({ page: 1, pageSize: next });
                }}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="all">Todos</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                disabled={loading || pageSize === 'all' || page <= 1}
                onClick={() => cargarCotizaciones({ page: Math.max(1, page - 1) })}
              >
                {t('quotes.pagination.previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || pageSize === 'all' || page >= pageCount}
                onClick={() => cargarCotizaciones({ page: Math.min(pageCount, page + 1) })}
              >
                {t('quotes.pagination.next')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog para Preview PDF */}
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (open) return;
          setPreviewNumero(null);
          setPreviewCotizacion(null);
          setPreviewTemplate(null);
          setAuditEvents([]);
          setTraceOpen(false);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {t('quotes.preview.title', {
                numero: previewCotizacion?.numero ?? previewNumero ?? '',
              })}
            </DialogTitle>
          </DialogHeader>
          
          <div className="h-[600px] w-full overflow-hidden rounded border">
            {previewCotizacion ? (
              <PDFViewer width="100%" height="100%">
                <CotizacionPDF
                  cotizacion={previewCotizacion}
                  template={previewTemplate || undefined}
                />
              </PDFViewer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t('quotes.preview.loading')}
              </div>
            )}
          </div>

          {previewCotizacion?.id ? (
            <div className="mt-3 space-y-2 rounded border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="font-medium">Trazabilidad</div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTraceOpen(true)}
                    disabled={!auditEvents.length}
                  >
                    Ver trazabilidad
                  </Button>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-muted-foreground">
                  <div>
                    Total: <span className="text-foreground font-medium">{formatCurrency(previewCotizacion.total)}</span>
                    {typeof previewGanancia.ganancia === 'number' && Number.isFinite(previewGanancia.ganancia) ? (
                      <>
                        {' '}• Ganancia:{' '}
                        <span className="text-foreground font-medium">{formatCurrency(previewGanancia.ganancia)}</span>
                        {typeof previewGanancia.margenPct === 'number' && Number.isFinite(previewGanancia.margenPct)
                          ? ` (${previewGanancia.margenPct.toFixed(1)}%)`
                          : ''}
                      </>
                    ) : null}
                  </div>

                  <div>
                    Ediciones: {auditEvents.filter((e) => e.action === 'UPDATED').length}
                    {typeof (previewCotizacion as unknown as { postApprovalEditCount?: unknown }).postApprovalEditCount === 'number'
                      ? ` • Post-aprob.: ${(previewCotizacion as unknown as { postApprovalEditCount: number }).postApprovalEditCount}`
                      : ''}
                  </div>

                  <div className="flex items-center gap-2">
                    <span>Venta realizada</span>
                    <Switch
                      checked={Boolean((previewCotizacion as unknown as { ventaRealizadaAt?: unknown }).ventaRealizadaAt)}
                      onCheckedChange={(checked) => setVentaRealizada(checked)}
                      disabled={ventaRealizadaBusy || String((previewCotizacion as unknown as { estado?: unknown }).estado) !== 'APROBADA'}
                    />
                  </div>
                </div>
              </div>

              {auditEvents.length ? (
                <div className="max-h-40 overflow-auto">
                  <div className="space-y-1">
                    {auditEvents.map((e) => {
                      const fecha = new Date(e.createdAt).toLocaleString(locale);
                      const performed = e.performedBy?.name || e.performedBy?.email || '-';
                      const requested = e.requestedBy?.name || e.requestedBy?.email || null;
                      const who = requested && requested !== performed
                        ? `Solicitó: ${requested} • Ejecutó: ${performed}`
                        : `Por: ${performed}`;

                      const effectLabel =
                        e.effect === 'DEBIT'
                          ? ' (Nota débito)'
                          : e.effect === 'CREDIT'
                            ? ' (Nota crédito)'
                            : '';

                      const channel = (e.after && typeof e.after === 'object')
                        ? String((e.after as Record<string, unknown>).channel || '')
                        : '';

                      const actionLabel =
                        e.action === 'CREATED'
                          ? 'Creada'
                          : e.action === 'APPROVED'
                            ? 'Aprobada'
                            : e.action === 'SENT'
                              ? (channel ? `Enviada (${channel})` : 'Enviada')
                              : e.action === 'SALE_REALIZED_SET'
                                ? 'Venta realizada (marcada)'
                                : e.action === 'SALE_REALIZED_UNSET'
                                  ? 'Venta realizada (desmarcada)'
                                  : `Editada${effectLabel}`;

                      const canDiff = e.action === 'UPDATED' && Boolean(e.before) && Boolean(e.after);

                      return (
                        <div key={e.id} className="flex flex-col gap-0.5 rounded px-2 py-1 hover:bg-muted/50">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium">{actionLabel}</div>
                            <div className="flex items-center gap-2">
                              {canDiff ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setDiffEvent(e);
                                    setDiffOpen(true);
                                  }}
                                >
                                  Ver cambios
                                </Button>
                              ) : null}
                              <div className="text-muted-foreground">{fecha}</div>
                            </div>
                          </div>
                          <div className="text-muted-foreground">{who}</div>
                          {Array.isArray(e.autoSummary) && e.autoSummary.length ? (
                            <div className="text-muted-foreground">
                              {e.autoSummary.slice(0, 2).map((line, idx) => (
                                <div key={idx}>{line}</div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">Sin registros</div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Dialog para trazabilidad (automática) */}
      <Dialog
        open={traceOpen}
        onOpenChange={(open) => {
          setTraceOpen(open);
          if (!open) {
            setTraceTarget(null);
            setAuditEvents([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Trazabilidad de cambios{traceTarget?.numero ? ` (${traceTarget.numero})` : ''}
            </DialogTitle>
          </DialogHeader>

          {auditEvents.length ? (
            <div className="space-y-2 text-sm">
              {auditEvents.map((e) => {
                const fecha = new Date(e.createdAt).toLocaleString(locale);
                const performed = e.performedBy?.name || e.performedBy?.email || '-';
                const requested = e.requestedBy?.name || e.requestedBy?.email || null;
                const who = requested && requested !== performed
                  ? `Solicitó: ${requested} • Ejecutó: ${performed}`
                  : `Por: ${performed}`;

                const effectLabel =
                  e.effect === 'DEBIT'
                    ? ' (Nota débito)'
                    : e.effect === 'CREDIT'
                      ? ' (Nota crédito)'
                      : '';

                const channel = (e.after && typeof e.after === 'object')
                  ? String((e.after as Record<string, unknown>).channel || '')
                  : '';

                const actionLabel =
                  e.action === 'CREATED'
                    ? 'Creada'
                    : e.action === 'APPROVED'
                      ? 'Aprobada'
                      : e.action === 'SENT'
                        ? (channel ? `Enviada (${channel})` : 'Enviada')
                        : e.action === 'SALE_REALIZED_SET'
                          ? 'Venta realizada (marcada)'
                          : e.action === 'SALE_REALIZED_UNSET'
                            ? 'Venta realizada (desmarcada)'
                            : `Editada${effectLabel}`;

                return (
                  <div key={e.id} className="rounded border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{actionLabel}</div>
                      <div className="text-muted-foreground">{fecha}</div>
                    </div>
                    <div className="text-muted-foreground">{who}</div>

                    {Array.isArray(e.autoSummary) && e.autoSummary.length ? (
                      <div className="mt-2 space-y-1">
                        {e.autoSummary.map((line, idx) => (
                          <div key={idx}>{line}</div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-muted-foreground">Sin detalle automático</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">Sin registros</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para ver cambios (diff) */}
      <Dialog
        open={diffOpen}
        onOpenChange={(open) => {
          setDiffOpen(open);
          if (open) return;
          setDiffEvent(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Ver cambios</DialogTitle>
          </DialogHeader>

          {diffEvent ? (
            (() => {
              const before = diffEvent.before && typeof diffEvent.before === 'object'
                ? (diffEvent.before as Record<string, unknown>)
                : {};
              const after = diffEvent.after && typeof diffEvent.after === 'object'
                ? (diffEvent.after as Record<string, unknown>)
                : {};

              const beforeItemsRaw = Array.isArray(before.items) ? (before.items as unknown[]) : [];
              const afterItemsRaw = Array.isArray(after.items) ? (after.items as unknown[]) : [];

              const norm = (x: unknown) => {
                const it = x && typeof x === 'object' ? (x as Record<string, unknown>) : {};
                return {
                  materialId: typeof it.materialId === 'string' ? it.materialId : null,
                  descripcion: String(it.descripcion || '').trim(),
                  unidad: String(it.unidad || '').trim(),
                  cantidad: Number(it.cantidad) || 0,
                  precioUnitario: Number(it.precioUnitario) || 0,
                  subtotal: Number(it.subtotal) || 0,
                };
              };

              const beforeItems = beforeItemsRaw.map(norm);
              const afterItems = afterItemsRaw.map(norm);

              const keyOf = (it: ReturnType<typeof norm>) =>
                `${it.materialId ?? ''}::${it.descripcion}::${it.unidad}`;

              const group = (items: Array<ReturnType<typeof norm>>) => {
                const map = new Map<string, Array<ReturnType<typeof norm>>>();
                for (const it of items) {
                  const k = keyOf(it);
                  const arr = map.get(k);
                  if (arr) arr.push(it);
                  else map.set(k, [it]);
                }
                return map;
              };

              const bMap = group(beforeItems);
              const aMap = group(afterItems);
              const allKeys = new Set<string>([...Array.from(bMap.keys()), ...Array.from(aMap.keys())]);

              const added: Array<ReturnType<typeof norm>> = [];
              const removed: Array<ReturnType<typeof norm>> = [];
              const changed: Array<{ before: ReturnType<typeof norm>; after: ReturnType<typeof norm> }> = [];

              for (const k of allKeys) {
                const b = bMap.get(k) ?? [];
                const a = aMap.get(k) ?? [];
                const m = Math.min(b.length, a.length);
                for (let i = 0; i < m; i++) {
                  const bb = b[i];
                  const aa = a[i];
                  if (
                    bb.cantidad !== aa.cantidad ||
                    Math.abs(bb.precioUnitario - aa.precioUnitario) > 1e-9 ||
                    Math.abs(bb.subtotal - aa.subtotal) > 1e-9
                  ) {
                    changed.push({ before: bb, after: aa });
                  }
                }
                for (let i = m; i < b.length; i++) removed.push(b[i]);
                for (let i = m; i < a.length; i++) added.push(a[i]);
              }

              const beforeTotal = Number(before.total) || 0;
              const afterTotal = Number(after.total) || 0;
              const beforeSub = Number(before.subtotal) || 0;
              const afterSub = Number(after.subtotal) || 0;

              return (
                <div className="space-y-4 text-sm">
                  <div className="rounded border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">Totales</div>
                      <div className="text-muted-foreground">
                        Subtotal: {formatCurrency(beforeSub)} → {formatCurrency(afterSub)}
                        {' '}• Total: {formatCurrency(beforeTotal)} → {formatCurrency(afterTotal)}
                      </div>
                    </div>
                  </div>

                  {changed.length ? (
                    <div className="rounded border p-3">
                      <div className="font-medium mb-2">Modificados</div>
                      <div className="space-y-2">
                        {changed.map((x, idx) => (
                          <div key={`chg-${idx}`} className="rounded bg-muted/40 p-2">
                            <div className="font-medium">{x.after.descripcion || x.before.descripcion || 'Ítem'}</div>
                            <div className="text-muted-foreground">
                              Cant: {x.before.cantidad} → {x.after.cantidad}
                              {' '}• Unit: {formatCurrency(x.before.precioUnitario)} → {formatCurrency(x.after.precioUnitario)}
                              {' '}• Subtotal: {formatCurrency(x.before.subtotal)} → {formatCurrency(x.after.subtotal)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {added.length ? (
                    <div className="rounded border p-3">
                      <div className="font-medium mb-2">Agregados</div>
                      <div className="space-y-1">
                        {added.map((x, idx) => (
                          <div key={`add-${idx}`} className="text-muted-foreground">
                            + {x.cantidad}{x.unidad ? ` ${x.unidad}` : ''} • {x.descripcion || 'Ítem'} • {formatCurrency(x.subtotal)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {removed.length ? (
                    <div className="rounded border p-3">
                      <div className="font-medium mb-2">Eliminados</div>
                      <div className="space-y-1">
                        {removed.map((x, idx) => (
                          <div key={`rem-${idx}`} className="text-muted-foreground">
                            - {x.cantidad}{x.unidad ? ` ${x.unidad}` : ''} • {x.descripcion || 'Ítem'} • {formatCurrency(x.subtotal)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {!changed.length && !added.length && !removed.length ? (
                    <div className="text-muted-foreground">No se detectaron cambios en los ítems.</div>
                  ) : null}
                </div>
              );
            })()
          ) : (
            <div className="text-muted-foreground">Sin datos de cambios.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
