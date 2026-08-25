import { PrismaClient } from '.prisma/client/default'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const CATALOG = [
  {
    slug: 'impresion-produccion',
    name: 'Impresión y producción',
    subcategories: [
      {
        slug: 'impresion-comercial',
        name: 'Impresión comercial',
        services: [
          ['OFFSET_PLIEGO', 'Impresión offset por pliego', 'ORDER'],
          ['DIGITAL_TIRAJES_CORTOS', 'Impresión digital de tirajes cortos', 'ORDER'],
          ['GRAN_FORMATO', 'Impresión gran formato', 'M2'],
        ],
      },
      {
        slug: 'acabados-ensamble',
        name: 'Acabados y ensamble',
        services: [
          ['LAMINADO_Y_BARNIZ', 'Laminado y barniz', 'M2'],
          ['TROQUELADO_Y_CORTE', 'Troquelado y corte', 'UNIT'],
          ['EMPAQUE_PROMOCIONAL', 'Empaque promocional y armado', 'UNIT'],
        ],
      },
    ],
  },
  {
    slug: 'manufactura-y-taller',
    name: 'Manufactura y taller',
    subcategories: [
      {
        slug: 'metal-madera',
        name: 'Metal, madera y taller',
        services: [
          ['CORTE_Y_SOLDADURA', 'Corte y soldadura', 'HOUR'],
          ['CARPINTERIA_Y_MDF', 'Carpintería y MDF', 'UNIT'],
          ['PINTURA_Y_ACABADO', 'Pintura industrial y acabado', 'M2'],
        ],
      },
      {
        slug: 'textil-confeccion',
        name: 'Textil y confección',
        services: [
          ['CORTE_TEXTIL', 'Corte textil', 'UNIT'],
          ['CONFECCION_SERIE', 'Confección por serie', 'UNIT'],
          ['BORDADO_Y_MARQUILLA', 'Bordado y marquilla', 'UNIT'],
        ],
      },
    ],
  },
  {
    slug: 'logistica-y-distribucion',
    name: 'Logística y distribución',
    subcategories: [
      {
        slug: 'ultima-milla',
        name: 'Última milla y mensajería',
        services: [
          ['MENSAJERIA_URBANA', 'Mensajería urbana', 'ORDER'],
          ['DISTRIBUCION_ULTIMA_MILLA', 'Distribución de última milla', 'ORDER'],
          ['RECOLECCION_PROGRAMADA', 'Recolección programada', 'ORDER'],
        ],
      },
      {
        slug: 'bodega-fulfillment',
        name: 'Bodega y fulfillment',
        services: [
          ['ALISTAMIENTO_PEDIDOS', 'Alistamiento de pedidos', 'UNIT'],
          ['ALMACENAMIENTO_TEMPORAL', 'Almacenamiento temporal', 'KG'],
          ['EMPAQUE_Y_DESPACHO', 'Empaque y despacho', 'ORDER'],
        ],
      },
    ],
  },
  {
    slug: 'servicios-empresariales',
    name: 'Servicios empresariales',
    subcategories: [
      {
        slug: 'marketing-comercial',
        name: 'Marketing y comercial',
        services: [
          ['ACTIVACION_BTL', 'Activación BTL y marca', 'ORDER'],
          ['GESTION_CAMPANAS', 'Gestión de campañas', 'HOUR'],
          ['DESARROLLO_CONTENIDO', 'Desarrollo de contenido', 'HOUR'],
        ],
      },
      {
        slug: 'soporte-digital',
        name: 'Soporte digital y automatización',
        services: [
          ['DESARROLLO_WEB', 'Desarrollo web y landing pages', 'HOUR'],
          ['AUTOMATIZACION_CRM', 'Automatización CRM', 'HOUR'],
          ['SOPORTE_OPERATIVO_BACKOFFICE', 'Soporte operativo backoffice', 'HOUR'],
        ],
      },
    ],
  },
] as const

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está definido')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  let categoryCount = 0
  let subcategoryCount = 0
  let serviceCount = 0

  try {
    for (const category of CATALOG) {
      const categoryRecord = await prisma.ropCategory.upsert({
        where: { slug: category.slug },
        update: { name: category.name, isActive: true },
        create: { slug: category.slug, name: category.name, description: category.name, isActive: true },
        select: { id: true, name: true },
      })
      categoryCount += 1

      for (const subcategory of category.subcategories) {
        const subcategoryRecord = await prisma.ropSubcategory.upsert({
          where: { categoryId_slug: { categoryId: categoryRecord.id, slug: subcategory.slug } },
          update: { name: subcategory.name, isActive: true },
          create: {
            categoryId: categoryRecord.id,
            slug: subcategory.slug,
            name: subcategory.name,
            description: subcategory.name,
            isActive: true,
          },
          select: { id: true, name: true },
        })
        subcategoryCount += 1

        for (const [code, name, unitOfCapacity] of subcategory.services) {
          await prisma.ropServiceCatalog.upsert({
            where: { code },
            update: {
              name,
              subcategoryId: subcategoryRecord.id,
              unitOfCapacity,
              isActive: true,
            },
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
          serviceCount += 1
        }
      }
    }

    console.log(`Categorias ROP procesadas: ${categoryCount}`)
    console.log(`Subcategorias ROP procesadas: ${subcategoryCount}`)
    console.log(`Servicios ROP procesados: ${serviceCount}`)
    console.log('Seed ROP catálogo completado.')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Seed ROP catálogo falló:', error)
  process.exit(1)
})