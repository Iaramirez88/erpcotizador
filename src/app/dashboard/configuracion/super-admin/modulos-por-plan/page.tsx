import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/super-admin'
import SuperAdminPlanModulesClient from './super-admin-plan-modules-client'

export const runtime = 'nodejs'

export default async function SuperAdminPlanModulesPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const email = session.user.email ?? null
  if (session.user.role !== 'ADMIN' || !isSuperAdminEmail(email)) {
    redirect('/dashboard')
  }

  return <SuperAdminPlanModulesClient />
}
