'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type OnboardingStatusResponse = {
  ok?: boolean
  required?: boolean
  welcomeSeen?: boolean
}

export default function OnboardingGate() {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch('/api/onboarding/empresa', { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as OnboardingStatusResponse
        if (cancelled || !res.ok || !json.ok) return
        if (pathname.startsWith('/dashboard/onboarding')) return
        setOpen(Boolean(json.required) && !json.welcomeSeen)
      } catch {
        // no-op
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [pathname])

  async function handleDismiss() {
    try {
      await fetch('/api/onboarding/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seen: true }),
      })
    } catch {
      // no-op
    }
    setOpen(false)
  }

  if (loading || pathname.startsWith('/dashboard/onboarding') || !open) return null

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) void handleDismiss() }}>
      <DialogContent className="max-w-xl rounded-[30px] border-slate-200 p-0">
        <div className="border-b border-slate-100 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-2xl text-slate-950">Gracias por registrarte</DialogTitle>
            <DialogDescription className="text-sm leading-6 text-slate-600">
              Tu espacio ya fue creado correctamente.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Bienvenida</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-950">Tienes 15 días gratis</div>
            <div className="mt-2 text-sm text-emerald-900">
              Durante este periodo podrás explorar la plataforma y empezar a trabajar con tu espacio sin pasos adicionales de configuración inicial.
            </div>
          </div>

          <p className="text-sm text-slate-600">
            Cuando quieras, puedes continuar directamente al dashboard y comenzar a usar el sistema.
          </p>
        </div>

        <DialogFooter className="border-t border-slate-100 px-6 py-4">
          <Button type="button" onClick={() => void handleDismiss()}>Continuar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}