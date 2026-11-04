import { redirect } from 'next/navigation'

export const runtime = 'nodejs'

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * La administración de usuarios vive ahora dentro de la pantalla única de empresas
 * (detalle de empresa → pestaña "Usuarios y permisos"). Esta ruta solo conserva enlaces viejos.
 */
export default async function SuperAdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams
  const empresaIdRaw = params?.empresaId ?? params?.empresa
  const empresaId = typeof empresaIdRaw === 'string' ? empresaIdRaw.trim() : ''

  if (empresaId) {
    redirect(
      `/dashboard/configuracion/super-admin/empresas?empresaId=${encodeURIComponent(empresaId)}&tab=usuarios`
    )
  }

  redirect('/dashboard/configuracion/super-admin/empresas')
}

