export type LitografiaAiHandoff = {
  id: string
  brief: string
  quoteType: string
  producto: string | null
  cantidad: number | null
  anchoCm: number | null
  altoCm: number | null
  paginas: number | null
  tintas: 1 | 2 | 4 | null
  material: string | null
  acabado: string | null
  finishHints?: {
    genericLabels: string[]
    plastificadoLabel: string | null
    troqueladoLabel: string | null
    troqueladaLabel: string | null
    corteLabel: string | null
  }
  pricingHints?: {
    sizeLabel: string | null
    paperName: string | null
    transportLabel: string | null
    machineName: string | null
  }
  assistantReply: string | null
  entrega: string | null
  quotedItem?: {
    description: string
    quantity: number
    unit: string
    subtotalWithIva: number
    subtotalBeforeIva: number | null
    unitPriceWithIva: number | null
    ivaPct: number
    machineName: string | null
    paperName: string | null
    sizeLabel: string | null
    summary: string | null
  }
}