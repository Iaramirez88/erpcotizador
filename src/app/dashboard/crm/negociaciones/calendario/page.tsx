import { auth } from '@/lib/auth'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { resolveDashboardChatAccessForUser } from '@/lib/dashboard-chat-access'
import { CrmAgendaClient } from '@/components/crm/crm-agenda-client'

export default async function CrmNegociacionesCalendarioPage() {
  const session = await auth()
  const userId = session?.user ? await resolveUserIdFromSession(session) : null
  const chatAccess = userId ? await resolveDashboardChatAccessForUser(userId) : { canAccessTeamChat: false, canAccessCrmChat: false }

  return <CrmAgendaClient canAccessAnyChat={chatAccess.canAccessTeamChat || chatAccess.canAccessCrmChat} />
}