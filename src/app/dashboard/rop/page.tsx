import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getRopHomeForUser } from '@/lib/rop'
import { canAccessRopModule } from '@/lib/rop-access'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function actionHref(type: 'PUBLISH_NEED' | 'VIEW_RECOMMENDATIONS' | 'COMPLETE_PROFILE' | 'VIEW_CLUSTER' | 'EDIT_PROFILE') {
  switch (type) {
    case 'COMPLETE_PROFILE':
    case 'EDIT_PROFILE':
      return '/dashboard/rop/perfil'
    case 'VIEW_CLUSTER':
      return '/dashboard/rop/empresas'
    case 'PUBLISH_NEED':
      return '/dashboard/rop/necesidades/nueva'
    case 'VIEW_RECOMMENDATIONS':
    default:
      return '/dashboard/rop/empresas'
  }
}

export default async function RopPage() {
  const access = await canAccessRopModule()
  if (!access.ok) redirect('/dashboard')

  const home = await getRopHomeForUser(access.userId)

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.18),_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#ecfeff_55%,_#fefce8_100%)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">Ordex ROP</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{home.hero.title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-700 sm:text-base">{home.hero.summary}</p>
            {home.cluster ? (
              <div className="inline-flex rounded-full border border-teal-200 bg-white/80 px-3 py-1 text-sm text-teal-800">
                Cluster activo: {home.cluster.name}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-full px-5">
              <Link href={actionHref(home.hero.primaryAction.type)}>{home.hero.primaryAction.label}</Link>
            </Button>
            {home.hero.secondaryAction ? (
              <Button asChild variant="outline" className="rounded-full bg-white/80 px-5">
                <Link href={actionHref(home.hero.secondaryAction.type)}>{home.hero.secondaryAction.label}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {home.rails.map((rail) => (
          <Card key={rail.key} className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">{rail.title}</CardTitle>
              <CardDescription>{rail.items.length ? `${rail.items.length} señales activas` : 'Aún sin señales activas'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rail.items.length ? (
                rail.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-950">{item.title}</p>
                        {item.subtitle ? <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p> : null}
                      </div>
                      {item.trustScore !== null ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Trust {item.trustScore}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.reason}</p>
                    {item.availabilityLabel ? (
                      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-teal-700">{item.availabilityLabel}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Esta sección se activará cuando existan datos publicados en la red o completes el perfil operativo.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}