/**
 * Calculadora Litografía (MVP)
 */

"use client"

import { LitografiaCalculator } from "@/components/litografia/litografia-calculator"

export default function LitografiaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Litografía</h1>
        <p className="text-muted-foreground">Configuración del tarifario y opciones de litografía.</p>
      </div>

      <LitografiaCalculator />
    </div>
  )
}
