'use client'

import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

type BridgeDiagnostics = {
  connected: boolean
  listening: boolean
  detectedEmails: number
  syncedProspects: number
  lastSyncAt: string | null
  lastErrorType: 'CHANNEL' | 'AUTH' | null
  lastErrorMessage: string | null
}

export function CrmBridgeDiagnostics({ channelId }: { channelId: string }) {
  const [diagnostics, setDiagnostics] = useState<BridgeDiagnostics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/crm/channels/${channelId}/diagnostics`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => { if (active) setDiagnostics(json?.data?.diagnostics ?? null) })
      .catch(() => { if (active) setDiagnostics(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [channelId])

  if (loading) return <Skeleton className="mt-5 h-28 w-full rounded-2xl" />
  if (!diagnostics) return null

  const state = !diagnostics.connected
    ? { label: 'Sin configurar', tone: 'bg-slate-100 text-slate-700' }
    : diagnostics.lastErrorType === 'AUTH'
      ? { label: 'Error de autenticación', tone: 'bg-rose-100 text-rose-700' }
      : diagnostics.lastErrorType === 'CHANNEL'
        ? { label: 'Error de canal', tone: 'bg-orange-100 text-orange-700' }
        : diagnostics.listening
          ? { label: 'Escuchando', tone: 'bg-emerald-100 text-emerald-700' }
          : { label: 'Conectado', tone: 'bg-sky-100 text-sky-700' }

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-950">Diagnóstico del bridge</p>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${state.tone}`}>{state.label}</span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Conectado</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{diagnostics.connected ? 'Autorizado' : 'Sin autorizar'}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Correos detectados</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{diagnostics.detectedEmails.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Sincronización exitosa</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{diagnostics.syncedProspects.toLocaleString('es-CO')}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Última sincronización</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {diagnostics.lastSyncAt ? new Date(diagnostics.lastSyncAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
          </p>
        </div>
      </div>

      {diagnostics.lastErrorMessage ? (
        <p className="mt-3 text-xs text-slate-500">Último error: {diagnostics.lastErrorMessage}</p>
      ) : null}
    </div>
  )
}
