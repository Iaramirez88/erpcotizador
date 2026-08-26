import 'server-only'

import { prisma } from '@/lib/prisma'
import {
  BUSINESS_TYPES,
  getBusinessTypeCardDescription,
  getBusinessTypeLabel,
  isBusinessType,
  RESTRICTED_SELF_ONBOARDING_BUSINESS_TYPES,
  type BusinessType,
} from '@/lib/company-onboarding'

type DbRow = {
  business_type: string
  active: boolean
  sort_order: number
  updated_at: Date
}

export type OnboardingBusinessTypeSettingRow = {
  businessType: BusinessType
  label: string
  description: string
  active: boolean
  sortOrder: number
  updatedAt: string
}

let setupPromise: Promise<void> | null = null

const RESTRICTED_SELF_ONBOARDING_SET = new Set<BusinessType>(RESTRICTED_SELF_ONBOARDING_BUSINESS_TYPES)

function canSelfOnboardBusinessType(businessType: BusinessType) {
  return !RESTRICTED_SELF_ONBOARDING_SET.has(businessType)
}

async function ensureOnboardingBusinessTypeSettingsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS onboarding_business_type_settings (
      business_type TEXT PRIMARY KEY,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  for (const [index, businessType] of BUSINESS_TYPES.entries()) {
    await prisma.$executeRaw`
      INSERT INTO onboarding_business_type_settings (business_type, active, sort_order)
      VALUES (${businessType}, ${canSelfOnboardBusinessType(businessType)}, ${index * 10})
      ON CONFLICT (business_type)
      DO UPDATE SET
        active = CASE
          WHEN onboarding_business_type_settings.business_type IN ('ODONTOLOGIA', 'RESTAURANTE', 'DOTACIONES')
            THEN FALSE
          ELSE onboarding_business_type_settings.active
        END,
        sort_order = EXCLUDED.sort_order
    `
  }
}

async function ensureSetup() {
  if (!setupPromise) {
    setupPromise = ensureOnboardingBusinessTypeSettingsTable().catch((error) => {
      setupPromise = null
      throw error
    })
  }

  await setupPromise
}

function mapRow(row: DbRow): OnboardingBusinessTypeSettingRow | null {
  if (!isBusinessType(row.business_type)) return null

  return {
    businessType: row.business_type,
    label: getBusinessTypeLabel(row.business_type),
    description: getBusinessTypeCardDescription(row.business_type),
    active: row.active,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at.toISOString(),
  }
}

export async function listOnboardingBusinessTypeSettings(args?: { includeInactive?: boolean }) {
  await ensureSetup()

  const rows = await prisma.$queryRaw<DbRow[]>`
    SELECT business_type, active, sort_order, updated_at
    FROM onboarding_business_type_settings
    ORDER BY sort_order ASC, business_type ASC
  `

  const mapped = rows
    .map(mapRow)
    .filter((row): row is OnboardingBusinessTypeSettingRow => Boolean(row))

  return args?.includeInactive ? mapped : mapped.filter((row) => row.active)
}

export async function getVisibleOnboardingBusinessTypes() {
  const rows = await listOnboardingBusinessTypeSettings()
  return rows.filter((row) => canSelfOnboardBusinessType(row.businessType)).map((row) => row.businessType)
}

export async function saveOnboardingBusinessTypeSetting(args: {
  businessType: BusinessType
  active: boolean
  sortOrder: number
}) {
  await ensureSetup()

  const normalizedSortOrder = Number.isFinite(args.sortOrder) ? Math.trunc(args.sortOrder) : 0

  await prisma.$executeRaw`
    INSERT INTO onboarding_business_type_settings (business_type, active, sort_order, updated_at)
    VALUES (${args.businessType}, ${canSelfOnboardBusinessType(args.businessType) ? args.active : false}, ${normalizedSortOrder}, NOW())
    ON CONFLICT (business_type)
    DO UPDATE SET
      active = EXCLUDED.active,
      sort_order = EXCLUDED.sort_order,
      updated_at = NOW()
  `

  const rows = await listOnboardingBusinessTypeSettings({ includeInactive: true })
  const row = rows.find((item) => item.businessType === args.businessType)
  if (!row) throw new Error('No se pudo guardar la configuración del nicho')
  return row
}