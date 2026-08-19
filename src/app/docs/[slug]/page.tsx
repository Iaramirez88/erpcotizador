import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Boxes, BrainCircuit, Building2, Compass, Factory, LineChart, Network, ShieldCheck, Sparkles, Wallet, Wrench } from 'lucide-react'
import { notFound } from 'next/navigation'

import { PublicArchitectureMap } from '@/components/public/public-architecture-map'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getPublicDeepDomainDocBySlug, getPublicDomainDocBySlug, publicDomainDocs } from '@/lib/public-docs-content'

type DocsDomainPageProps = {
  params: Promise<{ slug: string }>
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

const sectionIcons = [Sparkles, Network, ShieldCheck] as const

export async function generateStaticParams() {
  return publicDomainDocs.map((domain) => ({ slug: domain.slug }))
}

export async function generateMetadata({ params }: DocsDomainPageProps): Promise<Metadata> {
  const { slug } = await params
  const domain = getPublicDomainDocBySlug(slug)

  if (!domain) {
    return {
      title: 'Documentacion | Ordex',
    }
  }

  return {
    title: `${domain.name} | Documentacion Ordex`,
    description: domain.summary,
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function DocsDomainPage({ params }: DocsDomainPageProps) {
  const { slug } = await params
  const domain = getPublicDomainDocBySlug(slug)

  if (!domain) notFound()

  const deepDoc = getPublicDeepDomainDocBySlug(slug)
  const Icon = domainIcons[domain.id as keyof typeof domainIcons] ?? Compass
  const relatedDocs = publicDomainDocs.filter((item) => item.slug !== domain.slug).slice(0, 3)

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_24%),linear-gradient(180deg,#f8fbff_0%,#ffffff_54%,#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-white shadow-[0_28px_80px_-42px_rgba(15,23,42,0.35)]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.2),transparent_28%),linear-gradient(135deg,#081626,#12385c_55%,#0ea5e9_100%)] px-6 py-10 text-white sm:px-10 lg:px-12">
            <Link href="/docs" className="inline-flex items-center gap-2 text-sm font-medium text-sky-100 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Volver al centro de documentacion
            </Link>
            <div className="mt-6 inline-flex h-14 w-14 items-center justify-center rounded-3xl border border-white/15 bg-white/10">
              <Icon className="h-7 w-7" />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${stageClasses[domain.stage]}`}>
                {domain.stage}
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-100">
                /docs/{domain.slug}
              </span>
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{domain.name}</h1>
            <p className="mt-3 text-base font-medium text-sky-100">{domain.tagline}</p>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/82 sm:text-base">{domain.summary}</p>
          </div>

          <div className="grid gap-4 px-6 py-8 sm:px-10 lg:grid-cols-3 lg:px-12">
            {[domain.businessValue, domain.audience, domain.outcomes.join(' · ')].map((text, index) => {
              const SectionIcon = sectionIcons[index] ?? Sparkles
              return (
                <div key={text} className="rounded-[24px] border border-slate-200 bg-slate-50/75 p-5">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-slate-950">
                    <SectionIcon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-700">{text}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">Mapa funcional del dominio</CardTitle>
              <CardDescription>Lectura rapida de lo que vive dentro de esta capa y como se organiza operativamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Modulos y capacidades</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {domain.includes.map((item) => (
                    <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Rutas base</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {domain.routes.map((route) => (
                    <div key={route} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      {route}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resultados que habilita</div>
                <div className="mt-3 space-y-2">
                  {domain.outcomes.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-slate-950">Diagrama de flujo operativo</CardTitle>
              <CardDescription>Representacion visual del recorrido principal dentro del dominio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {domain.flows.map((flow, index) => (
                <div key={flow} className="rounded-[24px] border border-slate-200 bg-slate-50/75 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Paso {index + 1}</div>
                  <div className="mt-2 text-sm font-medium text-slate-950">{flow}</div>
                  {index < domain.flows.length - 1 ? <ArrowRight className="mt-3 h-4 w-4 text-sky-600" /> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <PublicArchitectureMap highlightSlugs={[domain.slug]} compact />

        {deepDoc ? (
          <>
            <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="rounded-[28px] border-slate-200 bg-white/95 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl text-slate-950">Documentacion profunda del dominio</CardTitle>
                  <CardDescription>{deepDoc.overview}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Entidades principales</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {deepDoc.entities.map((entity) => (
                        <span key={entity} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">KPI o focos de seguimiento</div>
                    <div className="mt-3 space-y-2">
                      {deepDoc.kpis.map((item) => (
                        <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-slate-200 bg-white/95 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl text-slate-950">Permisos y gobierno de acceso</CardTitle>
                  <CardDescription>Lectura aterrizada a lo que hoy validan los endpoints del repositorio.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {deepDoc.permissions.map((permission) => (
                    <div key={permission.title} className="rounded-[22px] border border-slate-200 bg-slate-50/75 p-4">
                      <div className="text-sm font-semibold text-slate-950">{permission.title}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">{permission.requirement}</div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Scope: {permission.scope}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{permission.notes}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white/95 p-5 shadow-sm sm:p-6">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">API surface</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Endpoints y responsabilidades</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">Cada grupo resume que resuelve, que permiso exige y cuales rutas concretas sostienen ese comportamiento.</p>
              </div>
              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                {deepDoc.endpointGroups.map((group) => (
                  <div key={group.title} className="rounded-[24px] border border-slate-200 bg-slate-50/75 p-5">
                    <h3 className="text-lg font-semibold text-slate-950">{group.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{group.purpose}</p>
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      {group.access}
                    </div>
                    <div className="mt-4 space-y-2">
                      {group.endpoints.map((endpoint) => (
                        <div key={endpoint} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                          {endpoint}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <Card className="rounded-[28px] border-slate-200 bg-white/95 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl text-slate-950">Integraciones vivas</CardTitle>
                  <CardDescription>Conexiones externas o capas transversales que ya participan en este dominio.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {deepDoc.integrations.map((integration) => (
                    <div key={integration.name} className="rounded-[22px] border border-slate-200 bg-slate-50/75 p-4">
                      <div className="text-sm font-semibold text-slate-950">{integration.name}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{integration.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {integration.touchpoints.map((item) => (
                          <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-slate-200 bg-white/95 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-2xl text-slate-950">Playbooks operativos</CardTitle>
                  <CardDescription>Secuencias recomendadas para usar el dominio como parte de un proceso y no como pantalla aislada.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {deepDoc.playbooks.map((playbook) => (
                    <div key={playbook.title} className="rounded-[24px] border border-slate-200 bg-slate-50/75 p-4">
                      <div className="text-sm font-semibold text-slate-950">{playbook.title}</div>
                      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Disparador</div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{playbook.trigger}</p>
                      <div className="mt-3 space-y-2">
                        {playbook.steps.map((step, index) => (
                          <div key={step} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                            {index + 1}. {step}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm text-slate-700">
                        Resultado: {playbook.outcome}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="rounded-[28px] border-slate-200 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl text-slate-950">Dependencias y cruces</CardTitle>
              <CardDescription>Este dominio no vive aislado. Asi se conecta con el resto de la plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {domain.dependencies.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-6 text-slate-700">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200 bg-white/95 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl text-slate-950">Integraciones y extensiones</CardTitle>
              <CardDescription>Puntos de acople con servicios externos, automatizacion o capas transversales.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {domain.integrations.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#14395f_58%,#0e7490_100%)] px-6 py-8 text-white shadow-[0_28px_70px_-38px_rgba(15,23,42,0.5)] sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">Siguiente lectura</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Explora dominios relacionados</h2>
              <p className="mt-3 text-sm leading-7 text-white/80 sm:text-base">
                La documentacion esta organizada para que cada dominio pueda entenderse por separado sin perder su relacion con la arquitectura completa del producto.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/plataforma" className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100">
                Ver plataforma
              </Link>
              <Link href="/producto" className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15">
                Ver landing comercial
              </Link>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {relatedDocs.map((item) => (
              <Link key={item.slug} href={`/docs/${item.slug}`} className="rounded-[24px] border border-white/15 bg-white/10 p-4 transition hover:bg-white/15">
                <div className="text-sm font-semibold text-white">{item.name}</div>
                <div className="mt-2 text-sm leading-6 text-white/75">{item.tagline}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}