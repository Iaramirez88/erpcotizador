import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, ChevronRight, Radar, ShieldCheck, Sparkles } from 'lucide-react'
import { getRopProfileForUser } from '@/lib/rop'
import { canAccessRopModule } from '@/lib/rop-access'
import { RopModuleChrome } from '@/components/dashboard/rop-module-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import ExternalDashboardScopeCookieBridge from '@/components/dashboard/external-dashboard-scope-cookie-bridge'

export const runtime = 'nodejs'

const activationSignals = [
  {
    title: 'Discovery contextual',
    description: 'Haz visible tu capacidad para que la red encuentre aliados y proveedores con mejor fit operativo.',
    icon: Radar,
  },
  {
    title: 'Confianza trazable',
    description: 'La visibilidad se apoya en señales operativas reales y no en un directorio plano de empresas.',
    icon: ShieldCheck,
  },
  {
    title: 'Entrada sin fricción',
    description: 'El onboarding reaprovecha datos de tu empresa y te deja listo para publicar servicios y capacidad.',
    icon: Sparkles,
  },
] as const

export default async function RopActivatePage() {
  const access = await canAccessRopModule()
  if (!access.ok) redirect('/dashboard')

  const profile = await getRopProfileForUser(access.userId)
  const isActivated = profile.onboardingStatus === 'ACTIVE' && profile.profileCompletionPercent >= 70

  return (
    <div className="space-y-6 pb-8">
      <ExternalDashboardScopeCookieBridge enabled={!isActivated} />

      <RopModuleChrome
        current="activar"
        breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'ROP', href: '/dashboard/rop' }, { label: 'Activar' }]}
        title={isActivated ? 'Tu empresa ya está activa en ORDEX ROP' : 'Activa tu empresa en la red operativa'}
        description={isActivated
          ? 'Ya tienes base suficiente para discovery y matching. Desde aquí solo ajustas perfil, servicios y capacidad visible.'
          : 'Define perfil, servicios y visibilidad. Luego ROP empieza a recomendar empresas y oportunidades.'}
        actions={
          <>
            <Button asChild className="rounded-full px-5">
              <Link href="/dashboard/rop/perfil">
                {isActivated ? 'Afinar perfil operativo' : 'Empezar activación'}
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href="/dashboard/rop">Volver al home ROP</Link>
            </Button>
          </>
        }
        stats={[
          { label: 'Completitud', value: `${profile.profileCompletionPercent}%`, hint: 'Progreso del onboarding ROP', tone: 'teal' },
          { label: 'Servicios', value: profile.services.length, hint: 'Servicios operativos registrados', tone: 'amber' },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_360px]">
        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Qué habilita esta activación</CardTitle>
            <CardDescription>La secuencia correcta sigue siendo perfil operativo, capacidad y luego discovery accionable.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {activationSignals.map((signal) => {
              const Icon = signal.icon
              return (
                <div key={signal.title} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-950">{signal.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{signal.description}</p>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Estado actual</CardTitle>
            <CardDescription>Se calcula con el perfil operativo ya persistido.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Completitud</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{profile.profileCompletionPercent}%</p>
              <p className="mt-2">Estado de onboarding: {profile.onboardingStatus}</p>
            </div>

            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p>Perfil legal base sincronizado desde la empresa actual.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p>Servicios registrados: {profile.services.length}</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p>Visibilidad actual: {profile.visibility.profile}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="font-medium text-slate-900">Política base de exposición</p>
              <p className="mt-2">ROP solo debe abrir nombre comercial, ubicación resumida, servicios, cobertura, capacidad resumida y señales de confianza permitidas por policy.</p>
            </div>

            <Button asChild variant="ghost" className="h-auto rounded-full px-0 text-teal-700 hover:bg-transparent hover:text-teal-800">
              <Link href="/dashboard/rop/perfil">
                Continuar con perfil y capacidad
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}