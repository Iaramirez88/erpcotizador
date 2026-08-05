import { IntelligenceDashboardClient } from '@/components/dashboard/intelligence-dashboard-client'
import { auth } from '@/lib/auth'
import { isCompanyIntelligenceEnabledForEmpresa } from '@/lib/company-intelligence'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'

export default async function InteligenciaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/login')

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const enabled = await isCompanyIntelligenceEnabledForEmpresa(empresaId)
  if (!enabled) redirect('/dashboard/reportes')

  return <IntelligenceDashboardClient />
}