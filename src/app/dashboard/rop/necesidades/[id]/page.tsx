import { redirect } from 'next/navigation'
import { canAccessRopModule } from '@/lib/rop-access'
import RopOpportunityDetailClient from './rop-opportunity-detail-client'

export const runtime = 'nodejs'

export default async function RopNeedDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const access = await canAccessRopModule()
  if (!access.ok) redirect('/dashboard')

  return <RopOpportunityDetailClient opportunityId={id} />
}