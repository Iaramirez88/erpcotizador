export type ProductPresetCategory =
  | 'Volantes y Flyers'
  | 'Tarjetas y Postales'
  | 'Brochures y Dípticos'
  | 'Revistas y Catálogos'
  | 'Carpetas'
  | 'Sobres'
  | 'Afiches y Posters'
  | 'Etiquetas y Stickers'
  | 'Papelería Corporativa'
  | 'Formatos ISO'
  | 'Formatos US'

export type ProductPreset = {
  key: string
  nombre: string
  categoria: ProductPresetCategory
  widthCm: number
  heightCm: number
  notas?: string
}

export const PRODUCT_PRESETS: ProductPreset[] = [
  // Volantes / flyers (final size)
  { key: 'FLYER_A6', nombre: 'Volante A6', categoria: 'Volantes y Flyers', widthCm: 10.5, heightCm: 14.8 },
  { key: 'FLYER_A5', nombre: 'Volante A5', categoria: 'Volantes y Flyers', widthCm: 14.8, heightCm: 21 },
  { key: 'FLYER_A4', nombre: 'Volante A4', categoria: 'Volantes y Flyers', widthCm: 21, heightCm: 29.7 },
  { key: 'FLYER_HALF_LETTER', nombre: 'Volante 1/2 Carta', categoria: 'Volantes y Flyers', widthCm: 14, heightCm: 21.6, notas: 'Aprox. 5.5×8.5 in' },
  { key: 'FLYER_QUARTER_LETTER', nombre: 'Volante 1/4 Carta', categoria: 'Volantes y Flyers', widthCm: 10.8, heightCm: 14, notas: 'Aprox. 4.25×5.5 in' },
  { key: 'FLYER_LETTER', nombre: 'Volante Carta', categoria: 'Volantes y Flyers', widthCm: 21.6, heightCm: 27.9 },
  { key: 'FLYER_LEGAL_HALF', nombre: 'Volante 1/2 Oficio', categoria: 'Volantes y Flyers', widthCm: 21.6, heightCm: 17.8, notas: 'Aprox. 8.5×7 in' },

  // Tarjetas, postales
  { key: 'CARD_5X9', nombre: 'Tarjeta 5×9 cm', categoria: 'Tarjetas y Postales', widthCm: 5, heightCm: 9 },
  { key: 'CARD_5X8', nombre: 'Tarjeta 5×8 cm', categoria: 'Tarjetas y Postales', widthCm: 5, heightCm: 8 },
  { key: 'CARD_5_5X8_5', nombre: 'Tarjeta 5.5×8.5 cm', categoria: 'Tarjetas y Postales', widthCm: 5.5, heightCm: 8.5 },
  { key: 'CARD_6X9', nombre: 'Tarjeta 6×9 cm', categoria: 'Tarjetas y Postales', widthCm: 6, heightCm: 9 },
  { key: 'CARD_9X5', nombre: 'Tarjeta 9×5 cm (horizontal)', categoria: 'Tarjetas y Postales', widthCm: 9, heightCm: 5 },
  { key: 'POSTAL_10X15', nombre: 'Postal 10×15 cm', categoria: 'Tarjetas y Postales', widthCm: 10, heightCm: 15 },
  { key: 'POSTAL_12X18', nombre: 'Postal 12×18 cm', categoria: 'Tarjetas y Postales', widthCm: 12, heightCm: 18 },
  { key: 'POSTCARD_4X6', nombre: 'Postal 4×6 in', categoria: 'Tarjetas y Postales', widthCm: 10.16, heightCm: 15.24 },

  // Boletas / tickets
  { key: 'TICKET_21X8', nombre: 'Boleta 21×8 cm', categoria: 'Papelería Corporativa', widthCm: 21, heightCm: 8 },

  // Brochures / dípticos (final size)
  { key: 'BROCHURE_A4_BIFOLD_OPEN', nombre: 'Díptico A4 (abierto)', categoria: 'Brochures y Dípticos', widthCm: 42, heightCm: 29.7, notas: 'Se dobla a A5' },
  { key: 'BROCHURE_A4_TRIFOLD_OPEN', nombre: 'Tríptico A4 (abierto)', categoria: 'Brochures y Dípticos', widthCm: 29.7, heightCm: 21, notas: 'Se dobla a 9.9×21 cm' },
  { key: 'BROCHURE_LETTER_BIFOLD_OPEN', nombre: 'Díptico Carta (abierto)', categoria: 'Brochures y Dípticos', widthCm: 55.88, heightCm: 21.59, notas: 'Se dobla a 27.94×21.59 cm' },
  { key: 'BROCHURE_LETTER_TRIFOLD_OPEN', nombre: 'Tríptico Carta (abierto)', categoria: 'Brochures y Dípticos', widthCm: 27.94, heightCm: 21.59, notas: 'Se dobla a 9.31×21.59 cm' },

  // Revistas / catálogos (final size)
  { key: 'MAGAZINE_A4', nombre: 'Revista A4 (final)', categoria: 'Revistas y Catálogos', widthCm: 21, heightCm: 29.7 },
  { key: 'MAGAZINE_A5', nombre: 'Revista A5 (final)', categoria: 'Revistas y Catálogos', widthCm: 14.8, heightCm: 21 },
  { key: 'MAGAZINE_LETTER', nombre: 'Revista Carta (final)', categoria: 'Revistas y Catálogos', widthCm: 21.59, heightCm: 27.94 },
  { key: 'CATALOG_21_5X28', nombre: 'Catálogo 21.5×28 cm', categoria: 'Revistas y Catálogos', widthCm: 21.5, heightCm: 28 },

  // Carpetas (tamaños comunes de troquel / abierto)
  { key: 'FOLDER_LETTER_OPEN_18X12IN', nombre: 'Carpeta carta (abierta 18×12 in)', categoria: 'Carpetas', widthCm: 45.72, heightCm: 30.48, notas: 'Referencia típica para carpeta carta con bolsillo' },
  { key: 'FOLDER_A4_OPEN_47X32', nombre: 'Carpeta A4 (abierta 47×32 cm)', categoria: 'Carpetas', widthCm: 47, heightCm: 32, notas: 'Referencia típica; ajustar según troquel' },

  // Sobres
  { key: 'ENVELOPE_DL', nombre: 'Sobre DL (11×22 cm)', categoria: 'Sobres', widthCm: 11, heightCm: 22 },
  { key: 'ENVELOPE_C5', nombre: 'Sobre C5 (16.2×22.9 cm)', categoria: 'Sobres', widthCm: 16.2, heightCm: 22.9 },
  { key: 'ENVELOPE_C4', nombre: 'Sobre C4 (22.9×32.4 cm)', categoria: 'Sobres', widthCm: 22.9, heightCm: 32.4 },
  { key: 'ENVELOPE_10', nombre: 'Sobre #10 (10.5×24.1 cm)', categoria: 'Sobres', widthCm: 10.5, heightCm: 24.1, notas: 'Aprox. 4.125×9.5 in' },

  // Afiches y posters
  { key: 'POSTER_A3', nombre: 'Afiche A3', categoria: 'Afiches y Posters', widthCm: 29.7, heightCm: 42 },
  { key: 'POSTER_A2', nombre: 'Afiche A2', categoria: 'Afiches y Posters', widthCm: 42, heightCm: 59.4 },
  { key: 'POSTER_A1', nombre: 'Afiche A1', categoria: 'Afiches y Posters', widthCm: 59.4, heightCm: 84.1 },
  { key: 'POSTER_TABLOID', nombre: 'Tabloide 11×17 in', categoria: 'Afiches y Posters', widthCm: 27.94, heightCm: 43.18 },

  // Etiquetas / stickers (tamaños comunes)
  { key: 'STICKER_5X5', nombre: 'Sticker 5×5 cm', categoria: 'Etiquetas y Stickers', widthCm: 5, heightCm: 5 },
  { key: 'STICKER_8X8', nombre: 'Sticker 8×8 cm', categoria: 'Etiquetas y Stickers', widthCm: 8, heightCm: 8 },
  { key: 'STICKER_10X10', nombre: 'Sticker 10×10 cm', categoria: 'Etiquetas y Stickers', widthCm: 10, heightCm: 10 },
  { key: 'LABEL_5X3', nombre: 'Etiqueta 5×3 cm', categoria: 'Etiquetas y Stickers', widthCm: 5, heightCm: 3 },
  { key: 'LABEL_10X5', nombre: 'Etiqueta 10×5 cm', categoria: 'Etiquetas y Stickers', widthCm: 10, heightCm: 5 },

  // Papelería corporativa
  { key: 'LETTERHEAD_LETTER', nombre: 'Hoja membrete Carta', categoria: 'Papelería Corporativa', widthCm: 21.59, heightCm: 27.94 },
  { key: 'LETTERHEAD_A4', nombre: 'Hoja membrete A4', categoria: 'Papelería Corporativa', widthCm: 21, heightCm: 29.7 },

  // Formatos ISO
  { key: 'ISO_A0', nombre: 'A0', categoria: 'Formatos ISO', widthCm: 84.1, heightCm: 118.9 },
  { key: 'ISO_A1', nombre: 'A1', categoria: 'Formatos ISO', widthCm: 59.4, heightCm: 84.1 },
  { key: 'ISO_A2', nombre: 'A2', categoria: 'Formatos ISO', widthCm: 42, heightCm: 59.4 },
  { key: 'ISO_A3', nombre: 'A3', categoria: 'Formatos ISO', widthCm: 29.7, heightCm: 42 },
  { key: 'ISO_A4', nombre: 'A4', categoria: 'Formatos ISO', widthCm: 21, heightCm: 29.7 },
  { key: 'ISO_A5', nombre: 'A5', categoria: 'Formatos ISO', widthCm: 14.8, heightCm: 21 },
  { key: 'ISO_A6', nombre: 'A6', categoria: 'Formatos ISO', widthCm: 10.5, heightCm: 14.8 },

  // Formatos US
  { key: 'US_LETTER', nombre: 'Carta (Letter)', categoria: 'Formatos US', widthCm: 21.59, heightCm: 27.94 },
  { key: 'US_LEGAL', nombre: 'Oficio (Legal)', categoria: 'Formatos US', widthCm: 21.59, heightCm: 35.56 },
  { key: 'US_TABLOID', nombre: 'Tabloide', categoria: 'Formatos US', widthCm: 27.94, heightCm: 43.18 },
]

export function getProductPreset(key: string): ProductPreset | undefined {
  return PRODUCT_PRESETS.find((p) => p.key === key)
}

export function groupProductPresetsByCategory() {
  const map = new Map<ProductPresetCategory, ProductPreset[]>()
  for (const preset of PRODUCT_PRESETS) {
    const list = map.get(preset.categoria) ?? []
    list.push(preset)
    map.set(preset.categoria, list)
  }
  return Array.from(map.entries())
}
