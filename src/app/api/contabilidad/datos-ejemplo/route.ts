import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  getAccountingSampleDataStatus,
  removeAccountingSampleData,
  seedAccountingSampleData,
} from '@/lib/accounting/sample-data'

export const runtime = 'nodejs'

/** Estado de los datos de ejemplo disponibles en la empresa. */
export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.READ)
  if (!access.ok) return access.response

  const status = await getAccountingSampleDataStatus(access.empresaId)
  return NextResponse.json({ ok: true, data: status })
}

/** Carga (o refresca) los tres registros contables de ejemplo. */
export async function POST() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  try {
    const seeded = await seedAccountingSampleData({ empresaId: access.empresaId, actorUserId: access.userId })
    const status = await getAccountingSampleDataStatus(access.empresaId)
    return NextResponse.json({ ok: true, data: { ...seeded, status } })
  } catch (error) {
    console.error('Error cargando los datos contables de ejemplo:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No fue posible cargar los datos de ejemplo' },
      { status: 500 },
    )
  }
}

/** Quita los datos de ejemplo marcados; no toca la información real. */
export async function DELETE() {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  try {
    const removed = await removeAccountingSampleData(access.empresaId)
    const status = await getAccountingSampleDataStatus(access.empresaId)
    return NextResponse.json({ ok: true, data: { ...removed, status } })
  } catch (error) {
    console.error('Error quitando los datos contables de ejemplo:', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'No fue posible quitar los datos de ejemplo' },
      { status: 500 },
    )
  }
}
