import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CrmPublicChatbotEmbed } from '@/components/crm/crm-public-chatbot-embed'
import { getPublicChatbotSettings, getReferrerHost, getRequestHost, isChatbotDomainAllowed } from '@/lib/crm-public-chatbot'

type PageProps = {
  params: Promise<{ channelId: string }>
}

export default async function PublicChatbotPage(props: PageProps) {
  const { channelId } = await props.params
  const channel = await prisma.crmChannelConnection.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      name: true,
      provider: true,
      status: true,
      settingsJson: true,
    },
  })

  if (!channel || channel.provider !== 'WEB_CHATBOT' || !['TESTING', 'ACTIVE'].includes(channel.status)) {
    notFound()
  }

  const settings = getPublicChatbotSettings(channel.settingsJson)
  if (!settings.publicEmbedEnabled) {
    notFound()
  }

  const requestHost = await getRequestHost()
  const referrerHost = await getReferrerHost()
  if (!isChatbotDomainAllowed({ allowedDomains: settings.allowedDomains, candidateHost: referrerHost || requestHost, appHost: requestHost })) {
    notFound()
  }

  return (
    <CrmPublicChatbotEmbed
      channelId={channel.id}
      title={settings.chatbotTitle || channel.name}
      prompt={settings.chatbotPrompt}
      assistantName={settings.assistantName}
      accentColor={settings.accentColor}
      pageBackgroundColor={settings.pageBackgroundColor}
      backgroundColor={settings.backgroundColor}
      fontFamily={settings.fontFamily}
      customCss={settings.chatbotCustomCss}
      nameLabel={settings.nameLabel}
      namePlaceholder={settings.namePlaceholder}
      emailLabel={settings.emailLabel}
      emailPlaceholder={settings.emailPlaceholder}
      phoneLabel={settings.phoneLabel}
      phonePlaceholder={settings.phonePlaceholder}
      showProductField={settings.showProductField}
      productLabel={settings.productLabel}
      productPlaceholder={settings.productPlaceholder}
      messageLabel={settings.messageLabel}
      messagePlaceholder={settings.messagePlaceholder}
      allowHumanHandoff={settings.allowHumanHandoff}
    />
  )
}