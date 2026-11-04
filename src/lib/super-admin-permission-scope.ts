import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { isSuperAdminEmail } from '@/lib/super-admin'

export type PermissionScopeResult =
  | { ok: true; empresaId: string; isSuperAdmin: boolean }
  | { ok: false; error: string; status: number }

/**
 * Resuelve sobre qué empresa se aplican los cambios de permisos de `/api/admin/permisos/*`.
 *
 * - Sin `empresaId` explícito: se usa la empresa del usuario autenticado (comportamiento
 *   histórico, consumido por `/dashboard/configuracion/usuarios`).
 * - Con `empresaId` explícito: sólo el Super Admin puede operar sobre otra empresa. Así la
 *   pantalla unificada de super admin reutiliza exactamente el mismo motor de permisos que
 *   ve el administrador de la empresa, sin duplicar reglas.
 */
export async function resolvePermissionScope(args: {
  sessionUser: { id?: string | null; email?: string | null; role?: string | null } | null | undefined
  requestedEmpresaId?: unknown
}): Promise<PermissionScopeResult> {
  const userId = (args.sessionUser?.id ?? '').trim()
  if (!userId) return { ok: false, error: 'No autorizado', status: 401 }

  const requested = typeof args.requestedEmpresaId === 'string' ? args.requestedEmpresaId.trim() : ''
  const isSuperAdmin = isSuperAdminEmail(args.sessionUser?.email ?? null)

  if (!requested) {
    try {
      const empresaId = await requireEmpresaIdForUser(userId)
      if (!empresaId) return { ok: false, error: 'No autorizado', status: 403 }
      return { ok: true, empresaId, isSuperAdmin }
    } catch {
      return { ok: false, error: 'No autorizado', status: 403 }
    }
  }

  if (!isSuperAdmin) return { ok: false, error: 'No autorizado', status: 403 }

  const empresa = await prisma.empresa.findUnique({ where: { id: requested }, select: { id: true } })
  if (!empresa?.id) return { ok: false, error: 'Empresa no encontrada', status: 404 }

  return { ok: true, empresaId: empresa.id, isSuperAdmin }
}
