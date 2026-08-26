import { redirect } from 'next/navigation'
import { canAccessRopModule } from '@/lib/rop-access'
import RopOpportunityCreateClient from './rop-opportunity-create-client'

export const runtime = 'nodejs'

export default async function RopNuevaNecesidadPage({
  searchParams,
}: {
  searchParams?: Promise<{ serviceCatalogId?: string }>
}) {
  const access = await canAccessRopModule()
  if (!access.ok) redirect('/dashboard')

  const params = searchParams ? await searchParams : undefined

  return <RopOpportunityCreateClient initialServiceCatalogId={params?.serviceCatalogId} />
}