import { cn } from "@/lib/utils"

type LitografiaCutGuideProps = {
  parentWidthCm: number
  parentHeightCm: number
  finalWidthCm: number
  finalHeightCm: number
  finalLabel: string
  printSheetLabel?: string
  runQty: number
  extraQty: number
  gapCm?: number
  machineWidthCm?: number
  machineHeightCm?: number
  className?: string
}

function formatCm(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-"
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function normalizeCut(width: number, height: number) {
  return width <= height ? [width, height] as const : [height, width] as const
}

function computeAxisFit(sheet: number, piece: number, gap: number) {
  if (sheet <= 0 || piece <= 0) return 0
  if (gap <= 0) return Math.floor(sheet / piece)
  return Math.floor((sheet + gap) / (piece + gap))
}

function computeLayout(sheetWidth: number, sheetHeight: number, pieceWidth: number, pieceHeight: number, gap: number) {
  const directAcross = computeAxisFit(sheetWidth, pieceWidth, gap)
  const directDown = computeAxisFit(sheetHeight, pieceHeight, gap)
  const directTotal = directAcross * directDown

  const rotatedAcross = computeAxisFit(sheetWidth, pieceHeight, gap)
  const rotatedDown = computeAxisFit(sheetHeight, pieceWidth, gap)
  const rotatedTotal = rotatedAcross * rotatedDown

  if (rotatedTotal > directTotal) {
    return {
      total: rotatedTotal,
      across: rotatedAcross,
      down: rotatedDown,
      orientation: "girado",
      pieceWidth: pieceHeight,
      pieceHeight: pieceWidth,
    } as const
  }

  return {
    total: directTotal,
    across: directAcross,
    down: directDown,
    orientation: "normal",
    pieceWidth,
    pieceHeight,
  } as const
}

function sameCut(aWidth: number, aHeight: number, bWidth: number, bHeight: number) {
  const [aw, ah] = normalizeCut(aWidth, aHeight)
  const [bw, bh] = normalizeCut(bWidth, bHeight)
  return Math.abs(aw - bw) < 0.25 && Math.abs(ah - bh) < 0.25
}

function getCutLabel(width: number, height: number, parentWidth: number, parentHeight: number) {
  if (sameCut(width, height, parentWidth, parentHeight)) return "Pliego completo"
  if (sameCut(width, height, 50, 70)) return "Medio pliego"
  if (sameCut(width, height, 35, 50)) return "Cuarto pliego"
  return `Hoja de impresión ${formatCm(width)}x${formatCm(height)}`
}

export function LitografiaCutGuide(props: LitografiaCutGuideProps) {
  const parentWidth = Number(props.parentWidthCm) || 0
  const parentHeight = Number(props.parentHeightCm) || 0
  const finalWidth = Number(props.finalWidthCm) || 0
  const finalHeight = Number(props.finalHeightCm) || 0
  const runQty = Math.max(0, Math.trunc(Number(props.runQty) || 0))
  const extraQty = Math.max(0, Math.trunc(Number(props.extraQty) || 0))
  const totalPieces = runQty + extraQty
  const gap = Math.max(0, Number(props.gapCm) || 0)
  const machineWidth = Number(props.machineWidthCm) || 0
  const machineHeight = Number(props.machineHeightCm) || 0

  if (parentWidth <= 0 || parentHeight <= 0 || finalWidth <= 0 || finalHeight <= 0) return null

  const activeCutWidth = machineWidth > 0 ? Math.min(parentWidth, machineWidth) : parentWidth
  const activeCutHeight = machineHeight > 0 ? Math.min(parentHeight, machineHeight) : parentHeight
  const activeCutLabel = getCutLabel(activeCutWidth, activeCutHeight, parentWidth, parentHeight)
  const activePrintSheetLabel = String(props.printSheetLabel || "").trim() || activeCutLabel
  const parentToCut = computeLayout(parentWidth, parentHeight, activeCutWidth, activeCutHeight, 0)
  const cutToPieces = computeLayout(activeCutWidth, activeCutHeight, finalWidth, finalHeight, gap)
  const impressionSheetsNeeded = cutToPieces.total > 0 ? Math.ceil(totalPieces / cutToPieces.total) : 0
  const parentSheetsNeeded = parentToCut.total > 0 ? Math.ceil(impressionSheetsNeeded / parentToCut.total) : 0
  const displayCutWidth = parentToCut.orientation === "girado" ? activeCutHeight : activeCutWidth
  const displayCutHeight = parentToCut.orientation === "girado" ? activeCutWidth : activeCutHeight
  const finalPieceWidth = cutToPieces.orientation === "girado" ? finalHeight : finalWidth
  const finalPieceHeight = cutToPieces.orientation === "girado" ? finalWidth : finalHeight

  return (
    <div className={cn("rounded-lg border border-sky-200 bg-sky-50/40 p-3", props.className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Guía visual de corte e imposición</p>
          <p className="text-[11px] text-muted-foreground">Papel base {formatCm(parentWidth)} x {formatCm(parentHeight)} cm.</p>
          <p className="text-[11px] text-muted-foreground">Impresión activa: {activePrintSheetLabel} {formatCm(activeCutWidth)}x{formatCm(activeCutHeight)} cm.</p>
          <p className="text-[11px] text-muted-foreground">Cliente recibe: {props.finalLabel}.</p>
        </div>
        <div className="rounded-md border bg-white/70 px-2 py-1 text-[11px] text-muted-foreground">
          Cliente {runQty} + sobrante {extraQty} = producción {totalPieces}
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border bg-white/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Hoja de impresión activa</p>
            <span className="text-[10px] font-medium text-sky-700">{activePrintSheetLabel}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {formatCm(parentWidth)}x{formatCm(parentHeight)} → {parentToCut.total || 0} cortes de {formatCm(activeCutWidth)}x{formatCm(activeCutHeight)}.
          </p>

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border bg-slate-50 p-2">
              <p className="mb-2 text-[11px] font-medium text-foreground">Pliego base</p>
              <svg viewBox={`0 0 ${parentWidth} ${parentHeight}`} className="h-auto w-full max-h-[130px]">
                <rect x={0} y={0} width={parentWidth} height={parentHeight} fill="#f8fafc" stroke="#64748b" strokeWidth={0.6} rx={2} ry={2} />
                {Array.from({ length: Math.min(parentToCut.total, 12) }).map((_, index) => {
                  const column = index % Math.max(1, parentToCut.across)
                  const row = Math.floor(index / Math.max(1, parentToCut.across))
                  return (
                    <rect
                      key={index}
                      x={column * displayCutWidth}
                      y={row * displayCutHeight}
                      width={displayCutWidth}
                      height={displayCutHeight}
                      fill="#fef3c7"
                      stroke="#d97706"
                      strokeWidth={0.45}
                      rx={1}
                      ry={1}
                    />
                  )
                })}
              </svg>
            </div>

            <div className="rounded-md border bg-slate-50 p-2">
              <p className="mb-2 text-[11px] font-medium text-foreground">Dentro de la hoja de impresión</p>
              <svg viewBox={`0 0 ${activeCutWidth} ${activeCutHeight}`} className="h-auto w-full max-h-[130px]">
                <rect x={0} y={0} width={activeCutWidth} height={activeCutHeight} fill="#fff7ed" stroke="#c2410c" strokeWidth={0.6} rx={2} ry={2} />
                {Array.from({ length: Math.min(cutToPieces.total, 48) }).map((_, index) => {
                  const column = index % Math.max(1, cutToPieces.across)
                  const row = Math.floor(index / Math.max(1, cutToPieces.across))
                  return (
                    <rect
                      key={index}
                      x={column * (finalPieceWidth + gap)}
                      y={row * (finalPieceHeight + gap)}
                      width={finalPieceWidth}
                      height={finalPieceHeight}
                      fill="#bae6fd"
                      stroke="#0284c7"
                      strokeWidth={0.35}
                      rx={0.8}
                      ry={0.8}
                    />
                  )
                })}
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-white/80 p-3 text-[11px] text-muted-foreground space-y-2">
          <p className="text-sm font-medium text-foreground">Resumen de cliente e impresión</p>
          <p>
            Cliente ve: {runQty} piezas finales de {props.finalLabel}.
          </p>
          <p>
            Producción: {totalPieces} piezas incluyendo sobrante.
          </p>
          <p>
            En cada hoja de impresión ({activePrintSheetLabel}) caben {cutToPieces.total || 0} piezas: {cutToPieces.across} x {cutToPieces.down} ({cutToPieces.orientation}).
          </p>
          <p>
            Tiraje para impresor: {impressionSheetsNeeded} hojas de impresión para fabricar esas {totalPieces} piezas.
          </p>
          <p>
            Como del pliego base salen {parentToCut.total || 0} hojas de impresión, necesitas {parentSheetsNeeded} pliegos de papel.
          </p>
          <div className="rounded-md border bg-sky-50 px-2 py-2 text-sky-900">
            Ejemplo actual: el cliente compra {runQty} piezas, producción fabrica {totalPieces}, el impresor tira {impressionSheetsNeeded} hojas y se consumen {parentSheetsNeeded} pliegos base.
          </div>
        </div>
      </div>
    </div>
  )
}