import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import bcrypt from 'bcryptjs'
import { mergeCompanyIntelligenceSettings, parseCompanyIntelligenceSettings } from '@/lib/company-intelligence'
import { mergeCompanyTaskSettings, parseCompanyTaskSettings } from '@/lib/company-task-settings'
import {
  buildCompanyPreset,
  clearCompanyPresetDashboardConfig,
  isBusinessType,
  mergeCompanyPresetDashboardConfig,
  parseCompanyOnboardingData,
} from '@/lib/company-onboarding'
import { ensureBusinessTypeSeedsForEmpresa } from '@/lib/business-type-seeds'
import { syncCompanyPresetAccess } from '@/lib/company-preset-sync'
import { ensureWorkspaceCodeForEmpresa } from '@/lib/workspace-code'

export const runtime = 'nodejs'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export async function GET() {
  const access = await requireCapabilityAccess({
    domain: 'CORE',
    subdomain: 'COMPANY',
    action: 'READ',
    scope: 'EMPRESA',
  })
  if (!access.ok) return access.response

  const sede = await prisma.sede.findUnique({
    where: { id: access.sedeId },
    select: {
      empresa: {
        select: {
          id: true,
          workspaceCode: true,
          nombre: true,
          nit: true,
          logo: true,
          dashboardConfig: true,
          registrationCodeHash: true,
        },
      },
    },
  })

  const empresa = sede?.empresa
  if (!empresa) {
    return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })
  }

  const workspaceCode = empresa.workspaceCode || (await ensureWorkspaceCodeForEmpresa(empresa.id))

  return NextResponse.json({
    ok: true,
    data: {
      empresaId: empresa.id,
      workspaceCode,
      nombre: empresa.nombre,
      nit: empresa.nit,
      logo: empresa.logo,
      intelligenceEnabled: parseCompanyIntelligenceSettings(empresa.dashboardConfig).enabled,
      taskCancellationReasonRequired: parseCompanyTaskSettings(empresa.dashboardConfig).requireTaskCancellationReason,
      hasRegistrationCode: Boolean(empresa.registrationCodeHash),
    },
  })
}

export async function PUT(request: NextRequest) {
  const access = await requireCapabilityAccess({
    domain: 'CORE',
    subdomain: 'COMPANY',
    action: 'CONFIGURE',
    scope: 'EMPRESA',
  })
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const sede = await prisma.sede.findUnique({
    where: { id: access.sedeId },
    select: { empresaId: true },
  })

  const empresaId = sede?.empresaId
  if (!empresaId) {
    return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })
  }

  const currentEmpresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { dashboardConfig: true, businessType: true, onboardingData: true, onboardingCompletedAt: true },
  })

  const nombreRaw = asString(body.nombre).trim()
  const nitRaw = asString(body.nit).trim()
  const logoRaw = asString(body.logo).trim()
  const intelligenceEnabled = typeof body.intelligenceEnabled === 'boolean' ? body.intelligenceEnabled : null
  const taskCancellationReasonRequired = typeof body.taskCancellationReasonRequired === 'boolean'
    ? body.taskCancellationReasonRequired
    : null
  const clearCompanyPreset = body.clearCompanyPreset === true
  const companyPresetBusinessTypeRaw = typeof body.companyPresetBusinessType === 'string'
    ? body.companyPresetBusinessType.trim()
    : ''
  const nextBusinessType = companyPresetBusinessTypeRaw && isBusinessType(companyPresetBusinessTypeRaw)
    ? companyPresetBusinessTypeRaw
    : null

  const updateData: {
    nombre?: string
    logo?: string | null
    registrationCodeHash?: string | null
    nit?: string
    dashboardConfig?: Prisma.InputJsonValue
    businessType?: string | null
    onboardingStatus?: string
    onboardingCompletedAt?: Date | null
    onboardingData?: Prisma.InputJsonValue
  } = {}

  if (nombreRaw) updateData.nombre = nombreRaw
  if (nitRaw) updateData.nit = nitRaw
  if (body.logo !== undefined) {
    updateData.logo = logoRaw ? logoRaw : null
  }

  if (Object.prototype.hasOwnProperty.call(body, 'registrationCode')) {
    const rc = body.registrationCode
    if (rc === null) {
      updateData.registrationCodeHash = null
    } else {
      const code = asString(rc).trim()
      if (code) {
        updateData.registrationCodeHash = await bcrypt.hash(code, 12)
      }
    }
  }

  if (intelligenceEnabled !== null) {
    updateData.dashboardConfig = mergeCompanyIntelligenceSettings(currentEmpresa?.dashboardConfig, {
      enabled: intelligenceEnabled,
    }) as Prisma.InputJsonValue
  }

  if (taskCancellationReasonRequired !== null) {
    updateData.dashboardConfig = mergeCompanyTaskSettings(updateData.dashboardConfig ?? currentEmpresa?.dashboardConfig, {
      requireTaskCancellationReason: taskCancellationReasonRequired,
    }) as Prisma.InputJsonValue
  }

  let presetModules: string[] | null = null

  if (clearCompanyPreset) {
    updateData.businessType = null
    updateData.onboardingStatus = 'COMPLETED'
    updateData.onboardingCompletedAt = null
    updateData.onboardingData = {} as Prisma.InputJsonValue
    updateData.dashboardConfig = clearCompanyPresetDashboardConfig(updateData.dashboardConfig ?? currentEmpresa?.dashboardConfig) as Prisma.InputJsonValue
  } else if (companyPresetBusinessTypeRaw) {
    if (!nextBusinessType) {
      return NextResponse.json({ ok: false, error: 'Tipo de negocio inválido' }, { status: 400 })
    }

    const onboardingData = {
      ...parseCompanyOnboardingData(currentEmpresa?.onboardingData),
      businessType: nextBusinessType,
    }
    const preset = buildCompanyPreset(onboardingData)
    presetModules = preset.modules

    await ensureBusinessTypeSeedsForEmpresa({ empresaId, businessType: nextBusinessType })

    updateData.businessType = nextBusinessType
    updateData.onboardingStatus = 'COMPLETED'
    updateData.onboardingCompletedAt = currentEmpresa?.onboardingCompletedAt ?? new Date()
    updateData.onboardingData = onboardingData as Prisma.InputJsonValue
    updateData.dashboardConfig = mergeCompanyPresetDashboardConfig(
      updateData.dashboardConfig ?? currentEmpresa?.dashboardConfig,
      preset.dashboard
    ) as Prisma.InputJsonValue
  }

  const empresa = await prisma.empresa.update({
    where: { id: empresaId },
    data: updateData,
    select: { id: true, nombre: true, nit: true, logo: true, dashboardConfig: true, registrationCodeHash: true },
  })

  if (presetModules) {
    await syncCompanyPresetAccess({
      empresaId: empresa.id,
      businessType: nextBusinessType,
      modules: presetModules as never,
      grantedByUserId: access.userId,
    })
  }

  return NextResponse.json({
    ok: true,
    data: {
      empresaId: empresa.id,
      nombre: empresa.nombre,
      nit: empresa.nit,
      logo: empresa.logo,
      intelligenceEnabled: parseCompanyIntelligenceSettings(empresa.dashboardConfig).enabled,
      taskCancellationReasonRequired: parseCompanyTaskSettings(empresa.dashboardConfig).requireTaskCancellationReason,
      hasRegistrationCode: Boolean(empresa.registrationCodeHash),
    },
  })
}
