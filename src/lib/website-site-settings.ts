import { z } from 'zod'

const linkSchema = z.object({
  label: z.string().trim().max(80).default(''),
  href: z.string().trim().max(500).default('#'),
})

export const themeSchema = z.object({
  backgroundColor: z.string().trim().default('#ffffff'),
  textColor: z.string().trim().default('#0f172a'),
  fontFamily: z.string().trim().default('ui-sans-serif, system-ui, sans-serif'),
  headingFontFamily: z.string().trim().default(''),
  accentColor: z.string().trim().default('#2563eb'),
  buttonRadius: z.coerce.number().min(0).max(40).default(8),
  containerMaxWidth: z.coerce.number().min(640).max(1600).default(1240),
})

export const headerSchema = z.object({
  enabled: z.boolean().default(false),
  brand: z.string().trim().default(''),
  logoUrl: z.string().trim().default(''),
  links: z.array(linkSchema).default([]),
  buttonLabel: z.string().trim().default(''),
  buttonHref: z.string().trim().default(''),
  sticky: z.boolean().default(false),
  backgroundColor: z.string().trim().default('#ffffff'),
  textColor: z.string().trim().default('#0f172a'),
})

export const footerSchema = z.object({
  enabled: z.boolean().default(false),
  brand: z.string().trim().default(''),
  description: z.string().trim().default(''),
  copyright: z.string().trim().default(''),
  links: z.array(linkSchema).default([]),
  backgroundColor: z.string().trim().default('#0f172a'),
  textColor: z.string().trim().default('#ffffff'),
})

export const websiteSiteSettingsSchema = z.object({
  theme: themeSchema,
  header: headerSchema,
  footer: footerSchema,
  customCss: z.string().default(''),
  customJsHead: z.string().default(''),
  customJsBody: z.string().default(''),
})

export type WebsiteSiteSettings = z.infer<typeof websiteSiteSettingsSchema>
export type WebsiteThemeSettings = z.infer<typeof themeSchema>
export type WebsiteHeaderSettings = z.infer<typeof headerSchema>
export type WebsiteFooterSettings = z.infer<typeof footerSchema>

export function defaultWebsiteSiteSettings(): WebsiteSiteSettings {
  return {
    theme: themeSchema.parse({}),
    header: headerSchema.parse({}),
    footer: footerSchema.parse({}),
    customCss: '',
    customJsHead: '',
    customJsBody: '',
  }
}

export function normalizeWebsiteSiteSettings(value: unknown): WebsiteSiteSettings {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

  const theme = themeSchema.safeParse(input.theme)
  const header = headerSchema.safeParse(input.header)
  const footer = footerSchema.safeParse(input.footer)

  return {
    theme: theme.success ? theme.data : themeSchema.parse({}),
    header: header.success ? header.data : headerSchema.parse({}),
    footer: footer.success ? footer.data : footerSchema.parse({}),
    customCss: typeof input.customCss === 'string' ? input.customCss : '',
    customJsHead: typeof input.customJsHead === 'string' ? input.customJsHead : '',
    customJsBody: typeof input.customJsBody === 'string' ? input.customJsBody : '',
  }
}
