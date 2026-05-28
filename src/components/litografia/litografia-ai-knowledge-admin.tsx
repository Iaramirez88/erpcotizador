'use client'

import { useEffect, useMemo, useState } from 'react'
import { Upload, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

type KnowledgeSummary = {
  reglas: number
  planchas: number
  impresion: number
  papeles: number
  cortes: number
  plastificados: number
  terminados: number
  notas: number
}

type KnowledgeStore = {
  source: 'default' | 'custom'
  updatedAt: string
  updatedByLabel: string | null
  document: Record<string, unknown>
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

export function LitografiaAiKnowledgeAdmin() {
  const [rawJson, setRawJson] = useState('')
  const [defaultRawJson, setDefaultRawJson] = useState('')
  const [summary, setSummary] = useState<KnowledgeSummary | null>(null)
  const [store, setStore] = useState<KnowledgeStore | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErrorMessage(null)
      try {
        const response = await fetch('/api/litografia/ia/conocimiento', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || 'No se pudo cargar la base de conocimiento IA.')
        }

        if (cancelled) return
        setStore(payload.store)
        setSummary(payload.summary)
        setRawJson(JSON.stringify(payload.store.document, null, 2))
        setDefaultRawJson(JSON.stringify(payload.defaultDocument, null, 2))
      } catch (error) {
        if (cancelled) return
        setErrorMessage(error instanceof Error ? error.message : 'No se pudo cargar la base de conocimiento IA.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const rulesPreview = useMemo(() => {
    try {
      const parsed = JSON.parse(rawJson) as { parametros?: Record<string, string | number>; notas?: string[] }
      return {
        reglas: Object.entries(parsed.parametros || {}).slice(0, 4),
        notas: (parsed.notas || []).slice(0, 3),
      }
    } catch {
      return { reglas: [], notas: [] }
    }
  }, [rawJson])

  async function saveDocument(source: 'default' | 'custom') {
    setSaving(true)
    setStatusMessage(null)
    setErrorMessage(null)

    try {
      const document = JSON.parse(rawJson)
      const response = await fetch('/api/litografia/ia/conocimiento', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document, source }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'No se pudo guardar la base de conocimiento IA.')
      }

      setStore(payload.store)
      setSummary(payload.summary)
      setRawJson(JSON.stringify(payload.store.document, null, 2))
      setStatusMessage(payload.message || 'Base de conocimiento IA guardada correctamente.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'El JSON no es valido o no se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      JSON.parse(text)
      setRawJson(text)
      setStatusMessage(`Archivo cargado: ${file.name}`)
      setErrorMessage(null)
    } catch {
      setErrorMessage('El archivo cargado no contiene un JSON valido.')
    } finally {
      event.target.value = ''
    }
  }

  function restoreDefault() {
    if (!defaultRawJson) return
    setRawJson(defaultRawJson)
    setStatusMessage('Se restauro el JSON base en el editor. Guarda para aplicarlo a la empresa.')
    setErrorMessage(null)
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Administrador de conocimiento IA</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Alimenta la base comercial que usa la IA como contexto complementario. Las tarifas exactas del ERP siguen teniendo prioridad; esta base sirve para reglas,
            materiales, costos base y criterios operativos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300">
            <Upload className="h-4 w-4" />
            Importar JSON
            <input type="file" accept="application/json" className="hidden" onChange={handleFileUpload} />
          </label>
          <Button type="button" variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={restoreDefault} disabled={loading || saving || !defaultRawJson}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Restaurar base
          </Button>
          <Button type="button" className="rounded-xl" onClick={() => saveDocument(store?.source === 'default' ? 'default' : 'custom')} disabled={loading || saving || !rawJson.trim()}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar conocimiento'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
        {summary ? (
          [
            ['Reglas', summary.reglas],
            ['Planchas', summary.planchas],
            ['Impresion', summary.impresion],
            ['Papeles', summary.papeles],
            ['Cortes', summary.cortes],
            ['Plastificados', summary.plastificados],
            ['Terminados', summary.terminados],
            ['Notas', summary.notas],
          ].map(([label, value]) => (
            <Card key={label as string} className="rounded-[22px] border-slate-200">
              <CardHeader className="pb-2">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-3xl text-slate-950">{value}</CardTitle>
              </CardHeader>
            </Card>
          ))
        ) : (
          <Card className="rounded-[22px] border-slate-200 md:col-span-4 xl:col-span-8">
            <CardContent className="p-6 text-sm text-slate-500">{loading ? 'Cargando base de conocimiento...' : 'No hay resumen disponible.'}</CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
          <CardHeader className="border-b border-slate-100 pb-5">
            <CardTitle className="text-2xl text-slate-950">JSON maestro</CardTitle>
            <CardDescription>
              Puedes pegar el JSON completo, importar un archivo o restaurar la base inicial. La API valida la estructura antes de guardar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            {store ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Estado: <span className="font-semibold text-slate-900">{store.source === 'default' ? 'Base por defecto' : 'Base personalizada'}</span>
                {' · '}
                Actualizado: <span className="font-semibold text-slate-900">{formatDateTime(store.updatedAt)}</span>
                {store.updatedByLabel ? (
                  <>
                    {' · '}
                    Por: <span className="font-semibold text-slate-900">{store.updatedByLabel}</span>
                  </>
                ) : null}
              </div>
            ) : null}

            {statusMessage ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{statusMessage}</div> : null}
            {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}

            <Textarea
              value={rawJson}
              onChange={(event) => setRawJson(event.target.value)}
              placeholder="Pega aqui el JSON de conocimiento IA..."
              className="min-h-[680px] rounded-2xl border-slate-200 font-mono text-xs leading-6"
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-slate-950">Vista rapida</CardTitle>
              <CardDescription>Resumen inmediato de reglas y notas visibles para revisar antes de guardar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Reglas</h3>
                {rulesPreview.reglas.length ? (
                  rulesPreview.reglas.map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <div className="font-medium text-slate-900">{key}</div>
                      <div>{String(value)}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">Corrige el JSON para ver un resumen previo.</div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Notas</h3>
                {rulesPreview.notas.length ? (
                  rulesPreview.notas.map((note) => (
                    <div key={note} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{note}</div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">Aun no hay notas detectables en el editor.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl text-slate-950">Como se usa esta base</CardTitle>
              <CardDescription>Orden de prioridad aplicado por el flujo de cotizacion.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">1. Tarifas exactas y configuraciones del ERP.</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">2. Reglas y costos base de esta base de conocimiento IA.</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">3. Solo si sigue habiendo vacios, la IA formula preguntas o deja campos en null.</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}