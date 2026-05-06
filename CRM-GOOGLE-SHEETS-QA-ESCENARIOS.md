# QA Google Sheets CRM

## Escenario 1. Preview exitoso

- Dado un canal WEB_FORM con bridgeKind GOOGLE_SHEETS.
- Y una URL CSV válida o spreadsheetId + sheetName válidos.
- Cuando ejecuto GET /api/crm/channels/:id/google-sheets/preview.
- Entonces recibo success true.
- Y veo headers, totalRows y preview normalizado.

## Escenario 2. Falla por hoja inaccesible

- Dado un canal Google Sheets con URL CSV inválida o permisos rotos.
- Cuando ejecuto preview.
- Entonces recibo error claro indicando que no se pudo leer la hoja.

## Escenario 3. Import solo leads

- Dado un canal con googleSheetsImportMode = LEADS_ONLY.
- Y una hoja con nombre, correo, teléfono y mensaje.
- Cuando ejecuto POST /api/crm/channels/:id/google-sheets/import.
- Entonces se crean leads, conversaciones y capturas.
- Y no se crean oportunidades.

## Escenario 4. Import leads y oportunidades

- Dado un canal con googleSheetsImportMode = LEADS_AND_OPPORTUNITIES.
- Y filas con producto y valor esperado.
- Cuando ejecuto import.
- Entonces cada fila válida entra al CRM.
- Y además se crea oportunidad ligada a la conversación si no existe una activa equivalente.

## Escenario 5. Filas vacías no rompen la corrida

- Dado un CSV con filas vacías o sin datos mínimos de contacto.
- Cuando ejecuto import.
- Entonces esas filas quedan como skipped.
- Y la corrida continúa con las demás filas.

## Escenario 6. Idempotencia razonable por fila

- Dado que importé una hoja una vez.
- Cuando vuelvo a importar sin mover filas.
- Entonces el sistema reutiliza rowKey estable por canal + pestaña + fila.
- Y no debería disparar una explosión de duplicados en conversación/captura.

## Escenario 7. Export del canal

- Dado un canal con capturas previas de Google Sheets.
- Cuando ejecuto GET /api/crm/channels/:id/google-sheets/export.
- Entonces recibo CSV descargable.
- Y el archivo contiene solo capturas del canal, con lead, atribución y oportunidad asociada.

## Escenario 8. Sede restringida

- Dado un canal ligado a una sede.
- Y un usuario sin permiso suficiente sobre esa sede.
- Cuando intenta preview, import o export.
- Entonces la API debe rechazar la operación por acceso.

## Escenario 9. Centro de integraciones

- Dado el preset Google Sheets Bridge en el wizard.
- Cuando creo o edito el canal.
- Entonces puedo configurar URL CSV, spreadsheetId, sheetName, rowLimit y modo de importación.
- Y el canal muestra endpoints de preview, import y export en la pestaña Bridges.

## Escenario 10. Cambio a producción controlada

- Dado un canal validado en preview e import.
- Cuando se pasa a ACTIVE.
- Entonces el equipo puede operar importaciones manuales recurrentes.
- Y la trazabilidad queda dentro del CRM existente, sin módulo paralelo.
