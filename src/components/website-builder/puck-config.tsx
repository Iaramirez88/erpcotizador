import type { Config, CustomField } from '@puckeditor/core'
import { WebsiteLeadForm } from '@/components/website-builder/website-lead-form'
import { WebsiteCarousel, WebsiteTabs } from '@/components/website-builder/website-interactive-blocks'
import { WebsiteMediaField } from '@/components/website-builder/website-media-field'

type Tone = 'dark' | 'light' | 'brand'
type Alignment = 'left' | 'center'
type HorizontalAlignment = 'left' | 'center' | 'right'
type HeroLayout = 'stack' | 'split-right' | 'split-left'
type WidthScale = 'md' | 'lg' | 'xl' | 'full'
type Ratio = 'auto' | 'square' | 'portrait' | 'wide' | 'ultrawide'
type ImageFit = 'cover' | 'contain'
type SurfaceTone = 'white' | 'soft' | 'dark'

function mediaField(label: string, acceptedTypes: Array<'image' | 'video'>): CustomField<string> {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange, readOnly }) => <WebsiteMediaField value={value} onChange={onChange} readOnly={readOnly} acceptedTypes={acceptedTypes} label={label} />,
  }
}

function sectionStyle(backgroundColor?: string, textColor?: string, paddingY?: number) {
  return {
    backgroundColor: backgroundColor || '#ffffff',
    color: textColor || '#0f172a',
    paddingTop: `${Math.min(Math.max(Number(paddingY) || 64, 16), 160)}px`,
    paddingBottom: `${Math.min(Math.max(Number(paddingY) || 64, 16), 160)}px`,
  }
}

function sectionHeading(eyebrow?: string, title?: string, description?: string) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">{eyebrow}</div> : null}
      {title ? <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">{title}</h2> : null}
      {description ? <p className="mt-4 whitespace-pre-wrap text-base leading-7 opacity-70">{description}</p> : null}
    </div>
  )
}

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
  categories: {
    structure: { title: 'Estructura', components: ['HeroBlock', 'ResponsiveBlock', 'SectionBlock', 'ColumnsBlock', 'SpacerBlock'] },
    content: { title: 'Contenido', components: ['TextBlock', 'ImageBlock', 'GalleryBlock', 'VideoBlock', 'CarouselBlock', 'MapBlock', 'TabsBlock', 'FeaturesBlock', 'StatsBlock', 'TestimonialsBlock', 'FaqBlock'] },
    conversion: { title: 'Conversión', components: ['CtaBlock', 'PricingBlock', 'ContactFormBlock'] },
    navigation: { title: 'Navegación', components: ['NavbarBlock', 'FooterBlock'] },
  },
  root: {
    label: 'Ajustes de página',
    fields: {
      backgroundColor: { type: 'text', label: 'Color de fondo global' },
      textColor: { type: 'text', label: 'Color de texto global' },
      fontFamily: {
        type: 'select',
        label: 'Tipografía',
        options: [
          { label: 'Sans moderna', value: 'ui-sans-serif, system-ui, sans-serif' },
          { label: 'Editorial', value: 'Georgia, Cambria, serif' },
          { label: 'Geométrica', value: 'Montserrat, ui-sans-serif, sans-serif' },
          { label: 'Humanista', value: 'Trebuchet MS, ui-sans-serif, sans-serif' },
        ],
      },
      sectionGap: { type: 'number', label: 'Separación entre bloques', min: 0, max: 80, step: 4 },
    },
    defaultProps: {
      backgroundColor: '#ffffff',
      textColor: '#0f172a',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      sectionGap: 0,
    },
    render: ({ children, backgroundColor, textColor, fontFamily, sectionGap }: {
      children: React.ReactNode
      backgroundColor?: string
      textColor?: string
      fontFamily?: string
      sectionGap?: number
    }) => (
      <main
        className="min-h-screen overflow-hidden"
        style={{
          backgroundColor: backgroundColor || '#ffffff',
          color: textColor || '#0f172a',
          fontFamily: fontFamily || 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <div className="flex min-h-screen flex-col" style={{ gap: `${Math.min(Math.max(Number(sectionGap) || 0, 0), 80)}px` }}>
          {children}
        </div>
      </main>
    ),
  },
  components: {
    ResponsiveBlock: {
      label: 'Contenedor responsive',
      fields: {
        backgroundColor: { type: 'text', label: 'Color de fondo' },
        desktopPadding: { type: 'number', label: 'Padding escritorio', min: 0, max: 160, step: 4 },
        tabletPadding: { type: 'number', label: 'Padding tablet', min: 0, max: 120, step: 4 },
        mobilePadding: { type: 'number', label: 'Padding móvil', min: 0, max: 80, step: 4 },
        hideOnTablet: { type: 'radio', label: 'Ocultar en tablet', options: [{ label: 'No', value: 'no' }, { label: 'Sí', value: 'yes' }] },
        hideOnMobile: { type: 'radio', label: 'Ocultar en móvil', options: [{ label: 'No', value: 'no' }, { label: 'Sí', value: 'yes' }] },
        content: { type: 'slot', label: 'Contenido' },
      },
      defaultProps: { backgroundColor: 'transparent', desktopPadding: 24, tabletPadding: 20, mobilePadding: 16, hideOnTablet: 'no', hideOnMobile: 'no' },
      render: ({ backgroundColor, desktopPadding, tabletPadding, mobilePadding, hideOnTablet, hideOnMobile, content: Content }) => (
        <section
          className="website-responsive-block"
          data-hide-tablet={hideOnTablet === 'yes'}
          data-hide-mobile={hideOnMobile === 'yes'}
          style={{
            backgroundColor: backgroundColor || 'transparent',
            '--website-padding-desktop': `${Math.max(0, Number(desktopPadding) || 0)}px`,
            '--website-padding-tablet': `${Math.max(0, Number(tabletPadding) || 0)}px`,
            '--website-padding-mobile': `${Math.max(0, Number(mobilePadding) || 0)}px`,
          } as React.CSSProperties}
        >
          {Content ? <Content className="min-h-28 border border-dashed border-slate-300/70" /> : null}
        </section>
      ),
    },
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
        backgroundImageUrl: mediaField('Imagen de fondo', ['image']),
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
        mediaImageUrl: mediaField('Imagen lateral', ['image']),
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
        imageUrl: mediaField('Imagen', ['image']),
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
    NavbarBlock: {
      label: 'Menú superior',
      fields: {
        brand: { type: 'text', label: 'Marca' },
        logoUrl: mediaField('Logo', ['image']),
        links: {
          type: 'array',
          label: 'Enlaces',
          arrayFields: {
            label: { type: 'text', label: 'Texto' },
            href: { type: 'text', label: 'Enlace' },
          },
          defaultItemProps: { label: 'Sección', href: '#' },
          getItemSummary: (item) => item.label || 'Enlace',
        },
        buttonLabel: { type: 'text', label: 'Botón' },
        buttonHref: { type: 'text', label: 'Enlace botón' },
        backgroundColor: { type: 'text', label: 'Color de fondo' },
        textColor: { type: 'text', label: 'Color del texto' },
        sticky: { type: 'radio', label: 'Posición', options: [{ label: 'Normal', value: 'normal' }, { label: 'Fijo arriba', value: 'sticky' }] },
      },
      defaultProps: {
        brand: 'Tu marca',
        logoUrl: '',
        links: [{ label: 'Servicios', href: '#servicios' }, { label: 'Nosotros', href: '#nosotros' }, { label: 'Contacto', href: '#contacto' }],
        buttonLabel: 'Hablemos',
        buttonHref: '#contacto',
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        sticky: 'normal',
      },
      render: ({ brand, logoUrl, links, buttonLabel, buttonHref, backgroundColor, textColor, sticky }) => (
        <header className={`z-40 border-b border-slate-200/80 ${sticky === 'sticky' ? 'sticky top-0' : ''}`} style={{ backgroundColor: backgroundColor || '#ffffff', color: textColor || '#0f172a' }}>
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-6 px-5 lg:px-8">
            <a href="#" className="flex items-center gap-3 font-semibold">
              {logoUrl ? <img src={logoUrl as string} alt={brand as string || 'Logo'} className="h-9 w-auto max-w-[160px] object-contain" /> : <span className="text-lg">{brand || 'Tu marca'}</span>}
            </a>
            <nav className="hidden items-center gap-6 md:flex">
              {(Array.isArray(links) ? links : []).map((link, index) => <a key={`${link.href}-${index}`} href={link.href || '#'} className="text-sm font-medium opacity-75 hover:opacity-100">{link.label}</a>)}
            </nav>
            {buttonLabel ? <a href={buttonHref || '#'} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">{buttonLabel}</a> : null}
          </div>
        </header>
      ),
    },
    FeaturesBlock: {
      label: 'Beneficios',
      fields: {
        eyebrow: { type: 'text', label: 'Etiqueta' },
        title: { type: 'text', label: 'Título' },
        description: { type: 'textarea', label: 'Descripción' },
        columns: { type: 'select', label: 'Columnas', options: [{ label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }] },
        items: {
          type: 'array', label: 'Beneficios',
          arrayFields: { icon: { type: 'text', label: 'Icono o número' }, title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' } },
          defaultItemProps: { icon: '01', title: 'Nuevo beneficio', description: 'Explica de forma concreta por qué esto importa.' },
          getItemSummary: (item) => item.title || 'Beneficio',
        },
        backgroundColor: { type: 'text', label: 'Fondo' },
        textColor: { type: 'text', label: 'Texto' },
        accentColor: { type: 'text', label: 'Acento' },
        paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: {
        eyebrow: 'Por qué elegirnos', title: 'Todo lo necesario para avanzar', description: 'Una propuesta clara, enfocada en resultados.', columns: 3,
        items: [{ icon: '01', title: 'Rápido', description: 'Procesos ágiles desde el primer día.' }, { icon: '02', title: 'Flexible', description: 'Una solución que crece contigo.' }, { icon: '03', title: 'Confiable', description: 'Acompañamiento cuando lo necesitas.' }],
        backgroundColor: '#ffffff', textColor: '#0f172a', accentColor: '#2563eb', paddingY: 72,
      },
      render: ({ eyebrow, title, description, columns = 3, items, backgroundColor, textColor, accentColor, paddingY }) => (
        <section style={sectionStyle(backgroundColor as string, textColor as string, paddingY as number)}>
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            {sectionHeading(eyebrow as string, title as string, description as string)}
            <div className={`grid gap-5 ${Number(columns) === 2 ? 'md:grid-cols-2' : Number(columns) === 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
              {(Array.isArray(items) ? items : []).map((item, index) => (
                <article key={`${item.title}-${index}`} className="rounded-lg border border-current/10 bg-white/5 p-6">
                  <div className="text-sm font-bold" style={{ color: accentColor || '#2563eb' }}>{item.icon || String(index + 1).padStart(2, '0')}</div>
                  <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                  <p className="mt-3 leading-7 opacity-70">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ),
    },
    StatsBlock: {
      label: 'Métricas',
      fields: {
        items: {
          type: 'array', label: 'Métricas',
          arrayFields: { value: { type: 'text', label: 'Valor' }, label: { type: 'text', label: 'Descripción' } },
          defaultItemProps: { value: '+100', label: 'Resultados obtenidos' },
          getItemSummary: (item) => `${item.value || ''} ${item.label || ''}`,
        },
        backgroundColor: { type: 'text', label: 'Fondo' }, textColor: { type: 'text', label: 'Texto' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 120, step: 8 },
      },
      defaultProps: { items: [{ value: '98%', label: 'Clientes satisfechos' }, { value: '+250', label: 'Proyectos entregados' }, { value: '12 años', label: 'De experiencia' }, { value: '24/7', label: 'Disponibilidad' }], backgroundColor: '#0f172a', textColor: '#ffffff', paddingY: 48 },
      render: ({ items, backgroundColor, textColor, paddingY }) => (
        <section style={sectionStyle(backgroundColor as string, textColor as string, paddingY as number)}>
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 text-center lg:grid-cols-4 lg:px-8">
            {(Array.isArray(items) ? items : []).map((item, index) => <div key={`${item.label}-${index}`}><div className="text-3xl font-semibold sm:text-4xl">{item.value}</div><div className="mt-2 text-sm opacity-65">{item.label}</div></div>)}
          </div>
        </section>
      ),
    },
    TestimonialsBlock: {
      label: 'Testimonios',
      fields: {
        eyebrow: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' },
        items: {
          type: 'array', label: 'Testimonios',
          arrayFields: { quote: { type: 'textarea', label: 'Testimonio' }, name: { type: 'text', label: 'Nombre' }, role: { type: 'text', label: 'Cargo o empresa' }, avatarUrl: mediaField('Avatar', ['image']) },
          defaultItemProps: { quote: 'Una experiencia excelente de principio a fin.', name: 'Nombre del cliente', role: 'Empresa', avatarUrl: '' },
          getItemSummary: (item) => item.name || 'Testimonio',
        },
        backgroundColor: { type: 'text', label: 'Fondo' }, textColor: { type: 'text', label: 'Texto' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: { eyebrow: 'Testimonios', title: 'La experiencia de nuestros clientes', description: '', items: [{ quote: 'Entendieron nuestra necesidad y entregaron un resultado que superó las expectativas.', name: 'Laura Gómez', role: 'Directora comercial', avatarUrl: '' }, { quote: 'El proceso fue claro, rápido y con acompañamiento permanente.', name: 'Carlos Ruiz', role: 'Fundador', avatarUrl: '' }], backgroundColor: '#f8fafc', textColor: '#0f172a', paddingY: 72 },
      render: ({ eyebrow, title, description, items, backgroundColor, textColor, paddingY }) => (
        <section style={sectionStyle(backgroundColor as string, textColor as string, paddingY as number)}><div className="mx-auto max-w-7xl px-5 lg:px-8">{sectionHeading(eyebrow as string, title as string, description as string)}<div className="grid gap-5 md:grid-cols-2">{(Array.isArray(items) ? items : []).map((item, index) => <figure key={`${item.name}-${index}`} className="rounded-lg border border-current/10 bg-white p-7 text-slate-950 shadow-sm"><blockquote className="text-lg leading-8">“{item.quote}”</blockquote><figcaption className="mt-6 flex items-center gap-3">{item.avatarUrl ? <img src={item.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 font-semibold">{String(item.name || 'C').charAt(0)}</div>}<div><div className="font-semibold">{item.name}</div><div className="text-sm text-slate-500">{item.role}</div></div></figcaption></figure>)}</div></div></section>
      ),
    },
    PricingBlock: {
      label: 'Precios',
      fields: {
        eyebrow: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' },
        plans: {
          type: 'array', label: 'Planes',
          arrayFields: { name: { type: 'text', label: 'Nombre' }, price: { type: 'text', label: 'Precio' }, period: { type: 'text', label: 'Periodo' }, features: { type: 'textarea', label: 'Características (una por línea)' }, buttonLabel: { type: 'text', label: 'Botón' }, buttonHref: { type: 'text', label: 'Enlace' }, featured: { type: 'radio', label: 'Destacado', options: [{ label: 'No', value: 'no' }, { label: 'Sí', value: 'yes' }] } },
          defaultItemProps: { name: 'Plan', price: '$99', period: '/mes', features: 'Característica uno\nCaracterística dos', buttonLabel: 'Elegir plan', buttonHref: '#contacto', featured: 'no' },
          getItemSummary: (item) => item.name || 'Plan',
        },
        backgroundColor: { type: 'text', label: 'Fondo' }, textColor: { type: 'text', label: 'Texto' }, accentColor: { type: 'text', label: 'Acento' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: { eyebrow: 'Planes', title: 'Elige la opción adecuada', description: 'Precios simples y transparentes.', plans: [{ name: 'Esencial', price: '$49', period: '/mes', features: 'Función principal\nSoporte por correo\nActualizaciones', buttonLabel: 'Comenzar', buttonHref: '#contacto', featured: 'no' }, { name: 'Profesional', price: '$99', period: '/mes', features: 'Todo en Esencial\nSoporte prioritario\nFunciones avanzadas', buttonLabel: 'Elegir Profesional', buttonHref: '#contacto', featured: 'yes' }, { name: 'Empresa', price: 'Hablemos', period: '', features: 'Solución personalizada\nAcompañamiento dedicado\nIntegraciones', buttonLabel: 'Contactar', buttonHref: '#contacto', featured: 'no' }], backgroundColor: '#ffffff', textColor: '#0f172a', accentColor: '#2563eb', paddingY: 72 },
      render: ({ eyebrow, title, description, plans, backgroundColor, textColor, accentColor, paddingY }) => (
        <section style={sectionStyle(backgroundColor as string, textColor as string, paddingY as number)}><div className="mx-auto max-w-7xl px-5 lg:px-8">{sectionHeading(eyebrow as string, title as string, description as string)}<div className="grid gap-5 lg:grid-cols-3">{(Array.isArray(plans) ? plans : []).map((plan, index) => <article key={`${plan.name}-${index}`} className={`rounded-lg border p-7 ${plan.featured === 'yes' ? 'border-transparent text-white shadow-xl' : 'border-current/10 bg-white text-slate-950 shadow-sm'}`} style={plan.featured === 'yes' ? { backgroundColor: accentColor || '#2563eb' } : undefined}><h3 className="text-xl font-semibold">{plan.name}</h3><div className="mt-5"><span className="text-4xl font-semibold">{plan.price}</span><span className="ml-1 opacity-65">{plan.period}</span></div><ul className="mt-6 space-y-3 text-sm">{String(plan.features || '').split('\n').filter(Boolean).map((feature, featureIndex) => <li key={featureIndex} className="flex gap-2"><span>✓</span><span>{feature}</span></li>)}</ul><a href={plan.buttonHref || '#'} className={`mt-8 inline-flex w-full justify-center rounded-lg px-4 py-3 text-sm font-semibold ${plan.featured === 'yes' ? 'bg-white text-slate-950' : 'bg-slate-950 text-white'}`}>{plan.buttonLabel || 'Elegir'}</a></article>)}</div></div></section>
      ),
    },
    FaqBlock: {
      label: 'Preguntas frecuentes',
      fields: {
        eyebrow: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' },
        items: { type: 'array', label: 'Preguntas', arrayFields: { question: { type: 'text', label: 'Pregunta' }, answer: { type: 'textarea', label: 'Respuesta' } }, defaultItemProps: { question: 'Nueva pregunta', answer: 'Escribe aquí la respuesta.' }, getItemSummary: (item) => item.question || 'Pregunta' },
        backgroundColor: { type: 'text', label: 'Fondo' }, textColor: { type: 'text', label: 'Texto' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: { eyebrow: 'FAQ', title: 'Preguntas frecuentes', description: 'Resuelve las dudas que frenan una decisión.', items: [{ question: '¿Cómo funciona el servicio?', answer: 'Cuéntale al visitante cómo será el proceso desde el primer contacto.' }, { question: '¿Cuánto tarda?', answer: 'Explica los tiempos habituales y qué puede modificarlos.' }, { question: '¿Qué incluye?', answer: 'Resume de forma clara el alcance de tu oferta.' }], backgroundColor: '#f8fafc', textColor: '#0f172a', paddingY: 72 },
      render: ({ eyebrow, title, description, items, backgroundColor, textColor, paddingY }) => (
        <section style={sectionStyle(backgroundColor as string, textColor as string, paddingY as number)}><div className="mx-auto max-w-4xl px-5 lg:px-8">{sectionHeading(eyebrow as string, title as string, description as string)}<div className="space-y-3">{(Array.isArray(items) ? items : []).map((item, index) => <details key={`${item.question}-${index}`} className="group rounded-lg border border-current/10 bg-white px-5 py-4 text-slate-950"><summary className="cursor-pointer list-none pr-8 font-semibold">{item.question}</summary><p className="mt-3 whitespace-pre-wrap leading-7 text-slate-600">{item.answer}</p></details>)}</div></div></section>
      ),
    },
    ContactFormBlock: {
      label: 'Formulario de contacto',
      fields: {
        eyebrow: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' }, buttonLabel: { type: 'text', label: 'Texto del botón' }, successMessage: { type: 'text', label: 'Mensaje de éxito' }, showPhone: { type: 'radio', label: 'Solicitar teléfono', options: [{ label: 'Sí', value: 'yes' }, { label: 'No', value: 'no' }] }, product: { type: 'text', label: 'Producto o campaña' }, channelId: { type: 'text', label: 'ID canal Formulario Web' }, channelToken: { type: 'text', label: 'Token público del canal' }, backgroundColor: { type: 'text', label: 'Fondo' }, accentColor: { type: 'text', label: 'Botón' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: { eyebrow: 'Contacto', title: 'Cuéntanos sobre tu proyecto', description: 'Déjanos tus datos y te contactaremos pronto.', buttonLabel: 'Enviar solicitud', successMessage: 'Gracias. Recibimos tu solicitud.', showPhone: 'yes', product: 'Landing page', channelId: '', channelToken: '', backgroundColor: '#eef2ff', accentColor: '#2563eb', paddingY: 72 },
      render: ({ eyebrow, title, description, buttonLabel, successMessage, showPhone, product, channelId, channelToken, backgroundColor, accentColor, paddingY, puck }) => (
        <section id="contacto" style={sectionStyle(backgroundColor as string, '#0f172a', paddingY as number)}><div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[.85fr_1.15fr] lg:items-start lg:px-8"><div className="lg:sticky lg:top-24">{eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">{eyebrow}</div> : null}<h2 className="mt-3 text-3xl font-semibold sm:text-4xl">{title}</h2><p className="mt-4 leading-7 text-slate-600">{description}</p></div><WebsiteLeadForm channelId={channelId as string} channelToken={channelToken as string} product={product as string} buttonLabel={buttonLabel as string} successMessage={successMessage as string} showPhone={showPhone === 'yes'} accentColor={accentColor as string} isEditing={Boolean(puck?.isEditing)} /></div></section>
      ),
    },
    GalleryBlock: {
      label: 'Galería',
      fields: {
        eyebrow: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' },
        columns: { type: 'select', label: 'Columnas', options: [{ label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }] },
        images: { type: 'array', label: 'Imágenes', arrayFields: { imageUrl: mediaField('Imagen', ['image']), imageAlt: { type: 'text', label: 'Texto alternativo' }, caption: { type: 'text', label: 'Leyenda' } }, defaultItemProps: { imageUrl: '', imageAlt: '', caption: '' }, getItemSummary: (item) => item.caption || item.imageAlt || 'Imagen' },
        backgroundColor: { type: 'text', label: 'Fondo' }, textColor: { type: 'text', label: 'Texto' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: { eyebrow: 'Galería', title: 'Nuestro trabajo', description: '', columns: 3, images: [], backgroundColor: '#ffffff', textColor: '#0f172a', paddingY: 72 },
      render: ({ eyebrow, title, description, columns, images, backgroundColor, textColor, paddingY }) => (
        <section style={sectionStyle(backgroundColor as string, textColor as string, paddingY as number)}><div className="mx-auto max-w-7xl px-5 lg:px-8">{sectionHeading(eyebrow as string, title as string, description as string)}<div className={`grid gap-4 ${Number(columns) === 2 ? 'md:grid-cols-2' : Number(columns) === 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>{(Array.isArray(images) ? images : []).map((item, index) => <figure key={`${item.imageUrl}-${index}`} className="overflow-hidden rounded-lg bg-slate-100">{item.imageUrl ? <img src={item.imageUrl} alt={item.imageAlt || item.caption || 'Imagen de galería'} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center text-sm text-slate-500">Selecciona una imagen</div>}{item.caption ? <figcaption className="bg-white px-4 py-3 text-sm text-slate-600">{item.caption}</figcaption> : null}</figure>)}</div></div></section>
      ),
    },
    VideoBlock: {
      label: 'Video',
      fields: {
        title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' }, videoUrl: mediaField('Archivo de video', ['video']), posterUrl: mediaField('Portada', ['image']),
        controls: { type: 'radio', label: 'Controles', options: [{ label: 'Mostrar', value: 'yes' }, { label: 'Ocultar', value: 'no' }] }, autoplay: { type: 'radio', label: 'Reproducción automática', options: [{ label: 'No', value: 'no' }, { label: 'Sí, sin sonido', value: 'yes' }] },
        backgroundColor: { type: 'text', label: 'Fondo' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: { title: 'Conoce nuestra propuesta', description: '', videoUrl: '', posterUrl: '', controls: 'yes', autoplay: 'no', backgroundColor: '#0f172a', paddingY: 72 },
      render: ({ title, description, videoUrl, posterUrl, controls, autoplay, backgroundColor, paddingY }) => (
        <section style={sectionStyle(backgroundColor as string, '#ffffff', paddingY as number)}><div className="mx-auto max-w-5xl px-5 lg:px-8">{title ? <h2 className="text-center text-3xl font-semibold sm:text-4xl">{title}</h2> : null}{description ? <p className="mx-auto mt-4 max-w-2xl text-center leading-7 text-white/70">{description}</p> : null}<div className="mt-8 overflow-hidden rounded-lg bg-black">{videoUrl ? <video src={videoUrl as string} poster={posterUrl as string || undefined} controls={controls !== 'no'} autoPlay={autoplay === 'yes'} muted={autoplay === 'yes'} playsInline className="aspect-video w-full object-contain" /> : <div className="flex aspect-video items-center justify-center text-sm text-white/60">Selecciona un video desde Drive</div>}</div></div></section>
      ),
    },
    CarouselBlock: {
      label: 'Carrusel',
      fields: {
        slides: { type: 'array', label: 'Slides', arrayFields: { imageUrl: mediaField('Imagen', ['image']), imageAlt: { type: 'text', label: 'Texto alternativo' }, title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' } }, defaultItemProps: { imageUrl: '', imageAlt: '', title: 'Nuevo slide', description: '' }, getItemSummary: (item) => item.title || 'Slide' },
        accentColor: { type: 'text', label: 'Color de acento' }, autoplay: { type: 'radio', label: 'Rotación automática', options: [{ label: 'No', value: 'no' }, { label: 'Sí', value: 'yes' }] },
      },
      defaultProps: { slides: [{ imageUrl: '', imageAlt: '', title: 'Una historia visual', description: 'Selecciona imágenes desde Drive y presenta tu oferta.' }], accentColor: '#f59e0b', autoplay: 'no' },
      render: ({ slides, accentColor, autoplay }) => <WebsiteCarousel items={Array.isArray(slides) ? slides : []} accentColor={accentColor as string} autoplay={autoplay === 'yes'} />,
    },
    MapBlock: {
      label: 'Mapa',
      fields: { title: { type: 'text', label: 'Título' }, address: { type: 'text', label: 'Dirección o lugar' }, height: { type: 'number', label: 'Altura', min: 240, max: 720, step: 20 }, backgroundColor: { type: 'text', label: 'Fondo' } },
      defaultProps: { title: 'Visítanos', address: 'Bogotá, Colombia', height: 420, backgroundColor: '#f8fafc' },
      render: ({ title, address, height, backgroundColor }) => <section className="px-5 py-14 lg:px-8" style={{ backgroundColor: backgroundColor || '#f8fafc' }}><div className="mx-auto max-w-7xl">{title ? <h2 className="mb-7 text-3xl font-semibold text-slate-950">{title}</h2> : null}<iframe title={title as string || 'Ubicación'} src={`https://www.google.com/maps?q=${encodeURIComponent(String(address || ''))}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="w-full rounded-lg border-0" style={{ height: `${Math.min(Math.max(Number(height) || 420, 240), 720)}px` }} /></div></section>,
    },
    TabsBlock: {
      label: 'Pestañas',
      fields: {
        title: { type: 'text', label: 'Título' }, items: { type: 'array', label: 'Pestañas', arrayFields: { label: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' }, content: { type: 'textarea', label: 'Contenido' } }, defaultItemProps: { label: 'Pestaña', title: 'Nuevo contenido', content: '' }, getItemSummary: (item) => item.label || 'Pestaña' }, accentColor: { type: 'text', label: 'Acento' }, backgroundColor: { type: 'text', label: 'Fondo' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: { title: 'Explora en detalle', items: [{ label: 'Servicio', title: 'Qué hacemos', content: 'Explica aquí tu servicio principal.' }, { label: 'Proceso', title: 'Cómo trabajamos', content: 'Describe las etapas de trabajo.' }], accentColor: '#2563eb', backgroundColor: '#ffffff', paddingY: 64 },
      render: ({ title, items, accentColor, backgroundColor, paddingY }) => <section style={sectionStyle(backgroundColor as string, '#0f172a', paddingY as number)}><div className="mx-auto max-w-5xl px-5 lg:px-8">{title ? <h2 className="mb-8 text-3xl font-semibold">{title}</h2> : null}<WebsiteTabs items={Array.isArray(items) ? items : []} accentColor={accentColor as string} /></div></section>,
    },
    SpacerBlock: {
      label: 'Espaciador',
      fields: { height: { type: 'number', label: 'Altura', min: 8, max: 240, step: 8 }, backgroundColor: { type: 'text', label: 'Fondo' } },
      defaultProps: { height: 48, backgroundColor: '#ffffff' },
      render: ({ height, backgroundColor }) => <div aria-hidden="true" style={{ height: `${Math.min(Math.max(Number(height) || 48, 8), 240)}px`, backgroundColor: backgroundColor || '#ffffff' }} />,
    },
    FooterBlock: {
      label: 'Pie de página',
      fields: {
        brand: { type: 'text', label: 'Marca' }, description: { type: 'textarea', label: 'Descripción' }, copyright: { type: 'text', label: 'Copyright' },
        links: { type: 'array', label: 'Enlaces', arrayFields: { label: { type: 'text', label: 'Texto' }, href: { type: 'text', label: 'Enlace' } }, defaultItemProps: { label: 'Enlace', href: '#' }, getItemSummary: (item) => item.label || 'Enlace' },
        backgroundColor: { type: 'text', label: 'Fondo' }, textColor: { type: 'text', label: 'Texto' },
      },
      defaultProps: { brand: 'Tu marca', description: 'Una frase corta que resume lo que haces y para quién.', copyright: '© 2026 Tu marca. Todos los derechos reservados.', links: [{ label: 'Privacidad', href: '#' }, { label: 'Términos', href: '#' }, { label: 'Contacto', href: '#contacto' }], backgroundColor: '#0f172a', textColor: '#ffffff' },
      render: ({ brand, description, copyright, links, backgroundColor, textColor }) => (
        <footer className="px-5 py-12 lg:px-8" style={{ backgroundColor: backgroundColor || '#0f172a', color: textColor || '#ffffff' }}><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-8 md:flex-row"><div className="max-w-md"><div className="text-xl font-semibold">{brand}</div><p className="mt-3 leading-7 opacity-65">{description}</p></div><nav className="flex flex-wrap items-start gap-x-6 gap-y-3">{(Array.isArray(links) ? links : []).map((link, index) => <a key={`${link.href}-${index}`} href={link.href || '#'} className="text-sm opacity-70 hover:opacity-100">{link.label}</a>)}</nav></div><div className="mt-10 border-t border-current/15 pt-6 text-sm opacity-55">{copyright}</div></div></footer>
      ),
    },
  },
}