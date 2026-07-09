export type LitografiaVisualProductIcon = 'document' | 'layers' | 'package' | 'book' | 'sparkles'

export type LitografiaVisualProduct = {
  id: string
  title: string
  shortTitle: string
  description: string
  finalWidthCm: number
  finalHeightCm: number
  operationalWidthCm?: number
  operationalHeightCm?: number
  frontInk: string
  backInk: string
  imageUrl?: string
  paperTypeHint?: string
  paperWeightHint?: number
  finishHints?: string[]
  extraNote?: string
  suggestedExtraQty?: number
}

export type LitografiaVisualCategory = {
  id: string
  label: string
  description: string
  icon: LitografiaVisualProductIcon
  accentClassName: string
  products: LitografiaVisualProduct[]
}

export type LitografiaVisualCatalogItemMeta = {
  categoryId?: string
  categoryLabel?: string
  categoryDescription?: string
  categoryIcon?: LitografiaVisualProductIcon
  imageUrl?: string
  shortTitle?: string
  description?: string
  finalWidthCm?: number
  finalHeightCm?: number
  operationalWidthCm?: number
  operationalHeightCm?: number
  frontInk?: string
  backInk?: string
  paperTypeHint?: string
  paperWeightHint?: number
  finishHints?: string[]
  extraNote?: string
  suggestedExtraQty?: number
}

export const LITOGRAFIA_VISUAL_CATEGORIES: LitografiaVisualCategory[] = [
  {
    id: 'cartas-menus',
    label: 'Cartas y menus',
    description: 'Menus y piezas plegadas para restaurantes, eventos y mostrador.',
    icon: 'document',
    accentClassName: 'border-sky-200 bg-sky-50/80 text-sky-900',
    products: [
      {
        id: 'menu-simple',
        title: 'Carta simple',
        shortTitle: 'Simple',
        description: 'Una hoja tradicional para menu, carta de bebidas o pieza institucional.',
        finalWidthCm: 21.59,
        finalHeightCm: 27.94,
        frontInk: '4',
        backInk: '4',
        paperTypeHint: 'propalcote',
        paperWeightHint: 300,
        finishHints: ['Laminado mate opcional'],
        suggestedExtraQty: 100,
      },
      {
        id: 'menu-diptico',
        title: 'Carta diptica',
        shortTitle: 'Diptica',
        description: 'Pieza plegada en dos cuerpos para menus o brochure corto.',
        finalWidthCm: 13.97,
        finalHeightCm: 21.59,
        operationalWidthCm: 27.94,
        operationalHeightCm: 21.59,
        frontInk: '4',
        backInk: '4',
        paperTypeHint: 'propalcote',
        paperWeightHint: 300,
        finishHints: ['Hendido para doblez', 'Laminado mate'],
        extraNote: 'La produccion suele imprimirse abierta y luego plegarse.',
        suggestedExtraQty: 120,
      },
      {
        id: 'menu-triptico',
        title: 'Carta triptica',
        shortTitle: 'Triptica',
        description: 'Formato de tres cuerpos para menu de restaurante, servicios o tarifas.',
        finalWidthCm: 9.31,
        finalHeightCm: 21.59,
        operationalWidthCm: 27.94,
        operationalHeightCm: 21.59,
        frontInk: '4',
        backInk: '4',
        paperTypeHint: 'propalcote',
        paperWeightHint: 300,
        finishHints: ['2 hendidos + plegado', 'Laminado mate'],
        extraNote: 'Referencia visual inicial; si el montaje real cambia, ajusta el formato operativo.',
        suggestedExtraQty: 120,
      },
      {
        id: 'menu-cuadriptico',
        title: 'Carta cuadriptica',
        shortTitle: 'Cuadriptica',
        description: 'Pieza plegada en cuatro cuerpos para menus amplios o portafolios.',
        finalWidthCm: 10.8,
        finalHeightCm: 21.59,
        operationalWidthCm: 43.18,
        operationalHeightCm: 21.59,
        frontInk: '4',
        backInk: '4',
        paperTypeHint: 'propalcote',
        paperWeightHint: 300,
        finishHints: ['3 hendidos + plegado', 'Laminado mate'],
        extraNote: 'Se recomienda validar el cuerpo final antes de cerrar la cotizacion.',
        suggestedExtraQty: 140,
      },
      {
        id: 'menu-encuadernado',
        title: 'Carta encuadernada',
        shortTitle: 'Encuadernada',
        description: 'Version con varias hojas para menu premium o portafolio de servicio.',
        finalWidthCm: 21,
        finalHeightCm: 29.7,
        frontInk: '4',
        backInk: '4',
        paperTypeHint: 'propalcote',
        paperWeightHint: 250,
        finishHints: ['Anillado o grapa', 'Portada laminada'],
        extraNote: 'Si el producto lleva varias paginas interiores, conviene migrarlo luego al flujo editorial.',
        suggestedExtraQty: 80,
      },
    ],
  },
  {
    id: 'flyers-brochures',
    label: 'Flyers y brochures',
    description: 'Volantes rapidos, plegables y piezas promocionales de alto volumen.',
    icon: 'layers',
    accentClassName: 'border-amber-200 bg-amber-50/80 text-amber-900',
    products: [
      {
        id: 'flyer-a6',
        title: 'Flyer A6',
        shortTitle: 'A6',
        description: 'Volante pequeno para reparto o activacion comercial.',
        finalWidthCm: 10.5,
        finalHeightCm: 14.8,
        frontInk: '4',
        backInk: '0',
        paperTypeHint: 'propalcote',
        paperWeightHint: 150,
        finishHints: ['Corte final'],
        suggestedExtraQty: 150,
      },
      {
        id: 'flyer-a5',
        title: 'Flyer A5',
        shortTitle: 'A5',
        description: 'Formato comercial equilibrado para promociones y eventos.',
        finalWidthCm: 14.8,
        finalHeightCm: 21,
        frontInk: '4',
        backInk: '4',
        paperTypeHint: 'propalcote',
        paperWeightHint: 150,
        finishHints: ['Corte final'],
        suggestedExtraQty: 150,
      },
      {
        id: 'brochure-a4-trifold',
        title: 'Brochure triptico A4',
        shortTitle: 'Triptico A4',
        description: 'Pieza plegable para servicios, turismo o producto corporativo.',
        finalWidthCm: 9.9,
        finalHeightCm: 21,
        operationalWidthCm: 29.7,
        operationalHeightCm: 21,
        frontInk: '4',
        backInk: '4',
        paperTypeHint: 'propalcote',
        paperWeightHint: 170,
        finishHints: ['2 hendidos + plegado'],
        suggestedExtraQty: 120,
      },
    ],
  },
  {
    id: 'tarjetas-postales',
    label: 'Tarjetas y postales',
    description: 'Piezas pequenas de alta calidad para marca, invitacion o contacto.',
    icon: 'package',
    accentClassName: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
    products: [
      {
        id: 'tarjeta-presentacion',
        title: 'Tarjeta de presentacion',
        shortTitle: 'Presentacion',
        description: 'Formato clasico para networking, marca y equipos comerciales.',
        finalWidthCm: 9,
        finalHeightCm: 5,
        frontInk: '4',
        backInk: '4',
        paperTypeHint: 'propalcote',
        paperWeightHint: 350,
        finishHints: ['Laminado mate', 'Esquinas redondeadas opcional'],
        suggestedExtraQty: 80,
      },
      {
        id: 'postal-10x15',
        title: 'Postal 10 x 15',
        shortTitle: 'Postal',
        description: 'Ideal para invitaciones, recordatorios o piezas con imagen protagonista.',
        finalWidthCm: 10,
        finalHeightCm: 15,
        frontInk: '4',
        backInk: '4',
        paperTypeHint: 'propalcote',
        paperWeightHint: 300,
        finishHints: ['Laminado brillante opcional'],
        suggestedExtraQty: 100,
      },
      {
        id: 'invitacion-12x18',
        title: 'Invitacion 12 x 18',
        shortTitle: 'Invitacion',
        description: 'Formato intermedio para eventos, lanzamientos o kits de marca.',
        finalWidthCm: 12,
        finalHeightCm: 18,
        frontInk: '4',
        backInk: '4',
        paperTypeHint: 'opalina',
        paperWeightHint: 250,
        finishHints: ['Corte final', 'Acabado especial opcional'],
        suggestedExtraQty: 100,
      },
    ],
  },
  {
    id: 'carpetas-sobres',
    label: 'Carpetas y sobres',
    description: 'Papeleria comercial para presentacion, archivo y entregas.',
    icon: 'book',
    accentClassName: 'border-fuchsia-200 bg-fuchsia-50/80 text-fuchsia-900',
    products: [
      {
        id: 'carpeta-carta',
        title: 'Carpeta carta',
        shortTitle: 'Carpeta',
        description: 'Carpeta institucional con bolsillo para propuestas y presentaciones.',
        finalWidthCm: 22.86,
        finalHeightCm: 30.48,
        operationalWidthCm: 45.72,
        operationalHeightCm: 30.48,
        frontInk: '4',
        backInk: '0',
        paperTypeHint: 'propalcote',
        paperWeightHint: 300,
        finishHints: ['Troquel', 'Laminado mate'],
        extraNote: 'Normalmente se imprime abierta y luego se troquela.',
        suggestedExtraQty: 80,
      },
      {
        id: 'sobre-dl',
        title: 'Sobre DL',
        shortTitle: 'DL',
        description: 'Sobre comercial delgado para facturas, cartas o flyers.',
        finalWidthCm: 11,
        finalHeightCm: 22,
        frontInk: '1',
        backInk: '0',
        paperTypeHint: 'bond',
        paperWeightHint: 90,
        finishHints: ['Pegado'],
        suggestedExtraQty: 120,
      },
      {
        id: 'sobre-c5',
        title: 'Sobre C5',
        shortTitle: 'C5',
        description: 'Sobre mediano para documentos doblados o kits de bienvenida.',
        finalWidthCm: 16.2,
        finalHeightCm: 22.9,
        frontInk: '1',
        backInk: '0',
        paperTypeHint: 'bond',
        paperWeightHint: 90,
        finishHints: ['Pegado'],
        suggestedExtraQty: 120,
      },
    ],
  },
]

function fallbackAccentClassName(categoryId: string, index: number) {
  const tones = [
    'border-sky-200 bg-sky-50/80 text-sky-900',
    'border-amber-200 bg-amber-50/80 text-amber-900',
    'border-emerald-200 bg-emerald-50/80 text-emerald-900',
    'border-fuchsia-200 bg-fuchsia-50/80 text-fuchsia-900',
    'border-slate-200 bg-slate-50/80 text-slate-900',
  ]
  const hash = Array.from(categoryId).reduce((acc, char) => acc + char.charCodeAt(0), index)
  return tones[hash % tones.length] || tones[0]
}

export function buildLitografiaVisualCatalogTemplateItems() {
  return LITOGRAFIA_VISUAL_CATEGORIES.flatMap((category, categoryIndex) => {
    return category.products.map((product, productIndex) => ({
      value: product.id,
      label: product.title,
      sortOrder: categoryIndex * 100 + productIndex,
      meta: {
        categoryId: category.id,
        categoryLabel: category.label,
        categoryDescription: category.description,
        categoryIcon: category.icon,
        imageUrl: product.imageUrl,
        shortTitle: product.shortTitle,
        description: product.description,
        finalWidthCm: product.finalWidthCm,
        finalHeightCm: product.finalHeightCm,
        operationalWidthCm: product.operationalWidthCm,
        operationalHeightCm: product.operationalHeightCm,
        frontInk: product.frontInk,
        backInk: product.backInk,
        paperTypeHint: product.paperTypeHint,
        paperWeightHint: product.paperWeightHint,
        finishHints: product.finishHints,
        extraNote: product.extraNote,
        suggestedExtraQty: product.suggestedExtraQty,
      } satisfies LitografiaVisualCatalogItemMeta,
    }))
  })
}

function asMetaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function metaString(meta: Record<string, unknown>, key: keyof LitografiaVisualCatalogItemMeta) {
  const value = meta[key]
  return typeof value === 'string' ? value.trim() : ''
}

function metaNumber(meta: Record<string, unknown>, key: keyof LitografiaVisualCatalogItemMeta) {
  const value = meta[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function metaStringArray(meta: Record<string, unknown>, key: keyof LitografiaVisualCatalogItemMeta) {
  const value = meta[key]
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(',').map((entry) => entry.trim()).filter(Boolean)
  }
  return [] as string[]
}

export function mapDropdownItemsToLitografiaVisualCategories(
  items: Array<{ value?: unknown; label?: unknown; meta?: unknown; activo?: unknown; sortOrder?: unknown }> | undefined,
) {
  const activeItems = (items || [])
    .filter((item) => item && item.activo !== false)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))

  const categories = new Map<string, LitografiaVisualCategory>()

  activeItems.forEach((item, index) => {
    const meta = asMetaRecord(item.meta)
    const productId = String(item.value || '').trim()
    const title = String(item.label || productId).trim()
    if (!productId || !title) return

    const categoryId = metaString(meta, 'categoryId') || 'otros'
    const categoryLabel = metaString(meta, 'categoryLabel') || 'Otros'
    const categoryDescription = metaString(meta, 'categoryDescription') || 'Productos visuales configurados desde base de datos.'
    const categoryIcon = (metaString(meta, 'categoryIcon') as LitografiaVisualProductIcon) || 'sparkles'

    const existingCategory = categories.get(categoryId) || {
      id: categoryId,
      label: categoryLabel,
      description: categoryDescription,
      icon: categoryIcon,
      accentClassName: fallbackAccentClassName(categoryId, index),
      products: [],
    }

    existingCategory.products.push({
      id: productId,
      title,
      shortTitle: metaString(meta, 'shortTitle') || title,
      description: metaString(meta, 'description') || title,
      imageUrl: metaString(meta, 'imageUrl') || undefined,
      finalWidthCm: metaNumber(meta, 'finalWidthCm') ?? 0,
      finalHeightCm: metaNumber(meta, 'finalHeightCm') ?? 0,
      operationalWidthCm: metaNumber(meta, 'operationalWidthCm'),
      operationalHeightCm: metaNumber(meta, 'operationalHeightCm'),
      frontInk: metaString(meta, 'frontInk') || '4',
      backInk: metaString(meta, 'backInk') || '0',
      paperTypeHint: metaString(meta, 'paperTypeHint') || undefined,
      paperWeightHint: metaNumber(meta, 'paperWeightHint'),
      finishHints: metaStringArray(meta, 'finishHints'),
      extraNote: metaString(meta, 'extraNote') || undefined,
      suggestedExtraQty: metaNumber(meta, 'suggestedExtraQty'),
    })

    categories.set(categoryId, existingCategory)
  })

  return [...categories.values()].filter((category) => category.products.length > 0)
}