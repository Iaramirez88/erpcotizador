export const helpDocsLastUpdated = '24 de noviembre de 2026'

export type HelpDifficulty = 'Básico' | 'Intermedio' | 'Avanzado'

export type HelpArticleSection = {
  heading: string
  body?: string
  steps?: string[]
}

export type HelpArticle = {
  slug: string
  category: string
  title: string
  excerpt: string
  difficulty: HelpDifficulty
  readingMinutes: number
  keywords: string[]
  sections: HelpArticleSection[]
  screenshot?: {
    src: string
    alt: string
    caption?: string
  }
  related: string[]
}

export type HelpCategory = {
  id: string
  name: string
  description: string
}

export const helpCategories: HelpCategory[] = [
  {
    id: 'primeros-pasos',
    name: 'Primeros pasos',
    description: 'Configura tu cuenta y empieza a usar la plataforma.',
  },
  {
    id: 'modulos',
    name: 'Módulos principales',
    description: 'Cómo funciona cada módulo de Joinclap y qué puedes hacer con él.',
  },
  {
    id: 'integraciones',
    name: 'Integraciones y APIs',
    description: 'Conecta canales, Google, DIAN y la API pública.',
  },
  {
    id: 'seguridad',
    name: 'Seguridad y administración',
    description: 'Permisos, roles, respaldos y continuidad de tu operación.',
  },
]

export function getHelpCategory(id: string): HelpCategory | undefined {
  return helpCategories.find((category) => category.id === id)
}

export function getHelpArticleBySlug(slug: string): HelpArticle | undefined {
  return helpArticles.find((article) => article.slug === slug)
}

export function getArticlesByCategory(categoryId: string): HelpArticle[] {
  return helpArticles.filter((article) => article.category === categoryId)
}

export function getRelatedArticles(article: HelpArticle): HelpArticle[] {
  return article.related
    .map((slug) => getHelpArticleBySlug(slug))
    .filter((item): item is HelpArticle => Boolean(item))
    .slice(0, 3)
}

export function getHelpArticleNav(slug: string): {
  previous: HelpArticle | null
  next: HelpArticle | null
} {
  const index = helpArticles.findIndex((article) => article.slug === slug)
  if (index === -1) return { previous: null, next: null }
  return {
    previous: index > 0 ? helpArticles[index - 1] : null,
    next: index < helpArticles.length - 1 ? helpArticles[index + 1] : null,
  }
}

export const helpArticles: HelpArticle[] = [
  {
    slug: 'crear-cuenta',
    category: 'primeros-pasos',
    title: 'Crear tu cuenta y confirmar el correo',
    excerpt: 'Aprende a registrarte en Joinclap, verificar tu correo y entrar por primera vez.',
    difficulty: 'Básico',
    readingMinutes: 3,
    keywords: ['registro', 'cuenta', 'correo', 'verificación', 'alta'],
    sections: [
      {
        heading: 'Registro inicial',
        body: 'Para empezar necesitas crear una cuenta directamente desde la pantalla de acceso.',
        steps: [
          'Abre la página de ingreso y selecciona «Crear cuenta».',
          'Escribe tu nombre, correo corporativo y una contraseña segura.',
          'Acepta los términos de servicio y la política de privacidad.',
        ],
      },
      {
        heading: 'Confirmación de correo',
        body: 'Te enviaremos un código de verificación al correo que registraste.',
        steps: [
          'Revisa la bandeja de entrada (y la carpeta de spam si no aparece).',
          'Ingresa el código de 6 dígitos en la pantalla de verificación.',
          'Al confirmar, tu cuenta queda activa y ya puedes iniciar sesión.',
        ],
      },
      {
        heading: 'Primer acceso',
        body: 'Una vez dentro, completa tu perfil y selecciona la sede con la que vas a trabajar.',
      },
    ],
    related: ['configurar-perfil', 'cambiar-contrasena'],
  },
  {
    slug: 'cambiar-contrasena',
    category: 'primeros-pasos',
    title: 'Cambiar tu contraseña',
    excerpt: 'Actualiza tu contraseña desde tu perfil o recupérala si olvidaste el acceso.',
    difficulty: 'Básico',
    readingMinutes: 2,
    keywords: ['contraseña', 'password', 'seguridad', 'recuperar', 'acceso'],
    sections: [
      {
        heading: 'Desde tu perfil',
        body: 'Puedes cambiar la contraseña en cualquier momento desde tu cuenta.',
        steps: [
          'Entra a «Perfil y seguridad».',
          'Selecciona «Cambiar contraseña».',
          'Escribe la contraseña actual y la nueva, y guarda los cambios.',
        ],
      },
      {
        heading: 'Si olvidaste la contraseña',
        body: 'Desde la pantalla de acceso puedes solicitar un restablecimiento.',
        steps: [
          'Pulsa «¿Olvidaste tu contraseña?».',
          'Ingresa tu correo y envía la solicitud.',
          'Sigue el enlace del correo y define una nueva contraseña.',
        ],
      },
    ],
    related: ['crear-cuenta', 'usuarios-roles'],
  },
  {
    slug: 'configurar-perfil',
    category: 'primeros-pasos',
    title: 'Configurar tu perfil y tu sede',
    excerpt: 'Completa tus datos, define tu rol visible y deja lista tu sede de trabajo.',
    difficulty: 'Básico',
    readingMinutes: 4,
    keywords: ['perfil', 'sede', 'datos', 'empresa', 'configuración'],
    sections: [
      {
        heading: 'Datos del perfil',
        body: 'Mantén tus datos actualizados para que el equipo te identifique fácilmente.',
        steps: [
          'Abre «Perfil y seguridad».',
          'Completa nombre, cargo y datos de contacto.',
          'Guarda los cambios y revisa tu avatar.',
        ],
      },
      {
        heading: 'Tu empresa y tu sede',
        body: 'Joinclap organiza la información por empresa y por sede.',
        steps: [
          'Abre «Configuración» y luego «Mi empresa».',
          'Verifica nombre, NIT, dirección y datos de facturación.',
          'Revisa que tu sede esté asociada a tu usuario.',
        ],
      },
    ],
    related: ['usuarios-roles', 'crear-cuenta'],
  },
  {
    slug: 'crm-ventas',
    category: 'modulos',
    title: 'Cómo funciona el CRM y ventas',
    excerpt: 'Centraliza clientes, conversaciones, oportunidades y seguimiento comercial.',
    difficulty: 'Intermedio',
    readingMinutes: 6,
    keywords: ['crm', 'ventas', 'oportunidades', 'clientes', 'embudo'],
    screenshot: {
      src: '/novedades/crm-conversaciones.svg',
      alt: 'Ilustración de la bandeja de conversaciones del CRM de Joinclap',
      caption: 'Ilustración referencial: bandeja de conversaciones del CRM.',
    },
    sections: [
      {
        heading: 'Qué resuelve',
        body: 'El CRM conecta WhatsApp, redes y formularios en una sola bandeja y convierte cada contacto en una relación que avanza.',
      },
      {
        heading: 'Piezas principales',
        steps: [
          'Inbox unificado: conversaciones de WhatsApp, Instagram y Facebook.',
          'Contactos y empresas: ficha completa con historial.',
          'Oportunidades y embudo: etapas desde el contacto hasta el cierre.',
        ],
      },
      {
        heading: 'Flujo recomendado',
        steps: [
          'Captura el lead desde un canal o formulario.',
          'Clasifica el contacto y asigna un responsable.',
          'Haz seguimiento y mueve la etapa hasta ganar la venta.',
        ],
      },
    ],
    related: ['whatsapp-meta', 'inventario'],
  },
  {
    slug: 'inventario',
    category: 'modulos',
    title: 'Cómo funciona Inventario y operaciones',
    excerpt: 'Controla productos, existencias, movimientos y sedes en un solo lugar.',
    difficulty: 'Intermedio',
    readingMinutes: 6,
    keywords: ['inventario', 'stock', 'productos', 'bodegas', 'movimientos'],
    screenshot: {
      src: '/novedades/inventario-alertas.svg',
      alt: 'Ilustración de alertas de inventario en Joinclap',
      caption: 'Ilustración referencial: alertas de stock del módulo de inventario.',
    },
    sections: [
      {
        heading: 'Qué resuelve',
        body: 'Mantén la información de existencias conectada con las decisiones del equipo y evita quiebres de stock.',
      },
      {
        heading: 'Conceptos clave',
        steps: [
          'Productos y materiales: catálogo con precios y referencias.',
          'Bodegas y sedes: control de existencias por ubicación.',
          'Movimientos: entradas, salidas y ajustes de inventario.',
        ],
      },
      {
        heading: 'Flujo recomendado',
        steps: [
          'Carga el catálogo de productos.',
          'Registra entradas por compra.',
          'Activa alertas de stock mínimo.',
        ],
      },
    ],
    related: ['cotizador-litografia', 'pos-facturacion'],
  },
  {
    slug: 'cotizador-litografia',
    category: 'modulos',
    title: 'Cómo funciona el Cotizador y litografía',
    excerpt: 'Cotiza impresión litográfica por m², insumos y acabados con precisión.',
    difficulty: 'Intermedio',
    readingMinutes: 7,
    keywords: ['cotizador', 'litografía', 'impresión', 'acabados', 'm²'],
    screenshot: {
      src: '/novedades/cotizador-asistente.svg',
      alt: 'Ilustración del asistente del cotizador de Joinclap',
      caption: 'Ilustración referencial: asistente del cotizador.',
    },
    sections: [
      {
        heading: 'Qué resuelve',
        body: 'El módulo litográfico calcula precios según perfiles de plancha, merma, acabados y cantidades, sin precios fijos a ciegas.',
      },
      {
        heading: 'Antes de cotizar',
        steps: [
          'Configura perfiles de plancha y tarifas de insumos.',
          'Carga acabados y tarifas de flyers.',
          'Define descuentos por cantidad.',
        ],
      },
      {
        heading: 'Cómo cotizar',
        steps: [
          'Crea la cotización e indica medidas y cantidades.',
          'Elige materiales y acabados.',
          'Revisa el desglose y envía el PDF al cliente.',
        ],
      },
    ],
    related: ['inventario', 'pos-facturacion'],
  },
  {
    slug: 'pos-facturacion',
    category: 'modulos',
    title: 'Cómo funciona POS y facturación',
    excerpt: 'Factura de forma rápida con caja, medios de pago y secuencias por sede.',
    difficulty: 'Intermedio',
    readingMinutes: 6,
    keywords: ['pos', 'facturación', 'caja', 'pagos', 'secuencia'],
    sections: [
      {
        heading: 'Qué resuelve',
        body: 'El POS registra ventas internas con medios de pago, Bold y numeración por sede.',
      },
      {
        heading: 'Piezas principales',
        steps: [
          'Caja: registro de la venta del día.',
          'Medios de pago: efectivo, transferencia, tarjeta y Bold.',
          'Comprobantes: secuencia por sede.',
        ],
      },
    ],
    related: ['cotizador-litografia', 'contabilidad-nomina'],
  },
  {
    slug: 'contabilidad-nomina',
    category: 'modulos',
    title: 'Cómo funciona Contabilidad y nómina',
    excerpt: 'Organiza comprobantes contables, nómina y asientos desde la operación.',
    difficulty: 'Intermedio',
    readingMinutes: 7,
    keywords: ['contabilidad', 'nómina', 'asientos', 'comprobantes', 'beneficios'],
    screenshot: {
      src: '/novedades/nomina-desprendibles.svg',
      alt: 'Ilustración de desprendibles de nómina en Joinclap',
      caption: 'Ilustración referencial: desprendibles del módulo de nómina.',
    },
    sections: [
      {
        heading: 'Qué resuelve',
        body: 'Convierte la operación en asientos contables y administra la nómina con desprendibles.',
      },
      {
        heading: 'Contabilidad',
        steps: [
          'Crea comprobantes por tipo.',
          'Revisa asientos generados desde ventas y compras.',
          'Consulta auxiliares y reportes.',
        ],
      },
      {
        heading: 'Nómina',
        steps: [
          'Registra contratos y beneficios.',
          'Genera la asistencia del periodo.',
          'Procesa la nómina y descarga desprendibles.',
        ],
      },
    ],
    related: ['pos-facturacion', 'dian'],
  },
  {
    slug: 'whatsapp-meta',
    category: 'integraciones',
    title: 'Incorporar WhatsApp y Meta',
    excerpt: 'Conecta WhatsApp, Instagram y Facebook para gestionar todo desde el CRM.',
    difficulty: 'Avanzado',
    readingMinutes: 7,
    keywords: ['whatsapp', 'meta', 'facebook', 'instagram', 'conexión'],
    sections: [
      {
        heading: 'Requisitos',
        steps: [
          'Cuenta de Meta Business con permisos de administrador.',
          'Número de WhatsApp y activos disponibles en la app.',
          'App de Meta con política de privacidad y datos básicos completos.',
        ],
      },
      {
        heading: 'Conexión',
        steps: [
          'Ve a CRM → Canales → Conectar.',
          'Inicia sesión con Meta y autoriza los permisos.',
          'Selecciona la página y el número a vincular.',
        ],
      },
      {
        heading: 'Verificación',
        body: 'Cuando la app esté en modo live podrás recibir y responder mensajes productivos.',
      },
    ],
    related: ['crm-ventas', 'api-publica'],
  },
  {
    slug: 'google',
    category: 'integraciones',
    title: 'Incorporar Google (login, calendario y marketing)',
    excerpt: 'Conecta Google para autenticación, agenda y reportes de marketing.',
    difficulty: 'Avanzado',
    readingMinutes: 7,
    keywords: ['google', 'login', 'calendario', 'marketing', 'oauth'],
    sections: [
      {
        heading: 'Qué puedes conectar',
        steps: [
          'Google OAuth para login social.',
          'Google Calendar para agendar citas.',
          'Google Marketing y Search Console para reportes.',
        ],
      },
      {
        heading: 'Pasos generales',
        steps: [
          'Crea credenciales OAuth en Google Cloud.',
          'Configura los callbacks autorizados.',
          'Completa la conexión desde la sección de canales o marketing.',
        ],
      },
    ],
    related: ['api-publica', 'whatsapp-meta'],
  },
  {
    slug: 'api-publica',
    category: 'integraciones',
    title: 'Usar la API pública',
    excerpt: 'Autentícate y consume los endpoints públicos de Joinclap.',
    difficulty: 'Avanzado',
    readingMinutes: 8,
    keywords: ['api', 'token', 'endpoint', 'autenticación', 'integración'],
    sections: [
      {
        heading: 'Autenticación',
        body: 'La API se protege con token. Debes obtenerlo desde tu cuenta y enviarlo en cada petición.',
        steps: [
          'Genera un token en Configuración → API.',
          'Envía el header Authorization: Bearer <token>.',
          'Mantén el token en secreto y rótalo cuando sea necesario.',
        ],
      },
      {
        heading: 'Primera petición',
        body: 'Ejemplo de lectura de la información de tu empresa:',
        steps: [
          'GET /api/empresa para consultar los datos de tu empresa.',
          'GET /api/cotizaciones para listar cotizaciones.',
          'Revisa la documentación de cada módulo para conocer los filtros disponibles.',
        ],
      },
      {
        heading: 'Buenas prácticas',
        steps: [
          'Usa HTTPS en todos los entornos.',
          'Limita los permisos al mínimo necesario.',
          'Registra errores y reintentos.',
        ],
      },
    ],
    related: ['whatsapp-meta', 'google'],
  },
  {
    slug: 'dian',
    category: 'integraciones',
    title: 'Incorporar DIAN / facturación electrónica',
    excerpt: 'Prepara la emisión de documentos electrónicos ante la DIAN.',
    difficulty: 'Avanzado',
    readingMinutes: 7,
    keywords: ['dian', 'factura electrónica', 'cumplimiento', 'resolución'],
    sections: [
      {
        heading: 'Qué implica',
        body: 'La facturación electrónica requiere habilitación, resolución y certificado ante la DIAN.',
      },
      {
        heading: 'Pasos',
        steps: [
          'Verifica tu habilitación como facturador electrónico.',
          'Configura la resolución de facturación.',
          'Prueba la emisión en ambiente de pruebas antes de producción.',
        ],
      },
    ],
    related: ['pos-facturacion', 'contabilidad-nomina'],
  },
  {
    slug: 'usuarios-roles',
    category: 'seguridad',
    title: 'Usuarios, roles y permisos',
    excerpt: 'Administra el acceso por empresa, sede y módulo según responsabilidades.',
    difficulty: 'Intermedio',
    readingMinutes: 6,
    keywords: ['usuarios', 'roles', 'permisos', 'acceso', 'sede'],
    sections: [
      {
        heading: 'Modelo de acceso',
        body: 'Cada usuario pertenece a una empresa y a una o varias sedes, con un rol que define qué puede ver y hacer.',
      },
      {
        heading: 'Pasos',
        steps: [
          'Ve a Configuración → Usuarios.',
          'Invita al usuario con su correo.',
          'Asigna sede, rol y módulos.',
        ],
      },
      {
        heading: 'Roles recomendados',
        body: 'Admin, usuario operativo, vendedor, producción y cliente son puntos de partida que puedes ajustar.',
      },
    ],
    related: ['configurar-perfil', 'respaldos'],
  },
  {
    slug: 'respaldos',
    category: 'seguridad',
    title: 'Respaldos y continuidad',
    excerpt: 'Conoce cómo se respalda tu información y qué hacer ante un incidente.',
    difficulty: 'Intermedio',
    readingMinutes: 5,
    keywords: ['respaldo', 'backup', 'continuidad', 'recuperación', 'seguridad'],
    sections: [
      {
        heading: 'Cómo se protege tu operación',
        body: 'La plataforma usa respaldos automáticos y controles de continuidad para reducir el riesgo de pérdida de información.',
      },
      {
        heading: 'Buenas prácticas',
        steps: [
          'Mantén actualizados los datos de tu empresa.',
          'Revisa accesos y permisos periódicamente.',
          'Informa cualquier incidente a soporte.',
        ],
      },
    ],
    related: ['usuarios-roles', 'configurar-perfil'],
  },
]
