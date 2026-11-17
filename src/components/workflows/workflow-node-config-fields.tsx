'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { WorkflowNode } from '@/lib/workflows'
import {
  HTTP_METHODS,
  WORKFLOW_ACTION_FIELDS,
  WORKFLOW_ACTION_LABELS,
  type WorkflowActionKey,
} from '@/components/workflows/workflow-node-catalog'

export function WorkflowNodeConfigFields({
  node,
  onChange,
}: {
  node: WorkflowNode
  onChange: (key: string, value: unknown) => void
}) {
  const config = node.config ?? {}

  if (node.kind === 'HTTP_REQUEST') {
    const authType = String(config.authType ?? 'none')
    return (
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label>Método</Label>
            <Select value={String(config.method ?? 'GET')} onValueChange={(value) => onChange('method', value)}>
              <SelectTrigger className="h-10 rounded-xl bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Timeout (seg)</Label>
            <Input
              type="number"
              value={String(config.timeoutSeconds ?? 15)}
              onChange={(event) => onChange('timeoutSeconds', Number(event.target.value))}
              className="h-10 rounded-xl"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>URL</Label>
          <Input
            value={String(config.url ?? '')}
            onChange={(event) => onChange('url', event.target.value)}
            placeholder="https://api.example.com/endpoint"
            className="h-10 rounded-xl"
          />
        </div>

        <div className="grid gap-1.5">
          <Label>Autenticación</Label>
          <Select value={authType} onValueChange={(value) => onChange('authType', value)}>
            <SelectTrigger className="h-10 rounded-xl bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin autenticación</SelectItem>
              <SelectItem value="bearer">Bearer token</SelectItem>
              <SelectItem value="basic">Basic (usuario / contraseña)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {authType === 'bearer' ? (
          <div className="grid gap-1.5">
            <Label>Token</Label>
            <Input
              type="password"
              value={String(config.authToken ?? '')}
              onChange={(event) => onChange('authToken', event.target.value)}
              placeholder="Token de acceso"
              className="h-10 rounded-xl"
            />
          </div>
        ) : null}

        {authType === 'basic' ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label>Usuario</Label>
              <Input
                value={String(config.authUsername ?? '')}
                onChange={(event) => onChange('authUsername', event.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={String(config.authPassword ?? '')}
                onChange={(event) => onChange('authPassword', event.target.value)}
                className="h-10 rounded-xl"
              />
            </div>
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <Label>Headers (JSON)</Label>
          <Textarea
            value={String(config.headers ?? '')}
            onChange={(event) => onChange('headers', event.target.value)}
            rows={3}
            className="rounded-2xl font-mono text-xs"
            placeholder='{"X-Api-Key": "valor"}'
          />
        </div>

        <div className="grid gap-1.5">
          <Label>Query params (JSON)</Label>
          <Textarea
            value={String(config.query ?? '')}
            onChange={(event) => onChange('query', event.target.value)}
            rows={2}
            className="rounded-2xl font-mono text-xs"
            placeholder='{"page": "1"}'
          />
        </div>

        <div className="grid gap-1.5">
          <Label>Body (JSON o texto)</Label>
          <Textarea
            value={String(config.body ?? '')}
            onChange={(event) => onChange('body', event.target.value)}
            rows={4}
            className="rounded-2xl font-mono text-xs"
            placeholder='{"nombre": "{{nombre}}"}'
          />
        </div>

        <div className="grid gap-1.5">
          <Label>Guardar respuesta en variable (opcional)</Label>
          <Input
            value={String(config.responseVariable ?? '')}
            onChange={(event) => onChange('responseVariable', event.target.value)}
            placeholder="respuesta"
            className="h-10 rounded-xl"
          />
        </div>
      </div>
    )
  }

  if (node.kind === 'CONDITION') {
    const operator = String(config.operator ?? 'eq')
    const needsValue = operator !== 'empty' && operator !== 'not_empty'
    return (
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>Campo / variable</Label>
          <Input
            value={String(config.field ?? '')}
            onChange={(event) => onChange('field', event.target.value)}
            placeholder="{{status}}"
            className="h-10 rounded-xl"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Operador</Label>
          <Select value={operator} onValueChange={(value) => onChange('operator', value)}>
            <SelectTrigger className="h-10 rounded-xl bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eq">es igual (=)</SelectItem>
              <SelectItem value="neq">no es igual (≠)</SelectItem>
              <SelectItem value="gt">mayor que (&gt;)</SelectItem>
              <SelectItem value="gte">mayor o igual (≥)</SelectItem>
              <SelectItem value="lt">menor que (&lt;)</SelectItem>
              <SelectItem value="lte">menor o igual (≤)</SelectItem>
              <SelectItem value="contains">contiene</SelectItem>
              <SelectItem value="not_contains">no contiene</SelectItem>
              <SelectItem value="empty">está vacío</SelectItem>
              <SelectItem value="not_empty">no está vacío</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {needsValue ? (
          <div className="grid gap-1.5">
            <Label>Valor</Label>
            <Input
              value={String(config.value ?? '')}
              onChange={(event) => onChange('value', event.target.value)}
              placeholder="valor a comparar"
              className="h-10 rounded-xl"
            />
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium text-slate-700">Detener si no se cumple</p>
            <p className="text-[11px] text-slate-500">Si la condición es falsa, el workflow termina.</p>
          </div>
          <Switch checked={Boolean(config.stopWhenFalse ?? true)} onCheckedChange={(value) => onChange('stopWhenFalse', value)} />
        </div>
      </div>
    )
  }

  if (node.kind === 'DELAY') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label>Valor</Label>
          <Input
            type="number"
            value={String(config.value ?? '1')}
            onChange={(event) => onChange('value', event.target.value)}
            className="h-10 rounded-xl"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Unidad</Label>
          <Select value={String(config.unit ?? 'seconds')} onValueChange={(value) => onChange('unit', value)}>
            <SelectTrigger className="h-10 rounded-xl bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="seconds">Segundos</SelectItem>
              <SelectItem value="minutes">Minutos</SelectItem>
              <SelectItem value="hours">Horas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  if (node.kind === 'ACTION') {
    const action = (String(config.action ?? 'create_lead') || 'create_lead') as WorkflowActionKey
    const fields =
      config.fields && typeof config.fields === 'object' && !Array.isArray(config.fields)
        ? (config.fields as Record<string, unknown>)
        : {}
    const defs = WORKFLOW_ACTION_FIELDS[action] ?? []

    function setField(key: string, value: unknown) {
      onChange('fields', { ...fields, [key]: value })
    }

    return (
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>Operación</Label>
          <Select value={action} onValueChange={(value) => onChange('action', value)}>
            <SelectTrigger className="h-10 rounded-xl bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(WORKFLOW_ACTION_LABELS) as WorkflowActionKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {WORKFLOW_ACTION_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {defs.map((def) => (
          <div key={def.key} className="grid gap-1.5">
            <Label>{def.label}</Label>
            {def.multiline ? (
              <Textarea
                value={String(fields[def.key] ?? '')}
                onChange={(event) => setField(def.key, event.target.value)}
                rows={3}
                placeholder={def.placeholder}
                className="rounded-2xl text-xs"
              />
            ) : (
              <Input
                type={def.type ?? 'text'}
                value={String(fields[def.key] ?? '')}
                onChange={(event) => setField(def.key, event.target.value)}
                placeholder={def.placeholder}
                className="h-10 rounded-xl"
              />
            )}
          </div>
        ))}

        <p className="text-xs text-slate-500">
          Interpola variables con {'{{campo}}'}, ej. {'{{nombre}}'}, {'{{email}}'}, {'{{respuesta}}'}.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-1.5">
      <Label>Texto</Label>
      <Textarea
        value={String(config.text ?? '')}
        onChange={(event) => onChange('text', event.target.value)}
        rows={3}
        placeholder="Nota…"
        className="rounded-2xl text-xs"
      />
    </div>
  )
}

