"use client"

import { useEffect, useState } from 'react'
import { Download, ExternalLink, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

function appendDownloadParam(url: string) {
  return url.includes('?') ? `${url}&download=1` : `${url}?download=1`
}

export function useIsMobileViewport(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const update = () => setIsMobile(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [breakpoint])

  return isMobile
}

type MobilePdfFallbackProps = {
  title: string
  description: string
  pdfUrl: string
  downloadName?: string
}

export function MobilePdfFallback(props: MobilePdfFallbackProps) {
  const [sharing, setSharing] = useState(false)

  function openPdf() {
    window.location.assign(props.pdfUrl)
  }

  function downloadPdf() {
    const anchor = document.createElement('a')
    anchor.href = appendDownloadParam(props.pdfUrl)
    if (props.downloadName) anchor.download = props.downloadName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  async function sharePdf() {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return

    setSharing(true)
    try {
      await navigator.share({
        title: props.title,
        text: props.description,
        url: props.pdfUrl,
      })
    } catch {
      // ignore
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="flex min-h-[320px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
      <div className="max-w-md space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Vista previa móvil</h3>
        <p className="text-sm leading-6 text-slate-600">{props.description}</p>
      </div>
      <div className="mt-6 flex w-full max-w-md flex-col gap-3">
        <Button type="button" className="w-full" onClick={openPdf}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Abrir PDF
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={downloadPdf}>
          <Download className="mr-2 h-4 w-4" />
          Descargar PDF
        </Button>
        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? (
          <Button type="button" variant="outline" className="w-full" onClick={() => void sharePdf()} disabled={sharing}>
            <Share2 className="mr-2 h-4 w-4" />
            {sharing ? 'Abriendo opciones...' : 'Compartir PDF'}
          </Button>
        ) : null}
      </div>
      <p className="mt-4 max-w-md text-xs leading-5 text-slate-500">
        En muchos móviles el visor embebido no funciona de forma confiable. Este modo abre el documento con el navegador o la app disponible en el dispositivo.
      </p>
    </div>
  )
}