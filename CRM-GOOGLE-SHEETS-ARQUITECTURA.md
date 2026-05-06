# CRM Google Sheets

## Objetivo

Montar Google Sheets como bridge comercial del CRM existente, sin crear otro subsistema. La primera iteración usa una hoja publicada o accesible vía CSV, y expone preview, import y export sobre el mismo canal CRM.

## Modelo de conexión

- Entidad base: CrmChannelConnection existente.
- Provider: WEB_FORM.
- Bridge kind: GOOGLE_SHEETS dentro de settingsJson.
- Settings mínimos del canal:
  - googleSheetsPublishedCsvUrl
  - googleSheetsSpreadsheetId
  - googleSheetsSheetName
  - googleSheetsRowLimit
  - googleSheetsImportMode
  - googleSheetsOpportunityStage
- Fuente actual: CSV de Google Sheets publicado o resoluble por spreadsheetId + sheetName.
- Motivo de este enfoque: entrega una integración usable hoy para operación comercial, sin esperar OAuth de Google ni service account.

## Endpoints

- GET /api/crm/channels/:id/google-sheets/preview
  - Permiso: CRM READ.
  - Lee la hoja configurada y devuelve headers, totalRows y preview normalizado.
- POST /api/crm/channels/:id/google-sheets/import
  - Permiso: CRM WRITE.
  - Importa filas al CRM usando createInboundArtifacts.
  - Modo opcional: LEADS_AND_OPPORTUNITIES crea oportunidades CRM si la fila trae título, valor esperado o producto.
- GET /api/crm/channels/:id/google-sheets/export
  - Permiso: CRM READ.
  - Exporta a CSV las capturas del propio canal con lead, atribución y oportunidad asociada.

## Normalización de columnas

Se aceptan aliases comunes, por ejemplo:

- nombre, name, contacto
- email, correo, mail
- telefono, celular, whatsapp, phone
- empresa, company
- producto, servicio, product, service
- mensaje, detalle, notes
- campaign, campana, utm_campaign
- expected value, presupuesto, monto
- opportunity title, oportunidad, deal

La normalización ocurre antes de crear lead, conversación y captura.

## Permisos

- Todas las rutas requieren acceso al módulo CRM.
- Se respeta assertCrmSedeAccess si el canal está amarrado a una sede.
- El canal debe estar configurado como WEB_FORM + bridgeKind GOOGLE_SHEETS.

## QA esperado

- Preview debe fallar claro si no existe CSV o la hoja no es accesible.
- Import debe omitir filas vacías sin romper la corrida completa.
- Reimportar la misma hoja debe ser estable por rowKey derivado del canal, pestaña y fila.
- Export debe devolver solo capturas del canal actual.
- Si importMode es LEADS_AND_OPPORTUNITIES, la oportunidad se crea una sola vez por lead + título activo.

## Riesgos conocidos

- Esta iteración no usa OAuth ni service account.
- Si la estructura de la hoja cambia mucho, la heurística de aliases puede degradarse.
- El rowKey actual es estable por número de fila; si el usuario reordena filas manualmente, puede cambiar la idempotencia esperada.

## Siguiente fase

- OAuth o service account para hojas privadas.
- Sync incremental por timestamp o checksum de fila.
- Botones UI de preview/import/export desde el centro de integraciones.
- Scheduler para corridas programadas.
