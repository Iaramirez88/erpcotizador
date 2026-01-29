/**
 * Calculadora Litografía (MVP)
 */

"use client"

import { LitografiaCalculator } from "@/components/litografia/litografia-calculator"

export default function LitografiaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calculadora Litografía</h1>
        <p className="text-muted-foreground">MVP para estimar costos fijos + variables por tiraje.</p>
      </div>

      <LitografiaCalculator />
    </div>
  )
}
