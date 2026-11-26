'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

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

export type WebsiteAccordionItem = { title?: string; content?: string }

export function WebsiteAccordion({ items, accentColor = '#2563eb' }: { items: WebsiteAccordionItem[]; accentColor?: string }) {
  const safeItems = items.length ? items : [{ title: 'Elemento', content: 'Escribe aquí el contenido.' }]
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="space-y-3">
      {safeItems.map((item, index) => {
        const isOpen = openIndex === index
        return (
          <div key={`${item.title}-${index}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button type="button" aria-expanded={isOpen} onClick={() => setOpenIndex(isOpen ? null : index)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-slate-950">
              <span>{item.title || `Elemento ${index + 1}`}</span>
              <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: accentColor }} />
            </button>
            {isOpen ? <div className="border-t border-slate-100 px-5 py-4 text-sm leading-6 text-slate-600">{item.content}</div> : null}
          </div>
        )
      })}
    </div>
  )
}

export function WebsiteCountdown({ targetDate, accentColor = '#2563eb' }: { targetDate?: string; accentColor?: string }) {
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const target = targetDate ? new Date(targetDate).getTime() : null
  if (!target || Number.isNaN(target)) {
    return <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/5 text-sm text-slate-400">Configura una fecha objetivo para activar la cuenta regresiva.</div>
  }

  const diff = Math.max(0, target - now)
  const cells = [
    { label: 'Días', value: Math.floor(diff / 86400000) },
    { label: 'Horas', value: Math.floor((diff % 86400000) / 3600000) },
    { label: 'Min', value: Math.floor((diff % 3600000) / 60000) },
    { label: 'Seg', value: Math.floor((diff % 60000) / 1000) },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-xl border border-current/10 bg-white p-4 text-center text-slate-950">
          <div className="text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: accentColor }}>{String(cell.value).padStart(2, '0')}</div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{cell.label}</div>
        </div>
      ))}
    </div>
  )
}

export type WebsitePricingPlan = {
  name?: string
  tag?: string
  monthlyPrice?: number
  features?: string
  buttonLabel?: string
  buttonHref?: string
  featured?: 'yes' | 'no'
}

function formatPricingPrice(value: number) {
  return `$${value.toLocaleString('es-CO')}`
}

export function WebsitePricing({
  plans,
  annualDiscount = 10,
  eyebrow,
  title,
  description,
  accentColor = '#c9ff4a',
  backgroundColor = '#ffffff',
  textColor = '#263719',
}: {
  plans: WebsitePricingPlan[]
  annualDiscount?: number
  eyebrow?: string
  title?: string
  description?: string
  accentColor?: string
  backgroundColor?: string
  textColor?: string
}) {
  const [period, setPeriod] = useState<'mensual' | 'anual'>('mensual')
  const safePlans = plans.filter((plan) => plan.name || plan.monthlyPrice)
  const discount = Math.min(Math.max(Number(annualDiscount) || 0, 0), 90)

  return (
    <div style={{ backgroundColor, color: textColor }}>
      <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        {(eyebrow || title || description) ? (
          <div className="mx-auto mb-10 max-w-3xl text-center">
            {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: accentColor }}>{eyebrow}</div> : null}
            {title ? <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">{title}</h2> : null}
            {description ? <p className="mt-4 leading-7 opacity-70">{description}</p> : null}
          </div>
        ) : null}

        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-current/15 bg-white p-1">
            <button type="button" onClick={() => setPeriod('mensual')} className="rounded-full px-4 py-2 text-sm font-semibold" style={period === 'mensual' ? { backgroundColor: accentColor, color: '#0f172a' } : { color: textColor, opacity: 0.7 }}>Mensual</button>
            <button type="button" onClick={() => setPeriod('anual')} className="rounded-full px-4 py-2 text-sm font-semibold" style={period === 'anual' ? { backgroundColor: accentColor, color: '#0f172a' } : { color: textColor, opacity: 0.7 }}>Anual -{discount}%</button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {safePlans.map((plan, index) => {
            const monthly = Number(plan.monthlyPrice) || 0
            const annualMonthly = Math.round(monthly * (1 - discount / 100))
            const price = period === 'anual' ? annualMonthly : monthly
            const featured = plan.featured === 'yes'
            return (
              <article key={`${plan.name}-${index}`} className="relative flex flex-col rounded-xl border p-7" style={{ backgroundColor: featured ? accentColor : '#f4f8eb', color: textColor, borderColor: featured ? accentColor : 'rgba(0,0,0,.1)' }}>
                {featured ? <span className="absolute -top-3 left-6 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: textColor, color: accentColor }}>Más elegido</span> : null}
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                {plan.tag ? <div className="mt-1 text-xs uppercase tracking-wider opacity-70">{plan.tag}</div> : null}
                <div className="mt-6"><span className="text-4xl font-bold">{formatPricingPrice(price)}</span><span className="ml-1 text-sm opacity-70">COP{period === 'anual' ? ' /mes' : ''}</span></div>
                <div className="mt-1 text-xs opacity-70">{period === 'anual' ? `Facturado ${formatPricingPrice(annualMonthly * 12)} al año` : 'por mes'}</div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {String(plan.features || '').split('\n').filter(Boolean).map((feature, featureIndex) => <li key={featureIndex} className="flex gap-2"><span style={{ color: accentColor }}>✓</span><span>{feature}</span></li>)}
                </ul>
                {plan.buttonLabel ? <a href={plan.buttonHref || '#contacto'} className="mt-8 inline-flex w-full justify-center rounded-lg px-4 py-3 text-sm font-semibold" style={{ backgroundColor: featured ? textColor : accentColor, color: featured ? accentColor : textColor }}>{plan.buttonLabel}</a> : null}
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
