'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Radar, RefreshCcw } from 'lucide-react'
import {
  formatRopCapacityLabel,
  formatRopVerificationLabel,
  getRopCapacityTone,
  getRopVerificationTone,
  RopCompanyAvatar,
  RopQuickContactActions,
  RopTrustStars,
} from '@/components/rop/rop-visuals'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

type RecommendationItem = {
  companyId: string
  companyName: string
  logoUrl: string | null
  city: string | null
  serviceName: string | null
  trustScore: number | null
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
  capacityStatus: 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE' | null
  availabilityLabel: string | null
  phonePublic: string | null
  emailPublic: string | null
  score: number
  tier: 'PRIORITARIO' | 'FUERTE' | 'VIABLE' | 'EXPLORATORIO'
  positives: string[]
  constraints: string[]
  recommendedAction: 'INVITE' | 'REVIEW' | 'WATCH'
  invitationStatus: 'PENDING' | 'VIEWED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'WITHDRAWN' | null
}

type OpportunityDetail = {
  opportunity: {
    id: string
    title: string
    status: string
    serviceCatalogId: string
    categoryName: string
    subcategoryName: string
    serviceName: string
    descriptionPublic: string | null
    requirementsPrivate: string | null
    location: {
      countryCode: string
      region: string | null
      city: string | null
    }
    expectedQuantity: number | null
    dueAt: string | null
    visibilityLevel: string
    sourceType: string
    createdAt: string
  }
  recommendations: {
    opportunityId: string
    generatedAt: string
    candidates: RecommendationItem[]
  } | null
}

type ApiEnvelope<T> = {
  data?: T
  error?: { message?: string }
}

function tierClassName(tier: RecommendationItem['tier']) {
  switch (tier) {
    case 'PRIORITARIO':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'FUERTE':
      return 'border-sky-200 bg-sky-50 text-sky-700'
    case 'VIABLE':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

export default function RopOpportunityDetailClient({ opportunityId }: { opportunityId: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [sendingInvites, setSendingInvites] = useState(false)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [inviteMessage, setInviteMessage] = useState('')
  const [inviteExpiry, setInviteExpiry] = useState('')
  const [data, setData] = useState<OpportunityDetail | null>(null)

  useEffect(() => {
    void loadOpportunity()
  }, [opportunityId])

  async function loadOpportunity() {
    setLoading(true)
    try {
      const response = await fetch(`/api/rop/v1/opportunities/${opportunityId}`, { cache: 'no-store' })
      const json = (await response.json().catch(() => null)) as ApiEnvelope<OpportunityDetail> | null
      if (!response.ok || !json?.data) {
        throw new Error(json?.error?.message || 'No se pudo cargar la necesidad.')
      }
      setData(json.data)
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo cargar la necesidad.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function recalculate() {
    setRecalculating(true)
    try {
      const response = await fetch(`/api/rop/v1/opportunities/${opportunityId}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = (await response.json().catch(() => null)) as ApiEnvelope<OpportunityDetail['recommendations']> | null
      if (!response.ok || !json?.data) {
        throw new Error(json?.error?.message || 'No se pudo recalcular el shortlist.')
      }
      const recommendations = json.data
      setData((current) => current ? { ...current, recommendations } : current)
      toast({ title: 'Shortlist actualizado', description: 'La oportunidad ya tiene candidatos recalculados.' })
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo recalcular el shortlist.', variant: 'destructive' })
    } finally {
      setRecalculating(false)
    }
  }

  function openInviteDialog(initialCompanyId?: string) {
    const availableIds = initialCompanyId ? [initialCompanyId] : data?.recommendations?.candidates.filter((candidate) => !candidate.invitationStatus).map((candidate) => candidate.companyId) ?? []
    setSelectedCompanyIds(availableIds)
    setInviteMessage('')
    setInviteExpiry('')
    setInviteDialogOpen(true)
  }

  function toggleCompany(companyId: string, checked: boolean) {
    setSelectedCompanyIds((current) => checked ? Array.from(new Set([...current, companyId])) : current.filter((id) => id !== companyId))
  }

  async function sendInvitations() {
    if (!selectedCompanyIds.length) {
      toast({ title: 'Selecciona al menos una empresa', description: 'Elige uno o más candidatos del shortlist para invitar.' })
      return
    }

    setSendingInvites(true)
    try {
      const response = await fetch(`/api/rop/v1/opportunities/${opportunityId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientCompanyIds: selectedCompanyIds,
          messagePublic: inviteMessage.trim() || null,
          shareBudget: false,
          shareAttachments: false,
          expiresAt: inviteExpiry ? new Date(inviteExpiry).toISOString() : null,
        }),
      })

      const json = (await response.json().catch(() => null)) as ApiEnvelope<{
        createdCount: number
        existingCount: number
        recommendations: OpportunityDetail['recommendations']
      }> | null

      if (!response.ok || !json?.data) {
        throw new Error(json?.error?.message || 'No se pudieron enviar las invitaciones.')
      }

      setData((current) => current ? { ...current, recommendations: json.data?.recommendations ?? current.recommendations } : current)
      setInviteDialogOpen(false)
      toast({
        title: 'Invitaciones enviadas',
        description: json.data.existingCount
          ? `Se crearon ${json.data.createdCount} invitaciones. ${json.data.existingCount} ya existían.`
          : `Se crearon ${json.data.createdCount} invitaciones operativas.`,
      })
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudieron enviar las invitaciones.', variant: 'destructive' })
    } finally {
      setSendingInvites(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-slate-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <Card className="rounded-3xl border-dashed border-slate-300 bg-slate-50 shadow-none">
        <CardContent className="p-8 text-center text-sm text-slate-600">No fue posible cargar esta necesidad.</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_34%),linear-gradient(135deg,_#f0fdfa_0%,_#f8fafc_50%,_#fff7ed_100%)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Necesidad operativa</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{data.opportunity.title}</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-700 sm:text-base">{data.opportunity.descriptionPublic || 'Sin descripción pública adicional.'}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="rounded-full bg-white/85 px-5" onClick={recalculate} disabled={recalculating}>
              {recalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Recalcular shortlist
            </Button>
            <Button variant="outline" className="rounded-full bg-white/85 px-5" onClick={() => openInviteDialog()} disabled={!data.recommendations?.candidates.some((candidate) => !candidate.invitationStatus)}>
              Enviar invitaciones
            </Button>
            <Button asChild className="rounded-full px-5">
              <Link href="/dashboard/rop/empresas">Ir a discovery</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="space-y-5">
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Shortlist sugerido</CardTitle>
              <CardDescription>
                {data.recommendations ? `Última generación: ${new Date(data.recommendations.generatedAt).toLocaleString('es-CO')}` : 'Todavía no has generado candidatos para esta necesidad.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.recommendations?.candidates.length ? (
                data.recommendations.candidates.map((candidate) => (
                  <div key={candidate.companyId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <RopCompanyAvatar label={candidate.companyName} logoUrl={candidate.logoUrl} size="lg" className="ring-4 ring-teal-100" />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold text-slate-950">{candidate.companyName}</p>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${tierClassName(candidate.tier)}`}>{candidate.tier}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{candidate.city || 'Ubicación sin publicar'}{candidate.serviceName ? ` · ${candidate.serviceName}` : ''}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                            <span className={`rounded-full border px-2.5 py-1 ${getRopVerificationTone(candidate.verificationStatus)}`}>
                              {formatRopVerificationLabel(candidate.verificationStatus)}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 ${getRopCapacityTone(candidate.capacityStatus)}`}>
                              {formatRopCapacityLabel(candidate.capacityStatus)}
                            </span>
                            {candidate.availabilityLabel ? (
                              <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-teal-700">
                                {candidate.availabilityLabel}
                              </span>
                            ) : null}
                          </div>
                          {candidate.trustScore !== null ? <div className="mt-3"><RopTrustStars score={candidate.trustScore} /></div> : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-900">Score {candidate.score}</span>
                        {candidate.invitationStatus ? <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-700">Invitación {candidate.invitationStatus}</span> : null}
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                      <RopQuickContactActions phone={candidate.phonePublic} email={candidate.emailPublic} companyName={candidate.companyName} />
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Señales a favor</p>
                        <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
                          {candidate.positives.length ? candidate.positives.map((item) => <li key={item}>• {item}</li>) : <li>• Sin señales fuertes todavía.</li>}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Restricciones</p>
                        <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
                          {candidate.constraints.length ? candidate.constraints.map((item) => <li key={item}>• {item}</li>) : <li>• Sin restricciones visibles.</li>}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button variant="outline" className="rounded-full px-4" onClick={() => openInviteDialog(candidate.companyId)} disabled={Boolean(candidate.invitationStatus)}>
                        {candidate.invitationStatus ? 'Invitación creada' : 'Preparar invitación'}
                      </Button>
                      <Button asChild className="rounded-full px-4">
                        <Link href={`/dashboard/rop/empresas?serviceCatalogId=${encodeURIComponent(data.opportunity.serviceCatalogId)}`}>Acción {candidate.recommendedAction}</Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  Todavía no hay candidatos. Recalcula el shortlist para poblar RopOpportunityMatch con la heurística actual.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Radar className="h-5 w-5 text-teal-600" /> Contexto de la necesidad</CardTitle>
              <CardDescription>Estas señales alimentan el ranking actual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <p><span className="font-medium text-slate-900">Servicio:</span> {data.opportunity.categoryName} / {data.opportunity.subcategoryName} / {data.opportunity.serviceName}</p>
              <p><span className="font-medium text-slate-900">Ubicación:</span> {data.opportunity.location.city || data.opportunity.location.region || data.opportunity.location.countryCode}</p>
              <p><span className="font-medium text-slate-900">Cantidad:</span> {data.opportunity.expectedQuantity ?? 'Sin cantidad definida'}</p>
              <p><span className="font-medium text-slate-900">Entrega:</span> {data.opportunity.dueAt ? new Date(data.opportunity.dueAt).toLocaleString('es-CO') : 'Sin fecha objetivo'}</p>
              <p><span className="font-medium text-slate-900">Estado:</span> {data.opportunity.status}</p>
              <p><span className="font-medium text-slate-900">Visibilidad:</span> {data.opportunity.visibilityLevel}</p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Notas internas</CardTitle>
              <CardDescription>Este bloque se mantiene fuera de la señal pública.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-slate-600">
              {data.opportunity.requirementsPrivate || 'No hay requisitos privados registrados.'}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enviar invitación operativa</DialogTitle>
            <DialogDescription>
              Selecciona las empresas del shortlist que quieres invitar a esta necesidad y agrega un contexto público corto.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Mensaje público</Label>
              <Textarea value={inviteMessage} onChange={(event) => setInviteMessage(event.target.value)} rows={4} placeholder="Ej. Necesitamos confirmar capacidad y tiempos para esta oportunidad." />
            </div>
            <div className="space-y-2">
              <Label>Expira el</Label>
              <Input type="datetime-local" value={inviteExpiry} onChange={(event) => setInviteExpiry(event.target.value)} />
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">Empresas candidatas</p>
              <div className="space-y-3">
                {data.recommendations?.candidates.map((candidate) => {
                  const checked = selectedCompanyIds.includes(candidate.companyId)
                  const disabled = Boolean(candidate.invitationStatus)
                  return (
                    <label key={candidate.companyId} className={`flex items-start gap-3 rounded-2xl border px-3 py-3 ${disabled ? 'border-slate-200 bg-white/70 opacity-70' : checked ? 'border-teal-300 bg-white' : 'border-slate-200 bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => toggleCompany(candidate.companyId, event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <span className="min-w-0 flex flex-1 items-start gap-3">
                        <RopCompanyAvatar label={candidate.companyName} logoUrl={candidate.logoUrl} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-950">{candidate.companyName}</span>
                          <span className="block text-xs text-slate-500">{candidate.city || 'Ubicación sin publicar'} · Score {candidate.score}</span>
                          {candidate.trustScore !== null ? <span className="mt-1 block"><RopTrustStars score={candidate.trustScore} /></span> : null}
                          {candidate.invitationStatus ? <span className="mt-1 block text-xs font-medium text-teal-700">Ya tiene invitación {candidate.invitationStatus}.</span> : null}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={sendingInvites}>Cancelar</Button>
            <Button onClick={() => void sendInvitations()} disabled={sendingInvites || !selectedCompanyIds.length}>
              {sendingInvites ? 'Enviando...' : 'Enviar invitaciones'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}