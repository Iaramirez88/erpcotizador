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
  sheetPiecesAcross: number
  sheetPiecesDown: number
  machinePiecesAcross: number
  machinePiecesDown: number
  sheetPiecesPerParent?: number
  machinePiecesPerSheet?: number
  gapCm?: number
  paperLabel: string
  formatLabel: string
  machineLabel: string
  sheetArrangementLabel: string
  machineArrangementLabel: string
  sheetOrientationLabel: string
  machineOrientationLabel?: string
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
  const utilWidth = Math.min(machineSheetWidth, safePositive(props.utilWidthCm, machineSheetWidth))
  const utilHeight = Math.min(machineSheetHeight, safePositive(props.utilHeightCm, machineSheetHeight))
  const pieceWidth = safePositive(props.pieceWidthCm)
  const pieceHeight = safePositive(props.pieceHeightCm)
  const sheetPiecesAcross = Math.max(0, Math.trunc(props.sheetPiecesAcross))
  const sheetPiecesDown = Math.max(0, Math.trunc(props.sheetPiecesDown))
  const machinePiecesAcross = Math.max(0, Math.trunc(props.machinePiecesAcross))
  const machinePiecesDown = Math.max(0, Math.trunc(props.machinePiecesDown))
  const gap = Math.max(0, Number(props.gapCm) || 0)

  const totalPieces = sheetPiecesAcross * sheetPiecesDown
  const totalMachinePieces = machinePiecesAcross * machinePiecesDown
  const parentPieces = props.sheetPiecesPerParent ?? totalPieces
  const machinePieces = props.machinePiecesPerSheet ?? totalMachinePieces

  const sheetUsedWidth = sheetPiecesAcross > 0 ? (sheetPiecesAcross * pieceWidth) + (Math.max(0, sheetPiecesAcross - 1) * gap) : 0
  const sheetUsedHeight = sheetPiecesDown > 0 ? (sheetPiecesDown * pieceHeight) + (Math.max(0, sheetPiecesDown - 1) * gap) : 0
  const sheetStartX = Math.max(0, (sheetWidth - Math.min(sheetUsedWidth, sheetWidth)) / 2)
  const sheetStartY = Math.max(0, (sheetHeight - Math.min(sheetUsedHeight, sheetHeight)) / 2)
  const utilX = Math.max(0, (machineSheetWidth - utilWidth) / 2)
  const utilY = Math.max(0, (machineSheetHeight - utilHeight) / 2)
  const usedWidth = machinePiecesAcross > 0 ? (machinePiecesAcross * pieceWidth) + (Math.max(0, machinePiecesAcross - 1) * gap) : 0
  const usedHeight = machinePiecesDown > 0 ? (machinePiecesDown * pieceHeight) + (Math.max(0, machinePiecesDown - 1) * gap) : 0

  const machineRects = buildPieceRects({
    startX: 0,
    startY: 0,
    pieceWidth: machineSheetWidth,
    pieceHeight: machineSheetHeight,
    gap: 0,
    across: machineSheetsAcross,
    down: machineSheetsDown,
  })
  const sheetPieceRects = buildPieceRects({
    startX: sheetStartX,
    startY: sheetStartY,
    pieceWidth,
    pieceHeight,
    gap,
    across: sheetPiecesAcross,
    down: sheetPiecesDown,
  })
  const pieceRects = buildPieceRects({
    startX: utilX,
    startY: utilY,
    pieceWidth,
    pieceHeight,
    gap,
    across: machinePiecesAcross,
    down: machinePiecesDown,
  })

  return (
    <div className={cn("rounded-lg border bg-background/70 p-3", props.className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium">Resumen visual de imposición</p>
          <p className="text-[11px] text-muted-foreground">{props.paperLabel}</p>
          <p className="text-[11px] text-muted-foreground">{props.formatLabel}</p>
        </div>
        <div className="rounded-md border bg-muted/40 px-2 py-1 text-right text-[11px] text-muted-foreground">
          <div className="font-medium text-foreground">{parentPieces} por pliego</div>
          <div>{machinePieces} por hoja de máquina</div>
          <div>{props.machineLabel}</div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border bg-gradient-to-b from-slate-50 to-white p-3">
          <p className="mb-2 text-[11px] font-medium text-foreground">Pliego comprado y cortes de máquina</p>
          <svg
            viewBox={`0 0 ${sheetWidth} ${sheetHeight}`}
            className="mx-auto block h-auto max-h-[260px] w-full"
            aria-label="Resumen visual del pliego comprado y cortes de máquina"
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
            {sheetPieceRects.map((piece, index) => (
              <rect
                key={`sheet-piece-${piece.x}-${piece.y}-${index}`}
                x={piece.x}
                y={piece.y}
                width={piece.width}
                height={piece.height}
                rx={0.8}
                ry={0.8}
                fill="#0ea5e9"
                fillOpacity={0.14}
                stroke="#0284c7"
                strokeWidth={0.35}
              />
            ))}
          </svg>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
              <p className="font-semibold text-slate-950">Rendimiento de papel</p>
              <p>{parentPieces} piezas finales por pliego</p>
              <p>{props.sheetArrangementLabel} · {props.sheetOrientationLabel}</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              <p className="font-semibold text-amber-950">Corte de máquina</p>
              <p>{props.machineSheetsPerParent ?? machineRects.length} hojas de máquina por pliego</p>
              <p>{props.machineArrangementLabel}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-gradient-to-b from-slate-50 to-white p-3">
          <p className="mb-2 text-[11px] font-medium text-foreground">Hoja activa de impresión</p>
          <svg
            viewBox={`0 0 ${machineSheetWidth} ${machineSheetHeight}`}
            className="mx-auto block h-auto max-h-[260px] w-full"
            aria-label="Hoja activa de impresión"
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
                fill="none"
                stroke="#ea580c"
                strokeDasharray="2 1"
                strokeWidth={0.6}
              />
            ) : null}
          </svg>
          <div className="mt-3 space-y-2 text-[11px] text-muted-foreground">
            <p>La máquina imprime {machinePieces} piezas por hoja activa.</p>
            <p>{props.machineArrangementLabel}{props.machineOrientationLabel ? ` · ${props.machineOrientationLabel}` : ""}</p>
            <p>Este dato no reemplaza el rendimiento real del pliego comprado.</p>
          </div>
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
          <p className="font-medium text-foreground">Área útil</p>
          <p>{formatCm(utilWidth)} x {formatCm(utilHeight)} cm</p>
        </div>
        <div className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">Formato</p>
          <p>{props.formatLabel}</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        El costo de papel se calcula con el rendimiento del pliego comprado. La hoja de máquina es una referencia operativa independiente.
      </p>

      {Math.max(totalPieces, totalMachinePieces) > MAX_VISIBLE_PIECES ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Vista simplificada: se muestran hasta {MAX_VISIBLE_PIECES} piezas por panel cuando el total supera ese límite.
        </p>
      ) : null}
    </div>
  )
}