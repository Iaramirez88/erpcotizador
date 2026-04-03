'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImportDialog } from '@/components/import/import-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome';
import { useI18n } from '@/components/providers/i18n-provider';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Download,
  Search,
  Filter,
  Plus,
  Clock,
  PlayCircle,
  CheckCircle,
  XCircle,
  Truck,
  Trash2,
  CalendarClock,
  UserRound,
  ClipboardList,
  PencilLine,
  ListTodo,
  ExternalLink,
  SquarePlus,
} from 'lucide-react';
import Link from 'next/link';

type OrdenEstadoVisible = 'PENDIENTE' | 'EN_PROCESO' | 'TERMINADO' | 'ENTREGADO' | 'CANCELADO';

type OrdenItemSnapshot = {
  descripcion?: string;
  cantidad?: number;
  terminados?: string[];
};

type ResponsableOption = {
  id: string;
  name: string | null;
  email: string | null;
};

interface OrdenTrabajo {
  id: string;
  numero: string;
  createdAt: string;
  fechaInicio?: string | null;
  fechaEntrega?: string | null;
  estado: string;
  areaResponsable?: string | null;
  observaciones?: string | null;
  sourceType?: string | null;
  itemsSnapshot?: Array<OrdenItemSnapshot> | null;
  subtotal: number;
  iva: number;
  total: number;
  tareaSeguimiento?: {
    id: string;
    title: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';
    workspaceId?: string | null;
  } | null;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  vendedor?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  cliente: {
    nombre: string;
    email?: string | null;
    telefono?: string | null;
    empresa?: string | null;
  };
  cotizacion?: {
    numero: string;
    _count?: {
      items: number;
    };
  };
  posInvoice?: {
    numero: string;
  } | null;
}

type OrdenEditForm = {
  estado: OrdenEstadoVisible;
  assignedToUserId: string;
  areaResponsable: string;
  fechaEntrega: string;
  notas: string;
};

const STATUS_OPTIONS: Array<{ value: OrdenEstadoVisible; color: string }> = [
  { value: 'PENDIENTE', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'EN_PROCESO', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'TERMINADO', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'ENTREGADO', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  { value: 'CANCELADO', color: 'bg-rose-100 text-rose-800 border-rose-200' },
];

function normalizeVisibleStatus(estado: string): OrdenEstadoVisible {
  if (estado === 'PENDIENTE') return 'PENDIENTE';
  if (
    estado === 'RECIBIDO' ||
    estado === 'COTIZADO' ||
    estado === 'APROBADO' ||
    estado === 'EN_DISENO' ||
    estado === 'EN_CORRECCION' ||
    estado === 'APROBADO_PRODUCCION' ||
    estado === 'EN_IMPRESION' ||
    estado === 'EN_PRODUCCION' ||
    estado === 'EN_ACONDICIONAMIENTO' ||
    estado === 'EN_ACABADOS' ||
    estado === 'EN_ENTREGA' ||
    estado === 'EN_PROCESO'
  ) {
    return 'EN_PROCESO';
  }
  if (estado === 'LISTA_ENTREGA' || estado === 'FACTURADO' || estado === 'CERRADO' || estado === 'TERMINADO') {
    return 'TERMINADO';
  }
  if (estado === 'ENTREGADA' || estado === 'ENTREGADO') {
    return 'ENTREGADO';
  }
  if (estado === 'CANCELADA' || estado === 'CANCELADO') {
    return 'CANCELADO';
  }
  if (estado === 'PENDIENTE' || estado === 'EN_PROCESO' || estado === 'TERMINADO' || estado === 'ENTREGADO' || estado === 'CANCELADO') {
    return estado;
  }
  return 'PENDIENTE';
}

function toDateTimeLocal(dateString?: string | null) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function OrdenesPage() {
  const { t, language } = useI18n();
  const { toast } = useToast();
  const locale = language === 'en' ? 'en-US' : 'es-CO';
  const naText = t('common.na');

  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [responsables, setResponsables] = useState<ResponsableOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [canDeleteOrders, setCanDeleteOrders] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrdenTrabajo | null>(null);
  const [editForm, setEditForm] = useState<OrdenEditForm>({
    estado: 'PENDIENTE',
    assignedToUserId: '',
    areaResponsable: '',
    fechaEntrega: '',
    notas: '',
  });

  useEffect(() => {
    void cargarPermisos();
    void cargarResponsables();
    void cargarOrdenes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarPermisos = async () => {
    try {
      const res = await fetch('/api/me');
      const json = await res.json();
      setCanDeleteOrders(Boolean(json?.success && json?.data?.canDeleteOrders));
    } catch {
      setCanDeleteOrders(false);
    }
  };

  const cargarResponsables = async () => {
    try {
      const res = await fetch('/api/ordenes/assignees');
      const json = await res.json();
      setResponsables(Array.isArray(json?.data) ? json.data : []);
    } catch {
      setResponsables([]);
    }
  };

  const cargarOrdenes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.append('busqueda', busqueda);
      if (filtroEstado) params.append('estado', filtroEstado);

      const res = await fetch(`/api/ordenes?${params}`);
      const response = await res.json();

      if (response.success && Array.isArray(response.data)) {
        setOrdenes(response.data);
      } else {
        console.error('Respuesta inesperada:', response);
        setOrdenes([]);
      }
    } catch (error) {
      console.error('Error:', error);
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const params = new URLSearchParams();
    if (busqueda) params.append('busqueda', busqueda);
    if (filtroEstado) params.append('estado', filtroEstado);
    const url = params.toString() ? `/api/ordenes/export?${params}` : '/api/ordenes/export';
    window.location.href = url;
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return naText;
    return new Date(dateString).toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getEstadoColor = (estado: string) => {
    const visibleStatus = normalizeVisibleStatus(estado);
    return STATUS_OPTIONS.find((option) => option.value === visibleStatus)?.color || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const getEstadoIcon = (estado: string) => {
    switch (normalizeVisibleStatus(estado)) {
      case 'PENDIENTE':
        return <Clock className="w-4 h-4" />;
      case 'EN_PROCESO':
        return <PlayCircle className="w-4 h-4" />;
      case 'TERMINADO':
        return <CheckCircle className="w-4 h-4" />;
      case 'ENTREGADO':
        return <Truck className="w-4 h-4" />;
      case 'CANCELADO':
        return <XCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getEstadoLabel = (estado: string) => {
    return t(`orders.status.${normalizeVisibleStatus(estado)}`);
  };

  const getItemsCount = (orden: OrdenTrabajo) => {
    if (orden.cotizacion?._count?.items != null) return orden.cotizacion._count.items;
    return Array.isArray(orden.itemsSnapshot) ? orden.itemsSnapshot.length : 0;
  };

  const getSourceLabel = (orden: OrdenTrabajo) => {
    if (orden.cotizacion?.numero) {
      return `${t('orders.fromQuote')}: ${orden.cotizacion.numero}`;
    }
    if (orden.posInvoice?.numero) {
      return `${t('orders.fromInvoice')}: ${orden.posInvoice.numero}`;
    }
    return null;
  };

  const getResponsibleLabel = (orden: OrdenTrabajo) => {
    return orden.assignedTo?.name || orden.assignedTo?.email || orden.vendedor?.name || orden.vendedor?.email || t('orders.fields.unassigned');
  };

  const getTaskStatusClasses = (status?: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELED' | null) => {
    if (status === 'OPEN') return 'border-slate-200 bg-slate-100 text-slate-800';
    if (status === 'IN_PROGRESS') return 'border-amber-200 bg-amber-100 text-amber-900';
    if (status === 'DONE') return 'border-emerald-200 bg-emerald-100 text-emerald-800';
    if (status === 'CANCELED') return 'border-rose-200 bg-rose-100 text-rose-800';
    return 'border-slate-200 bg-slate-100 text-slate-600';
  };

  const getTaskStatusLabel = (status?: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELED' | null) => {
    if (!status) return t('orders.fields.noTask');
    return t(`orders.taskStatus.${status}`);
  };

  const buildTaskHref = (orden: OrdenTrabajo) => {
    if (!orden.tareaSeguimiento?.id) return '/dashboard/crm/tareas';
    const params = new URLSearchParams({ taskId: orden.tareaSeguimiento.id });
    return `/dashboard/crm/tareas?${params.toString()}`;
  };

  const crearTareaDesdeOrden = async (orden: OrdenTrabajo) => {
    setCreatingTask(true);
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/task`, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast({ title: t('orders.task.create.error'), description: json?.error || undefined, variant: 'destructive' });
        return;
      }
      toast({ title: t('orders.task.create.success') });
      setEditingOrder(null);
      await cargarOrdenes();
    } catch {
      toast({ title: t('orders.task.create.error'), variant: 'destructive' });
    } finally {
      setCreatingTask(false);
    }
  };

  const getOrderDetails = (orden: OrdenTrabajo) => {
    const notes = (orden.observaciones || '').trim();
    if (notes) return notes;

    if (!Array.isArray(orden.itemsSnapshot) || orden.itemsSnapshot.length === 0) {
      return naText;
    }

    const lines = orden.itemsSnapshot
      .map((item) => {
        const descripcion = String(item?.descripcion || '').trim();
        if (!descripcion) return null;
        const cantidad = Number(item?.cantidad || 0);
        const terminados = Array.isArray(item?.terminados) && item.terminados.length ? ` · ${item.terminados.join(', ')}` : '';
        return cantidad > 0 ? `${cantidad} x ${descripcion}${terminados}` : `${descripcion}${terminados}`;
      })
      .filter((item): item is string => Boolean(item));

    return lines.slice(0, 3).join(' | ') || naText;
  };

  const openEditDialog = (orden: OrdenTrabajo) => {
    setEditingOrder(orden);
    setEditForm({
      estado: normalizeVisibleStatus(orden.estado),
      assignedToUserId: orden.assignedTo?.id || '',
      areaResponsable: orden.areaResponsable || '',
      fechaEntrega: toDateTimeLocal(orden.fechaEntrega),
      notas: orden.observaciones || getOrderDetails(orden),
    });
  };

  const closeEditDialog = () => {
    if (saving) return;
    setEditingOrder(null);
  };

  const guardarOrden = async () => {
    if (!editingOrder) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/ordenes/${editingOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: editForm.estado,
          assignedToUserId: editForm.assignedToUserId || null,
          areaResponsable: editForm.areaResponsable || null,
          fechaEntrega: editForm.fechaEntrega || null,
          notas: editForm.notas,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        toast({ title: t('orders.save.error'), description: json?.error || undefined, variant: 'destructive' });
        return;
      }

      toast({ title: t('orders.save.success') });
      setEditingOrder(null);
      await cargarOrdenes();
    } catch {
      toast({ title: t('orders.save.error'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const borrarOrden = async (orden: OrdenTrabajo) => {
    if (!canDeleteOrders) return;

    const ok = window.confirm(
      t('orders.delete.confirm', { numero: String(orden.numero) })
    );
    if (!ok) return;

    setDeletingId(orden.id);
    try {
      const res = await fetch(`/api/ordenes/${orden.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        const msg = json?.error || t('orders.delete.error');
        window.alert(msg);
        return;
      }

      await cargarOrdenes();
    } catch {
      window.alert(t('orders.delete.error'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <ErpPageHero
        eyebrow="ERP operativo"
        title={t('orders.title')}
        description={t('orders.subtitle')}
        actions={
          <>
            <ImportDialog module="ordenes" title={t('orders.actions.import')} />
            <Button variant="outline" onClick={exportExcel}>
              <Download className="mr-2 h-4 w-4" />
              {t('orders.actions.exportExcel')}
            </Button>
            <Link href="/dashboard/cotizaciones">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                {t('orders.actions.fromQuote')}
              </Button>
            </Link>
          </>
        }
        stats={[
          { label: 'Órdenes', value: ordenes.length, hint: 'Resultados visibles', tone: 'neutral' },
          { label: 'Estado', value: filtroEstado || t('orders.filters.allStatuses'), hint: busqueda || naText, tone: 'amber' },
          { label: 'Responsables', value: responsables.length, hint: 'Usuarios disponibles en sede', tone: 'sky' },
        ]}
      />

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder={t('orders.filters.searchPlaceholder')}
                className="pl-10"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border rounded-md"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="">{t('orders.filters.allStatuses')}</option>
              <option value="PENDIENTE">{t('orders.status.PENDIENTE')}</option>
              <option value="EN_PROCESO">{t('orders.status.EN_PROCESO')}</option>
              <option value="TERMINADO">{t('orders.status.TERMINADO')}</option>
              <option value="ENTREGADO">{t('orders.status.ENTREGADO')}</option>
              <option value="CANCELADO">{t('orders.status.CANCELADO')}</option>
            </select>
            <Button onClick={cargarOrdenes} variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              {t('orders.filters.apply')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Órdenes */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : ordenes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">{t('orders.empty')}</p>
            <Link href="/dashboard/cotizaciones">
              <Button>{t('orders.actions.createFromQuote')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {ordenes.map((orden) => (
            <Card key={orden.id} className="border-slate-200 bg-white/95 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold text-slate-950">{orden.numero}</h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${getEstadoColor(
                          orden.estado
                        )}`}
                      >
                        {getEstadoIcon(orden.estado)}
                        {getEstadoLabel(orden.estado)}
                      </span>
                      {getSourceLabel(orden) && (
                        <span className="text-xs font-medium text-slate-500">{getSourceLabel(orden)}</span>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.05fr_1.35fr_0.9fr_0.95fr_0.85fr_0.9fr]">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('orders.columns.client')}</p>
                        <p className="text-sm font-semibold text-slate-950">{orden.cliente.nombre || naText}</p>
                        <p className="mt-1 text-xs text-slate-500">{orden.cliente.email || orden.cliente.telefono || naText}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <ClipboardList className="h-4 w-4" />
                          {t('orders.columns.detail')}
                        </p>
                        <p className="line-clamp-4 whitespace-pre-wrap text-sm text-slate-700">{getOrderDetails(orden)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <UserRound className="h-4 w-4" />
                          {t('orders.columns.responsible')}
                        </p>
                        <p className="text-sm font-semibold text-slate-950">{getResponsibleLabel(orden)}</p>
                        <p className="mt-1 text-xs text-slate-500">{orden.areaResponsable || t('orders.fields.noArea')}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <CalendarClock className="h-4 w-4" />
                          {t('orders.columns.dueDate')}
                        </p>
                        <p className="text-sm font-semibold text-slate-950">{formatDateTime(orden.fechaEntrega)}</p>
                        <p className="mt-1 text-xs text-slate-500">{t('orders.columns.createdAt')}: {formatDate(orden.createdAt)}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <ListTodo className="h-4 w-4" />
                          {t('orders.columns.internalTracking')}
                        </p>
                        {orden.tareaSeguimiento ? (
                          <>
                            <p className="truncate text-sm font-semibold text-slate-950">{orden.tareaSeguimiento.title}</p>
                            <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getTaskStatusClasses(orden.tareaSeguimiento.status)}`}>
                              {getTaskStatusLabel(orden.tareaSeguimiento.status)}
                            </span>
                            <div className="mt-3">
                              <Link href={buildTaskHref(orden)}>
                                <Button variant="outline" size="sm" className="h-8 rounded-xl px-3">
                                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                  {t('orders.actions.openTask')}
                                </Button>
                              </Link>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-slate-500">{t('orders.fields.noTask')}</p>
                        )}
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t('orders.columns.total')}</p>
                        <p className="text-lg font-semibold text-slate-950">{formatCurrency(orden.total)}</p>
                        <p className="mt-1 text-xs text-slate-500">{getItemsCount(orden)} {t('orders.columns.items').toLowerCase()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 xl:ml-4 xl:flex-col xl:items-stretch">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(orden)}
                      className="w-full sm:min-w-[148px]"
                    >
                      <PencilLine className="mr-2 h-4 w-4" />
                      {t('orders.actions.manage')}
                    </Button>
                    {canDeleteOrders && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void borrarOrden(orden)}
                        disabled={deletingId === orden.id}
                        className="w-full sm:min-w-[148px]"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {deletingId === orden.id ? t('orders.delete.deleting') : t('orders.delete.action')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(editingOrder)} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingOrder ? `${t('orders.dialog.title')} · ${editingOrder.numero}` : t('orders.dialog.title')}</DialogTitle>
            <DialogDescription>{t('orders.dialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-2 md:grid-cols-[1fr_1fr]">
            <div className="grid gap-2">
              <Label>{t('orders.fields.status')}</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editForm.estado}
                onChange={(event) => setEditForm((current) => ({ ...current, estado: event.target.value as OrdenEstadoVisible }))}
              >
                <option value="PENDIENTE">{t('orders.status.PENDIENTE')}</option>
                <option value="EN_PROCESO">{t('orders.status.EN_PROCESO')}</option>
                <option value="TERMINADO">{t('orders.status.TERMINADO')}</option>
                <option value="ENTREGADO">{t('orders.status.ENTREGADO')}</option>
                <option value="CANCELADO">{t('orders.status.CANCELADO')}</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label>{t('orders.fields.responsible')}</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={editForm.assignedToUserId || '__none__'}
                onChange={(event) => setEditForm((current) => ({ ...current, assignedToUserId: event.target.value === '__none__' ? '' : event.target.value }))}
              >
                <option value="__none__">{t('orders.fields.unassigned')}</option>
                {responsables.map((responsable) => (
                  <option key={responsable.id} value={responsable.id}>
                    {responsable.name || responsable.email || responsable.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label>{t('orders.fields.area')}</Label>
              <Input
                value={editForm.areaResponsable}
                onChange={(event) => setEditForm((current) => ({ ...current, areaResponsable: event.target.value }))}
                placeholder={t('orders.fields.noArea')}
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label>{t('orders.fields.dueDate')}</Label>
              <Input
                type="datetime-local"
                value={editForm.fechaEntrega}
                onChange={(event) => setEditForm((current) => ({ ...current, fechaEntrega: event.target.value }))}
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label>{t('orders.fields.detail')}</Label>
              <Textarea
                rows={6}
                value={editForm.notas}
                onChange={(event) => setEditForm((current) => ({ ...current, notas: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={saving}>Cancelar</Button>
            {editingOrder && !editingOrder.tareaSeguimiento ? (
              <Button
                variant="outline"
                onClick={() => void crearTareaDesdeOrden(editingOrder)}
                disabled={saving || creatingTask || !editForm.assignedToUserId}
              >
                <SquarePlus className="mr-2 h-4 w-4" />
                {creatingTask ? 'Creando...' : t('orders.actions.createTask')}
              </Button>
            ) : null}
            {editingOrder?.tareaSeguimiento ? (
              <Link href={buildTaskHref(editingOrder)}>
                <Button variant="outline" disabled={saving || creatingTask}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {t('orders.actions.openTask')}
                </Button>
              </Link>
            ) : null}
            <Button onClick={() => void guardarOrden()} disabled={saving}>
              {saving ? 'Guardando...' : t('orders.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
