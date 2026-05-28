/**
 * Calculadora Litografía (MVP)
 */

"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ExternalLink } from "lucide-react"
import { LitografiaAiAssistant } from "@/components/litografia/litografia-ai-assistant"
import { LitografiaCalculator } from "@/components/litografia/litografia-calculator"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { LitografiaAiHandoff } from "@/lib/litografia-ai-handoff"

export default function LitografiaPage() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<"clasico" | "ia">("clasico")
  const [aiHandoffDraft, setAiHandoffDraft] = useState<LitografiaAiHandoff | null>(null)

  useEffect(() => {
    const requestedTab = searchParams?.get("tab")
    if (requestedTab === "ia" || requestedTab === "clasico") {
      setActiveTab(requestedTab)
    }
  }, [searchParams])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cotizador litográfico</h1>
          <p className="text-muted-foreground">Alterna entre la configuración clásica y un ingreso asistido para interpretar briefs comerciales más rápido.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/litografia/conocimiento-ia">
              <ExternalLink className="mr-2 h-4 w-4" />
              Conocimiento IA
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/litografia/imagenes-ia">
              <ExternalLink className="mr-2 h-4 w-4" />
              Módulo imágenes IA
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "clasico" | "ia")} className="space-y-4">
        <TabsList className="grid h-auto grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <TabsTrigger value="clasico" className="rounded-xl px-4 py-2 data-[state=active]:bg-white">
            Cotizador clásico
          </TabsTrigger>
          <TabsTrigger value="ia" className="rounded-xl px-4 py-2 data-[state=active]:bg-white">
            Cotice con IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clasico" className="space-y-4">
          <LitografiaCalculator aiHandoffDraft={aiHandoffDraft} />
        </TabsContent>

        <TabsContent value="ia" className="space-y-4">
          <LitografiaAiAssistant
            onApplyToClassic={(draft) => {
              setAiHandoffDraft(draft)
              setActiveTab("clasico")
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
