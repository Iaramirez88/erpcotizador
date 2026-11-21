import { CrmIntegrationsClient } from '@/components/crm/crm-integrations-client'
import { CrmMessagingConsumption } from '@/components/crm/crm-messaging-consumption'

export default function CrmIntegrationsPage() {
  return (
    <>
      <CrmMessagingConsumption />
      <CrmIntegrationsClient />
    </>
  )
}