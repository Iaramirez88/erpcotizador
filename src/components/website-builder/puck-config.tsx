import type { Config } from '@puckeditor/core'

type Tone = 'dark' | 'light' | 'brand'
type Alignment = 'left' | 'center'
type HorizontalAlignment = 'left' | 'center' | 'right'
type HeroLayout = 'stack' | 'split-right' | 'split-left'
type WidthScale = 'md' | 'lg' | 'xl' | 'full'
type Ratio = 'auto' | 'square' | 'portrait' | 'wide' | 'ultrawide'
type ImageFit = 'cover' | 'contain'
type SurfaceTone = 'white' | 'soft' | 'dark'

function getToneClasses(tone?: Tone) {
  switch (tone) {
    case 'light':
      return {
        section: 'border border-slate-200 bg-white text-slate-950 shadow-sm',
        eyebrow: 'text-amber-600',
        subtitle: 'text-slate-600',
        button: 'bg-slate-950 text-white',
      }
    case 'brand':
      return {
        section: 'border border-amber-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffedd5_42%,#fde68a_100%)] text-slate-950 shadow-sm',
        eyebrow: 'text-amber-700',
        subtitle: 'text-slate-700',
        button: 'bg-slate-950 text-white',
      }
    default:
      return {
        section: 'border border-slate-900/60 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]',
        eyebrow: 'text-amber-300',
        subtitle: 'text-slate-200',
        button: 'bg-amber-400 text-slate-950',
      }
  }
}

function getWidthClass(width?: WidthScale) {
  switch (width) {
    case 'md':
      return 'max-w-2xl'
    case 'lg':
      return 'max-w-3xl'
    case 'full':
      return 'max-w-none'
    default:
      return 'max-w-4xl'
  }
}

function getRatioClass(ratio?: Ratio) {
  switch (ratio) {
    case 'square':
      return 'aspect-square'
    case 'portrait':
      return 'aspect-[4/5]'
    case 'wide':
      return 'aspect-[16/9]'
    case 'ultrawide':
      return 'aspect-[21/9]'
    default:
      return 'aspect-auto'
  }
}

function getAlignmentClass(alignment?: Alignment) {
  return alignment === 'center' ? 'items-center text-center' : 'items-start text-left'
}

function getImageObjectClass(fit?: ImageFit) {
  return fit === 'contain' ? 'object-contain' : 'object-cover'
}

function getSurfaceToneClasses(tone?: SurfaceTone) {
  switch (tone) {
    case 'dark':
      return 'border border-slate-900/70 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]'
    case 'soft':
      return 'border border-amber-200 bg-amber-50 text-slate-950 shadow-sm'
    default:
      return 'border border-slate-200 bg-white text-slate-950 shadow-sm'
  }
}

function getHorizontalAlignmentClass(alignment?: HorizontalAlignment) {
  switch (alignment) {
    case 'center':
      return 'justify-center'
    case 'right':
      return 'justify-end'
    default:
      return 'justify-start'
  }
}

function renderImageFrame({
  imageUrl,
  imageAlt,
  ratio,
  fit,
  minHeightClass,
}: {
  imageUrl?: string
  imageAlt?: string
  ratio?: Ratio
  fit?: ImageFit
  minHeightClass?: string
}) {
  const ratioClass = getRatioClass(ratio)
  const objectClass = getImageObjectClass(fit)

  if (!imageUrl) {
    return (
      <div className={`flex h-full min-h-[260px] w-full items-center justify-center rounded-[24px] border border-dashed border-white/30 bg-white/10 px-6 text-sm text-current/70 ${minHeightClass ?? ''}`}>
        Agrega una URL de imagen para activar este bloque visual.
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-[24px] bg-white/10 ${ratioClass} ${minHeightClass ?? ''}`}>
      <img src={imageUrl} alt={imageAlt || 'Imagen del bloque'} className={`h-full w-full ${objectClass}`} />
    </div>
  )
}

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
        tone: {
          type: 'select',
          label: 'Estilo visual',
          options: [
            { label: 'Oscuro', value: 'dark' },
            { label: 'Claro', value: 'light' },
            { label: 'Marca', value: 'brand' },
          ],
        },
        alignment: {
          type: 'radio',
          label: 'Alineación',
          options: [
            { label: 'Izquierda', value: 'left' },
            { label: 'Centro', value: 'center' },
          ],
        },
        layout: {
          type: 'select',
          label: 'Layout',
          options: [
            { label: 'Apilado', value: 'stack' },
            { label: 'Texto izquierda / imagen derecha', value: 'split-right' },
            { label: 'Imagen izquierda / texto derecha', value: 'split-left' },
          ],
        },
        contentWidth: {
          type: 'select',
          label: 'Ancho del contenido',
          options: [
            { label: 'Medio', value: 'md' },
            { label: 'Grande', value: 'lg' },
            { label: 'Extra grande', value: 'xl' },
            { label: 'Completo', value: 'full' },
          ],
        },
        contentFlex: { type: 'number', label: 'Columnas texto', min: 1, max: 12, step: 1 },
        mediaFlex: { type: 'number', label: 'Columnas imagen', min: 1, max: 12, step: 1 },
        backgroundImageUrl: { type: 'text', label: 'Imagen de fondo URL' },
        backgroundImagePosition: {
          type: 'select',
          label: 'Posición fondo',
          options: [
            { label: 'Centro', value: 'center center' },
            { label: 'Arriba', value: 'center top' },
            { label: 'Izquierda', value: 'left center' },
            { label: 'Derecha', value: 'right center' },
          ],
        },
        overlayOpacity: { type: 'number', label: 'Oscurecer fondo (%)', min: 0, max: 90, step: 5 },
        mediaImageUrl: { type: 'text', label: 'Imagen lateral URL' },
        mediaImageAlt: { type: 'text', label: 'Alt imagen lateral' },
        mediaRatio: {
          type: 'select',
          label: 'Proporción imagen lateral',
          options: [
            { label: 'Automática', value: 'auto' },
            { label: 'Cuadrada', value: 'square' },
            { label: 'Vertical', value: 'portrait' },
            { label: 'Horizontal', value: 'wide' },
          ],
        },
        mediaFit: {
          type: 'radio',
          label: 'Ajuste imagen lateral',
          options: [
            { label: 'Cubrir', value: 'cover' },
            { label: 'Contener', value: 'contain' },
          ],
        },
      },
      render: ({
        eyebrow,
        title,
        subtitle,
        ctaLabel,
        ctaHref,
        tone = 'dark',
        alignment = 'left',
        layout = 'stack',
        contentWidth = 'xl',
        contentFlex = 6,
        mediaFlex = 6,
        backgroundImageUrl,
        backgroundImagePosition = 'center center',
        overlayOpacity = 35,
        mediaImageUrl,
        mediaImageAlt,
        mediaRatio = 'wide',
        mediaFit = 'cover',
      }) => {
        const toneClasses = getToneClasses(tone as Tone)
        const splitLayout = layout !== 'stack'
        const reverseDesktop = layout === 'split-left'
        const backgroundStyle = backgroundImageUrl
          ? {
              backgroundImage: `linear-gradient(rgba(15, 23, 42, ${(Number(overlayOpacity) || 0) / 100}), rgba(15, 23, 42, ${(Number(overlayOpacity) || 0) / 100})), url(${backgroundImageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: backgroundImagePosition as string,
            }
          : undefined

        return (
          <section className={`rounded-[32px] px-6 py-10 sm:px-8 sm:py-14 ${toneClasses.section}`} style={backgroundStyle}>
            <div className={`mx-auto flex gap-8 ${splitLayout ? `flex-col lg:items-center ${reverseDesktop ? 'lg:flex-row-reverse' : 'lg:flex-row'}` : 'flex-col'} ${alignment === 'center' && !splitLayout ? 'items-center text-center' : ''}`}>
              <div
                className={`flex min-w-0 flex-col justify-center ${getAlignmentClass(alignment as Alignment)} ${splitLayout ? '' : getWidthClass(contentWidth as WidthScale)}`}
                style={splitLayout ? { flexBasis: 0, flexGrow: Number(contentFlex) || 6 } : undefined}
              >
                {eyebrow ? <div className={`text-xs font-semibold uppercase tracking-[0.32em] ${toneClasses.eyebrow}`}>{eyebrow}</div> : null}
                <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title || 'Título principal del sitio'}</h1>
                {subtitle ? <p className={`mt-4 whitespace-pre-wrap text-base leading-7 sm:text-lg ${toneClasses.subtitle}`}>{subtitle}</p> : null}
                {ctaLabel ? (
                  <div className={alignment === 'center' && !splitLayout ? 'mt-6 flex justify-center' : 'mt-6'}>
                    <a href={ctaHref || '#'} className={`inline-flex rounded-full px-5 py-2.5 text-sm font-semibold ${toneClasses.button}`}>
                      {ctaLabel}
                    </a>
                  </div>
                ) : null}
              </div>

              {splitLayout ? (
                <div className="min-w-0" style={{ flexBasis: 0, flexGrow: Number(mediaFlex) || 6 }}>
                  {renderImageFrame({
                    imageUrl: mediaImageUrl as string | undefined,
                    imageAlt: mediaImageAlt as string | undefined,
                    ratio: mediaRatio as Ratio,
                    fit: mediaFit as ImageFit,
                    minHeightClass: 'min-h-[320px]',
                  })}
                </div>
              ) : null}
            </div>
          </section>
        )
      },
    },
    SectionBlock: {
      label: 'Sección',
      fields: {
        eyebrow: { type: 'text', label: 'Eyebrow' },
        title: { type: 'text', label: 'Título' },
        description: { type: 'textarea', label: 'Descripción' },
        tone: {
          type: 'select',
          label: 'Superficie',
          options: [
            { label: 'Blanca', value: 'white' },
            { label: 'Suave', value: 'soft' },
            { label: 'Oscura', value: 'dark' },
          ],
        },
        contentWidth: {
          type: 'select',
          label: 'Ancho del contenedor',
          options: [
            { label: 'Medio', value: 'md' },
            { label: 'Grande', value: 'lg' },
            { label: 'Extra grande', value: 'xl' },
            { label: 'Completo', value: 'full' },
          ],
        },
        content: {
          type: 'slot',
          label: 'Contenido',
          allow: ['TextBlock', 'ImageBlock', 'CtaBlock'],
        },
      },
      render: ({ eyebrow, title, description, tone = 'white', contentWidth = 'xl', content: Content }) => (
        <section className={`rounded-[32px] px-6 py-8 sm:px-8 sm:py-10 ${getSurfaceToneClasses(tone as SurfaceTone)}`}>
          <div className={`mx-auto ${getWidthClass(contentWidth as WidthScale)}`}>
            {(eyebrow || title || description) ? (
              <div className="mb-6 text-center">
                {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-600">{eyebrow}</div> : null}
                {title ? <h2 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h2> : null}
                {description ? <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-current/75">{description}</p> : null}
              </div>
            ) : null}
            <div className="space-y-5">
              {Content ? <Content className="min-h-[120px] rounded-[24px] border border-dashed border-slate-300/70 p-3" /> : null}
            </div>
          </div>
        </section>
      ),
    },
    TextBlock: {
      label: 'Texto',
      fields: {
        title: { type: 'text', label: 'Título' },
        body: { type: 'textarea', label: 'Contenido' },
        alignment: {
          type: 'radio',
          label: 'Alineación',
          options: [
            { label: 'Izquierda', value: 'left' },
            { label: 'Centro', value: 'center' },
          ],
        },
        width: {
          type: 'select',
          label: 'Ancho del texto',
          options: [
            { label: 'Medio', value: 'md' },
            { label: 'Grande', value: 'lg' },
            { label: 'Extra grande', value: 'xl' },
            { label: 'Completo', value: 'full' },
          ],
        },
      },
      render: ({ title, body, alignment = 'left', width = 'lg' }) => (
        <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-10 shadow-sm">
          <div className={`mx-auto flex flex-col ${getAlignmentClass(alignment as Alignment)} ${getWidthClass(width as WidthScale)}`}>
            {title ? <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2> : null}
            <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-600">{body || 'Agrega aquí el contenido principal de la sección.'}</p>
          </div>
        </section>
      ),
    },
    ImageBlock: {
      label: 'Imagen',
      fields: {
        imageUrl: { type: 'text', label: 'URL imagen' },
        imageAlt: { type: 'text', label: 'Texto alternativo' },
        caption: { type: 'text', label: 'Leyenda' },
        width: { type: 'number', label: 'Ancho (%)', min: 20, max: 100, step: 5 },
        alignment: {
          type: 'radio',
          label: 'Posición',
          options: [
            { label: 'Izquierda', value: 'left' },
            { label: 'Centro', value: 'center' },
            { label: 'Derecha', value: 'right' },
          ],
        },
        ratio: {
          type: 'select',
          label: 'Proporción',
          options: [
            { label: 'Automática', value: 'auto' },
            { label: 'Cuadrada', value: 'square' },
            { label: 'Vertical', value: 'portrait' },
            { label: 'Horizontal', value: 'wide' },
            { label: 'Ultra wide', value: 'ultrawide' },
          ],
        },
        fit: {
          type: 'radio',
          label: 'Ajuste',
          options: [
            { label: 'Cubrir', value: 'cover' },
            { label: 'Contener', value: 'contain' },
          ],
        },
      },
      render: ({ imageUrl, imageAlt, caption, width = 100, alignment = 'left', ratio = 'wide', fit = 'cover' }) => (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className={`flex ${getHorizontalAlignmentClass(alignment as HorizontalAlignment)}`}>
            <figure style={{ width: `${Math.min(Math.max(Number(width) || 100, 20), 100)}%` }} className="max-w-full">
              {renderImageFrame({
                imageUrl: imageUrl as string | undefined,
                imageAlt: imageAlt as string | undefined,
                ratio: ratio as Ratio,
                fit: fit as ImageFit,
              })}
              {caption ? <figcaption className="mt-3 text-sm text-slate-500">{caption}</figcaption> : null}
            </figure>
          </div>
        </section>
      ),
    },
    ColumnsBlock: {
      label: 'Columnas',
      fields: {
        eyebrow: { type: 'text', label: 'Eyebrow sección' },
        title: { type: 'text', label: 'Título sección' },
        description: { type: 'textarea', label: 'Descripción sección' },
        tone: {
          type: 'select',
          label: 'Superficie',
          options: [
            { label: 'Blanca', value: 'white' },
            { label: 'Suave', value: 'soft' },
            { label: 'Oscura', value: 'dark' },
          ],
        },
        leftFlex: { type: 'number', label: 'Ancho columna izquierda', min: 1, max: 12, step: 1 },
        rightFlex: { type: 'number', label: 'Ancho columna derecha', min: 1, max: 12, step: 1 },
        gap: { type: 'number', label: 'Separación entre columnas', min: 12, max: 64, step: 4 },
        leftColumn: {
          type: 'slot',
          label: 'Columna izquierda',
          allow: ['TextBlock', 'ImageBlock', 'CtaBlock', 'SectionBlock'],
        },
        rightColumn: {
          type: 'slot',
          label: 'Columna derecha',
          allow: ['TextBlock', 'ImageBlock', 'CtaBlock', 'SectionBlock'],
        },
      },
      render: ({
        eyebrow,
        title,
        description,
        tone = 'white',
        leftFlex = 6,
        rightFlex = 6,
        gap = 24,
        leftColumn: LeftColumn,
        rightColumn: RightColumn,
      }) => {
        return (
          <section className={`rounded-[32px] px-6 py-8 sm:px-8 sm:py-10 ${getSurfaceToneClasses(tone as SurfaceTone)}`}>
            {(eyebrow || title || description) ? (
              <div className="mx-auto max-w-3xl text-center">
                {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-600">{eyebrow}</div> : null}
                {title ? <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2> : null}
                {description ? <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-current/75">{description}</p> : null}
              </div>
            ) : null}

            <div className={title || description || eyebrow ? 'mt-8' : ''}>
              <div className="flex flex-col lg:flex-row" style={{ gap: `${Math.min(Math.max(Number(gap) || 24, 12), 64)}px` }}>
                <div className="min-w-0 rounded-[26px] border border-slate-200/80 bg-slate-50/70 p-4" style={{ flexBasis: 0, flexGrow: Number(leftFlex) || 6 }}>
                  {LeftColumn ? <LeftColumn className="min-h-[200px] rounded-[20px] border border-dashed border-slate-300/80 p-3" /> : null}
                </div>
                <div className="min-w-0 rounded-[26px] border border-slate-200/80 bg-slate-50/70 p-4" style={{ flexBasis: 0, flexGrow: Number(rightFlex) || 6 }}>
                  {RightColumn ? <RightColumn className="min-h-[200px] rounded-[20px] border border-dashed border-slate-300/80 p-3" /> : null}
                </div>
              </div>
            </div>
          </section>
        )
      },
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