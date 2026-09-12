'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type WebsiteCarouselItem = { imageUrl?: string; imageAlt?: string; title?: string; description?: string }
export type WebsiteTabItem = { label?: string; title?: string; content?: string }

export function WebsiteCarousel({ items, accentColor = '#2563eb', autoplay = false }: { items: WebsiteCarouselItem[]; accentColor?: string; autoplay?: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const safeItems = items.filter((item) => item.imageUrl || item.title || item.description)
  const active = safeItems[Math.min(activeIndex, Math.max(0, safeItems.length - 1))]

  useEffect(() => {
    if (!autoplay || safeItems.length < 2) return
    const interval = window.setInterval(() => setActiveIndex((current) => (current + 1) % safeItems.length), 5000)
    return () => window.clearInterval(interval)
  }, [autoplay, safeItems.length])

  if (!active) return <div className="flex min-h-64 items-center justify-center border border-dashed border-slate-300 text-sm text-slate-500">Agrega slides al carrusel.</div>

  const move = (direction: number) => setActiveIndex((current) => (current + direction + safeItems.length) % safeItems.length)

  return (
    <div className="relative overflow-hidden bg-slate-950 text-white">
      <div className="relative min-h-[460px]">
        {active.imageUrl ? <img src={active.imageUrl} alt={active.imageAlt || active.title || 'Slide'} className="absolute inset-0 h-full w-full object-cover opacity-65" /> : null}
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative z-10 mx-auto flex min-h-[460px] max-w-7xl items-end px-6 py-14 lg:px-10">
          <div className="max-w-2xl"><div className="h-1 w-14" style={{ backgroundColor: accentColor }} /><h2 className="mt-5 text-3xl font-semibold sm:text-5xl">{active.title}</h2>{active.description ? <p className="mt-4 text-base leading-7 text-white/80 sm:text-lg">{active.description}</p> : null}</div>
        </div>
      </div>
      {safeItems.length > 1 ? <div className="absolute bottom-5 right-5 z-20 flex gap-2"><button type="button" aria-label="Anterior" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950" onClick={() => move(-1)}><ChevronLeft className="h-5 w-5" /></button><button type="button" aria-label="Siguiente" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950" onClick={() => move(1)}><ChevronRight className="h-5 w-5" /></button></div> : null}
    </div>
  )
}

export function WebsiteTabs({ items, accentColor = '#2563eb' }: { items: WebsiteTabItem[]; accentColor?: string }) {
  const safeItems = items.length ? items : [{ label: 'Pestaña', title: 'Contenido', content: 'Agrega información.' }]
  const [activeIndex, setActiveIndex] = useState(0)
  const active = safeItems[Math.min(activeIndex, safeItems.length - 1)]

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {safeItems.map((item, index) => <button key={`${item.label}-${index}`} type="button" role="tab" aria-selected={index === activeIndex} className="shrink-0 border-b-2 px-4 py-3 text-sm font-semibold" style={{ borderColor: index === activeIndex ? accentColor : 'transparent', color: index === activeIndex ? accentColor : '#64748b' }} onClick={() => setActiveIndex(index)}>{item.label || `Pestaña ${index + 1}`}</button>)}
      </div>
      <div className="min-h-44 py-8"><h3 className="text-2xl font-semibold text-slate-950">{active.title}</h3><p className="mt-3 whitespace-pre-wrap leading-7 text-slate-600">{active.content}</p></div>
    </div>
  )
}
