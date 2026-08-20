import type { Config } from '@puckeditor/core'

export const websiteBuilderPuckConfig: Config = {
  components: {
    HeroBlock: {
      label: 'Hero',
      fields: {
        eyebrow: { type: 'text', label: 'Eyebrow' },
        title: { type: 'text', label: 'Título' },
        subtitle: { type: 'textarea', label: 'Descripción' },
        ctaLabel: { type: 'text', label: 'Texto CTA' },
        ctaHref: { type: 'text', label: 'Enlace CTA' },
      },
      render: ({ eyebrow, title, subtitle, ctaLabel, ctaHref }) => (
        <section className="rounded-[28px] bg-slate-950 px-8 py-14 text-white">
          {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-300">{eyebrow}</div> : null}
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">{title || 'Título principal del sitio'}</h1>
          {subtitle ? <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">{subtitle}</p> : null}
          {ctaLabel ? (
            <a href={ctaHref || '#'} className="mt-6 inline-flex rounded-full bg-amber-400 px-5 py-2.5 text-sm font-semibold text-slate-950">
              {ctaLabel}
            </a>
          ) : null}
        </section>
      ),
    },
    TextBlock: {
      label: 'Texto',
      fields: {
        title: { type: 'text', label: 'Título' },
        body: { type: 'textarea', label: 'Contenido' },
      },
      render: ({ title, body }) => (
        <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-10 shadow-sm">
          {title ? <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2> : null}
          <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-600">{body || 'Agrega aquí el contenido principal de la sección.'}</p>
        </section>
      ),
    },
    CtaBlock: {
      label: 'CTA',
      fields: {
        title: { type: 'text', label: 'Título' },
        description: { type: 'textarea', label: 'Descripción' },
        buttonLabel: { type: 'text', label: 'Botón' },
        buttonHref: { type: 'text', label: 'Enlace' },
      },
      render: ({ title, description, buttonLabel, buttonHref }) => (
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 px-8 py-10">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title || 'Llamado a la acción'}</h2>
            {description ? <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-700">{description}</p> : null}
            {buttonLabel ? (
              <a href={buttonHref || '#'} className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">
                {buttonLabel}
              </a>
            ) : null}
          </div>
        </section>
      ),
    },
  },
}