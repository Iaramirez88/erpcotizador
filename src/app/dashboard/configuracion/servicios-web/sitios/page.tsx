import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import WebsiteServicesModuleTabs from '../website-services-module-tabs'
import WebsiteProjectsClient from './website-projects-client'

export const runtime = 'nodejs'

const siteLifecycle = [
  {
    title: 'Sitio',
    description: 'Registro maestro por empresa o cliente con subdominio, dominio propio, estado y plantilla base.',
  },
  {
    title: 'Páginas',
    description: 'Home, landing, política, blog o páginas de conversión con slug y SEO independientes.',
  },
  {
    title: 'Versiones',
    description: 'Cada publicación debe quedar versionada para preview, rollback y auditoría operativa.',
  },
  {
    title: 'Publicación',
    description: 'Despliegue por subdominio de Ordex o por dominio conectado por DNS y SSL.',
  },
] as const

const firstRelease = [
  'Subdominios tipo empresa.ordex.com o cliente.ordex.com.',
  'Constructor visual basado en bloques React renderizados desde JSON.',
  'Páginas responsive con preview desktop, tablet y mobile.',
  'Formularios conectados al CRM para crear leads, oportunidades o conversaciones.',
  'Estados borrador, preview y publicado con historial de versiones.',
] as const

export default async function WebsiteBuilderSitesPage() {
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
      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Configuración', href: '/dashboard/configuracion/empresa' },
          { label: 'Sitios web', href: '/dashboard/configuracion/servicios-web' },
          { label: 'Sitios' },
        ]}
        title="Sitios web"
        description="Base operativa para crear, organizar, versionar y publicar sitios desde Ordex."
      />

      <WebsiteServicesModuleTabs />

      <WebsiteProjectsClient />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <Card className="rounded-[26px] border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Lifecycle del producto</CardTitle>
            <CardDescription>
              Esta capa organiza el inventario de sitios antes de conectar el builder visual con Puck.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {siteLifecycle.map((step) => (
              <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="text-sm font-semibold text-slate-950">{step.title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{step.description}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Primer release</CardTitle>
            <CardDescription>
              Alcance sugerido para la primera versión pública del constructor de sitios.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {firstRelease.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}