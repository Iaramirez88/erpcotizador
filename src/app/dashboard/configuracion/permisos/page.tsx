import { redirect } from 'next/navigation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default async function PermisosPage({ searchParams }: PageProps) {
  const requestedSedeIdRaw = searchParams?.sedeId
  const requestedSedeId = typeof requestedSedeIdRaw === 'string' ? requestedSedeIdRaw.trim() : ''
  redirect(requestedSedeId ? `/dashboard/configuracion/usuarios?sedeId=${encodeURIComponent(requestedSedeId)}` : '/dashboard/configuracion/usuarios')
}
