import { cn } from "@/lib/utils"

type LitografiaImpositionPreviewProps = {
  sheetWidthCm: number
  sheetHeightCm: number
  machineSheetWidthCm?: number
  machineSheetHeightCm?: number
  machineSheetsAcross?: number
  machineSheetsDown?: number
  machineSheetsPerParent?: number
  utilWidthCm: number
  utilHeightCm: number
  pieceWidthCm: number
  pieceHeightCm: number
  piecesAcross: number
  piecesDown: number
  gapCm?: number
  paperLabel: string
  formatLabel: string
  machineLabel: string
  arrangementLabel: string
  orientationLabel: string
  className?: string
}

type PieceRect = {
  x: number
  y: number
  width: number
  height: number
}

const MAX_VISIBLE_PIECES = 120

function safePositive(value: number, fallback = 1) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function formatCm(value: number) {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized <= 0) return "-"
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2)
}

function buildPieceRects(args: {
  startX: number
  startY: number
  pieceWidth: number
  pieceHeight: number
  gap: number
  across: number
  down: number
}) {
  const rects: PieceRect[] = []
  for (let row = 0; row < args.down; row += 1) {
    for (let column = 0; column < args.across; column += 1) {
      rects.push({
        x: args.startX + column * (args.pieceWidth + args.gap),
        y: args.startY + row * (args.pieceHeight + args.gap),
        width: args.pieceWidth,
        height: args.pieceHeight,
      })
      if (rects.length >= MAX_VISIBLE_PIECES) return rects
    }
  }
  return rects
}

function resolveMachineSheetWithinParent(parentWidth: number, parentHeight: number, machineWidth: number, machineHeight: number) {
  const safeParentWidth = safePositive(parentWidth)
  const safeParentHeight = safePositive(parentHeight)
  const safeMachineWidth = safePositive(machineWidth, safeParentWidth)
  const safeMachineHeight = safePositive(machineHeight, safeParentHeight)

  const direct = {
    width: Math.min(safeParentWidth, safeMachineWidth),
    height: Math.min(safeParentHeight, safeMachineHeight),
  }
  const rotated = {
    width: Math.min(safeParentWidth, safeMachineHeight),
    height: Math.min(safeParentHeight, safeMachineWidth),
  }

  return (rotated.width * rotated.height) > (direct.width * direct.height) ? rotated : direct
}

export function LitografiaImpositionPreview(props: LitografiaImpositionPreviewProps) {
  const sheetWidth = safePositive(props.sheetWidthCm)
  const sheetHeight = safePositive(props.sheetHeightCm)
  const machineSheet = resolveMachineSheetWithinParent(
    sheetWidth,
    sheetHeight,
    props.machineSheetWidthCm ?? props.utilWidthCm,
    props.machineSheetHeightCm ?? props.utilHeightCm,
  )
  const machineSheetWidth = machineSheet.width
  const machineSheetHeight = machineSheet.height
  const machineSheetsAcross = Math.max(0, Math.trunc(props.machineSheetsAcross ?? 0))
  const machineSheetsDown = Math.max(0, Math.trunc(props.machineSheetsDown ?? 0))
  const utilWidth = Math.min(sheetWidth, safePositive(props.utilWidthCm, sheetWidth))
  const utilHeight = Math.min(sheetHeight, safePositive(props.utilHeightCm, sheetHeight))
  const pieceWidth = safePositive(props.pieceWidthCm)
  const pieceHeight = safePositive(props.pieceHeightCm)
  const piecesAcross = Math.max(0, Math.trunc(props.piecesAcross))
  const piecesDown = Math.max(0, Math.trunc(props.piecesDown))
  const gap = Math.max(0, Number(props.gapCm) || 0)

  const machineRects = buildPieceRects({
    startX: 0,
    startY: 0,
    pieceWidth: machineSheetWidth,
    pieceHeight: machineSheetHeight,
    gap: 0,
    across: machineSheetsAcross,
    down: machineSheetsDown,
  })
  const utilX = Math.max(0, (machineSheetWidth - utilWidth) / 2)
  const utilY = Math.max(0, (machineSheetHeight - utilHeight) / 2)
  const usedWidth = piecesAcross > 0 ? (piecesAcross * pieceWidth) + (Math.max(0, piecesAcross - 1) * gap) : 0
  const usedHeight = piecesDown > 0 ? (piecesDown * pieceHeight) + (Math.max(0, piecesDown - 1) * gap) : 0
  const pieceRects = buildPieceRects({
    startX: utilX,
    startY: utilY,
    pieceWidth,
    pieceHeight,
    gap,
    across: piecesAcross,
    down: piecesDown,
  })
  const totalPieces = piecesAcross * piecesDown

  return (
    <div className={cn("rounded-lg border bg-background/70 p-3", props.className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Vista de imposicion del pliego</p>
          <p className="text-[11px] text-muted-foreground">{props.paperLabel}</p>
          <p className="text-[11px] text-muted-foreground">{props.machineLabel}</p>
        </div>
        <div className="rounded-md border bg-muted/40 px-2 py-1 text-right text-[11px] text-muted-foreground">
          <div className="font-medium text-foreground">{props.arrangementLabel}</div>
          <div>{totalPieces} piezas por pliego</div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border bg-gradient-to-b from-slate-50 to-white p-3">
          <p className="mb-2 text-[11px] font-medium text-foreground">1. Del pliego sale el corte de máquina</p>
          <svg
            viewBox={`0 0 ${sheetWidth} ${sheetHeight}`}
            className="mx-auto block h-auto max-h-[240px] w-full"
            aria-label="Vista del pliego y corte de máquina"
            role="img"
          >
            <rect x={0} y={0} width={sheetWidth} height={sheetHeight} rx={2} ry={2} fill="#f8fafc" stroke="#64748b" strokeWidth={0.5} />
            {machineRects.map((piece, index) => (
              <rect
                key={`machine-${piece.x}-${piece.y}-${index}`}
                x={piece.x}
                y={piece.y}
                width={piece.width}
                height={piece.height}
                rx={1}
                ry={1}
                fill="#fef3c7"
                stroke="#d97706"
                strokeWidth={0.45}
              />
            ))}
          </svg>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {props.machineSheetsPerParent ?? 0} hojas de máquina por pliego
          </p>
        </div>

        <div className="rounded-lg border bg-gradient-to-b from-slate-50 to-white p-3">
          <p className="mb-2 text-[11px] font-medium text-foreground">2. En cada hoja de máquina caben las piezas finales</p>
          <svg
            viewBox={`0 0 ${machineSheetWidth} ${machineSheetHeight}`}
            className="mx-auto block h-auto max-h-[240px] w-full"
            aria-label="Vista de imposición en hoja de máquina"
            role="img"
          >
            <rect x={0} y={0} width={machineSheetWidth} height={machineSheetHeight} rx={2} ry={2} fill="#fff7ed" stroke="#c2410c" strokeWidth={0.5} />
            <rect
              x={utilX}
              y={utilY}
              width={utilWidth}
              height={utilHeight}
              rx={1.5}
              ry={1.5}
              fill="#eff6ff"
              stroke="#0ea5e9"
              strokeDasharray="2 1"
              strokeWidth={0.5}
            />

            {pieceRects.map((piece, index) => (
              <rect
                key={`${piece.x}-${piece.y}-${index}`}
                x={piece.x}
                y={piece.y}
                width={piece.width}
                height={piece.height}
                rx={0.8}
                ry={0.8}
                fill="#0ea5e9"
                fillOpacity={0.18}
                stroke="#0284c7"
                strokeWidth={0.35}
              />
            ))}

            {usedWidth > 0 && usedHeight > 0 ? (
              <rect
                x={utilX}
                y={utilY}
                width={Math.min(usedWidth, utilWidth)}
                height={Math.min(usedHeight, utilHeight)}
                rx={1}
                ry={1}
                fill="transparent"
                stroke="#0369a1"
                strokeWidth={0.7}
              />
            ) : null}
          </svg>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">Pliego</p>
          <p>{formatCm(sheetWidth)} x {formatCm(sheetHeight)} cm</p>
        </div>
        <div className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">Corte máquina</p>
          <p>{formatCm(machineSheetWidth)} x {formatCm(machineSheetHeight)} cm</p>
        </div>
        <div className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">Area util</p>
          <p>{formatCm(utilWidth)} x {formatCm(utilHeight)} cm</p>
        </div>
        <div className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">Formato</p>
          <p>{props.formatLabel}</p>
        </div>
        <div className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">Imposicion</p>
          <p>{props.arrangementLabel} • {props.orientationLabel}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-slate-500 bg-slate-100" />
          Pliego completo
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-amber-600 bg-amber-100" />
          Corte de máquina
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-sky-500 bg-sky-100" />
          Area util de maquina
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-sky-700 bg-sky-300/60" />
          Pieza final repetida
        </span>
      </div>

      {totalPieces > MAX_VISIBLE_PIECES ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Vista simplificada: se muestran {MAX_VISIBLE_PIECES} piezas de un total de {totalPieces}.
        </p>
      ) : null}
    </div>
  )
}