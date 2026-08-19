import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Database, Layers3, Network, ShieldCheck } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  platformPrinciples,
  publicDocsLastUpdated,
  publicDomainDocs,
  reliabilityPillars,
  stackLayers,
} from '@/lib/public-docs-content'

export const metadata: Metadata = {
  title: 'Plataforma y confiabilidad | Ordex',
  description: 'Centro de confianza de Ordex con seguridad, confiabilidad, integraciones y arquitectura modular.',
  robots: {
    index: true,
    follow: true,
  },
}

const trustHighlights = [
  {
    title: 'Arquitectura modular',
    body: 'Comercial, operaciones, recursos, finanzas e IA se organizan como capas con dependencias explicitas.',
    icon: Layers3,
  },
  {
    title: 'Respaldos automaticos',
    body: 'La plataforma cuenta con politicas de respaldo y recuperacion para sostener continuidad del negocio.',
    icon: Database,
  },
  {
    title: 'Seguridad y permisos',
    body: 'Acceso seguro, permisos por roles y separacion operativa por empresa y sede.',
    icon: ShieldCheck,
  },
  {
    title: 'Infraestructura escalable',
    body: 'La operacion esta preparada para crecer con mas carga, mas usuarios y mas procesos.',
    icon: Network,
  },
] as const

export default function PlataformaPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#ffffff_54%,#f6f7fb_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_28px_80px_-42px_rgba(15,23,42,0.35)]">
          <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_32%),linear-gradient(135deg,#082032,#0f4c81_58%,#0ea5e9_100%)] px-6 py-10 text-white sm:px-10 lg:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">Trust Center</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Seguridad, confiabilidad e integraciones empresariales de Ordex
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/82 sm:text-base">
              Esta pagina resume la capa publica de confianza de la plataforma: seguridad, continuidad operativa,
              escalabilidad, integraciones empresariales y arquitectura modular para empresas en crecimiento.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/82">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Multiempresa y multisede</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Respaldos automaticos</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Permisos por roles</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Alta disponibilidad</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Ultima actualizacion: {publicDocsLastUpdated}</span>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-8 sm:px-10 lg:grid-cols-4 lg:px-12">
            {trustHighlights.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-slate-950">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-slate-950">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-[28px] border-slate-200 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">Arquitectura modular</CardTitle>
              <CardDescription>
                Ordex se organiza por responsabilidades de negocio para evitar herramientas aisladas y procesos desconectados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {platformPrinciples.map((principle) => (
                <div key={principle} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
                  {principle}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">Cobertura funcional visible</CardTitle>
              <CardDescription>
                La capa publica muestra los dominios de negocio que sostienen la operacion sin exponer el detalle tecnico interno.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {publicDomainDocs.map((domain) => (
                <div key={domain.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-950">{domain.name}</h3>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                      {domain.stage}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{domain.summary}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Confiabilidad operativa</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Seguridad, continuidad e infraestructura</h2>
            </div>
            <Link href="/auth/login?callbackUrl=%2Fdocs" className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition hover:text-sky-900">
              Acceder a documentacion privada
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {reliabilityPillars.map((pillar) => (
              <Card key={pillar.title} className="rounded-[28px] border-slate-200 bg-white/95 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-950">{pillar.title}</CardTitle>
                  <CardDescription className="text-sm leading-6 text-slate-600">{pillar.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pillar.bullets.map((bullet) => (
                    <div key={bullet} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
                      {bullet}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Arquitectura y alcance</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Capas de confianza de la plataforma</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              La plataforma combina experiencia moderna, continuidad operativa, integraciones empresariales y una arquitectura modular preparada para crecer con la empresa.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {stackLayers.map((layer) => (
              <div key={layer.title} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="text-sm font-semibold text-slate-950">{layer.title}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {layer.items.map((item) => (
                    <span key={item} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#122b49_62%,#134e84_100%)] px-6 py-8 text-white shadow-[0_28px_70px_-38px_rgba(15,23,42,0.5)] sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">Ficha tecnica bajo solicitud</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">La informacion detallada se comparte bajo solicitud comercial</h2>
              <p className="mt-3 text-sm leading-7 text-white/80 sm:text-base">
                La capa publica prioriza confianza, alcance e integraciones. Los cuestionarios de seguridad y la ficha tecnica ampliada se entregan en procesos comerciales o de habilitacion con clientes y partners.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/auth/register" className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100">
                Solicitar ficha tecnica
              </Link>
              <Link href="/producto" className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15">
                Ver landing comercial
              </Link>
              <Link href="/auth/login" className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15">
                Entrar a la plataforma
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}