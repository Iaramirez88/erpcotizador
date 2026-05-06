'use client'

import Link from 'next/link'
import { RefreshCw, WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f6fbff_0%,_#eef6ef_48%,_#f8fafc_100%)] px-5 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[32px] border border-slate-200 bg-white/92 p-6 shadow-[0_28px_70px_-40px_rgba(15,23,42,0.4)] backdrop-blur md:p-10">
          <div className="inline-flex rounded-3xl bg-[linear-gradient(135deg,_#0f172a,_#0b5cab)] p-4 text-white shadow-lg">
            <WifiOff className="h-7 w-7" />
          </div>
          <div className="mt-6 max-w-2xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Modo sin conexión</p>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">No hay internet en este momento</h1>
            <p className="text-sm leading-7 text-slate-600 md:text-base">
              Ordex no pudo cargar esta vista porque tu dispositivo perdió la conexión. Cuando vuelva el internet podrás seguir trabajando normalmente.
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">Qué puedes hacer</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Revisa si tienes datos o Wi‑Fi disponibles y luego intenta recargar.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">Si instalaste la app</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Ordex seguirá abriéndose como aplicación y recuperará la sesión al reconectarse.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">Siguiente paso</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Si esta falla es frecuente, instala la app en tu móvil para acceso más rápido.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar ahora
            </button>
            <Link href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
              Volver al panel
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}