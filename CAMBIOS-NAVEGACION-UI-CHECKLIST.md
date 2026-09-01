# Checklist Vivo - Navegacion, UI, Reubicacion de Modulos y Permisos

Fecha de referencia: 2026-09-01

Objetivo: mantener el hilo de los cambios transversales de navegacion, estructura de modulos, permisos y tema visual sin repetir trabajo ya hecho ni romper coherencia entre rutas, sidebar, tabs y RBAC.

## Reglas de uso

- [ ] Marcar un item como hecho solo cuando el cambio visual o funcional exista y tenga validacion minima.
- [ ] Si un item cambia de alcance, no reusar el mismo ID: crear uno nuevo y dejar nota.
- [ ] Cada bloque debe registrar validacion tecnica minima antes de seguir al siguiente bloque dependiente.
- [ ] No mover rutas o modulos sin revisar el impacto en permisos, breadcrumbs, tabs y enlaces del sidebar.
- [ ] No cerrar el bloque de tema oscuro hasta validar contraste y jerarquia en al menos sidebar, cards, tablas, dialogs y tabs.

## Orden recomendado de ejecucion

1. Base visual compartida: sidebar + sticky headers + divisores.
2. Reestructuracion de modulos y renombres del menu.
3. Notificaciones unificadas.
4. Super admin modal de modulos.
5. Drive ACL y visibilidad por usuario.
6. Automatizacion y KPIs.
7. Reubicacion de conversaciones y escaneos.
8. Alineacion final de permisos, breadcrumbs, tabs y rutas.
9. Tema oscuro.

## Bloque A. Base visual compartida

### Sidebar izquierdo

- [x] NAV-001: cambiar el background global del menu lateral izquierdo a #f2f2f4.
- [x] NAV-002: cambiar textos del menu lateral izquierdo a #101010.
- [x] NAV-003: mantener texto blanco en estado hover del menu lateral.
- [x] NAV-004: revisar estados activos, hover, focus y disabled para que sigan siendo legibles con la nueva base clara.

### Header sticky de cada ventana

- [x] UI-001: volver sticky la franja superior de cada seccion con nav, breadcrumbs y tabs donde existan.
- [x] UI-002: agregar divisor visual inferior de 1px con color #2b2e401a en esa franja sticky.
- [ ] UI-003: validar que el sticky no tape contenido ni rompa scroll en desktop.
- [ ] UI-004: validar que el sticky no rompa layout en mobile y tablets.
- [x] UI-005: unificar spacing vertical de headers sticky entre modulos.

## Bloque B. Reestructuracion del mapa de modulos

### Inicio, Administracion y Configuracion

- [x] IA-001: dejar Inicio como modulo sin submodulos.
- [x] IA-002: quitar Dashboard como subitem y absorberlo dentro de Inicio.
- [x] IA-003: mover Mapa de producto a Administracion.
- [x] IA-004: mover Plantillas a Configuracion.
- [x] IA-005: actualizar breadcrumbs, tabs internos y accesos rapidos afectados por ese reordenamiento.

### Costos, CRM y Sitios web

- [x] IA-006: sacar Litografia como modulo visible del grupo actual y renombrar la experiencia a Costos.
- [x] IA-007: mover Costos desde Operaciones hacia Configuracion.
- [x] IA-008: mover Servicios web dentro de CRM.
- [x] IA-009: renombrar Servicios web a Sitios web.
- [x] IA-010: renombrar Negociaciones a CRM.
- [x] IA-011: cambiar icono de Negociaciones/CRM por un embudo.
- [x] IA-012: renombrar Canales e integraciones a Automatizacion.
- [x] IA-013: cambiar el icono de Canales e integraciones por uno de robot.
- [x] IA-014: mover Conversaciones fuera de Operaciones y dentro de CRM.
- [x] IA-015: mover Escaneos dentro de Ventas.

## Bloque C. Notificaciones unificadas

- [x] NOTI-001: quitar Notificaciones del modulo Administracion.
- [x] NOTI-002: dejar solo el acceso de notificaciones en la parte superior junto al avatar.
- [x] NOTI-003: cambiar ese acceso para que muestre explicitamente la palabra Notificaciones y mantener el icono.
- [x] NOTI-004: agregar dos tabs en la ventana emergente: Todos y Sin leer.
- [x] NOTI-005: hacer que el tab Todos redirija al panel de notificaciones.
- [x] NOTI-006: hacer que el tab Sin leer liste solo notificaciones nuevas no abiertas.
- [x] NOTI-007: cambiar la accion principal a Marcar todo como leido.
- [x] NOTI-008: archivar notificaciones despues de completar la accion de marcar todo como leido; el usuario decide luego si las borra.
- [ ] NOTI-009: validar contadores, badge superior y transiciones entre leido/no leido.

## Bloque D. Super admin

- [x] SA-001: revisar por que los toggles on/off de modulos en Ver detalle no estan aplicando cambios reales.
- [x] SA-002: corregir persistencia o wiring de los toggles on/off del modal.
- [x] SA-003: reducir la altura util del modal para que no desborde la pantalla.
- [x] SA-004: agregar scroll al contenido total del modal de detalle.
- [ ] SA-005: validar visualmente que footer, acciones y contenido sigan accesibles con scroll.

## Bloque E. Drive, archivos y permisos por usuario

### Visibilidad y ACL

- [x] DRIVE-001: restringir que usuarios no vean carpetas, imagenes ni archivos de otros usuarios por defecto, aunque pertenezcan a la misma empresa o sede.
- [x] DRIVE-002: permitir acceso a archivos ajenos solo cuando exista permiso explicito.
- [x] DRIVE-003: permitir que un usuario comparta carpeta con otro usuario concreto.
- [x] DRIVE-004: soportar permisos de comparticion incluso entre usuarios de la misma sede solo cuando hayan sido otorgados.
- [x] DRIVE-005: definir ACL tambien para archivos IA, imagenes y vectorizadores.

### Vistas funcionales

- [x] DRIVE-006: agregar pestaña Archivos propios.
- [x] DRIVE-007: agregar pestaña Archivos compartidos.
- [x] DRIVE-008: permitir que solo el administrador de empresa pueda ver todo.
- [x] DRIVE-009: permitir al administrador filtrar por sede o a nivel empresa.
- [x] DRIVE-010: agregar opcion de compartir al momento de crear una carpeta.

### Seguridad y validacion

- [x] DRIVE-011: revisar endpoints, queries y storage para que no filtren archivos por empresa cuando deberian filtrar por owner o ACL.
- [x] DRIVE-012: validar lectura, listado, upload, rename, delete y share bajo ACL.
- [x] DRIVE-013: validar archivos IA y vectorizadores bajo la misma politica.

Archivos tocados en este bloque:
- src/lib/crm-files.ts
- src/lib/api-rbac.ts
- src/lib/litografia-ai-pending-images.ts
- src/lib/litografia-ai-pending-vectorizations.ts
- src/app/api/crm/files/route.ts
- src/app/api/litografia/ia/imagenes/route.ts
- src/app/api/litografia/ia/vectorizar/route.ts
- scripts/test-ai-history-acl.ts
- scripts/test-crm-files-acl.ts
- package.json

Validacion ejecutable añadida en este bloque:
- npm run test:crm-files-acl
- src/app/dashboard/litografia/auditoria-ia/page.tsx
- src/components/crm/crm-files-manager-client.tsx

Validación ejecutable añadida:
- npm run test:ai-history-acl

## Bloque F. Automatizacion y KPIs

- [x] AUTO-001: renombrar Canales e integraciones a Automatizacion en sidebar, headers, breadcrumbs y paginas hijas.
- [x] AUTO-002: renombrar la pestaña Metricas y metas a KPIs.
- [x] AUTO-003: rediseñar la explicacion funcional de KPIs para que se entienda si la configuracion aplica por sede, por empresa o por canal/campaña.
- [x] AUTO-004: permitir configurar KPIs por sede.
- [x] AUTO-005: permitir configurar KPIs a nivel general de empresa.
- [x] AUTO-006: permitir configurar KPIs por canal.
- [x] AUTO-007: permitir configurar KPIs por campaña dentro del canal cuando aplique.
- [x] AUTO-008: permitir definir conversiones objetivo por contexto.
- [x] AUTO-009: agregar margen o porcentaje minimo de aceptacion.
- [x] AUTO-010: validar copy, labels y estados vacios para que la pantalla sea entendible sin capacitacion previa.

Archivos tocados en este bloque:
- src/lib/company-crm-kpi-settings.ts
- src/app/api/crm/kpis/route.ts
- src/components/crm/crm-integrations-client.tsx
- src/components/crm/crm-integrations-metrics-tab.tsx

Validacion ejecutable añadida en este tramo:
- npm run typecheck

## Bloque G. Permisos y nuevos enrutamientos

- [x] RBAC-001: actualizar sidebar y catalogo de navegacion para reflejar todos los renombres y movimientos de modulo.
- [x] RBAC-002: actualizar permisos por dominio, subdominio, modulo o href segun los nuevos destinos.
- [x] RBAC-003: revisar allowedNavHrefs, allowedModules y catalogos equivalentes.
- [x] RBAC-004: revisar breadcrumbs rotos despues de mover rutas.
- [x] RBAC-005: revisar tabs internos y accesos rapidos despues de mover rutas.
- [x] RBAC-006: validar que usuarios con permisos heredados sigan viendo solo lo que corresponde.
- [x] VAL-006: typecheck limpio despues de actualizar enrutamientos y RBAC.
- [x] RBAC-008: definir matriz final de mapeo viejo -> nuevo para rutas y permisos.

Validacion ejecutable añadida en este bloque:
- npm run test:dashboard-access-rbac

Matriz final viejo -> nuevo:

| Antes | Ahora | Ruta canonica | Ruta heredada / nota | Permiso o capacidad final |
| --- | --- | --- | --- | --- |
| Dashboard con accesos mezclados en Inicio | Inicio solo como acceso base | /dashboard | Inteligencia, ROP, Perfil, Ayuda y Mapa quedaron separados | CORE.HOME |
| Inteligencia dentro de Inicio | Inteligencia en Analitica | /dashboard/inteligencia | sin alias nuevo adicional | modulo REPORTES |
| ROP mezclado con Inicio | Red operativa en Operaciones | /dashboard/rop | mantiene sus hijas /activar, /perfil, /empresas, /necesidades | CORE.ROP |
| Inbox CRM en /dashboard/crm/conversations | Conversaciones unificadas | /dashboard/chat | /dashboard/crm/conversations queda como ruta heredada de compatibilidad | OPERACIONES.INTERNAL_CHAT y OPERACIONES.GLOBAL_CHAT_CRM |
| Canales e integraciones | Automatizacion | /dashboard/crm/integraciones | mismo path, nuevo nombre funcional | CAPTACION.CHANNELS |
| Metricas y metas | KPIs | /dashboard/crm/integraciones | cambio interno de tab y copy, no de path | CAPTACION.CHANNELS |
| CRM agenda como submodulo aislado | Calendario comercial | /dashboard/crm/agenda | tambien existe calendario en negociaciones | CAPTACION.AGENDA |
| Archivos CRM sin politica por usuario | DRIVE comercial | /dashboard/crm/archivos | ACL por owner, shared y admin | OPERACIONES.FILES |
| Litografia como modulo lateral | Costos | /dashboard/litografia | conserva superficies IA relacionadas | OPERACIONES.COSTS |
| Notificaciones visibles en sidebar | Notificaciones fuera del lateral principal | /dashboard/notificaciones | crear sigue en /dashboard/notificaciones/crear; dispositivos en /dashboard/configuracion/notificaciones | CORE.NOTIFICATIONS |
| Sitios web dentro de configuracion general | Sitios web en Captacion | /dashboard/configuracion/servicios-web | mueve ubicacion conceptual, no cambia path | sin moduleKey; acceso por surface dedicada |
| Perfil y Ayuda mezclados con utilidades varias | Administracion | /dashboard/perfil y /dashboard/ayuda | Ayuda sigue sin moduleKey; Perfil sigue siendo acceso base de usuario | acceso directo de usuario |

## Bloque H. Tema oscuro
- [x] DARK-001: implementar tema oscuro base con fondo #121212.
- [x] DARK-002: aplicar texto principal #E0E0E0.
- [x] DARK-003: aplicar texto secundario #B0B0B0.
- [x] DARK-004: aplicar bordes y divisores #444444.
- [x] DARK-005: aplicar acento #888888.
- [ ] DARK-006: validar sidebar en modo oscuro con la nueva jerarquia.
- [ ] DARK-007: validar headers sticky y divisores en modo oscuro.
- [ ] DARK-008: validar tabs, dialogs, tablas, formularios y cards en modo oscuro.
- [ ] DARK-009: validar contraste hover/active/focus de botones y links.
- [ ] DARK-010: validar que iconos y badges sigan siendo legibles.

## Checklist tecnico por superficie

### Navegacion

- [ ] TEC-001: sidebar principal.
- [ ] TEC-002: catalogo de permisos/dashboard.
- [ ] TEC-003: breadcrumbs compartidos.
- [ ] TEC-004: tabs compartidos.

### Notificaciones

- [ ] TEC-005: trigger superior de notificaciones.
- [ ] TEC-006: dropdown o panel emergente de notificaciones.
- [ ] TEC-007: pagina completa de notificaciones.
- [ ] TEC-008: acciones marcar leido / borrar.

### Drive

- [x] TEC-009: modelo de permisos o ACL de carpetas/archivos.
- [x] TEC-010: APIs de listado, compartir y detalle.
- [x] TEC-011: UI de archivos propios/compartidos.
- [x] TEC-012: storage de archivos IA y vectorizadores.

### Super admin

- [x] TEC-013: modal de detalle de empresa/modulos.
- [x] TEC-014: wiring de toggles y persistencia.

## Validacion minima por bloque

- [x] VAL-001: typecheck limpio despues de Base visual compartida.
- [x] VAL-002: typecheck limpio despues de Reestructuracion de modulos.
- [ ] VAL-003: prueba visual de notificaciones despues de su refactor.
- [ ] VAL-004: prueba visual y funcional del modal de super admin.
- [x] VAL-005: pruebas de permisos sobre Drive con al menos admin, usuario sede A y usuario sede B.
- [x] VAL-006: typecheck limpio despues de actualizar enrutamientos y RBAC.
- [ ] VAL-007: validacion visual de modo oscuro en escritorio y mobile.

## Notas de control

- Bloque A en progreso: sidebar claro aplicado, foco y disabled ajustados, ErpPageHero compartido dejado sticky con divisor inferior y subheaders de ROP, Contabilidad, Negociaciones CRM y Servicios web alineados a la nueva franja superior.
- Pendiente Bloque A: validacion visual UI-003 y UI-004. El navegador integrado redirige a /auth/login, asi que no pude confirmar desktop/mobile sin una sesion autenticada.
- Pendiente Bloque A: revisar con sesion autenticada que el offset sticky se sienta correcto en desktop y mobile, sobre todo en CRM, ROP, Contabilidad y Servicios web.
- Bloque B en progreso: Dashboard ya no aparece como subitem, Mapa de producto paso a Administracion, Plantillas y Costos pasaron a Configuracion, Sitios web y Conversaciones quedaron dentro de CRM, Escaneos paso a Ventas y se renombraron CRM y Automatizacion en el sidebar.
- Bloque F en progreso: Automatización ya quedó alineada en header, breadcrumbs, accesos rápidos y tabs principales; la pestaña ejecutiva ahora se presenta como KPIs.
- Bloque F adicional: el panel de KPIs ahora aclara de forma explícita qué parte es lectura real del workspace y qué metas siguen siendo overrides locales del navegador, para no confundir sede, empresa, canal o campaña.
- Bloque G en progreso: el catalogo de permisos ya se alineo con la nueva arquitectura. Inicio quedo solo como acceso base; Inteligencia paso a Analitica; ROP a Operaciones; Plantillas y Costos a Configuracion; Sitios web, Conversaciones y Escaneos quedaron reflejados en sus nuevas secciones.
- Bloque G adicional: rutas y CTAs residuales del inbox viejo se redirigieron a /dashboard/chat desde clientes, auditoria IA CRM, notificaciones y accesos rápidos.
- Bloque G validado a nivel ejecutable: npm run test:dashboard-access-rbac confirma que permisos heredados conservan accesos equivalentes sin abrir rutas directGrantOnly como ROP o el chat CRM por arrastre de legado.
- Bloque C en progreso: Notificaciones ya quedó unificada en el trigger superior con texto explícito, el panel emergente tiene tabs Todos y Sin leer, y la acción principal ahora dice Marcar todo como leido.
- Pendiente Bloque C: falta definir la regla final de negocio para NOTI-008 antes de borrar automáticamente notificaciones al marcar todo como leido, y validar visualmente badge, contadores y transiciones.
- Bloque D en progreso: el detalle de empresas en Super Admin ya persiste overrides que sí impactan el sidebar para empresas, y el modal quedó con altura controlada, scroll interno y footer separado del cuerpo.
- Pendiente Bloque D: falta validar visualmente que el footer siga siempre accesible en pantallas pequeñas y durante edición prolongada.
- Bloque B adicional: Inicio ya quedo como acceso base sin submodulos visibles; Inteligencia, ROP, Mi perfil y Ayuda se reubicaron en sus frentes funcionales.
- Bloque B cerrado a nivel de naming visible: breadcrumbs, accesos rapidos y headers principales ya quedaron alineados con CRM, Automatizacion, Sitios web y Costos. Lo pendiente ahora pertenece a RBAC y validacion visual con sesion.
- Pendiente registrar aqui, por item, los archivos tocados cuando empecemos a ejecutar los cambios.
- Si un bloque queda parcial, marcarlo con nota textual debajo del item y no como completado.
- Recomendacion: avanzar primero por estructura y permisos antes de pulir microestilos del tema oscuro.
