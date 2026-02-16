import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/super-admin'
import SuperAdminUsersClient from './super-admin-users-client'

export const runtime = 'nodejs'

export default async function SuperAdminUsersPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const email = session.user.email ?? null
  if (session.user.role !== 'ADMIN' || !isSuperAdminEmail(email)) {
    redirect('/dashboard')
  }

  return <SuperAdminUsersClient />
}
