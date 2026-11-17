import type { WorkflowNodeKind } from '@prisma/client'
import type { WorkflowNode } from '@/lib/workflows'

export type WorkflowActionKey =
  | 'create_lead'
  | 'create_opportunity'
  | 'send_email'
  | 'send_whatsapp'
  | 'send_notification'
  | 'create_task'
  | 'set_variable'

export type WorkflowFieldDef = {
  key: string
  label: string
  placeholder?: string
  multiline?: boolean
  type?: 'text' | 'email' | 'number' | 'password'
}

export const NODE_KIND_LABELS: Record<WorkflowNodeKind, string> = {
  TRIGGER: 'Disparador',
  HTTP_REQUEST: 'HTTP Request',
  CONDITION: 'Condición',
  DELAY: 'Espera',
  NOTE: 'Nota',
  ACTION: 'Acción',
}

export const NODE_KIND_DESCRIPTIONS: Record<WorkflowNodeKind, string> = {
  TRIGGER: 'Punto de entrada de la automatización (webhook, cron, manual o evento).',
  HTTP_REQUEST: 'Llama a una API externa: método, headers, query, body y autenticación.',
  CONDITION: 'Compara un valor y detiene el flujo si no se cumple.',
  DELAY: 'Pausa la ejecución por un tiempo configurable.',
  NOTE: 'Nota informativa. No ejecuta ninguna acción.',
  ACTION: 'Operación interna: CRM, correo, WhatsApp, notificaciones, tareas o variables.',
}

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export const WORKFLOW_ACTION_LABELS: Record<WorkflowActionKey, string> = {
  create_lead: 'Crear / actualizar lead',
  create_opportunity: 'Crear oportunidad',
  send_email: 'Enviar correo',
  send_whatsapp: 'Enviar WhatsApp',
  send_notification: 'Enviar notificación interna',
  create_task: 'Crear tarea CRM',
  set_variable: 'Asignar variable',
}

export const WORKFLOW_ACTION_FIELDS: Record<WorkflowActionKey, WorkflowFieldDef[]> = {
  create_lead: [
    { key: 'nombre', label: 'Nombre', placeholder: '{{nombre}}' },
    { key: 'empresaNombre', label: 'Empresa', placeholder: '{{empresa}}' },
    { key: 'email', label: 'Correo', type: 'email', placeholder: '{{email}}' },
    { key: 'phone', label: 'Teléfono', placeholder: '{{telefono}}' },
    { key: 'document', label: 'Documento', placeholder: '{{documento}}' },
    { key: 'ciudad', label: 'Ciudad', placeholder: '{{ciudad}}' },
    { key: 'producto', label: 'Producto / interés', placeholder: '{{producto}}' },
    { key: 'message', label: 'Mensaje / notas', multiline: true, placeholder: '{{mensaje}}' },
  ],
  create_opportunity: [
    { key: 'title', label: 'Título', placeholder: '{{titulo}}' },
    { key: 'description', label: 'Descripción', multiline: true, placeholder: '{{descripcion}}' },
    { key: 'stage', label: 'Etapa', placeholder: 'NEW' },
    { key: 'expectedValue', label: 'Valor esperado', type: 'number', placeholder: '0' },
  ],
  send_email: [
    { key: 'to', label: 'Destinatario', type: 'email', placeholder: '{{email}}' },
    { key: 'subject', label: 'Asunto', placeholder: '{{asunto}}' },
    { key: 'body', label: 'Cuerpo (HTML)', multiline: true, placeholder: '{{mensaje}}' },
  ],
  send_whatsapp: [
    { key: 'to', label: 'Teléfono', placeholder: '{{telefono}}' },
    { key: 'message', label: 'Mensaje', multiline: true, placeholder: '{{mensaje}}' },
  ],
  send_notification: [
    { key: 'title', label: 'Título', placeholder: 'Nueva notificación' },
    { key: 'body', label: 'Mensaje', multiline: true, placeholder: '{{mensaje}}' },
    { key: 'actionUrl', label: 'URL de acción', placeholder: '/dashboard/crm/leads' },
    { key: 'actionLabel', label: 'Etiqueta de acción', placeholder: 'Abrir' },
    { key: 'userId', label: 'Usuario (ID, opcional)', placeholder: 'por defecto, el creador' },
  ],
  create_task: [
    { key: 'title', label: 'Título', placeholder: 'Nueva tarea' },
    { key: 'description', label: 'Descripción', multiline: true, placeholder: '{{descripcion}}' },
    { key: 'priority', label: 'Prioridad', placeholder: 'NORMAL (LOW / NORMAL / HIGH)' },
    { key: 'assignedToUserId', label: 'Responsable (ID de usuario)', placeholder: 'por defecto, el creador' },
  ],
  set_variable: [
    { key: 'variableKey', label: 'Nombre de variable', placeholder: 'resultado' },
    { key: 'variableValue', label: 'Valor', multiline: true, placeholder: '{{respuesta}}' },
  ],
}

export function defaultConfigForKind(kind: WorkflowNodeKind): Record<string, unknown> {
  switch (kind) {
    case 'HTTP_REQUEST':
      return {
        method: 'GET',
        url: '',
        headers: '',
        query: '',
        body: '',
        authType: 'none',
        authToken: '',
        authUsername: '',
        authPassword: '',
        timeoutSeconds: 15,
        responseVariable: '',
      }
    case 'CONDITION':
      return { field: '', operator: 'eq', value: '', stopWhenFalse: true }
    case 'DELAY':
      return { value: '1', unit: 'seconds' }
    case 'ACTION':
      return { action: 'create_lead', fields: { nombre: '{{nombre}}', email: '{{email}}', phone: '{{telefono}}' } }
    case 'NOTE':
      return { text: '' }
    default:
      return {}
  }
}

export function summarizeNodeConfig(node: WorkflowNode): string {
  const config = node.config ?? {}
  switch (node.kind) {
    case 'HTTP_REQUEST':
      return `${String(config.method ?? 'GET').toUpperCase()} ${String(config.url ?? '')}`.trim() || 'Sin URL configurada'
    case 'CONDITION': {
      const operator = String(config.operator ?? 'eq')
      if (operator === 'empty' || operator === 'not_empty') {
        return `${String(config.field ?? '')} ${operator}`.trim() || 'Sin condición'
      }
      return `${String(config.field ?? '')} ${operator} ${String(config.value ?? '')}`.trim() || 'Sin condición'
    }
    case 'DELAY':
      return `${String(config.value ?? '')} ${String(config.unit ?? 'seconds')}`.trim()
    case 'ACTION':
      return WORKFLOW_ACTION_LABELS[String(config.action ?? 'create_lead') as WorkflowActionKey] ?? 'Acción'
    case 'NOTE':
      return String(config.text ?? '').slice(0, 120) || 'Nota'
    default:
      return ''
  }
}
