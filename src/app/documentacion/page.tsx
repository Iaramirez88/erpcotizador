import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, BookOpenText, LifeBuoy } from 'lucide-react'

import { HelpCenter } from '@/components/help-center/help-center'
import { helpArticles, helpCategories, helpDocsLastUpdated } from '@/lib/help-center-content'

export const metadata: Metadata = {
  title: 'Documentación y ayuda | Joinclap',
  description:
    'Centro de ayuda y documentación de Joinclap: tutoriales, módulos, integraciones, APIs y administración de cuenta.',
  robots: {
    index: true,
    follow: true,
  },
}

export default function DocumentacionPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_30%),linear-gradient(180deg,#f8fbf9_0%,#ffffff_52%,#f8fafc_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a Joinclap
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 transition hover:text-emerald-900"
          >
            Entrar a la plataforma
          </Link>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_28px_80px_-42px_rgba(15,23,42,0.35)]">
          <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,#0f172a,#14402f_55%,#059669_100%)] px-6 py-10 text-white sm:px-10 lg:px-12">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
              <BookOpenText className="h-6 w-6" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100">
              Centro de ayuda y documentación
            </p>
            <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Todo lo que necesitas para operar con Joinclap
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/82 sm:text-base">
              Desde lo más básico, como cambiar tu contraseña, hasta lo más avanzado, como incorporar
              APIs, conectar canales o entender cómo funciona cada módulo.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/82">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                Directorio público
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                {helpArticles.length} guías disponibles
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                Última actualización: {helpDocsLastUpdated}
              </span>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <HelpCenter categories={helpCategories} articles={helpArticles} />
        </div>

        <section className="mt-10 overflow-hidden rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#14402f_58%,#047857_100%)] px-6 py-8 text-white shadow-[0_28px_70px_-38px_rgba(15,23,42,0.5)] sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                ¿No encuentras lo que buscas?
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/80 sm:text-base">
                Contáctanos para una demo o entra a la plataforma y abre un ticket en la mesa de ayuda.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/#contacto"
                className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
              >
                Hablar con soporte
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
              >
                Abrir un ticket
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
