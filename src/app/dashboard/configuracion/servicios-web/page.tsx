import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import WebsiteServicesClient from './website-services-client'

export const runtime = 'nodejs'

export default async function WebsiteServicesPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard')

  const access = await getWebsiteServicesAccessForUser(userId)
  if (!access.canAccess) {
    redirect('/dashboard')
  }

  return <WebsiteServicesClient />
}