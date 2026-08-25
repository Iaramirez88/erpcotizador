'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Building2, KeyRound, ShieldCheck, Sparkles } from 'lucide-react'
import { RegisterPageClient } from '@/app/auth/register/register-page-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ExternalDashboardScopeCookieBridge from '@/components/dashboard/external-dashboard-scope-cookie-bridge'

type PublicOnboardingCompany = {
  id: string
  title: string
  legalName: string
  city: string | null
  region: string | null
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'
  description: string | null
  workspaceCode: string
  requiresAccessCode: boolean
  services: string[]
}

const signals = [
  {
    title: 'Ingreso sin fricción al ERP',
    description: 'La invitación cae en un portal corto y directo. Solo completas tus datos y entras al flujo operativo correcto.',
    icon: KeyRound,
  },
  {
    title: 'Exposición acotada',
    description: 'Aquí solo abrimos empresas ROP públicas, activas y con código de espacio vigente para onboarding externo.',
    icon: ShieldCheck,
  },
  {
    title: 'Arranque orientado a colaboración',
    description: 'Tu siguiente paso natural es activar perfil, servicios y capacidad para entrar a discovery, invitaciones y reputación.',
    icon: Sparkles,
  },
] as const

function buildParams(args: { empresaId?: string; email?: string; accessCode?: string }) {
  const params = new URLSearchParams()
  if (args.empresaId) params.set('empresaId', args.empresaId)
  if (args.email) params.set('email', args.email)
  if (args.accessCode) params.set('accessCode', args.accessCode)
  return params
}

export function RopExternalOnboardingClient() {
  const router = useRouter()
  const pathname = usePathname()
  const safePathname = pathname || '/rop/unirse'
  const ropCallbackUrl = '/dashboard/rop/activar'
  const searchParams = useSearchParams()
  const [companies, setCompanies] = useState<PublicOnboardingCompany[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [email, setEmail] = useState(searchParams?.get('email') ?? '')
  const [workspaceCode, setWorkspaceCode] = useState(searchParams?.get('empresaId') ?? '')
  const [accessCode, setAccessCode] = useState(searchParams?.get('accessCode') ?? '')

  useEffect(() => {
    setEmail(searchParams?.get('email') ?? '')
    setWorkspaceCode(searchParams?.get('empresaId') ?? '')
    setAccessCode(searchParams?.get('accessCode') ?? '')
  }, [searchParams])

  useEffect(() => {
    let active = true

    async function loadCompanies() {
      setLoadingCompanies(true)
      setLoadingError(null)
      try {
        const response = await fetch('/api/rop/public/onboarding/companies', { cache: 'no-store' })
        const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: PublicOnboardingCompany[]; error?: string }

        if (!response.ok || !payload.ok || !Array.isArray(payload.data)) {
          throw new Error(payload.error || 'No se pudo cargar el directorio público.')
        }

        if (active) setCompanies(payload.data)
      } catch (error) {
        if (active) setLoadingError(error instanceof Error ? error.message : 'No se pudo cargar el directorio público.')
      } finally {
        if (active) setLoadingCompanies(false)
      }
    }

    void loadCompanies()
    return () => {
      active = false
    }
  }, [])

  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return companies

    return companies.filter((company) => {
      const haystack = [company.title, company.legalName, company.city, company.region, ...company.services]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [companies, search])

  function applyRegistrationContext(next: { empresaId?: string; email?: string; accessCode?: string }) {
    const params = buildParams({
      empresaId: next.empresaId ?? workspaceCode.trim().toUpperCase(),
      email: next.email ?? email.trim().toLowerCase(),
      accessCode: next.accessCode ?? accessCode.trim(),
    })
    params.set('callbackUrl', ropCallbackUrl)
    router.replace(params.size ? `${safePathname}?${params.toString()}` : safePathname)
  }

  function selectCompany(company: PublicOnboardingCompany) {
    setWorkspaceCode(company.workspaceCode)
    applyRegistrationContext({ empresaId: company.workspaceCode })
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.14),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#ecfeff_48%,_#fff7ed_100%)]">
      <ExternalDashboardScopeCookieBridge enabled />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-start">
            <div className="space-y-6">
              <div className="space-y-3">
                <span className="inline-flex rounded-full bg-teal-600 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-white">Fase 6 · Apertura externa</span>
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Únete a una red operativa real sin entrar primero al ERP completo.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  Este portal concentra el onboarding externo de ORDEX ROP. Si recibiste una invitación o un código de espacio, aquí preparas tu registro y caes directo en el flujo correcto.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {signals.map((signal) => {
                  const Icon = signal.icon
                  return (
                    <div key={signal.title} className="rounded-[24px] border border-slate-200 bg-slate-50/85 p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="mt-4 text-base font-semibold text-slate-950">{signal.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{signal.description}</p>
                    </div>
                  )
                })}
              </div>

              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/75 p-5 text-sm leading-6 text-slate-600">
                Si tu empresa todavía no aparece, pídele a un administrador que te comparta una invitación o habilite un código de acceso. Si ya tienes cuenta, puedes entrar por <Link href="/auth/login" className="font-medium text-teal-700 underline decoration-teal-300 underline-offset-4">inicio de sesión</Link>.
              </div>
            </div>

            <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Preparar acceso</CardTitle>
                <CardDescription>Usa tu código WS o selecciona una empresa pública ya activa en ROP.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workspaceCode">Código del espacio</Label>
                  <Input
                    id="workspaceCode"
                    value={workspaceCode}
                    onChange={(event) => setWorkspaceCode(event.target.value.toUpperCase())}
                    placeholder="WS-ABCD1234"
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inviteEmail">Correo de invitación</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tu@empresa.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accessCode">Código de acceso</Label>
                  <Input
                    id="accessCode"
                    value={accessCode}
                    onChange={(event) => setAccessCode(event.target.value)}
                    placeholder="Opcional si tu invitación lo exige"
                  />
                </div>

                <Button className="w-full rounded-full" type="button" onClick={() => applyRegistrationContext({})} disabled={!workspaceCode.trim()}>
                  Continuar al registro guiado
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <p className="text-xs leading-5 text-slate-500">
                  Este paso solo preconfigura tu registro. La creación de cuenta y la validación de invitación siguen usando el backend existente.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_420px]">
          <Card className="rounded-[28px] border-slate-200 bg-white/92 shadow-sm">
            <CardHeader>
              <CardTitle>Empresas públicas ya activas en ROP</CardTitle>
              <CardDescription>Directorio mínimo para que un externo encuentre el espacio correcto antes de registrarse.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-md">
                  <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por empresa, ciudad o servicio" className="pl-9" />
                </div>
                <p className="text-xs text-slate-500">{filteredCompanies.length} espacios listos para onboarding</p>
              </div>

              {loadingError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadingError}</div> : null}
              {loadingCompanies ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">Cargando directorio público...</div> : null}

              {!loadingCompanies && !filteredCompanies.length ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No hay coincidencias con ese filtro. Puedes continuar igual si ya tienes un código WS compartido por el administrador.
                </div>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                {filteredCompanies.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => selectCompany(company)}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 text-left transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-950">{company.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{company.workspaceCode}</p>
                      </div>
                      <span className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                        {company.verificationStatus === 'VERIFIED' ? 'Verificada' : company.verificationStatus === 'PENDING' ? 'Pendiente' : 'Restringida'}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-600">{company.description || company.legalName}</p>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                      {company.city || company.region ? <span className="rounded-full bg-white px-3 py-1">{[company.city, company.region].filter(Boolean).join(', ')}</span> : null}
                      {company.requiresAccessCode ? <span className="rounded-full bg-white px-3 py-1">Requiere código adicional</span> : <span className="rounded-full bg-white px-3 py-1">Acceso directo con WS</span>}
                      {company.services.slice(0, 2).map((service) => (
                        <span key={service} className="rounded-full bg-white px-3 py-1">{service}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="lg:sticky lg:top-8 lg:self-start">
            <RegisterPageClient defaultCallbackUrl={ropCallbackUrl} />
          </div>
        </section>
      </div>
    </div>
  )
}