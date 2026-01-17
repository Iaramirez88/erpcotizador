"use client"

import { cn } from "@/lib/utils"

export type PaperSizeKey =
  | "A0"
  | "A1"
  | "A2"
  | "A3"
  | "A4"
  | "A5"
  | "A6"
  | "PLIEGO_70X100"
  | "MEDIO_PLIEGO_50X70"
  | "CUARTO_PLIEGO_35X50"
  | "CARTA"
  | "MEDIA_CARTA"
  | "CUARTO_CARTA"

export type PaperOrientation = "PORTRAIT" | "LANDSCAPE"

export interface PaperSize {
  key: PaperSizeKey
  label: string
  widthCm: number
  heightCm: number
}

const PAPER_SIZES: PaperSize[] = [
  { key: "A0", label: "A0", widthCm: 84.1, heightCm: 118.9 },
  { key: "A1", label: "A1", widthCm: 59.4, heightCm: 84.1 },
  { key: "A2", label: "A2", widthCm: 42.0, heightCm: 59.4 },
  { key: "A3", label: "A3", widthCm: 29.7, heightCm: 42.0 },
  { key: "A4", label: "A4", widthCm: 21.0, heightCm: 29.7 },
  { key: "A5", label: "A5", widthCm: 14.8, heightCm: 21.0 },
  { key: "A6", label: "A6", widthCm: 10.5, heightCm: 14.8 },

  // Tamaños comunes en imprenta (pueden variar por proveedor)
  { key: "PLIEGO_70X100", label: "Pliego", widthCm: 70, heightCm: 100 },
  { key: "MEDIO_PLIEGO_50X70", label: "Medio pliego", widthCm: 50, heightCm: 70 },
  { key: "CUARTO_PLIEGO_35X50", label: "Cuarto pliego", widthCm: 35, heightCm: 50 },

  // Carta (Letter US) y derivados
  { key: "CARTA", label: "Carta", widthCm: 21.59, heightCm: 27.94 },
  { key: "MEDIA_CARTA", label: "Media carta", widthCm: 13.97, heightCm: 21.59 },
  { key: "CUARTO_CARTA", label: "Cuarto de carta", widthCm: 10.795, heightCm: 13.97 },
]

export function getPaperSize(key: PaperSizeKey): PaperSize | undefined {
  return PAPER_SIZES.find((s) => s.key === key)
}

function fmtCm(n: number): string {
  return Number.isInteger(n) ? `${n}` : n.toFixed(2)
}

export function PaperSizePreview(props: {
  selectedKey: PaperSizeKey
  orientation?: PaperOrientation
  className?: string
}) {
  const orientation = props.orientation ?? "PORTRAIT"

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3", props.className)}>
      {PAPER_SIZES.map((s) => {
        const isSelected = s.key === props.selectedKey

        const width = orientation === "PORTRAIT" ? s.widthCm : s.heightCm
        const height = orientation === "PORTRAIT" ? s.heightCm : s.widthCm

        const aspectRatio = `${Math.max(width, 0.01)}/${Math.max(height, 0.01)}`

        return (
          <div
            key={s.key}
            className={cn(
              "rounded-md border bg-background p-3",
              isSelected ? "ring-2 ring-primary" : "opacity-80"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm">{s.label}</div>
              <div className="text-xs text-muted-foreground">
                {fmtCm(width)} × {fmtCm(height)} cm
              </div>
            </div>

            <div className="mt-2 flex items-center justify-center rounded-md bg-muted/50 p-3">
              <div
                className={cn(
                  "border-2 bg-background",
                  isSelected ? "border-primary" : "border-muted-foreground/40"
                )}
                style={{
                  aspectRatio,
                  width: 120,
                  maxWidth: "100%",
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
