'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImportDialog } from '@/components/import/import-dialog';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Clock,
  PlayCircle,
  CheckCircle,
  XCircle,
  Truck,
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
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');

  useEffect(() => {
    cargarOrdenes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
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
    const labels: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      EN_PROCESO: 'En Proceso',
      EN_PRODUCCION: 'En Producción',
      TERMINADO: 'Terminado',
      ENTREGADO: 'Entregado',
      CANCELADO: 'Cancelado',
    };
    return labels[estado] || estado;
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Órdenes de Trabajo</h1>
          <p className="text-gray-600 mt-1">Gestiona las órdenes de producción</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportDialog module="ordenes" title="Importar órdenes" />
          <Link href="/dashboard/cotizaciones">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Desde Cotización
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
                placeholder="Buscar por número, cliente..."
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
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_PROCESO">En Proceso</option>
              <option value="EN_PRODUCCION">En Producción</option>
              <option value="TERMINADO">Terminado</option>
              <option value="ENTREGADO">Entregado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
            <Button onClick={cargarOrdenes} variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Aplicar Filtros
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
            <p className="text-gray-500 mb-4">No hay órdenes de trabajo</p>
            <Link href="/dashboard/cotizaciones">
              <Button>Crear desde cotización</Button>
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
                          De cotización: {orden.cotizacion.numero}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Cliente:</span>
                        <p className="text-gray-900">{orden.cliente.nombre}</p>
                        {orden.cliente.empresa && (
                          <p className="text-xs text-gray-500">{orden.cliente.empresa}</p>
                        )}
                      </div>
                      <div>
                        <span className="font-medium">Fecha Creación:</span>
                        <p className="text-gray-900">{formatDate(orden.createdAt)}</p>
                      </div>
                      <div>
                        <span className="font-medium">Items:</span>
                        <p className="text-gray-900">{orden.cotizacion?._count?.items ?? 0}</p>
                      </div>
                      <div>
                        <span className="font-medium">Total:</span>
                        <p className="text-gray-900 text-lg font-semibold">
                          {formatCurrency(orden.total)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
