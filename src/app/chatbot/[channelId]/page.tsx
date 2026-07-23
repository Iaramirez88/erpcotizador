import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CrmPublicChatbotEmbed } from '@/components/crm/crm-public-chatbot-embed'
import { getPublicChatbotSettings, isChatbotDomainAllowed } from '@/lib/crm-public-chatbot'
import { getReferrerHost, getRequestHost } from '@/lib/crm-public-chatbot-server'

type PageProps = {
  params: Promise<{ channelId: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PublicChatbotPage(props: PageProps) {
  const { channelId } = await props.params
  const searchParams = props.searchParams ? await Promise.resolve(props.searchParams) : undefined
  const embedMode = searchParams?.mode === 'widget' ? 'widget' : 'iframe'
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
  const requestHost = await getRequestHost()
  const referrerHost = await getReferrerHost()
  const candidateHost = referrerHost || requestHost
  let accessIssue:
    | {
        code: 'embed_disabled' | 'domain_not_allowed'
        detectedHost: string
        allowedDomains: string[]
      }
    | undefined

  if (!settings.publicEmbedEnabled) {
    accessIssue = {
      code: 'embed_disabled',
      detectedHost: candidateHost,
      allowedDomains: settings.allowedDomains,
    }
  } else if (!isChatbotDomainAllowed({ allowedDomains: settings.allowedDomains, candidateHost, appHost: requestHost })) {
    accessIssue = {
      code: 'domain_not_allowed',
      detectedHost: candidateHost,
      allowedDomains: settings.allowedDomains,
    }
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
      embedMode={embedMode}
      floatingLauncherEnabled={settings.floatingLauncherEnabled}
      launcherLabel={settings.launcherLabel}
      launcherIcon={settings.launcherIcon}
      launcherPosition={settings.launcherPosition}
      launcherPlacement={settings.launcherPlacement}
      launcherSize={settings.launcherSize}
      launcherOffsetX={settings.launcherOffsetX}
      launcherOffsetY={settings.launcherOffsetY}
      launcherZIndex={settings.launcherZIndex}
      panelZIndex={settings.panelZIndex}
      backdropZIndex={settings.backdropZIndex}
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
      resetConversationAfterMinutes={settings.resetConversationAfterMinutes}
      resetConversationAfterAction={settings.resetConversationAfterAction}
      preChatFormEnabled={settings.preChatFormEnabled}
      preChatFormInactivityRule={settings.preChatFormInactivityRule}
      preChatFormTitle={settings.preChatFormTitle}
      preChatFormDescription={settings.preChatFormDescription}
      preChatFormSubmitLabel={settings.preChatFormSubmitLabel}
      preChatFormShowNameField={settings.preChatFormShowNameField}
      preChatFormShowEmailField={settings.preChatFormShowEmailField}
      preChatFormShowPhoneField={settings.preChatFormShowPhoneField}
      preChatFormRequireName={settings.preChatFormRequireName}
      preChatFormRequireEmail={settings.preChatFormRequireEmail}
      preChatFormRequirePhone={settings.preChatFormRequirePhone}
      preChatFormRequireContactMethod={settings.preChatFormRequireContactMethod}
      preChatFormShowDepartmentField={settings.preChatFormShowDepartmentField}
      preChatFormDepartmentLabel={settings.preChatFormDepartmentLabel}
      preChatFormDepartmentPlaceholder={settings.preChatFormDepartmentPlaceholder}
      preChatFormDepartmentOptions={settings.preChatFormDepartmentOptions}
      termsEnabled={settings.termsEnabled}
      termsLabel={settings.termsLabel}
      termsLinkText={settings.termsLinkText}
      termsLinkUrl={settings.termsLinkUrl}
      startStageId={settings.startStageId}
      quickActions={settings.quickActions}
      flowStages={settings.flowStages}
      allowHumanHandoff={settings.allowHumanHandoff}
      accessIssue={accessIssue}
    />
  )
}