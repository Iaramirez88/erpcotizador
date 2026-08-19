import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpenText, Boxes, BrainCircuit, Building2, Compass, Factory, LineChart, Wallet, Wrench } from 'lucide-react'

import { PublicArchitectureMap } from '@/components/public/public-architecture-map'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { integrationCatalog, platformFlowDiagram, publicDocsLastUpdated, publicDomainDocs } from '@/lib/public-docs-content'

export const metadata: Metadata = {
  title: 'Centro de documentacion | Ordex',
  description: 'Centro de documentacion publica de Ordex con arquitectura funcional, modulos e integraciones.',
  robots: {
    index: true,
    follow: true,
  },
}

const domainIcons = {
  nucleo: Compass,
  captacion: Building2,
  ventas: Wallet,
  operaciones: Factory,
  recursos: Boxes,
  finanzas: LineChart,
  ia: BrainCircuit,
  verticales: Wrench,
} as const

const stageClasses = {
  OPERATIVO: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PARCIAL: 'border-amber-200 bg-amber-50 text-amber-700',
  'EN EXPANSION': 'border-sky-200 bg-sky-50 text-sky-700',
} as const

const documentationTracks = [
  {
    title: 'Arquitectura de plataforma',
    body: 'Como se organiza Ordex, que capas existen y que controles sostienen operacion, seguridad y crecimiento.',
  },
  {
    title: 'Dominios y modulos',
    body: 'Que resuelve cada dominio, para quien existe, que flujos gobierna y con que piezas se integra.',
  },
  {
    title: 'Integraciones y expansion',
    body: 'Canales, cobro, DIAN, OCR, PWA y otros puntos que conectan el producto con la operacion real.',
  },
] as const

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,#f7fbff_0%,#ffffff_52%,#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_28px_80px_-42px_rgba(15,23,42,0.35)]">
          <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_32%),linear-gradient(135deg,#0f172a,#12345a_55%,#0ea5e9_100%)] px-6 py-10 text-white sm:px-10 lg:px-12">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
              <BookOpenText className="h-6 w-6" />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">Centro de documentacion</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Documentacion publica para entender la plataforma modulo por modulo
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/82 sm:text-base">
              Esta es la capa base de documentacion profesional de Ordex. Ordena el producto por dominios, deja clara la responsabilidad de cada modulo y crea una superficie publica para explicar arquitectura, alcance e integraciones sin depender del dashboard interno.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/82">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">8 dominios visibles</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Rutas publicas: /docs, /plataforma y /producto</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Ultima actualizacion: {publicDocsLastUpdated}</span>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-8 sm:px-10 lg:grid-cols-3 lg:px-12">
            {documentationTracks.map((track) => (
              <div key={track.title} className="rounded-[24px] border border-slate-200 bg-slate-50/75 p-5">
                <h2 className="text-base font-semibold text-slate-950">{track.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{track.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Indice de dominios</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Navegacion rapida por capas</h2>
            </div>
            <Link href="/plataforma" className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition hover:text-sky-900">
              Ver arquitectura y confiabilidad
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {publicDomainDocs.map((domain) => (
              <Link
                key={domain.slug}
                href={`/docs/${domain.slug}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
              >
                {domain.name}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white/95 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Diagrama ejecutivo</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Flujo enterprise entre modulos</h2>
            </div>
            <Link href="/producto" className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition hover:text-sky-900">
              Ver landing comercial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {platformFlowDiagram.map((lane) => (
              <div key={lane.title} className="rounded-[24px] border border-slate-200 bg-slate-50/75 p-5">
                <h3 className="text-base font-semibold text-slate-950">{lane.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{lane.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {lane.nodes.map((node, index) => (
                    <div key={node} className="flex items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">{node}</span>
                      {index < lane.nodes.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-sky-600" /> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <PublicArchitectureMap highlightSlugs={['crm', 'ventas', 'operaciones', 'inventario']} />

        <section className="grid gap-4 xl:grid-cols-2">
          {publicDomainDocs.map((domain) => {
            const Icon = domainIcons[domain.id as keyof typeof domainIcons]
            return (
              <Card key={domain.slug} className="rounded-[30px] border-slate-200 bg-white/95 shadow-sm">
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-slate-950">
                      {Icon ? <Icon className="h-5 w-5" /> : <Compass className="h-5 w-5" />}
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${stageClasses[domain.stage]}`}>
                      {domain.stage}
                    </span>
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-slate-950">{domain.name}</CardTitle>
                    <CardDescription className="mt-2 text-sm leading-6 text-slate-600">{domain.summary}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-[22px] border border-sky-100 bg-sky-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Resumen ejecutivo</div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{domain.tagline}</p>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Para quien es</div>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{domain.audience}</p>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Incluye</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {domain.includes.map((item) => (
                        <span key={item} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Flujos clave</div>
                    <div className="mt-3 space-y-2">
                      {domain.flows.map((flow) => (
                        <div key={flow} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
                          {flow}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Rutas base</div>
                      <div className="mt-3 space-y-2">
                        {domain.routes.map((route) => (
                          <div key={route} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            {route}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Integraciones</div>
                      <div className="mt-3 space-y-2">
                        {domain.integrations.map((item) => (
                          <div key={item} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Link href={`/docs/${domain.slug}`} className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition hover:text-sky-900">
                    Abrir documentacion del dominio
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Catalogo de integraciones</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Puntos de extension de la plataforma</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              La plataforma no depende de un solo caso de uso. La documentacion debe dejar claro como se conecta con canales, cobro, documentos oficiales y operacion extendida.
            </p>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {integrationCatalog.map((group) => (
              <div key={group.title} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                <h3 className="text-base font-semibold text-slate-950">{group.title}</h3>
                <div className="mt-4 space-y-2">
                  {group.items.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#082032_0%,#12345a_60%,#155e75_100%)] px-6 py-8 text-white shadow-[0_28px_70px_-38px_rgba(15,23,42,0.5)] sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">Base creada</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Superficie lista para crecer a guias detalladas</h2>
              <p className="mt-3 text-sm leading-7 text-white/80 sm:text-base">
                Desde aqui ya se puede extender cada dominio con paginas dedicadas de APIs, permisos, onboarding, integraciones, playbooks operativos y diagramas de flujo sin volver a empezar la estructura publica.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/plataforma" className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100">
                Ver confiabilidad
              </Link>
              <Link href="/producto" className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15">
                Ver landing comercial
              </Link>
              <Link href="/auth/login" className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15">
                Entrar a Ordex
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}