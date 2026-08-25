# ORDEX ROP - Contratos API y Eventos v1

Fecha de referencia: 2026-08-20

Objetivo: definir los contratos mínimos estables para implementar Fase 0 y Fase 1 de ORDEX ROP sin depender de decisiones ad hoc en rutas o componentes.

## 1. Principios de contrato

- Los contratos exponen lenguaje de negocio, no nombres internos del ERP.
- Las entidades compartidas usan IDs propios de ROP.
- Las referencias al ERP viajan como `sourceRef` o `externalRef`, no como joins implícitos.
- La versión inicial debe priorizar claridad, explicabilidad y compatibilidad futura.

## 2. Convenciones comunes

### Headers sugeridos

- `X-Tenant-Id`
- `X-Company-Id`
- `X-Actor-User-Id`
- `Idempotency-Key` en escrituras sensibles

### Envelope de respuesta sugerido

```ts
type ApiResponse<T> = {
  data: T
  meta?: {
    requestId?: string
    timestamp?: string
    version?: 'v1'
  }
  error?: null
}
```

### Envelope de error sugerido

```ts
type ApiError = {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  meta?: {
    requestId?: string
    timestamp?: string
    version?: 'v1'
  }
}
```

## 3. APIs v1 mínimas

## 3.1 Perfil operativo de empresa

### GET /api/rop/v1/companies/me/profile

Uso:

- leer perfil operativo de la empresa actual.

Respuesta principal:

```ts
type CompanyOperationalProfile = {
  companyId: string
  companyType: 'INTERNAL' | 'EXTERNAL' | 'PARTNER'
  legalName: string
  brandName?: string | null
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
  onboardingStatus: 'DRAFT' | 'ACTIVE' | 'SUSPENDED'
  location: {
    countryCode: string
    region?: string | null
    city?: string | null
  }
  coverageScope?: 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT' | null
  descriptionPublic?: string | null
  services: Array<{
    companyServiceId: string
    serviceCatalogId: string
    categoryName: string
    subcategoryName: string
    serviceName: string
    leadTimeHours?: number | null
  }>
  profileCompletionPercent: number
  visibility: {
    profile: 'PRIVATE' | 'NETWORK' | 'PUBLIC'
    capacity: 'PRIVATE' | 'NETWORK' | 'PUBLIC'
  }
}
```

### PUT /api/rop/v1/companies/me/profile

Uso:

- crear o actualizar perfil operativo.

Request:

```ts
type UpsertCompanyOperationalProfileInput = {
  brandName?: string | null
  descriptionPublic?: string | null
  location: {
    countryCode: string
    region?: string | null
    city?: string | null
  }
  coverageScope?: 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT' | null
  visibilityLevel: 'PRIVATE' | 'NETWORK' | 'PUBLIC'
  serviceSelections: Array<{
    serviceCatalogId: string
    publicTitle?: string | null
    leadTimeHours?: number | null
    minOrderValue?: number | null
  }>
}
```

Eventos emitidos:

- `rop.company_profile_updated`
- `rop.company_profile_published` si pasa a visible en red

## 3.2 Capacidad y disponibilidad

### GET /api/rop/v1/companies/me/capacity

Uso:

- leer capacidad publicada por servicio.

### PUT /api/rop/v1/companies/me/capacity

Uso:

- crear o reemplazar snapshot de capacidad vigente.

Request:

```ts
type UpsertCapacitySnapshotInput = {
  items: Array<{
    companyServiceId: string
    availableQuantity: number
    reservedQuantity?: number | null
    status: 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE'
    availableFrom: string
    availableUntil: string
    slaHours?: number | null
    sourceType: 'MANUAL' | 'ERP_EVENT' | 'API'
  }>
}
```

### PUT /api/rop/v1/companies/me/availability-slots

Uso:

- actualizar slots horarios o fechas concretas.

Request:

```ts
type UpsertAvailabilitySlotsInput = {
  items: Array<{
    companyServiceId: string
    dayOfWeek?: number | null
    specificDate?: string | null
    startTime?: string | null
    endTime?: string | null
    slotStatus: 'OPEN' | 'BLOCKED' | 'RESERVED'
    recurrenceRule?: string | null
  }>
}
```

Eventos emitidos:

- `rop.capacity_published`
- `rop.capacity_changed`

## 3.3 Home ROP y discovery

### GET /api/rop/v1/home

Uso:

- obtener hero contextual y carriles iniciales.

Respuesta principal:

```ts
type RopHomeResponse = {
  cluster: {
    clusterId: string
    name: string
    reason: string
  } | null
  hero: {
    title: string
    summary: string
    primaryAction: {
      type: 'PUBLISH_NEED' | 'VIEW_RECOMMENDATIONS' | 'COMPLETE_PROFILE'
      label: string
    }
    secondaryAction?: {
      type: 'VIEW_CLUSTER' | 'EDIT_PROFILE'
      label: string
    } | null
  }
  rails: Array<{
    key: 'RECOMMENDED_COMPANIES' | 'CAPACITY_TODAY' | 'NEARBY_COMPANIES' | 'FREQUENT_ALLIES'
    title: string
    items: Array<RopCard>
  }>
}

type RopCard = {
  id: string
  kind: 'COMPANY' | 'CAPACITY' | 'OPPORTUNITY' | 'CELL'
  title: string
  subtitle?: string | null
  score?: number | null
  trustScore?: number | null
  availabilityLabel?: string | null
  reason: string
  primaryAction: {
    type: 'INVITE' | 'VIEW_COMPATIBILITY' | 'OPEN_PROFILE' | 'OPEN_CELL'
    label: string
  }
}
```

### GET /api/rop/v1/discovery/companies

Uso:

- listar empresas relevantes por filtros.

Query params sugeridos:

- `serviceCatalogId`
- `city`
- `coverageScope`
- `minTrustScore`
- `availabilityStatus`
- `clusterId`

## 3.4 Necesidades e invitaciones

### POST /api/rop/v1/opportunities

Uso:

- publicar una necesidad operativa.

Request:

```ts
type CreateOpportunityInput = {
  title: string
  descriptionPublic?: string | null
  requirementsPrivate?: string | null
  categoryId: string
  subcategoryId: string
  serviceCatalogId: string
  location: {
    countryCode: string
    region?: string | null
    city?: string | null
  }
  expectedQuantity?: number | null
  dueAt?: string | null
  visibilityLevel: 'PRIVATE' | 'CLUSTER' | 'NETWORK'
  sourceType: 'MANUAL' | 'CRM' | 'PURCHASE' | 'OPS_SIGNAL' | 'API'
  sourceRef?: string | null
}
```

### POST /api/rop/v1/opportunities/{opportunityId}/recommendations

Uso:

- recalcular shortlist para una necesidad.

Respuesta principal:

```ts
type OpportunityRecommendationResult = {
  opportunityId: string
  generatedAt: string
  candidates: Array<{
    companyId: string
    score: number
    tier: 'PRIORITARIO' | 'FUERTE' | 'VIABLE' | 'EXPLORATORIO'
    positives: string[]
    constraints: string[]
    recommendedAction: 'INVITE' | 'REVIEW' | 'WATCH'
  }>
}
```

### POST /api/rop/v1/opportunities/{opportunityId}/invitations

Uso:

- invitar una o varias empresas.

Request:

```ts
type CreateInvitationsInput = {
  recipientCompanyIds: string[]
  messagePublic?: string | null
  shareBudget?: boolean
  shareAttachments?: boolean
  expiresAt?: string | null
}
```

Eventos emitidos:

- `rop.opportunity_created`
- `rop.recommendations_generated`
- `rop.invitation_sent`

## 4. Eventos de entrada desde ERP

## 4.1 quote.requested_external_support

Uso:

- indicar que una cotización requiere aliado externo.

Payload:

```ts
type QuoteRequestedExternalSupportEvent = {
  eventName: 'quote.requested_external_support'
  tenantId: string
  companyId: string
  occurredAt: string
  sourceRef: {
    type: 'QUOTE'
    id: string
    number?: string | null
  }
  requestedService: {
    categoryId?: string | null
    subcategoryId?: string | null
    serviceCatalogId?: string | null
    city?: string | null
    expectedQuantity?: number | null
    dueAt?: string | null
  }
}
```

## 4.2 purchase.need_created

Uso:

- convertir una necesidad de compra en señal para sugerencias o publicación rápida.

## 4.3 work_order.capacity_changed

Uso:

- informar saturación, liberación o cambio de capacidad derivado de operación.

Payload base:

```ts
type WorkOrderCapacityChangedEvent = {
  eventName: 'work_order.capacity_changed'
  tenantId: string
  companyId: string
  occurredAt: string
  serviceCatalogId?: string | null
  deltaStatus: 'UP' | 'DOWN' | 'SATURATED' | 'RECOVERED'
  availableQuantity?: number | null
  sourceRef?: {
    type: 'WORK_ORDER'
    id: string
  } | null
}
```

## 4.4 collaboration.completed

Uso:

- disparar snapshot de colaboración para Trust Score.

## 5. Eventos emitidos por ORDEX ROP

## 5.1 rop.company_profile_published

Uso:

- notificar que una empresa quedó visible en la red.

## 5.2 rop.match_found

Uso:

- notificar que existe al menos un match fuerte desde contexto ERP.

Payload base:

```ts
type RopMatchFoundEvent = {
  eventName: 'rop.match_found'
  tenantId: string
  companyId: string
  occurredAt: string
  sourceRef?: {
    type: 'QUOTE' | 'PURCHASE' | 'PROJECT' | 'WORK_ORDER'
    id: string
  } | null
  candidateCount: number
  topCompanyIds: string[]
}
```

## 5.3 rop.invitation_sent

Uso:

- notificar invitación operativa emitida.

## 5.4 rop.invitation_accepted

Uso:

- disparar creación sugerida o automática de célula.

## 5.5 rop.business_cell_created

Uso:

- anunciar que una colaboración ya pasó de intención a ejecución.

## 5.6 rop.trust_score_recomputed

Uso:

- sincronizar cambios relevantes de reputación al ERP y a analítica.

Payload base:

```ts
type RopTrustScoreRecomputedEvent = {
  eventName: 'rop.trust_score_recomputed'
  tenantId: string
  companyId: string
  occurredAt: string
  previousScore?: number | null
  currentScore: number
  delta?: number | null
  trigger: 'COLLABORATION_COMPLETED' | 'DISPUTE_RESOLVED' | 'MANUAL_REVIEW'
}
```

## 6. Orden recomendado de implementación de contratos

1. perfil operativo,
2. capacidad y disponibilidad,
3. home y discovery,
4. oportunidades,
5. invitaciones,
6. eventos ERP de entrada,
7. eventos de salida.

## 7. Decisiones abiertas aún no bloqueantes

- Si `GET /home` debe devolver todo el home montado o solo carriles declarativos.
- Si la recomendación se recalcula sincrónicamente o por job corto con polling.
- Si empresas externas usan el mismo `companyId` namespace o uno segregado con mapping.

## 8. Criterio de salida

- El equipo backend puede implementar endpoints sin reabrir semántica básica.
- El equipo frontend puede consumir payloads coherentes para home, perfil e invitación.
- El ERP puede publicar eventos de entrada con contratos explícitos.
- El dominio ROP queda protegido de integraciones por acoplamiento implícito.