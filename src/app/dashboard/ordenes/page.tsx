'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImportDialog } from '@/components/import/import-dialog';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/components/providers/i18n-provider';
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
} from 'lucide-react';
import Link from 'next/link';

interface OrdenTrabajo {
  id: string;
  numero: string;
  createdAt: string;
  fechaEntrega?: string;
  estado: string;
  subtotal: number;
  iva: number;
  total: number;
  cliente: {
    nombre: string;
    email: string;
    empresa?: string;
  };
  cotizacion?: {
    numero: string;
    _count?: {
      items: number;
    };
  };
}

export default function OrdenesPage() {
  const { t, language } = useI18n();
  const locale = language === 'en' ? 'en-US' : 'es-CO';
  const naText = t('common.na');

  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [canDeleteOrders, setCanDeleteOrders] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void cargarPermisos();
    cargarOrdenes();
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

  const cargarOrdenes = async () => {
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

  const getEstadoColor = (estado: string) => {
    const colores: Record<string, string> = {
      PENDIENTE: 'bg-yellow-100 text-yellow-800',
      EN_PROCESO: 'bg-blue-100 text-blue-800',
      EN_PRODUCCION: 'bg-purple-100 text-purple-800',
      TERMINADO: 'bg-green-100 text-green-800',
      ENTREGADO: 'bg-gray-100 text-gray-800',
      CANCELADO: 'bg-red-100 text-red-800',
    };
    return colores[estado] || 'bg-gray-100 text-gray-800';
  };

  const getEstadoIcon = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE':
        return <Clock className="w-4 h-4" />;
      case 'EN_PROCESO':
      case 'EN_PRODUCCION':
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
    return t(`orders.status.${estado}`);
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
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{t('orders.title')}</h1>
          <p className="text-gray-600 mt-1">{t('orders.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportDialog module="ordenes" title={t('orders.actions.import')} />
          <Button variant="outline" onClick={exportExcel}>
            <Download className="w-4 h-4 mr-2" />
            {t('orders.actions.exportExcel')}
          </Button>
          <Link href="/dashboard/cotizaciones">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {t('orders.actions.fromQuote')}
            </Button>
          </Link>
        </div>
      </div>

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
              <option value="EN_PRODUCCION">{t('orders.status.EN_PRODUCCION')}</option>
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
            <Card key={orden.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{orden.numero}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getEstadoColor(
                          orden.estado
                        )}`}
                      >
                        {getEstadoIcon(orden.estado)}
                        {getEstadoLabel(orden.estado)}
                      </span>
                      {orden.cotizacion && (
                        <span className="text-xs text-gray-500">
                          {t('orders.fromQuote')}: {orden.cotizacion.numero}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">{t('orders.columns.client')}:</span>
                        <p className="text-gray-900">{orden.cliente.nombre || naText}</p>
                        {orden.cliente.empresa && (
                          <p className="text-xs text-gray-500">{orden.cliente.empresa}</p>
                        )}
                      </div>
                      <div>
                        <span className="font-medium">{t('orders.columns.createdAt')}:</span>
                        <p className="text-gray-900">{formatDate(orden.createdAt)}</p>
                      </div>
                      <div>
                        <span className="font-medium">{t('orders.columns.items')}:</span>
                        <p className="text-gray-900">{orden.cotizacion?._count?.items ?? 0}</p>
                      </div>
                      <div>
                        <span className="font-medium">{t('orders.columns.total')}:</span>
                        <p className="text-gray-900 text-lg font-semibold">
                          {formatCurrency(orden.total)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {canDeleteOrders && (
                    <div className="ml-4 flex items-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => void borrarOrden(orden)}
                        disabled={deletingId === orden.id}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {deletingId === orden.id ? t('orders.delete.deleting') : t('orders.delete.action')}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
