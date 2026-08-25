import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveUserIdFromSession } from '@/lib/session-user'
import RopOpportunityDetailClient from './rop-opportunity-detail-client'

export const runtime = 'nodejs'

export default async function RopNeedDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard/rop')

  return <RopOpportunityDetailClient opportunityId={id} />
}