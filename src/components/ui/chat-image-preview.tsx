"use client"

import { type ReactNode, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type ChatImagePreviewProps = {
  src: string
  alt: string
  title?: string | null
  children: ReactNode
}

export function ChatImagePreview(props: ChatImagePreviewProps) {
  const [open, setOpen] = useState(false)
  const title = props.title?.trim() || props.alt.trim() || 'Imagen adjunta'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full cursor-zoom-in text-left">
        {props.children}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose overlayClassName="z-[180] bg-black/85" className="z-[181] max-w-5xl overflow-hidden border-slate-200 bg-white p-0">
          <DialogHeader className="border-b border-slate-200 px-4 py-3 text-left">
            <DialogTitle className="truncate text-sm text-slate-900">{title}</DialogTitle>
          </DialogHeader>

          <div className="flex max-h-[78vh] items-center justify-center bg-slate-950 px-4 py-4">
            <img src={props.src} alt={props.alt} className="max-h-[70vh] max-w-full rounded-2xl object-contain" />
          </div>

          <DialogFooter className="border-t border-slate-200 px-4 py-3 sm:justify-between">
            <div className="text-xs text-slate-500">Haz clic derecho o usa descargar para guardar la imagen.</div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
              <Button asChild className="rounded-xl bg-slate-950 text-white hover:bg-slate-800">
                <a href={props.src} download={title}>
                  <Download className="mr-2 h-4 w-4" />
                  Guardar / Descargar
                </a>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}