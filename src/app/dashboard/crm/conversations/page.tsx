import { redirect } from 'next/navigation'

/**
 * Ruta heredada del inbox omnicanal. Se redirige a "Conversaciones" unificadas
 * (/dashboard/chat) para no competir con la bandeja de Leads.
 */
export default function CrmConversationsLegacyPage() {
  redirect('/dashboard/chat')
}
