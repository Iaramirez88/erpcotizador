import { readFileSync } from 'fs'
import path from 'path'
import { PrismaClient } from '.prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

type BlockProps = Record<string, unknown>

function block(type: string, id: string, props: BlockProps) {
  return { type, props: { id, ...props } }
}

function pageData(rootProps: BlockProps, content: ReturnType<typeof block>[]) {
  return { root: { props: rootProps }, content }
}

function readJoinclapCss() {
  return readFileSync(path.resolve(process.cwd(), 'src/app/joinclap.css'), 'utf8')
}

// El HTML estático no ejecuta useJoinclapEffects, así que forzamos visible el .reveal
// y arreglamos el borde del footer blanco del chrome.
const EXTRA_CSS = [
  '.jc .reveal{filter:none!important;opacity:1!important;transform:none!important}',
  '.jc-site main .jc{min-height:0!important}',
  '.jc-site main .jc:before{display:none!important}',
  '.jc-site .jc-site-footer-copy{border-top-color:rgba(0,0,0,.12)!important}',
].join('\n')

const YEAR_JS = `(function(){var y=document.getElementById('year');if(y){y.textContent=String(new Date().getFullYear())}})()`

const INK = '#263719'
const LIME = '#c9ff4a'

const themeJson = {
  theme: {
    backgroundColor: '#ffffff',
    textColor: INK,
    fontFamily: 'Manrope, system-ui, sans-serif',
    headingFontFamily: '',
    accentColor: LIME,
    buttonRadius: 3,
    containerMaxWidth: 1240,
  },
  header: {
    enabled: true,
    brand: 'Joinclap',
    logoUrl: '/brand/logo-joinclap.png',
    links: [
      { label: 'Plataforma', href: '/#plataforma' },
      { label: 'Red operativa', href: '/#red' },
      { label: 'Inteligencia artificial', href: '/#ia' },
      { label: 'Cómo funciona', href: '/#como-funciona' },
      { label: 'Precios', href: '/precios' },
      { label: 'Iniciar sesión', href: '/auth/login' },
    ],
    buttonLabel: 'Solicitar demo',
    buttonHref: '/#contacto',
    sticky: false,
    backgroundColor: '#ffffff',
    textColor: INK,
  },
  footer: {
    enabled: true,
    brand: 'Joinclap',
    description: 'ERP + CRM + Red Operativa con IA integrada',
    copyright: '© 2026 Joinclap. Todos los derechos reservados.',
    links: [
      { label: 'Precios', href: '/precios' },
      { label: 'Documentación', href: '/documentacion' },
      { label: 'Contacto', href: '/#contacto' },
      { label: 'Términos de servicio', href: '/terminos-de-servicio' },
      { label: 'Política de privacidad', href: '/politica-de-privacidad' },
      { label: 'Garantía de devolución', href: '/garantia-de-devolucion' },
      { label: 'Política de reembolso', href: '/politica-de-reembolso' },
    ],
    backgroundColor: '#ffffff',
    textColor: INK,
  },
  customCss: `${readJoinclapCss()}\n${EXTRA_CSS}`,
  customJsHead: '',
  customJsBody: YEAR_JS,
}

const HERO_HTML = `<section class="hero" id="hero">
  <div class="hero-3d-scene" aria-hidden="true">
    <div class="scene-grid"></div>
    <div class="scene-orbit orbit-a"></div>
    <div class="scene-orbit orbit-b"></div>
    <div class="scene-core"><div class="core-inner">J<span>·</span></div></div>
    <div class="scene-cube cube-a"><span>CRM</span></div>
    <div class="scene-cube cube-b"><span>ERP</span></div>
    <div class="scene-cube cube-c"><span>AI</span></div>
    <div class="scene-chip chip-a">CLIENTES <b>+128</b></div>
    <div class="scene-chip chip-b">OPERACIÓN <b>EN VIVO</b></div>
  </div>
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow mono">Una nueva forma de operar</div>
      <h1><span class="line">Tu negocio.</span><span class="line accent">Todo conectado.</span></h1>
      <p class="hero-copy">Joinclap reúne clientes, ventas, inventario, equipos y procesos en una sola plataforma. Un ERP + CRM que trabaja contigo y una red operativa impulsada por inteligencia artificial.</p>
      <div class="hero-actions"><a class="btn magnetic" href="#contacto">Conoce Joinclap <span>↗</span></a><a class="text-link" href="#plataforma">Explorar la plataforma ↓</a></div>
    </div>
    <div class="hero-visual" aria-label="Vista conceptual del panel de Joinclap">
      <div class="orb"></div>
      <div class="dashboard">
        <div class="dash-top"><div class="dash-brand">joinclap<span class="lime">.</span> <span style="color:#8c9584;font-weight:400">workspace</span></div><div class="live">SISTEMA ACTIVO</div></div>
        <div class="dash-title">Resumen de operación</div><div class="dash-sub">Una vista clara de lo que mueve tu negocio</div>
        <div class="metric-grid">
          <div class="metric"><small>Oportunidades</small><strong>128</strong><em>↗ En seguimiento</em></div>
          <div class="metric"><small>Órdenes activas</small><strong>36</strong><em>● En proceso</em></div>
          <div class="metric"><small>Equipo</small><strong>12</strong><em>● Conectado</em></div>
        </div>
        <div class="dash-bottom">
          <div class="chart"><div class="chart-title">Actividad operativa</div><div class="bars"><i style="height:38%"></i><i style="height:58%"></i><i style="height:48%"></i><i style="height:76%"></i><i style="height:62%"></i><i style="height:92%"></i><i style="height:82%"></i><i style="height:100%"></i></div></div>
          <div class="activity"><div class="chart-title">Actividad reciente</div><div class="activity-row"><span class="dot">↗</span> Nueva oportunidad</div><div class="activity-row"><span class="dot">✓</span> Orden actualizada</div><div class="activity-row"><span class="dot">✦</span> Sugerencia IA</div></div>
        </div>
      </div>
      <div class="float-tag tag-one">✦ <b>IA integrada</b> · lista para ayudarte</div><div class="float-tag tag-two">↗ <b>Todo conectado</b> · un solo lugar</div>
    </div>
  </div>
  <div class="scroll-note mono"><span class="scroll-line"></span> DESLIZA PARA DESCUBRIR <span class="scroll-line"></span></div>
</section>`

const INTRO_HTML = `<section class="intro" id="plataforma">
  <div class="wrap">
    <div class="section-head reveal"><div class="mono">01 / La plataforma</div><div><h2>Menos herramientas aisladas. <span class="lime">Más negocio en movimiento.</span></h2><p>Deja de perseguir información entre aplicaciones. Joinclap conecta las áreas de tu empresa para que cada persona sepa qué hacer y cada proceso tenga continuidad.</p></div></div>
    <div class="feature-stack">
      <article class="feature-card reveal"><div class="feature-num">01</div><div><div class="feature-icon">◎</div><h3>CRM & ventas</h3></div><p>Centraliza clientes, conversaciones, oportunidades, cotizaciones y seguimiento comercial. Convierte cada contacto en una relación que avanza.</p></article>
      <article class="feature-card reveal"><div class="feature-num">02</div><div><div class="feature-icon">▦</div><h3>Inventario & operaciones</h3></div><p>Controla productos, existencias, movimientos y sedes. Mantén la información operativa conectada con las decisiones de tu equipo.</p></article>
      <article class="feature-card reveal"><div class="feature-num">03</div><div><div class="feature-icon">↗</div><h3>Órdenes & producción</h3></div><p>Organiza órdenes de trabajo, tareas, proyectos y tiempos. Sigue cada trabajo desde que entra hasta que se entrega.</p></article>
      <article class="feature-card reveal"><div class="feature-num">04</div><div><div class="feature-icon">⌘</div><h3>Equipo & gestión</h3></div><p>Asigna responsables, coordina actividades y consulta el estado de la operación con una visión compartida del negocio.</p></article>
    </div>
  </div>
</section>`

const NETWORK_HTML = `<section class="network" id="red">
  <div class="wrap network-grid">
    <div class="reveal"><div class="mono">02 / Red operativa</div><h2>No solo conectamos áreas. <span class="lime">Conectamos negocios.</span></h2><p>Joinclap evoluciona más allá de un ERP tradicional: una red operativa donde empresas, equipos y aliados pueden coordinar actividades, compartir oportunidades y construir relaciones de trabajo.</p><p>Un espacio para que las PYMES no tengan que crecer solas.</p><a class="text-link" href="#contacto">Descubre la red operativa ↗</a></div>
    <div class="network-visual reveal"><div class="connector"></div><div class="node center">joinclap.</div><div class="node n1">⌂</div><div class="node n2">◎</div><div class="node n3">▦</div><div class="node n4">↗</div></div>
  </div>
</section>`

const AI_HTML = `<section class="ai" id="ia">
  <div class="wrap ai-layout">
    <div class="ai-panel reveal">
      <div class="ai-head"><b style="font-size:13px">Joinclap Intelligence</b><span class="ai-pill">✦ IA INTEGRADA</span></div>
      <div class="chat">
        <div class="bubble user">¿Qué oportunidades necesitan seguimiento hoy?</div>
        <div class="bubble ai">He identificado 8 oportunidades sin actividad reciente. Tres tienen alta probabilidad de cierre. ¿Quieres priorizarlas por valor y fecha de contacto?</div>
        <div class="bubble user">Sí, organiza mi lista.</div>
        <div class="bubble ai">Listo para preparar una vista priorizada con próximos pasos sugeridos.</div>
      </div>
    </div>
    <div class="reveal"><div class="mono">03 / Inteligencia artificial</div><h2>Tu operación también puede <span class="lime">pensar contigo.</span></h2><p>La IA de Joinclap está pensada para ayudarte a consultar información, encontrar patrones, agilizar tareas y tomar mejores decisiones desde el contexto real de tu empresa.</p><div class="ai-points"><div class="ai-point"><b>Asistencia contextual</b><span>Respuestas basadas en la información de tu operación.</span></div><div class="ai-point"><b>Menos tareas manuales</b><span>Apoyo para organizar, resumir y acelerar procesos.</span></div><div class="ai-point"><b>Mejores decisiones</b><span>Información más clara para actuar a tiempo.</span></div><div class="ai-point"><b>Un sistema que evoluciona</b><span>La inteligencia conectada con tus flujos de trabajo.</span></div></div></div>
  </div>
</section>`

const PHOTO_HTML = `<section class="photo-band">
  <div class="wrap"><div class="photo"><img class="parallax" src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=85" alt="Equipo de trabajo colaborando alrededor de una mesa" loading="lazy" /><div class="photo-caption"><div class="mono">Una visión compartida</div><h2>El trabajo fluye cuando todo está conectado.</h2><p>Personas, información y procesos avanzando en la misma dirección.</p></div></div></div>
</section>`

const STEPS_HTML = `<section class="steps" id="como-funciona">
  <div class="wrap"><div class="section-head reveal"><div class="mono">04 / Empieza a avanzar</div><div><h2>Una plataforma que crece <span class="lime">contigo.</span></h2><p>Empieza por lo que tu empresa necesita hoy. Conecta nuevas áreas y capacidades a medida que tu operación evoluciona.</p></div></div>
    <div class="steps-grid"><article class="step reveal"><div class="mono">PASO 01 / CONECTA</div><h3>Ordena tu operación</h3><p>Centraliza clientes, procesos, tareas y datos en un entorno de trabajo común.</p></article><article class="step reveal"><div class="mono">PASO 02 / COORDINA</div><h3>Activa a tu equipo</h3><p>Define responsables, comparte avances y mantén cada actividad en movimiento.</p></article><article class="step reveal"><div class="mono">PASO 03 / EVOLUCIONA</div><h3>Crece con inteligencia</h3><p>Incorpora automatización e IA para liberar tiempo y tomar mejores decisiones.</p></article></div>
  </div>
</section>`

const CTA_HTML = `<section class="cta" id="contacto"><div class="wrap reveal"><div class="mono">Tu siguiente paso empieza aquí</div><h2>Haz que tu negocio funcione como <span class="lime">un solo equipo.</span></h2><p>Conoce Joinclap y descubre cómo una operación conectada puede cambiar la forma en que trabajas.</p><a class="btn magnetic" href="https://wa.me/?text=Hola%2C%20quiero%20conocer%20Joinclap%20y%20agendar%20una%20demo." target="_blank" rel="noopener">Solicitar una demostración <span>↗</span></a></div></section>`

const HOME_SECTIONS = [
  { id: 'hero', html: HERO_HTML },
  { id: 'intro', html: INTRO_HTML },
  { id: 'network', html: NETWORK_HTML },
  { id: 'ai', html: AI_HTML },
  { id: 'photo', html: PHOTO_HTML },
  { id: 'steps', html: STEPS_HTML },
  { id: 'cta', html: CTA_HTML },
]

const HOME_DATA = pageData(
  { backgroundColor: '#ffffff', textColor: INK, fontFamily: 'Manrope, system-ui, sans-serif', sectionGap: 0 },
  HOME_SECTIONS.map((section) => block('CustomHtmlBlock', `home-${section.id}`, { html: `<div class="jc">${section.html}</div>` })),
)

const PRECIOS_DATA = pageData(
  { backgroundColor: '#ffffff', textColor: INK, fontFamily: 'Manrope, system-ui, sans-serif', sectionGap: 0 },
  [
    block('PricingToggleBlock', 'precios-planes', {
      eyebrow: 'Planes & precios',
      title: 'Un plan para cada momento de tu negocio.',
      description: 'Todos los planes incluyen los módulos de Joinclap. La diferencia está en la capacidad y el volumen que tu operación necesita.',
      annualDiscount: 10,
      plans: [
        { name: 'Básico', tag: 'Para empezar a ordenar', monthlyPrice: 295000, features: '2 usuarios\n1 sede\n500 clientes · 200 productos\n300 cotizaciones/mes\n100 reportes · 100 remisiones\n100 órdenes de trabajo\nLitografía, escaneos y terminados sin límite', buttonLabel: 'Solicitar demo', buttonHref: 'https://wa.me/?text=Hola%2C%20quiero%20conocer%20el%20plan%20B%C3%A1sico%20de%20Joinclap.', featured: 'no' },
        { name: 'Medio', tag: 'Escala comercial', monthlyPrice: 650000, features: 'Más usuarios y sedes\nMayor volumen mensual\nTodos los módulos operativos\nSin CRM omnicanal', buttonLabel: 'Solicitar demo', buttonHref: 'https://wa.me/?text=Hola%2C%20quiero%20conocer%20el%20plan%20Medio%20de%20Joinclap.', featured: 'no' },
        { name: 'Intermedio', tag: 'Operación casi ilimitada', monthlyPrice: 1180000, features: '6 sedes\n10 usuarios\n8.000 clientes\n5.000 cotizaciones/mes\nCRM disponible solo en Full', buttonLabel: 'Solicitar demo', buttonHref: 'https://wa.me/?text=Hola%2C%20quiero%20conocer%20el%20plan%20Intermedio%20de%20Joinclap.', featured: 'yes' },
        { name: 'Full', tag: 'Sin límites', monthlyPrice: 1850000, features: 'Sin límites de capacidad\nTodos los módulos habilitados\nCRM omnicanal incluido\nMáxima capacidad de usuarios y sedes', buttonLabel: 'Solicitar demo', buttonHref: 'https://wa.me/?text=Hola%2C%20quiero%20conocer%20el%20plan%20Full%20de%20Joinclap.', featured: 'no' },
      ],
      accentColor: LIME,
      backgroundColor: '#ffffff',
      textColor: INK,
    }),
    block('FaqBlock', 'precios-faq', {
      eyebrow: 'Preguntas frecuentes',
      title: 'Todo claro antes de empezar',
      description: '',
      items: [
        { question: '¿El pago anual tiene descuento?', answer: 'Sí, el pago anual incluye un 10% de descuento.' },
        { question: '¿Puedo cambiar de plan después?', answer: 'Sí, puedes escalar tu plan cuando tu operación lo requiera.' },
        { question: '¿Qué incluye el plan Full?', answer: 'Todos los módulos habilitados y CRM omnicanal incluido, sin límites de capacidad.' },
      ],
      backgroundColor: '#f4f8eb',
      textColor: INK,
      paddingY: 72,
    }),
    block('CtaBlock', 'precios-cta', {
      title: '¿Necesitas una operación a tu medida?',
      description: 'Conversemos y armamos un plan para tu empresa.',
      buttonLabel: 'Conversemos',
      buttonHref: '/#contacto',
    }),
  ],
)

async function upsertPage(prisma: PrismaClient, projectId: string, slug: string, nombre: string, isHome: boolean, data: unknown) {
  let page = await prisma.websiteProjectPage.findFirst({ where: { websiteProjectId: projectId, slug } })
  if (page) {
    await prisma.websiteProjectPage.update({ where: { id: page.id }, data: { nombre, isHome, status: 'PUBLISHED', draftData: data as never } })
  } else {
    page = await prisma.websiteProjectPage.create({ data: { websiteProjectId: projectId, nombre, slug, isHome, status: 'PUBLISHED', draftData: data as never } })
  }

  const existing = await prisma.websiteProjectPageVersion.findFirst({ where: { websiteProjectPageId: page.id, versionNumber: 1 } })
  if (existing) {
    await prisma.websiteProjectPageVersion.update({ where: { id: existing.id }, data: { editorJson: data as never, isPublished: true } })
  } else {
    await prisma.websiteProjectPageVersion.create({ data: { websiteProjectPageId: page.id, versionNumber: 1, editorJson: data as never, isPublished: true } })
  }
  return page
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está definido')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const empresa = await prisma.empresa.findFirst({ orderBy: { createdAt: 'asc' } })
    if (!empresa) {
      throw new Error('No hay ninguna empresa para sembrar el sitio principal.')
    }

    let project = await prisma.websiteProject.findFirst({ where: { slug: 'joinclap', empresaId: empresa.id } })
    if (project) {
      project = await prisma.websiteProject.update({
        where: { id: project.id },
        data: { nombre: 'Joinclap', subdomain: 'joinclap', status: 'PUBLISHED', isMainSite: true, themeJson: themeJson as never },
      })
    } else {
      project = await prisma.websiteProject.create({
        data: { empresaId: empresa.id, nombre: 'Joinclap', slug: 'joinclap', subdomain: 'joinclap', status: 'PUBLISHED', isMainSite: true, themeJson: themeJson as never },
      })
    }

    await upsertPage(prisma, project.id, 'inicio', 'Inicio', true, HOME_DATA)
    await upsertPage(prisma, project.id, 'precios', 'Precios', false, PRECIOS_DATA)

    console.log(`Sitio principal de Joinclap sembrado correctamente (proyecto ${project.id}).`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})



