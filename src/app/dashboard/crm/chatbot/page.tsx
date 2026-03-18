import { CrmConversationsClient } from '@/components/crm/crm-conversations-client'

export default function CrmChatbotPanelPage() {
  return (
    <CrmConversationsClient
      initialProviderFilter="WEB_CHATBOT"
      title="Panel del chatbot"
      description="Aquí ves únicamente los prospectos y mensajes que llegan desde el chatbot web, con seguimiento comercial y respuesta desde CRM."
    />
  )
}