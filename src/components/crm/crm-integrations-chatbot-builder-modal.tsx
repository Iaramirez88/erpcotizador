"use client"

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type ChatbotBuilderSection = 'flow' | 'brand' | 'launcher' | 'copy'
type ChatbotPreviewMode = 'floating' | 'compact' | 'expanded'
type ChatbotPreviewViewport = 'desktop' | 'mobile'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatbotBuilderSection: ChatbotBuilderSection
  setChatbotBuilderSection: (section: ChatbotBuilderSection) => void
  chatbotBuilderPreviewMode: ChatbotPreviewMode
  setChatbotBuilderPreviewMode: (mode: ChatbotPreviewMode) => void
  chatbotBuilderPreviewViewport: ChatbotPreviewViewport
  setChatbotBuilderPreviewViewport: (viewport: ChatbotPreviewViewport) => void
  savingChatbotBuilder: boolean
  onRevert: () => void
  onClose: () => void
  onSave: () => void
  children: ReactNode
  previewContent: ReactNode
}

export function CrmIntegrationsChatbotBuilderModal(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="h-[92vh] max-h-[92vh] max-w-7xl overflow-hidden rounded-[30px] border-emerald-200 bg-white/98 p-0 shadow-[0_28px_80px_-42px_rgba(16,185,129,0.28)]">
        <div className="grid h-full min-h-0 gap-0 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="min-h-0 overflow-y-auto border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.16),transparent_30%),linear-gradient(180deg,#f6fffb,#ffffff)] p-6 xl:border-b-0 xl:border-r">
            <DialogHeader>
              <DialogTitle>Editor visual del chatbot</DialogTitle>
              <DialogDescription>Configura el iframe y el launcher desde un modal dedicado. Cada cambio se refleja en el preview en tiempo real.</DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-4 pr-1">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'flow', label: 'Flujo' },
                  { value: 'brand', label: 'Marca' },
                  { value: 'launcher', label: 'Launcher' },
                  { value: 'copy', label: 'Copy' },
                ].map((section) => (
                  <button
                    key={section.value}
                    type="button"
                    onClick={() => props.setChatbotBuilderSection(section.value as ChatbotBuilderSection)}
                    className={props.chatbotBuilderSection === section.value ? 'rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600'}
                  >
                    {section.label}
                  </button>
                ))}
              </div>

              {props.children}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff,#f6fffb)] p-6">
            <div className="rounded-[26px] border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Preview en vivo</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Puedes revisar el estado inicial configurado, forzar solo launcher o abrir el panel, tanto en desktop como en mobile.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[{ value: 'floating', label: 'Estado inicial' }, { value: 'compact', label: 'Solo launcher' }, { value: 'expanded', label: 'Panel abierto' }].map((mode) => (
                    <button key={mode.value} type="button" onClick={() => props.setChatbotBuilderPreviewMode(mode.value as ChatbotPreviewMode)} className={props.chatbotBuilderPreviewMode === mode.value ? 'rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600'}>{mode.label}</button>
                  ))}
                  {[{ value: 'desktop', label: 'Desktop' }, { value: 'mobile', label: 'Mobile' }].map((viewport) => (
                    <button key={viewport.value} type="button" onClick={() => props.setChatbotBuilderPreviewViewport(viewport.value as ChatbotPreviewViewport)} className={props.chatbotBuilderPreviewViewport === viewport.value ? 'rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-800' : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600'}>{viewport.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              {props.previewContent}
            </div>
            <DialogFooter className="mt-5 border-t border-slate-100 pt-5">
              <Button variant="outline" className="rounded-xl" onClick={props.onRevert} disabled={props.savingChatbotBuilder}>
                Revertir
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={props.onClose} disabled={props.savingChatbotBuilder}>
                Cerrar
              </Button>
              <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={props.onSave} disabled={props.savingChatbotBuilder}>
                {props.savingChatbotBuilder ? 'Guardando...' : 'Guardar constructor'}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}