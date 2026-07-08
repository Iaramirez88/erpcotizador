'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, ImageIcon, MessageSquareText } from 'lucide-react'
import type { AiWorkspaceHistoryEntry, AiWorkspaceHistoryKind } from '@/lib/ai-workspace-history'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  entries: AiWorkspaceHistoryEntry[]
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function formatKindLabel(kind: AiWorkspaceHistoryKind) {
  return kind === 'IMAGE_GENERATION' ? 'Imagen IA' : kind === 'IMAGE_VECTORIZATION' ? 'Vectorización IA' : 'Cotización IA'
}

function kindBadgeClass(kind: AiWorkspaceHistoryKind) {
  return kind === 'IMAGE_GENERATION'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : kind === 'IMAGE_VECTORIZATION'
      ? 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700'
      : 'border-sky-200 bg-sky-50 text-sky-700'
}

function excerpt(value: string | null | undefined, maxLength: number) {
  const normalized = String(value || '').trim()
  if (!normalized) return 'Sin contenido disponible.'
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trim()}...`
}

export function LitografiaAiAuditList({ entries }: Props) {
  const [selectedEntry, setSelectedEntry] = useState<AiWorkspaceHistoryEntry | null>(null)

  return (
    <>
      <div className="space-y-4">
        {entries.map((entry) => {
          const metadataModel = typeof entry.metadata?.model === 'string' ? entry.metadata.model : null
          const actorLabel = entry.actorLabel || entry.actorUserId || 'Usuario sin identificar'

          return (
            <article key={entry.id} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${kindBadgeClass(entry.kind)}`}>
                      {formatKindLabel(entry.kind)}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{actorLabel}</h3>
                    <p className="text-sm text-slate-500">{entry.actorUserId || 'Sin id de usuario'}{metadataModel ? ` · ${metadataModel}` : ''}</p>
                  </div>
                </div>

                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    {entry.kind === 'IMAGE_GENERATION' ? <ImageIcon className="h-4 w-4" /> : entry.kind === 'IMAGE_VECTORIZATION' ? <Download className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
                    <span>{entry.asset ? 'Con archivo guardado' : 'Sin archivo adjunto'}</span>
                  </div>
                  <Button type="button" variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => setSelectedEntry(entry)}>
                    Ver detalle
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Prompt</div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{excerpt(entry.prompt, 180)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumen</div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{excerpt(entry.summary || entry.responseText, 180)}</p>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <Dialog open={Boolean(selectedEntry)} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto rounded-3xl border-slate-200 p-0">
          {selectedEntry ? (
            <div className="bg-white">
              <DialogHeader className="border-b border-slate-100 px-6 py-5 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${kindBadgeClass(selectedEntry.kind)}`}>
                    {formatKindLabel(selectedEntry.kind)}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{formatDateTime(selectedEntry.createdAt)}</span>
                </div>
                <DialogTitle className="mt-3 text-2xl text-slate-950">{selectedEntry.actorLabel || selectedEntry.actorUserId || 'Usuario sin identificar'}</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-slate-500">
                  {selectedEntry.actorUserId || 'Sin id de usuario'}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 px-6 py-6 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="space-y-5">
                  <section>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Prompt</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedEntry.prompt}</p>
                  </section>

                  {selectedEntry.summary ? (
                    <section>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumen</div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedEntry.summary}</p>
                    </section>
                  ) : null}

                  {selectedEntry.responseText ? (
                    <section>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Respuesta</div>
                      <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">{selectedEntry.responseText}</p>
                    </section>
                  ) : null}
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <section>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Archivo</div>
                    {selectedEntry.asset ? (
                      <div className="mt-2 space-y-2 text-sm text-slate-700">
                        <div className="font-medium text-slate-900">{selectedEntry.asset.name}</div>
                        <div className="break-all">{selectedEntry.asset.path}</div>
                        {selectedEntry.asset.url ? (
                          <Link href={selectedEntry.asset.url} className="inline-flex text-sm font-medium text-sky-700 hover:text-sky-900">
                            Abrir archivo
                          </Link>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">Este evento no dejó archivo asociado.</p>
                    )}
                  </section>

                  {(typeof selectedEntry.metadata?.model === 'string'
                    || typeof selectedEntry.metadata?.size === 'string'
                    || typeof selectedEntry.metadata?.quality === 'string') ? (
                    <section>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Parámetros</div>
                      <div className="mt-2 space-y-1 text-sm text-slate-700">
                        {typeof selectedEntry.metadata?.model === 'string' ? <div>Modelo: {selectedEntry.metadata.model}</div> : null}
                        {typeof selectedEntry.metadata?.size === 'string' ? <div>Tamaño: {selectedEntry.metadata.size}</div> : null}
                        {typeof selectedEntry.metadata?.quality === 'string' ? <div>Calidad: {selectedEntry.metadata.quality}</div> : null}
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}