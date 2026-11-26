"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// AVISO TEMPORAL (quitar cuando ya no sea necesario).
// Los usuarios antiguos entraban al dominio y eran redirigidos al login;
// ahora el home es público y este modal les indica dónde iniciar sesión.
const STORAGE_KEY = "joinclap_login_notice_dismissed_v1"

export default function JoinclapLoginNotice() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY)) return
    const id = window.setTimeout(() => setOpen(true), 350)
    return () => window.clearTimeout(id)
  }, [])

  function dismiss() {
    setOpen(false)
    window.localStorage.setItem(STORAGE_KEY, "1")
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent className="max-w-md text-center sm:text-center">
        <DialogHeader className="sm:text-center">
          <DialogTitle className="text-lg">¿Ya tienes una cuenta?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Nuestro dominio cambió y el acceso a tu panel ahora está en otra dirección.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Para ingresar, usa la dirección
          <div className="mt-1 font-medium text-slate-900">joinclap.com.co/auth/login</div>
        </div>

        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <Link
            href="/auth/login"
            onClick={() => dismiss()}
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-6 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Iniciar sesión
          </Link>
          <button
            type="button"
            onClick={() => dismiss()}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Continuar al sitio
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
