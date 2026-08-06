import type { DriveStep } from 'driver.js'

export type TourId =
  | 'dashboard-cotizador.v1'
  | 'dashboard-clientes.v1'
  | 'dashboard-materiales.v1'
  | 'dashboard-inventario.v1'
  | 'dashboard-sedes.v1'
  | 'dashboard-contabilidad.v1'
  | 'dashboard-contabilidad-plan.v1'
  | 'dashboard-contabilidad-centros.v1'
  | 'dashboard-contabilidad-reglas.v1'
  | 'dashboard-contabilidad-comprobantes.v1'
  | 'dashboard-contabilidad-cierres.v1'
  | 'dashboard-nomina.v1'
  | 'dashboard-nomina-empleados.v1'
  | 'dashboard-nomina-novedades.v1'
  | 'dashboard-nomina-periodos.v1'
  | 'dashboard-nomina-liquidaciones.v1'

export type TourDefinition = {
  id: TourId
  steps: DriveStep[]
  preStart?: () => void
}

export function tourIdFromPath(pathname: string): TourId | null {
  // Mantener reglas simples y explícitas
  if (pathname.startsWith('/dashboard/nomina/empleados') || pathname.startsWith('/dashboard/contabilidad/nomina/empleados')) return 'dashboard-nomina-empleados.v1'
  if (pathname.startsWith('/dashboard/nomina/novedades') || pathname.startsWith('/dashboard/contabilidad/nomina/novedades')) return 'dashboard-nomina-novedades.v1'
  if (pathname.startsWith('/dashboard/nomina/periodos') || pathname.startsWith('/dashboard/contabilidad/nomina/periodos')) return 'dashboard-nomina-periodos.v1'
  if (pathname.startsWith('/dashboard/nomina/liquidaciones') || pathname.startsWith('/dashboard/contabilidad/nomina/liquidaciones')) return 'dashboard-nomina-liquidaciones.v1'
  if (pathname.startsWith('/dashboard/nomina') || pathname.startsWith('/dashboard/contabilidad/nomina')) return 'dashboard-nomina.v1'
  if (pathname.startsWith('/dashboard/contabilidad/plan-de-cuentas')) return 'dashboard-contabilidad-plan.v1'
  if (pathname.startsWith('/dashboard/contabilidad/centros-de-costo')) return 'dashboard-contabilidad-centros.v1'
  if (pathname.startsWith('/dashboard/contabilidad/reglas')) return 'dashboard-contabilidad-reglas.v1'
  if (pathname.startsWith('/dashboard/contabilidad/comprobantes')) return 'dashboard-contabilidad-comprobantes.v1'
  if (pathname.startsWith('/dashboard/contabilidad/cierres')) return 'dashboard-contabilidad-cierres.v1'
  if (pathname === '/dashboard/contabilidad' || pathname.startsWith('/dashboard/contabilidad?')) return 'dashboard-contabilidad.v1'
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
  'dashboard-contabilidad.v1': {
    id: 'dashboard-contabilidad.v1',
    steps: [
      {
        element: '[data-tour="contabilidad-title"]',
        popover: {
          title: 'Contabilidad',
          description: 'Esta portada separa claramente configuración contable, operación y cierres.',
        },
      },
      {
        element: '[data-tour="contabilidad-create-map"]',
        popover: {
          title: 'Dónde crear',
          description: 'Aquí quedan visibles los accesos directos para crear cuentas, centros, reglas, comprobantes y períodos.',
        },
      },
      {
        element: '[data-tour="contabilidad-areas"]',
        popover: {
          title: 'Áreas del módulo',
          description: 'Desde estas tarjetas el usuario entiende si va a configuración, libros, comprobantes o cierres.',
        },
      },
    ],
  },
  'dashboard-contabilidad-plan.v1': {
    id: 'dashboard-contabilidad-plan.v1',
    steps: [
      {
        element: '[data-tour="contabilidad-plan-title"]',
        popover: {
          title: 'Plan de cuentas',
          description: 'Aquí se construye la estructura base del catálogo contable.',
        },
      },
      {
        element: '[data-tour="contabilidad-plan-create"]',
        popover: {
          title: 'Crear cuenta',
          description: 'Código, nombre, tipo, naturaleza y jerarquía se registran en este bloque.',
        },
      },
      {
        element: '[data-tour="contabilidad-plan-list"]',
        popover: {
          title: 'Listado',
          description: 'La lista inferior confirma que la cuenta quedó activa en el plan.',
        },
      },
    ],
  },
  'dashboard-contabilidad-centros.v1': {
    id: 'dashboard-contabilidad-centros.v1',
    steps: [
      {
        element: '[data-tour="contabilidad-centros-title"]',
        popover: {
          title: 'Centros de costo',
          description: 'Usa esta pantalla para crear las dimensiones analíticas que luego verás en nómina y contabilidad.',
        },
      },
      {
        element: '[data-tour="contabilidad-centros-create"]',
        popover: {
          title: 'Crear centro',
          description: 'El alta se hace aquí con código y nombre.',
        },
      },
      {
        element: '[data-tour="contabilidad-centros-list"]',
        popover: {
          title: 'Centros creados',
          description: 'Revisa abajo qué centros ya están disponibles para asignación.',
        },
      },
    ],
  },
  'dashboard-contabilidad-reglas.v1': {
    id: 'dashboard-contabilidad-reglas.v1',
    steps: [
      {
        element: '[data-tour="contabilidad-reglas-title"]',
        popover: {
          title: 'Reglas contables',
          description: 'Estas reglas convierten eventos del ERP en asientos automáticos.',
        },
      },
      {
        element: '[data-tour="contabilidad-reglas-create"]',
        popover: {
          title: 'Encabezado de la regla',
          description: 'Define nombre, evento, prioridad y condiciones.',
        },
      },
      {
        element: '[data-tour="contabilidad-reglas-lines"]',
        popover: {
          title: 'Líneas del asiento',
          description: 'Aquí agregas los débitos y créditos que compondrán la regla.',
        },
      },
    ],
  },
  'dashboard-contabilidad-comprobantes.v1': {
    id: 'dashboard-contabilidad-comprobantes.v1',
    steps: [
      {
        element: '[data-tour="contabilidad-comprobantes-title"]',
        popover: {
          title: 'Comprobantes',
          description: 'Esta bandeja concentra la operación contable diaria del nuevo núcleo.',
        },
      },
      {
        element: '[data-tour="contabilidad-comprobantes-create"]',
        popover: {
          title: 'Creación visible',
          description: 'El tutorial marca el punto donde se crean comprobantes y ajustes manuales.',
        },
      },
      {
        element: '[data-tour="contabilidad-comprobantes-list"]',
        popover: {
          title: 'Bandeja',
          description: 'Aquí revisas el estado, el tercero y los totales de cada comprobante.',
        },
      },
    ],
  },
  'dashboard-contabilidad-cierres.v1': {
    id: 'dashboard-contabilidad-cierres.v1',
    steps: [
      {
        element: '[data-tour="contabilidad-cierres-title"]',
        popover: {
          title: 'Períodos y cierres',
          description: 'Esta pantalla organiza la disciplina de apertura, cierre y bloqueo contable.',
        },
      },
      {
        element: '[data-tour="contabilidad-cierres-create"]',
        popover: {
          title: 'Crear período',
          description: 'Desde aquí el usuario sabe que la creación del período contable parte en esta pantalla.',
        },
      },
      {
        element: '[data-tour="contabilidad-cierres-list"]',
        popover: {
          title: 'Histórico',
          description: 'La lista muestra qué períodos siguen abiertos y cuáles ya fueron cerrados o bloqueados.',
        },
      },
    ],
  },
  'dashboard-nomina.v1': {
    id: 'dashboard-nomina.v1',
    steps: [
      {
        element: '[data-tour="nomina-title"]',
        popover: {
          title: 'Nómina',
          description: 'Esta portada agrupa creación operativa, seguimiento y control del ciclo completo de nómina.',
        },
      },
      {
        element: '[data-tour="nomina-quick-actions"]',
        popover: {
          title: 'Crear rápido',
          description: 'Aquí el usuario encuentra de inmediato dónde crear empleado, contrato, novedad, período o liquidación.',
        },
      },
      {
        element: '[data-tour="nomina-modules"]',
        popover: {
          title: 'Áreas del módulo',
          description: 'Cada tarjeta lleva al bloque funcional correcto de nómina.',
        },
      },
    ],
  },
  'dashboard-nomina-empleados.v1': {
    id: 'dashboard-nomina-empleados.v1',
    steps: [
      { element: '[data-tour="nomina-empleados-title"]', popover: { title: 'Empleados y contratos', description: 'Aquí se administra la ficha laboral y contractual.' } },
      { element: '[data-tour="nomina-empleados-actions"]', popover: { title: 'Crear o editar', description: 'Los botones superiores concentran altas y mantenimiento de empleados y contratos.' } },
      { element: '[data-tour="nomina-empleados-list"]', popover: { title: 'Directorio', description: 'La lista permite encontrar el colaborador y abrir su detalle.' } },
    ],
  },
  'dashboard-nomina-novedades.v1': {
    id: 'dashboard-nomina-novedades.v1',
    steps: [
      { element: '[data-tour="nomina-novedades-title"]', popover: { title: 'Novedades', description: 'En esta pantalla se radican y administran novedades e incapacidades.' } },
      { element: '[data-tour="nomina-novedades-actions"]', popover: { title: 'Crear novedad', description: 'El botón visible deja claro dónde se registran horas extra, descuentos y licencias.' } },
      { element: '[data-tour="nomina-novedades-list"]', popover: { title: 'Bandeja', description: 'Aquí se revisa el estado operativo de cada novedad.' } },
    ],
  },
  'dashboard-nomina-periodos.v1': {
    id: 'dashboard-nomina-periodos.v1',
    steps: [
      { element: '[data-tour="nomina-periodos-title"]', popover: { title: 'Períodos', description: 'Aquí se crean los cortes que alimentan cálculo, desprendibles y contabilización.' } },
      { element: '[data-tour="nomina-periodos-actions"]', popover: { title: 'Crear período', description: 'El acceso directo superior abre el nuevo período de nómina.' } },
      { element: '[data-tour="nomina-periodos-list"]', popover: { title: 'Cortes', description: 'La bandeja central muestra el ciclo y el estado contable de cada corte.' } },
    ],
  },
  'dashboard-nomina-liquidaciones.v1': {
    id: 'dashboard-nomina-liquidaciones.v1',
    steps: [
      { element: '[data-tour="nomina-liquidaciones-title"]', popover: { title: 'Liquidaciones', description: 'Esta pantalla centraliza retiros y pagos finales.' } },
      { element: '[data-tour="nomina-liquidaciones-actions"]', popover: { title: 'Crear liquidación', description: 'Desde el botón superior se registra el retiro y cálculo final.' } },
      { element: '[data-tour="nomina-liquidaciones-list"]', popover: { title: 'Bandeja', description: 'Aquí se sigue el estado de cada liquidación y su contabilización.' } },
    ],
  },
}
