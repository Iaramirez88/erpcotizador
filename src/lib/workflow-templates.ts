import type { WorkflowDefinition, WorkflowTriggerConfig } from '@/lib/workflows'

/**
 * Plantillas de ejemplo para que el usuario entienda qué puede hacer un
 * Workflow. Son flujos lineales (el ejecutor recorre los nodos en orden) con
 * disparador webhook.
 */
export type WorkflowTemplate = {
  id: string
  name: string
  description: string
  trigger: WorkflowTriggerConfig
  definition: WorkflowDefinition
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'echo-webhook',
    name: 'Probar webhook',
    description: 'Recibe un webhook y llama a un endpoint de prueba que devuelve lo que recibe.',
    trigger: { kind: 'WEBHOOK', cronExpression: null, eventName: null },
    definition: {
      variables: { echoUrl: 'https://httpbin.org/anything' },
      nodes: [
        { id: 'n-trigger', kind: 'TRIGGER', label: 'Recibir webhook', config: {} },
        { id: 'n-echo', kind: 'HTTP_REQUEST', label: 'Llamar endpoint de prueba', config: { url: '{{echoUrl}}', method: 'GET' } },
        { id: 'n-note', kind: 'NOTE', label: 'Registrar resultado', config: { text: 'El webhook fue procesado.' } },
      ],
      edges: [
        { id: 'e-1', from: 'n-trigger', to: 'n-echo', label: null },
        { id: 'e-2', from: 'n-echo', to: 'n-note', label: null },
      ],
    },
  },
  {
    id: 'forward-webhook',
    name: 'Reenviar a un webhook externo',
    description: 'Recibe un JSON y lo reenvía (POST) a la URL que definas en las variables.',
    trigger: { kind: 'WEBHOOK', cronExpression: null, eventName: null },
    definition: {
      variables: { targetUrl: 'https://tu-servicio.com/hook' },
      nodes: [
        { id: 'n-trigger', kind: 'TRIGGER', label: 'Recibir webhook', config: {} },
        { id: 'n-forward', kind: 'HTTP_REQUEST', label: 'Reenviar payload', config: { url: '{{targetUrl}}', method: 'POST' } },
      ],
      edges: [{ id: 'e-1', from: 'n-trigger', to: 'n-forward', label: null }],
    },
  },
  {
    id: 'lookup-api',
    name: 'Buscar dato en una API',
    description: 'Recibe un webhook y consulta una API externa con la URL configurada.',
    trigger: { kind: 'WEBHOOK', cronExpression: null, eventName: null },
    definition: {
      variables: { apiUrl: 'https://api.example.com/datos' },
      nodes: [
        { id: 'n-trigger', kind: 'TRIGGER', label: 'Recibir webhook', config: {} },
        { id: 'n-lookup', kind: 'HTTP_REQUEST', label: 'Consultar API', config: { url: '{{apiUrl}}', method: 'GET' } },
        { id: 'n-condition', kind: 'CONDITION', label: 'Validar respuesta', config: { text: 'status == 200' } },
      ],
      edges: [
        { id: 'e-1', from: 'n-trigger', to: 'n-lookup', label: null },
        { id: 'e-2', from: 'n-lookup', to: 'n-condition', label: null },
      ],
    },
  },
  {
    id: 'create-lead',
    name: 'Crear lead desde webhook',
    description: 'Recibe un JSON con datos de contacto y crea o actualiza un lead en el CRM.',
    trigger: { kind: 'WEBHOOK', cronExpression: null, eventName: null },
    definition: {
      variables: {},
      nodes: [
        { id: 'n-trigger', kind: 'TRIGGER', label: 'Recibir webhook', config: {} },
        { id: 'n-lead', kind: 'ACTION', label: 'Crear lead', config: { action: 'create_lead', fields: { nombre: '{{nombre}}', email: '{{email}}', phone: '{{telefono}}', empresaNombre: '{{empresa}}', message: '{{mensaje}}' } } },
      ],
      edges: [{ id: 'e-1', from: 'n-trigger', to: 'n-lead', label: null }],
    },
  },
  {
    id: 'full-flow',
    name: 'Flujo completo de captación',
    description: 'Webhook → validar con una API → crear lead → enviar correo de confirmación.',
    trigger: { kind: 'WEBHOOK', cronExpression: null, eventName: null },
    definition: {
      variables: {
        validateUrl: 'https://httpbin.org/anything',
        fromEmail: 'no-reply@tu-dominio.com',
      },
      nodes: [
        { id: 'n-trigger', kind: 'TRIGGER', label: 'Recibir webhook', config: {} },
        { id: 'n-validate', kind: 'HTTP_REQUEST', label: 'Validar con API', config: { url: '{{validateUrl}}', method: 'POST' } },
        { id: 'n-lead', kind: 'ACTION', label: 'Crear lead', config: { action: 'create_lead', fields: { nombre: '{{nombre}}', email: '{{email}}', phone: '{{telefono}}', empresaNombre: '{{empresa}}', message: '{{mensaje}}' } } },
        { id: 'n-email', kind: 'ACTION', label: 'Confirmar por correo', config: { action: 'send_email', fields: { to: '{{email}}', subject: 'Recibimos tu solicitud', body: '<p>Hola {{nombre}}, recibimos tu solicitud y te contactaremos pronto.</p>' } } },
      ],
      edges: [
        { id: 'e-1', from: 'n-trigger', to: 'n-validate', label: null },
        { id: 'e-2', from: 'n-validate', to: 'n-lead', label: null },
        { id: 'e-3', from: 'n-lead', to: 'n-email', label: null },
      ],
    },
  },
]
