import type { DriveStep } from 'driver.js'

export type TourId =
  | 'dashboard-cotizador.v1'
  | 'dashboard-clientes.v1'
  | 'dashboard-materiales.v1'
  | 'dashboard-inventario.v1'
  | 'dashboard-sedes.v1'

export type TourDefinition = {
  id: TourId
  steps: DriveStep[]
  preStart?: () => void
}

export function tourIdFromPath(pathname: string): TourId | null {
  // Mantener reglas simples y explícitas
  if (pathname.startsWith('/dashboard/cotizador')) return 'dashboard-cotizador.v1'
  if (pathname.startsWith('/dashboard/clientes')) return 'dashboard-clientes.v1'
  if (pathname.startsWith('/dashboard/materiales') || pathname.startsWith('/dashboard/productos')) return 'dashboard-materiales.v1'
  if (pathname.startsWith('/dashboard/inventario')) return 'dashboard-inventario.v1'
  if (pathname.startsWith('/dashboard/configuracion/sedes')) return 'dashboard-sedes.v1'
  return null
}

export const TOURS: Record<TourId, TourDefinition> = {
  'dashboard-cotizador.v1': {
    id: 'dashboard-cotizador.v1',
    steps: [
      {
        element: '[data-tour="cotizador-title"]',
        popover: {
          title: 'Cotizador',
          description:
            'Aquí creas cotizaciones rápidamente. Este tour te muestra el flujo básico: cliente → items → guardar.',
        },
      },
      {
        element: '[data-tour="cotizador-cliente"]',
        popover: {
          title: 'Selecciona el cliente',
          description: 'Primero elige el cliente para asociar la cotización.',
        },
      },
      {
        element: '[data-tour="cotizador-add-item"]',
        popover: {
          title: 'Agregar items',
          description: 'Agrega uno o más items (productos/servicios) a la cotización.',
        },
      },
      {
        element: '[data-tour="cotizador-save"]',
        popover: {
          title: 'Guardar',
          description: 'Cuando tengas items y cliente, guarda la cotización para generar número y PDF.',
        },
      },
    ],
  },
  'dashboard-clientes.v1': {
    id: 'dashboard-clientes.v1',
    steps: [
      {
        element: '[data-tour="clientes-title"]',
        popover: {
          title: 'Clientes',
          description: 'Administra tu base de datos de clientes (crear, editar e importar).',
        },
      },
      {
        element: '[data-tour="clientes-search"]',
        popover: {
          title: 'Búsqueda',
          description: 'Filtra por nombre, documento o email para encontrar rápido un cliente.',
        },
      },
      {
        element: '[data-tour="clientes-new"]',
        popover: {
          title: 'Nuevo cliente',
          description: 'Crea un cliente manualmente desde aquí.',
        },
      },
    ],
  },
  'dashboard-materiales.v1': {
    id: 'dashboard-materiales.v1',
    steps: [
      {
        element: '[data-tour="materiales-title"]',
        popover: {
          title: 'Productos',
          description: 'Este es tu catálogo (precios, stock e imagen por producto).',
        },
      },
      {
        element: '[data-tour="materiales-search"]',
        popover: {
          title: 'Filtros',
          description: 'Busca por nombre y filtra por tipo / unidad para acotar rápido.',
        },
      },
      {
        element: '[data-tour="materiales-import"]',
        popover: {
          title: 'Importación',
          description: 'Puedes importar productos desde Excel/CSV (incluyendo imagenUrl).',
        },
      },
      {
        element: '[data-tour="materiales-new"]',
        popover: {
          title: 'Nuevo producto',
          description: 'Crea un producto y luego puedes subir/preview de imagen.',
        },
      },
    ],
  },
  'dashboard-inventario.v1': {
    id: 'dashboard-inventario.v1',
    steps: [
      {
        element: '[data-tour="inventario-title"]',
        popover: {
          title: 'Inventario',
          description: 'Registra entradas, salidas y ajustes de stock por material y sede.',
        },
      },
      {
        element: '[data-tour="inventario-search"]',
        popover: {
          title: 'Buscar productos',
          description: 'Filtra la lista por nombre para encontrar el producto que necesitas.',
        },
      },
      {
        element: '[data-tour="inventario-movimiento"]',
        popover: {
          title: 'Registrar movimiento',
          description: 'Crea una entrada/salida/ajuste de inventario desde aquí.',
        },
      },
    ],
  },
  'dashboard-sedes.v1': {
    id: 'dashboard-sedes.v1',
    steps: [
      {
        element: '[data-tour="sedes-title"]',
        popover: {
          title: 'Sedes',
          description: 'Define sedes/almacenes para controlar stock por bodega.',
        },
      },
      {
        element: '[data-tour="sedes-new"]',
        popover: {
          title: 'Nueva sede',
          description: 'Crea una sede y marca una como principal.',
        },
      },
    ],
  },
}
