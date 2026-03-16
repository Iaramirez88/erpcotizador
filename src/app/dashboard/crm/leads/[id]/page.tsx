import { CrmLeadDetailClient } from '@/components/crm/crm-lead-detail-client'

export default async function CrmLeadDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return <CrmLeadDetailClient leadId={id} />
}
