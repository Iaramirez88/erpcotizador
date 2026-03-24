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

function formatMeasurePair(width: number, height: number) {
  return `${formatCm(width)} x ${formatCm(height)} cm`
}

function DimensionArrow({
  x1,
  y1,
  x2,
  y2,
  label,
  color,
  labelX,
  labelY,
  rotateLabel = false,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
  color: string
  labelX: number
  labelY: number
  rotateLabel?: boolean
}) {
  const markerId = `arrow-${color.replace(/[^a-z0-9]/gi, '')}-${Math.round(x1)}-${Math.round(y1)}-${Math.round(x2)}-${Math.round(y2)}`

  return (
    <>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.7} markerStart={`url(#${markerId})`} markerEnd={`url(#${markerId})`} />
      <text
        x={labelX}
        y={labelY}
        fill={color}
        fontSize="7"
        fontWeight="600"
        textAnchor="middle"
        transform={rotateLabel ? `rotate(-90 ${labelX} ${labelY})` : undefined}
      >
        {label}
      </text>
    </>
  )
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
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-sm border border-amber-500 bg-amber-100" />
              Papel base
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-sm border border-orange-600 bg-orange-50" />
              Hoja de impresión activa
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-sm border border-sky-600 bg-sky-200" />
              Pieza final impresa
            </span>
          </div>
        </div>
        <div className="rounded-md border bg-white/70 px-2 py-1 text-[11px] text-muted-foreground">
          Cliente {runQty} + sobrante {extraQty} = producción {totalPieces}
        </div>
      </div>

      <div className="mt-3">
        <div className="rounded-lg border bg-white/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Hoja de impresión activa</p>
            <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
              ESTA ES LA HOJA QUE VA A IMPRESIÓN
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatCm(parentWidth)}x{formatCm(parentHeight)} → {parentToCut.total || 0} cortes de {formatCm(activeCutWidth)}x{formatCm(activeCutHeight)}.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Referencia activa: {activePrintSheetLabel}.
          </p>

          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border bg-slate-50 p-2">
              <p className="mb-2 text-[11px] font-medium text-foreground">Pliego base</p>
              <p className="mb-2 text-[10px] text-muted-foreground">
                Medida del papel: {formatMeasurePair(parentWidth, parentHeight)}.
              </p>
              <div className="relative">
                <svg viewBox={`-16 -16 ${parentWidth + 32} ${parentHeight + 32}`} className="h-auto w-full max-h-[150px] overflow-visible">
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
                  <DimensionArrow
                    x1={0}
                    y1={parentHeight + 9}
                    x2={parentWidth}
                    y2={parentHeight + 9}
                    label={`${formatCm(parentWidth)} cm`}
                    color="#475569"
                    labelX={parentWidth / 2}
                    labelY={parentHeight + 15}
                  />
                  <DimensionArrow
                    x1={-9}
                    y1={0}
                    x2={-9}
                    y2={parentHeight}
                    label={`${formatCm(parentHeight)} cm`}
                    color="#475569"
                    labelX={-14}
                    labelY={parentHeight / 2}
                    rotateLabel
                  />
                </svg>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Cada bloque amarillo representa una hoja activa de {formatMeasurePair(displayCutWidth, displayCutHeight)}.
              </p>
            </div>

            <div className="rounded-md border border-orange-200 bg-orange-50/50 p-2 shadow-sm">
              <p className="mb-2 text-[11px] font-medium text-foreground">Dentro de la hoja de impresión</p>
              <p className="mb-2 text-[10px] text-muted-foreground">
                Hoja activa: {formatMeasurePair(activeCutWidth, activeCutHeight)}.
              </p>
              <div className="relative">
                <svg viewBox={`-16 -16 ${activeCutWidth + 32} ${activeCutHeight + 32}`} className="h-auto w-full max-h-[150px] overflow-visible">
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
                  <DimensionArrow
                    x1={0}
                    y1={activeCutHeight + 9}
                    x2={activeCutWidth}
                    y2={activeCutHeight + 9}
                    label={`${formatCm(activeCutWidth)} cm`}
                    color="#c2410c"
                    labelX={activeCutWidth / 2}
                    labelY={activeCutHeight + 15}
                  />
                  <DimensionArrow
                    x1={-9}
                    y1={0}
                    x2={-9}
                    y2={activeCutHeight}
                    label={`${formatCm(activeCutHeight)} cm`}
                    color="#c2410c"
                    labelX={-14}
                    labelY={activeCutHeight / 2}
                    rotateLabel
                  />
                </svg>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Cada bloque azul es una pieza final de {formatMeasurePair(finalPieceWidth, finalPieceHeight)}.
              </p>
            </div>
          </div>
        </div>
        <details className="mt-3 rounded-lg border bg-white/80 p-3 text-[11px] text-muted-foreground group">
          <summary className="cursor-pointer list-none select-none font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <div className="flex items-center justify-between gap-3">
              <span>Resumen de cliente e impresión</span>
              <span className="text-[10px] text-muted-foreground group-open:hidden">Mostrar</span>
              <span className="hidden text-[10px] text-muted-foreground group-open:inline">Ocultar</span>
            </div>
          </summary>
          <div className="mt-3 space-y-2">
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
        </details>
      </div>
    </div>
  )
}