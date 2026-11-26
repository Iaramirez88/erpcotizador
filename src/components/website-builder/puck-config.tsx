import type { Config, CustomField } from '@puckeditor/core'
import { WebsiteLeadForm } from '@/components/website-builder/website-lead-form'
import { WebsiteAccordion, WebsiteCarousel, WebsiteCountdown, WebsitePricing, WebsiteTabs } from '@/components/website-builder/website-interactive-blocks'
import { WebsiteMediaField } from '@/components/website-builder/website-media-field'
import { resolveSafeWebsiteEmbed, sanitizeWebsiteLinkHref } from '@/lib/website-embed'
import {
  BadgeDollarSign,
  BarChart3,
  Building2,
  ChevronsDownUp,
  Code2,
  CodeXml,
  Columns2,
  Frame,
  GalleryHorizontalEnd,
  Heading1,
  HelpCircle,
  Image,
  Images,
  LayoutGrid,
  Mail,
  MapPin,
  Menu,
  MousePointerClick,
  MoveVertical,
  PanelBottom,
  PanelsTopLeft,
  Quote,
  Square,
  Tags,
  Timer,
  Type,
  Users,
  Video,
} from 'lucide-react'

export const WEBSITE_BUILDER_BLOCK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  HeroBlock: Heading1,
  TextBlock: Type,
  ImageBlock: Image,
  VideoBlock: Video,
  CtaBlock: MousePointerClick,
  SpacerBlock: MoveVertical,
  ResponsiveBlock: Frame,
  SectionBlock: Square,
  ColumnsBlock: Columns2,
  TabsBlock: PanelsTopLeft,
  AccordionBlock: ChevronsDownUp,
  GalleryBlock: Images,
  CarouselBlock: GalleryHorizontalEnd,
  FeaturesBlock: LayoutGrid,
  StatsBlock: BarChart3,
  TeamBlock: Users,
  LogosBlock: Building2,
  TestimonialsBlock: Quote,
  FaqBlock: HelpCircle,
  CountdownBlock: Timer,
  MapBlock: MapPin,
  EmbedBlock: Code2,
  PricingBlock: Tags,
  PricingToggleBlock: BadgeDollarSign,
  ContactFormBlock: Mail,
  NavbarBlock: Menu,
  FooterBlock: PanelBottom,
  CustomHtmlBlock: CodeXml,
}

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

function dateTimeField(label: string): CustomField<string> {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange, readOnly }) => (
      <input
        type="datetime-local"
        value={value || ''}
        disabled={readOnly}
        onChange={(event) => onChange(event.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', color: '#0f172a', background: '#fff' }}
      />
    ),
  }
}

function parseDimension(value: string): { value: string; unit: string } {
  const match = /^(-?\d*\.?\d+)\s*(px|em|rem|%|vw|vh)?$/.exec(String(value || '').trim())
  if (match) return { value: match[1], unit: match[2] || 'px' }
  return { value: '', unit: 'px' }
}

function dimensionField(label: string, units: string[] = ['px', 'em', 'rem', '%', 'vw']): CustomField<string> {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange, readOnly }) => {
      const parsed = parseDimension(String(value ?? ''))
      const controlStyle: React.CSSProperties = { padding: '7px 9px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13, color: '#0f172a', background: '#fff' }
      return (
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="number" value={parsed.value} disabled={readOnly} onChange={(e) => onChange(`${e.target.value}${parsed.unit}`)} style={{ ...controlStyle, flex: 1, minWidth: 0 }} />
          <select value={parsed.unit} disabled={readOnly} onChange={(e) => onChange(`${parsed.value}${e.target.value}`)} style={{ ...controlStyle, width: 66 }}>
            {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </div>
      )
    },
  }
}

function styleDimension(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function advancedStyleFields() {
  return {
    contentMaxWidth: dimensionField('Ancho máximo del contenido', ['px', '%', 'vw', 'em', 'rem']),
    minHeight: dimensionField('Altura mínima', ['px', 'vh', '%', 'em', 'rem']),
    paddingTop: dimensionField('Padding arriba'),
    paddingRight: dimensionField('Padding derecha'),
    paddingBottom: dimensionField('Padding abajo'),
    paddingLeft: dimensionField('Padding izquierda'),
    marginTop: dimensionField('Margen arriba'),
    marginRight: dimensionField('Margen derecha'),
    marginBottom: dimensionField('Margen abajo'),
    marginLeft: dimensionField('Margen izquierda'),
    columnGap: dimensionField('Espacio entre columnas'),
    borderWidth: { type: 'number' as const, label: 'Grosor del borde', min: 0, max: 20, step: 1 },
    borderStyle: { type: 'select' as const, label: 'Estilo del borde', options: [{ label: 'Ninguno', value: 'none' }, { label: 'Sólido', value: 'solid' }, { label: 'Punteado', value: 'dashed' }, { label: 'Puntos', value: 'dotted' }] },
    borderColor: { type: 'text' as const, label: 'Color del borde' },
    borderRadius: dimensionField('Radio del borde'),
  }
}

function buildAdvancedStyle(props: unknown): React.CSSProperties {
  const style: React.CSSProperties = {}
  const p = (props ?? {}) as Record<string, unknown>
  const dim = styleDimension
  if (dim(p.contentMaxWidth)) style.maxWidth = dim(p.contentMaxWidth)
  if (dim(p.minHeight)) style.minHeight = dim(p.minHeight)
  if (dim(p.paddingTop)) style.paddingTop = dim(p.paddingTop)
  if (dim(p.paddingRight)) style.paddingRight = dim(p.paddingRight)
  if (dim(p.paddingBottom)) style.paddingBottom = dim(p.paddingBottom)
  if (dim(p.paddingLeft)) style.paddingLeft = dim(p.paddingLeft)
  if (dim(p.marginTop)) style.marginTop = dim(p.marginTop)
  if (dim(p.marginRight)) style.marginRight = dim(p.marginRight)
  if (dim(p.marginBottom)) style.marginBottom = dim(p.marginBottom)
  if (dim(p.marginLeft)) style.marginLeft = dim(p.marginLeft)

  const borderWidth = Number(p.borderWidth)
  const borderStyle = dim(p.borderStyle)
  if (borderWidth > 0 && borderStyle && borderStyle !== 'none') {
    style.borderWidth = `${borderWidth}px`
    style.borderStyle = borderStyle as React.CSSProperties['borderStyle']
    style.borderColor = dim(p.borderColor) || '#e2e8f0'
  }
  if (dim(p.borderRadius)) style.borderRadius = dim(p.borderRadius)

  return style
}

function typographyStyleFields() {
  return {
    fontSize: dimensionField('Tamaño de fuente', ['px', 'em', 'rem']),
    lineHeight: { type: 'number' as const, label: 'Altura de línea', min: 1, max: 3, step: 0.1 },
    letterSpacing: dimensionField('Espacio entre letras', ['px', 'em', 'rem']),
    wordSpacing: dimensionField('Espacio entre palabras', ['px', 'em', 'rem']),
    fontWeight: { type: 'select' as const, label: 'Peso de fuente', options: [{ label: 'Normal', value: 400 }, { label: 'Medio', value: 500 }, { label: 'Seminegrita', value: 600 }, { label: 'Negrita', value: 700 }, { label: 'Extra negrita', value: 800 }] },
  }
}

function buildTypographyStyle(props: unknown): React.CSSProperties {
  const style: React.CSSProperties = {}
  const p = (props ?? {}) as Record<string, unknown>
  const dim = styleDimension
  if (dim(p.fontSize)) style.fontSize = dim(p.fontSize)
  const lineHeight = Number(p.lineHeight)
  if (lineHeight) style.lineHeight = lineHeight
  if (dim(p.letterSpacing)) style.letterSpacing = dim(p.letterSpacing)
  if (dim(p.wordSpacing)) style.wordSpacing = dim(p.wordSpacing)
  const fontWeight = Number(p.fontWeight)
  if (fontWeight) style.fontWeight = fontWeight
  return style
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
    basico: { title: 'Básico', components: ['HeroBlock', 'TextBlock', 'ImageBlock', 'VideoBlock', 'CtaBlock', 'SpacerBlock'] },
    disposicion: { title: 'Disposición', components: ['ResponsiveBlock', 'SectionBlock', 'ColumnsBlock', 'GridBlock'] },
    general: { title: 'General', components: ['TabsBlock', 'AccordionBlock', 'GalleryBlock', 'CarouselBlock', 'FeaturesBlock', 'StatsBlock', 'TeamBlock', 'LogosBlock', 'TestimonialsBlock', 'FaqBlock', 'CountdownBlock', 'MapBlock', 'EmbedBlock'] },
    conversion: { title: 'Conversión', components: ['PricingBlock', 'PricingToggleBlock', 'ContactFormBlock'] },
    navegacion: { title: 'Navegación', components: ['NavbarBlock', 'FooterBlock'] },
    avanzado: { title: 'Avanzado', components: ['CustomHtmlBlock'] },
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
                    <a href={sanitizeWebsiteLinkHref(ctaHref)} className={`inline-flex rounded-full px-5 py-2.5 text-sm font-semibold ${toneClasses.button}`}>
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
        ...advancedStyleFields(),
        ...typographyStyleFields(),
      },
      render: (props) => {
        const { eyebrow, title, description, tone = 'white', contentWidth = 'xl', content: Content } = props
        const style = { ...buildAdvancedStyle(props), ...buildTypographyStyle(props) }
        return (
          <section className={`rounded-[32px] px-6 py-8 sm:px-8 sm:py-10 ${getSurfaceToneClasses(tone as SurfaceTone)}`} style={style}>
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
        )
      },
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
        ...advancedStyleFields(),
        ...typographyStyleFields(),
      },
      render: (props) => {
        const { title, body, alignment = 'left', width = 'lg' } = props
        const advanced = buildAdvancedStyle(props)
        const typography = buildTypographyStyle(props)
        return (
          <section className="rounded-[28px] border border-slate-200 bg-white px-8 py-10 shadow-sm" style={advanced}>
            <div className={`mx-auto flex flex-col ${getAlignmentClass(alignment as Alignment)} ${getWidthClass(width as WidthScale)}`} style={typography}>
              {title ? <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2> : null}
              <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-slate-600">{body || 'Agrega aquí el contenido principal de la sección.'}</p>
            </div>
          </section>
        )
      },
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
              <a href={sanitizeWebsiteLinkHref(buttonHref)} className="mt-6 inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">
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
              {(Array.isArray(links) ? links : []).map((link, index) => <a key={`${link.href}-${index}`} href={sanitizeWebsiteLinkHref(link.href)} className="text-sm font-medium opacity-75 hover:opacity-100">{link.label}</a>)}
            </nav>
            {buttonLabel ? <a href={sanitizeWebsiteLinkHref(buttonHref)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">{buttonLabel}</a> : null}
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
        <section style={sectionStyle(backgroundColor as string, textColor as string, paddingY as number)}><div className="mx-auto max-w-7xl px-5 lg:px-8">{sectionHeading(eyebrow as string, title as string, description as string)}<div className="grid gap-5 lg:grid-cols-3">{(Array.isArray(plans) ? plans : []).map((plan, index) => <article key={`${plan.name}-${index}`} className={`rounded-lg border p-7 ${plan.featured === 'yes' ? 'border-transparent text-white shadow-xl' : 'border-current/10 bg-white text-slate-950 shadow-sm'}`} style={plan.featured === 'yes' ? { backgroundColor: accentColor || '#2563eb' } : undefined}><h3 className="text-xl font-semibold">{plan.name}</h3><div className="mt-5"><span className="text-4xl font-semibold">{plan.price}</span><span className="ml-1 opacity-65">{plan.period}</span></div><ul className="mt-6 space-y-3 text-sm">{String(plan.features || '').split('\n').filter(Boolean).map((feature, featureIndex) => <li key={featureIndex} className="flex gap-2"><span>✓</span><span>{feature}</span></li>)}</ul><a href={sanitizeWebsiteLinkHref(plan.buttonHref)} className={`mt-8 inline-flex w-full justify-center rounded-lg px-4 py-3 text-sm font-semibold ${plan.featured === 'yes' ? 'bg-white text-slate-950' : 'bg-slate-950 text-white'}`}>{plan.buttonLabel || 'Elegir'}</a></article>)}</div></div></section>
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
    PricingToggleBlock: {
      label: 'Precios (mensual/anual)',
      fields: {
        eyebrow: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' },
        annualDiscount: { type: 'number', label: 'Descuento anual (%)', min: 0, max: 90, step: 5 },
        plans: {
          type: 'array', label: 'Planes',
          arrayFields: {
            name: { type: 'text', label: 'Nombre' },
            tag: { type: 'text', label: 'Etiqueta' },
            monthlyPrice: { type: 'number', label: 'Precio mensual (COP)' },
            features: { type: 'textarea', label: 'Características (una por línea)' },
            buttonLabel: { type: 'text', label: 'Botón' },
            buttonHref: { type: 'text', label: 'Enlace' },
            featured: { type: 'radio', label: 'Destacado', options: [{ label: 'No', value: 'no' }, { label: 'Sí', value: 'yes' }] },
          },
          defaultItemProps: { name: 'Plan', tag: '', monthlyPrice: 0, features: 'Característica uno\nCaracterística dos', buttonLabel: 'Solicitar demo', buttonHref: '#contacto', featured: 'no' },
          getItemSummary: (item) => item.name || 'Plan',
        },
        accentColor: { type: 'text', label: 'Color de acento' }, backgroundColor: { type: 'text', label: 'Fondo' }, textColor: { type: 'text', label: 'Texto' },
      },
      defaultProps: { eyebrow: 'Planes', title: 'Un plan para cada momento de tu negocio', description: '', annualDiscount: 10, plans: [{ name: 'Básico', tag: '', monthlyPrice: 295000, features: '2 usuarios\n1 sede\n500 clientes · 200 productos', buttonLabel: 'Solicitar demo', buttonHref: '#contacto', featured: 'no' }], accentColor: '#c9ff4a', backgroundColor: '#ffffff', textColor: '#263719' },
      render: ({ eyebrow, title, description, annualDiscount, plans, accentColor, backgroundColor, textColor }) => (
        <WebsitePricing plans={Array.isArray(plans) ? plans : []} annualDiscount={annualDiscount as number} eyebrow={eyebrow as string} title={title as string} description={description as string} accentColor={accentColor as string} backgroundColor={backgroundColor as string} textColor={textColor as string} />
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
      render: ({ title, address, height, backgroundColor }) => <section className="px-5 py-14 lg:px-8" style={{ backgroundColor: backgroundColor || '#f8fafc' }}><div className="mx-auto max-w-7xl">{title ? <h2 className="mb-7 text-3xl font-semibold text-slate-950">{title}</h2> : null}<iframe title={title as string || 'Ubicación'} src={`https://www.google.com/maps?q=${encodeURIComponent(String(address || ''))}&output=embed`} loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="no-referrer" className="w-full rounded-lg border-0" style={{ height: `${Math.min(Math.max(Number(height) || 420, 240), 720)}px` }} /></div></section>,
    },
    EmbedBlock: {
      label: 'Embed seguro',
      fields: {
        title: { type: 'text', label: 'Título accesible' },
        embedUrl: { type: 'text', label: 'URL de YouTube, Vimeo, Maps, Figma o CodePen' },
        height: { type: 'number', label: 'Altura', min: 240, max: 900, step: 20 },
        backgroundColor: { type: 'text', label: 'Fondo' },
      },
      defaultProps: { title: 'Contenido externo', embedUrl: '', height: 480, backgroundColor: '#ffffff' },
      render: ({ title, embedUrl, height, backgroundColor }) => {
        const embed = resolveSafeWebsiteEmbed(embedUrl)
        const safeHeight = Math.min(Math.max(Number(height) || 480, 240), 900)
        return (
          <section className="px-5 py-14 lg:px-8" style={{ backgroundColor: backgroundColor || '#ffffff' }}>
            <div className="mx-auto max-w-6xl">
              {embed ? (
                <iframe
                  title={String(title || 'Contenido externo')}
                  src={embed.src}
                  sandbox={embed.sandbox}
                  allow={embed.allow}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full rounded-lg border border-slate-200 bg-white"
                  style={{ height: `${safeHeight}px` }}
                />
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-600" style={{ height: `${safeHeight}px` }}>
                  Agrega una URL HTTPS compatible de YouTube, Vimeo, Google Maps, Figma o CodePen.
                </div>
              )}
            </div>
          </section>
        )
      },
    },
    TabsBlock: {
      label: 'Pestañas',
      fields: {
        title: { type: 'text', label: 'Título' }, items: { type: 'array', label: 'Pestañas', arrayFields: { label: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' }, content: { type: 'textarea', label: 'Contenido' } }, defaultItemProps: { label: 'Pestaña', title: 'Nuevo contenido', content: '' }, getItemSummary: (item) => item.label || 'Pestaña' }, accentColor: { type: 'text', label: 'Acento' }, backgroundColor: { type: 'text', label: 'Fondo' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: { title: 'Explora en detalle', items: [{ label: 'Servicio', title: 'Qué hacemos', content: 'Explica aquí tu servicio principal.' }, { label: 'Proceso', title: 'Cómo trabajamos', content: 'Describe las etapas de trabajo.' }], accentColor: '#2563eb', backgroundColor: '#ffffff', paddingY: 64 },
      render: ({ title, items, accentColor, backgroundColor, paddingY }) => <section style={sectionStyle(backgroundColor as string, '#0f172a', paddingY as number)}><div className="mx-auto max-w-5xl px-5 lg:px-8">{title ? <h2 className="mb-8 text-3xl font-semibold">{title}</h2> : null}<WebsiteTabs items={Array.isArray(items) ? items : []} accentColor={accentColor as string} /></div></section>,
    },
    AccordionBlock: {
      label: 'Acordeón',
      fields: {
        eyebrow: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' },
        items: { type: 'array', label: 'Elementos', arrayFields: { title: { type: 'text', label: 'Título' }, content: { type: 'textarea', label: 'Contenido' } }, defaultItemProps: { title: 'Nuevo elemento', content: 'Escribe aquí el contenido.' }, getItemSummary: (item) => item.title || 'Elemento' },
        accentColor: { type: 'text', label: 'Color de acento' }, backgroundColor: { type: 'text', label: 'Fondo' }, textColor: { type: 'text', label: 'Texto' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: { eyebrow: 'Detalles', title: 'Información adicional', description: '', items: [{ title: '¿Cómo funciona?', content: 'Explica el proceso paso a paso.' }, { title: '¿Qué incluye?', content: 'Resume el alcance de tu oferta.' }], accentColor: '#2563eb', backgroundColor: '#f8fafc', textColor: '#0f172a', paddingY: 72 },
      render: ({ eyebrow, title, description, items, accentColor, backgroundColor, textColor, paddingY }) => (
        <section style={sectionStyle(backgroundColor as string, textColor as string, paddingY as number)}><div className="mx-auto max-w-3xl px-5 lg:px-8">{sectionHeading(eyebrow as string, title as string, description as string)}<WebsiteAccordion items={Array.isArray(items) ? items : []} accentColor={accentColor as string} /></div></section>
      ),
    },
    TeamBlock: {
      label: 'Equipo',
      fields: {
        eyebrow: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' },
        columns: { type: 'select', label: 'Columnas', options: [{ label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }] },
        members: { type: 'array', label: 'Miembros', arrayFields: { name: { type: 'text', label: 'Nombre' }, role: { type: 'text', label: 'Cargo' }, photoUrl: mediaField('Foto', ['image']), bio: { type: 'textarea', label: 'Biografía' } }, defaultItemProps: { name: 'Nombre', role: 'Cargo', photoUrl: '', bio: '' }, getItemSummary: (item) => item.name || 'Miembro' },
        backgroundColor: { type: 'text', label: 'Fondo' }, textColor: { type: 'text', label: 'Texto' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: { eyebrow: 'Equipo', title: 'Las personas detrás', description: '', columns: 3, members: [{ name: 'Ana Pérez', role: 'Directora', photoUrl: '', bio: '' }], backgroundColor: '#ffffff', textColor: '#0f172a', paddingY: 72 },
      render: ({ eyebrow, title, description, columns = 3, members, backgroundColor, textColor, paddingY }) => (
        <section style={sectionStyle(backgroundColor as string, textColor as string, paddingY as number)}><div className="mx-auto max-w-7xl px-5 lg:px-8">{sectionHeading(eyebrow as string, title as string, description as string)}<div className={`grid gap-6 ${Number(columns) === 2 ? 'sm:grid-cols-2' : Number(columns) === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>{(Array.isArray(members) ? members : []).map((member, index) => <article key={`${member.name}-${index}`} className="rounded-xl border border-current/10 bg-white p-6 text-center text-slate-950">{member.photoUrl ? <img src={member.photoUrl} alt={member.name} className="mx-auto h-24 w-24 rounded-full object-cover" /> : <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-400">{String(member.name || '?').charAt(0)}</div>}<h3 className="mt-5 text-lg font-semibold">{member.name}</h3><div className="text-sm font-medium text-blue-600">{member.role}</div>{member.bio ? <p className="mt-3 text-sm leading-6 text-slate-500">{member.bio}</p> : null}</article>)}</div></div></section>
      ),
    },
    LogosBlock: {
      label: 'Logos de clientes',
      fields: {
        eyebrow: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' },
        logos: { type: 'array', label: 'Logos', arrayFields: { imageUrl: mediaField('Logo', ['image']), name: { type: 'text', label: 'Nombre' }, link: { type: 'text', label: 'Enlace (opcional)' } }, defaultItemProps: { imageUrl: '', name: '', link: '' }, getItemSummary: (item) => item.name || 'Logo' },
        backgroundColor: { type: 'text', label: 'Fondo' }, textColor: { type: 'text', label: 'Texto' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 120, step: 8 },
      },
      defaultProps: { eyebrow: 'Clientes', title: 'Ellos confían en nosotros', logos: [{ imageUrl: '', name: 'Logo 1', link: '' }], backgroundColor: '#ffffff', textColor: '#0f172a', paddingY: 64 },
      render: ({ eyebrow, title, logos, backgroundColor, textColor, paddingY }) => (
        <section style={sectionStyle(backgroundColor as string, textColor as string, paddingY as number)}><div className="mx-auto max-w-7xl px-5 lg:px-8">{sectionHeading(eyebrow as string, title as string, undefined)}<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{(Array.isArray(logos) ? logos : []).map((logo, index) => { const content = logo.imageUrl ? <img src={logo.imageUrl} alt={logo.name || 'Logo'} className="h-10 w-auto max-w-full object-contain opacity-80" /> : <div className="text-sm font-semibold text-slate-400">{logo.name || 'Logo'}</div>; return logo.link ? <a key={`${logo.name}-${index}`} href={sanitizeWebsiteLinkHref(logo.link)} className="flex items-center justify-center rounded-lg border border-current/10 bg-white p-5 grayscale transition hover:grayscale-0">{content}</a> : <div key={`${logo.name}-${index}`} className="flex items-center justify-center rounded-lg border border-current/10 bg-white p-5 grayscale transition hover:grayscale-0">{content}</div>; })}</div></div></section>
      ),
    },
    CountdownBlock: {
      label: 'Cuenta regresiva',
      fields: {
        eyebrow: { type: 'text', label: 'Etiqueta' }, title: { type: 'text', label: 'Título' }, description: { type: 'textarea', label: 'Descripción' },
        targetDate: dateTimeField('Fecha objetivo'),
        accentColor: { type: 'text', label: 'Color de acento' }, backgroundColor: { type: 'text', label: 'Fondo' }, textColor: { type: 'text', label: 'Texto' }, paddingY: { type: 'number', label: 'Espaciado vertical', min: 16, max: 160, step: 8 },
      },
      defaultProps: { eyebrow: 'Próximamente', title: 'El lanzamiento está cerca', description: '', targetDate: '', accentColor: '#2563eb', backgroundColor: '#0f172a', textColor: '#ffffff', paddingY: 80 },
      render: ({ eyebrow, title, description, targetDate, accentColor, backgroundColor, textColor, paddingY }) => (
        <section style={sectionStyle(backgroundColor as string, textColor as string, paddingY as number)}><div className="mx-auto max-w-4xl px-5 text-center lg:px-8">{sectionHeading(eyebrow as string, title as string, description as string)}<WebsiteCountdown targetDate={targetDate as string} accentColor={accentColor as string} /></div></section>
      ),
    },
    CustomHtmlBlock: {
      label: 'HTML personalizado',
      fields: {
        html: { type: 'textarea', label: 'HTML (admite <style> inline)' },
      },
      defaultProps: { html: '<div style="padding:48px;text-align:center;border:1px dashed #cbd5e1;border-radius:12px">Pega aquí tu HTML personalizado.</div>' },
      render: ({ html }) => <div dangerouslySetInnerHTML={{ __html: String(html || '') }} />,
    },
    GridBlock: {
      label: 'Grid de columnas',
      fields: {
        columns: { type: 'select', label: 'Columnas', options: [{ label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }] },
        gap: { type: 'number', label: 'Separación (px)', min: 12, max: 64, step: 4 },
        backgroundColor: { type: 'text', label: 'Color de fondo' },
        ...advancedStyleFields(),
        column1: { type: 'slot', label: 'Columna 1' },
        column2: { type: 'slot', label: 'Columna 2' },
        column3: { type: 'slot', label: 'Columna 3' },
        column4: { type: 'slot', label: 'Columna 4' },
      },
      defaultProps: { columns: 2, gap: 24, backgroundColor: 'transparent' },
      render: (props) => {
        const { columns = 2, gap = 24, backgroundColor, column1: Col1, column2: Col2, column3: Col3, column4: Col4 } = props
        const advanced = buildAdvancedStyle(props)
        const cols = Math.min(Math.max(Number(columns) || 2, 2), 4)
        const cells = [Col1, Col2, Col3, Col4].slice(0, cols)
        const gridClass = cols === 2 ? 'md:grid-cols-2' : cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'
        const gapValue = styleDimension(props.columnGap) || `${Math.min(Math.max(Number(gap) || 24, 12), 64)}px`
        return (
          <section style={{ backgroundColor: backgroundColor || 'transparent', ...advanced }}>
            <div className={`grid grid-cols-1 ${gridClass}`} style={{ gap: gapValue }}>
              {cells.map((Cell, index) => (
                <div key={index} className="min-w-0">
                  {Cell ? <Cell className="min-h-[120px] rounded-[16px] border border-dashed border-slate-300/80 p-3" /> : <div className="flex min-h-[120px] items-center justify-center rounded-[16px] border border-dashed border-slate-300/70 text-sm text-slate-400">Columna {index + 1}</div>}
                </div>
              ))}
            </div>
          </section>
        )
      },
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
        <footer className="px-5 py-12 lg:px-8" style={{ backgroundColor: backgroundColor || '#0f172a', color: textColor || '#ffffff' }}><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-8 md:flex-row"><div className="max-w-md"><div className="text-xl font-semibold">{brand}</div><p className="mt-3 leading-7 opacity-65">{description}</p></div><nav className="flex flex-wrap items-start gap-x-6 gap-y-3">{(Array.isArray(links) ? links : []).map((link, index) => <a key={`${link.href}-${index}`} href={sanitizeWebsiteLinkHref(link.href)} className="text-sm opacity-70 hover:opacity-100">{link.label}</a>)}</nav></div><div className="mt-10 border-t border-current/15 pt-6 text-sm opacity-55">{copyright}</div></div></footer>
      ),
    },
  },
}