import type { ComponentType } from 'react'
import type { CrmOriginKey } from '@/lib/crm-origin'

export type BrandLogoProps = { className?: string }
export type BrandLogoComponent = ComponentType<BrandLogoProps>

// Los logos oficiales se sirven como SVG desde /public/brand-logos para conservar
// los colores corporativos (un SVG inline con currentColor los aplanaría).
export function brandLogo(src: string): BrandLogoComponent {
  return function BrandLogoImage({ className = 'h-5 w-5' }: BrandLogoProps) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" aria-hidden="true" draggable={false} className={`object-contain ${className}`} />
    )
  }
}

export const MetaBrandLogo = brandLogo('/brand-logos/meta.svg')
export const FacebookBrandLogo = brandLogo('/brand-logos/facebook.svg')
export const MessengerBrandLogo = brandLogo('/brand-logos/messenger.svg')
export const InstagramBrandLogo = brandLogo('/brand-logos/instagram.svg')
export const WhatsAppBrandLogo = brandLogo('/brand-logos/whatsapp.svg')
export const TikTokBrandLogo = brandLogo('/brand-logos/tiktok.svg')
export const YouTubeBrandLogo = brandLogo('/brand-logos/youtube.svg')
export const GmailBrandLogo = brandLogo('/brand-logos/gmail.svg')
export const OutlookBrandLogo = brandLogo('/brand-logos/outlook.svg')
export const GoogleSheetsBrandLogo = brandLogo('/brand-logos/google-sheets.svg')
export const GoogleCalendarBrandLogo = brandLogo('/brand-logos/google-calendar.svg')
export const MicrosoftBrandLogo = brandLogo('/brand-logos/microsoft.svg')
export const TeamsBrandLogo = brandLogo('/brand-logos/teams.svg')
export const SlackBrandLogo = brandLogo('/brand-logos/slack.svg')

/**
 * Mapa origen CRM → logo oficial, usado por los badges de origen
 * (dashboard, agenda, leads) para no mostrar iconos genéricos.
 */
export const ORIGIN_BRAND_LOGOS: Partial<Record<CrmOriginKey, BrandLogoComponent>> = {
  EMAIL_GMAIL: GmailBrandLogo,
  EMAIL_OUTLOOK: OutlookBrandLogo,
  GOOGLE_SHEETS: GoogleSheetsBrandLogo,
  LEAD_TIKTOK: TikTokBrandLogo,
  LEAD_YOUTUBE: YouTubeBrandLogo,
  WHATSAPP: WhatsAppBrandLogo,
  MESSENGER_FACEBOOK: MessengerBrandLogo,
  INSTAGRAM_DM: InstagramBrandLogo,
}

export type CrmBrandProvider =
  | 'WHATSAPP_CLOUD'
  | 'WHATSAPP_SANDBOX'
  | 'FACEBOOK_PAGE'
  | 'MESSENGER'
  | 'INSTAGRAM_DM'
  | 'WEB_FORM'
  | 'WEB_CHATBOT'

/**
 * Logo oficial del canal. Devuelve `null` para canales sin marca propia
 * (formulario web / chatbot web) para que la UI decida el fallback.
 */
export function getProviderBrandLogo(provider: string | null | undefined): BrandLogoComponent | null {
  if (provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX') return WhatsAppBrandLogo
  if (provider === 'INSTAGRAM_DM') return InstagramBrandLogo
  if (provider === 'MESSENGER') return MessengerBrandLogo
  if (provider === 'FACEBOOK_PAGE') return FacebookBrandLogo
  return null
}
