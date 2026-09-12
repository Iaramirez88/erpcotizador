# Website Builder V1 con Puck

## Objetivo

Construir dentro de Ordex un modulo de sitios web tipo builder visual, montado sobre el modulo actual de servicios web, para crear, editar, versionar y publicar sitios bajo subdominio de la plataforma o dominio personalizado.

## Base existente

- Servicios web ya gestiona sitios vendidos, hosting, dominio, credenciales, renovaciones y plantillas automáticas.
- El acceso ya se controla por empresa y usuario mediante WebsiteServiceModuleAccess.
- Ya existe storage de adjuntos para el modulo en public/uploads/website-services.

## Decision de editor

- Editor elegido: Puck.
- Motivo: mejor balance entre experiencia visual tipo builder y control SaaS basado en componentes React.
- Regla clave: guardar JSON estructurado, no HTML/CSS libre del usuario.

## Alcance V1

### Builder

- Canvas visual con preview desktop, tablet y mobile.
- Sidebar de bloques permitidos.
- Panel de propiedades por bloque.
- Reordenamiento y nesting controlado.

### Bloques iniciales

- Hero
- RichText
- Image
- Section
- Columns
- CardGrid
- CTA
- Testimonials
- FAQ
- Map
- CRMForm
- Footer

### Landing Suite implementada

- Biblioteca organizada por Estructura, Contenido, Conversión y Navegación.
- Menú superior editable con logo, enlaces, CTA y posición fija opcional.
- Hero, secciones, columnas, texto, imagen, CTA y espaciador.
- Beneficios, métricas, testimonios, precios y preguntas frecuentes con ítems repetibles.
- Formulario visual de contacto y footer con enlaces repetibles.
- Ajustes globales de tipografía, fondo, color de texto y separación entre bloques.
- Render público de ancho completo que comparte la misma configuración del editor.
- Autoguardado del borrador, estado de cambios pendientes y atajo `Ctrl+S` / `Cmd+S`.
- Galería opcional de kits de página completa dentro del builder.
- Confirmación antes de reemplazar un lienzo que ya contiene bloques.
- Formularios conectables al endpoint real de captura CRM mediante canal Formulario Web.
- Biblioteca de medios reutilizada desde Drive CRM para logos, fondos, imágenes, avatares, galerías, videos y carruseles.
- Campo multimedia con miniatura, URL manual, limpieza y filtro por imagen o video.
- Contenedor responsive con padding y visibilidad independientes para escritorio, tablet y móvil.
- Bloques avanzados de galería, video, carrusel, mapa y pestañas.
- Historial de versiones publicadas con restauración no destructiva como borrador.

### Plantillas de embudo incluidas

1. **Órbita SaaS**: promesa, prueba cuantitativa, beneficios, testimonios, planes, FAQ y solicitud de demo.
2. **Aurea Studio**: aspiración, método, experiencia visual, confianza, objeciones y reserva de valoración.
3. **Volt Industrial**: problema operativo, impacto financiero, capacidad técnica, reducción de riesgo y solicitud de cotización.

Las plantillas son puntos de partida opcionales. Al aplicarlas se carga un árbol Puck normal: cada bloque, texto, color, enlace, lista e imagen se puede modificar, reordenar, duplicar o eliminar.

Para activar la captura de un `Formulario de contacto`, selecciona el bloque y configura:

- `ID canal Formulario Web`.
- `Token público del canal`.
- `Producto o campaña` para identificar el origen dentro del CRM.

En el editor el envío queda desactivado para evitar registros accidentales. En preview/publicación se envían nombre, correo, teléfono, mensaje, landing, referrer y UTMs al endpoint de captura CRM.

### Siguientes fases para paridad tipo Elementor Pro

1. Importación directa de Google Drive/OneDrive a almacenamiento interno, recorte y focal point. Las URLs OAuth temporales no deben guardarse en páginas públicas.
2. Ampliar estilos responsive a tipografía, margen, orden y controles propios de cada bloque.
3. Tema global persistido: paleta, tipografías, botones, contenedores y presets reutilizables.
4. Completar formularios CRM con consentimiento, captcha y automatizaciones posteriores a la captura.
5. Bloques adicionales: acordeón, equipo, logos, countdown y embeds permitidos.
6. Plantillas de sección y páginas completas insertables con un clic.
7. Copiar/pegar entre páginas, revisiones de autoguardado y estilos globales reutilizables.
8. SEO por página, Open Graph, schema, analytics y optimización de imágenes.

### Sitios y paginas

- Crear sitio.
- Crear multiples paginas por sitio.
- Slug por pagina.
- Home definida por sitio.
- Estado draft, preview, published.
- Versionado con rollback.

### Publicacion

- Subdominio de plataforma como primera fase.
- Dominio propio como segunda fase.
- Render publico por host y slug.

### CRM

- Formularios conectados a lead, oportunidad, conversación o agenda.
- Eventos de envio con trazabilidad de pagina y sitio.

## Propuesta de modelos Prisma

### WebsiteProject

- id
- empresaId
- websiteServiceId nullable
- nombre
- slug
- subdomain
- primaryDomain
- status
- templateKey
- themeJson
- seoJson
- publishedVersionId nullable
- createdByUserId
- updatedByUserId
- createdAt
- updatedAt

### WebsiteProjectPage

- id
- websiteProjectId
- nombre
- slug
- isHome
- seoTitle
- seoDescription
- status
- createdAt
- updatedAt

### WebsiteProjectPageVersion

- id
- websiteProjectPageId
- versionNumber
- editorJson
- renderedSnapshotJson nullable
- isPublished
- createdByUserId
- createdAt

### WebsiteProjectDomain

- id
- websiteProjectId
- hostname
- kind SUBDOMAIN or CUSTOM
- isPrimary
- verificationStatus
- sslStatus
- dnsTarget
- verifiedAt nullable
- createdAt
- updatedAt

### WebsiteProjectAsset

- id
- websiteProjectId
- path
- url
- mimeType
- sizeBytes
- width nullable
- height nullable
- createdByUserId
- createdAt

### WebsiteProjectFormBinding

- id
- websiteProjectPageId
- blockId
- bindingKind
- crmTargetType
- crmConfigJson
- createdAt
- updatedAt

## Rutas sugeridas

### Dashboard

- /dashboard/configuracion/servicios-web
- /dashboard/configuracion/servicios-web/sitios
- /dashboard/configuracion/servicios-web/builder
- /dashboard/configuracion/servicios-web/sitios/[projectId]
- /dashboard/configuracion/servicios-web/sitios/[projectId]/pages/[pageId]/builder
- /dashboard/configuracion/servicios-web/sitios/[projectId]/domains

### API privadas

- GET POST /api/servicios-web/projects
- GET PUT DELETE /api/servicios-web/projects/[projectId]
- GET POST /api/servicios-web/projects/[projectId]/pages
- GET POST /api/servicios-web/pages/[pageId]/versions
- PUT /api/servicios-web/pages/[pageId]/draft
- POST /api/servicios-web/pages/[pageId]/publish
- GET POST /api/servicios-web/projects/[projectId]/domains
- POST /api/servicios-web/projects/[projectId]/assets

### Render publico

- /api/public/sites/resolve-host
- Ruta publica por middleware basado en Host
- Resolver hostname -> project/domain -> home page o slug

## Publicacion por dominio

### Fase 1

- Wildcard de subdominios: *.ordex.com
- Resolver por cabecera Host dentro de Next.

### Fase 2

- Dominios propios conectados por DNS.
- Verificacion de CNAME o TXT.
- SSL automatico en proxy.

## Renderer

- El renderer publico no interpreta HTML libre.
- El renderer mapea block type -> React component permitido.
- Cada bloque usa props validadas con Zod antes de renderizar.

## Seguridad

- Nada de script custom del usuario en V1.
- Nada de iframe arbitrario excepto embeds permitidos.
- Sanitizar URLs externas.
- Formularios con rate limiting y captcha cuando aplique.

## Fases de implementacion

### Fase 1

- Agregar modelos Prisma.
- CRUD de proyectos y paginas.
- Pantalla Sitios.
- Preview simple.

### Fase 2

- Integrar Puck embebido.
- Guardado draft por pagina.
- Versionado.

### Fase 3

- Publicacion por subdominio.
- Resolver host y render publico.

### Fase 4

- Dominio propio.
- Verificacion DNS.
- SSL y panel de estado.

### Fase 5

- Plantillas verticales.
- Analytics basicos.
- Blog/CMS controlado.

## Primera tarea tecnica recomendada

1. Crear modelos Prisma WebsiteProject, WebsiteProjectPage y WebsiteProjectPageVersion.
2. Montar la pantalla Sitios con CRUD basico.
3. Agregar el editor Puck en una ruta protegida con datos mock persistidos.
4. Definir el bloque CRMForm como bloque estrategico del producto.