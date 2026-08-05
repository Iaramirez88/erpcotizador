"use client"

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  savingWebFormBuilder: boolean
  onRevert: () => void
  onClose: () => void
  onSave: () => void
  children: ReactNode
  previewContent: ReactNode
}

export function CrmIntegrationsWebFormBuilderModal(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="h-[92vh] max-h-[92vh] max-w-7xl overflow-hidden rounded-[30px] border-sky-200 bg-white/98 p-0 shadow-[0_28px_80px_-42px_rgba(14,165,233,0.35)]">
        <div className="grid h-full min-h-0 gap-0 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="min-h-0 overflow-y-auto border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.18),transparent_30%),linear-gradient(180deg,#f8fbff,#ffffff)] p-6 xl:border-b-0 xl:border-r">
            <DialogHeader>
              <DialogTitle>Editor visual del formulario web</DialogTitle>
              <DialogDescription>El usuario edita en un modal dedicado y cada ajuste se refleja al instante en el preview del iframe.</DialogDescription>
            </DialogHeader>

            <div className="mt-5 pr-1">
              {props.children}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#ffffff,#f8fbff)] p-6">
            <div className="rounded-[26px] border border-sky-200 bg-sky-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Preview en vivo</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Lo que ves aquí es la versión real que quedará disponible en la URL pública y en el iframe del canal.</p>
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
              {props.previewContent}
            </div>
            <DialogFooter className="mt-5 border-t border-slate-100 pt-5">
              <Button variant="outline" className="rounded-xl" onClick={props.onRevert} disabled={props.savingWebFormBuilder}>
                Revertir
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={props.onClose} disabled={props.savingWebFormBuilder}>
                Cerrar
              </Button>
              <Button className="rounded-xl bg-slate-950 text-white hover:bg-slate-800" onClick={props.onSave} disabled={props.savingWebFormBuilder}>
                {props.savingWebFormBuilder ? 'Guardando...' : 'Guardar constructor'}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}