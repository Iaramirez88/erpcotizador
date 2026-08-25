# ORDEX ROP - Permisos y Scopes

Fecha de referencia: 2026-08-20

Objetivo: definir la capa de autorización inicial de ORDEX ROP para integrarla al RBAC actual sin abrir agujeros de visibilidad entre empresas.

## 1. Principio rector

La red no se gobierna por módulo técnico. Se gobierna por capacidad, rol operativo y alcance de datos compartidos.

## 2. Sujetos base

- administrador de empresa,
- coordinador operativo,
- compras,
- comercial B2B,
- miembro de célula,
- empresa externa,
- super admin plataforma.

## 3. Scopes principales

### Scope de empresa

- alcance por empresa propietaria del workspace.
- controla administración de perfil, políticas y visibilidad.

### Scope de sede

- restringe capacidad, servicios y operación por sede cuando aplique.

### Scope de cluster

- controla lectura o publicación restringida a un cluster.

### Scope de invitación

- habilita acceso puntual a una oportunidad, empresa o célula por invitación.

### Scope de célula

- limita acciones dentro de una célula concreta.

## 4. Capacidades v1

### Dominio `rop.network`

- `activate`
- `view_home`
- `view_discovery`

### Dominio `rop.profile`

- `read`
- `write`
- `publish`
- `manage_visibility`

### Dominio `rop.capacity`

- `read_own`
- `write_own`
- `publish_own`
- `read_network`

### Dominio `rop.opportunities`

- `create`
- `read_own`
- `read_network`
- `invite`
- `close`

### Dominio `rop.cells`

- `create`
- `read`
- `manage_members`
- `manage_files`
- `manage_approvals`
- `close`

### Dominio `rop.trust`

- `read_own`
- `read_network`
- `read_breakdown_private`
- `open_dispute`

### Dominio `rop.admin`

- `manage_clusters`
- `manage_policies`
- `moderate_ratings`
- `override_visibility`

## 5. Matriz inicial por rol

### Administrador de empresa

- puede activar la red,
- puede editar perfil operativo,
- puede publicar capacidad,
- puede definir visibilidad,
- puede crear oportunidades,
- puede invitar empresas,
- puede crear y cerrar células,
- puede leer su Trust Score y breakdown privado.

### Coordinador operativo

- puede publicar capacidad,
- puede crear oportunidades operativas,
- puede invitar empresas,
- puede operar células,
- no puede cambiar políticas globales de visibilidad de empresa.

### Compras

- puede crear necesidades desde compras,
- puede ver recomendaciones de proveedores,
- puede invitar empresas,
- puede leer Trust Score de red,
- no puede publicar el perfil corporativo completo.

### Comercial B2B

- puede crear oportunidades,
- puede descubrir empresas,
- puede invitar,
- puede iniciar células ligadas a proyectos/oportunidades,
- no debe ver breakdown privado del Trust Score de terceros.

### Miembro de célula

- solo accede a la célula donde fue incorporado,
- su visibilidad depende del rol dentro de la célula,
- no adquiere permisos de red por pertenecer a una célula.

### Empresa externa

- puede editar su propio perfil limitado,
- puede responder invitaciones,
- puede entrar a células autorizadas,
- puede ver solo datos compartidos por policy o invitación,
- no puede navegar libremente el ERP ni datos internos de empresa propietaria.

### Super admin plataforma

- puede moderar disputas,
- puede gestionar clusters curados,
- puede suspender empresas de la red,
- puede auditar eventos y overrides.

## 6. Reglas de visibilidad de datos

### Público de red

- nombre comercial,
- ciudad/región,
- servicios ofertados,
- cobertura,
- capacidad resumida,
- Trust Score expuesto según política final,
- badges de verificación.

### Privado de empresa

- NIT,
- dirección exacta,
- notas internas,
- budget privado de oportunidad,
- breakdown privado detallado del Trust Score,
- referencias internas del ERP.

### Compartido por invitación o célula

- archivos seleccionados,
- detalles ampliados de la necesidad,
- hitos y tareas compartidas,
- condiciones específicas aprobadas para ejecución.

## 7. Reglas obligatorias

- ninguna empresa externa ve ids internos del ERP,
- ninguna célula hereda acceso total a la empresa dueña,
- ninguna invitación comparte presupuesto por defecto,
- ningún usuario sin permiso `manage_visibility` cambia exposición de campos,
- ningún breakdown privado del Trust Score se expone a terceros.

## 8. Mapeo sugerido a RBAC actual

ORDEX ROP debe convivir con la base actual de `domain_entitlements`, `capability_entitlements` y grants por usuario.

Mapeo sugerido:

- domain `ROP_NETWORK`
- subdomain `PROFILE`
- subdomain `CAPACITY`
- subdomain `OPPORTUNITIES`
- subdomain `CELLS`
- subdomain `TRUST`
- subdomain `ADMIN`

Ejemplos de acciones:

- `VIEW_HOME`
- `EDIT_PROFILE`
- `PUBLISH_CAPACITY`
- `CREATE_OPPORTUNITY`
- `INVITE_COMPANY`
- `CREATE_CELL`
- `READ_TRUST_BREAKDOWN_PRIVATE`

## 9. Criterio de salida

- Hay lenguaje estable para grants y scopes de ROP.
- El equipo puede sembrar entitlements sin inventar permisos ad hoc.
- La experiencia de empresas externas queda controlada desde la base.