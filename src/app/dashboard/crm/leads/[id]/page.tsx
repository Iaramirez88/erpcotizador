import { auth } from '@/lib/auth'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { resolveDashboardChatAccessForUser } from '@/lib/dashboard-chat-access'
import { CrmLeadDetailClient } from '@/components/crm/crm-lead-detail-client'

export default async function CrmLeadDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const session = await auth()
  const userId = session?.user ? await resolveUserIdFromSession(session) : null
  const chatAccess = userId ? await resolveDashboardChatAccessForUser(userId) : { canAccessTeamChat: false, canAccessCrmChat: false }

  return <CrmLeadDetailClient leadId={id} canAccessAnyChat={chatAccess.canAccessTeamChat || chatAccess.canAccessCrmChat} />
}
