'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Share2, Smartphone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const IOS_INSTALL_STEPS = [
  'Abre el menú Compartir de Safari.',
  'Toca Agregar a pantalla de inicio.',
  'Confirma con Agregar para instalar Ordex como app.',
]

function detectMobileOrTablet() {
  if (typeof window === 'undefined') return false

  const userAgent = window.navigator.userAgent.toLowerCase()
  const byAgent = /android|iphone|ipad|ipod|tablet|mobile/.test(userAgent)
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const compactViewport = window.matchMedia('(max-width: 1180px)').matches

  return byAgent || (coarsePointer && compactViewport)
}

function detectStandaloneMode() {
  if (typeof window === 'undefined') return false
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = typeof window.navigator !== 'undefined' && 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  return displayStandalone || iosStandalone
}

function detectIOS() {
  if (typeof window === 'undefined') return false
  const userAgent = window.navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(userAgent)
}

export function PwaInstallCta() {
  const [isEligibleDevice, setIsEligibleDevice] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [instructionsOpen, setInstructionsOpen] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateDeviceState = () => {
      setIsEligibleDevice(detectMobileOrTablet())
      setIsInstalled(detectStandaloneMode())
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPromptEvent(event as BeforeInstallPromptEvent)
      updateDeviceState()
    }

    const handleInstalled = () => {
      setIsInstalled(true)
      setInstallPromptEvent(null)
      setDismissed(true)
    }

    updateDeviceState()

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    window.addEventListener('resize', updateDeviceState)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
      window.removeEventListener('resize', updateDeviceState)
    }
  }, [])

  const isIos = useMemo(() => detectIOS(), [])
  const canShow = isEligibleDevice && !isInstalled && !dismissed
  const isNativeInstallSupported = Boolean(installPromptEvent)

  async function handleInstall() {
    if (isIos || !installPromptEvent) {
      setInstructionsOpen(true)
      return
    }

    setInstalling(true)
    try {
      await installPromptEvent.prompt()
      const choice = await installPromptEvent.userChoice
      if (choice.outcome === 'accepted') {
        setDismissed(true)
      }
      setInstallPromptEvent(null)
    } finally {
      setInstalling(false)
    }
  }

  if (!canShow) return null

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4 pb-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,_rgba(15,23,42,0.96)_0%,_rgba(11,92,171,0.96)_55%,_rgba(105,195,255,0.94)_100%)] p-4 text-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.55)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-2xl bg-white/12 p-2.5">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Instala Ordex en tu dispositivo</p>
                  <p className="mt-1 text-xs leading-5 text-sky-50/90">Acceso directo, apertura tipo app y mejor experiencia cuando trabajas desde móvil o tablet.</p>
                </div>
                <button
                  type="button"
                  className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
                  onClick={() => setDismissed(true)}
                  aria-label="Ocultar instalación"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button className="h-9 rounded-xl bg-white px-4 text-slate-950 hover:bg-slate-100" onClick={() => void handleInstall()} disabled={installing}>
                  {isIos ? <Share2 className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
                  {installing ? 'Abriendo...' : 'Instalar app'}
                </Button>
                {!isNativeInstallSupported || isIos ? (
                  <Button variant="outline" className="h-9 rounded-xl border-white/25 bg-white/8 text-white hover:bg-white/14 hover:text-white" onClick={() => setInstructionsOpen(true)}>
                    Ver pasos
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={instructionsOpen} onOpenChange={setInstructionsOpen}>
        <DialogContent className="max-w-md rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Instalar Ordex en {isIos ? 'iPhone o iPad' : 'tu dispositivo'}</DialogTitle>
            <DialogDescription>
              {isIos
                ? 'En iOS la instalación se hace desde el menú del navegador. Toma solo unos segundos.'
                : 'Si el navegador no mostró el aviso automático, puedes instalar la app desde el menú del navegador.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(isIos ? IOS_INSTALL_STEPS : [
              'Abre el menú del navegador.',
              'Busca la opción Instalar app o Agregar a pantalla de inicio.',
              'Confirma para guardar Ordex como aplicación.',
            ]).map((step, index) => (
              <div key={step} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{index + 1}</span>
                <p className="text-sm leading-6 text-slate-700">{step}</p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="w-full rounded-xl sm:w-auto" onClick={() => setInstructionsOpen(false)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}