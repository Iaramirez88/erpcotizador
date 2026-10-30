'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, ImageIcon, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CardInfoHeader } from '@/components/ui/card-info-header'

export type DashboardNewsItem = {
  id: string
  title: string
  excerpt: string
  imageUrl: string
  imageAlt: string
  category: string
  publishedAt: string
  href?: string
}

/**
 * Contenido de muestra temporal.
 * Cuando exista la fuente real de novedades se reemplaza esta constante por datos del backend.
 */
const SAMPLE_NEWS: DashboardNewsItem[] = [
  {
    id: 'crm-conversaciones',
    title: 'CRM con conversaciones unificadas por canal',
    excerpt: 'WhatsApp, Instagram y Messenger en una sola bandeja con contexto del cliente y seguimiento del asesor.',
    imageUrl: '/novedades/crm-conversaciones.svg',
    imageAlt: 'Bandeja de conversaciones del CRM',
    category: 'CRM',
    publishedAt: '24 oct 2026',
    href: '/dashboard/crm',
  },
  {
    id: 'cotizador-asistente',
    title: 'El cotizador sugiere precios y acabados',
    excerpt: 'Calcula la propuesta con margen, materiales y acabados recomendados antes de enviarla al cliente.',
    imageUrl: '/novedades/cotizador-asistente.svg',
    imageAlt: 'Asistente del cotizador calculando una propuesta',
    category: 'Cotizador',
    publishedAt: '21 oct 2026',
    href: '/dashboard/cotizador',
  },
  {
    id: 'restaurante-mesas',
    title: 'Panel de restaurante con mesas y comandas en vivo',
    excerpt: 'Controla ocupación, pedidos en cocina y cierre de caja desde un solo tablero de operación diaria.',
    imageUrl: '/novedades/restaurante-mesas.svg',
    imageAlt: 'Panel de mesas del restaurante',
    category: 'Restaurante',
    publishedAt: '15 oct 2026',
    href: '/dashboard/restaurante',
  },
  {
    id: 'nomina-desprendibles',
    title: 'Desprendibles de nómina listos para el colaborador',
    excerpt: 'Genera y comparte el desprendible del periodo con el detalle de devengos, deducciones y aportes.',
    imageUrl: '/novedades/nomina-desprendibles.svg',
    imageAlt: 'Desprendible de nómina digital',
    category: 'Nómina',
    publishedAt: '08 oct 2026',
    href: '/dashboard/nomina',
  },
  {
    id: 'inventario-alertas',
    title: 'Alertas de stock mínimo por bodega',
    excerpt: 'Recibe avisos antes de quedarte sin material y repón con la orden de compra sugerida.',
    imageUrl: '/novedades/inventario-alertas.svg',
    imageAlt: 'Alertas de inventario y stock mínimo',
    category: 'Inventario',
    publishedAt: '02 oct 2026',
    href: '/dashboard/inventario',
  },
  {
    id: 'sitios-web',
    title: 'Sitios web con editor visual y dominio propio',
    excerpt: 'Publica tu página comercial con secciones listas, formulario de contactos y seguimiento de visitas.',
    imageUrl: '/novedades/sitios-web.svg',
    imageAlt: 'Editor visual de sitios web',
    category: 'Servicios web',
    publishedAt: '26 sep 2026',
    href: '/dashboard/configuracion/servicios-web',
  },
]

type DashboardNewsSliderProps = {
  items?: DashboardNewsItem[]
}

export default function DashboardNewsSlider({ items = SAMPLE_NEWS }: DashboardNewsSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const syncScrollState = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    setCanScrollPrev(track.scrollLeft > 4)
    setCanScrollNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4)
  }, [])

  useEffect(() => {
    syncScrollState()
    const track = trackRef.current
    if (!track || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(syncScrollState)
    observer.observe(track)
    return () => observer.disconnect()
  }, [syncScrollState, items.length])

  if (!items.length) return null

  const move = (direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    const firstCard = track.firstElementChild as HTMLElement | null
    const step = firstCard ? firstCard.offsetWidth + 12 : track.clientWidth * 0.8
    track.scrollBy({ left: direction * step, behavior: 'smooth' })
  }

  const cardClassName =
    'group flex w-[248px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-[0_16px_40px_-34px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 sm:w-[280px]'

  return (
    <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
      <CardHeader className="border-b border-slate-100 pb-5">
        <CardInfoHeader
          title={
            <CardTitle className="flex items-center gap-2 text-2xl text-slate-950">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Novedades
            </CardTitle>
          }
          description="Funciones nuevas, mejoras y contenidos de apoyo publicados por el equipo. Desliza para ver todas."
          tone="data"
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Ver novedades anteriores"
                className="rounded-full border-slate-200 bg-white/90"
                onClick={() => move(-1)}
                disabled={!canScrollPrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Ver más novedades"
                className="rounded-full border-slate-200 bg-white/90"
                onClick={() => move(1)}
                disabled={!canScrollNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          }
        />
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={trackRef}
          role="list"
          aria-label="Novedades del producto"
          tabIndex={0}
          onScroll={syncScrollState}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-inset [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const content = (
              <>
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.imageAlt}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <ImageIcon className="h-8 w-8" aria-hidden="true" />
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">
                    {item.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 px-3 py-3">
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{item.publishedAt}</span>
                  <h3 className="line-clamp-2 text-[13px] font-semibold leading-5 text-slate-950">{item.title}</h3>
                  <p className="line-clamp-2 text-[12px] leading-5 text-slate-600">{item.excerpt}</p>
                  {item.href ? (
                    <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[11px] font-semibold text-slate-900">
                      Ver detalle
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  ) : null}
                </div>
              </>
            )

            return item.href ? (
              <Link key={item.id} href={item.href} role="listitem" className={cardClassName}>
                {content}
              </Link>
            ) : (
              <article key={item.id} role="listitem" className={cardClassName}>
                {content}
              </article>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}


