import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CrmPublicWebFormEmbed } from '@/components/crm/crm-public-web-form-embed'
import { getPublicWebFormSettings, getReferrerHost, isPublicWebFormDomainAllowed } from '@/lib/crm-public-web-form'

type PageProps = {
  params: Promise<{ channelId: string }>
}

export default async function PublicWebFormPage(props: PageProps) {
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

  if (!channel || channel.provider !== 'WEB_FORM' || !['TESTING', 'ACTIVE'].includes(channel.status)) {
    notFound()
  }

  const settings = getPublicWebFormSettings(channel.settingsJson)
  const bridgeKind = typeof (channel.settingsJson as Record<string, unknown> | null | undefined)?.bridgeKind === 'string'
    ? (channel.settingsJson as Record<string, unknown>).bridgeKind
    : 'GENERIC'

  if (!settings.publicEmbedEnabled || bridgeKind !== 'GENERIC') {
    notFound()
  }

  const referrerHost = await getReferrerHost()
  if (referrerHost && !isPublicWebFormDomainAllowed({ allowedDomains: settings.allowedDomains, candidateHost: referrerHost })) {
    notFound()
  }

  return (
    <CrmPublicWebFormEmbed
      channelId={channel.id}
      title={settings.formTitle || channel.name}
      description={settings.formDescription}
      submitLabel={settings.submitCtaLabel}
      successMessage={settings.successMessage}
      accentColor={settings.accentColor}
      pageBackgroundColor={settings.pageBackgroundColor}
      backgroundColor={settings.backgroundColor}
      fontFamily={settings.fontFamily}
      fontSize={settings.fontSize}
      labelColor={settings.labelColor}
      inputTextColor={settings.inputTextColor}
      inputBackgroundColor={settings.inputBackgroundColor}
      inputBorderColor={settings.inputBorderColor}
      ctaColor={settings.ctaColor}
      ctaTextColor={settings.ctaTextColor}
      formCardRadius={settings.formCardRadius}
      inputRadius={settings.inputRadius}
      fieldSpacing={settings.fieldSpacing}
      formPadding={settings.formPadding}
      showNameField={settings.showNameField}
      showEmailField={settings.showEmailField}
      showPhoneField={settings.showPhoneField}
      showCompanyField={settings.showCompanyField}
      showCityField={settings.showCityField}
      showProductField={settings.showProductField}
      showMessageField={settings.showMessageField}
      nameLabel={settings.nameLabel}
      namePlaceholder={settings.namePlaceholder}
      emailLabel={settings.emailLabel}
      emailPlaceholder={settings.emailPlaceholder}
      phoneLabel={settings.phoneLabel}
      phonePlaceholder={settings.phonePlaceholder}
      companyLabel={settings.companyLabel}
      companyPlaceholder={settings.companyPlaceholder}
      cityLabel={settings.cityLabel}
      cityPlaceholder={settings.cityPlaceholder}
      productLabel={settings.productLabel}
      productPlaceholder={settings.productPlaceholder}
      messageLabel={settings.messageLabel}
      messagePlaceholder={settings.messagePlaceholder}
      customFields={settings.customFields}
      variables={settings.variables}
      termsEnabled={settings.termsEnabled}
      termsRequired={settings.termsRequired}
      termsLabel={settings.termsLabel}
      termsLinkText={settings.termsLinkText}
      termsLinkUrl={settings.termsLinkUrl}
    />
  )
}