'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Eye
} from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import dynamic from 'next/dynamic';

// Importación dinámica del PDFViewer
const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <div className="flex h-96 items-center justify-center">Cargando vista previa...</div> }
);

import CotizacionPDF from '@/lib/pdf-template';

interface Cotizacion {
  id: string;
  numero: string;
  createdAt: string;
  estado: string;
  subtotal: number;
  iva: number;
  total: number;
  validezDias: number;
  emailSentCount: number;
  whatsappSentCount: number;
  lastEmailSentAt?: string | null;
  lastWhatsappSentAt?: string | null;
  orden?: { id: string } | null;
  cliente: {
    nombre: string;
    email: string;
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

export default function CotizacionesPage() {
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
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Estado para el preview
  const [previewCotizacion, setPreviewCotizacion] = useState<any | null>(null);
  const [previewEmpresa, setPreviewEmpresa] = useState<any | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);

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

  const cargarCotizaciones = async (opts?: { page?: number }) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (busqueda) params.append('search', busqueda);
      if (filtroEstado) params.append('estado', filtroEstado);
      if (filtroSede) params.append('sedeId', filtroSede);
      if (from) params.append('from', from);
      if (to) params.append('to', to);

      const pageToLoad = opts?.page ?? page;
      params.append('page', String(pageToLoad));
      params.append('pageSize', String(pageSize));

      const res = await fetch(`/api/cotizaciones?${params}`);
      const response = await res.json();
      
      // El API retorna { success, data }
      if (response.success && Array.isArray(response.data)) {
        setCotizaciones(response.data);
        const meta = response.meta as
          | { page?: number; pageSize?: number; total?: number; totalPages?: number }
          | undefined;
        setTotalPages(typeof meta?.totalPages === 'number' && meta.totalPages > 0 ? meta.totalPages : 1);
        setTotal(typeof meta?.total === 'number' && meta.total >= 0 ? meta.total : response.data.length);
        setPage(pageToLoad);
      } else {
        console.error('La respuesta no tiene el formato esperado:', response);
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
      a.download = `Cotizacion-${numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error descargando PDF:', error);
      alert('Error al descargar el PDF');
    }
  };

  const enviarPorEmail = async (cotizacion: Cotizacion) => {
    const confirmar = window.confirm(
      `¿Enviar cotización ${cotizacion.numero} a ${cotizacion.cliente.email}?`
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
        alert('Cotización enviada correctamente');
        cargarCotizaciones();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al enviar el email');
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
        alert(`No se pudo generar link de WhatsApp: ${json?.error ?? 'Error'}`);
        return;
      }

      const url: string = json.data.url;
      const mensaje = buildWhatsAppMessage(cotizacion, url);

      window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
      cargarCotizaciones();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al preparar el WhatsApp');
    } finally {
      setCompartiendo(null);
    }
  };

  const eliminarCotizacion = async (id: string, numero: string) => {
    const confirmar = window.confirm(
      `¿Eliminar la cotización ${numero}? Esta acción no se puede deshacer.`
    );
    
    if (!confirmar) return;

    try {
      const res = await fetch(`/api/cotizaciones/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        alert('Cotización eliminada');
        cargarCotizaciones();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar');
    }
  };

  const abrirPreview = async (cotizacion: Cotizacion) => {
    try {
      // Obtener datos completos de la cotización
      const res = await fetch(`/api/cotizaciones/${cotizacion.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setPreviewCotizacion(data.data);
          
          // Obtener datos de la empresa si existe
          if (data.data.vendedor?.empresaId) {
            const empresaRes = await fetch(`/api/empresas/${data.data.vendedor.empresaId}`);
            if (empresaRes.ok) {
              const empresaData = await empresaRes.json();
              setPreviewEmpresa(empresaData.success ? empresaData.data : null);
            }
          }

          // Obtener plantilla de cotización
          const templateRes = await fetch('/api/cotizacion-template');
          if (templateRes.ok) {
            const templateData = await templateRes.json();
            const settings = templateData?.success && templateData?.data?.settings
              ? templateData.data.settings
              : null;
            setPreviewTemplate(settings);
          }
        }
      }
    } catch (error) {
      console.error('Error al cargar datos para preview:', error);
      alert('Error al cargar el preview');
    }
  };

  const crearOrden = async (cotizacionId: string, numero: string) => {
    const confirmar = window.confirm(
      `¿Crear orden de trabajo desde la cotización ${numero}?`
    );
    
    if (!confirmar) return;

    try {
      const res = await fetch('/api/ordenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacionId }),
      });

      const response = await res.json();

      if (response.success) {
        alert(`Orden ${response.data.numero} creada exitosamente`);
        cargarCotizaciones(); // Recargar para actualizar estados
        // Opcional: redirigir a la página de órdenes
        // window.location.href = '/dashboard/ordenes';
      } else {
        alert(`Error: ${response.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al crear orden de trabajo');
    }
  };

  const aprobarCotizacion = async (cotizacionId: string, numero: string) => {
    const confirmar = window.confirm(`¿Aprobar la cotización ${numero}?`);
    if (!confirmar) return;

    setAprobando(cotizacionId);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacionId}/aprobar`, { method: 'POST' });
      const json = await res.json().catch(() => ({ success: false }));
      if (!res.ok || !json?.success) {
        alert(`Error: ${json?.error ?? 'No se pudo aprobar'}`);
        return;
      }
      cargarCotizaciones();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al aprobar la cotización');
    } finally {
      setAprobando(null);
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

  const buildWhatsAppMessage = (cotizacion: Cotizacion, pdfUrl: string) => {
    const createdAt = new Date(cotizacion.createdAt);
    const validUntil = new Date(
      createdAt.getTime() + cotizacion.validezDias * 24 * 60 * 60 * 1000
    );

    const resumenItems = (cotizacion.items || [])
      .slice(0, 4)
      .map((it) => {
        const name = it.descripcion?.trim() || it.material?.nombre?.trim() || 'Ítem';
        const qty = typeof it.cantidad === 'number' && !Number.isNaN(it.cantidad) ? it.cantidad : null;
        const unit = it.unidad?.trim();
        const qtyLabel = qty !== null ? `${qty}${unit ? ` ${unit}` : ''}` : null;
        return `• ${qtyLabel ? `${qtyLabel} - ` : ''}${name}`;
      })
      .join('\n');

    const hayMasItems = (cotizacion.items?.length ?? 0) > 4;

    return [
      '*SGDigital Softwares*',
      `*Cotización ${cotizacion.numero}*`,
      '',
      `*Cliente:* ${cotizacion.cliente?.nombre ?? '-'}`,
      `*Total:* ${formatCurrency(cotizacion.total)}`,
      `*Fecha:* ${createdAt.toLocaleDateString('es-MX')}`,
      `*Vigencia:* hasta ${validUntil.toLocaleDateString('es-MX')}`,
      '',
      resumenItems ? '*Resumen:*\n' + resumenItems + (hayMasItems ? '\n• …' : '') : '',
      '',
      `*PDF:* ${pdfUrl}`,
      '',
      'Si deseas, puedo ayudarte a confirmar cantidades y tiempos de entrega.',
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

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Cotizaciones</h1>
          <p className="text-muted-foreground mt-0.5">Gestiona tus cotizaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/cotizaciones/plantilla">
            <Button variant="outline">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Editar plantilla
            </Button>
          </Link>
          <Button variant="outline" onClick={exportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Link href="/dashboard/cotizador">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Cotización
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por número, cliente..."
                className="pl-10"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              title="Desde"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              title="Hasta"
            />

            <select
              className="px-3 py-2 border rounded-md"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="BORRADOR">Borrador</option>
              <option value="ENVIADA">Enviada</option>
              <option value="APROBADA">Aprobada</option>
              <option value="RECHAZADA">Rechazada</option>
              <option value="VENCIDA">Vencida</option>
            </select>

            <select
              className="px-3 py-2 border rounded-md"
              value={filtroSede}
              onChange={(e) => setFiltroSede(e.target.value)}
            >
              <option value="">Todas las sedes</option>
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
              Aplicar Filtros
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
            <p className="text-gray-500 mb-4">No hay cotizaciones</p>
            <Link href="/dashboard/cotizador">
              <Button>Crear primera cotización</Button>
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
                        {cot.estado}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-muted-foreground mb-2">
                      <div>
                        <span className="font-medium">Cliente:</span>
                        <p className="text-gray-900">{cot.cliente.nombre}</p>
                      </div>
                      <div>
                        <span className="font-medium">Fecha:</span>
                        <p className="text-gray-900">{formatDate(cot.createdAt)}</p>
                      </div>
                      <div>
                        <span className="font-medium">Items:</span>
                        <p className="text-gray-900">{cot.items.length}</p>
                      </div>
                      <div>
                        <span className="font-medium">Total:</span>
                        <p className="text-gray-900 text-lg font-semibold">
                          {formatCurrency(cot.total)}
                        </p>
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
                      title="Vista previa"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>

                    {/* Editar (solo borrador) */}
                    {cot.estado === 'BORRADOR' && !cot.orden && (
                      <Link href={`/dashboard/cotizador?id=${cot.id}`}>
                        <Button size="sm" variant="outline" title="Editar cotización">
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}

                    {/* Aprobar */}
                    {cot.estado !== 'APROBADA' && cot.estado !== 'CONVERTIDA' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => aprobarCotizacion(cot.id, cot.numero)}
                        disabled={aprobando === cot.id}
                        title="Aprobar"
                      >
                        {aprobando === cot.id ? (
                          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </Button>
                    )}

                    {/* Botón para crear orden (solo si está aprobada y no tiene orden) */}
                    {cot.estado === 'APROBADA' && !cot.orden && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => crearOrden(cot.id, cot.numero)}
                        title="Crear orden de trabajo"
                      >
                        <ClipboardCheck className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Crear Orden</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => descargarPDF(cot.id, cot.numero)}
                      title="Descargar PDF"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => enviarPorEmail(cot)}
                      disabled={enviando === cot.id}
                      title="Enviar por email"
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
                      title="Compartir por WhatsApp"
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
                      title="Eliminar"
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
              {total > 0 ? `Total: ${total} • Página ${page} de ${totalPages}` : `Página ${page} de ${totalPages}`}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page <= 1}
                onClick={() => cargarCotizaciones({ page: Math.max(1, page - 1) })}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || page >= totalPages}
                onClick={() => cargarCotizaciones({ page: Math.min(totalPages, page + 1) })}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog para Preview PDF */}
      <Dialog open={!!previewCotizacion} onOpenChange={() => setPreviewCotizacion(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Vista previa - {previewCotizacion?.numero}
            </DialogTitle>
          </DialogHeader>
          
          {previewCotizacion && (
            <div className="h-[600px] w-full overflow-hidden rounded border">
              <PDFViewer width="100%" height="100%">
                <CotizacionPDF
                  cotizacion={previewCotizacion}
                  template={previewTemplate || undefined}
                />
              </PDFViewer>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
