import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CrmPublicBookingEmbed } from '@/components/crm/crm-public-booking-embed'
import { getPublicWebFormSettings, getReferrerHost, isPublicWebFormDomainAllowed } from '@/lib/crm-public-web-form'

type PageProps = {
  params: Promise<{ channelId: string }>
}

export default async function PublicBookingPage(props: PageProps) {
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

  if (!settings.publicEmbedEnabled || bridgeKind !== 'BOOKING') {
    notFound()
  }

  const referrerHost = await getReferrerHost()
  if (referrerHost && !isPublicWebFormDomainAllowed({ allowedDomains: settings.allowedDomains, candidateHost: referrerHost })) {
    notFound()
  }

  const rawSettings = channel.settingsJson && typeof channel.settingsJson === 'object' && !Array.isArray(channel.settingsJson)
    ? channel.settingsJson as Record<string, unknown>
    : {}
  const customTitle = typeof rawSettings.formTitle === 'string' ? rawSettings.formTitle.trim() : ''
  const customDescription = typeof rawSettings.formDescription === 'string' ? rawSettings.formDescription.trim() : ''

  return (
    <CrmPublicBookingEmbed
      channelId={channel.id}
      title={customTitle || channel.name}
      description={customDescription || 'Elige el día y la hora que mejor te funcionen. La agenda se sincroniza con el CRM en tiempo real.'}
      submitLabel={settings.submitCtaLabel || 'Confirmar cita'}
      successMessage={settings.successMessage || 'Tu cita fue registrada correctamente.'}
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
      nameLabel={settings.nameLabel}
      namePlaceholder={settings.namePlaceholder}
      emailLabel={settings.emailLabel}
      emailPlaceholder={settings.emailPlaceholder}
      phoneLabel={settings.phoneLabel}
      phonePlaceholder={settings.phonePlaceholder}
      serviceLabel={settings.productLabel || 'Servicio'}
      servicePlaceholder={settings.productPlaceholder || 'Selecciona el servicio o motivo de la cita'}
      messageLabel={settings.messageLabel}
      messagePlaceholder={settings.messagePlaceholder}
      showEmailField={settings.showEmailField}
      showPhoneField={settings.showPhoneField}
      showServiceField={settings.showProductField}
      showMessageField={settings.showMessageField}
      durationMinutes={settings.booking.durationMinutes}
      durationLabel={settings.booking.durationLabel}
      slotIntervalMinutes={settings.booking.slotIntervalMinutes}
      capacityPerSlot={settings.booking.capacityPerSlot}
      minNoticeMinutes={settings.booking.minNoticeMinutes}
      maxAdvanceDays={settings.booking.maxAdvanceDays}
      timezoneLabel={settings.booking.timezoneLabel}
      businessHours={settings.booking.businessHours}
      blockedDates={settings.booking.blockedDates}
      notifyEmail={settings.bookingNotifyByEmail && settings.responseEmailEnabled}
      notifyWhatsApp={settings.bookingNotifyByWhatsApp}
    />
  )
}
