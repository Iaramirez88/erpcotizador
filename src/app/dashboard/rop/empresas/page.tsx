import { redirect } from 'next/navigation'
import { canAccessRopModule } from '@/lib/rop-access'
import RopDiscoveryClient from './rop-discovery-client'

export const runtime = 'nodejs'

export default async function RopEmpresasPage() {
  const access = await canAccessRopModule()
  if (!access.ok) redirect('/dashboard')

  return <RopDiscoveryClient />
}