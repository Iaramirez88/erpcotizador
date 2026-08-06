# Daily Addon Checklist

## Fase 1. Base plugin activable

- [x] Definir Daily como addon hijo de CRM, no como modulo padre nuevo
- [x] Reutilizar persistencia por empresa con DomainEntitlement + metadata
- [x] Crear catalogo base y parser de configuracion en src/lib/crm-addons.ts
- [x] Exponer API para listar y activar el addon
- [x] Mostrar tarjeta Addons CRM en Integraciones CRM

## Fase 2. Conexion y aprovisionamiento

- [x] Permitir modo SGDigital administrado
- [x] Permitir modo cuenta propia de Daily
- [x] Guardar API key cifrada solo en backend
- [x] Validar dominio/configuracion antes de marcar listo

## Fase 3. Llamadas embebidas

- [x] Crear room por conversacion CRM
- [x] Crear token efimero por participante
- [x] Abrir llamada en modal desde el inbox CRM
- [x] Registrar sesion, duracion y estado en CRM

## Fase 4. Operacion avanzada

- [x] Permisos por usuario para iniciar/unirse/grabar
- [x] Grabacion opcional
- [x] Metricas de uso y consumo mensual
- [x] Cobro/activacion comercial del addon