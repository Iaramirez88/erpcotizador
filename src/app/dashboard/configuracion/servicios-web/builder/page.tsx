import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveUserIdFromSession } from '@/lib/session-user'
import Link from 'next/link'
import { getWebsiteServicesAccessForUser, hasWebsiteBuilderPagesForEmpresa } from '@/lib/website-services'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import WebsiteServicesModuleTabs from '../website-services-module-tabs'

export const runtime = 'nodejs'

export default async function WebsiteBuilderPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard')

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess) {
    redirect('/dashboard')
  }
  const showBuilderTab = access.empresaId ? await hasWebsiteBuilderPagesForEmpresa(access.empresaId) : false

  return (
    <div className="space-y-4">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Inicio', href: '/dashboard' },
          { label: 'Configuración', href: '/dashboard/configuracion/empresa' },
          { label: 'Sitios web', href: '/dashboard/configuracion/servicios-web' },
          { label: 'Builder visual' },
        ]}
        title="Builder visual con Puck"
        description="Base del editor tipo Wix para construir sitios con bloques, responsive preview y publicación controlada."
      />

      <WebsiteServicesModuleTabs showBuilderTab={showBuilderTab} />

      <Card className="rounded-[26px] border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            El editor se abre por página desde Sitios. Selecciona un sitio y entra en "Abrir builder" para editar su contenido.
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard/configuracion/servicios-web/sitios">Ir a Sitios</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}