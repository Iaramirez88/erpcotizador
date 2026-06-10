import { CrmChatbotStudioClient } from '@/components/crm/crm-chatbot-studio-client'

type SearchParams = {
  channelId?: string | string[]
}

export default async function CrmChatbotPanelPage({ searchParams }: { searchParams?: SearchParams | Promise<SearchParams> }) {
  const resolved = searchParams ? await Promise.resolve(searchParams) : undefined
  const requestedChannelId = Array.isArray(resolved?.channelId) ? resolved?.channelId[0] : resolved?.channelId

  return <CrmChatbotStudioClient initialChannelId={requestedChannelId ?? ''} />
}