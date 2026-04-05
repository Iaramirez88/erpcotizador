'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AccountingAccountType, AccountingNormalBalance } from '@prisma/client'

type AccountRow = {
  id: string
  code: string
  name: string
  type: AccountingAccountType
  normalBalance: AccountingNormalBalance
  parentId: string | null
  isPosting: boolean
  isActive: boolean
}

const ACCOUNT_TYPES: { value: AccountingAccountType; label: string }[] = [
  { value: 'ASSET', label: 'Activo' },
  { value: 'LIABILITY', label: 'Pasivo' },
  { value: 'EQUITY', label: 'Patrimonio' },
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'EXPENSE', label: 'Gasto' },
]

const NORMAL_BALANCES: { value: AccountingNormalBalance; label: string }[] = [
  { value: 'DEBIT', label: 'Débito' },
  { value: 'CREDIT', label: 'Crédito' },
]

const NO_PARENT_VALUE = '__none__'

export default function PlanDeCuentasPage() {
  const [rows, setRows] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountingAccountType>('ASSET')
  const [normalBalance, setNormalBalance] = useState<AccountingNormalBalance>('DEBIT')
  const [parentId, setParentId] = useState<string>(NO_PARENT_VALUE)
  const [isPosting, setIsPosting] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const parentOptions = useMemo(() => rows.filter((r) => !r.isPosting), [rows])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/contabilidad/cuentas', { cache: 'no-store' })
      const json = (await res.json()) as { ok: boolean; data?: AccountRow[]; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error cargando cuentas')
      setRows(json.data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando cuentas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/contabilidad/cuentas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          name,
          type,
          normalBalance,
          parentId: parentId === NO_PARENT_VALUE ? null : parentId,
          isPosting,
        }),
      })
      const json = (await res.json()) as { ok: boolean; data?: AccountRow; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error creando cuenta')

      setCode('')
      setName('')
      setParentId(NO_PARENT_VALUE)
      setIsPosting(true)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creando cuenta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="ERP financiero"
        title={<span data-tour="contabilidad-plan-title">Plan de cuentas</span>}
        description="Crea cuentas contables por empresa con una jerarquía visual consistente y código único."
        stats={[
          { label: 'Cuentas', value: rows.length, hint: 'Registros activos', tone: 'neutral' },
          { label: 'Padres', value: parentOptions.length, hint: 'Opciones jerárquicas', tone: 'sky' },
          { label: 'Movimiento', value: isPosting ? 'Sí' : 'No', hint: 'Tipo de cuenta actual', tone: 'teal' },
        ]}
      />

      <div className="rounded-lg border p-4 space-y-3" data-tour="contabilidad-plan-create">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="code">Código</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="110505" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Caja" />
          </div>

          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as AccountingAccountType)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Naturaleza</Label>
            <Select value={normalBalance} onValueChange={(v) => setNormalBalance(v as AccountingNormalBalance)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {NORMAL_BALANCES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Cuenta padre (opcional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin padre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT_VALUE}>Sin padre</SelectItem>
                {parentOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Switch id="isPosting" checked={isPosting} onCheckedChange={setIsPosting} />
            <Label htmlFor="isPosting">Es cuenta de movimiento</Label>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onCreate} disabled={submitting || !code.trim() || !name.trim()}>
            {submitting ? 'Creando…' : 'Crear cuenta'}
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            Recargar
          </Button>
        </div>

        {error ? <div className="text-sm text-destructive">{error}</div> : null}
      </div>

      <div className="rounded-lg border" data-tour="contabilidad-plan-list">
        <div className="border-b p-3 text-sm font-medium">Cuentas</div>
        <div className="p-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay cuentas registradas.</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                  <div className="text-sm">
                    <div className="font-medium">
                      {r.code} — {r.name}
                    </div>
                    <div className="text-muted-foreground">
                      {r.type} · {r.normalBalance} · {r.isPosting ? 'Movimiento' : 'Mayor'}
                    </div>
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
