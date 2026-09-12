import type { Data } from '@puckeditor/core'

export type WebsiteFunnelTemplateKey = 'saas-demo' | 'premium-booking' | 'b2b-quote'

type WebsiteBuilderRootProps = {
  title?: string
  backgroundColor?: string
  textColor?: string
  fontFamily?: string
  sectionGap?: number
}

type WebsiteFunnelData = Data<Record<string, Record<string, unknown>>, WebsiteBuilderRootProps>

export type WebsiteFunnelTemplate = {
  key: WebsiteFunnelTemplateKey
  name: string
  category: string
  objective: string
  description: string
  accent: string
  surface: string
  steps: string[]
  data: WebsiteFunnelData
}

function block(type: string, id: string, props: Record<string, unknown>) {
  return { type, props: { id, ...props } }
}

export const WEBSITE_FUNNEL_TEMPLATES: WebsiteFunnelTemplate[] = [
  {
    key: 'saas-demo',
    name: 'Órbita SaaS',
    category: 'Software y servicios digitales',
    objective: 'Reservar una demostración',
    description: 'Propuesta directa, prueba social, beneficios, planes y captura de leads para vender software o servicios recurrentes.',
    accent: '#2563eb',
    surface: '#eaf2ff',
    steps: ['Promesa', 'Prueba', 'Beneficios', 'Planes', 'Demo'],
    data: {
      root: { props: { backgroundColor: '#ffffff', textColor: '#0f172a', fontFamily: 'ui-sans-serif, system-ui, sans-serif', sectionGap: 0 } },
      content: [
        block('NavbarBlock', 'saas-nav', { brand: 'ÓRBITA', logoUrl: '', links: [{ label: 'Producto', href: '#producto' }, { label: 'Resultados', href: '#resultados' }, { label: 'Precios', href: '#precios' }], buttonLabel: 'Solicitar demo', buttonHref: '#contacto', backgroundColor: '#ffffff', textColor: '#0f172a', sticky: 'sticky' }),
        block('HeroBlock', 'saas-hero', { eyebrow: 'OPERACIÓN COMERCIAL INTELIGENTE', title: 'Convierte cada oportunidad en una venta medible', subtitle: 'Centraliza conversaciones, automatiza seguimientos y dale a tu equipo una vista clara de cada negocio.', ctaLabel: 'Ver una demo', ctaHref: '#contacto', tone: 'light', alignment: 'left', layout: 'split-right', contentWidth: 'xl', contentFlex: 6, mediaFlex: 6, backgroundImageUrl: '', backgroundImagePosition: 'center center', overlayOpacity: 0, mediaImageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=85', mediaImageAlt: 'Panel de analítica comercial', mediaRatio: 'wide', mediaFit: 'cover' }),
        block('StatsBlock', 'saas-stats', { items: [{ value: '+34%', label: 'Conversión promedio' }, { value: '12 h', label: 'Ahorradas por semana' }, { value: '4.9/5', label: 'Satisfacción' }, { value: '99.9%', label: 'Disponibilidad' }], backgroundColor: '#0f172a', textColor: '#ffffff', paddingY: 48 }),
        block('FeaturesBlock', 'saas-features', { eyebrow: 'UNA SOLA PLATAFORMA', title: 'Menos tareas manuales. Más conversaciones que avanzan.', description: 'Todo tu proceso comercial conectado desde el primer contacto hasta el cierre.', columns: 3, items: [{ icon: '01', title: 'Inbox unificado', description: 'WhatsApp, redes y formularios en una bandeja compartida.' }, { icon: '02', title: 'Automatización útil', description: 'Seguimientos que se activan con el contexto correcto.' }, { icon: '03', title: 'Decisiones con datos', description: 'Embudo, tiempos y resultados visibles en tiempo real.' }], backgroundColor: '#ffffff', textColor: '#0f172a', accentColor: '#2563eb', paddingY: 80 }),
        block('TestimonialsBlock', 'saas-proof', { eyebrow: 'CASOS REALES', title: 'Equipos que venden con más claridad', description: '', items: [{ quote: 'Pasamos de perseguir información a tomar decisiones en la misma mañana.', name: 'Mariana Torres', role: 'Directora Comercial · Aster', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80' }, { quote: 'La adopción fue rápida y el equipo recuperó horas desde la primera semana.', name: 'Andrés León', role: 'CEO · Norte Labs', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80' }], backgroundColor: '#eaf2ff', textColor: '#0f172a', paddingY: 80 }),
        block('PricingBlock', 'saas-pricing', { eyebrow: 'PRECIOS', title: 'Empieza con lo que necesitas', description: 'Sin contratos complejos. Escala cuando tu equipo esté listo.', plans: [{ name: 'Inicio', price: '$49', period: '/mes', features: '3 usuarios\nInbox comercial\nReportes básicos', buttonLabel: 'Comenzar', buttonHref: '#contacto', featured: 'no' }, { name: 'Crecimiento', price: '$99', period: '/mes', features: '10 usuarios\nAutomatizaciones\nAnalítica avanzada', buttonLabel: 'Solicitar demo', buttonHref: '#contacto', featured: 'yes' }, { name: 'Escala', price: 'A medida', period: '', features: 'Usuarios ilimitados\nIntegraciones\nAcompañamiento dedicado', buttonLabel: 'Hablar con ventas', buttonHref: '#contacto', featured: 'no' }], backgroundColor: '#ffffff', textColor: '#0f172a', accentColor: '#2563eb', paddingY: 80 }),
        block('FaqBlock', 'saas-faq', { eyebrow: 'PREGUNTAS', title: 'Todo claro antes de comenzar', description: '', items: [{ question: '¿Cuánto tarda la implementación?', answer: 'La configuración inicial puede quedar lista en pocos días, según las integraciones requeridas.' }, { question: '¿Puedo importar mis contactos?', answer: 'Sí. Puedes migrar clientes y prospectos desde archivos o integraciones disponibles.' }, { question: '¿Incluye acompañamiento?', answer: 'Todos los planes incluyen onboarding y recursos de soporte.' }], backgroundColor: '#f8fafc', textColor: '#0f172a', paddingY: 72 }),
        block('ContactFormBlock', 'saas-form', { eyebrow: 'DEMOSTRACIÓN PERSONALIZADA', title: 'Mira cómo funcionaría con tu proceso', description: 'Cuéntanos qué quieres mejorar. Un especialista preparará una demo enfocada en tu equipo.', buttonLabel: 'Agendar mi demo', successMessage: 'Gracias. Te contactaremos para coordinar la demostración.', showPhone: 'yes', backgroundColor: '#dbeafe', accentColor: '#2563eb', paddingY: 80 }),
        block('FooterBlock', 'saas-footer', { brand: 'ÓRBITA', description: 'Operación comercial clara para equipos que quieren crecer.', copyright: '© 2026 Órbita. Todos los derechos reservados.', links: [{ label: 'Privacidad', href: '#' }, { label: 'Términos', href: '#' }, { label: 'Contacto', href: '#contacto' }], backgroundColor: '#0f172a', textColor: '#ffffff' }),
      ],
    },
  },
  {
    key: 'premium-booking',
    name: 'Aurea Studio',
    category: 'Salud, belleza y servicios premium',
    objective: 'Reservar una valoración',
    description: 'Experiencia editorial y cercana que vende confianza, transformación y atención personalizada antes de pedir la reserva.',
    accent: '#be123c',
    surface: '#fff1f2',
    steps: ['Aspiración', 'Método', 'Confianza', 'Objeciones', 'Reserva'],
    data: {
      root: { props: { backgroundColor: '#fffdfd', textColor: '#292524', fontFamily: 'Georgia, Cambria, serif', sectionGap: 0 } },
      content: [
        block('NavbarBlock', 'premium-nav', { brand: 'AUREA', logoUrl: '', links: [{ label: 'Experiencia', href: '#experiencia' }, { label: 'Tratamientos', href: '#tratamientos' }, { label: 'Historias', href: '#historias' }], buttonLabel: 'Reservar', buttonHref: '#contacto', backgroundColor: '#fffdfd', textColor: '#292524', sticky: 'sticky' }),
        block('HeroBlock', 'premium-hero', { eyebrow: 'BELLEZA CON PROPÓSITO', title: 'Tu mejor versión empieza por sentirte tú', subtitle: 'Tratamientos personalizados, resultados naturales y un espacio diseñado para cuidarte sin prisas.', ctaLabel: 'Reserva tu valoración', ctaHref: '#contacto', tone: 'brand', alignment: 'left', layout: 'split-left', contentWidth: 'xl', contentFlex: 5, mediaFlex: 7, backgroundImageUrl: '', backgroundImagePosition: 'center center', overlayOpacity: 0, mediaImageUrl: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1400&q=85', mediaImageAlt: 'Consulta profesional en espacio luminoso', mediaRatio: 'portrait', mediaFit: 'cover' }),
        block('TextBlock', 'premium-story', { title: 'No creemos en soluciones iguales para todos', body: 'Escuchamos lo que quieres, evaluamos lo que necesitas y diseñamos un plan honesto para lograr un resultado que se vea bien y se sienta propio.', alignment: 'center', width: 'lg' }),
        block('FeaturesBlock', 'premium-method', { eyebrow: 'NUESTRO MÉTODO', title: 'Cuidado en cada detalle', description: 'Una experiencia tranquila, transparente y diseñada alrededor de ti.', columns: 3, items: [{ icon: 'I', title: 'Valoración profunda', description: 'Comprendemos tus expectativas antes de recomendar.' }, { icon: 'II', title: 'Plan personalizado', description: 'Cada decisión responde a tus rasgos y objetivos.' }, { icon: 'III', title: 'Seguimiento cercano', description: 'Te acompañamos antes, durante y después.' }], backgroundColor: '#fff1f2', textColor: '#292524', accentColor: '#be123c', paddingY: 88 }),
        block('ImageBlock', 'premium-image', { imageUrl: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=1600&q=85', imageAlt: 'Atención personalizada', caption: 'Un entorno sereno para decisiones informadas.', width: 82, alignment: 'center', ratio: 'ultrawide', fit: 'cover' }),
        block('TestimonialsBlock', 'premium-stories', { eyebrow: 'HISTORIAS', title: 'Resultados que se sienten personales', description: '', items: [{ quote: 'Me explicaron cada paso y nunca sentí presión. El resultado se ve completamente natural.', name: 'Valentina R.', role: 'Paciente verificada', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' }, { quote: 'La atención y el seguimiento hicieron toda la diferencia. Volvería sin pensarlo.', name: 'Natalia M.', role: 'Paciente verificada', avatarUrl: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=200&q=80' }], backgroundColor: '#ffffff', textColor: '#292524', paddingY: 80 }),
        block('FaqBlock', 'premium-faq', { eyebrow: 'ANTES DE TU CITA', title: 'Resolvemos tus dudas', description: '', items: [{ question: '¿La valoración tiene costo?', answer: 'Puedes definir aquí las condiciones de la valoración inicial.' }, { question: '¿Los resultados son inmediatos?', answer: 'Cada tratamiento tiene tiempos distintos. En tu valoración recibirás expectativas claras y realistas.' }, { question: '¿Qué debo llevar?', answer: 'Solo necesitas llegar unos minutos antes y compartir antecedentes relevantes.' }], backgroundColor: '#fff7f7', textColor: '#292524', paddingY: 72 }),
        block('ContactFormBlock', 'premium-form', { eyebrow: 'TU PRIMER PASO', title: 'Reserva una valoración privada', description: 'Déjanos tus datos. Nuestro equipo te ayudará a elegir el mejor horario.', buttonLabel: 'Quiero reservar', successMessage: 'Solicitud recibida. Te contactaremos para confirmar tu cita.', showPhone: 'yes', backgroundColor: '#ffe4e6', accentColor: '#be123c', paddingY: 88 }),
        block('FooterBlock', 'premium-footer', { brand: 'AUREA', description: 'Cuidado profesional, resultados naturales y atención sin prisas.', copyright: '© 2026 Aurea Studio.', links: [{ label: 'Tratamientos', href: '#tratamientos' }, { label: 'Privacidad', href: '#' }, { label: 'Reservar', href: '#contacto' }], backgroundColor: '#292524', textColor: '#ffffff' }),
      ],
    },
  },
  {
    key: 'b2b-quote',
    name: 'Volt Industrial',
    category: 'Industria, energía y proyectos B2B',
    objective: 'Solicitar una cotización',
    description: 'Landing técnica con autoridad, cifras, alcance y reducción de riesgo para capturar proyectos empresariales de alto valor.',
    accent: '#16a34a',
    surface: '#ecfdf5',
    steps: ['Problema', 'Impacto', 'Capacidad', 'Riesgo', 'Cotización'],
    data: {
      root: { props: { backgroundColor: '#f7fee7', textColor: '#102a1c', fontFamily: 'Trebuchet MS, ui-sans-serif, sans-serif', sectionGap: 0 } },
      content: [
        block('NavbarBlock', 'b2b-nav', { brand: 'VOLT / INDUSTRIAL', logoUrl: '', links: [{ label: 'Soluciones', href: '#soluciones' }, { label: 'Proyectos', href: '#proyectos' }, { label: 'Proceso', href: '#proceso' }], buttonLabel: 'Cotizar proyecto', buttonHref: '#contacto', backgroundColor: '#102a1c', textColor: '#ffffff', sticky: 'sticky' }),
        block('HeroBlock', 'b2b-hero', { eyebrow: 'ENERGÍA QUE PRODUCE RESULTADOS', title: 'Reduce costos operativos sin poner en riesgo tu producción', subtitle: 'Diseñamos e implementamos soluciones energéticas para empresas que necesitan eficiencia medible, continuidad y respaldo técnico.', ctaLabel: 'Solicitar diagnóstico', ctaHref: '#contacto', tone: 'dark', alignment: 'left', layout: 'split-right', contentWidth: 'xl', contentFlex: 7, mediaFlex: 5, backgroundImageUrl: '', backgroundImagePosition: 'center center', overlayOpacity: 0, mediaImageUrl: 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1400&q=85', mediaImageAlt: 'Instalación de energía solar industrial', mediaRatio: 'portrait', mediaFit: 'cover' }),
        block('StatsBlock', 'b2b-stats', { items: [{ value: '-38%', label: 'Costo energético potencial' }, { value: '+120', label: 'Proyectos ejecutados' }, { value: '15 años', label: 'Vida útil proyectada' }, { value: 'ROI 3.2x', label: 'Retorno estimado' }], backgroundColor: '#facc15', textColor: '#102a1c', paddingY: 48 }),
        block('FeaturesBlock', 'b2b-solutions', { eyebrow: 'CAPACIDAD INTEGRAL', title: 'Del diagnóstico a la operación', description: 'Un solo equipo responsable de ingeniería, implementación y seguimiento.', columns: 4, items: [{ icon: '01', title: 'Diagnóstico', description: 'Medimos consumo, riesgos y oportunidades reales.' }, { icon: '02', title: 'Ingeniería', description: 'Diseñamos según operación, normativa y crecimiento.' }, { icon: '03', title: 'Implementación', description: 'Ejecutamos con seguridad y mínima interrupción.' }, { icon: '04', title: 'Monitoreo', description: 'Verificamos desempeño y ahorro continuamente.' }], backgroundColor: '#ffffff', textColor: '#102a1c', accentColor: '#16a34a', paddingY: 80 }),
        block('ColumnsBlock', 'b2b-case', { eyebrow: 'CASO DESTACADO', title: 'Una planta que convirtió consumo en ventaja', description: 'Proyecto de autogeneración para operación industrial continua.', tone: 'soft', leftFlex: 7, rightFlex: 5, gap: 32, leftColumn: [], rightColumn: [] }),
        block('TestimonialsBlock', 'b2b-proof', { eyebrow: 'RESPALDO', title: 'Decisiones técnicas con impacto financiero', description: '', items: [{ quote: 'El proyecto se ejecutó sin detener la operación y el ahorro fue visible desde el primer ciclo.', name: 'Mauricio Peña', role: 'Gerente de Planta · Intec', avatarUrl: '' }, { quote: 'Tuvimos claridad técnica y financiera antes de aprobar la inversión.', name: 'Diana Solano', role: 'Directora Financiera · Grupo Axis', avatarUrl: '' }], backgroundColor: '#ecfdf5', textColor: '#102a1c', paddingY: 80 }),
        block('FaqBlock', 'b2b-faq', { eyebrow: 'VIABILIDAD', title: 'Preguntas antes de invertir', description: '', items: [{ question: '¿Cómo calculan el retorno?', answer: 'Analizamos consumo histórico, tarifa, capacidad instalada y escenarios de producción.' }, { question: '¿La instalación afecta la operación?', answer: 'El plan de ejecución se diseña para minimizar interrupciones y cumplir protocolos de seguridad.' }, { question: '¿Ofrecen financiación?', answer: 'Podemos estructurar alternativas de compra, leasing o acuerdos según el proyecto.' }], backgroundColor: '#ffffff', textColor: '#102a1c', paddingY: 72 }),
        block('ContactFormBlock', 'b2b-form', { eyebrow: 'DIAGNÓSTICO INICIAL', title: 'Recibe una estimación para tu operación', description: 'Comparte tus datos y un ingeniero comercial te contactará para entender consumo, alcance y objetivos.', buttonLabel: 'Solicitar cotización', successMessage: 'Solicitud recibida. Nuestro equipo técnico se pondrá en contacto.', showPhone: 'yes', backgroundColor: '#dcfce7', accentColor: '#15803d', paddingY: 88 }),
        block('FooterBlock', 'b2b-footer', { brand: 'VOLT / INDUSTRIAL', description: 'Ingeniería energética para operaciones que no pueden detenerse.', copyright: '© 2026 Volt Industrial.', links: [{ label: 'Soluciones', href: '#soluciones' }, { label: 'Seguridad', href: '#' }, { label: 'Cotizar', href: '#contacto' }], backgroundColor: '#102a1c', textColor: '#ffffff' }),
      ],
    },
  },
]

export function cloneWebsiteFunnelTemplateData(template: WebsiteFunnelTemplate) {
  return JSON.parse(JSON.stringify(template.data)) as Data
}
