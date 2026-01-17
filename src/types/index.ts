/**
 * Tipos TypeScript compartidos en todo el proyecto
 */

// Tipos base que generará Prisma
export type User = {
  id: string
  name: string | null
  email: string
  emailVerified: Date | null
  image: string | null
  password: string | null
  role: 'ADMIN' | 'USER' | 'VENDEDOR' | 'PRODUCCION' | 'CLIENTE'
  empresaId: string | null
  createdAt: Date
  updatedAt: Date
}

export type Cliente = {
  id: string
  nombre: string
  tipoDocumento: string
  documento: string
  email: string | null
  telefono: string | null
  celular: string | null
  direccion: string | null
  ciudad: string | null
  departamento: string | null
  empresaId: string
  createdAt: Date
  updatedAt: Date
}

export type Material = {
  id: string
  nombre: string
  tipo: string
  categoria: string | null
  ancho: number | null
  largo: number | null
  espesor: number | null
  color: string | null
  precioM2: number | null
  precioMetro: number | null
  precioUnidad: number | null
  precioCompra: number | null
  stockActual: number
  stockMinimo: number
  unidadMedida: string
  proveedor: string | null
  observaciones: string | null
  empresaId: string
  activo: boolean
  createdAt: Date
  updatedAt: Date
}

export type Cotizacion = {
  id: string
  numero: string
  fecha: Date
  validezDias: number
  clienteId: string
  vendedorId: string
  subtotal: number
  descuento: number
  iva: number
  total: number
  estado: 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'VENCIDA' | 'CONVERTIDA'
  observaciones: string | null
  ordenId: string | null
  createdAt: Date
  updatedAt: Date
}

export type OrdenTrabajo = {
  id: string
  numero: string
  fecha: Date
  fechaEntrega: Date
  clienteId: string
  vendedorId: string
  estado: 'PENDIENTE' | 'EN_DISENO' | 'EN_PRODUCCION' | 'EN_ACABADOS' | 'LISTA_ENTREGA' | 'ENTREGADA' | 'CANCELADA'
  prioridad: 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE'
  observaciones: string | null
  createdAt: Date
  updatedAt: Date
}

// ============================================
// TIPOS DE USUARIO Y AUTENTICACIÓN
// ============================================

export type SafeUser = Omit<User, 'password'>

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  name: string
  email: string
  password: string
  confirmPassword: string
}

// ============================================
// TIPOS DE COTIZACIÓN
// ============================================

export interface CotizacionConRelaciones extends Cotizacion {
  cliente: Cliente
  vendedor: SafeUser
  items: ItemCotizacionConRelaciones[]
}

export interface ItemCotizacionConRelaciones {
  id: string
  descripcion: string
  cantidad: number
  unidad: string
  ancho?: number
  alto?: number
  area?: number
  material?: Material
  laminado: boolean
  troquelado: boolean
  instalacion: boolean
  costoMaterial: number
  costoImpresion: number
  costoAcabados: number
  costoInstalacion: number
  precioUnitario: number
  subtotal: number
}

export interface CrearCotizacionInput {
  clienteId: string
  items: CrearItemCotizacionInput[]
  observaciones?: string
  validezDias?: number
}

export interface CrearItemCotizacionInput {
  descripcion: string
  cantidad: number
  unidad: string
  ancho?: number
  alto?: number
  materialId?: string
  laminado?: boolean
  troquelado?: boolean
  instalacion?: boolean
}

// ============================================
// TIPOS DE DASHBOARD
// ============================================

export interface EstadisticasDashboard {
  totalCotizaciones: number
  cotizacionesPendientes: number
  cotizacionesAprobadas: number
  totalVentas: number
  ordenesEnProduccion: number
  ordenesPendientes: number
}

export interface GraficoVentas {
  mes: string
  ventas: number
  cotizaciones: number
}

// ============================================
// TIPOS DE FORMULARIOS
// ============================================

export interface FormErrors {
  [key: string]: string | undefined
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// ============================================
// TIPOS: ESCANEO OCR/IA
// ============================================

export type DocumentScan = {
  id: string
  tipo: "FACTURA" | "COTIZACION"
  provider: "PADDLEOCR" | "TESSERACT"
  status: "PENDIENTE" | "PROCESADO" | "FALLIDO" | "APROBADO"
  capturePercent: number
  pageCount: number
  approved: boolean
  approvedAt: Date | null
  approvedById: string | null
  userId: string
  originalFileName: string | null
  storedFileName: string | null
  mimeType: string
  fileUrl: string
  extractedText: string | null
  extractedData: unknown | null
  error: string | null
  createdAt: Date
  updatedAt: Date
}
