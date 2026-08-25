import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveUserIdFromSession } from '@/lib/session-user'
import RopOpportunityCreateClient from './rop-opportunity-create-client'

export const runtime = 'nodejs'

export default async function RopNuevaNecesidadPage({
  searchParams,
}: {
  searchParams?: Promise<{ serviceCatalogId?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard/rop')

  const params = searchParams ? await searchParams : undefined

  return <RopOpportunityCreateClient initialServiceCatalogId={params?.serviceCatalogId} />
}