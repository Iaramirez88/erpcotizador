import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/super-admin'
import SuperAdminTrialClient from './super-admin-trial-client'

export const runtime = 'nodejs'

export default async function SuperAdminTrialPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const email = session.user.email ?? null
  if (!isSuperAdminEmail(email)) {
    redirect('/dashboard')
  }

  return <SuperAdminTrialClient />
}
