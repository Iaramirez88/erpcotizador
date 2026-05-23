'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BriefcaseBusiness, Building2, Calculator, Check, ChefHat, ChevronLeft, ChevronRight, HeartPulse, Scale, Sparkles, Stethoscope } from 'lucide-react'
import {
  BUSINESS_TYPES,
  ONBOARDING_GOALS,
  SALES_MODELS,
  TEAM_SIZES,
  WORKFLOW_NEEDS,
  buildCompanyPreset,
  getBusinessOnboardingProfile,
  getBusinessTypeLabel,
  getDefaultCompanyOnboardingData,
  getOptionalAddonDefinitions,
  type CompanyOnboardingData,
  type OnboardingAddonDefinition,
  type WorkflowNeed,
} from '@/lib/company-onboarding'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type OnboardingWizardClientProps = {
  initialData: CompanyOnboardingData
  mode?: 'page' | 'modal'
  open?: boolean
  required?: boolean
  onCompleted?: () => void
  onDismiss?: () => void
}

const TOTAL_STEPS = 4

const GOAL_LABELS: Record<(typeof ONBOARDING_GOALS)[number], string> = {
  SALES_PIPELINE: 'Vender y hacer seguimiento comercial',
  OPERATIONS: 'Ordenar la operación diaria',
  POINT_OF_SALE: 'Cobrar y facturar rápido',
  FINANCIAL_CONTROL: 'Tomar control financiero',
  CUSTOMER_FOLLOWUP: 'Centralizar clientes y agenda',
}

const GOAL_HELPERS: Record<(typeof ONBOARDING_GOALS)[number], string> = {
  SALES_PIPELINE: 'Ideal si el arranque depende de captar, cotizar y cerrar mejor.',
  OPERATIONS: 'Pensado para equipos que necesitan orden y ejecución desde el día uno.',
  POINT_OF_SALE: 'Enfocado en una operación transaccional con cobro constante.',
  FINANCIAL_CONTROL: 'Útil cuando tu prioridad es ordenar cierres, caja y números.',
  CUSTOMER_FOLLOWUP: 'Perfecto si la relación y el seguimiento pesan más que la venta rápida.',
}

const SALES_MODEL_LABELS: Record<(typeof SALES_MODELS)[number], string> = {
  PRODUCTS: 'Principalmente productos',
  SERVICES: 'Principalmente servicios',
  MIXED: 'Productos y servicios',
}

const TEAM_SIZE_LABELS: Record<(typeof TEAM_SIZES)[number], string> = {
  SOLO: 'Solo yo',
  SMALL: '2 a 5 personas',
  MEDIUM: '6 a 20 personas',
  LARGE: 'Más de 20 personas',
}

const WORKFLOW_LABELS: Record<(typeof WORKFLOW_NEEDS)[number], string> = {
  APPOINTMENTS: 'Agenda y citas',
  INVENTORY: 'Inventario',
  BILLING: 'Facturación',
  ACCOUNTING: 'Cierre contable',
  PRODUCTION: 'Producción',
}

const BUSINESS_ICONS: Record<(typeof BUSINESS_TYPES)[number], React.ComponentType<{ className?: string }>> = {
  ODONTOLOGIA: Stethoscope,
  RESTAURANTE: ChefHat,
  ABOGADOS: Scale,
  CLINICA: HeartPulse,
  CONTABILIDAD: Calculator,
  DOTACIONES: BriefcaseBusiness,
  COMERCIO: Building2,
  SERVICIOS: Sparkles,
}

const STEP_TITLES = [
  'Elige tu nicho',
  'Define tu prioridad',
  'Ajusta tu operación base',
  'Amplía con módulos opcionales',
] as const

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function buildAddonPriceLabel(addon: OnboardingAddonDefinition) {
  if (addon.monthlyPriceCOP <= 0) return 'Incluida en Contabilidad'
  return `${formatMoney(addon.monthlyPriceCOP)} / mes`
}

function LoadingAssembly() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 text-center">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-10 w-10 rounded-2xl border border-sky-200 bg-[linear-gradient(180deg,#ffffff,#eaf6ff)] shadow-[0_14px_30px_-20px_rgba(14,165,233,0.8)] animate-[pulse_1.15s_ease-in-out_infinite]"
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </div>
      <div className="space-y-2">
        <div className="text-xl font-semibold text-slate-950">Estamos ajustando todo para tu trabajo</div>
        <p className="max-w-md text-sm leading-6 text-slate-600">
          Encendemos los módulos correctos, limpiamos lo que no aplica a tu nicho y dejamos tu inicio listo para trabajar.
        </p>
      </div>
    </div>
  )
}

function StepPill(props: { index: number; currentStep: number; label: string }) {
  const completed = props.index < props.currentStep
  const active = props.index === props.currentStep

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-2xl border px-3 py-2 transition-all',
      active ? 'border-sky-300 bg-sky-50 text-sky-950' : completed ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-500',
    )}>
      <div className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
        active ? 'bg-sky-600 text-white' : completed ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600',
      )}>
        {props.index + 1}
      </div>
      <div className="text-sm font-medium">{props.label}</div>
    </div>
  )
}

export default function OnboardingWizardClient({
  initialData,
  mode = 'page',
  open = true,
  required = false,
  onCompleted,
  onDismiss,
}: OnboardingWizardClientProps) {
  const router = useRouter()
  const [form, setForm] = useState<CompanyOnboardingData>(initialData ?? getDefaultCompanyOnboardingData())
  const [step, setStep] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [showFinishingLoader, setShowFinishingLoader] = useState(false)

  const selectedGoalSet = useMemo(() => new Set(form.primaryGoals), [form.primaryGoals])
  const selectedWorkflowSet = useMemo(() => new Set(form.workflowNeeds), [form.workflowNeeds])
  const selectedAddonSet = useMemo(() => new Set(form.optionalAddons), [form.optionalAddons])
  const presetPreview = useMemo(() => buildCompanyPreset(form), [form])
  const businessProfile = useMemo(() => getBusinessOnboardingProfile(form.businessType), [form.businessType])
  const addonDefinitions = useMemo(() => getOptionalAddonDefinitions(form.businessType), [form.businessType])

  function setBusinessType(value: CompanyOnboardingData['businessType']) {
    setForm((current) => ({ ...current, businessType: value }))
  }

  function setPrimaryGoal(value: CompanyOnboardingData['primaryGoal']) {
    setForm((current) => ({ ...current, primaryGoal: value, primaryGoals: [value] }))
  }

  function togglePrimaryGoal(value: CompanyOnboardingData['primaryGoal']) {
    setForm((current) => {
      const exists = current.primaryGoals.includes(value)
      const nextGoals = exists
        ? current.primaryGoals.filter((item) => item !== value)
        : [...current.primaryGoals, value]

      if (!nextGoals.length) {
        return { ...current, primaryGoal: value, primaryGoals: [value] }
      }

      return {
        ...current,
        primaryGoal: nextGoals[0],
        primaryGoals: nextGoals,
      }
    })
  }

  function selectAllPrimaryGoals() {
    setForm((current) => ({
      ...current,
      primaryGoal: ONBOARDING_GOALS[0],
      primaryGoals: [...ONBOARDING_GOALS],
    }))
  }

  function setSalesModel(value: CompanyOnboardingData['salesModel']) {
    setForm((current) => ({ ...current, salesModel: value }))
  }

  function setTeamSize(value: CompanyOnboardingData['teamSize']) {
    setForm((current) => ({ ...current, teamSize: value }))
  }

  function toggleWorkflow(need: WorkflowNeed) {
    setForm((current) => ({
      ...current,
      workflowNeeds: current.workflowNeeds.includes(need)
        ? current.workflowNeeds.filter((item) => item !== need)
        : [...current.workflowNeeds, need],
    }))
  }

  function toggleAddon(addonId: OnboardingAddonDefinition['id']) {
    setForm((current) => ({
      ...current,
      optionalAddons: current.optionalAddons.includes(addonId)
        ? current.optionalAddons.filter((item) => item !== addonId)
        : [...current.optionalAddons, addonId],
    }))
  }

  function canContinue() {
    if (step === 0) return Boolean(form.businessType)
    if (step === 1) return form.primaryGoals.length > 0
    return true
  }

  async function handleSubmit() {
    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/onboarding/empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }

      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'No se pudo guardar la configuración inicial')
      }

      setShowFinishingLoader(true)
      await new Promise((resolve) => setTimeout(resolve, 1400))

      onCompleted?.()
      router.refresh()

      if (mode === 'page') {
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la configuración inicial')
      setShowFinishingLoader(false)
    } finally {
      setIsSaving(false)
    }
  }

  const content = (
    <div className={cn('space-y-5', mode === 'modal' ? 'max-h-[85vh] overflow-y-auto pr-1' : '')}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {STEP_TITLES.map((label, index) => (
            <StepPill key={label} index={index} currentStep={step} label={label} />
          ))}
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.08),transparent_26%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.12),transparent_32%),linear-gradient(180deg,#ffffff,#f8fafc)] p-5 shadow-[0_20px_45px_-35px_rgba(15,23,42,0.3)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Configuración guiada</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{businessProfile.heroTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                {businessProfile.heroDescription}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-sm">
              <div className="font-medium text-slate-950">{presetPreview.dashboard.headline}</div>
              <div className="mt-1">{presetPreview.modules.length} módulos activos para arrancar</div>
              <div className="mt-1 text-xs text-slate-500">Sin frentes sobrantes para {getBusinessTypeLabel(form.businessType).toLowerCase()}.</div>
            </div>
          </div>
        </div>
      </div>

      {showFinishingLoader ? <LoadingAssembly /> : null}

      {!showFinishingLoader ? (
        <>
          {step === 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {BUSINESS_TYPES.map((item) => {
                const Icon = BUSINESS_ICONS[item]
                const selected = form.businessType === item
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setBusinessType(item)}
                    className={cn(
                      'rounded-[24px] border p-4 text-left transition-all',
                      selected
                        ? 'border-sky-300 bg-[linear-gradient(180deg,#f7fcff,#eef8ff)] shadow-[0_18px_34px_-24px_rgba(14,165,233,0.45)]'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/70 bg-white/85 text-slate-900 shadow-sm">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="mt-4 text-lg font-semibold text-slate-950">{getBusinessTypeLabel(item)}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">
                      {item === 'ODONTOLOGIA' ? 'Historia clínica, agenda, pacientes y flujo clínico base.' : null}
                      {item === 'CONTABILIDAD' ? 'Cierres, cartera, reportes y operación financiera formal.' : null}
                      {item === 'ABOGADOS' ? 'Clientes, seguimiento de casos y operación de servicios profesionales.' : null}
                      {item === 'RESTAURANTE' ? 'Caja, inventario, compras y ritmo operativo diario.' : null}
                      {item === 'DOTACIONES' ? 'Cotización, pedidos, inventario y entregas para dotaciones.' : null}
                      {item === 'COMERCIO' ? 'Venta, cobro, inventario y entregas para retail o distribución.' : null}
                      {item === 'CLINICA' ? 'Atención, pacientes y facturación de servicios de salud.' : null}
                      {item === 'SERVICIOS' ? 'Cotización, clientes y operación ligera de servicios.' : null}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-950">{businessProfile.priorityPrompt}</div>
                <div className="mt-1 text-slate-600">Esto nos ayuda a subir primero el frente con más impacto para tu nicho.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant={selectedGoalSet.size === ONBOARDING_GOALS.length ? 'default' : 'outline'} className="h-11 rounded-full px-4 text-sm" onClick={selectAllPrimaryGoals}>
                  <Check className="mr-2 h-4 w-4" />
                  Seleccionar todo
                </Button>
                <div className="text-sm text-slate-500">Puedes marcar varias prioridades si el arranque necesita más de un frente fuerte.</div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {ONBOARDING_GOALS.map((item) => {
                  const selected = selectedGoalSet.has(item)
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => togglePrimaryGoal(item)}
                      className={cn(
                        'rounded-[24px] border p-5 text-left transition-all',
                        selected ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full border transition-all',
                          selected ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white text-transparent',
                        )}>
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        {selected && form.primaryGoal === item ? (
                          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                            Principal
                          </span>
                        ) : null}
                      </div>
                      <div className="text-lg font-semibold text-slate-950">{GOAL_LABELS[item]}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">{GOAL_HELPERS[item]}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-slate-950">{businessProfile.operationsPrompt}</div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {SALES_MODELS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSalesModel(item)}
                      className={cn(
                        'rounded-[22px] border px-4 py-4 text-left text-sm transition-all',
                        form.salesModel === item ? 'border-sky-300 bg-sky-50 text-sky-950' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                      )}
                    >
                      <div className="font-semibold">{SALES_MODEL_LABELS[item]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-950">Capacidades clave desde el arranque</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {WORKFLOW_NEEDS.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      variant={selectedWorkflowSet.has(item) ? 'default' : 'outline'}
                      className="h-11 rounded-full px-4 text-sm"
                      onClick={() => toggleWorkflow(item)}
                    >
                      {WORKFLOW_LABELS[item]}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-950">Tamaño actual del equipo</div>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  {TEAM_SIZES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTeamSize(item)}
                      className={cn(
                        'rounded-[22px] border px-4 py-4 text-left text-sm transition-all',
                        form.teamSize === item ? 'border-sky-300 bg-sky-50 text-sky-950' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                      )}
                    >
                      <div className="font-semibold">{TEAM_SIZE_LABELS[item]}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div>
                <div className="text-sm font-semibold text-slate-950">{businessProfile.addonsTitle}</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {businessProfile.addonsDescription}
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                {addonDefinitions.map((addon) => {
                  const selected = selectedAddonSet.has(addon.id)
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => toggleAddon(addon.id)}
                      className={cn(
                        'rounded-[24px] border p-5 text-left transition-all',
                        selected ? 'border-slate-950 bg-slate-950 text-white shadow-[0_20px_40px_-28px_rgba(15,23,42,0.75)]' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full border transition-all',
                            selected ? 'border-white/30 bg-white text-slate-950' : 'border-slate-300 bg-white text-transparent',
                          )}>
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <div className="text-lg font-semibold">{addon.title}</div>
                        </div>
                        <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]', selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700')}>
                          {selected ? 'Encendido' : 'Apagado'}
                        </span>
                      </div>
                      <div className={cn('mt-3 text-sm leading-6', selected ? 'text-slate-200' : 'text-slate-600')}>
                        {addon.description}
                      </div>
                      <div className={cn('mt-4 text-sm font-medium', selected ? 'text-white' : 'text-slate-900')}>
                        {buildAddonPriceLabel(addon)}
                      </div>
                      <div className={cn('mt-1 text-xs leading-5', selected ? 'text-slate-300' : 'text-slate-500')}>
                        {addon.helperText}
                      </div>
                      <div className={cn('mt-3 rounded-2xl border px-3 py-2 text-xs leading-5', selected ? 'border-white/15 bg-white/10 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-600')}>
                        <div className="font-semibold">{addon.competitiveNote}</div>
                        <div className="mt-1">{addon.businessFit[form.businessType] ?? 'Se activa solo cuando ese frente ya aporta retorno real a tu operación.'}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-950">Nota opcional</div>
                <Textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-[110px] rounded-[22px] text-sm"
                  placeholder="Si hay algo importante para tu arranque, escríbelo aquí y lo dejamos considerado en la configuración inicial."
                />
              </div>
            </div>
          ) : null}

          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <Card className="rounded-[26px] border-slate-200 bg-slate-50/80 shadow-none">
            <CardContent className="grid gap-3 p-5 md:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Así quedará tu arranque</div>
                <div className="mt-2 text-xl font-semibold text-slate-950">{presetPreview.dashboard.headline}</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{presetPreview.dashboard.description}</p>
                <div className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  Nicho limpio + activación gradual + precios transparentes
                </div>
              </div>
              <div className="space-y-2">
                {presetPreview.dashboard.checklist.slice(0, 3).map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-sm text-slate-500">Paso {step + 1} de {TOTAL_STEPS}</div>
            <div className="flex flex-wrap gap-3">
              {step > 0 ? (
                <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={() => setStep((current) => Math.max(0, current - 1))}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Atrás
                </Button>
              ) : null}
              {!required && mode === 'modal' ? (
                <Button type="button" variant="outline" className="rounded-2xl px-5" onClick={onDismiss}>
                  Continuar después
                </Button>
              ) : null}
              {step < TOTAL_STEPS - 1 ? (
                <Button type="button" className="rounded-2xl px-5" onClick={() => setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1))} disabled={!canContinue()}>
                  Siguiente
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" className="rounded-2xl px-5" onClick={() => void handleSubmit()} disabled={isSaving}>
                  {isSaving ? 'Guardando configuración...' : 'Aplicar configuración'}
                </Button>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )

  if (mode === 'modal') {
    return (
      <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !required) onDismiss?.() }}>
        <DialogContent hideClose={required} className="max-w-6xl rounded-[30px] border-slate-200 p-0">
          <div className="border-b border-slate-100 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-2xl text-slate-950">Configura tu espacio inicial</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-slate-600">
                Elige tu nicho, la prioridad de arranque y los módulos opcionales que sí quieres ver desde el primer día.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">{content}</div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="space-y-5">
      {content}
    </div>
  )
}