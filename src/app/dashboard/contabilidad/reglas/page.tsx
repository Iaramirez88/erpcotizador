'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  AccountingAmountKey,
  AccountingEventType,
  AccountingPostingSide,
} from '@prisma/client'

type AccountRow = { id: string; code: string; name: string }

type RuleLineRow = {
  id: string
  order: number
  side: AccountingPostingSide
  amountKey: AccountingAmountKey
  multiplier: number
  accountId: string
  costCenterId: string | null
  memoTemplate: string | null
}

type RuleRow = {
  id: string
  name: string
  eventType: AccountingEventType
  isActive: boolean
  priority: number
  conditions: unknown
  lines: RuleLineRow[]
}

type RuleLineInput = {
  side: AccountingPostingSide
  amountKey: AccountingAmountKey
  multiplier: number
  accountCode: string
  memo?: string
}

const EVENT_TYPES: { value: AccountingEventType; label: string }[] = [
  { value: 'POS_INVOICE', label: 'POS - Venta' },
  { value: 'POS_RETURN', label: 'POS - Devolución' },
  { value: 'COMPRA', label: 'Compra' },
  { value: 'COMPRA_PAGO', label: 'Compra - Pago' },
  { value: 'DIAN_DOCUMENT', label: 'DIAN' },
  { value: 'MANUAL', label: 'Manual' },
]

const SIDES: { value: AccountingPostingSide; label: string }[] = [
  { value: 'DEBIT', label: 'Débito' },
  { value: 'CREDIT', label: 'Crédito' },
]

const AMOUNT_KEYS: { value: AccountingAmountKey; label: string }[] = [
  { value: 'SUBTOTAL', label: 'Subtotal' },
  { value: 'IVA', label: 'IVA' },
  { value: 'DESCUENTO', label: 'Descuento' },
  { value: 'RETENCION', label: 'Retención' },
  { value: 'RETEICA', label: 'ReteICA' },
  { value: 'AUTORETENCION', label: 'Autoretención' },
  { value: 'TOTAL', label: 'Total' },
]

export default function ReglasContablesPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [rules, setRules] = useState<RuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [eventType, setEventType] = useState<AccountingEventType>('POS_INVOICE')
  const [priority, setPriority] = useState('100')
  const [conditionsJson, setConditionsJson] = useState('{}')
  const [lineSide, setLineSide] = useState<AccountingPostingSide>('DEBIT')
  const [lineAmountKey, setLineAmountKey] = useState<AccountingAmountKey>('TOTAL')
  const [lineMultiplier, setLineMultiplier] = useState('1')
  const [lineAccountCode, setLineAccountCode] = useState('')
  const [lineMemo, setLineMemo] = useState('')
  const [lines, setLines] = useState<RuleLineInput[]>([])
  const [submitting, setSubmitting] = useState(false)

  const accountCodeSet = useMemo(() => new Set(accounts.map((a) => a.code)), [accounts])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [aRes, rRes] = await Promise.all([
        fetch('/api/contabilidad/cuentas', { cache: 'no-store' }),
        fetch('/api/contabilidad/reglas', { cache: 'no-store' }),
      ])
      const aJson = (await aRes.json()) as { ok: boolean; data?: AccountRow[]; error?: string }
      const rJson = (await rRes.json()) as { ok: boolean; data?: RuleRow[]; error?: string }
      if (!aRes.ok || !aJson.ok) throw new Error(aJson.error || 'Error cargando cuentas')
      if (!rRes.ok || !rJson.ok) throw new Error(rJson.error || 'Error cargando reglas')

      setAccounts(aJson.data || [])
      setRules(rJson.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  function addLine() {
    const multiplier = Number(lineMultiplier)
    if (!lineAccountCode.trim()) return
    if (!accountCodeSet.has(lineAccountCode.trim())) return
    if (!Number.isFinite(multiplier)) return

    setLines((prev) => [
      ...prev,
      {
        side: lineSide,
        amountKey: lineAmountKey,
        multiplier,
        accountCode: lineAccountCode.trim(),
        memo: lineMemo.trim() || undefined,
      },
    ])

    setLineMemo('')
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  async function onCreateRule() {
    setSubmitting(true)
    setError(null)
    try {
      const parsedConditions = JSON.parse(conditionsJson || '{}')
      const res = await fetch('/api/contabilidad/reglas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          eventType,
          priority: Number(priority) || 100,
          conditionsJson: parsedConditions,
          lines,
        }),
      })
      const json = (await res.json()) as { ok: boolean; data?: RuleRow; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error creando regla')

      setName('')
      setPriority('100')
      setConditionsJson('{}')
      setLines([])
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creando regla')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="ERP financiero"
        title="Reglas contables"
        description="Define reglas por evento para generar asientos automáticamente con el mismo lenguaje visual del ERP." 
        stats={[
          { label: 'Reglas', value: rules.length, hint: 'Automatizaciones activas', tone: 'neutral' },
          { label: 'Cuentas', value: accounts.length, hint: 'Base disponible', tone: 'sky' },
          { label: 'Líneas', value: lines.length, hint: 'Borrador actual', tone: 'amber' },
        ]}
      />

      <div className="rounded-lg border p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Venta POS" />
          </div>
          <div className="space-y-1">
            <Label>Evento</Label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as AccountingEventType)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="priority">Prioridad (menor = primero)</Label>
            <Input id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="conditions">Condiciones (JSON)</Label>
            <Textarea
              id="conditions"
              value={conditionsJson}
              onChange={(e) => setConditionsJson(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <div className="text-sm font-medium">Líneas</div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label>Lado</Label>
              <Select value={lineSide} onValueChange={(v) => setLineSide(v as AccountingPostingSide)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIDES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Monto</Label>
              <Select value={lineAmountKey} onValueChange={(v) => setLineAmountKey(v as AccountingAmountKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AMOUNT_KEYS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="mult">Multiplicador</Label>
              <Input id="mult" value={lineMultiplier} onChange={(e) => setLineMultiplier(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="acc">Cuenta (código)</Label>
              <Input
                id="acc"
                value={lineAccountCode}
                onChange={(e) => setLineAccountCode(e.target.value)}
                placeholder="130505"
              />
              {!lineAccountCode.trim() ? null : accountCodeSet.has(lineAccountCode.trim()) ? null : (
                <div className="text-xs text-muted-foreground">El código no existe en el plan de cuentas.</div>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="memo">Memo (opcional)</Label>
              <Input id="memo" value={lineMemo} onChange={(e) => setLineMemo(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addLine}
              disabled={!lineAccountCode.trim() || !accountCodeSet.has(lineAccountCode.trim())}
            >
              Agregar línea
            </Button>
          </div>

          {lines.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay líneas agregadas aún.</div>
          ) : (
            <div className="space-y-2">
              {lines.map((l, idx) => (
                <div key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                  <div className="text-sm">
                    <div className="font-medium">
                      {l.side} · {l.amountKey} · x{l.multiplier}
                    </div>
                    <div className="text-muted-foreground">Cuenta: {l.accountCode}{l.memo ? ` · ${l.memo}` : ''}</div>
                  </div>
                  <Button variant="outline" onClick={() => removeLine(idx)}>
                    Quitar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={onCreateRule} disabled={submitting || !name.trim() || lines.length === 0}>
            {submitting ? 'Creando…' : 'Crear regla'}
          </Button>
          <Button variant="outline" onClick={loadAll} disabled={loading}>
            Recargar
          </Button>
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-3 text-sm font-medium">Reglas existentes</div>
        <div className="p-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : rules.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay reglas registradas.</div>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="rounded-md border p-3">
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-sm text-muted-foreground">{r.eventType} · prioridad {r.priority}</div>
                  <div className="mt-2 space-y-1">
                    {r.lines.map((l) => (
                      <div key={l.id} className="text-sm">
                        {l.order}. {l.side} {l.amountKey} x{l.multiplier}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
