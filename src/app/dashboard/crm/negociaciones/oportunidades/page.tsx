import { auth } from '@/lib/auth'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { resolveDashboardChatAccessForUser } from '@/lib/dashboard-chat-access'
import { CrmDashboardClient } from '@/components/crm/crm-dashboard-client'

export default async function CrmNegociacionesOportunidadesPage() {
  const session = await auth()
  const userId = session?.user ? await resolveUserIdFromSession(session) : null
  const chatAccess = userId ? await resolveDashboardChatAccessForUser(userId) : { canAccessTeamChat: false, canAccessCrmChat: false }

  return <CrmDashboardClient mode="opportunities" initialOpportunityView="list" {...chatAccess} />
}