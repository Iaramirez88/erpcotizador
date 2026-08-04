import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { getBackupAccess } from '@/lib/empresa-backups'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { RespaldoClient } from '@/app/dashboard/configuracion/respaldo/respaldo-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RespaldoPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const access = await getBackupAccess({ empresaId, userId: session.user.id })

  if (!access.canExport && !access.canImport) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Configuración', href: '/dashboard/configuracion/empresa' },
          { label: 'Respaldo' },
        ]}
        eyebrow="Plataforma"
        title="Respaldo"
        description="Genera copias por empresa, filtra por período y módulos, descarga en SQL o Excel, revisa el historial y restaura respaldos seguros sobre la base actual."
      />
      <RespaldoClient initialAccess={access} />
    </div>
  )
}