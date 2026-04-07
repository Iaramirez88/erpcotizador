import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getWebsiteServicesAccessForUser } from '@/lib/website-services'
import WebsiteServicesModuleTabs from '../website-services-module-tabs'
import WebsiteServiceTemplatesClient from './website-service-templates-client'

export const runtime = 'nodejs'

export default async function WebsiteServiceTemplatesPage() {
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
      <WebsiteServiceTemplatesClient />
    </div>
  )
}