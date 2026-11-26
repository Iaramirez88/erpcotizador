'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock, ImageIcon, LayoutGrid, Search } from 'lucide-react'

import type { HelpArticle, HelpCategory, HelpDifficulty } from '@/lib/help-center-content'

type HelpCenterProps = {
  categories: HelpCategory[]
  articles: HelpArticle[]
}

const difficultyClasses: Record<HelpDifficulty, string> = {
  Básico: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Intermedio: 'border-amber-200 bg-amber-50 text-amber-700',
  Avanzado: 'border-rose-200 bg-rose-50 text-rose-700',
}

export function HelpCenter({ categories, articles }: HelpCenterProps) {
  const [query, setQuery] = useState('')
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  const selectedArticle = selectedSlug
    ? (articles.find((article) => article.slug === selectedSlug) ?? null)
    : null

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedSlug])

  const openArticle = (slug: string) => {
    setQuery('')
    setSelectedSlug(slug)
  }

  const closeArticle = () => setSelectedSlug(null)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return articles
    return articles.filter((article) => {
      const haystack = [article.title, article.excerpt, ...article.keywords]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [articles, query])

  return (
    <div ref={contentRef} className="scroll-mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <nav
          aria-label="Menú del centro de documentación"
          className="rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-sm"
        >
          {selectedArticle ? (
            <button
              type="button"
              onClick={closeArticle}
              className="mb-3 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Ver todas las guías
            </button>
          ) : (
            <div className="px-2 pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Contenido
            </div>
          )}

          <div className="space-y-5">
            {categories.map((category) => {
              const categoryArticles = articles.filter((article) => article.category === category.id)
              if (categoryArticles.length === 0) return null
              return (
                <div key={category.id}>
                  <div className="flex items-center justify-between px-2">
                    <span className="text-sm font-semibold text-slate-900">{category.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                      {categoryArticles.length}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {categoryArticles.map((article) => {
                      const active = article.slug === selectedSlug
                      return (
                        <li key={article.slug}>
                          <button
                            type="button"
                            onClick={() => openArticle(article.slug)}
                            aria-current={active ? 'true' : undefined}
                            className={`block w-full rounded-xl px-2 py-2 text-left text-[13px] leading-5 transition ${
                              active
                                ? 'bg-emerald-50 font-medium text-emerald-800'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                            }`}
                          >
                            {article.title}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </nav>
      </aside>

      <div className="space-y-6">
        {selectedArticle ? (
          <ArticleDetail
            article={selectedArticle}
            articles={articles}
            onBack={closeArticle}
            onOpen={openArticle}
          />
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar tutoriales, módulos, integraciones…"
                aria-label="Buscar en la documentación"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {query.trim() ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  {filtered.length} resultado{filtered.length === 1 ? '' : 's'} para «{query.trim()}»
                </p>
                {filtered.length === 0 ? (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                    No encontramos coincidencias. Prueba con otra palabra o navega por el menú.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filtered.map((article) => (
                      <ArticleCard key={article.slug} article={article} onOpen={openArticle} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {categories.map((category) => {
                  const categoryArticles = articles.filter(
                    (article) => article.category === category.id
                  )
                  if (categoryArticles.length === 0) return null
                  return (
                    <section key={category.id} id={category.id}>
                      <div className="mb-3 flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-emerald-600" />
                        <h2 className="text-lg font-semibold text-slate-950">{category.name}</h2>
                      </div>
                      <p className="mb-3 text-sm text-slate-500">{category.description}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {categoryArticles.map((article) => (
                          <ArticleCard key={article.slug} article={article} onOpen={openArticle} />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ArticleCard({ article, onOpen }: { article: HelpArticle; onOpen: (slug: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(article.slug)}
      className="group flex flex-col rounded-[22px] border border-slate-200 bg-white/95 p-5 text-left shadow-sm transition hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
          <BookOpen className="h-4 w-4" />
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${difficultyClasses[article.difficulty]}`}
        >
          {article.difficulty}
        </span>
      </div>
      <h3 className="mt-4 text-[15px] font-semibold leading-snug text-slate-950">{article.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{article.excerpt}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {article.readingMinutes} min
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
          Leer guía
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  )
}

function ArticleDetail({
  article,
  articles,
  onBack,
  onOpen,
}: {
  article: HelpArticle
  articles: HelpArticle[]
  onBack: () => void
  onOpen: (slug: string) => void
}) {
  const index = articles.findIndex((item) => item.slug === article.slug)
  const previous = index > 0 ? articles[index - 1] : null
  const next = index >= 0 && index < articles.length - 1 ? articles[index + 1] : null
  const related = article.related
    .map((slug) => articles.find((item) => item.slug === slug))
    .filter((item): item is HelpArticle => Boolean(item))

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al directorio
      </button>

      <header className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)]">
        <div className="px-6 py-8 sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${difficultyClasses[article.difficulty]}`}
            >
              {article.difficulty}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              {article.readingMinutes} min de lectura
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {article.title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{article.excerpt}</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm sm:p-8">
            {article.sections.map((section, sectionIndex) => (
              <section
                key={section.heading}
                id={`seccion-${sectionIndex + 1}`}
                className={sectionIndex > 0 ? 'mt-8 border-t border-slate-100 pt-8' : ''}
              >
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  {section.heading}
                </h2>
                {section.body ? (
                  <p className="mt-3 text-sm leading-7 text-slate-600">{section.body}</p>
                ) : null}
                {section.steps?.length ? (
                  <ul className="mt-4 space-y-3">
                    {section.steps.map((step, stepIndex) => (
                      <li key={step} className="flex gap-3">
                        <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700">
                          {stepIndex + 1}
                        </span>
                        <span className="text-sm leading-6 text-slate-700">{step}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          {article.screenshot ? (
            <figure className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <img
                src={article.screenshot.src}
                alt={article.screenshot.alt}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50 object-contain"
                loading="lazy"
              />
              <figcaption className="px-2 pb-1 pt-3 text-xs text-slate-500">
                {article.screenshot.caption ?? article.screenshot.alt}
              </figcaption>
            </figure>
          ) : (
            <div className="flex items-center gap-3 rounded-[28px] border border-dashed border-slate-200 bg-white/70 p-5 text-sm text-slate-500">
              <ImageIcon className="h-5 w-5 text-slate-400" />
              Captura de pantalla del módulo en preparación.
            </div>
          )}

          <nav
            aria-label="Navegación entre guías"
            className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between"
          >
            {previous ? (
              <button
                type="button"
                onClick={() => onOpen(previous.slug)}
                className="group flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-emerald-700"
              >
                <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" />
                {previous.title}
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button
                type="button"
                onClick={() => onOpen(next.slug)}
                className="group flex items-center justify-end gap-2 text-right text-sm font-medium text-slate-600 transition hover:text-emerald-700"
              >
                {next.title}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </button>
            ) : null}
          </nav>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <nav
            aria-label="En esta guía"
            className="rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-sm"
          >
            <div className="px-2 pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              En esta guía
            </div>
            <ul className="space-y-1">
              {article.sections.map((section, sectionIndex) => (
                <li key={section.heading}>
                  <a
                    href={`#seccion-${sectionIndex + 1}`}
                    className="flex items-start gap-2 rounded-xl px-2 py-2 text-[13px] leading-5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-600" />
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {related.length > 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-white/95 p-4 shadow-sm">
              <div className="px-2 pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Guías relacionadas
              </div>
              <ul className="space-y-1">
                {related.map((item) => (
                  <li key={item.slug}>
                    <button
                      type="button"
                      onClick={() => onOpen(item.slug)}
                      className="block w-full rounded-xl px-2 py-2 text-left text-[13px] leading-5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                    >
                      {item.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
