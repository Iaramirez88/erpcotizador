import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { getCrmAddonForEmpresa, isCrmAddonCode, saveDailyCallsAddonForEmpresa, validateAndPersistDailyCallsAddonForEmpresa } from '@/lib/crm-addons'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ code: string }>
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { code } = await context.params
    if (!isCrmAddonCode(code)) {
      return NextResponse.json({ error: 'Addon inválido' }, { status: 400 })
    }

    const addon = await getCrmAddonForEmpresa({ empresaId: access.empresaId, code })
    return NextResponse.json({ success: true, data: addon })
  } catch (error) {
    console.error('Error consultando addon CRM:', error)
    return NextResponse.json({ error: 'Error consultando addon CRM' }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { code } = await context.params
    if (code !== 'DAILY_CALLS') {
      return NextResponse.json({ error: 'Addon inválido' }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const enabled = body?.enabled === true
    const connectionMode = body?.connectionMode === 'CUSTOMER_DAILY' ? 'CUSTOMER_DAILY' : 'SGDIGITAL_MANAGED'
    const defaultCallType = body?.defaultCallType === 'audio' ? 'audio' : 'video'
    const commercialStatus = body?.commercialStatus === 'QUOTE_REQUIRED' || body?.commercialStatus === 'ACTIVE' || body?.commercialStatus === 'SUSPENDED'
      ? body.commercialStatus
      : 'INTERNAL_TEST'

    const addon = await saveDailyCallsAddonForEmpresa({
      empresaId: access.empresaId,
      enabled,
      connectionMode,
      dailyDomain: normalizeString(body?.dailyDomain),
      roomPrefix: normalizeString(body?.roomPrefix),
      enableRecording: body?.enableRecording === true,
      defaultCallType,
      commercialStatus,
      commercialNotes: normalizeString(body?.commercialNotes),
      apiKey: typeof body?.apiKey === 'string' ? body.apiKey : undefined,
    })

    return NextResponse.json({ success: true, data: addon })
  } catch (error) {
    console.error('Error guardando addon CRM:', error)
    return NextResponse.json({ error: 'Error guardando addon CRM' }, { status: 500 })
  }
}

export async function POST(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { code } = await context.params
    if (code !== 'DAILY_CALLS') {
      return NextResponse.json({ error: 'Addon inválido' }, { status: 400 })
    }

    const addon = await validateAndPersistDailyCallsAddonForEmpresa(access.empresaId)
    return NextResponse.json({ success: true, data: addon })
  } catch (error) {
    console.error('Error validando addon CRM:', error)
    return NextResponse.json({ error: 'Error validando addon CRM' }, { status: 500 })
  }
}