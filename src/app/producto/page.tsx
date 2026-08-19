import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Boxes, BrainCircuit, Building2, Factory, LineChart, ShieldCheck, Sparkles } from 'lucide-react'

import { PublicArchitectureMap } from '@/components/public/public-architecture-map'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { platformFlowDiagram, publicDomainDocs, trustMetrics } from '@/lib/public-docs-content'

export const metadata: Metadata = {
  title: 'Ordex | Plataforma empresarial para operar, vender y escalar',
  description: 'Landing publica comercial de Ordex con confianza empresarial, arquitectura modular e integraciones visibles.',
  robots: {
    index: true,
    follow: true,
  },
}

const icons = [Building2, Boxes, Factory, LineChart, BrainCircuit, ShieldCheck] as const

const sellingBlocks = [
  {
    title: 'Una sola operacion, no herramientas aisladas',
    body: 'Ordex conecta CRM, ventas, operaciones, inventario y finanzas dentro de una misma plataforma empresarial.',
  },
  {
    title: 'Confianza visible para clientes y equipos internos',
    body: 'La capa publica expone seguridad, confiabilidad, arquitectura modular e integraciones sin revelar implementacion interna.',
  },
  {
    title: 'Capas activables por empresa y por industria',
    body: 'La plataforma no esta amarrada a un solo sector. Puede crecer por verticales y por capacidades segun el momento del negocio.',
  },
] as const

export default function ProductoPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.16),transparent_26%),linear-gradient(180deg,#f8fbff_0%,#ffffff_50%,#f7fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_28px_90px_-42px_rgba(15,23,42,0.35)]">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_28%),linear-gradient(135deg,#071725,#0f3558_58%,#0ea5e9_100%)] px-6 py-10 text-white sm:px-10 lg:px-12 lg:py-14">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">Plataforma empresarial</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Vender, operar y controlar el negocio desde una sola plataforma
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/82 sm:text-base">
                Ordex unifica CRM, ventas, operaciones, inventario, finanzas, documentos e inteligencia aplicada sobre una arquitectura modular pensada para empresas que necesitan crecer con control.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/plataforma" className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100">
                  Explorar trust center
                </Link>
                <Link href="/plataforma" className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15">
                  Ver confiabilidad
                </Link>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {trustMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-[24px] border border-white/15 bg-white/10 p-4">
                    <div className="text-2xl font-semibold text-white">{metric.value}</div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100">{metric.label}</div>
                    <div className="mt-2 text-sm leading-6 text-white/75">{metric.hint}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50/80 px-6 py-10 sm:px-10 lg:px-12 lg:py-14">
              <div className="grid gap-4">
                {sellingBlocks.map((block, index) => {
                  const Icon = icons[index] ?? Sparkles
                  return (
                    <div key={block.title} className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-slate-950">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="mt-4 text-lg font-semibold text-slate-950">{block.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{block.body}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">Arquitectura modular visible</CardTitle>
              <CardDescription>La operacion se entiende como una cadena conectada entre dominios, no como pantallas aisladas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {platformFlowDiagram.map((lane) => (
                <div key={lane.title} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-sm font-semibold text-slate-950">{lane.title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{lane.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {lane.nodes.map((node, index) => (
                      <div key={node} className="flex items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">{node}</span>
                        {index < lane.nodes.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-sky-600" /> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">Dominios de negocio visibles</CardTitle>
              <CardDescription>La capa publica deja ver el alcance funcional del producto sin abrir el acceso a la documentacion privada.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {publicDomainDocs.map((domain) => (
                <div key={domain.slug} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">{domain.name}</div>
                    <ArrowRight className="h-4 w-4 text-sky-600" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{domain.tagline}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <PublicArchitectureMap highlightSlugs={['crm', 'ventas', 'operaciones', 'inventario']} interactive={false} />

        <section className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Centro de confianza</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Trust center, plataforma y narrativa comercial conectadas</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                Esta landing conecta el discurso comercial con una capa publica de confianza. La ficha tecnica ampliada y los cuestionarios de seguridad se entregan bajo solicitud comercial.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/auth/register" className="inline-flex items-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
                Solicitar ficha tecnica
              </Link>
              <Link href="/plataforma" className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                Ver trust center
              </Link>
              <Link href="/auth/login" className="inline-flex items-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                Entrar a Ordex
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}