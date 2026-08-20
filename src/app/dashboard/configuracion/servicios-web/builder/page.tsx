import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import WebsiteServicesModuleTabs from '../website-services-module-tabs'

export const runtime = 'nodejs'

const builderBlocks = [
  'Hero',
  'Texto enriquecido',
  'Imagen',
  'Sección contenedora',
  'Sección de columnas',
  'Columnas flexibles',
  'Grid de tarjetas',
  'CTA',
  'Testimonios',
  'FAQ',
  'Mapa',
  'Formulario CRM',
] as const

const builderPhases = [
  {
    title: 'Editor Puck embebido',
    description: 'Canvas visual, panel de props, componentes React controlados y layout responsive por viewport.',
  },
  {
    title: 'Persistencia JSON',
    description: 'Cada página se guarda como árbol serializado de bloques y configuración; no como HTML libre.',
  },
  {
    title: 'Renderer público',
    description: 'Las páginas publicadas se resuelven por host y slug, usando sólo componentes permitidos por la plataforma.',
  },
  {
    title: 'Conexión con CRM',
    description: 'Los formularios del sitio se enlazan a leads, oportunidades, agenda o inbox según el objetivo comercial.',
  },
] as const

export default async function WebsiteBuilderPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard')

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-4">
      <WebsiteServicesModuleTabs />

      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Configuración', href: '/dashboard/configuracion/empresa' },
          { label: 'Servicios web', href: '/dashboard/configuracion/servicios-web' },
          { label: 'Builder visual' },
        ]}
        title="Builder visual con Puck"
        description="Base del editor tipo Wix para construir sitios con bloques, responsive preview y publicación controlada."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <Card className="rounded-[26px] border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Capas del builder</CardTitle>
            <CardDescription>
              Estas son las piezas que hay que montar para que Puck funcione como producto dentro de Ordex.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {builderPhases.map((phase) => (
              <div key={phase.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-sm font-semibold text-slate-950">{phase.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{phase.description}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Bloques V1</CardTitle>
            <CardDescription>
              Set inicial recomendado para salir rápido sin abrir HTML arbitrario.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {builderBlocks.map((block) => (
              <span key={block} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                {block}
              </span>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}