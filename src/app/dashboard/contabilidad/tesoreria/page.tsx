'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { ContabilidadSubnav } from '@/components/dashboard/contabilidad-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDateShort } from '@/lib/utils'

type BankAccountRow = {
  id: string
  name: string
  bankName: string | null
  accountNumber: string | null
  currency: string
  isActive: boolean
  accountingAccountId: string | null
  createdAt: string
  balance: number
  movementsCount: number
}

type LedgerAccountOption = {
  id: string
  code: string
  name: string
  isPosting: boolean
}

type MovementRow = {
  id: string
  date: string
  description: string
  amount: number
  referenceType: string | null
  referenceId: string | null
  journalEntryId: string | null
  createdAt: string
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatAccountAmount(amount: number, currency: string) {
  const code = (currency || 'COP').toUpperCase()
  if (code === 'COP') return formatCurrency(amount)
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${code} ${amount.toFixed(2)}`
  }
}

export default function ContabilidadTesoreriaPage() {
  const [accounts, setAccounts] = useState<BankAccountRow[]>([])
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<string | null>(null)

  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [movementsError, setMovementsError] = useState<string | null>(null)

  const [accountName, setAccountName] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [currency, setCurrency] = useState('COP')
  const [accountingAccountId, setAccountingAccountId] = useState('')
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccountOption[]>([])
  const [savingAccount, setSavingAccount] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)

  const [movementDate, setMovementDate] = useState(todayIso)
  const [movementDescription, setMovementDescription] = useState('')
  const [movementAmount, setMovementAmount] = useState('')
  const [savingMovement, setSavingMovement] = useState(false)
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(null)
    try {
      const res = await fetch('/api/contabilidad/bancos', { cache: 'no-store' })
      const json = (await res.json()) as { ok: boolean; data?: BankAccountRow[]; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error cargando cuentas bancarias')
      setAccounts(json.data || [])
    } catch (e) {
      setAccountsError(e instanceof Error ? e.message : 'Error cargando cuentas bancarias')
    } finally {
      setAccountsLoading(false)
    }
  }, [])

  const loadLedgerAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/contabilidad/cuentas', { cache: 'no-store' })
      const json = (await res.json()) as { ok: boolean; data?: LedgerAccountOption[] }
      if (res.ok && json.ok) {
        setLedgerAccounts(json.data || [])
      }
    } catch {
      // La vinculación contable es opcional: si falla, la cuenta bancaria sigue operativa.
      setLedgerAccounts([])
    }
  }, [])

  const loadMovements = useCallback(async (bankAccountId: string) => {
    setMovementsLoading(true)
    setMovementsError(null)
    try {
      const res = await fetch(`/api/contabilidad/bancos/${bankAccountId}/movimientos`, { cache: 'no-store' })
      const json = (await res.json()) as { ok: boolean; data?: MovementRow[]; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error cargando movimientos')
      setMovements(json.data || [])
    } catch (e) {
      setMovementsError(e instanceof Error ? e.message : 'Error cargando movimientos')
    } finally {
      setMovementsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    void loadLedgerAccounts()
  }, [loadLedgerAccounts])

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id)
    } else if (selectedAccountId && !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0]?.id ?? '')
    }
  }, [accounts, selectedAccountId])

  useEffect(() => {
    if (!selectedAccountId) {
      setMovements([])
      return
    }
    void loadMovements(selectedAccountId)
  }, [selectedAccountId, loadMovements])

  const totals = useMemo(() => {
    return accounts.reduce(
      (acc, account) => ({
        balance: acc.balance + (account.balance || 0),
        active: acc.active + (account.isActive ? 1 : 0),
        movements: acc.movements + (account.movementsCount || 0),
      }),
      { balance: 0, active: 0, movements: 0 }
    )
  }, [accounts])

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  )

  const ledgerById = useMemo(
    () =>
      new Map<string, LedgerAccountOption>(
        ledgerAccounts
          .filter((account) => account.isPosting)
          .map((account): [string, LedgerAccountOption] => [account.id, account])
      ),
    [ledgerAccounts]
  )

  function resetAccountForm() {
    setEditingAccountId(null)
    setAccountName('')
    setBankName('')
    setAccountNumber('')
    setCurrency('COP')
    setAccountingAccountId('')
  }

  function startEditAccount(account: BankAccountRow) {
    setEditingAccountId(account.id)
    setAccountName(account.name)
    setBankName(account.bankName ?? '')
    setAccountNumber(account.accountNumber ?? '')
    setCurrency(account.currency || 'COP')
    setAccountingAccountId(account.accountingAccountId ?? '')
    setAccountsError(null)
  }

  async function handleSaveAccount() {
    setSavingAccount(true)
    setAccountsError(null)
    try {
      const res = await fetch(editingAccountId ? `/api/contabilidad/bancos/${editingAccountId}` : '/api/contabilidad/bancos', {
        method: editingAccountId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: accountName, bankName, accountNumber, currency, accountingAccountId }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) {
        throw new Error(json.error || (editingAccountId ? 'Error actualizando la cuenta bancaria' : 'Error creando cuenta bancaria'))
      }
      resetAccountForm()
      await loadAccounts()
    } catch (e) {
      setAccountsError(e instanceof Error ? e.message : 'Error guardando la cuenta bancaria')
    } finally {
      setSavingAccount(false)
    }
  }

  async function handleToggleAccountActive(account: BankAccountRow) {
    setAccountsError(null)
    try {
      const res = await fetch(`/api/contabilidad/bancos/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !account.isActive }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error actualizando la cuenta bancaria')
      await loadAccounts()
    } catch (e) {
      setAccountsError(e instanceof Error ? e.message : 'Error actualizando la cuenta bancaria')
    }
  }

  async function handleDeleteAccount(account: BankAccountRow) {
    if (!window.confirm(`¿Eliminar la cuenta "${account.name}"? Solo se elimina si no tiene movimientos registrados.`)) {
      return
    }

    setAccountsError(null)
    try {
      const res = await fetch(`/api/contabilidad/bancos/${account.id}`, { method: 'DELETE' })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'No fue posible eliminar la cuenta bancaria')
      if (editingAccountId === account.id) resetAccountForm()
      await loadAccounts()
    } catch (e) {
      setAccountsError(e instanceof Error ? e.message : 'No fue posible eliminar la cuenta bancaria')
    }
  }

  function resetMovementForm() {
    setEditingMovementId(null)
    setMovementDescription('')
    setMovementAmount('')
    setMovementDate(todayIso())
  }

  function startEditMovement(movement: MovementRow) {
    setEditingMovementId(movement.id)
    setMovementDate(new Date(movement.date).toISOString().slice(0, 10))
    setMovementDescription(movement.description)
    setMovementAmount(String(movement.amount))
    setMovementsError(null)
  }

  async function handleSaveMovement() {
    if (!selectedAccountId) return
    setSavingMovement(true)
    setMovementsError(null)
    try {
      const url = editingMovementId
        ? `/api/contabilidad/bancos/${selectedAccountId}/movimientos/${editingMovementId}`
        : `/api/contabilidad/bancos/${selectedAccountId}/movimientos`
      const res = await fetch(url, {
        method: editingMovementId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: movementDate, description: movementDescription, amount: movementAmount }),
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error guardando el movimiento')
      resetMovementForm()
      await Promise.all([loadMovements(selectedAccountId), loadAccounts()])
    } catch (e) {
      setMovementsError(e instanceof Error ? e.message : 'Error guardando el movimiento')
    } finally {
      setSavingMovement(false)
    }
  }

  async function handleDeleteMovement(movement: MovementRow) {
    if (!selectedAccountId) return
    if (!window.confirm(`¿Eliminar el movimiento "${movement.description}"?`)) return

    setMovementsError(null)
    try {
      const res = await fetch(`/api/contabilidad/bancos/${selectedAccountId}/movimientos/${movement.id}`, {
        method: 'DELETE',
      })
      const json = (await res.json()) as { ok: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'No fue posible eliminar el movimiento')
      if (editingMovementId === movement.id) resetMovementForm()
      await Promise.all([loadMovements(selectedAccountId), loadAccounts()])
    } catch (e) {
      setMovementsError(e instanceof Error ? e.message : 'No fue posible eliminar el movimiento')
    }
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Contabilidad"
        title="Tesorería y bancos"
        description="Cuentas bancarias, saldos y movimientos para conciliar la operación con la contabilidad."
        stats={[
          { label: 'Saldo consolidado', value: formatCurrency(totals.balance), hint: 'Suma de todas las cuentas', tone: 'teal' },
          { label: 'Cuentas activas', value: totals.active, hint: 'Cuentas bancarias registradas', tone: 'sky' },
          { label: 'Movimientos', value: totals.movements, hint: 'Registrados en tesorería', tone: 'amber' },
        ]}
      />
      <ContabilidadSubnav />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Cuentas bancarias</CardTitle>
            <CardDescription>Crea cada cuenta y consulta su saldo consolidado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Nombre</Label>
                <Input value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder="Cuenta corriente principal" />
              </div>
              <div className="grid gap-2">
                <Label>Banco</Label>
                <Input value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="Bancolombia" />
              </div>
              <div className="grid gap-2">
                <Label>Número de cuenta</Label>
                <Input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="123-456789" />
              </div>
              <div className="grid gap-2">
                <Label>Moneda</Label>
                <Input value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Cuenta contable (opcional)</Label>
                <Select
                  value={accountingAccountId || '__none__'}
                  onValueChange={(value) => setAccountingAccountId(value === '__none__' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin cuenta contable" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin cuenta contable</SelectItem>
                    {ledgerAccounts
                      .filter((account) => account.isPosting)
                      .map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSaveAccount()} disabled={savingAccount || !accountName.trim()}>
                {savingAccount ? 'Guardando…' : editingAccountId ? 'Guardar cambios' : 'Crear cuenta'}
              </Button>
              {editingAccountId ? (
                <Button variant="ghost" onClick={resetAccountForm} disabled={savingAccount}>
                  Cancelar edición
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => void loadAccounts()} disabled={accountsLoading}>
                Recargar
              </Button>
            </div>

            {accountsError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{accountsError}</div>
            ) : null}

            <div className="space-y-2">
              {accountsLoading ? (
                <div className="text-sm text-muted-foreground">Cargando…</div>
              ) : accounts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay cuentas bancarias registradas.</div>
              ) : (
                accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`rounded-2xl border p-3 transition ${
                      selectedAccountId === account.id ? 'border-sky-300 bg-sky-50/70' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedAccountId(account.id)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                    >
                    <div>
                      <div className="font-medium text-slate-950">{account.name}</div>
                      <div className="text-xs text-slate-500">
                        {[account.bankName, account.accountNumber].filter(Boolean).join(' · ') || 'Sin datos bancarios'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {account.accountingAccountId && ledgerById.get(account.accountingAccountId)
                          ? `Contable: ${ledgerById.get(account.accountingAccountId)?.code} - ${ledgerById.get(account.accountingAccountId)?.name}`
                          : 'Sin cuenta contable vinculada'}
                      </div>
                    </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-950">{formatAccountAmount(account.balance, account.currency)}</div>
                        <div className="text-xs text-slate-500">{account.movementsCount} movimientos</div>
                      </div>
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEditAccount(account)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void handleToggleAccountActive(account)}>
                        {account.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDeleteAccount(account)}>
                        Eliminar
                      </Button>
                      {account.isActive ? null : <span className="text-xs text-slate-500">Cuenta inactiva</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>Movimientos</CardTitle>
            <CardDescription>
              {selectedAccount ? `Movimientos de ${selectedAccount.name}` : 'Selecciona una cuenta bancaria.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Cuenta</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Fecha</Label>
                <Input type="date" value={movementDate} onChange={(event) => setMovementDate(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Monto (negativo = egreso)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={movementAmount}
                  onChange={(event) => setMovementAmount(event.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Descripción</Label>
                <Input
                  value={movementDescription}
                  onChange={(event) => setMovementDescription(event.target.value)}
                  placeholder="Consignación cliente"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void handleSaveMovement()}
                disabled={savingMovement || !selectedAccountId || !movementDescription.trim() || !movementAmount.trim()}
              >
                {savingMovement ? 'Guardando…' : editingMovementId ? 'Guardar cambios' : 'Registrar movimiento'}
              </Button>
              {editingMovementId ? (
                <Button variant="ghost" onClick={resetMovementForm} disabled={savingMovement}>
                  Cancelar edición
                </Button>
              ) : null}
            </div>

            {movementsError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{movementsError}</div>
            ) : null}

            <div className="space-y-2">
              {!selectedAccountId ? (
                <div className="text-sm text-muted-foreground">Crea o selecciona una cuenta para ver movimientos.</div>
              ) : movementsLoading ? (
                <div className="text-sm text-muted-foreground">Cargando…</div>
              ) : movements.length === 0 ? (
                <div className="text-sm text-muted-foreground">Esta cuenta no tiene movimientos registrados.</div>
              ) : (
                movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3"
                  >
                    <div>
                      <div className="font-medium text-slate-950">{movement.description}</div>
                      <div className="text-xs text-slate-500">{formatDateShort(movement.date)}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {movement.journalEntryId ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Con asiento
                        </span>
                      ) : null}
                      <div className={`text-sm font-semibold ${movement.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatAccountAmount(movement.amount, selectedAccount?.currency ?? 'COP')}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => startEditMovement(movement)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDeleteMovement(movement)}>
                        Eliminar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
