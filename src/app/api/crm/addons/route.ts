import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { listCrmAddonsForEmpresa } from '@/lib/crm-addons'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const addons = await listCrmAddonsForEmpresa(access.empresaId)
    return NextResponse.json({ success: true, data: addons })
  } catch (error) {
    console.error('Error listando addons CRM:', error)
    return NextResponse.json({ error: 'Error listando addons CRM' }, { status: 500 })
  }
}