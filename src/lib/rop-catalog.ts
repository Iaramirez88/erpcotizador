import { RopCapacityUnit, type PrismaClient } from '@prisma/client'

/**
 * Catálogo base ROP.
 *
 * Es la fuente única usada por:
 * - `scripts/seed-rop-catalog.ts` (seed manual con `npm run seed:rop-catalog`).
 * - `/api/rop/v1/catalog/services` (auto-provisión cuando la base aún no tiene catálogo).
 *
 * Reglas: `slug` y `name` de categoría son únicos, `code` de servicio es único y global.
 */
export type RopCatalogServiceSeed = readonly [code: string, name: string, unitOfCapacity: RopCapacityUnit]

export type RopCatalogSubcategorySeed = {
  slug: string
  name: string
  description?: string
  services: readonly RopCatalogServiceSeed[]
}

export type RopCatalogCategorySeed = {
  slug: string
  name: string
  description: string
  sortOrder: number
  subcategories: readonly RopCatalogSubcategorySeed[]
}

export type RopCatalogSeedSummary = {
  categories: number
  subcategories: number
  services: number
}

export const ROP_DEFAULT_CATALOG: readonly RopCatalogCategorySeed[] = [
  {
    slug: 'tecnologia',
    name: 'Tecnología',
    description: 'Software, infraestructura, hardware y consultoría tecnológica.',
    sortOrder: 10,
    subcategories: [
      {
        slug: 'desarrollo-software',
        name: 'Desarrollo de software',
        services: [
          ['DESARROLLO_SOFTWARE_MEDIDA', 'Desarrollo de software a la medida', RopCapacityUnit.HOUR],
          ['APLICACIONES_MOVILES', 'Aplicaciones móviles', RopCapacityUnit.HOUR],
          ['INTEGRACION_APIS', 'Integración de APIs y sistemas', RopCapacityUnit.HOUR],
        ],
      },
      {
        slug: 'infraestructura-y-soporte',
        name: 'Infraestructura y soporte técnico',
        services: [
          ['SOPORTE_TECNICO_SITIO', 'Soporte técnico en sitio', RopCapacityUnit.HOUR],
          ['ADMINISTRACION_NUBE', 'Administración de nube y servidores', RopCapacityUnit.HOUR],
          ['CIBERSEGURIDAD_GESTIONADA', 'Ciberseguridad gestionada', RopCapacityUnit.HOUR],
        ],
      },
      {
        slug: 'hardware-y-equipos',
        name: 'Hardware y equipos',
        services: [
          ['INSTALACION_EQUIPOS', 'Instalación de equipos y redes', RopCapacityUnit.UNIT],
          ['MANTENIMIENTO_HARDWARE', 'Mantenimiento de hardware', RopCapacityUnit.UNIT],
          ['SUMINISTRO_EQUIPOS_COMPUTO', 'Suministro de equipos de cómputo', RopCapacityUnit.UNIT],
        ],
      },
      {
        slug: 'consultoria-tecnologia',
        name: 'Consultoría y datos',
        services: [
          ['CONSULTORIA_TECNOLOGICA', 'Consultoría tecnológica', RopCapacityUnit.HOUR],
          ['CONSULTA_TECNICA_ESPECIALIZADA', 'Consulta técnica especializada', RopCapacityUnit.HOUR],
          ['ANALITICA_Y_DATOS', 'Analítica de datos y tableros', RopCapacityUnit.HOUR],
        ],
      },
    ],
  },
  {
    slug: 'servicios-profesionales',
    name: 'Servicios profesionales',
    description: 'Consultoría, contabilidad, jurídico y gestión humana.',
    sortOrder: 20,
    subcategories: [
      {
        slug: 'consultoria-y-asesoria',
        name: 'Consultoría y asesoría',
        services: [
          ['CONSULTORIA_ESTRATEGICA', 'Consultoría estratégica', RopCapacityUnit.HOUR],
          ['CONSULTORIA_OPERATIVA', 'Consultoría operativa y procesos', RopCapacityUnit.HOUR],
          ['CONSULTORIA_FINANCIERA', 'Consultoría financiera', RopCapacityUnit.HOUR],
        ],
      },
      {
        slug: 'contabilidad-y-legal',
        name: 'Contabilidad y legal',
        services: [
          ['CONTABILIDAD_EXTERNA', 'Contabilidad externa', RopCapacityUnit.HOUR],
          ['ASESORIA_LEGAL', 'Asesoría legal empresarial', RopCapacityUnit.HOUR],
          ['REVISION_FISCAL', 'Revisión fiscal y tributaria', RopCapacityUnit.HOUR],
        ],
      },
      {
        slug: 'gestion-humana',
        name: 'Gestión humana',
        services: [
          ['SELECCION_PERSONAL', 'Selección de personal', RopCapacityUnit.UNIT],
          ['NOMINA_TERCERIZADA', 'Nómina tercerizada', RopCapacityUnit.UNIT],
          ['CAPACITACION_CORPORATIVA', 'Capacitación corporativa', RopCapacityUnit.HOUR],
        ],
      },
    ],
  },
  {
    slug: 'impresion-produccion',
    name: 'Impresión y producción',
    description: 'Impresión comercial, gran formato y acabados.',
    sortOrder: 30,
    subcategories: [
      {
        slug: 'impresion-comercial',
        name: 'Impresión comercial',
        services: [
          ['OFFSET_PLIEGO', 'Impresión offset por pliego', RopCapacityUnit.ORDER],
          ['DIGITAL_TIRAJES_CORTOS', 'Impresión digital de tirajes cortos', RopCapacityUnit.ORDER],
          ['GRAN_FORMATO', 'Impresión gran formato', RopCapacityUnit.M2],
        ],
      },
      {
        slug: 'acabados-ensamble',
        name: 'Acabados y ensamble',
        services: [
          ['LAMINADO_Y_BARNIZ', 'Laminado y barniz', RopCapacityUnit.M2],
          ['TROQUELADO_Y_CORTE', 'Troquelado y corte', RopCapacityUnit.UNIT],
          ['EMPAQUE_PROMOCIONAL', 'Empaque promocional y armado', RopCapacityUnit.UNIT],
        ],
      },
    ],
  },
  {
    slug: 'manufactura-y-taller',
    name: 'Manufactura y taller',
    description: 'Metal, madera, textil y confección.',
    sortOrder: 40,
    subcategories: [
      {
        slug: 'metal-madera',
        name: 'Metal, madera y taller',
        services: [
          ['CORTE_Y_SOLDADURA', 'Corte y soldadura', RopCapacityUnit.HOUR],
          ['CARPINTERIA_Y_MDF', 'Carpintería y MDF', RopCapacityUnit.UNIT],
          ['PINTURA_Y_ACABADO', 'Pintura industrial y acabado', RopCapacityUnit.M2],
        ],
      },
      {
        slug: 'textil-confeccion',
        name: 'Textil y confección',
        services: [
          ['CORTE_TEXTIL', 'Corte textil', RopCapacityUnit.UNIT],
          ['CONFECCION_SERIE', 'Confección por serie', RopCapacityUnit.UNIT],
          ['BORDADO_Y_MARQUILLA', 'Bordado y marquilla', RopCapacityUnit.UNIT],
        ],
      },
    ],
  },
  {
    slug: 'logistica-y-distribucion',
    name: 'Logística y distribución',
    description: 'Transporte, última milla, bodega y fulfillment.',
    sortOrder: 50,
    subcategories: [
      {
        slug: 'ultima-milla',
        name: 'Última milla y mensajería',
        services: [
          ['MENSAJERIA_URBANA', 'Mensajería urbana', RopCapacityUnit.ORDER],
          ['DISTRIBUCION_ULTIMA_MILLA', 'Distribución de última milla', RopCapacityUnit.ORDER],
          ['RECOLECCION_PROGRAMADA', 'Recolección programada', RopCapacityUnit.ORDER],
        ],
      },
      {
        slug: 'bodega-fulfillment',
        name: 'Bodega y fulfillment',
        services: [
          ['ALISTAMIENTO_PEDIDOS', 'Alistamiento de pedidos', RopCapacityUnit.UNIT],
          ['ALMACENAMIENTO_TEMPORAL', 'Almacenamiento temporal', RopCapacityUnit.KG],
          ['EMPAQUE_Y_DESPACHO', 'Empaque y despacho', RopCapacityUnit.ORDER],
        ],
      },
    ],
  },
  {
    slug: 'suministros-y-abastecimiento',
    name: 'Suministros y abastecimiento',
    description: 'Insumos, materias primas, dotación y ferretería.',
    sortOrder: 60,
    subcategories: [
      {
        slug: 'insumos-y-materias-primas',
        name: 'Insumos y materias primas',
        services: [
          ['COMPRA_INSUMOS', 'Compra de insumos', RopCapacityUnit.UNIT],
          ['ABASTECIMIENTO_MATERIA_PRIMA', 'Abastecimiento de materia prima', RopCapacityUnit.KG],
          ['IMPORTACION_INSUMOS', 'Importación de insumos', RopCapacityUnit.ORDER],
        ],
      },
      {
        slug: 'dotacion-y-ferreteria',
        name: 'Dotación y ferretería',
        services: [
          ['DOTACION_Y_EPP', 'Dotación y elementos de protección', RopCapacityUnit.UNIT],
          ['FERRETERIA_INDUSTRIAL', 'Ferretería industrial', RopCapacityUnit.UNIT],
          ['SUMINISTRO_PAPELERIA', 'Suministro de papelería y oficina', RopCapacityUnit.UNIT],
        ],
      },
    ],
  },
  {
    slug: 'mantenimiento-e-instalaciones',
    name: 'Mantenimiento e instalaciones',
    description: 'Mantenimiento técnico y servicios generales.',
    sortOrder: 70,
    subcategories: [
      {
        slug: 'mantenimiento-tecnico',
        name: 'Mantenimiento técnico',
        services: [
          ['MANTENIMIENTO_PREVENTIVO', 'Mantenimiento preventivo', RopCapacityUnit.HOUR],
          ['MANTENIMIENTO_CORRECTIVO', 'Mantenimiento correctivo', RopCapacityUnit.HOUR],
          ['INSTALACIONES_ELECTRICAS', 'Instalaciones eléctricas', RopCapacityUnit.HOUR],
        ],
      },
      {
        slug: 'servicios-generales',
        name: 'Servicios generales',
        services: [
          ['ASEO_Y_CAFETERIA', 'Aseo y cafetería', RopCapacityUnit.HOUR],
          ['JARDINERIA_Y_FACHADAS', 'Jardinería y fachadas', RopCapacityUnit.HOUR],
          ['SEGURIDAD_PRIVADA', 'Seguridad privada', RopCapacityUnit.HOUR],
        ],
      },
    ],
  },
  {
    slug: 'servicios-empresariales',
    name: 'Servicios empresariales',
    description: 'Marketing, comercial y soporte digital.',
    sortOrder: 80,
    subcategories: [
      {
        slug: 'marketing-comercial',
        name: 'Marketing y comercial',
        services: [
          ['ACTIVACION_BTL', 'Activación BTL y marca', RopCapacityUnit.ORDER],
          ['GESTION_CAMPANAS', 'Gestión de campañas', RopCapacityUnit.HOUR],
          ['DESARROLLO_CONTENIDO', 'Desarrollo de contenido', RopCapacityUnit.HOUR],
        ],
      },
      {
        slug: 'soporte-digital',
        name: 'Soporte digital y automatización',
        services: [
          ['DESARROLLO_WEB', 'Desarrollo web y landing pages', RopCapacityUnit.HOUR],
          ['AUTOMATIZACION_CRM', 'Automatización CRM', RopCapacityUnit.HOUR],
          ['SOPORTE_OPERATIVO_BACKOFFICE', 'Soporte operativo backoffice', RopCapacityUnit.HOUR],
        ],
      },
    ],
  },
]

/**
 * Inserta o actualiza el catálogo base. Operación idempotente (upsert por slug/código).
 */
export async function seedRopCatalog(client: PrismaClient): Promise<RopCatalogSeedSummary> {
  const summary: RopCatalogSeedSummary = { categories: 0, subcategories: 0, services: 0 }

  for (const category of ROP_DEFAULT_CATALOG) {
    const categoryRecord = await client.ropCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: {
        slug: category.slug,
        name: category.name,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      select: { id: true },
    })
    summary.categories += 1

    for (const subcategory of category.subcategories) {
      const subcategoryRecord = await client.ropSubcategory.upsert({
        where: { categoryId_slug: { categoryId: categoryRecord.id, slug: subcategory.slug } },
        update: { name: subcategory.name, description: subcategory.description ?? subcategory.name, isActive: true },
        create: {
          categoryId: categoryRecord.id,
          slug: subcategory.slug,
          name: subcategory.name,
          description: subcategory.description ?? subcategory.name,
          isActive: true,
        },
        select: { id: true },
      })
      summary.subcategories += 1

      for (const [code, name, unitOfCapacity] of subcategory.services) {
        await client.ropServiceCatalog.upsert({
          where: { code },
          update: { name, description: name, subcategoryId: subcategoryRecord.id, unitOfCapacity, isActive: true },
          create: {
            subcategoryId: subcategoryRecord.id,
            code,
            name,
            description: name,
            unitOfCapacity,
            isActive: true,
          },
          select: { id: true },
        })
        summary.services += 1
      }
    }
  }

  return summary
}

let catalogReady = false

/**
 * Garantiza que el catálogo base exista. Si la tabla de servicios está vacía
 * (base nueva o migración recién aplicada) ejecuta el seed automáticamente.
 */
export async function ensureRopCatalogSeeded(client: PrismaClient): Promise<void> {
  if (catalogReady) return

  const activeServices = await client.ropServiceCatalog.count({ where: { isActive: true } })
  if (activeServices > 0) {
    catalogReady = true
    return
  }

  const summary = await seedRopCatalog(client)
  catalogReady = true
  console.info('[rop-catalog] catálogo base aprovisionado', summary)
}
