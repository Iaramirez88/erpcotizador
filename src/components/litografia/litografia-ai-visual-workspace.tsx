"use client"

import { LitografiaAiImagesModule } from "@/components/litografia/litografia-ai-images-module"
import { LitografiaAiVectorizerPanel } from "@/components/litografia/litografia-ai-vectorizer-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function LitografiaAiVisualWorkspace() {
  return (
    <Tabs defaultValue="imagenes" className="space-y-6">
      <TabsList className="h-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
        <TabsTrigger value="imagenes" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Generar imágenes</TabsTrigger>
        <TabsTrigger value="vectorizar" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Vectorizar</TabsTrigger>
      </TabsList>
      <TabsContent value="imagenes" className="space-y-6">
        <LitografiaAiImagesModule />
      </TabsContent>
      <TabsContent value="vectorizar" className="space-y-6">
        <LitografiaAiVectorizerPanel />
      </TabsContent>
    </Tabs>
  )
}